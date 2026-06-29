import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { TraceContext } from '../../observability/trace-context.context';
import { IMisAdapter, MisConfigurationError, MisNetworkError, MisReservationResult } from './interfaces/mis-adapter.interface';
import { MisReservationRequestedPayload } from './interfaces/mis-event.interface';
import { MisAdapterFactory } from './mis-adapter.factory';

interface DispatchContext { state: string; mis_type: string | null; }
interface LockedReservation { hold_id: string; hold_state: string; hold_slot_id: string; }

@Injectable()
export class MisCommandDispatcherService {
  private readonly logger = new Logger(MisCommandDispatcherService.name);
  private readonly retryDelaysMs = [1_000, 2_000] as const;
  private readonly maxNetworkAttempts = 3;

  constructor(
    private readonly database: DatabaseService,
    private readonly adapterFactory: MisAdapterFactory,
    private readonly traceContext: TraceContext,
  ) {}

  /**
   * A network timeout is not a business rejection. The hold remains reserved
   * locally in MIS_RECONCILIATION_PENDING and the same external idempotency key
   * is retried by the durable outbox until the MIS returns a definitive result.
   */
  async dispatchReservation(payload: MisReservationRequestedPayload): Promise<void> {
    const context = await this.loadContext(payload);
    if (!context) {
      this.logger.warn(`MIS event ignored: hold ${payload.holdId} does not match slot/clinic`);
      return;
    }
    if (context.state === 'MIS_HELD' || context.state === 'MIS_BOOKING_FAILED') return;
    if (context.state !== 'MIS_RESERVATION_PENDING' && context.state !== 'MIS_RECONCILIATION_PENDING') {
      this.logger.warn(`MIS event ignored: hold ${payload.holdId} is ${context.state}`);
      return;
    }
    if (!context.mis_type) {
      await this.commitReservationFailure(payload, 'Clinic MIS type is not configured');
      return;
    }

    let adapter: IMisAdapter;
    try {
      adapter = this.adapterFactory.getAdapter(context.mis_type);
    } catch (error) {
      await this.commitReservationFailure(payload, this.errorMessage(error));
      return;
    }

    for (let attempt = 0; attempt < this.maxNetworkAttempts; attempt += 1) {
      try {
        const result = await adapter.reserve({
          internalHoldId: payload.holdId,
          slotId: payload.slotId,
          clinicId: payload.clinicId,
          externalPatientId: payload.externalPatientId,
          correlationId: payload.correlationId,
        });
        if (result.status === 'SUCCESS') await this.commitReservationSuccess(payload, result);
        else await this.commitReservationFailure(payload, result.rawError ?? 'MIS reservation was rejected');
        return;
      } catch (error) {
        const retryable = error instanceof MisNetworkError;
        const lastAttempt = attempt === this.maxNetworkAttempts - 1;
        if (!retryable || lastAttempt) {
          if (retryable) {
            await this.markReconciliationPending(payload, this.errorMessage(error));
            throw error;
          }
          await this.commitReservationFailure(payload, this.errorMessage(error));
          return;
        }
        const waitMs = this.retryDelaysMs[attempt];
        this.logger.warn(`MIS reservation ${payload.holdId} failed on attempt ${attempt + 1}; retry in ${waitMs}ms`);
        await delay(waitMs);
      }
    }
  }

  private async loadContext(payload: MisReservationRequestedPayload): Promise<DispatchContext | undefined> {
    const result = await this.database.query<DispatchContext>(`
      SELECT h.state, c.mis_type
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      JOIN clinic_schema.clinic_locations l ON l.id = s.clinic_location_id
      JOIN clinic_schema.clinics c ON c.id = l.clinic_id
      WHERE h.id = $1::uuid AND h.slot_id = $2::uuid AND c.id = $3::uuid
    `, [payload.holdId, payload.slotId, payload.clinicId]);
    return result.rows[0];
  }

  async commitReservationSuccess(payload: MisReservationRequestedPayload, result: MisReservationResult): Promise<void> {
    if (!result.externalHoldId) return this.commitReservationFailure(payload, 'MIS response marked success without external hold id');
    await this.database.withTransaction(async (client) => {
      await this.setLimits(client);
      const locked = await this.lockReservation(client, payload.holdId);
      if (!locked || locked.hold_state === 'MIS_HELD' || locked.hold_state === 'MIS_BOOKING_FAILED') return;
      if (locked.hold_state !== 'MIS_RESERVATION_PENDING' && locked.hold_state !== 'MIS_RECONCILIATION_PENDING') return;
      const updated = await client.query<{ version: number }>(`
        UPDATE booking_schema.booking_holds
        SET state = 'MIS_HELD', external_hold_id = $2, mis_last_error = NULL,
            mis_processed_at = clock_timestamp(),
            expires_at = CASE WHEN $3::integer IS NULL THEN expires_at ELSE LEAST(expires_at, clock_timestamp() + ($3::text || ' minutes')::interval) END,
            state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND state IN ('MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING')
        RETURNING version
      `, [payload.holdId, result.externalHoldId, result.ttlMinutes ?? null]);
      if (!updated.rows[0]) return;
      await this.writeAudit(client, 'mis.reservation.held', payload, { externalHoldId: result.externalHoldId, ttlMinutes: result.ttlMinutes });
      await this.writeOutbox(client, 'mis.reservation.held.v1', payload, updated.rows[0].version, { externalHoldId: result.externalHoldId, ttlMinutes: result.ttlMinutes });
    });
  }

  async commitReservationFailure(payload: MisReservationRequestedPayload, rawError: string): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await this.setLimits(client);
      const locked = await this.lockReservation(client, payload.holdId);
      if (!locked || locked.hold_state === 'MIS_HELD' || locked.hold_state === 'MIS_BOOKING_FAILED') return;
      if (locked.hold_state !== 'MIS_RESERVATION_PENDING' && locked.hold_state !== 'MIS_RECONCILIATION_PENDING') return;
      const hold = await client.query<{ version: number }>(`
        UPDATE booking_schema.booking_holds
        SET state = 'MIS_BOOKING_FAILED', mis_last_error = $2, mis_processed_at = clock_timestamp(),
            state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND state IN ('MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING')
        RETURNING version
      `, [payload.holdId, rawError.slice(0, 1000)]);
      if (!hold.rows[0]) return;
      const slot = await client.query<{ id: string }>(`
        UPDATE clinic_schema.appointment_slots
        SET held_count = held_count - 1, version = version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND held_count > 0 RETURNING id
      `, [locked.hold_slot_id]);
      if (!slot.rows[0]) throw new Error(`Cannot compensate hold ${payload.holdId}: held_count is already zero`);
      await this.writeAudit(client, 'mis.reservation.failed', payload, { rawError: rawError.slice(0, 1000) });
      await this.writeOutbox(client, 'mis.reservation.failed.v1', payload, hold.rows[0].version, { rawError: rawError.slice(0, 1000) });
    });
  }

  private async markReconciliationPending(payload: MisReservationRequestedPayload, rawError: string): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await this.setLimits(client);
      const locked = await this.lockReservation(client, payload.holdId);
      if (!locked || locked.hold_state === 'MIS_HELD' || locked.hold_state === 'MIS_BOOKING_FAILED') return;
      if (locked.hold_state !== 'MIS_RESERVATION_PENDING' && locked.hold_state !== 'MIS_RECONCILIATION_PENDING') return;
      const updated = await client.query<{ version: number }>(`
        UPDATE booking_schema.booking_holds
        SET state = 'MIS_RECONCILIATION_PENDING', mis_last_error = $2,
            mis_processed_at = clock_timestamp(), state_changed_at = clock_timestamp(),
            version = version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND state = 'MIS_RESERVATION_PENDING'
        RETURNING version
      `, [payload.holdId, rawError.slice(0, 1000)]);
      if (!updated.rows[0]) return;
      await this.writeAudit(client, 'mis.reservation.reconciliation_pending', payload, { rawError: rawError.slice(0, 1000) });
      await this.writeOutbox(client, 'mis.reservation.reconciliation.pending.v1', payload, updated.rows[0].version, { rawError: rawError.slice(0, 1000) });
    });
  }

  private async lockReservation(client: PoolClient, holdId: string): Promise<LockedReservation | undefined> {
    const result = await client.query<LockedReservation>(`
      SELECT h.id AS hold_id, h.state AS hold_state, h.slot_id AS hold_slot_id
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      WHERE h.id = $1::uuid FOR UPDATE OF h, s
    `, [holdId]);
    return result.rows[0];
  }

  private async setLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private async writeAudit(client: PoolClient, action: string, payload: MisReservationRequestedPayload, details: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (
        actor_type, actor_id, action, aggregate_type, aggregate_id,
        correlation_id, causation_id, traceparent, payload_json
      )
      VALUES (
        'SYSTEM', NULL, $1, 'booking_hold', $2::uuid,
        $3::uuid, $4::uuid, $5, $6::jsonb
      )
    `, [
      action,
      payload.holdId,
      payload.correlationId ?? this.traceContext.getCorrelationId() ?? null,
      this.traceContext.getCausationId() ?? null,
      this.traceContext.getTraceparent() ?? null,
      JSON.stringify({ ...details, slotId: payload.slotId, clinicId: payload.clinicId }),
    ]);
  }

  private async writeOutbox(client: PoolClient, eventType: string, payload: MisReservationRequestedPayload, version: number, details: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, causation_id, traceparent,
        aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key
      ) VALUES ($1, $2::uuid, $3::uuid, $4, 'booking_hold', $5::uuid, $6, $7::jsonb, $8)
      ON CONFLICT (deduplication_key) DO NOTHING
    `, [
      eventType,
      payload.correlationId ?? null,
      this.traceContext.getCausationId() ?? null,
      this.traceContext.getTraceparent() ?? null,
      payload.holdId,
      version,
      JSON.stringify({ holdId: payload.holdId, slotId: payload.slotId, clinicId: payload.clinicId, ...details }),
      `${eventType}:${payload.holdId}:${version}`,
    ]);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof MisConfigurationError || error instanceof MisNetworkError || error instanceof Error) return error.message.slice(0, 1000);
    return 'MIS reservation failed';
  }
}
