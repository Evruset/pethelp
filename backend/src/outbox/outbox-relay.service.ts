import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { config } from '../config';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly outbox: OutboxService) {}

  onModuleInit(): void {
    if (!config.workersEnabled) return;
    this.timer = setInterval(() => void this.poll(), config.outboxPollIntervalMs);
    this.timer.unref();
    void this.poll();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.outbox.claimBatch(config.outboxBatchSize);
      for (const event of events) {
        try {
          await this.publish(event);
          await this.outbox.markPublished(event.id, event.lease_token);
        } catch (error) {
          const retry = await this.outbox.releaseForRetry(event.id, event.lease_token, 'outbox delivery failed');
          if (retry?.terminal) {
            this.logger.error(JSON.stringify({
              outbox: 'terminal_failure',
              eventType: event.event_type,
              eventId: event.id,
              correlationId: event.correlation_id,
              attempts: retry.attempts,
            }));
          }
        }
      }
    } catch (error) {
      this.logger.error('Outbox relay poll failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  private async publish(event: { event_type: string; id: string; correlation_id: string | null }): Promise<void> {
    this.logger.log(JSON.stringify({
      outbox: 'published',
      eventType: event.event_type,
      eventId: event.id,
      correlationId: event.correlation_id,
    }));
  }
}
