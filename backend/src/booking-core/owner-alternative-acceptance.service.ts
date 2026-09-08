import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainErrors, DomainException } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { AlternativeSlotService, AcceptedAlternativeSlot } from './alternative-slot.service';

type Decision = 'ACCEPT' | 'DECLINE';

interface ResolutionCommand {
  expectedVersion: number;
  idempotencyKey: string;
  correlationId: string;
}

interface SwapRow {
  id: string;
  original_hold_id: string;
  original_slot_id: string;
  alternative_slot_id: string;
  owner_id: string;
  expires_at: Date;
  state: string;
}

interface HoldRow {
  id: string;
  slot_id: string;
  owner_id: string;
  state: string;
  alternative_slot_id: string | null;
  version: number;
}

interface LockedSlot {
  id: string;
  clinic_location_id: string;
  service_id: string | null;
  doctor_id: string | null;
  staff_id: string | null;
  resource_id: string | null;
  specialty_id: string | null;
  starts_at: Date;
  capacity: number;
  booked_count: number;
  held_count: number;
  state: string;
  status: string;
}

interface IdempotencyRow {
  status: string;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  request_fingerprint: string | null;
}

export interface OwnerAlternativeResolution {
  proposalId: string;
  bookingId: string;
  decision: Decision;
  state: 'MIS_HELD' | 'MANUAL_CONFIRM_PENDING';
  slotId: string;
  aggregateVersion: number;
}

@Injectable()
export class OwnerAlternativeAcceptanceService {
  constructor(
    private readonly alternatives: AlternativeSlotService,
    private readonly database: DatabaseService,
  ) {}

  /** Legacy hold-addressed acceptance retained for existing callers. */
  async accept(holdId: string, ownerId: string, command: { expectedVersion: number; idempotencyKey: string }): Promise<AcceptedAlternativeSlot> {
    return this.alternatives.acceptAlternativeSlot(holdId, ownerId, command);
  }

  async resolve(proposalId: string, ownerId: string, decision: Decision, command: ResolutionCommand, bookingId?: string): Promise<OwnerAlternativeResolution> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '250ms'");
      await client.query("SET LOCAL statement_timeout = '1500ms'");

      // Resolve identifiers without locks, then use the same global order as
      // clinic proposal/supersede: hold -> sorted slots -> proposal.
      const candidate = await this.findProposal(client, proposalId, ownerId, bookingId);
      if (!candidate) throw DomainErrors.holdNotFound();
      const hold = await this.lockHold(client, bookingId ?? candidate.original_hold_id);
      if (!hold || hold.owner_id !== ownerId || hold.id !== candidate.original_hold_id) throw DomainErrors.holdNotFound();

      const scope = `owner.alternative.${decision.toLowerCase()}:${ownerId}`;
      const fingerprint = createHash('sha256')
        .update(JSON.stringify({ proposalId, bookingId: bookingId ?? hold.id, decision, expectedVersion: command.expectedVersion }))
        .digest('hex');
      const replay = await this.acquireIdempotency(client, scope, command.idempotencyKey, fingerprint);
      if (replay) return replay as unknown as OwnerAlternativeResolution;

      const slots = await this.lockSlots(client, [candidate.original_slot_id, candidate.alternative_slot_id]);
      const swap = await this.lockProposal(client, proposalId, ownerId, hold.id);
      if (!swap || swap.original_slot_id !== candidate.original_slot_id || swap.alternative_slot_id !== candidate.alternative_slot_id) {
        throw DomainErrors.holdNotFound();
      }
      if (swap.state !== 'PENDING' || hold.state !== 'ALTERNATIVE_PENDING' || hold.alternative_slot_id !== swap.alternative_slot_id) {
        throw DomainErrors.invalidTransition();
      }
      if (hold.version !== command.expectedVersion) throw DomainErrors.bookingVersionStale();
      const now = await this.databaseNow(client);
      if (swap.expires_at <= now) throw DomainErrors.alternativeProposalExpired();
      this.assertSlotsEligible(slots, swap, now);
      const releasedSlotId = decision === 'ACCEPT' ? swap.original_slot_id : swap.alternative_slot_id;
      await this.releaseSlot(client, releasedSlotId);

      const nextState = decision === 'ACCEPT' ? 'MIS_HELD' : 'MANUAL_CONFIRM_PENDING';
      const retainedSlotId = decision === 'ACCEPT' ? swap.alternative_slot_id : swap.original_slot_id;
      const updated = await client.query<{ version: number }>(`
        UPDATE booking_schema.booking_holds
        SET slot_id = $2::uuid,
            state = $3,
            alternative_slot_id = NULL,
            alternative_expires_at = NULL,
            expires_at = CASE WHEN $3 = 'MANUAL_CONFIRM_PENDING' THEN clock_timestamp() + interval '15 minutes' ELSE expires_at END,
            confirmation_sla_expires_at = CASE WHEN $3 = 'MANUAL_CONFIRM_PENDING' THEN clock_timestamp() + interval '15 minutes' ELSE NULL END,
            state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND state = 'ALTERNATIVE_PENDING'
        RETURNING version
      `, [hold.id, retainedSlotId, nextState]);
      if (!updated.rows[0]) throw DomainErrors.invalidTransition();

      const finalized = await client.query(`
        UPDATE booking_schema.alternative_swap_groups
        SET state = $2, aggregate_version = aggregate_version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND state = 'PENDING' RETURNING id
      `, [swap.id, decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED']);
      if (!finalized.rows[0]) throw DomainErrors.invalidTransition();

      const result: OwnerAlternativeResolution = {
        proposalId: swap.id,
        bookingId: hold.id,
        decision,
        state: nextState,
        slotId: retainedSlotId,
        aggregateVersion: updated.rows[0].version,
      };
      const eventType = decision === 'ACCEPT' ? 'booking.alternative.accepted.v1' : 'booking.alternative.declined.v1';
      const action = decision === 'ACCEPT' ? 'BOOKING_ALTERNATIVE_ACCEPTED' : 'BOOKING_ALTERNATIVE_DECLINED';
      await this.writeOutbox(client, eventType, command.correlationId, hold.id, result.aggregateVersion, { ...result });
      await client.query(`
        INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json)
        VALUES ('OWNER', $1, $2, 'booking_hold', $3::uuid, $4::uuid, $5::jsonb)
      `, [ownerId, action, hold.id, command.correlationId, JSON.stringify(result)]);
      await client.query(`
        UPDATE booking_schema.idempotency_records
        SET status='COMPLETED', response_status=$3, response_body=$4::jsonb, updated_at=clock_timestamp()
        WHERE scope=$1 AND idempotency_key=$2::uuid
      `, [scope, command.idempotencyKey, HttpStatus.OK, JSON.stringify(result)]);
      return result;
    }).catch((error: unknown) => {
      const code = (error as { code?: string })?.code;
      if (code === '55P03' || code === '57014' || code === '40P01') throw DomainErrors.slotLockedRetry();
      throw error;
    });
  }

  private async findProposal(client: PoolClient, proposalId: string, ownerId: string, bookingId?: string): Promise<SwapRow | undefined> {
    return (await client.query<SwapRow>(`
      SELECT id::text, original_hold_id::text, original_slot_id::text, alternative_slot_id::text,
             owner_id::text, expires_at, state
      FROM booking_schema.alternative_swap_groups
      WHERE id=$1::uuid AND owner_id=$2::uuid
        AND ($3::uuid IS NULL OR original_hold_id=$3::uuid)
    `, [proposalId, ownerId, bookingId ?? null])).rows[0];
  }

  private async lockProposal(client: PoolClient, proposalId: string, ownerId: string, bookingId?: string): Promise<SwapRow | undefined> {
    return (await client.query<SwapRow>(`
      SELECT id::text, original_hold_id::text, original_slot_id::text, alternative_slot_id::text,
             owner_id::text, expires_at, state
      FROM booking_schema.alternative_swap_groups
      WHERE id=$1::uuid AND owner_id=$2::uuid
        AND ($3::uuid IS NULL OR original_hold_id=$3::uuid)
      FOR UPDATE
    `, [proposalId, ownerId, bookingId ?? null])).rows[0];
  }

  private async lockHold(client: PoolClient, holdId: string): Promise<HoldRow | undefined> {
    return (await client.query<HoldRow>(`
      SELECT id::text, slot_id::text, owner_id::text, state, alternative_slot_id::text, version
      FROM booking_schema.booking_holds WHERE id=$1::uuid FOR UPDATE
    `, [holdId])).rows[0];
  }

  private async lockSlots(client: PoolClient, ids: string[]): Promise<Map<string, LockedSlot>> {
    const rows = await client.query<LockedSlot>(`
      SELECT id::text, clinic_location_id::text, service_id::text, doctor_id::text,
             staff_id::text, resource_id::text, specialty_id::text, starts_at,
             capacity, booked_count, held_count, state, status
      FROM clinic_schema.appointment_slots
      WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE
    `, [[...ids].sort()]);
    return new Map(rows.rows.map((row) => [row.id, row]));
  }

  private assertSlotsEligible(slots: Map<string, LockedSlot>, swap: SwapRow, now: Date): void {
    const source = slots.get(swap.original_slot_id);
    const proposed = slots.get(swap.alternative_slot_id);
    if (!source || !proposed) throw DomainErrors.alternativeSlotUnavailable();
    for (const slot of [source, proposed]) {
      if (slot.state !== 'OPEN' || slot.status !== 'LOCKED_BY_HOLD' || slot.starts_at <= now ||
          slot.held_count <= 0 || slot.booked_count + slot.held_count > slot.capacity) {
        throw DomainErrors.alternativeSlotUnavailable();
      }
    }
    const compatible = source.clinic_location_id === proposed.clinic_location_id &&
      source.service_id === proposed.service_id && source.doctor_id === proposed.doctor_id &&
      source.staff_id === proposed.staff_id && source.resource_id === proposed.resource_id &&
      source.specialty_id === proposed.specialty_id;
    if (!compatible) throw DomainErrors.alternativeSlotIncompatible();
  }

  private async releaseSlot(client: PoolClient, slotId: string): Promise<void> {
    const result = await client.query(`
      UPDATE clinic_schema.appointment_slots
      SET held_count=held_count-1,
          status=CASE WHEN booked_count>=capacity THEN 'BOOKED' WHEN held_count-1>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,
          version=version+1, updated_at=clock_timestamp()
      WHERE id=$1::uuid AND held_count>0 RETURNING id
    `, [slotId]);
    if (!result.rows[0]) throw DomainErrors.bookingUnavailable();
  }

  private async acquireIdempotency(client: PoolClient, scope: string, key: string, fingerprint: string): Promise<Record<string, unknown> | undefined> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,request_fingerprint)
      VALUES($1,$2::uuid,'PROCESSING',$3) ON CONFLICT(scope,idempotency_key) DO NOTHING RETURNING id
    `, [scope, key, fingerprint]);
    if (inserted.rows[0]) return undefined;
    const row = (await client.query<IdempotencyRow>(`
      SELECT status,response_status,response_body,request_fingerprint FROM booking_schema.idempotency_records
      WHERE scope=$1 AND idempotency_key=$2::uuid FOR UPDATE
    `, [scope, key])).rows[0];
    if (!row) throw DomainErrors.bookingUnavailable();
    if (row.request_fingerprint !== fingerprint) throw DomainErrors.idempotencyPayloadConflict();
    if (row.status !== 'COMPLETED' || !row.response_body) throw DomainErrors.idempotencyInProgress();
    if ((row.response_status ?? 500) >= 400) throw new DomainException(row.response_status ?? 409, 'IDEMPOTENT_REQUEST_FAILED', 'Previous request failed');
    return row.response_body;
  }

  private async databaseNow(client: PoolClient): Promise<Date> {
    return (await client.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0].now;
  }

  private async writeOutbox(client: PoolClient, eventType: string, correlationId: string, holdId: string, version: number, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events(event_type,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key)
      VALUES($1,$2::uuid,'booking_hold',$3::uuid,$4,$5::jsonb,$6)
    `, [eventType, correlationId, holdId, version, JSON.stringify(payload), `${eventType}:${holdId}:${version}`]);
  }
}
