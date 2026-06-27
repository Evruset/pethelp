import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors, DomainException } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { canTransition } from './booking-state-machine';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ConfirmHoldResult, HoldRow, ReleaseHoldResult, RequestNotesResult, SlotRow } from './booking.types';

interface LockedHoldAndSlot {
  hold_id: string;
  hold_owner_id: string;
  hold_pet_id: string;
  hold_state: HoldRow['state'];
  hold_expires_at: Date;
  hold_confirmation_sla_expires_at: Date | null;
  hold_state_changed_at: Date;
  hold_version: number;
  hold_created_at: Date;
  slot_id: string;
  clinic_location_id: string;
  slot_starts_at: Date;
  slot_ends_at: Date;
  slot_capacity: number;
  slot_booked_count: number;
  slot_held_count: number;
  slot_state: SlotRow['state'];
  slot_version: number;
}

interface ReleaseHoldRow {
  id: string;
  slot_id: string;
  owner_id: string;
  state: HoldRow['state'];
  expires_at: Date;
  alternative_slot_id: string | null;
  alternative_expires_at: Date | null;
  version: number;
}

interface IdempotencyRow {
  status: 'PROCESSING' | 'COMPLETED';
  response_status: number | null;
  response_body: Record<string, unknown> | null;
}

@Injectable()
export class BookingSecurityService {
  private readonly logger = new Logger(BookingSecurityService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async confirmManualHold(input: { holdId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion: number }): Promise<ConfirmHoldResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);
        const locked = await this.lockHoldAndSlot(client, input.holdId);
        if (!locked) throw DomainErrors.holdNotFound();

        await this.clinicAccess.assertLocationAccess(client, input.employee, locked.clinic_location_id);
        const scope = `booking.confirm-manual-hold:${input.employee.sub}`;
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
        if (replay) return replay as unknown as ConfirmHoldResult;

        const hold = this.toHold(locked);
        const slot = this.toSlot(locked);
        if (hold.version !== input.expectedVersion) throw DomainErrors.slotVersionStale();
        const now = await this.dbNow(client);
        if (hold.confirmation_sla_expires_at && hold.confirmation_sla_expires_at <= now) {
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.expireLockedHold(client, hold, slot, input.correlationId, 'manual-confirm-detected-expiry');
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING') {
          const earlierHoldId = await this.findEarlierActionableQueueHold(client, hold, slot.clinic_location_id, now);
          if (earlierHoldId) {
            const error = DomainErrors.queueFifoViolation();
            await this.completeIdempotency(client, scope, input.idempotencyKey, error.getResponse(), error.getStatus());
            throw error;
          }
        }
        if (!canTransition(hold.state, 'CONFIRMED')) throw DomainErrors.invalidTransition();

        const updatedHold = await client.query<HoldRow>(`
          UPDATE booking_schema.booking_holds
          SET state = 'CONFIRMED',
              confirmation_sla_expires_at = NULL,
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [hold.id]);
        await client.query(`
          UPDATE clinic_schema.appointment_slots
          SET held_count = held_count - 1,
              booked_count = booked_count + 1,
              status = CASE
                WHEN booked_count + 1 >= capacity THEN 'BOOKED'
                WHEN held_count - 1 > 0 THEN 'LOCKED_BY_HOLD'
                ELSE 'AVAILABLE'
              END,
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
            AND held_count > 0
            AND booked_count < capacity
        `, [slot.id]);
        const appointment = await client.query<{ id: string }>(`
          INSERT INTO booking_schema.appointments (hold_id, owner_id, pet_id, clinic_location_id, slot_id)
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)
          RETURNING id
        `, [hold.id, hold.owner_id, hold.pet_id, slot.clinic_location_id, slot.id]);
        const result: ConfirmHoldResult = { holdId: hold.id, appointmentId: appointment.rows[0].id, state: 'CONFIRMED', slotId: slot.id, correlationId: input.correlationId };

        await client.query(`
          INSERT INTO booking_schema.appointment_events (appointment_id, hold_id, event_type, actor_type, actor_id, correlation_id, payload_json)
          VALUES ($1::uuid, $2::uuid, 'CONFIRMED', 'CLINIC_EMPLOYEE', $3::uuid, $4::uuid, $5::jsonb)
        `, [result.appointmentId, hold.id, input.employee.sub, input.correlationId, JSON.stringify({ slotId: slot.id, clinicLocationId: slot.clinic_location_id })]);
        await this.writeOutbox(client, 'booking.confirmed.v1', input.correlationId, hold.id, updatedHold.rows[0].version, { ...result, employeeId: input.employee.sub, clinicLocationId: slot.clinic_location_id });
        await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'booking.confirmed', hold.id, input.correlationId, { appointmentId: result.appointmentId, clinicLocationId: slot.clinic_location_id });
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async declineManualHold(input: { holdId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion: number; declineReason?: string }): Promise<ReleaseHoldResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);
        const locked = await this.lockHoldAndSlot(client, input.holdId);
        if (!locked) throw DomainErrors.holdNotFound();

        await this.clinicAccess.assertLocationAccess(client, input.employee, locked.clinic_location_id);
        const scope = `booking.decline-manual-hold:${input.employee.sub}`;
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
        if (replay) return replay as unknown as ReleaseHoldResult;

        const hold = this.toHold(locked);
        const slot = this.toSlot(locked);
        if (hold.version !== input.expectedVersion) throw DomainErrors.slotVersionStale();
        const now = await this.dbNow(client);
        if (hold.confirmation_sla_expires_at && hold.confirmation_sla_expires_at <= now) {
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.expireLockedHold(client, hold, slot, input.correlationId, 'manual-decline-detected-expiry');
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING') {
          const earlierHoldId = await this.findEarlierActionableQueueHold(client, hold, slot.clinic_location_id, now);
          if (earlierHoldId) {
            const error = DomainErrors.queueFifoViolation();
            await this.completeIdempotency(client, scope, input.idempotencyKey, error.getResponse(), error.getStatus());
            throw error;
          }
        }
        if (!canTransition(hold.state, 'RELEASED')) throw DomainErrors.invalidTransition();

        await this.releaseSlotCounter(client, slot.id);
        const updated = await client.query<HoldRow>(`
          UPDATE booking_schema.booking_holds
          SET state = 'RELEASED',
              confirmation_sla_expires_at = NULL,
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [hold.id]);
        const reason = input.declineReason?.trim() || 'CLINIC_DECLINED';
        const result: ReleaseHoldResult = { holdId: hold.id, state: 'RELEASED', slotId: slot.id, correlationId: input.correlationId };

        await this.writeOutbox(client, 'booking.hold.released.v1', input.correlationId, hold.id, updated.rows[0].version, {
          ...result,
          reason: 'CLINIC_DECLINED',
          declineReason: reason,
          employeeId: input.employee.sub,
          clinicLocationId: slot.clinic_location_id,
        });
        await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'booking.declined', hold.id, input.correlationId, {
          slotId: slot.id,
          clinicLocationId: slot.clinic_location_id,
          reason,
        });
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async requestOwnerNotes(input: { holdId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion: number; noteRequest: string }): Promise<RequestNotesResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);
        const locked = await this.lockHoldAndSlot(client, input.holdId);
        if (!locked) throw DomainErrors.holdNotFound();

        await this.clinicAccess.assertLocationAccess(client, input.employee, locked.clinic_location_id);
        const scope = `booking.request-owner-notes:${input.employee.sub}`;
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
        if (replay) return replay as unknown as RequestNotesResult;

        const hold = this.toHold(locked);
        const slot = this.toSlot(locked);
        if (hold.version !== input.expectedVersion) throw DomainErrors.slotVersionStale();
        const now = await this.dbNow(client);
        if (hold.confirmation_sla_expires_at && hold.confirmation_sla_expires_at <= now) {
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.expireLockedHold(client, hold, slot, input.correlationId, 'request-notes-detected-expiry');
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING') {
          const earlierHoldId = await this.findEarlierActionableQueueHold(client, hold, slot.clinic_location_id, now);
          if (earlierHoldId) {
            const error = DomainErrors.queueFifoViolation();
            await this.completeIdempotency(client, scope, input.idempotencyKey, error.getResponse(), error.getStatus());
            throw error;
          }
        }
        if (hold.state !== 'MANUAL_CONFIRM_PENDING') throw DomainErrors.invalidTransition();

        const noteRequest = input.noteRequest.trim();
        const updated = await client.query<{ version: number }>(`
          UPDATE booking_schema.booking_holds
          SET version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING version
        `, [hold.id]);
        const result: RequestNotesResult = {
          holdId: hold.id,
          state: 'MANUAL_CONFIRM_PENDING',
          slotId: slot.id,
          version: updated.rows[0].version,
          requestedNote: noteRequest,
          correlationId: input.correlationId,
        };

        await this.writeOutbox(client, 'booking.notes.requested.v1', input.correlationId, hold.id, updated.rows[0].version, {
          ...result,
          employeeId: input.employee.sub,
          ownerId: hold.owner_id,
          petId: hold.pet_id,
          clinicLocationId: slot.clinic_location_id,
        });
        await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'booking.notes.requested', hold.id, input.correlationId, {
          slotId: slot.id,
          clinicLocationId: slot.clinic_location_id,
          noteRequest,
        });
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async releaseHold(input: { holdId: string; actor: JwtPayload; idempotencyKey: string; correlationId: string }): Promise<ReleaseHoldResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);
        const hold = await this.lockReleaseHold(client, input.holdId);
        if (!hold) throw DomainErrors.holdNotFound();

        const systemWorker = input.actor.roles.includes(Role.SYSTEM_WORKER);
        if (!systemWorker && hold.owner_id !== input.actor.sub) throw DomainErrors.holdOwnerMismatch();
        const scope = `booking.release-hold:${input.actor.sub}`;
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
        if (replay) return replay as unknown as ReleaseHoldResult;

        const slotIds = [...new Set([hold.slot_id, hold.alternative_slot_id].filter(Boolean) as string[])].sort();
        const slots = await client.query<{ id: string; held_count: number; booked_count: number; capacity: number }>(`
          SELECT id, held_count, booked_count, capacity
          FROM clinic_schema.appointment_slots
          WHERE id = ANY($1::uuid[])
          ORDER BY id
          FOR UPDATE
        `, [slotIds]);
        if (slots.rows.length !== slotIds.length) throw DomainErrors.slotNotFound();

        const now = await this.dbNow(client);
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.releaseSlotCounter(client, hold.slot_id);
          await this.markHoldExpired(client, hold, input.correlationId, 'release-detected-expiry');
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (!canTransition(hold.state, 'RELEASED')) throw DomainErrors.invalidTransition();

        await this.releaseSlotCounter(client, hold.slot_id);
        if (hold.alternative_slot_id) await this.releaseSlotCounter(client, hold.alternative_slot_id);
        const declinedSwapGroupId = hold.alternative_slot_id ? await this.finalizePendingAlternativeSwapGroup(client, hold.id, 'DECLINED') : null;

        const updated = await client.query<HoldRow>(`
          UPDATE booking_schema.booking_holds
          SET state = 'RELEASED',
              alternative_slot_id = NULL,
              alternative_expires_at = NULL,
              confirmation_sla_expires_at = NULL,
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [hold.id]);
        const result: ReleaseHoldResult = { holdId: hold.id, state: 'RELEASED', slotId: hold.slot_id, correlationId: input.correlationId, swapGroupId: declinedSwapGroupId };
        await this.writeOutbox(client, 'booking.hold.released.v1', input.correlationId, hold.id, updated.rows[0].version, { ...result, swapGroupId: declinedSwapGroupId, reason: systemWorker ? 'SYSTEM_RELEASE' : 'OWNER_CANCELLED', actorId: input.actor.sub });
        await this.writeAudit(client, systemWorker ? 'SYSTEM_WORKER' : 'OWNER', input.actor.sub, 'booking.hold.released', hold.id, input.correlationId, { swapGroupId: declinedSwapGroupId, slotId: hold.slot_id, alternativeSlotId: hold.alternative_slot_id, reason: systemWorker ? 'SYSTEM_RELEASE' : 'OWNER_CANCELLED' });
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  private async lockHoldAndSlot(client: PoolClient, holdId: string): Promise<LockedHoldAndSlot | undefined> {
    const result = await client.query<LockedHoldAndSlot>(`
      SELECT h.id AS hold_id, h.owner_id AS hold_owner_id, h.pet_id AS hold_pet_id, h.state AS hold_state,
             h.expires_at AS hold_expires_at, h.confirmation_sla_expires_at AS hold_confirmation_sla_expires_at,
             h.state_changed_at AS hold_state_changed_at, h.version AS hold_version, h.created_at AS hold_created_at,
             s.id AS slot_id, s.clinic_location_id, s.starts_at AS slot_starts_at, s.ends_at AS slot_ends_at,
             s.capacity AS slot_capacity, s.booked_count AS slot_booked_count, s.held_count AS slot_held_count,
             s.state AS slot_state, s.version AS slot_version
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      WHERE h.id = $1::uuid
      FOR UPDATE OF h, s
    `, [holdId]);
    return result.rows[0];
  }

  private async lockReleaseHold(client: PoolClient, holdId: string): Promise<ReleaseHoldRow | undefined> {
    const result = await client.query<ReleaseHoldRow>(`
      SELECT id, slot_id, owner_id, state, expires_at, alternative_slot_id, alternative_expires_at, version
      FROM booking_schema.booking_holds
      WHERE id = $1::uuid
      FOR UPDATE
    `, [holdId]);
    return result.rows[0];
  }

  private async findEarlierActionableQueueHold(
    client: PoolClient,
    hold: HoldRow,
    clinicLocationId: string,
    now: Date,
  ): Promise<string | undefined> {
    const result = await client.query<{ id: string }>(`
      SELECT h.id
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      WHERE s.clinic_location_id = $1::uuid
        AND h.state = 'MANUAL_CONFIRM_PENDING'
        AND h.confirmation_sla_expires_at > $2::timestamptz
        AND h.expires_at > $2::timestamptz
        AND (
          h.state_changed_at < $3::timestamptz
          OR (h.state_changed_at = $3::timestamptz AND h.id < $4::uuid)
        )
      ORDER BY h.state_changed_at ASC, h.id ASC
      LIMIT 1
    `, [clinicLocationId, now.toISOString(), hold.state_changed_at.toISOString(), hold.id]);
    return result.rows[0]?.id;
  }

  private toHold(row: LockedHoldAndSlot): HoldRow {
    return {
      id: row.hold_id,
      slot_id: row.slot_id,
      owner_id: row.hold_owner_id,
      pet_id: row.hold_pet_id,
      state: row.hold_state,
      expires_at: row.hold_expires_at,
      confirmation_sla_expires_at: row.hold_confirmation_sla_expires_at,
      state_changed_at: row.hold_state_changed_at,
      version: row.hold_version,
      created_at: row.hold_created_at,
    };
  }

  private toSlot(row: LockedHoldAndSlot): SlotRow {
    return { id: row.slot_id, clinic_location_id: row.clinic_location_id, starts_at: row.slot_starts_at, ends_at: row.slot_ends_at, capacity: row.slot_capacity, booked_count: row.slot_booked_count, held_count: row.slot_held_count, state: row.slot_state, version: row.slot_version };
  }

  private async releaseSlotCounter(client: PoolClient, slotId: string): Promise<void> {
    const released = await client.query<{ id: string }>(`
      UPDATE clinic_schema.appointment_slots
      SET held_count = held_count - 1,
          status = CASE
            WHEN booked_count >= capacity THEN 'BOOKED'
            WHEN held_count - 1 > 0 THEN 'LOCKED_BY_HOLD'
            ELSE 'AVAILABLE'
          END,
          version = version + 1,
          updated_at = clock_timestamp()
      WHERE id = $1::uuid AND held_count > 0
      RETURNING id
    `, [slotId]);
    if (!released.rows[0]) throw DomainErrors.bookingUnavailable();
  }

  private async markHoldExpired(client: PoolClient, hold: ReleaseHoldRow, correlationId: string, reason: string): Promise<void> {
    const expiredSwapGroupId = hold.alternative_slot_id ? await this.finalizePendingAlternativeSwapGroup(client, hold.id, 'EXPIRED') : null;
    const updated = await client.query<{ version: number }>(`
      UPDATE booking_schema.booking_holds
      SET state = 'EXPIRED', state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1::uuid
      RETURNING version
    `, [hold.id]);
    await this.writeOutbox(client, 'booking.hold.expired.v1', correlationId, hold.id, updated.rows[0].version, { holdId: hold.id, slotId: hold.slot_id, swapGroupId: expiredSwapGroupId, reason });
    await this.writeAudit(client, 'SYSTEM', null, 'booking.hold.expired', hold.id, correlationId, { slotId: hold.slot_id, swapGroupId: expiredSwapGroupId, reason });
  }

  private async finalizePendingAlternativeSwapGroup(client: PoolClient, holdId: string, state: 'DECLINED' | 'EXPIRED'): Promise<string | null> {
    const updated = await client.query<{ id: string }>(`
      UPDATE booking_schema.alternative_swap_groups
      SET state = $2,
          aggregate_version = aggregate_version + 1,
          updated_at = clock_timestamp()
      WHERE original_hold_id = $1::uuid
        AND state = 'PENDING'
      RETURNING id
    `, [holdId, state]);
    return updated.rows[0]?.id ?? null;
  }

  private async expireLockedHold(client: PoolClient, hold: HoldRow, slot: SlotRow, correlationId: string, reason: string): Promise<void> {
    await this.releaseSlotCounter(client, slot.id);
    await this.markHoldExpired(client, { id: hold.id, slot_id: hold.slot_id, owner_id: hold.owner_id, state: hold.state, expires_at: hold.expires_at, alternative_slot_id: null, alternative_expires_at: null, version: hold.version }, correlationId, reason);
  }

  private async dbNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }

  private async setInteractiveTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private async acquireIdempotency(client: PoolClient, scope: string, key: string): Promise<Record<string, unknown> | undefined> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records (scope, idempotency_key, status)
      VALUES ($1, $2::uuid, 'PROCESSING') ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING id
    `, [scope, key]);
    if (inserted.rows[0]) return undefined;
    const existing = await client.query<IdempotencyRow>(`
      SELECT status, response_status, response_body FROM booking_schema.idempotency_records
      WHERE scope = $1 AND idempotency_key = $2::uuid FOR UPDATE
    `, [scope, key]);
    if (!existing.rows[0]) throw DomainErrors.bookingUnavailable();
    if (existing.rows[0].status !== 'COMPLETED' || !existing.rows[0].response_body) throw DomainErrors.idempotencyInProgress();
    if ((existing.rows[0].response_status ?? 200) >= 400) {
      const body = existing.rows[0].response_body as { code?: string; message?: string };
      throw new DomainException(existing.rows[0].response_status ?? 409, body.code ?? 'IDEMPOTENT_REQUEST_FAILED', body.message ?? 'Previous request failed');
    }
    return existing.rows[0].response_body;
  }

  private async completeIdempotency(client: PoolClient, scope: string, key: string, body: unknown, status: number): Promise<void> {
    await client.query(`
      UPDATE booking_schema.idempotency_records
      SET status = 'COMPLETED', response_status = $3, response_body = $4::jsonb, updated_at = clock_timestamp()
      WHERE scope = $1 AND idempotency_key = $2::uuid
    `, [scope, key, status, JSON.stringify(body)]);
  }

  private async writeOutbox(client: PoolClient, eventType: string, correlationId: string, aggregateId: string, aggregateVersion: number, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events (event_type, correlation_id, aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key)
      VALUES ($1, $2::uuid, 'booking_hold', $3::uuid, $4, $5::jsonb, $6)
    `, [eventType, correlationId, aggregateId, aggregateVersion, JSON.stringify(payload), `${eventType}:${aggregateId}:${aggregateVersion}`]);
  }

  private async writeAudit(client: PoolClient, actorType: string, actorId: string | null, action: string, holdId: string, correlationId: string, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json)
      VALUES ($1, $2, $3, 'booking_hold', $4::uuid, $5::uuid, $6::jsonb)
    `, [actorType, actorId, action, holdId, correlationId, JSON.stringify(payload)]);
  }

  private mapPgError(error: unknown): unknown {
    if (error instanceof DomainException) return error;
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const pgCode = String((error as { code?: unknown }).code);
      if (pgCode === '55P03' || pgCode === '57014') return DomainErrors.slotLockedRetry();
      if (pgCode === '23505') return DomainErrors.slotAlreadyTaken();
    }
    this.logger.error('Unexpected booking security error', error instanceof Error ? error.stack : undefined);
    return DomainErrors.bookingUnavailable();
  }
}
