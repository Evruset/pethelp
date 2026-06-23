import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainException, DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { AcquiringApi } from './acquiring-api';

export interface PaymentIntentResult {
  id: string;
  holdId: string;
  holdVersion: number;
  amount: string;
  status: 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'VOIDED' | 'FAILED';
  idempotencyKey: string;
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
  payment_status: PaymentIntentResult['status'];
  hold_state: string;
  hold_current_version: number;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly acquiringApi: AcquiringApi,
  ) {}

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
          throw new DomainException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'PAYMENT_HOLD_NOT_READY',
            'Payment can be created only for MIS_HELD hold',
          );
        }

        const idempotencyKey = randomUUID();
        const amount = '1000.00';
        const inserted = await client.query<PaymentIntentResult>(`
          INSERT INTO payment_schema.payment_intents (
            hold_id, hold_version, amount, status, idempotency_key
          )
          VALUES ($1::uuid, $2, $3::numeric, 'CREATED', $4)
          ON CONFLICT (hold_id, hold_version) DO UPDATE
          SET updated_at = payment_schema.payment_intents.updated_at
          RETURNING
            id,
            hold_id AS "holdId",
            hold_version AS "holdVersion",
            amount::text AS amount,
            status,
            idempotency_key AS "idempotencyKey"
        `, [holdId, hold.rows[0].version, amount, idempotencyKey]);

        return inserted.rows[0];
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async handlePaymentAuthorized(idempotencyKey: string): Promise<PaymentIntentResult> {
    let paymentToVoid: string | undefined;

    try {
      const result = await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);

        const locked = await client.query<PaymentWebhookRow>(`
          SELECT
            p.id,
            p.hold_id,
            p.hold_version,
            p.status AS payment_status,
            h.state AS hold_state,
            h.version AS hold_current_version
          FROM payment_schema.payment_intents p
          JOIN booking_schema.booking_holds h ON p.hold_id = h.id
          WHERE p.idempotency_key = $1
          FOR UPDATE OF p, h
        `, [idempotencyKey]);

        const row = locked.rows[0];
        if (!row) {
          throw new DomainException(HttpStatus.NOT_FOUND, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found');
        }

        if (row.payment_status === 'AUTHORIZED') {
          return this.readPaymentIntent(client, row.id);
        }

        if (row.hold_state === 'EXPIRED' || row.hold_state === 'MIS_BOOKING_FAILED') {
          await client.query(`
            UPDATE payment_schema.payment_intents
            SET status = 'VOIDED', updated_at = clock_timestamp()
            WHERE id = $1::uuid AND status <> 'VOIDED'
          `, [row.id]);
          paymentToVoid = row.id;
          throw new DomainException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'PAYMENT_FENCED_SLOT_EXPIRED',
            'Payment was authorized after hold became terminal',
          );
        }

        if (row.hold_state !== 'MIS_HELD') {
          throw new DomainException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'PAYMENT_HOLD_NOT_READY',
            'Payment webhook cannot confirm the current hold state',
          );
        }

        if (row.hold_current_version !== row.hold_version) {
          await client.query(`
            UPDATE payment_schema.payment_intents
            SET status = 'VOIDED', updated_at = clock_timestamp()
            WHERE id = $1::uuid AND status <> 'VOIDED'
          `, [row.id]);
          paymentToVoid = row.id;
          throw new DomainException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'PAYMENT_FENCED_HOLD_VERSION_MISMATCH',
            'Payment fence version does not match current hold version',
          );
        }

        await client.query(`
          UPDATE payment_schema.payment_intents
          SET status = 'AUTHORIZED', updated_at = clock_timestamp()
          WHERE id = $1::uuid
        `, [row.id]);

        await client.query(`
          UPDATE booking_schema.booking_holds
          SET state = 'CONFIRMED',
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid AND state = 'MIS_HELD' AND version = $2
        `, [row.hold_id, row.hold_version]);

        await client.query(`
          INSERT INTO audit_schema.audit_log (
            actor_type, actor_id, action, aggregate_type,
            aggregate_id, payload_json
          ) VALUES ('SYSTEM', NULL, 'payment.authorized', 'booking_hold', $1::uuid, $2::jsonb)
        `, [row.hold_id, JSON.stringify({ paymentIntentId: row.id, holdVersion: row.hold_version })]);

        return this.readPaymentIntent(client, row.id);
      });

      return result;
    } catch (error) {
      if (paymentToVoid) {
        await this.safeVoid(paymentToVoid);
      }
      throw error;
    }
  }

  private async readPaymentIntent(client: PoolClient, paymentId: string): Promise<PaymentIntentResult> {
    const result = await client.query<PaymentIntentResult>(`
      SELECT
        id,
        hold_id AS "holdId",
        hold_version AS "holdVersion",
        amount::text AS amount,
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

  private async safeVoid(paymentId: string): Promise<void> {
    try {
      await this.acquiringApi.void(paymentId);
    } catch (error) {
      this.logger.error(`Acquiring void failed for ${paymentId}`, error instanceof Error ? error.stack : undefined);
    }
  }

  private mapPgError(error: unknown): unknown {
    if (error instanceof DomainException) return error;
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const pgCode = String((error as { code?: unknown }).code);
      if (pgCode === '55P03' || pgCode === '57014') return DomainErrors.slotLockedRetry();
      if (pgCode === '23505') {
        return new DomainException(HttpStatus.CONFLICT, 'PAYMENT_INTENT_ALREADY_EXISTS', 'Payment intent already exists for hold version');
      }
    }
    return new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'PAYMENT_TEMPORARILY_UNAVAILABLE', 'Payment service is temporarily unavailable');
  }
}
