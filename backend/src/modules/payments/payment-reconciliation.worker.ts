import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AcquiringClient } from './acquiring-client.service';

interface ReconciliationCandidate {
  id: string;
  provider_payment_id: string;
  kind: 'VOID' | 'CAPTURE';
}

@Injectable()
export class PaymentReconciliationWorker {
  private readonly logger = new Logger(PaymentReconciliationWorker.name);
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly acquiringClient: AcquiringClient,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcile(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;

    try {
      const candidates = await this.claimCandidates(10);
      for (const candidate of candidates) {
        try {
          const providerState = await this.acquiringClient.getRemoteIntentState(candidate.provider_payment_id);
          if (candidate.kind === 'VOID' && providerState === 'VOIDED') {
            await this.markVoidConfirmed(candidate.id);
          }
          if (candidate.kind === 'CAPTURE' && providerState === 'CAPTURED') {
            await this.markCaptureConfirmed(candidate.id);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Acquiring reconciliation failed';
          this.logger.error(`Payment reconciliation ${candidate.id} failed: ${message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async claimCandidates(limit: number): Promise<ReconciliationCandidate[]> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<ReconciliationCandidate>(`
        WITH candidates AS (
          SELECT id
          FROM payment_schema.payment_intents
          WHERE provider_payment_id IS NOT NULL
            AND (
              (status = 'VOIDED' AND void_sent_at IS NOT NULL AND void_confirmed_at IS NULL)
              OR
              (status = 'AUTHORIZED' AND capture_sent_at IS NOT NULL AND capture_confirmed_at IS NULL)
            )
            AND (last_reconciled_at IS NULL OR last_reconciled_at < clock_timestamp() - interval '30 seconds')
          ORDER BY COALESCE(capture_sent_at, void_sent_at), id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE payment_schema.payment_intents p
        SET last_reconciled_at = clock_timestamp(),
            updated_at = clock_timestamp()
        FROM candidates
        WHERE p.id = candidates.id
        RETURNING p.id,
                  p.provider_payment_id,
                  CASE WHEN p.status = 'VOIDED' THEN 'VOID' ELSE 'CAPTURE' END AS kind
      `, [limit]);
      return result.rows;
    });
  }

  private async markVoidConfirmed(paymentIntentId: string): Promise<void> {
    await this.confirm(paymentIntentId, 'VOID_CONFIRMED');
  }

  private async markCaptureConfirmed(paymentIntentId: string): Promise<void> {
    await this.confirm(paymentIntentId, 'CAPTURE_CONFIRMED');
  }

  private async confirm(paymentIntentId: string, entryType: 'VOID_CONFIRMED' | 'CAPTURE_CONFIRMED'): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await this.setCommitTransactionLimits(client);
      const payment = await client.query<{ amount: string; currency: string }>(`
        SELECT amount::text AS amount, currency
        FROM payment_schema.payment_intents
        WHERE id = $1::uuid
        FOR UPDATE
      `, [paymentIntentId]);
      if (!payment.rows[0]) return;

      if (entryType === 'VOID_CONFIRMED') {
        await client.query(`
          UPDATE payment_schema.payment_intents
          SET void_confirmed_at = COALESCE(void_confirmed_at, clock_timestamp()),
              updated_at = clock_timestamp()
          WHERE id = $1::uuid AND status = 'VOIDED'
        `, [paymentIntentId]);
      } else {
        await client.query(`
          UPDATE payment_schema.payment_intents
          SET status = 'CAPTURED',
              capture_confirmed_at = COALESCE(capture_confirmed_at, clock_timestamp()),
              updated_at = clock_timestamp()
          WHERE id = $1::uuid AND status = 'AUTHORIZED'
        `, [paymentIntentId]);
      }

      await client.query(`
        INSERT INTO payment_schema.ledger_entries (
          payment_intent_id, entry_type, amount, currency,
          idempotency_key, payload_json
        ) VALUES ($1::uuid, $2, $3::numeric, $4, $5, '{}'::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING
      `, [
        paymentIntentId,
        entryType,
        payment.rows[0].amount,
        payment.rows[0].currency,
        `${entryType.toLowerCase()}:${paymentIntentId}`,
      ]);
    });
  }

  private async setCommitTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }
}
