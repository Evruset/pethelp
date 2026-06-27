import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { ContextLoggerService } from '../../observability/context-logger.service';
import { ObservabilityMetricsService } from '../../observability/observability.metrics';
import { TraceContext } from '../../observability/trace-context.context';

interface ExpiredTelemedSession {
  id: string;
  booking_hold_id: string | null;
  telemed_case_id: string | null;
  correlation_id: string | null;
}

interface PaymentForRemedy {
  id: string;
  amount: string;
  currency: string;
  status: 'CREATED' | 'AUTHORIZED' | 'CAPTURED';
}

interface TelemedPaymentForRemedy {
  id: string;
  amount: string;
  currency: string;
  status: 'CREATED' | 'AUTHORIZED' | 'VOID_REQUESTED' | 'REFUND_PENDING';
}

@Injectable()
export class TelemedSlaWorker {
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
    private readonly logger: ContextLoggerService,
    private readonly metrics: ObservabilityMetricsService,
  ) {}

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
      this.logger.event('error', TelemedSlaWorker.name, 'Telemedicine SLA worker failed', { error: message });
      this.metrics.critical('SLA_AUTO_VOID_FAILED', TelemedSlaWorker.name, 'Telemedicine SLA enforcement failed', { error: message });
    } finally {
      this.running = false;
    }
  }

  private async processOneExpiredSession(): Promise<boolean> {
    return this.database.withTransaction(async (client) => {
      await this.setFinancialTransactionLimits(client);
      const expired = await client.query<ExpiredTelemedSession>(`
        SELECT id, booking_hold_id, telemed_case_id, correlation_id
        FROM telemed_schema.telemed_sessions
        WHERE state = 'WAITING_FOR_DOCTOR'
          AND expires_at < clock_timestamp()
        ORDER BY expires_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
      const session = expired.rows[0];
      if (!session) return false;

      return this.traceContext.run(this.traceContext.workerContext(session.correlation_id), async () => {
        const timedOut = await client.query<{ id: string }>(`
          UPDATE telemed_schema.telemed_sessions
          SET state = 'DOCTOR_TIMEOUT', version = version + 1, updated_at = clock_timestamp()
          WHERE id = $1::uuid AND state = 'WAITING_FOR_DOCTOR' AND expires_at < clock_timestamp()
          RETURNING id
        `, [session.id]);
        if (!timedOut.rows[0]) return false;

        const correlationId = this.traceContext.getCorrelationId() ?? null;
        await client.query(`
          INSERT INTO audit_schema.audit_log (
            actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json
          ) VALUES (
            'SYSTEM', NULL, 'TELEMED_DOCTOR_TIMEOUT', 'telemed_session', $1::uuid, $2::uuid,
            jsonb_build_object('bookingHoldId', $3::uuid, 'telemedCaseId', $4::uuid)
          )
        `, [session.id, correlationId, session.booking_hold_id, session.telemed_case_id]);

        if (session.telemed_case_id) {
          await this.queueTelemedCaseRemedy(client, session, correlationId);
          return true;
        }

        if (!session.booking_hold_id) return true;

        const payment = await client.query<PaymentForRemedy>(`
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

        if (paymentRow.status === 'CAPTURED') {
          await this.queueCapturedPaymentRefund(client, session, paymentRow, correlationId);
          this.logger.event('warn', TelemedSlaWorker.name, 'Doctor SLA timeout queued captured-payment refund', {
            telemedSessionId: session.id,
            paymentIntentId: paymentRow.id,
          });
          return true;
        }

        await this.queueAuthorizationVoid(client, session, paymentRow, correlationId);
        this.logger.event('warn', TelemedSlaWorker.name, 'Doctor SLA timeout queued authorization void', {
          telemedSessionId: session.id,
          paymentIntentId: paymentRow.id,
        });
        return true;
      });
    });
  }

  private async queueTelemedCaseRemedy(
    client: PoolClient,
    session: ExpiredTelemedSession,
    correlationId: string | null,
  ): Promise<void> {
    await client.query(`
      UPDATE telemed_schema.telemed_cases
      SET state = 'EXPIRED_NO_DOCTOR',
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND state IN ('ASSIGNED', 'DOCTOR_JOINED')
    `, [session.telemed_case_id]);
    await client.query(`
      INSERT INTO telemed_schema.telemed_case_events (case_id, actor_type, actor_id, event_type, payload_json)
      VALUES (
        $1::uuid,
        'SYSTEM',
        NULL,
        'DOCTOR_TIMEOUT',
        jsonb_build_object('telemedSessionId', $2::uuid, 'reason', 'DOCTOR_TIMEOUT')
      )
    `, [session.telemed_case_id, session.id]);

    const payment = await client.query<TelemedPaymentForRemedy>(`
      SELECT id, amount::text AS amount, currency, status
      FROM telemed_schema.telemed_payment_intents
      WHERE case_id = $1::uuid
        AND status IN ('CREATED', 'AUTHORIZED', 'VOID_REQUESTED', 'REFUND_PENDING')
      FOR UPDATE
      LIMIT 1
    `, [session.telemed_case_id]);
    const paymentRow = payment.rows[0];
    if (!paymentRow) return;

    if (paymentRow.status === 'VOID_REQUESTED' || paymentRow.status === 'REFUND_PENDING') return;

    await client.query(`
      UPDATE telemed_schema.telemed_payment_intents
      SET status = 'VOID_REQUESTED',
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND status IN ('CREATED', 'AUTHORIZED')
    `, [paymentRow.id]);
    await this.writeTelemedPaymentEvent(client, paymentRow.id, 'VOID_REQUESTED', `telemed-sla-void-requested:${session.id}`, {
      telemedCaseId: session.telemed_case_id,
      telemedSessionId: session.id,
      reason: 'DOCTOR_TIMEOUT',
      correlationId,
    });
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, aggregate_type, aggregate_id,
        aggregate_version, payload_json, deduplication_key
      ) VALUES (
        'payment.acquiring.void.requested.v1', $1::uuid, 'telemed_payment_intent', $2::uuid,
        1,
        jsonb_build_object(
          'paymentIntentId', $2::uuid,
          'telemedCaseId', $3::uuid,
          'source', 'telemed_sla',
          'telemedSessionId', $4::uuid
        ),
        $5
      ) ON CONFLICT (deduplication_key) DO NOTHING
    `, [
      correlationId,
      paymentRow.id,
      session.telemed_case_id,
      session.id,
      `payment.acquiring.telemed.void.requested.v1:${paymentRow.id}`,
    ]);
    this.logger.event('warn', TelemedSlaWorker.name, 'Doctor SLA timeout queued telemedicine authorization void', {
      telemedSessionId: session.id,
      telemedCaseId: session.telemed_case_id,
      paymentIntentId: paymentRow.id,
    });
  }

  private async queueCapturedPaymentRefund(
    client: PoolClient,
    session: ExpiredTelemedSession,
    payment: PaymentForRemedy,
    correlationId: string | null,
  ): Promise<void> {
    await client.query(`
      UPDATE payment_schema.payment_intents
      SET status = 'REFUND_SENT', updated_at = clock_timestamp()
      WHERE id = $1::uuid AND status = 'CAPTURED'
    `, [payment.id]);
    await client.query(`
      INSERT INTO payment_schema.ledger_entries (
        payment_intent_id, entry_type, amount, currency, correlation_id,
        idempotency_key, payload_json
      ) VALUES (
        $1::uuid, 'REFUND_REQUESTED', $2::numeric, $3, $4::uuid,
        $5, jsonb_build_object('telemedSessionId', $6::uuid, 'reason', 'DOCTOR_TIMEOUT', 'correlationId', $4::uuid)
      ) ON CONFLICT (idempotency_key) DO NOTHING
    `, [payment.id, payment.amount, payment.currency, correlationId, `refund-requested:${payment.id}`, session.id]);
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, aggregate_type, aggregate_id,
        aggregate_version, payload_json, deduplication_key
      ) VALUES (
        'payment.acquiring.refund.requested.v1', $1::uuid, 'payment_intent', $2::uuid,
        1, jsonb_build_object('paymentIntentId', $2::uuid, 'amount', $3::numeric, 'source', 'telemed_sla', 'telemedSessionId', $4::uuid),
        $5
      ) ON CONFLICT (deduplication_key) DO NOTHING
    `, [correlationId, payment.id, payment.amount, session.id, `payment.acquiring.refund.requested.v1:${payment.id}`]);
  }

  private async queueAuthorizationVoid(
    client: PoolClient,
    session: ExpiredTelemedSession,
    payment: PaymentForRemedy,
    correlationId: string | null,
  ): Promise<void> {
    await client.query(`
      UPDATE payment_schema.payment_intents
      SET status = 'VOID_REQUESTED', void_requested_at = COALESCE(void_requested_at, clock_timestamp()), updated_at = clock_timestamp()
      WHERE id = $1::uuid
    `, [payment.id]);
    await client.query(`
      INSERT INTO payment_schema.ledger_entries (
        payment_intent_id, entry_type, amount, currency, correlation_id,
        idempotency_key, payload_json
      ) VALUES (
        $1::uuid, 'SLA_BREACH_AUTOMATIC_VOID', $2::numeric, $3, $4::uuid,
        $5, jsonb_build_object('telemedSessionId', $6::uuid, 'reason', 'DOCTOR_TIMEOUT', 'correlationId', $4::uuid)
      ) ON CONFLICT (idempotency_key) DO NOTHING
    `, [payment.id, payment.amount, payment.currency, correlationId, `telemed-sla-void:${session.id}`, session.id]);
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, aggregate_type, aggregate_id,
        aggregate_version, payload_json, deduplication_key
      ) VALUES (
        'payment.acquiring.void.requested.v1', $1::uuid, 'payment_intent', $2::uuid,
        1, jsonb_build_object('paymentIntentId', $2::uuid, 'source', 'telemed_sla', 'telemedSessionId', $3::uuid),
        $4
      ) ON CONFLICT (deduplication_key) DO NOTHING
    `, [correlationId, payment.id, session.id, `payment.acquiring.void.requested.v1:${payment.id}`]);
  }

  private async setFinancialTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }

  private async writeTelemedPaymentEvent(
    client: PoolClient,
    paymentIntentId: string,
    eventType: 'VOID_REQUESTED',
    idempotencyKey: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(`
      INSERT INTO telemed_schema.telemed_payment_events (
        payment_intent_id, event_type, provider_event_id, idempotency_key, payload_json
      ) VALUES ($1::uuid, $2, NULL, $3, $4::jsonb)
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [paymentIntentId, eventType, idempotencyKey, JSON.stringify(payload)]);
  }
}
