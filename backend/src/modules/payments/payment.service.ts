import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainException, DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { AcquiringClient } from './acquiring-client.service';

export type PaymentIntentStatus = 'PENDING_PROVIDER' | 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'VOIDED' | 'FAILED';

export interface PaymentIntentResult {
  id: string;
  holdId: string;
  holdVersion: number;
  paymentAttemptNo: number;
  paymentFenceToken: string;
  amount: string;
  currency: string;
  status: PaymentIntentStatus;
  idempotencyKey: string;
  remoteId?: string | null;
  checkoutUrl?: string | null;
}

export interface PaymentAuthorizedWebhookCommand {
  idempotencyKey: string;
  providerEventId: string;
  providerPaymentId?: string;
  rawPayload: string;
  payloadSha256: string;
}

interface HoldForPayment {
  state: string;
  version: number;
  owner_id: string;
}

interface PaymentWebhookRow {
  id: string;
  hold_id: string;
  hold_version: number;
  payment_attempt_no: number;
  payment_fence_token: string;
  amount: string;
  currency: string;
  payment_status: PaymentIntentStatus;
  provider_payment_id: string | null;
  hold_state: string;
  hold_current_version: number;
}

type WebhookOutcome =
  | { kind: 'AUTHORIZED'; result: PaymentIntentResult }
  | { kind: 'FENCED'; code: string; message: string };

@Injectable()
export class PaymentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly acquiringClient: AcquiringClient,
  ) {}

  /**
   * DB phase 1 persists PENDING_PROVIDER before the remote call. The network
   * call runs after COMMIT; phase 3 binds remote id + checkout URL afterwards.
   */
  async createPaymentIntent(holdId: string, ownerId: string): Promise<PaymentIntentResult> {
    const localIntent = await this.createOrRetryLocalIntent(holdId, ownerId);

    if (localIntent.status === 'CREATED' && localIntent.remoteId && localIntent.checkoutUrl) {
      return localIntent;
    }
    if (localIntent.status !== 'PENDING_PROVIDER') {
      throw new DomainException(HttpStatus.CONFLICT, 'PAYMENT_INTENT_NOT_CREATABLE', 'Payment intent cannot be sent to provider in current state');
    }

    try {
      const remoteIntent = await this.acquiringClient.createRemoteIntent(localIntent.id, Number(localIntent.amount), localIntent.paymentFenceToken);
      return await this.persistRemoteIntent(localIntent.id, remoteIntent.remoteId, remoteIntent.checkoutUrl);
    } catch (error) {
      await this.persistProviderFailure(localIntent.id, error instanceof Error ? error.message : 'Acquiring provider request failed');
      throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'ACQUIRING_PROVIDER_UNAVAILABLE', 'Unable to create payment checkout session');
    }
  }

  async handlePaymentAuthorized(command: PaymentAuthorizedWebhookCommand): Promise<PaymentIntentResult> {
    if (!command.idempotencyKey || !command.providerEventId || !command.payloadSha256 || !command.rawPayload) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'PAYMENT_WEBHOOK_INVALID', 'Webhook idempotency key, event id and payload are required');
    }

    const outcome = await this.database.withTransaction(async (client): Promise<WebhookOutcome> => {
      await this.setWebhookTransactionLimits(client);

      const locked = await client.query<PaymentWebhookRow>(`
        SELECT
          p.id,
          p.hold_id,
          p.hold_version,
          p.payment_attempt_no,
          p.payment_fence_token::text AS payment_fence_token,
          p.amount::text AS amount,
          p.currency,
          p.status AS payment_status,
          p.provider_payment_id,
          h.state AS hold_state,
          h.version AS hold_current_version
        FROM payment_schema.payment_intents p
        JOIN booking_schema.booking_holds h ON p.hold_id = h.id
        WHERE p.idempotency_key = $1
        FOR UPDATE OF p, h
      `, [command.idempotencyKey]);

      const row = locked.rows[0];
      if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found');
      if (row.payment_status === 'PENDING_PROVIDER' || row.payment_status === 'FAILED') {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_PROVIDER_INTENT_NOT_READY', 'Provider checkout session is not ready');
      }
      if (command.providerPaymentId && row.provider_payment_id && row.provider_payment_id !== command.providerPaymentId) {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_PROVIDER_REFERENCE_MISMATCH', 'Provider payment id does not match intent');
      }

      const inbox = await client.query<{ id: string }>(`
        INSERT INTO payment_schema.provider_webhook_events (
          provider_event_id, payment_intent_id, event_type,
          signature_valid, payload_sha256, raw_payload, processing_status
        ) VALUES ($1, $2::uuid, 'payment.authorized', true, $3, $4, 'PROCESSED')
        ON CONFLICT (provider_event_id) DO NOTHING
        RETURNING id
      `, [command.providerEventId, row.id, command.payloadSha256, command.rawPayload]);

      if (!inbox.rows[0]) return this.duplicateWebhookOutcome(client, row);

      if (command.providerPaymentId && !row.provider_payment_id) {
        await client.query(`
          UPDATE payment_schema.payment_intents
          SET provider_payment_id = $2, updated_at = clock_timestamp()
          WHERE id = $1::uuid
        `, [row.id, command.providerPaymentId]);
        row.provider_payment_id = command.providerPaymentId;
      }

      await this.writeLedger(client, {
        paymentIntentId: row.id,
        entryType: 'WEBHOOK_RECEIVED',
        amount: row.amount,
        currency: row.currency,
        idempotencyKey: `webhook-received:${command.providerEventId}`,
        providerEventId: command.providerEventId,
        payload: { idempotencyKey: command.idempotencyKey },
      });

      if (row.payment_status === 'VOIDED' || row.hold_state === 'EXPIRED' || row.hold_state === 'MIS_BOOKING_FAILED') {
        await this.fenceAndQueueVoid(client, row, command, 'PAYMENT_FENCED_SLOT_EXPIRED', 'Payment was authorized after hold became terminal');
        return { kind: 'FENCED', code: 'PAYMENT_FENCED_SLOT_EXPIRED', message: 'Payment was authorized after hold became terminal' };
      }

      if (row.hold_state === 'MIS_HELD') {
        if (row.hold_current_version !== row.hold_version) {
          await this.fenceAndQueueVoid(client, row, command, 'PAYMENT_FENCED_HOLD_VERSION_MISMATCH', 'Payment fence version does not match current hold version');
          return { kind: 'FENCED', code: 'PAYMENT_FENCED_HOLD_VERSION_MISMATCH', message: 'Payment fence version does not match current hold version' };
        }

        await client.query(`
          UPDATE booking_schema.booking_holds
          SET state = 'CONFIRMED',
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid AND state = 'MIS_HELD' AND version = $2
        `, [row.hold_id, row.hold_version]);
      } else if (row.hold_state === 'CONFIRMED') {
        if (row.hold_current_version !== row.hold_version + 1) {
          await this.fenceAndQueueVoid(client, row, command, 'PAYMENT_FENCED_HOLD_VERSION_MISMATCH', 'Confirmed hold version does not match payment fence');
          return { kind: 'FENCED', code: 'PAYMENT_FENCED_HOLD_VERSION_MISMATCH', message: 'Confirmed hold version does not match payment fence' };
        }
      } else {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_HOLD_NOT_READY', 'Payment webhook cannot confirm the current hold state');
      }

      if (row.payment_status !== 'AUTHORIZED') {
        await client.query(`
          UPDATE payment_schema.payment_intents
          SET status = 'AUTHORIZED', updated_at = clock_timestamp()
          WHERE id = $1::uuid AND status = 'CREATED'
        `, [row.id]);
        await this.writeLedger(client, {
          paymentIntentId: row.id,
          entryType: 'AUTHORIZED',
          amount: row.amount,
          currency: row.currency,
          idempotencyKey: `payment-authorized:${command.providerEventId}`,
          providerEventId: command.providerEventId,
          payload: { holdId: row.hold_id, holdVersion: row.hold_version },
        });
        await this.writeAudit(client, 'payment.authorized', row.hold_id, { paymentIntentId: row.id, holdVersion: row.hold_version });
      }

      await this.queueCapture(client, row, command.providerEventId);
      return { kind: 'AUTHORIZED', result: await this.readPaymentIntent(client, row.id) };
    });

    if (outcome.kind === 'FENCED') {
      throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, outcome.code, outcome.message);
    }
    return outcome.result;
  }

  private async createOrRetryLocalIntent(holdId: string, ownerId: string): Promise<PaymentIntentResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setProviderTransactionLimits(client);
        const hold = await client.query<HoldForPayment>(`
          SELECT state, version, owner_id
          FROM booking_schema.booking_holds
          WHERE id = $1::uuid
          FOR SHARE
        `, [holdId]);

        if (!hold.rows[0]) throw DomainErrors.holdNotFound();
        if (hold.rows[0].owner_id !== ownerId) throw DomainErrors.holdOwnerMismatch();
        if (hold.rows[0].state !== 'MIS_HELD') {
          throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_HOLD_NOT_READY', 'Payment can be created only for MIS_HELD hold');
        }

        const result = await client.query<PaymentIntentResult>(`
          WITH next_attempt AS (
            SELECT COALESCE(MAX(payment_attempt_no), 0) + 1 AS payment_attempt_no
            FROM payment_schema.payment_intents
            WHERE hold_id = $1::uuid
          )
          INSERT INTO payment_schema.payment_intents (
            hold_id, hold_version, payment_attempt_no, payment_fence_token,
            amount, currency, status, idempotency_key
          )
          SELECT $1::uuid, $2, next_attempt.payment_attempt_no, $3::uuid,
                 1000.00::numeric, 'RUB', 'PENDING_PROVIDER', $4
          FROM next_attempt
          ON CONFLICT (hold_id, hold_version) DO UPDATE
          SET status = CASE
                WHEN payment_schema.payment_intents.status = 'FAILED' THEN 'PENDING_PROVIDER'
                ELSE payment_schema.payment_intents.status
              END,
              provider_last_error = CASE
                WHEN payment_schema.payment_intents.status = 'FAILED' THEN NULL
                ELSE payment_schema.payment_intents.provider_last_error
              END,
              updated_at = clock_timestamp()
          RETURNING
            id,
            hold_id AS "holdId",
            hold_version AS "holdVersion",
            payment_attempt_no AS "paymentAttemptNo",
            payment_fence_token::text AS "paymentFenceToken",
            amount::text AS amount,
            currency,
            status,
            idempotency_key AS "idempotencyKey",
            provider_payment_id AS "remoteId",
            checkout_url AS "checkoutUrl"
        `, [holdId, hold.rows[0].version, randomUUID(), randomUUID()]);

        const payment = result.rows[0];
        await this.writeLedger(client, {
          paymentIntentId: payment.id,
          entryType: 'INTENT_CREATED',
          amount: payment.amount,
          currency: payment.currency,
          idempotencyKey: `payment-intent-created:${payment.id}`,
          payload: { holdId, holdVersion: hold.rows[0].version },
        });
        return payment;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  private async persistRemoteIntent(paymentId: string, remoteId: string, checkoutUrl: string): Promise<PaymentIntentResult> {
    return this.database.withTransaction(async (client) => {
      await this.setProviderTransactionLimits(client);
      const updated = await client.query<PaymentIntentResult>(`
        UPDATE payment_schema.payment_intents
        SET provider_payment_id = $2,
            checkout_url = $3,
            provider_last_error = NULL,
            status = 'CREATED',
            updated_at = clock_timestamp()
        WHERE id = $1::uuid AND status = 'PENDING_PROVIDER'
        RETURNING
          id,
          hold_id AS "holdId",
          hold_version AS "holdVersion",
          payment_attempt_no AS "paymentAttemptNo",
          payment_fence_token::text AS "paymentFenceToken",
          amount::text AS amount,
          currency,
          status,
          idempotency_key AS "idempotencyKey",
          provider_payment_id AS "remoteId",
          checkout_url AS "checkoutUrl"
      `, [paymentId, remoteId, checkoutUrl]);
      const payment = updated.rows[0] ?? await this.readPaymentIntent(client, paymentId);
      if (payment.status !== 'CREATED') {
        throw new DomainException(HttpStatus.CONFLICT, 'PAYMENT_INTENT_STATE_CONFLICT', 'Payment intent changed while provider session was being created');
      }
      await this.writeLedger(client, {
        paymentIntentId: payment.id,
        entryType: 'PROVIDER_INTENT_CREATED',
        amount: payment.amount,
        currency: payment.currency,
        idempotencyKey: `provider-intent-created:${payment.id}`,
        payload: { remoteId, checkoutUrl },
      });
      return payment;
    });
  }

  private async persistProviderFailure(paymentId: string, message: string): Promise<void> {
    await this.database.withTransaction(async (client) => {
      await this.setProviderTransactionLimits(client);
      const payment = await client.query<{ amount: string; currency: string }>(`
        UPDATE payment_schema.payment_intents
        SET status = 'FAILED', provider_last_error = $2, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND status = 'PENDING_PROVIDER'
        RETURNING amount::text AS amount, currency
      `, [paymentId, message.slice(0, 1000)]);
      if (!payment.rows[0]) return;
      await this.writeLedger(client, {
        paymentIntentId: paymentId,
        entryType: 'PROVIDER_INTENT_FAILED',
        amount: payment.rows[0].amount,
        currency: payment.rows[0].currency,
        idempotencyKey: `provider-intent-failed:${paymentId}:${message.slice(0, 64)}`,
        payload: { message: message.slice(0, 1000) },
      });
    });
  }

  private async duplicateWebhookOutcome(client: PoolClient, row: PaymentWebhookRow): Promise<WebhookOutcome> {
    if (row.payment_status === 'AUTHORIZED' || row.payment_status === 'CAPTURED') {
      return { kind: 'AUTHORIZED', result: await this.readPaymentIntent(client, row.id) };
    }
    if (row.payment_status === 'VOIDED') {
      return { kind: 'FENCED', code: 'PAYMENT_FENCED_SLOT_EXPIRED', message: 'Payment was previously fenced and void was requested' };
    }
    throw new DomainException(HttpStatus.CONFLICT, 'PAYMENT_WEBHOOK_DUPLICATE_IN_PROGRESS', 'Webhook duplicate cannot be applied in current payment state');
  }

  private async queueCapture(client: PoolClient, row: PaymentWebhookRow, providerEventId: string): Promise<void> {
    const remoteId = row.provider_payment_id;
    if (!remoteId) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_PROVIDER_REFERENCE_MISSING', 'Payment intent has no remote provider id');

    await client.query(`
      UPDATE payment_schema.payment_intents
      SET capture_requested_at = COALESCE(capture_requested_at, clock_timestamp()),
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
    `, [row.id]);
    await this.writeLedger(client, {
      paymentIntentId: row.id,
      entryType: 'CAPTURE_REQUESTED',
      amount: row.amount,
      currency: row.currency,
      idempotencyKey: `capture-requested:${row.id}`,
      providerEventId,
      payload: { remoteId },
    });
    await this.writePaymentOutbox(client, 'payment.acquiring.capture.requested.v1', row, { remoteId, providerEventId });
  }

  private async fenceAndQueueVoid(
    client: PoolClient,
    row: PaymentWebhookRow,
    command: PaymentAuthorizedWebhookCommand,
    code: string,
    message: string,
  ): Promise<void> {
    await client.query(`
      UPDATE payment_schema.payment_intents
      SET status = 'VOIDED',
          void_requested_at = COALESCE(void_requested_at, clock_timestamp()),
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
    `, [row.id]);
    await client.query(`
      UPDATE payment_schema.provider_webhook_events
      SET processing_status = 'FENCED'
      WHERE provider_event_id = $1
    `, [command.providerEventId]);
    await this.writeLedger(client, {
      paymentIntentId: row.id,
      entryType: 'VOID_REQUESTED',
      amount: row.amount,
      currency: row.currency,
      idempotencyKey: `void-requested:${row.id}`,
      providerEventId: command.providerEventId,
      payload: { code, message, holdId: row.hold_id, holdVersion: row.hold_version },
    });
    await this.writePaymentOutbox(client, 'payment.acquiring.void.requested.v1', row, { providerEventId: command.providerEventId });
    await this.writeAudit(client, 'payment.void.requested', row.hold_id, { paymentIntentId: row.id, code });
  }

  private async writePaymentOutbox(
    client: PoolClient,
    eventType: 'payment.acquiring.void.requested.v1' | 'payment.acquiring.capture.requested.v1',
    row: PaymentWebhookRow,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, aggregate_type, aggregate_id,
        aggregate_version, payload_json, deduplication_key
      ) VALUES ($1, 'payment_intent', $2::uuid, $3, $4::jsonb, $5)
      ON CONFLICT (deduplication_key) DO NOTHING
    `, [
      eventType,
      row.id,
      row.hold_version,
      JSON.stringify({
        paymentIntentId: row.id,
        paymentAttemptNo: row.payment_attempt_no,
        paymentFenceToken: row.payment_fence_token,
        ...payload,
      }),
      `${eventType}:${row.id}`,
    ]);
  }

  private async writeLedger(client: PoolClient, input: {
    paymentIntentId: string;
    entryType: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    providerEventId?: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await client.query(`
      INSERT INTO payment_schema.ledger_entries (
        payment_intent_id, entry_type, amount, currency,
        idempotency_key, provider_event_id, payload_json
      ) VALUES ($1::uuid, $2, $3::numeric, $4, $5, $6, $7::jsonb)
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [input.paymentIntentId, input.entryType, input.amount, input.currency, input.idempotencyKey, input.providerEventId ?? null, JSON.stringify(input.payload)]);
  }

  private async writeAudit(client: PoolClient, action: string, holdId: string, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (
        actor_type, actor_id, action, aggregate_type, aggregate_id, payload_json
      ) VALUES ('SYSTEM', NULL, $1, 'booking_hold', $2::uuid, $3::jsonb)
    `, [action, holdId, JSON.stringify(payload)]);
  }

  private async readPaymentIntent(client: PoolClient, paymentId: string): Promise<PaymentIntentResult> {
    const result = await client.query<PaymentIntentResult>(`
      SELECT id,
             hold_id AS "holdId",
             hold_version AS "holdVersion",
             payment_attempt_no AS "paymentAttemptNo",
             payment_fence_token::text AS "paymentFenceToken",
             amount::text AS amount,
             currency,
             status,
             idempotency_key AS "idempotencyKey",
             provider_payment_id AS "remoteId",
             checkout_url AS "checkoutUrl"
      FROM payment_schema.payment_intents
      WHERE id = $1::uuid
    `, [paymentId]);
    return result.rows[0];
  }

  private async setProviderTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '30ms'");
  }

  private async setWebhookTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private mapPgError(error: unknown): unknown {
    if (error instanceof DomainException) return error;
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const pgCode = String((error as { code?: unknown }).code);
      if (pgCode === '55P03' || pgCode === '57014') return DomainErrors.slotLockedRetry();
      if (pgCode === '23505') return new DomainException(HttpStatus.CONFLICT, 'PAYMENT_INTENT_ALREADY_EXISTS', 'Payment intent already exists for hold version');
    }
    return new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'PAYMENT_TEMPORARILY_UNAVAILABLE', 'Payment service is temporarily unavailable');
  }
}
