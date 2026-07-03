import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { ContextLoggerService } from '../../observability/context-logger.service';
import { TraceContext } from '../../observability/trace-context.context';
import { InsuranceService } from './insurance.service';

interface CoverageOutboxEvent {
  id: string;
  coverage_check_id: string;
  correlation_id: string | null;
  causation_id: string | null;
  traceparent: string | null;
}

@Injectable()
export class InsuranceCoverageWorker {
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly insuranceService: InsuranceService,
    private readonly traceContext: TraceContext,
    private readonly logger: ContextLoggerService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relayCoverageRequests(): Promise<void> {
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
            const view = await this.insuranceService.processCoverageRequest(event.coverage_check_id);
            await this.markPublished(event.id);
            this.logger.event('debug', InsuranceCoverageWorker.name, 'Insurance coverage request processed', {
              outboxEventId: event.id,
              coverageCheckId: event.coverage_check_id,
              state: view.state,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Insurance coverage processing failed';
            this.logger.event('error', InsuranceCoverageWorker.name, 'Insurance coverage request failed', {
              outboxEventId: event.id,
              coverageCheckId: event.coverage_check_id,
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

  private async claimBatch(limit: number): Promise<CoverageOutboxEvent[]> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<CoverageOutboxEvent>(`
        WITH claimed AS (
          SELECT id
          FROM booking_schema.outbox_events
          WHERE event_type = 'insurance.coverage.requested.v1'
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
        RETURNING e.id, e.aggregate_id AS coverage_check_id, e.correlation_id, e.causation_id, e.traceparent
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
      WHERE id = $1::uuid
        AND event_type = 'insurance.coverage.requested.v1'
        AND status = 'LEASED'
    `, [eventId]);
  }

  private async releaseForRetry(eventId: string, reason: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PENDING',
          available_at = clock_timestamp() + interval '10 seconds',
          lease_until = NULL,
          last_error = $2
      WHERE id = $1::uuid
        AND event_type = 'insurance.coverage.requested.v1'
        AND status = 'LEASED'
    `, [eventId, reason.slice(0, 1000)]);
  }
}
