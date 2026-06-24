import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { TraceContext } from '../observability/trace-context.context';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

interface AlternativeHold {
  id: string;
  slot_id: string;
  owner_id: string;
  pet_id: string;
  state: 'MANUAL_CONFIRM_PENDING' | 'ALTERNATIVE_PENDING' | 'MIS_HELD' | 'CONFIRMED' | 'EXPIRED' | 'RELEASED' | 'SLA_BREACHED';
  expires_at: Date;
  alternative_slot_id: string | null;
  alternative_expires_at: Date | null;
  version: number;
}

interface LockedSlot {
  id: string;
  clinic_location_id: string;
  starts_at: Date;
  capacity: number;
  booked_count: number;
  held_count: number;
  state: 'OPEN' | 'CLOSED' | 'CANCELLED';
  status: 'AVAILABLE' | 'LOCKED_BY_HOLD' | 'BOOKED';
  integration_mode: 'LEVEL_A' | 'LEVEL_B' | 'LEVEL_C';
}

interface IdempotencyRow {
  status: 'PROCESSING' | 'COMPLETED';
  response_body: Record<string, unknown> | null;
}

export interface AlternativeCommandContext {
  idempotencyKey?: string;
  correlationId?: string;
  expectedVersion?: number;
}

export interface ProposedAlternativeSlot {
  holdId: string;
  sourceSlotId: string;
  alternativeSlotId: string;
  expiresAt: string;
  state: 'ALTERNATIVE_PENDING';
}

export interface AcceptedAlternativeSlot {
  holdId: string;
  sourceSlotId: string;
  slotId: string;
  state: 'MIS_HELD' | 'CONFIRMED';
  appointmentId?: string;
}

export interface DeclinedAlternativeSlot {
  holdId: string;
  sourceSlotId: string;
  alternativeSlotId: string;
  state: 'RELEASED';
}

@Injectable()
export class AlternativeSlotService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: ClinicEmployeeAccessService,
    private readonly traceContext: TraceContext,
  ) {}

  async proposeAlternativeSlot(
    holdId: string,
    newSlotId: string,
    employeeContext: JwtPayload,
    command: AlternativeCommandContext = {},
  ): Promise<ProposedAlternativeSlot> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setShortTransactionLimits(client);
        const hold = await this.lockHold(client, holdId);
        if (!hold) throw DomainErrors.holdNotFound();
        if (hold.state !== 'MANUAL_CONFIRM_PENDING' && hold.state !== 'ALTERNATIVE_PENDING') throw DomainErrors.invalidTransition();
        if (hold.slot_id === newSlotId) throw DomainErrors.slotAlreadyTaken();

        const slots = await this.lockSlots(client, [hold.slot_id, newSlotId, hold.alternative_slot_id].filter(Boolean) as string[]);
        const sourceSlot = slots.get(hold.slot_id);
        const newSlot = slots.get(newSlotId);
        if (!sourceSlot || !newSlot) throw DomainErrors.slotNotFound();
        await this.access.assertLocationAccess(client, employeeContext, sourceSlot.clinic_location_id);
        if (sourceSlot.clinic_location_id !== newSlot.clinic_location_id || sourceSlot.integration_mode !== newSlot.integration_mode) {
          throw DomainErrors.clinicScopeMismatch();
        }

        const scope = `booking.propose-alternative:${employeeContext.sub}`;
        const replay = command.idempotencyKey ? await this.acquireIdempotency(client, scope, command.idempotencyKey) : null;
        if (replay) return replay as unknown as ProposedAlternativeSlot;

        const now = await this.databaseNow(client);
        if (hold.state === 'ALTERNATIVE_PENDING' && hold.alternative_expires_at && hold.alternative_expires_at <= now) {
          await this.expireAlternativeLocked(client, hold, this.correlationId(command), 'proposal-detected-expiry');
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'ALTERNATIVE_PENDING' && hold.alternative_slot_id === newSlotId && hold.alternative_expires_at) {
          const result: ProposedAlternativeSlot = {
            holdId: hold.id,
            sourceSlotId: hold.slot_id,
            alternativeSlotId: newSlotId,
            expiresAt: hold.alternative_expires_at.toISOString(),
            state: 'ALTERNATIVE_PENDING',
          };
          await this.completeIdempotency(client, scope, command.idempotencyKey, result, HttpStatus.CREATED);
          return result;
        }
        if (newSlot.state !== 'OPEN' || newSlot.status === 'BOOKED' || newSlot.starts_at <= now || newSlot.capacity - newSlot.booked_count - newSlot.held_count <= 0) {
          throw DomainErrors.slotAlreadyTaken();
        }

        if (hold.alternative_slot_id) await this.releaseSlotCounter(client, hold.alternative_slot_id);
        await client.query(`
          UPDATE clinic_schema.appointment_slots
          SET held_count = held_count + 1, status = 'LOCKED_BY_HOLD', version = version + 1, updated_at = clock_timestamp()
          WHERE id = $1::uuid
        `, [newSlotId]);
        const updated = await client.query<{ version: number; alternative_expires_at: Date }>(`
          UPDATE booking_schema.booking_holds
          SET state = 'ALTERNATIVE_PENDING', alternative_slot_id = $2::uuid,
              alternative_expires_at = clock_timestamp() + interval '15 minutes',
              expires_at = clock_timestamp() + interval '15 minutes',
              confirmation_sla_expires_at = NULL, state_changed_at = clock_timestamp(),
              version = version + 1, updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING version, alternative_expires_at
        `, [hold.id, newSlotId]);

        const correlationId = this.correlationId(command);
        const result: ProposedAlternativeSlot = {
          holdId: hold.id,
          sourceSlotId: hold.slot_id,
          alternativeSlotId: newSlotId,
          expiresAt: updated.rows[0].alternative_expires_at.toISOString(),
          state: 'ALTERNATIVE_PENDING',
        };
        await this.writeOutbox(client, 'booking.alternative.proposed.v1', correlationId, hold.id, updated.rows[0].version, {
          ...result,
          employeeId: employeeContext.sub,
          clinicLocationId: sourceSlot.clinic_location_id,
        });
        await this.writeAudit(client, 'CLINIC_EMPLOYEE', employeeContext.sub, 'BOOKING_ALTERNATIVE_PROPOSED', hold.id, correlationId, {
          sourceSlotId: hold.slot_id,
          alternativeSlotId: newSlotId,
        });
        await this.completeIdempotency(client, scope, command.idempotencyKey, result, HttpStatus.CREATED);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async acceptAlternativeSlot(
    holdId: string,
    ownerId: string,
    command: AlternativeCommandContext = {},
  ): Promise<AcceptedAlternativeSlot> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setShortTransactionLimits(client);
        const hold = await this.lockHold(client, holdId);
        if (!hold) throw DomainErrors.holdNotFound();
        if (hold.owner_id !== ownerId) throw DomainErrors.holdOwnerMismatch();

        const scope = `booking.accept-alternative:${ownerId}`;
        const replay = command.idempotencyKey ? await this.acquireIdempotency(client, scope, command.idempotencyKey) : null;
        if (replay) return replay as unknown as AcceptedAlternativeSlot;
        if (command.expectedVersion !== undefined && hold.version !== command.expectedVersion) throw DomainErrors.slotVersionStale();
        if (hold.state !== 'ALTERNATIVE_PENDING' || !hold.alternative_slot_id || !hold.alternative_expires_at) throw DomainErrors.invalidTransition();

        const slots = await this.lockSlots(client, [hold.slot_id, hold.alternative_slot_id]);
        const sourceSlot = slots.get(hold.slot_id);
        const alternativeSlot = slots.get(hold.alternative_slot_id);
        if (!sourceSlot || !alternativeSlot) throw DomainErrors.slotNotFound();
        if (sourceSlot.integration_mode !== alternativeSlot.integration_mode) throw DomainErrors.invalidTransition();
        if (hold.alternative_expires_at <= await this.databaseNow(client)) {
          await this.expireAlternativeLocked(client, hold, this.correlationId(command), 'owner-accept-detected-expiry');
          throw DomainErrors.holdExpired();
        }
        if (sourceSlot.held_count <= 0 || alternativeSlot.held_count <= 0) throw DomainErrors.bookingUnavailable();

        const correlationId = this.correlationId(command);
        await this.releaseSlotCounter(client, sourceSlot.id);
        const result = alternativeSlot.integration_mode === 'LEVEL_C'
          ? await this.confirmLevelCAlternative(client, hold, sourceSlot, alternativeSlot, ownerId, correlationId)
          : await this.moveToMisHeld(client, hold, sourceSlot, alternativeSlot, correlationId);
        await this.completeIdempotency(client, scope, command.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async declineAlternativeSlot(
    holdId: string,
    ownerId: string,
    command: AlternativeCommandContext = {},
  ): Promise<DeclinedAlternativeSlot> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setShortTransactionLimits(client);
        const hold = await this.lockHold(client, holdId);
        if (!hold) throw DomainErrors.holdNotFound();
        if (hold.owner_id !== ownerId) throw DomainErrors.holdOwnerMismatch();

        const scope = `booking.decline-alternative:${ownerId}`;
        const replay = command.idempotencyKey ? await this.acquireIdempotency(client, scope, command.idempotencyKey) : null;
        if (replay) return replay as unknown as DeclinedAlternativeSlot;
        if (command.expectedVersion !== undefined && hold.version !== command.expectedVersion) throw DomainErrors.slotVersionStale();
        if (hold.state !== 'ALTERNATIVE_PENDING' || !hold.alternative_slot_id || !hold.alternative_expires_at) throw DomainErrors.invalidTransition();

        const slots = await this.lockSlots(client, [hold.slot_id, hold.alternative_slot_id]);
        if (!slots.get(hold.slot_id) || !slots.get(hold.alternative_slot_id)) throw DomainErrors.slotNotFound();
        const correlationId = this.correlationId(command);
        if (hold.alternative_expires_at <= await this.databaseNow(client)) {
          await this.expireAlternativeLocked(client, hold, correlationId, 'owner-decline-detected-expiry');
          throw DomainErrors.holdExpired();
        }

        await this.releaseSlotCounter(client, hold.slot_id);
        await this.releaseSlotCounter(client, hold.alternative_slot_id);
        const updated = await client.query<{ version: number }>(`
          UPDATE booking_schema.booking_holds
          SET state = 'RELEASED', alternative_slot_id = NULL, alternative_expires_at = NULL,
              confirmation_sla_expires_at = NULL, state_changed_at = clock_timestamp(),
              version = version + 1, updated_at = clock_timestamp()
          WHERE id = $1::uuid AND state = 'ALTERNATIVE_PENDING'
          RETURNING version
        `, [hold.id]);
        if (!updated.rows[0]) throw DomainErrors.invalidTransition();

        const result: DeclinedAlternativeSlot = {
          holdId: hold.id,
          sourceSlotId: hold.slot_id,
          alternativeSlotId: hold.alternative_slot_id,
          state: 'RELEASED',
        };
        await this.writeOutbox(client, 'booking.alternative.declined.v1', correlationId, hold.id, updated.rows[0].version, result);
        await this.writeAudit(client, 'OWNER', ownerId, 'BOOKING_ALTERNATIVE_DECLINED', hold.id, correlationId, result);
        await this.completeIdempotency(client, scope, command.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async expireAlternativeHolds(batchSize = 20): Promise<number> {
    let expired = 0;
    for (let index = 0; index < batchSize; index += 1) {
      const processed = await this.database.withTransaction(async (client) => {
        await this.setShortTransactionLimits(client);
        const result = await client.query<AlternativeHold>(`
          SELECT id, slot_id, owner_id, pet_id, state, expires_at, alternative_slot_id, alternative_expires_at, version
          FROM booking_schema.booking_holds
          WHERE state = 'ALTERNATIVE_PENDING' AND alternative_expires_at < clock_timestamp()
          ORDER BY alternative_expires_at, id FOR UPDATE SKIP LOCKED LIMIT 1
        `);
        const hold = result.rows[0];
        if (!hold) return false;
        await this.expireAlternativeLocked(client, hold, this.correlationId(), 'alternative-ttl-expired');
        return true;
      });
      if (!processed) break;
      expired += 1;
    }
    return expired;
  }

  private async confirmLevelCAlternative(
    client: PoolClient,
    hold: AlternativeHold,
    sourceSlot: LockedSlot,
    alternativeSlot: LockedSlot,
    ownerId: string,
    correlationId: string,
  ): Promise<AcceptedAlternativeSlot> {
    const booked = await client.query<{ id: string }>(`
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
      WHERE id = $1::uuid AND held_count > 0 AND booked_count < capacity
      RETURNING id
    `, [alternativeSlot.id]);
    if (!booked.rows[0]) throw DomainErrors.bookingUnavailable();

    const updated = await client.query<{ version: number }>(`
      UPDATE booking_schema.booking_holds
      SET slot_id = $2::uuid, state = 'CONFIRMED', alternative_slot_id = NULL,
          alternative_expires_at = NULL, confirmation_sla_expires_at = NULL,
          state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1::uuid AND state = 'ALTERNATIVE_PENDING'
      RETURNING version
    `, [hold.id, alternativeSlot.id]);
    if (!updated.rows[0]) throw DomainErrors.invalidTransition();

    const appointment = await client.query<{ id: string }>(`
      INSERT INTO booking_schema.appointments (hold_id, owner_id, pet_id, clinic_location_id, slot_id)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)
      RETURNING id
    `, [hold.id, hold.owner_id, hold.pet_id, alternativeSlot.clinic_location_id, alternativeSlot.id]);
    const result: AcceptedAlternativeSlot = {
      holdId: hold.id,
      sourceSlotId: sourceSlot.id,
      slotId: alternativeSlot.id,
      state: 'CONFIRMED',
      appointmentId: appointment.rows[0].id,
    };
    await client.query(`
      INSERT INTO booking_schema.appointment_events (appointment_id, hold_id, event_type, actor_type, actor_id, correlation_id, payload_json)
      VALUES ($1::uuid, $2::uuid, 'CONFIRMED', 'OWNER', $3::uuid, $4::uuid, $5::jsonb)
    `, [result.appointmentId, hold.id, ownerId, correlationId, JSON.stringify({ sourceSlotId: sourceSlot.id, slotId: alternativeSlot.id, reason: 'ALTERNATIVE_ACCEPTED' })]);
    await this.writeOutbox(client, 'booking.alternative.accepted.v1', correlationId, hold.id, updated.rows[0].version, result);
    await this.writeOutbox(client, 'booking.confirmed.v1', correlationId, hold.id, updated.rows[0].version, {
      ...result,
      clinicLocationId: alternativeSlot.clinic_location_id,
      reason: 'ALTERNATIVE_ACCEPTED_LEVEL_C',
    });
    await this.writeAudit(client, 'OWNER', ownerId, 'BOOKING_ALTERNATIVE_ACCEPTED', hold.id, correlationId, result);
    return result;
  }

  private async moveToMisHeld(
    client: PoolClient,
    hold: AlternativeHold,
    sourceSlot: LockedSlot,
    alternativeSlot: LockedSlot,
    correlationId: string,
  ): Promise<AcceptedAlternativeSlot> {
    const updated = await client.query<{ version: number }>(`
      UPDATE booking_schema.booking_holds
      SET slot_id = $2::uuid, state = 'MIS_HELD', alternative_slot_id = NULL,
          alternative_expires_at = NULL, confirmation_sla_expires_at = NULL,
          state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1::uuid AND state = 'ALTERNATIVE_PENDING'
      RETURNING version
    `, [hold.id, alternativeSlot.id]);
    if (!updated.rows[0]) throw DomainErrors.invalidTransition();
    const result: AcceptedAlternativeSlot = {
      holdId: hold.id,
      sourceSlotId: sourceSlot.id,
      slotId: alternativeSlot.id,
      state: 'MIS_HELD',
    };
    await this.writeOutbox(client, 'booking.alternative.accepted.v1', correlationId, hold.id, updated.rows[0].version, result);
    return result;
  }

  private async lockHold(client: PoolClient, holdId: string): Promise<AlternativeHold | undefined> {
    const result = await client.query<AlternativeHold>(`
      SELECT id, slot_id, owner_id, pet_id, state, expires_at, alternative_slot_id, alternative_expires_at, version
      FROM booking_schema.booking_holds WHERE id = $1::uuid FOR UPDATE
    `, [holdId]);
    return result.rows[0];
  }

  private async lockSlots(client: PoolClient, ids: string[]): Promise<Map<string, LockedSlot>> {
    const result = await client.query<LockedSlot>(`
      SELECT id, clinic_location_id, starts_at, capacity, booked_count, held_count, state, status, integration_mode
      FROM clinic_schema.appointment_slots
      WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE
    `, [[...new Set(ids)].sort()]);
    return new Map(result.rows.map((slot) => [slot.id, slot]));
  }

  private async releaseSlotCounter(client: PoolClient, slotId: string): Promise<void> {
    const result = await client.query<{ id: string }>(`
      UPDATE clinic_schema.appointment_slots
      SET held_count = held_count - 1,
          status = CASE
            WHEN booked_count >= capacity THEN 'BOOKED'
            WHEN held_count - 1 > 0 THEN 'LOCKED_BY_HOLD'
            ELSE 'AVAILABLE'
          END,
          version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1::uuid AND held_count > 0
      RETURNING id
    `, [slotId]);
    if (!result.rows[0]) throw DomainErrors.bookingUnavailable();
  }

  private async expireAlternativeLocked(client: PoolClient, hold: AlternativeHold, correlationId: string, reason: string): Promise<void> {
    if (!hold.alternative_slot_id) throw DomainErrors.invalidTransition();
    const slots = await this.lockSlots(client, [hold.slot_id, hold.alternative_slot_id]);
    if (!slots.get(hold.slot_id) || !slots.get(hold.alternative_slot_id)) throw DomainErrors.slotNotFound();
    await this.releaseSlotCounter(client, hold.slot_id);
    await this.releaseSlotCounter(client, hold.alternative_slot_id);
    const updated = await client.query<{ version: number }>(`
      UPDATE booking_schema.booking_holds
      SET state = 'EXPIRED', alternative_slot_id = NULL, alternative_expires_at = NULL,
          state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1::uuid AND state = 'ALTERNATIVE_PENDING'
      RETURNING version
    `, [hold.id]);
    if (!updated.rows[0]) throw DomainErrors.invalidTransition();
    await this.writeOutbox(client, 'booking.alternative.expired.v1', correlationId, hold.id, updated.rows[0].version, {
      holdId: hold.id,
      sourceSlotId: hold.slot_id,
      alternativeSlotId: hold.alternative_slot_id,
      reason,
    });
    await this.writeAudit(client, 'SYSTEM_WORKER', null, 'BOOKING_ALTERNATIVE_EXPIRED', hold.id, correlationId, {
      sourceSlotId: hold.slot_id,
      alternativeSlotId: hold.alternative_slot_id,
      reason,
    });
  }

  private async acquireIdempotency(client: PoolClient, scope: string, key: string): Promise<Record<string, unknown> | null> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records (scope, idempotency_key, status)
      VALUES ($1, $2::uuid, 'PROCESSING')
      ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING id
    `, [scope, key]);
    if (inserted.rows[0]) return null;
    const existing = await client.query<IdempotencyRow>(`
      SELECT status, response_body
      FROM booking_schema.idempotency_records
      WHERE scope = $1 AND idempotency_key = $2::uuid
      FOR UPDATE
    `, [scope, key]);
    if (existing.rows[0]?.status === 'COMPLETED' && existing.rows[0].response_body) return existing.rows[0].response_body;
    throw DomainErrors.idempotencyInProgress();
  }

  private async completeIdempotency(client: PoolClient, scope: string, key: string | undefined, body: Record<string, unknown>, status: number): Promise<void> {
    if (!key) return;
    await client.query(`
      UPDATE booking_schema.idempotency_records
      SET status = 'COMPLETED', response_status = $3, response_body = $4::jsonb, updated_at = clock_timestamp()
      WHERE scope = $1 AND idempotency_key = $2::uuid
    `, [scope, key, status, JSON.stringify(body)]);
  }

  private async databaseNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }

  private correlationId(command?: AlternativeCommandContext): string {
    return command?.correlationId ?? this.traceContext.getCorrelationId() ?? randomUUID();
  }

  private async writeOutbox(client: PoolClient, eventType: string, correlationId: string, aggregateId: string, version: number, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events (event_type, correlation_id, aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key)
      VALUES ($1, $2::uuid, 'booking_hold', $3::uuid, $4, $5::jsonb, $6)
      ON CONFLICT (deduplication_key) DO NOTHING
    `, [eventType, correlationId, aggregateId, version, JSON.stringify(payload), `${eventType}:${aggregateId}:${version}`]);
  }

  private async writeAudit(client: PoolClient, actorType: string, actorId: string | null, action: string, holdId: string, correlationId: string, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json)
      VALUES ($1, $2, $3, 'booking_hold', $4::uuid, $5::uuid, $6::jsonb)
    `, [actorType, actorId, action, holdId, correlationId, JSON.stringify(payload)]);
  }

  private async setShortTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private mapPgError(error: unknown): unknown {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === '55P03' || code === '57014') return DomainErrors.slotLockedRetry();
    }
    return error;
  }
}
