import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { ContextLoggerService } from '../../observability/context-logger.service';
import { TraceContext } from '../../observability/trace-context.context';
import { TelemedService } from './telemed.service';

interface StartSessionOutboxEvent {
  id: string;
  booking_hold_id: string;
  correlation_id: string | null;
  causation_id: string | null;
  traceparent: string | null;
}

@Injectable()
export class TelemedSessionStartWorker {
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly telemedService: TelemedService,
    private readonly traceContext: TraceContext,
    private readonly logger: ContextLoggerService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relayConfirmedSessions(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
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
            await this.telemedService.startSessionAfterPayment(event.booking_hold_id);
            await this.markPublished(event.id);
            this.logger.event('debug', TelemedSessionStartWorker.name, 'Telemedicine session started from outbox', {
              outboxEventId: event.id,
              bookingHoldId: event.booking_hold_id,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Telemedicine session activation failed';
            this.logger.event('error', TelemedSessionStartWorker.name, 'Telemedicine session activation failed', {
              outboxEventId: event.id,
              bookingHoldId: event.booking_hold_id,
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

  private async claimBatch(limit: number): Promise<StartSessionOutboxEvent[]> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<StartSessionOutboxEvent>(`
        WITH claimed AS (
          SELECT id
          FROM booking_schema.outbox_events
          WHERE event_type = 'telemed.session.start.requested.v1'
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
        RETURNING e.id, e.aggregate_id AS booking_hold_id, e.correlation_id, e.causation_id, e.traceparent
      `, [limit]);
      return result.rows;
    });
  }

  private async markPublished(eventId: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PUBLISHED',
          processed_at = clock_timestamp(),
          published_at = clock_timestamp(),
          lease_until = NULL,
          last_error = NULL
      WHERE id = $1::uuid AND status = 'LEASED'
    `, [eventId]);
  }

  private async releaseForRetry(eventId: string, reason: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PENDING',
          available_at = clock_timestamp() + interval '5 seconds',
          lease_until = NULL,
          last_error = $2
      WHERE id = $1::uuid AND status = 'LEASED'
    `, [eventId, reason.slice(0, 1000)]);
  }
}
