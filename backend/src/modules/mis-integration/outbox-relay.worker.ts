import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { config } from '../../config';
import { DatabaseService } from '../../database/database.service';
import { ContextLoggerService } from '../../observability/context-logger.service';
import { ObservabilityMetricsService } from '../../observability/observability.metrics';
import { TraceContext } from '../../observability/trace-context.context';
import { MisReservationRequestedPayload } from './interfaces/mis-event.interface';
import { MisCommandDispatcherService } from './mis-command-dispatcher.service';

interface LeasedMisEvent {
  id: string;
  correlation_id: string | null;
  causation_id: string | null;
  traceparent: string | null;
  payload_json: MisReservationRequestedPayload;
}

@Injectable()
export class MisOutboxRelayWorker {
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly dispatcher: MisCommandDispatcherService,
    private readonly traceContext: TraceContext,
    private readonly logger: ContextLoggerService,
    private readonly metrics: ObservabilityMetricsService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relay(): Promise<void> {
    if (!config.workersEnabled || this.running) return;
    this.running = true;

    try {
      const events = await this.claimBatch(10);
      for (const event of events) {
        const context = this.traceContext.workerContext(event.correlation_id, {
          causationId: event.causation_id ?? event.id,
          traceparent: event.traceparent,
        });
        await this.traceContext.run(context, async () => {
          try {
            this.assertPayload(event.payload_json);
            await this.dispatcher.dispatchReservation(event.payload_json);
            await this.markProcessed(event.id);
            this.logger.event('debug', MisOutboxRelayWorker.name, 'MIS outbox event processed', { outboxEventId: event.id });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'MIS outbox dispatch failed';
            this.logger.event('error', MisOutboxRelayWorker.name, 'MIS outbox event failed', {
              outboxEventId: event.id,
              error: message,
            });
            this.metrics.critical('MIS_INTEGRATION_TIMEOUT', MisOutboxRelayWorker.name, 'MIS outbox delivery failed', {
              outboxEventId: event.id,
              error: message,
            });
            await this.releaseForRetry(event.id, message);
          }
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(limit: number): Promise<LeasedMisEvent[]> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<LeasedMisEvent>(`
        WITH claimed AS (
          SELECT id
          FROM booking_schema.outbox_events
          WHERE event_type = 'mis.reservation.requested.v1'
            AND processed_at IS NULL
            AND status = 'PENDING'
            AND available_at <= clock_timestamp()
            AND (lease_until IS NULL OR lease_until < clock_timestamp())
          ORDER BY created_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE booking_schema.outbox_events e
        SET status = 'LEASED',
            lease_until = clock_timestamp() + interval '30 seconds',
            attempts = attempts + 1
        FROM claimed
        WHERE e.id = claimed.id
        RETURNING e.id, e.correlation_id, e.causation_id, e.traceparent, e.payload_json
      `, [limit]);
      return result.rows;
    });
  }

  private async markProcessed(eventId: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PUBLISHED',
          processed_at = clock_timestamp(),
          published_at = clock_timestamp(),
          lease_until = NULL,
          last_error = NULL
      WHERE id = $1::uuid
        AND event_type = 'mis.reservation.requested.v1'
        AND status = 'LEASED'
    `, [eventId]);
  }

  private async releaseForRetry(eventId: string, reason: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PENDING',
          available_at = clock_timestamp() + interval '5 seconds',
          lease_until = NULL,
          last_error = $2
      WHERE id = $1::uuid
        AND event_type = 'mis.reservation.requested.v1'
        AND status = 'LEASED'
    `, [eventId, reason.slice(0, 1000)]);
  }

  private assertPayload(payload: MisReservationRequestedPayload): void {
    if (!payload || !payload.holdId || !payload.slotId || !payload.clinicId || !payload.externalPatientId) {
      throw new Error('Invalid mis.reservation.requested.v1 payload');
    }
  }
}
