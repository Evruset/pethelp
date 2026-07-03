import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TraceContext } from '../../observability/trace-context.context';
import { TelemedSessionState } from './telemed.service';

type TelemedPaymentStatus =
  | 'PENDING_PROVIDER'
  | 'CREATED'
  | 'AUTHORIZED'
  | 'FAILED'
  | 'VOID_REQUESTED'
  | 'VOIDED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

interface SessionRow {
  id: string;
  state: TelemedSessionState;
  version: number;
  owner_cancel_idempotency_key: string | null;
  telemed_case_id: string | null;
}

interface CaseRow {
  id: string;
  state: string;
}

interface PaymentRow {
  id: string;
  status: TelemedPaymentStatus;
}

export interface OwnerTelemedCancellationResult {
  sessionId: string;
  state: 'CANCELLED';
  telemedCaseState: 'CANCELLED_BY_OWNER';
  paymentStatus: TelemedPaymentStatus | null;
  refundState: 'VOID_REQUESTED' | 'VOIDED' | 'REFUND_PENDING' | 'REFUNDED' | 'NOT_REQUIRED' | null;
  version: number;
  serverNow: string;
}

@Injectable()
export class TelemedOwnerCancellationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
  ) {}

  async cancel(input: {
    sessionId: string;
    ownerId: string;
    idempotencyKey: string;
  }): Promise<OwnerTelemedCancellationResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");

      const session = await this.lockSession(client, input.sessionId, input.ownerId);
      if (!session) {
        throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_SESSION_NOT_FOUND', 'Telemedicine session not found');
      }
      if (!session.telemed_case_id) {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_OWNER_CANCEL_UNSUPPORTED', 'Only case-based telemedicine sessions can be cancelled here');
      }

      const telemedCase = await this.lockCase(client, session.telemed_case_id);
      if (!telemedCase) {
        throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_CASE_NOT_FOUND', 'Telemedicine case not found');
      }
      const payment = await this.lockLatestPayment(client, telemedCase.id);

      if (session.state === 'CANCELLED') {
        if (session.owner_cancel_idempotency_key === input.idempotencyKey) {
          return this.result(session, payment?.status ?? null);
        }
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_SESSION_ALREADY_CANCELLED', 'Telemedicine session was already cancelled');
      }
      if (session.state !== 'WAITING_FOR_DOCTOR') {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_SESSION_NOT_CANCELLABLE', 'Telemedicine session can be cancelled only before doctor connection');
      }
      if (!['QUEUED', 'ASSIGNED', 'DOCTOR_JOINED'].includes(telemedCase.state)) {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_CASE_NOT_CANCELLABLE', 'Telemedicine case cannot be cancelled in current state');
      }

      const cancelledSession = await client.query<{ version: number }>(`
        UPDATE telemed_schema.telemed_sessions
        SET state = 'CANCELLED',
            owner_cancelled_at = clock_timestamp(),
            owner_cancel_idempotency_key = $2::uuid,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state = 'WAITING_FOR_DOCTOR'
        RETURNING version
      `, [session.id, input.idempotencyKey]);
      if (!cancelledSession.rows[0]) {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_SESSION_NOT_CANCELLABLE', 'Telemedicine session changed while cancellation was being processed');
      }

      const cancelledCase = await client.query<{ id: string }>(`
        UPDATE telemed_schema.telemed_cases
        SET state = 'CANCELLED_BY_OWNER', updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state IN ('QUEUED', 'ASSIGNED', 'DOCTOR_JOINED')
        RETURNING id::text AS id
      `, [telemedCase.id]);
      if (!cancelledCase.rows[0]) {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_CASE_NOT_CANCELLABLE', 'Telemedicine case changed while cancellation was being processed');
      }

      await client.query(`
        INSERT INTO telemed_schema.telemed_case_events (
          case_id, actor_type, actor_id, event_type, payload_json
        ) VALUES (
          $1::uuid, 'OWNER', $2::uuid, 'OWNER_CANCELLED',
          jsonb_build_object('sessionId', $3::uuid, 'reason', 'OWNER_CANCELLED')
        )
      `, [telemedCase.id, input.ownerId, session.id]);

      const paymentStatus = await this.requestAuthorizationVoid(
        client,
        payment,
        telemedCase.id,
        session.id,
        input.idempotencyKey,
      );

      return this.result(
        { ...session, version: cancelledSession.rows[0].version },
        paymentStatus,
      );
    });
  }

  private async lockSession(client: PoolClient, sessionId: string, ownerId: string): Promise<SessionRow | undefined> {
    const result = await client.query<SessionRow>(`
      SELECT id::text, state, version, owner_cancel_idempotency_key::text, telemed_case_id::text
      FROM telemed_schema.telemed_sessions
      WHERE id = $1::uuid AND owner_id = $2::uuid
      FOR UPDATE
    `, [sessionId, ownerId]);
    return result.rows[0];
  }

  private async lockCase(client: PoolClient, caseId: string): Promise<CaseRow | undefined> {
    const result = await client.query<CaseRow>(`
      SELECT id::text, state
      FROM telemed_schema.telemed_cases
      WHERE id = $1::uuid
      FOR UPDATE
    `, [caseId]);
    return result.rows[0];
  }

  private async lockLatestPayment(client: PoolClient, caseId: string): Promise<PaymentRow | undefined> {
    const result = await client.query<PaymentRow>(`
      SELECT id::text, status
      FROM telemed_schema.telemed_payment_intents
      WHERE case_id = $1::uuid
      ORDER BY payment_attempt_no DESC, created_at DESC
      LIMIT 1
      FOR UPDATE
    `, [caseId]);
    return result.rows[0];
  }

  private async requestAuthorizationVoid(
    client: PoolClient,
    payment: PaymentRow | undefined,
    caseId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<TelemedPaymentStatus | null> {
    if (!payment) return null;
    if (!['CREATED', 'AUTHORIZED'].includes(payment.status)) return payment.status;

    const updated = await client.query<{ status: TelemedPaymentStatus }>(`
      UPDATE telemed_schema.telemed_payment_intents
      SET status = 'VOID_REQUESTED', updated_at = clock_timestamp()
      WHERE id = $1::uuid AND status IN ('CREATED', 'AUTHORIZED')
      RETURNING status
    `, [payment.id]);
    const status = updated.rows[0]?.status ?? payment.status;
    if (status !== 'VOID_REQUESTED') return status;

    await client.query(`
      INSERT INTO telemed_schema.telemed_payment_events (
        payment_intent_id, event_type, provider_event_id, idempotency_key, payload_json
      ) VALUES (
        $1::uuid, 'VOID_REQUESTED', NULL, $2,
        jsonb_build_object('reason', 'OWNER_CANCELLED', 'telemedCaseId', $3::uuid, 'telemedSessionId', $4::uuid)
      ) ON CONFLICT (idempotency_key) DO NOTHING
    `, [payment.id, `telemed-owner-cancel-void:${sessionId}:${idempotencyKey}`, caseId, sessionId]);

    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, causation_id, traceparent, aggregate_type,
        aggregate_id, aggregate_version, payload_json, deduplication_key
      ) VALUES (
        'payment.acquiring.void.requested.v1', $1::uuid, $2::uuid, $3,
        'telemed_payment_intent', $4::uuid,
        1,
        jsonb_build_object('paymentIntentId', $4::uuid, 'telemedCaseId', $5::uuid, 'telemedSessionId', $6::uuid, 'source', 'telemed_owner_cancel'),
        $7
      ) ON CONFLICT (deduplication_key) DO NOTHING
    `, [
      this.traceContext.getCorrelationId() ?? null,
      this.traceContext.getCausationId() ?? null,
      this.traceContext.getTraceparent() ?? null,
      payment.id,
      caseId,
      sessionId,
      `payment.acquiring.telemed.owner-cancel.void.requested.v1:${payment.id}`,
    ]);

    return status;
  }

  private result(session: Pick<SessionRow, 'id' | 'version'>, paymentStatus: TelemedPaymentStatus | null): OwnerTelemedCancellationResult {
    return {
      sessionId: session.id,
      state: 'CANCELLED',
      telemedCaseState: 'CANCELLED_BY_OWNER',
      paymentStatus,
      refundState: refundState(paymentStatus),
      version: session.version,
      serverNow: new Date().toISOString(),
    };
  }
}

function refundState(status: TelemedPaymentStatus | null): OwnerTelemedCancellationResult['refundState'] {
  if (status === null) return 'NOT_REQUIRED';
  if (status === 'VOID_REQUESTED' || status === 'VOIDED' || status === 'REFUND_PENDING' || status === 'REFUNDED') return status;
  return null;
}
