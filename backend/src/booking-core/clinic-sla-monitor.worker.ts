import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ContextLoggerService } from '../observability/context-logger.service';
import { ObservabilityMetricsService } from '../observability/observability.metrics';
import { TraceContext } from '../observability/trace-context.context';

interface ExpiredManualHold {
  id: string;
  slot_id: string;
  correlation_id: string | null;
}

interface BreachedHoldResult {
  holdId: string;
  slotId: string;
  correlationId: string | null;
}

/**
 * Alpha-level enforcement for Level-C clinic response SLA.
 *
 * One hold is claimed per short transaction. FOR UPDATE SKIP LOCKED is used
 * only here in this background worker; no interactive user route uses it.
 */
@Injectable()
export class ClinicSlaMonitorWorker {
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
    private readonly logger: ContextLoggerService,
    private readonly metrics: ObservabilityMetricsService,
  ) {}

  @Cron('*/30 * * * * *')
  async monitorManualConfirmationSla(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;

    try {
      for (let index = 0; index < 20; index += 1) {
        const breached = await this.processOneExpiredManualHold();
        if (!breached) break;

        await this.traceContext.run(this.traceContext.workerContext(breached.correlationId), async () => {
          this.metrics.critical(
            'CLINIC_SLA_BREACHED',
            ClinicSlaMonitorWorker.name,
            'Clinic manual confirmation SLA breached; hold released automatically',
            { holdId: breached.holdId, slotId: breached.slotId },
          );
        });
      }
    } catch (error) {
      this.logger.event('error', ClinicSlaMonitorWorker.name, 'Clinic manual confirmation SLA monitor failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.running = false;
    }
  }

  private async processOneExpiredManualHold(): Promise<BreachedHoldResult | undefined> {
    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);

      const candidate = await client.query<ExpiredManualHold>(`
        SELECT h.id,
               h.slot_id,
               (
                 SELECT o.correlation_id::text
                 FROM booking_schema.outbox_events o
                 WHERE o.aggregate_type = 'booking_hold'
                   AND o.aggregate_id = h.id
                 ORDER BY o.created_at DESC
                 LIMIT 1
               ) AS correlation_id
        FROM booking_schema.booking_holds h
        WHERE h.state = 'MANUAL_CONFIRM_PENDING'
          AND h.confirmation_sla_expires_at < clock_timestamp()
        ORDER BY h.confirmation_sla_expires_at, h.id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
      const hold = candidate.rows[0];
      if (!hold) return undefined;

      const releasedSlot = await client.query<{ id: string }>(`
        UPDATE clinic_schema.appointment_slots
        SET held_count = held_count - 1,
            status = CASE
              WHEN booked_count >= capacity THEN 'BOOKED'
              WHEN held_count - 1 > 0 THEN 'LOCKED_BY_HOLD'
              ELSE 'AVAILABLE'
            END,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND held_count > 0
        RETURNING id
      `, [hold.slot_id]);
      if (!releasedSlot.rows[0]) {
        throw new Error(`Cannot release booked slot counter for SLA-breached hold ${hold.id}`);
      }

      const breached = await client.query<{ id: string; version: number }>(`
        UPDATE booking_schema.booking_holds
        SET state = 'SLA_BREACHED',
            state_changed_at = clock_timestamp(),
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state = 'MANUAL_CONFIRM_PENDING'
          AND confirmation_sla_expires_at < clock_timestamp()
        RETURNING id, version
      `, [hold.id]);
      if (!breached.rows[0]) {
        throw new Error(`Manual hold ${hold.id} changed after SLA claim`);
      }

      await client.query(`
        INSERT INTO booking_schema.outbox_events (
          event_type, correlation_id, causation_id, traceparent, aggregate_type,
          aggregate_id, aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'clinic.sla.breached.v1', $1::uuid, $2::uuid, $3, 'booking_hold', $4::uuid,
          $5, jsonb_build_object('holdId', $4::uuid, 'slotId', $6::uuid, 'sla', 'MANUAL_CONFIRMATION'),
          $7
        ) ON CONFLICT (deduplication_key) DO NOTHING
      `, [
        hold.correlation_id,
        hold.id,
        null,
        hold.id,
        breached.rows[0].version,
        hold.slot_id,
        `clinic.sla.breached.v1:${hold.id}:${breached.rows[0].version}`,
      ]);

      await client.query(`
        INSERT INTO audit_schema.audit_log (
          actor_type, actor_id, action, aggregate_type, aggregate_id,
          correlation_id, causation_id, traceparent, payload_json
        ) VALUES (
          'SYSTEM_WORKER', NULL, 'CLINIC_MANUAL_CONFIRMATION_SLA_BREACHED',
          'booking_hold', $1::uuid, $2::uuid, $1::uuid, NULL,
          jsonb_build_object('slotId', $3::uuid, 'confirmationSlaBreached', true)
        )
      `, [hold.id, hold.correlation_id, hold.slot_id]);

      return { holdId: hold.id, slotId: hold.slot_id, correlationId: hold.correlation_id };
    });
  }

  private async setShortTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }
}
