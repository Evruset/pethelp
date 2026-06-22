import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { DomainErrors, DomainException } from '../common/domain-error';
import { config } from '../config';
import { canTransition } from './booking-state-machine';
import { BookingRepository } from './booking.repository';
import { ConfirmHoldResult, CreateHoldResult, HoldRow, ReleaseHoldResult, SlotRow } from './booking.types';

interface IdempotencyRow {
  id: string;
  status: 'PROCESSING' | 'COMPLETED';
  response_status: number | null;
  response_body: Record<string, unknown> | null;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly repository: BookingRepository,
  ) {}

  async createLocalHold(input: { slotId: string; ownerId: string; petId: string; idempotencyKey: string; correlationId: string }): Promise<CreateHoldResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);
        const existing = await this.acquireIdempotency(client, 'booking.create-local-hold', input.idempotencyKey);
        if (existing) return existing as unknown as CreateHoldResult;

        const slot = await this.repository.lockSlot(client, input.slotId);
        if (!slot) throw DomainErrors.slotNotFound();
        const now = await this.repository.now(client);
        if (slot.state !== 'OPEN' || slot.starts_at <= now || slot.capacity - slot.booked_count - slot.held_count <= 0) {
          throw DomainErrors.slotAlreadyTaken();
        }

        const hold = await client.query<HoldRow>(`
          INSERT INTO booking_schema.booking_holds (slot_id, owner_id, pet_id, state, expires_at)
          VALUES ($1, $2, $3, 'MANUAL_CONFIRM_PENDING', clock_timestamp() + ($4::text || ' minutes')::interval)
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [input.slotId, input.ownerId, input.petId, config.holdTtlMinutes]);

        await client.query(`
          UPDATE clinic_schema.appointment_slots
          SET held_count = held_count + 1,
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1
        `, [input.slotId]);

        const result: CreateHoldResult = {
          holdId: hold.rows[0].id,
          state: 'MANUAL_CONFIRM_PENDING',
          slotId: input.slotId,
          expiresAt: hold.rows[0].expires_at.toISOString(),
          correlationId: input.correlationId,
        };

        await this.writeOutbox(client, {
          eventType: 'booking.hold.created.v1',
          correlationId: input.correlationId,
          aggregateType: 'booking_hold',
          aggregateId: hold.rows[0].id,
          aggregateVersion: hold.rows[0].version,
          payload: { holdId: hold.rows[0].id, slotId: input.slotId, ownerId: input.ownerId, petId: input.petId, expiresAt: result.expiresAt },
        });
        await this.writeAudit(client, 'OWNER', input.ownerId, 'booking.hold.created', 'booking_hold', hold.rows[0].id, input.correlationId, { slotId: input.slotId });
        await this.completeIdempotency(client, 'booking.create-local-hold', input.idempotencyKey, result, HttpStatus.CREATED);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async confirmManualHold(input: { holdId: string; clinicLocationId: string; idempotencyKey: string; correlationId: string }): Promise<ConfirmHoldResult> {
    try {
      const outcome = await this.database.withTransaction(async (client): Promise<ConfirmHoldResult | { kind: 'EXPIRED' }> => {
        await this.setInteractiveTransactionLimits(client);
        const existing = await this.acquireIdempotency(client, 'booking.confirm-manual-hold', input.idempotencyKey);
        if (existing) return existing as unknown as ConfirmHoldResult;

        const holdForSlot = await client.query<{ slot_id: string }>('SELECT slot_id FROM booking_schema.booking_holds WHERE id = $1', [input.holdId]);
        if (!holdForSlot.rows[0]) throw DomainErrors.holdNotFound();

        const slot = await this.repository.lockSlot(client, holdForSlot.rows[0].slot_id);
        if (!slot) throw DomainErrors.slotNotFound();
        const hold = await this.repository.lockHold(client, input.holdId);
        if (!hold) throw DomainErrors.holdNotFound();
        this.assertClinicScope(slot, input.clinicLocationId);

        const now = await this.repository.now(client);
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.expireLockedHold(client, hold, slot, input.correlationId, 'WORKER', 'manual-confirm-detected-expiry');
          await this.completeIdempotencyError(client, 'booking.confirm-manual-hold', input.idempotencyKey, DomainErrors.holdExpired());
          return { kind: 'EXPIRED' };
        }
        if (!canTransition(hold.state, 'CONFIRMED')) throw DomainErrors.invalidTransition();

        const updatedHold = await client.query<HoldRow>(`
          UPDATE booking_schema.booking_holds
          SET state = 'CONFIRMED', state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
          WHERE id = $1
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [hold.id]);
        await client.query(`
          UPDATE clinic_schema.appointment_slots
          SET held_count = held_count - 1,
              booked_count = booked_count + 1,
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1
        `, [slot.id]);
        const appointment = await client.query<{ id: string }>(`
          INSERT INTO booking_schema.appointments (hold_id, owner_id, pet_id, clinic_location_id, slot_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [hold.id, hold.owner_id, hold.pet_id, slot.clinic_location_id, slot.id]);
        const result: ConfirmHoldResult = {
          holdId: hold.id,
          appointmentId: appointment.rows[0].id,
          state: 'CONFIRMED',
          slotId: slot.id,
          correlationId: input.correlationId,
        };
        await client.query(`
          INSERT INTO booking_schema.appointment_events (appointment_id, hold_id, event_type, actor_type, actor_id, correlation_id, payload_json)
          VALUES ($1, $2, 'CONFIRMED', 'CLINIC_RECEPTIONIST', $3, $4, $5::jsonb)
        `, [appointment.rows[0].id, hold.id, input.clinicLocationId, input.correlationId, JSON.stringify({ slotId: slot.id })]);
        await this.writeOutbox(client, {
          eventType: 'booking.confirmed.v1', correlationId: input.correlationId, aggregateType: 'booking_hold', aggregateId: hold.id,
          aggregateVersion: updatedHold.rows[0].version, payload: { ...result, clinicLocationId: input.clinicLocationId },
        });
        await this.writeAudit(client, 'CLINIC_RECEPTIONIST', input.clinicLocationId, 'booking.confirmed', 'booking_hold', hold.id, input.correlationId, { appointmentId: result.appointmentId });
        await this.completeIdempotency(client, 'booking.confirm-manual-hold', input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
      if ('kind' in outcome) throw DomainErrors.holdExpired();
      return outcome;
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async releaseHold(input: { holdId: string; ownerId: string; idempotencyKey: string; correlationId: string }): Promise<ReleaseHoldResult> {
    try {
      const outcome = await this.database.withTransaction(async (client): Promise<ReleaseHoldResult | { kind: 'EXPIRED' }> => {
        await this.setInteractiveTransactionLimits(client);
        const existing = await this.acquireIdempotency(client, 'booking.release-hold', input.idempotencyKey);
        if (existing) return existing as unknown as ReleaseHoldResult;

        const holdForSlot = await client.query<{ slot_id: string }>('SELECT slot_id FROM booking_schema.booking_holds WHERE id = $1', [input.holdId]);
        if (!holdForSlot.rows[0]) throw DomainErrors.holdNotFound();
        const slot = await this.repository.lockSlot(client, holdForSlot.rows[0].slot_id);
        if (!slot) throw DomainErrors.slotNotFound();
        const hold = await this.repository.lockHold(client, input.holdId);
        if (!hold) throw DomainErrors.holdNotFound();
        if (hold.owner_id !== input.ownerId) throw DomainErrors.holdOwnerMismatch();

        const now = await this.repository.now(client);
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.expireLockedHold(client, hold, slot, input.correlationId, 'OWNER', 'owner-release-detected-expiry');
          await this.completeIdempotencyError(client, 'booking.release-hold', input.idempotencyKey, DomainErrors.holdExpired());
          return { kind: 'EXPIRED' };
        }
        if (!canTransition(hold.state, 'RELEASED')) throw DomainErrors.invalidTransition();

        const updated = await client.query<HoldRow>(`
          UPDATE booking_schema.booking_holds
          SET state = 'RELEASED', state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
          WHERE id = $1
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [hold.id]);
        await client.query(`
          UPDATE clinic_schema.appointment_slots
          SET held_count = held_count - 1, version = version + 1, updated_at = clock_timestamp()
          WHERE id = $1
        `, [slot.id]);
        const result: ReleaseHoldResult = { holdId: hold.id, state: 'RELEASED', slotId: slot.id, correlationId: input.correlationId };
        await this.writeOutbox(client, {
          eventType: 'booking.hold.released.v1', correlationId: input.correlationId, aggregateType: 'booking_hold', aggregateId: hold.id,
          aggregateVersion: updated.rows[0].version, payload: { ...result, reason: 'OWNER_CANCELLED' },
        });
        await this.writeAudit(client, 'OWNER', input.ownerId, 'booking.hold.released', 'booking_hold', hold.id, input.correlationId, { slotId: slot.id });
        await this.completeIdempotency(client, 'booking.release-hold', input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
      if ('kind' in outcome) throw DomainErrors.holdExpired();
      return outcome;
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async findHold(holdId: string): Promise<Record<string, unknown>> {
    const result = await this.database.query(`
      SELECT h.id, h.slot_id, h.owner_id, h.pet_id, h.state, h.expires_at, h.version,
             s.clinic_location_id, s.starts_at, s.ends_at
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      WHERE h.id = $1
    `, [holdId]);
    if (!result.rows[0]) throw DomainErrors.holdNotFound();
    return result.rows[0];
  }

  async listSlots(clinicLocationId: string, from?: string, to?: string): Promise<Record<string, unknown>[]> {
    const result = await this.database.query(`
      SELECT s.id, s.clinic_location_id, s.service_id, s.starts_at, s.ends_at, s.capacity, s.booked_count, s.held_count, s.state, s.version,
             (s.capacity - s.booked_count - s.held_count) AS remaining_capacity
      FROM clinic_schema.appointment_slots s
      WHERE s.clinic_location_id = $1
        AND s.state = 'OPEN'
        AND s.starts_at > clock_timestamp()
        AND ($2::timestamptz IS NULL OR s.starts_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR s.starts_at < $3::timestamptz)
      ORDER BY s.starts_at
    `, [clinicLocationId, from ?? null, to ?? null]);
    return result.rows;
  }

  async expireHolds(batchSize = 100): Promise<{ expired: number }> {
    const expired = await this.database.withTransaction(async (client) => {
      const candidateSlots = await client.query<{ id: string }>(`
        SELECT s.id
        FROM clinic_schema.appointment_slots s
        WHERE EXISTS (
          SELECT 1 FROM booking_schema.booking_holds h
          WHERE h.slot_id = s.id
            AND h.state = 'MANUAL_CONFIRM_PENDING'
            AND h.expires_at <= clock_timestamp()
        )
        ORDER BY s.id
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      `, [batchSize]);

      let count = 0;
      for (const candidate of candidateSlots.rows) {
        const slot = await this.repository.lockSlot(client, candidate.id);
        if (!slot) continue;
        const rows = await client.query<HoldRow>(`
          SELECT id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
          FROM booking_schema.booking_holds
          WHERE slot_id = $1 AND state = 'MANUAL_CONFIRM_PENDING' AND expires_at <= clock_timestamp()
          FOR UPDATE
        `, [slot.id]);
        for (const hold of rows.rows) {
          await this.expireLockedHold(client, hold, slot, null, 'WORKER', 'ttl-expired');
          count += 1;
        }
      }
      return count;
    });
    return { expired };
  }

  private async expireLockedHold(client: PoolClient, hold: HoldRow, slot: SlotRow, correlationId: string | null, actorType: string, reason: string): Promise<void> {
    if (hold.state !== 'MANUAL_CONFIRM_PENDING') return;
    const updated = await client.query<HoldRow>(`
      UPDATE booking_schema.booking_holds
      SET state = 'EXPIRED', state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1
      RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
    `, [hold.id]);
    await client.query(`
      UPDATE clinic_schema.appointment_slots
      SET held_count = held_count - 1, version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1
    `, [slot.id]);
    await this.writeOutbox(client, {
      eventType: 'booking.hold.expired.v1', correlationId, aggregateType: 'booking_hold', aggregateId: hold.id,
      aggregateVersion: updated.rows[0].version, payload: { holdId: hold.id, slotId: slot.id, reason },
    });
    await this.writeAudit(client, actorType, null, 'booking.hold.expired', 'booking_hold', hold.id, correlationId, { slotId: slot.id, reason });
  }

  private async setInteractiveTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private async acquireIdempotency(client: PoolClient, scope: string, idempotencyKey: string): Promise<Record<string, unknown> | undefined> {
    const inserted = await client.query<IdempotencyRow>(`
      INSERT INTO booking_schema.idempotency_records (scope, idempotency_key, status)
      VALUES ($1, $2::uuid, 'PROCESSING')
      ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING id, status, response_status, response_body
    `, [scope, idempotencyKey]);
    if (inserted.rows[0]) return undefined;

    const existing = await client.query<IdempotencyRow>(`
      SELECT id, status, response_status, response_body
      FROM booking_schema.idempotency_records
      WHERE scope = $1 AND idempotency_key = $2::uuid
      FOR UPDATE
    `, [scope, idempotencyKey]);
    if (!existing.rows[0]) throw DomainErrors.bookingUnavailable();
    if (existing.rows[0].status !== 'COMPLETED' || !existing.rows[0].response_body) throw DomainErrors.idempotencyInProgress();
    if ((existing.rows[0].response_status ?? 200) >= 400) {
      const body = existing.rows[0].response_body as { code?: string; message?: string };
      throw new DomainException(existing.rows[0].response_status ?? HttpStatus.CONFLICT, body.code ?? 'IDEMPOTENT_REQUEST_FAILED', body.message ?? 'Previous request failed');
    }
    return existing.rows[0].response_body;
  }

  private async completeIdempotency(client: PoolClient, scope: string, idempotencyKey: string, response: unknown, status: number): Promise<void> {
    await client.query(`
      UPDATE booking_schema.idempotency_records
      SET status = 'COMPLETED', response_status = $3, response_body = $4::jsonb, updated_at = clock_timestamp()
      WHERE scope = $1 AND idempotency_key = $2::uuid
    `, [scope, idempotencyKey, status, JSON.stringify(response)]);
  }

  private async completeIdempotencyError(client: PoolClient, scope: string, idempotencyKey: string, error: DomainException): Promise<void> {
    const response = error.getResponse();
    await this.completeIdempotency(client, scope, idempotencyKey, response, error.getStatus());
  }

  private assertClinicScope(slot: SlotRow, clinicLocationId: string): void {
    if (slot.clinic_location_id !== clinicLocationId) throw DomainErrors.clinicScopeMismatch();
  }

  private async writeOutbox(client: PoolClient, event: { eventType: string; correlationId: string | null; aggregateType: string; aggregateId: string; aggregateVersion: number; payload: Record<string, unknown> }): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key
      ) VALUES ($1, $2::uuid, $3, $4::uuid, $5, $6::jsonb, $7)
    `, [event.eventType, event.correlationId, event.aggregateType, event.aggregateId, event.aggregateVersion, JSON.stringify(event.payload), `${event.eventType}:${event.aggregateId}:${event.aggregateVersion}`]);
  }

  private async writeAudit(client: PoolClient, actorType: string, actorId: string | null, action: string, aggregateType: string, aggregateId: string, correlationId: string | null, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json)
      VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid, $7::jsonb)
    `, [actorType, actorId, action, aggregateType, aggregateId, correlationId, JSON.stringify(payload)]);
  }

  private mapPgError(error: unknown): unknown {
    if (error instanceof DomainException) return error;
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const pgCode = String((error as { code?: unknown }).code);
      if (pgCode === '55P03' || pgCode === '57014') return DomainErrors.slotLockedRetry();
      if (pgCode === '23505') return DomainErrors.slotAlreadyTaken();
    }
    this.logger.error('Unexpected booking error', error instanceof Error ? error.stack : undefined);
    return DomainErrors.bookingUnavailable();
  }
}
