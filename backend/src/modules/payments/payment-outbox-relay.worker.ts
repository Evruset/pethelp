import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AcquiringApi } from './acquiring-api';

interface VoidOutboxEvent {
  id: string;
  payment_intent_id: string;
}

@Injectable()
export class PaymentOutboxRelayWorker {
  private readonly logger = new Logger(PaymentOutboxRelayWorker.name);
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly acquiringApi: AcquiringApi,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relay(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;

    try {
      const events = await this.claimBatch(10);
      for (const event of events) {
        try {
          await this.acquiringApi.void(event.payment_intent_id, event.id);
          await this.markSent(event);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Acquiring void command failed';
          this.logger.error(`Payment void outbox event ${event.id} failed: ${message}`);
          await this.releaseForRetry(event.id, message);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(limit: number): Promise<VoidOutboxEvent[]> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<VoidOutboxEvent>(`
        WITH claimed AS (
          SELECT id
          FROM booking_schema.outbox_events
          WHERE event_type = 'payment.acquiring.void.requested.v1'
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
        RETURNING e.id, e.aggregate_id AS payment_intent_id
      `, [limit]);
      return result.rows;
    });
  }

  private async markSent(event: VoidOutboxEvent): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await this.setCommitTransactionLimits(client);
      const payment = await client.query<{ amount: string; currency: string }>(`
        SELECT amount::text AS amount, currency
        FROM payment_schema.payment_intents
        WHERE id = $1::uuid
        FOR UPDATE
      `, [event.payment_intent_id]);
      if (!payment.rows[0]) return;

      await client.query(`
        UPDATE payment_schema.payment_intents
        SET void_sent_at = COALESCE(void_sent_at, clock_timestamp()),
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
      `, [event.payment_intent_id]);
      await client.query(`
        INSERT INTO payment_schema.ledger_entries (
          payment_intent_id, entry_type, amount, currency,
          idempotency_key, payload_json
        ) VALUES ($1::uuid, 'VOID_SENT', $2::numeric, $3, $4, $5::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING
      `, [
        event.payment_intent_id,
        payment.rows[0].amount,
        payment.rows[0].currency,
        `void-sent:${event.payment_intent_id}`,
        JSON.stringify({ outboxEventId: event.id }),
      ]);
      await client.query(`
        UPDATE booking_schema.outbox_events
        SET status = 'PUBLISHED',
            processed_at = clock_timestamp(),
            published_at = clock_timestamp(),
            lease_until = NULL,
            last_error = NULL
        WHERE id = $1::uuid AND status = 'LEASED'
      `, [event.id]);
    });
  }

  private async releaseForRetry(eventId: string, reason: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PENDING',
          available_at = clock_timestamp() + interval '5 seconds',
          lease_until = NULL,
          last_error = $2
      WHERE id = $1::uuid
        AND event_type = 'payment.acquiring.void.requested.v1'
        AND status = 'LEASED'
    `, [eventId, reason.slice(0, 1000)]);
  }

  private async setCommitTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }
}
