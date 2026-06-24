import { Injectable } from '@nestjs/common';
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
  state: 'MIS_HELD';
}

/**
 * A pending alternative holds both slots. On owner acceptance the source slot
 * is released, while the alternative remains held by the booking until payment
 * authorization atomically confirms it.
 */
@Injectable()
export class AlternativeSlotService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: ClinicEmployeeAccessService,
    private readonly traceContext: TraceContext,
  ) {}

  async proposeAlternativeSlot(holdId: string, newSlotId: string, employeeContext: JwtPayload): Promise<ProposedAlternativeSlot> {
    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const hold = await this.lockHold(client, holdId);
      if (!hold) throw DomainErrors.holdNotFound();
      if (hold.state !== 'MANUAL_CONFIRM_PENDING' && hold.state !== 'ALTERNATIVE_PENDING') throw DomainErrors.invalidTransition();
      if (hold.slot_id === newSlotId) throw DomainErrors.slotAlreadyTaken();

      const now = await this.databaseNow(client);
      if (hold.state === 'ALTERNATIVE_PENDING' && hold.alternative_expires_at && hold.alternative_expires_at <= now) {
        await this.expireAlternativeLocked(client, hold, this.correlationId(), 'proposal-detected-expiry');
        throw DomainErrors.holdExpired();
      }

      const slots = await this.lockSlots(client, [hold.slot_id, newSlotId, hold.alternative_slot_id].filter(Boolean) as string[]);
      const sourceSlot = slots.get(hold.slot_id);
      const newSlot = slots.get(newSlotId);
      if (!sourceSlot || !newSlot) throw DomainErrors.slotNotFound();
      await this.access.assertLocationAccess(client, employeeContext, sourceSlot.clinic_location_id);
      if (sourceSlot.clinic_location_id !== newSlot.clinic_location_id) throw DomainErrors.clinicScopeMismatch();

      if (hold.state === 'ALTERNATIVE_PENDING' && hold.alternative_slot_id === newSlotId && hold.alternative_expires_at) {
        return { holdId: hold.id, sourceSlotId: hold.slot_id, alternativeSlotId: newSlotId, expiresAt: hold.alternative_expires_at.toISOString(), state: 'ALTERNATIVE_PENDING' };
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

      const correlationId = this.correlationId();
      const result: ProposedAlternativeSlot = {
        holdId: hold.id,
        sourceSlotId: hold.slot_id,
        alternativeSlotId: newSlotId,
        expiresAt: updated.rows[0].alternative_expires_at.toISOString(),
        state: 'ALTERNATIVE_PENDING',
      };
      await this.writeOutbox(client, 'booking.alternative.proposed.v1', correlationId, hold.id, updated.rows[0].version, { ...result, employeeId: employeeContext.sub, clinicLocationId: sourceSlot.clinic_location_id });
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', employeeContext.sub, 'BOOKING_ALTERNATIVE_PROPOSED', hold.id, correlationId, { sourceSlotId: hold.slot_id, alternativeSlotId: newSlotId });
      return result;
    });
  }

  async acceptAlternativeSlot(holdId: string, ownerId: string): Promise<AcceptedAlternativeSlot> {
    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const hold = await this.lockHold(client, holdId);
      if (!hold) throw DomainErrors.holdNotFound();
      if (hold.owner_id !== ownerId) throw DomainErrors.holdOwnerMismatch();
      if (hold.state !== 'ALTERNATIVE_PENDING' || !hold.alternative_slot_id || !hold.alternative_expires_at) throw DomainErrors.invalidTransition();

      const slots = await this.lockSlots(client, [hold.slot_id, hold.alternative_slot_id]);
      const sourceSlot = slots.get(hold.slot_id);
      const alternativeSlot = slots.get(hold.alternative_slot_id);
      if (!sourceSlot || !alternativeSlot) throw DomainErrors.slotNotFound();
      if (hold.alternative_expires_at <= await this.databaseNow(client)) {
        await this.expireAlternativeLocked(client, hold, this.correlationId(), 'owner-accept-detected-expiry');
        throw DomainErrors.holdExpired();
      }
      if (sourceSlot.held_count <= 0 || alternativeSlot.held_count <= 0) throw DomainErrors.bookingUnavailable();

      await this.releaseSlotCounter(client, sourceSlot.id);
      const updated = await client.query<{ version: number }>(`
        UPDATE booking_schema.booking_holds
        SET slot_id = $2::uuid, state = 'MIS_HELD', alternative_slot_id = NULL,
            alternative_expires_at = NULL, confirmation_sla_expires_at = NULL,
            state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND state = 'ALTERNATIVE_PENDING'
        RETURNING version
      `, [hold.id, alternativeSlot.id]);
      if (!updated.rows[0]) throw DomainErrors.invalidTransition();

      const correlationId = this.correlationId();
      const result: AcceptedAlternativeSlot = { holdId: hold.id, sourceSlotId: sourceSlot.id, slotId: alternativeSlot.id, state: 'MIS_HELD' };
      await this.writeOutbox(client, 'booking.alternative.accepted.v1', correlationId, hold.id, updated.rows[0].version, { ...result });
      await this.writeAudit(client, 'OWNER', ownerId, 'BOOKING_ALTERNATIVE_ACCEPTED', hold.id, correlationId, { ...result });
      return result;
    });
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

  private async lockHold(client: PoolClient, holdId: string): Promise<AlternativeHold | undefined> {
    const result = await client.query<AlternativeHold>(`
      SELECT id, slot_id, owner_id, pet_id, state, expires_at, alternative_slot_id, alternative_expires_at, version
      FROM booking_schema.booking_holds WHERE id = $1::uuid FOR UPDATE
    `, [holdId]);
    return result.rows[0];
  }

  private async lockSlots(client: PoolClient, ids: string[]): Promise<Map<string, LockedSlot>> {
    const result = await client.query<LockedSlot>(`
      SELECT id, clinic_location_id, starts_at, capacity, booked_count, held_count, state, status
      FROM clinic_schema.appointment_slots
      WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE
    `, [[...new Set(ids)].sort()]);
    return new Map(result.rows.map((slot) => [slot.id, slot]));
  }

  private async releaseSlotCounter(client: PoolClient, slotId: string): Promise<void> {
    const result = await client.query<{ id: string }>(`
      UPDATE clinic_schema.appointment_slots
      SET held_count = held_count - 1,
          status = CASE WHEN booked_count >= capacity THEN 'BOOKED' WHEN held_count - 1 > 0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,
          version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1::uuid AND held_count > 0 RETURNING id
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
      WHERE id = $1::uuid AND state = 'ALTERNATIVE_PENDING' RETURNING version
    `, [hold.id]);
    if (!updated.rows[0]) throw DomainErrors.invalidTransition();
    await this.writeOutbox(client, 'booking.alternative.expired.v1', correlationId, hold.id, updated.rows[0].version, { holdId: hold.id, sourceSlotId: hold.slot_id, alternativeSlotId: hold.alternative_slot_id, reason });
    await this.writeAudit(client, 'SYSTEM_WORKER', null, 'BOOKING_ALTERNATIVE_EXPIRED', hold.id, correlationId, { sourceSlotId: hold.slot_id, alternativeSlotId: hold.alternative_slot_id, reason });
  }

  private async databaseNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }

  private correlationId(): string {
    return this.traceContext.getCorrelationId() ?? randomUUID();
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
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }
}
