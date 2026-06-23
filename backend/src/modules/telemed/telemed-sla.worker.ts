import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';

interface ExpiredTelemedSession {
  id: string;
  booking_hold_id: string;
}

interface PaymentForVoid {
  id: string;
  amount: string;
  currency: string;
  status: string;
}

@Injectable()
export class TelemedSlaWorker {
  private readonly logger = new Logger(TelemedSlaWorker.name);
  private running = false;

  constructor(private readonly database: DatabaseService) {}

  @Cron('*/10 * * * * *')
  async enforceExpiredSessions(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;
    try {
      for (let index = 0; index < 10; index += 1) {
        const processed = await this.processOneExpiredSession();
        if (!processed) break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Telemedicine SLA worker failed';
      this.logger.error(message);
    } finally {
      this.running = false;
    }
  }

  private async processOneExpiredSession(): Promise<boolean> {
    return this.database.withTransaction(async (client) => {
      await this.setFinancialTransactionLimits(client);

      const expired = await client.query<ExpiredTelemedSession>(`
        SELECT id, booking_hold_id
        FROM telemed_schema.telemed_sessions
        WHERE state = 'WAITING_FOR_DOCTOR'
          AND expires_at < clock_timestamp()
        ORDER BY expires_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);

      const session = expired.rows[0];
      if (!session) return false;

      const timedOut = await client.query<{ id: string }>(`
        UPDATE telemed_schema.telemed_sessions
        SET state = 'DOCTOR_TIMEOUT',
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state = 'WAITING_FOR_DOCTOR'
          AND expires_at < clock_timestamp()
        RETURNING id
      `, [session.id]);
      if (!timedOut.rows[0]) return false;

      await client.query(`
        INSERT INTO audit_schema.audit_log (
          actor_type, actor_id, action, aggregate_type, aggregate_id, payload_json
        ) VALUES (
          'SYSTEM', NULL, 'TELEMED_DOCTOR_TIMEOUT', 'telemed_session', $1::uuid,
          jsonb_build_object('bookingHoldId', $2::uuid)
        )
      `, [session.id, session.booking_hold_id]);

      const payment = await client.query<PaymentForVoid>(`
        SELECT id, amount::text AS amount, currency, status
        FROM payment_schema.payment_intents
        WHERE hold_id = $1::uuid
          AND status IN ('CREATED', 'AUTHORIZED', 'CAPTURED')
        ORDER BY created_at DESC
        FOR UPDATE
        LIMIT 1
      `, [session.booking_hold_id]);
      const paymentRow = payment.rows[0];
      if (!paymentRow) return true;

      await client.query(`
        UPDATE payment_schema.payment_intents
        SET status = 'VOID_REQUESTED',
            void_requested_at = COALESCE(void_requested_at, clock_timestamp()),
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
      `, [paymentRow.id]);

      await client.query(`
        INSERT INTO payment_schema.ledger_entries (
          payment_intent_id, entry_type, amount, currency,
          idempotency_key, payload_json
        ) VALUES (
          $1::uuid,
          'SLA_BREACH_AUTOMATIC_VOID',
          $2::numeric,
          $3,
          $4,
          jsonb_build_object('telemedSessionId', $5::uuid, 'reason', 'DOCTOR_TIMEOUT')
        )
        ON CONFLICT (idempotency_key) DO NOTHING
      `, [
        paymentRow.id,
        paymentRow.amount,
        paymentRow.currency,
        `telemed-sla-void:${session.id}`,
        session.id,
      ]);

      await client.query(`
        INSERT INTO booking_schema.outbox_events (
          event_type, aggregate_type, aggregate_id,
          aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'payment.acquiring.void.requested.v1',
          'payment_intent',
          $1::uuid,
          1,
          jsonb_build_object('paymentIntentId', $1::uuid, 'source', 'telemed_sla', 'telemedSessionId', $2::uuid),
          $3
        )
        ON CONFLICT (deduplication_key) DO NOTHING
      `, [paymentRow.id, session.id, `payment.acquiring.void.requested.v1:${paymentRow.id}`]);

      return true;
    });
  }

  private async setFinancialTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }
}
