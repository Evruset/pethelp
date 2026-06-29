import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { ObservabilityMetricsService } from '../../observability/observability.metrics';
import { TraceContext } from '../../observability/trace-context.context';

export interface PaymentRefundedWebhookCommand {
  idempotencyKey: string;
  providerEventId: string;
  providerRefundId?: string;
  rawPayload: string;
  payloadSha256: string;
}

interface LockedRefundPayment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  refunded_amount: string;
  provider_payment_id: string | null;
  refund_provider_id: string | null;
}

@Injectable()
export class PaymentRefundService {
  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
    private readonly metrics: ObservabilityMetricsService,
  ) {}

  /**
   * Finalizes an already-dispatched full refund. The bank webhook is deduplicated
   * by provider_event_id and the state transition remains inside one short SQL transaction.
   */
  async handlePaymentRefunded(command: PaymentRefundedWebhookCommand): Promise<void> {
    if (!command.idempotencyKey || !command.providerEventId || !command.payloadSha256 || !command.rawPayload) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'PAYMENT_REFUND_WEBHOOK_INVALID', 'Refund webhook idempotency key, event id and payload are required');
    }

    try {
      await this.database.withTransaction(async (client) => {
        await this.setRefundTransactionLimits(client);
        const locked = await client.query<LockedRefundPayment>(`
          SELECT
            p.id,
            p.amount::text AS amount,
            p.currency,
            p.status,
            p.refunded_amount::text AS refunded_amount,
            p.provider_payment_id,
            p.refund_provider_id
          FROM payment_schema.payment_intents p
          WHERE p.idempotency_key = $1
          FOR UPDATE
        `, [command.idempotencyKey]);
        const payment = locked.rows[0];
        if (!payment) throw new DomainException(HttpStatus.NOT_FOUND, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found');

        const inbox = await client.query<{ id: string }>(`
          INSERT INTO payment_schema.provider_webhook_events (
            provider_event_id, payment_intent_id, event_type,
            signature_valid, payload_sha256, raw_payload, processing_status
          ) VALUES ($1, $2::uuid, 'payment.refunded', true, $3, $4, 'PROCESSED')
          ON CONFLICT (provider_event_id) DO NOTHING
          RETURNING id
        `, [command.providerEventId, payment.id, command.payloadSha256, command.rawPayload]);

        if (!inbox.rows[0] || payment.status === 'REFUNDED') return;
        if (payment.status !== 'REFUND_SENT') {
          throw new DomainException(HttpStatus.CONFLICT, 'PAYMENT_REFUND_NOT_PENDING', `Payment ${payment.id} is not awaiting refund confirmation`);
        }

        await client.query(`
          UPDATE payment_schema.payment_intents
          SET status = 'REFUNDED',
              refunded_amount = amount,
              refund_provider_id = COALESCE($2, refund_provider_id),
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
            AND status = 'REFUND_SENT'
        `, [payment.id, command.providerRefundId ?? null]);

        await this.writeLedger(client, {
          paymentIntentId: payment.id,
          entryType: 'REFUND_CONFIRMED',
          amount: payment.amount,
          currency: payment.currency,
          idempotencyKey: `refund-confirmed:${payment.id}`,
          providerEventId: command.providerEventId,
          payload: {
            providerRefundId: command.providerRefundId ?? payment.refund_provider_id,
            refundedAmount: payment.amount,
          },
        });
        await this.writeAudit(client, payment, command.providerEventId, command.providerRefundId ?? payment.refund_provider_id);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Refund webhook processing failed';
      this.metrics.critical('REFUND_FAILED', PaymentRefundService.name, 'Refund confirmation processing failed', {
        providerEventId: command.providerEventId,
        idempotencyKey: command.idempotencyKey,
        error: message,
      });
      throw error;
    }
  }

  private async writeLedger(client: PoolClient, input: {
    paymentIntentId: string;
    entryType: 'REFUND_CONFIRMED';
    amount: string;
    currency: string;
    idempotencyKey: string;
    providerEventId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await client.query(`
      INSERT INTO payment_schema.ledger_entries (
        payment_intent_id, entry_type, amount, currency, correlation_id,
        idempotency_key, provider_event_id, payload_json
      ) VALUES ($1::uuid, $2, $3::numeric, $4, $5::uuid, $6, $7, $8::jsonb)
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [
      input.paymentIntentId,
      input.entryType,
      input.amount,
      input.currency,
      this.traceContext.getCorrelationId() ?? null,
      input.idempotencyKey,
      input.providerEventId,
      JSON.stringify({ ...input.payload, correlationId: this.traceContext.getCorrelationId() ?? null }),
    ]);
  }

  private async writeAudit(
    client: PoolClient,
    payment: LockedRefundPayment,
    providerEventId: string,
    providerRefundId: string | null,
  ): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (
        actor_type, actor_id, action, aggregate_type, aggregate_id,
        correlation_id, causation_id, traceparent, payload_json
      ) VALUES (
        'SYSTEM', NULL, 'payment.refunded', 'payment_intent', $1::uuid,
        $2::uuid, $3::uuid, $4, $5::jsonb
      )
    `, [
      payment.id,
      this.traceContext.getCorrelationId() ?? null,
      this.traceContext.getCausationId() ?? null,
      this.traceContext.getTraceparent() ?? null,
      JSON.stringify({
        providerEventId,
        providerRefundId,
        amount: payment.amount,
        currency: payment.currency,
      }),
    ]);
  }

  private async setRefundTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }
}
