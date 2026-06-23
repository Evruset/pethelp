import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainException, DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';

export interface PaymentIntentResult {
  id: string;
  holdId: string;
  holdVersion: number;
  amount: string;
  currency: string;
  status: 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'VOIDED' | 'FAILED';
  idempotencyKey: string;
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
  amount: string;
  currency: string;
  payment_status: PaymentIntentResult['status'];
  hold_state: string;
  hold_current_version: number;
}

type WebhookOutcome =
  | { kind: 'AUTHORIZED'; result: PaymentIntentResult }
  | { kind: 'FENCED'; code: string; message: string };

@Injectable()
export class PaymentService {
  constructor(private readonly database: DatabaseService) {}

  async createPaymentIntent(holdId: string, ownerId: string): Promise<PaymentIntentResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);

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

        const idempotencyKey = randomUUID();
        const amount = '1000.00';
        const inserted = await client.query<PaymentIntentResult>(`
          INSERT INTO payment_schema.payment_intents (
            hold_id, hold_version, amount, currency, status, idempotency_key
          )
          VALUES ($1::uuid, $2, $3::numeric, 'RUB', 'CREATED', $4)
          ON CONFLICT (hold_id, hold_version) DO UPDATE
          SET updated_at = payment_schema.payment_intents.updated_at
          RETURNING
            id,
            hold_id AS "holdId",
            hold_version AS "holdVersion",
            amount::text AS amount,
            currency,
            status,
            idempotency_key AS "idempotencyKey"
        `, [holdId, hold.rows[0].version, amount, idempotencyKey]);

        await this.writeLedger(client, {
          paymentIntentId: inserted.rows[0].id,
          entryType: 'WEBHOOK_RECEIVED',
          amount,
          currency: 'RUB',
          idempotencyKey: `payment-intent-created:${inserted.rows[0].id}`,
          payload: { holdId, holdVersion: hold.rows[0].version, kind: 'payment_intent_created' },
        });

        return inserted.rows[0];
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async handlePaymentAuthorized(command: PaymentAuthorizedWebhookCommand): Promise<PaymentIntentResult> {
    if (!command.idempotencyKey || !command.providerEventId || !command.payloadSha256 || !command.rawPayload) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'PAYMENT_WEBHOOK_INVALID', 'Webhook idempotency key, event id and payload are required');
    }

    const outcome = await this.database.withTransaction(async (client): Promise<WebhookOutcome> => {
      await this.setInteractiveTransactionLimits(client);

      const locked = await client.query<PaymentWebhookRow>(`
        SELECT
          p.id,
          p.hold_id,
          p.hold_version,
          p.amount::text AS amount,
          p.currency,
          p.status AS payment_status,
          h.state AS hold_state,
          h.version AS hold_current_version
        FROM payment_schema.payment_intents p
        JOIN booking_schema.booking_holds h ON p.hold_id = h.id
        WHERE p.idempotency_key = $1
        FOR UPDATE OF p, h
      `, [command.idempotencyKey]);

      const row = locked.rows[0];
      if (!row) {
        throw new DomainException(HttpStatus.NOT_FOUND, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found');
      }

      const inbox = await client.query<{ id: string }>(`
        INSERT INTO payment_schema.provider_webhook_events (
          provider_event_id, payment_intent_id, event_type,
          signature_valid, payload_sha256, raw_payload, processing_status
        ) VALUES ($1, $2::uuid, 'payment.authorized', true, $3, $4, 'PROCESSED')
        ON CONFLICT (provider_event_id) DO NOTHING
        RETURNING id
      `, [command.providerEventId, row.id, command.payloadSha256, command.rawPayload]);

      if (!inbox.rows[0]) {
        return this.duplicateWebhookOutcome(client, row);
      }

      if (command.providerPaymentId) {
        await client.query(`
          UPDATE payment_schema.payment_intents
          SET provider_payment_id = COALESCE(provider_payment_id, $2), updated_at = clock_timestamp()
          WHERE id = $1::uuid
        `, [row.id, command.providerPaymentId]);
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

      if (row.payment_status === 'AUTHORIZED') {
        return { kind: 'AUTHORIZED', result: await this.readPaymentIntent(client, row.id) };
      }

      if (row.payment_status === 'VOIDED' || row.hold_state === 'EXPIRED' || row.hold_state === 'MIS_BOOKING_FAILED') {
        await this.fenceAndQueueVoid(client, row, command, 'PAYMENT_FENCED_SLOT_EXPIRED', 'Payment was authorized after hold became terminal');
        return { kind: 'FENCED', code: 'PAYMENT_FENCED_SLOT_EXPIRED', message: 'Payment was authorized after hold became terminal' };
      }

      if (row.hold_state !== 'MIS_HELD') {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_HOLD_NOT_READY', 'Payment webhook cannot confirm the current hold state');
      }

      if (row.hold_current_version !== row.hold_version) {
        await this.fenceAndQueueVoid(client, row, command, 'PAYMENT_FENCED_HOLD_VERSION_MISMATCH', 'Payment fence version does not match current hold version');
        return { kind: 'FENCED', code: 'PAYMENT_FENCED_HOLD_VERSION_MISMATCH', message: 'Payment fence version does not match current hold version' };
      }

      await client.query(`
        UPDATE payment_schema.payment_intents
        SET status = 'AUTHORIZED', updated_at = clock_timestamp()
        WHERE id = $1::uuid
      `, [row.id]);

      const confirmed = await client.query<{ id: string }>(`
        UPDATE booking_schema.booking_holds
        SET state = 'CONFIRMED',
            state_changed_at = clock_timestamp(),
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid AND state = 'MIS_HELD' AND version = $2
        RETURNING id
      `, [row.hold_id, row.hold_version]);

      if (!confirmed.rows[0]) {
        await this.fenceAndQueueVoid(client, row, command, 'PAYMENT_FENCED_HOLD_VERSION_MISMATCH', 'Hold changed before payment authorization commit');
        return { kind: 'FENCED', code: 'PAYMENT_FENCED_HOLD_VERSION_MISMATCH', message: 'Hold changed before payment authorization commit' };
      }

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

      return { kind: 'AUTHORIZED', result: await this.readPaymentIntent(client, row.id) };
    });

    if (outcome.kind === 'FENCED') {
      throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, outcome.code, outcome.message);
    }

    return outcome.result;
  }

  private async duplicateWebhookOutcome(client: PoolClient, row: PaymentWebhookRow): Promise<WebhookOutcome> {
    if (row.payment_status === 'AUTHORIZED') {
      return { kind: 'AUTHORIZED', result: await this.readPaymentIntent(client, row.id) };
    }
    if (row.payment_status === 'VOIDED') {
      return { kind: 'FENCED', code: 'PAYMENT_FENCED_SLOT_EXPIRED', message: 'Payment was previously fenced and void was requested' };
    }
    throw new DomainException(HttpStatus.CONFLICT, 'PAYMENT_WEBHOOK_DUPLICATE_IN_PROGRESS', 'Webhook duplicate cannot be applied in current payment state');
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
    await this.writeOutbox(client, row, command.providerEventId);
    await this.writeAudit(client, 'payment.void.requested', row.hold_id, { paymentIntentId: row.id, code });
  }

  private async writeOutbox(client: PoolClient, row: PaymentWebhookRow, providerEventId: string): Promise<void> {
    const eventType = 'payment.acquiring.void.requested.v1';
    const deduplicationKey = `${eventType}:${row.id}`;
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
      JSON.stringify({ paymentIntentId: row.id, providerEventId }),
      deduplicationKey,
    ]);
  }

  private async writeLedger(
    client: PoolClient,
    input: {
      paymentIntentId: string;
      entryType: string;
      amount: string;
      currency: string;
      idempotencyKey: string;
      providerEventId?: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await client.query(`
      INSERT INTO payment_schema.ledger_entries (
        payment_intent_id, entry_type, amount, currency,
        idempotency_key, provider_event_id, payload_json
      ) VALUES ($1::uuid, $2, $3::numeric, $4, $5, $6, $7::jsonb)
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [
      input.paymentIntentId,
      input.entryType,
      input.amount,
      input.currency,
      input.idempotencyKey,
      input.providerEventId ?? null,
      JSON.stringify(input.payload),
    ]);
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
      SELECT
        id,
        hold_id AS "holdId",
        hold_version AS "holdVersion",
        amount::text AS amount,
        currency,
        status,
        idempotency_key AS "idempotencyKey"
      FROM payment_schema.payment_intents
      WHERE id = $1::uuid
    `, [paymentId]);
    return result.rows[0];
  }

  private async setInteractiveTransactionLimits(client: PoolClient): Promise<void> {
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
