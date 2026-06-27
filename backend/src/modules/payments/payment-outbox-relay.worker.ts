import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { ContextLoggerService } from '../../observability/context-logger.service';
import { ObservabilityMetricsService } from '../../observability/observability.metrics';
import { TraceContext } from '../../observability/trace-context.context';
import { AcquiringClient } from './acquiring-client.service';

type PaymentProviderEventType =
  | 'payment.acquiring.void.requested.v1'
  | 'payment.acquiring.capture.requested.v1'
  | 'payment.acquiring.refund.requested.v1';

interface PaymentOutboxEvent {
  id: string;
  event_type: PaymentProviderEventType;
  payment_intent_id: string;
  correlation_id: string | null;
  payload_json: { amount?: number | string };
}

interface PaymentRow {
  source: 'booking' | 'telemed';
  provider_payment_id: string | null;
  amount: string;
  currency: string;
  status: string;
}

@Injectable()
export class PaymentOutboxRelayWorker {
  private running = false;
  private readonly traceContext: TraceContext;
  private readonly logger: ContextLoggerService;
  private readonly metrics: ObservabilityMetricsService;

  constructor(
    private readonly database: DatabaseService,
    private readonly acquiringClient: AcquiringClient,
    traceContext?: TraceContext,
    logger?: ContextLoggerService,
    metrics?: ObservabilityMetricsService,
  ) {
    this.traceContext = traceContext ?? new TraceContext();
    this.logger = logger ?? new ContextLoggerService(this.traceContext);
    this.metrics = metrics ?? new ObservabilityMetricsService(this.logger);
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relay(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;
    try {
      const events = await this.claimBatch(10);
      for (const event of events) {
        await this.traceContext.run(this.traceContext.workerContext(event.correlation_id), async () => {
          try {
            const payment = await this.loadPayment(event.payment_intent_id);
            if (!payment?.provider_payment_id) throw new Error('Payment provider reference is missing');

            if (event.event_type === 'payment.acquiring.void.requested.v1') {
              await this.acquiringClient.voidRemoteIntent(payment.provider_payment_id, event.payment_intent_id);
              await this.markProviderCommandSent(event, payment, 'VOID_SENT');
            } else if (event.event_type === 'payment.acquiring.refund.requested.v1') {
              if (
                (payment.source === 'booking' && payment.status !== 'REFUND_SENT')
                || (payment.source === 'telemed' && payment.status !== 'REFUND_PENDING')
              ) {
                await this.markSkipped(event.id, `Refund skipped because payment status is ${payment.status}`);
                return;
              }
              const refund = await this.acquiringClient.refundRemoteIntent(
                payment.provider_payment_id,
                Number(event.payload_json.amount ?? payment.amount),
                event.payment_intent_id,
              );
              await this.markRefundDispatched(event, payment, refund.refundId);
            } else if (payment.source === 'booking' && payment.status === 'AUTHORIZED') {
              const captured = await this.acquiringClient.captureRemoteIntent(payment.provider_payment_id, event.payment_intent_id);
              if (!captured) throw new Error('Acquiring provider did not confirm capture request');
              await this.markProviderCommandSent(event, payment, 'CAPTURE_SENT');
            } else {
              await this.markSkipped(event.id, `Capture skipped because payment status is ${payment.status}`);
            }

            this.logger.event('debug', PaymentOutboxRelayWorker.name, 'Payment provider outbox event processed', {
              outboxEventId: event.id,
              paymentIntentId: event.payment_intent_id,
              eventType: event.event_type,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Payment provider command failed';
            this.logger.event('error', PaymentOutboxRelayWorker.name, 'Payment provider outbox event failed', {
              outboxEventId: event.id,
              paymentIntentId: event.payment_intent_id,
              eventType: event.event_type,
              error: message,
            });
            if (event.event_type === 'payment.acquiring.refund.requested.v1') {
              this.metrics.critical('REFUND_FAILED', PaymentOutboxRelayWorker.name, 'Acquiring refund dispatch failed', {
                outboxEventId: event.id,
                paymentIntentId: event.payment_intent_id,
                error: message,
              });
            }
            await this.releaseForRetry(event.id, message);
          }
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(limit: number): Promise<PaymentOutboxEvent[]> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<PaymentOutboxEvent>(`
        WITH claimed AS (
          SELECT id
          FROM booking_schema.outbox_events
          WHERE event_type IN (
              'payment.acquiring.void.requested.v1',
              'payment.acquiring.capture.requested.v1',
              'payment.acquiring.refund.requested.v1'
            )
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
        RETURNING e.id, e.event_type, e.aggregate_id AS payment_intent_id, e.correlation_id, e.payload_json
      `, [limit]);
      return result.rows;
    });
  }

  private async loadPayment(paymentIntentId: string): Promise<PaymentRow | undefined> {
    const result = await this.database.query<PaymentRow>(`
      SELECT 'booking'::text AS source, provider_payment_id, amount::text AS amount, currency, status
      FROM payment_schema.payment_intents
      WHERE id = $1::uuid
      UNION ALL
      SELECT 'telemed'::text AS source, provider_payment_id, amount::text AS amount, currency, status
      FROM telemed_schema.telemed_payment_intents
      WHERE id = $1::uuid
      LIMIT 1
    `, [paymentIntentId]);
    return result.rows[0];
  }

  private async markRefundDispatched(event: PaymentOutboxEvent, payment: PaymentRow, refundProviderId: string): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await this.setCommitTransactionLimits(client);
      if (payment.source === 'telemed') {
        await client.query(`
          UPDATE telemed_schema.telemed_payment_intents
          SET status = 'REFUNDED',
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
            AND status = 'REFUND_PENDING'
        `, [event.payment_intent_id]);
      } else {
        await client.query(`
          UPDATE payment_schema.payment_intents
          SET refund_provider_id = COALESCE(refund_provider_id, $2), updated_at = clock_timestamp()
          WHERE id = $1::uuid AND status = 'REFUND_SENT'
        `, [event.payment_intent_id, refundProviderId]);
      }
      await this.writeLedger(client, event, payment, 'REFUND_DISPATCHED', `refund-dispatched:${event.payment_intent_id}`, {
        refundProviderId,
      });
      await this.markPublished(client, event.id);
    });
  }

  private async markProviderCommandSent(
    event: PaymentOutboxEvent,
    payment: PaymentRow,
    ledgerEntry: 'VOID_SENT' | 'CAPTURE_SENT',
  ): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await this.setCommitTransactionLimits(client);
      if (payment.source === 'telemed') {
        if (ledgerEntry === 'VOID_SENT') {
          await client.query(`
            UPDATE telemed_schema.telemed_payment_intents
            SET status = 'VOIDED',
                updated_at = clock_timestamp()
            WHERE id = $1::uuid
              AND status = 'VOID_REQUESTED'
          `, [event.payment_intent_id]);
        }
      } else {
        const timestampColumn = ledgerEntry === 'VOID_SENT' ? 'void_sent_at' : 'capture_sent_at';
        const statusClause = ledgerEntry === 'VOID_SENT'
          ? ", status = CASE WHEN status = 'VOID_REQUESTED' THEN 'VOIDED' ELSE status END"
          : '';
        await client.query(`
          UPDATE payment_schema.payment_intents
          SET ${timestampColumn} = COALESCE(${timestampColumn}, clock_timestamp())${statusClause}, updated_at = clock_timestamp()
          WHERE id = $1::uuid
        `, [event.payment_intent_id]);
      }
      await this.writeLedger(client, event, payment, ledgerEntry, `${ledgerEntry.toLowerCase()}:${event.payment_intent_id}`, {});
      await this.markPublished(client, event.id);
    });
  }

  private async writeLedger(
    client: PoolClient,
    event: PaymentOutboxEvent,
    payment: PaymentRow,
    entryType: 'VOID_SENT' | 'CAPTURE_SENT' | 'REFUND_DISPATCHED',
    idempotencyKey: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (payment.source === 'telemed') {
      await client.query(`
        INSERT INTO telemed_schema.telemed_payment_events (
          payment_intent_id, event_type, provider_event_id, idempotency_key, payload_json
        ) VALUES ($1::uuid, $2, NULL, $3, $4::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING
      `, [
        event.payment_intent_id,
        entryType,
        idempotencyKey,
        JSON.stringify({ outboxEventId: event.id, eventType: event.event_type, ...payload }),
      ]);
      return;
    }

    await client.query(`
      INSERT INTO payment_schema.ledger_entries (
        payment_intent_id, entry_type, amount, currency, correlation_id,
        idempotency_key, payload_json
      ) VALUES ($1::uuid, $2, $3::numeric, $4, $5::uuid, $6, $7::jsonb)
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [
      event.payment_intent_id,
      entryType,
      payment.amount,
      payment.currency,
      this.traceContext.getCorrelationId() ?? null,
      idempotencyKey,
      JSON.stringify({ outboxEventId: event.id, eventType: event.event_type, ...payload }),
    ]);
  }

  private async markPublished(client: PoolClient, eventId: string): Promise<void> {
    await client.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PUBLISHED', processed_at = clock_timestamp(), published_at = clock_timestamp(), lease_until = NULL, last_error = NULL
      WHERE id = $1::uuid AND status = 'LEASED'
    `, [eventId]);
  }

  private async markSkipped(eventId: string, reason: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PUBLISHED', processed_at = clock_timestamp(), published_at = clock_timestamp(), lease_until = NULL, last_error = $2
      WHERE id = $1::uuid AND status = 'LEASED'
    `, [eventId, reason.slice(0, 1000)]);
  }

  private async releaseForRetry(eventId: string, reason: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PENDING', available_at = clock_timestamp() + interval '5 seconds', lease_until = NULL, last_error = $2
      WHERE id = $1::uuid
        AND event_type IN (
          'payment.acquiring.void.requested.v1',
          'payment.acquiring.capture.requested.v1',
          'payment.acquiring.refund.requested.v1'
        )
        AND status = 'LEASED'
    `, [eventId, reason.slice(0, 1000)]);
  }

  private async setCommitTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }
}
