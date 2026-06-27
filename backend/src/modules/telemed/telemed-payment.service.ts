import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { AcquiringClient } from '../payments/acquiring-client.service';

type TelemedPaymentStatus = 'PENDING_PROVIDER' | 'CREATED' | 'AUTHORIZED' | 'FAILED';

export interface TelemedPaymentIntentResult {
  caseId: string;
  intakeId: string;
  paymentIntentId: string;
  paymentFenceToken: string;
  refundPolicyVersion: string;
  amount: string;
  currency: string;
  status: TelemedPaymentStatus;
  idempotencyKey: string;
  remoteId: string | null;
  checkoutUrl: string | null;
  nextState: 'PAYMENT_PENDING';
}

export interface TelemedPaymentAuthorizedWebhookCommand {
  idempotencyKey: string;
  providerEventId: string;
  providerPaymentId?: string;
  rawPayload: string;
  payloadSha256: string;
}

export interface TelemedPaymentAuthorizedResult {
  caseId: string;
  paymentIntentId: string;
  state: 'QUEUED';
  queuePriority: number;
  serverNow: string;
}

interface LocalIntentRow {
  case_id: string;
  intake_id: string;
  payment_intent_id: string;
  payment_fence_token: string;
  refund_policy_version: string;
  amount: string;
  currency: string;
  status: TelemedPaymentStatus;
  idempotency_key: string;
  provider_payment_id: string | null;
  checkout_url: string | null;
}

interface TelemedPaymentWebhookRow {
  payment_intent_id: string;
  case_id: string;
  case_state: string;
  queue_priority: number;
  payment_status: string;
  idempotency_key: string;
  payment_fence_token: string;
  provider_payment_id: string | null;
}

interface Queryable {
  query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

@Injectable()
export class TelemedPaymentService {
  private static readonly PRICE_AMOUNT = '1500.00';

  constructor(
    private readonly database: DatabaseService,
    private readonly acquiringClient: AcquiringClient,
  ) {}

  async createIntent(input: {
    intakeId: string;
    ownerId: string;
    idempotencyKey: string;
  }): Promise<TelemedPaymentIntentResult> {
    const local = await this.createLocalIntent(input);
    if (local.status === 'CREATED' && local.remoteId && local.checkoutUrl) {
      return local;
    }
    if (local.status !== 'PENDING_PROVIDER') {
      throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_PAYMENT_NOT_CREATABLE', 'Telemedicine payment cannot be created in current state');
    }

    try {
      const remote = await this.acquiringClient.createRemoteIntent(
        local.paymentIntentId,
        Number(local.amount),
        local.paymentFenceToken,
      );
      return this.persistRemoteIntent(local.paymentIntentId, remote.remoteId, remote.checkoutUrl);
    } catch (error) {
      await this.persistProviderFailure(local.paymentIntentId, error instanceof Error ? error.message : 'Acquiring provider request failed');
      throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'ACQUIRING_PROVIDER_UNAVAILABLE', 'Unable to create telemedicine checkout session');
    }
  }

  async handleAuthorizedWebhook(command: TelemedPaymentAuthorizedWebhookCommand): Promise<TelemedPaymentAuthorizedResult> {
    if (!command.idempotencyKey || !command.providerEventId || !command.payloadSha256 || !command.rawPayload) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TELEMED_PAYMENT_WEBHOOK_INVALID', 'Webhook idempotency key, event id and payload are required');
    }

    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");

      const locked = await client.query<TelemedPaymentWebhookRow>(`
        SELECT
          payment.id::text AS payment_intent_id,
          telemed_case.id::text AS case_id,
          telemed_case.state AS case_state,
          telemed_case.queue_priority,
          payment.status AS payment_status,
          payment.idempotency_key::text AS idempotency_key,
          payment.payment_fence_token::text AS payment_fence_token,
          payment.provider_payment_id
        FROM telemed_schema.telemed_payment_intents payment
        JOIN telemed_schema.telemed_cases telemed_case ON telemed_case.id = payment.case_id
        WHERE payment.idempotency_key = $1::uuid
        FOR UPDATE OF payment, telemed_case
      `, [command.idempotencyKey]);

      const row = locked.rows[0];
      if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_PAYMENT_NOT_FOUND', 'Telemedicine payment intent not found');
      if (row.payment_status !== 'CREATED' && row.payment_status !== 'AUTHORIZED') {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_PAYMENT_PROVIDER_INTENT_NOT_READY', 'Provider checkout is not ready for authorization');
      }
      if (command.providerPaymentId && row.provider_payment_id && row.provider_payment_id !== command.providerPaymentId) {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_PAYMENT_PROVIDER_REFERENCE_MISMATCH', 'Provider payment id does not match telemedicine payment');
      }

      const inbox = await client.query<{ id: string }>(`
        INSERT INTO telemed_schema.telemed_provider_webhook_events (
          provider_event_id, payment_intent_id, event_type,
          signature_valid, payload_sha256, raw_payload, processing_status
        ) VALUES ($1, $2::uuid, 'telemed.payment.authorized', true, $3, $4, 'PROCESSED')
        ON CONFLICT (provider_event_id) DO NOTHING
        RETURNING id
      `, [command.providerEventId, row.payment_intent_id, command.payloadSha256, command.rawPayload]);

      if (!inbox.rows[0]) {
        await this.writePaymentEvent(client, row.payment_intent_id, 'DUPLICATE_WEBHOOK_OBSERVED', `telemed-duplicate-webhook:${command.providerEventId}`, command.providerEventId, {
          caseId: row.case_id,
        });
        return this.queuedResult(client, row);
      }

      await this.writePaymentEvent(client, row.payment_intent_id, 'PROVIDER_WEBHOOK_RECEIVED', `telemed-webhook-received:${command.providerEventId}`, command.providerEventId, {
        idempotencyKey: command.idempotencyKey,
      });

      if (command.providerPaymentId && !row.provider_payment_id) {
        await client.query(`
          UPDATE telemed_schema.telemed_payment_intents
          SET provider_payment_id = $2, updated_at = clock_timestamp()
          WHERE id = $1::uuid
        `, [row.payment_intent_id, command.providerPaymentId]);
      }

      if (row.payment_status !== 'AUTHORIZED') {
        await client.query(`
          UPDATE telemed_schema.telemed_payment_intents
          SET status = 'AUTHORIZED', updated_at = clock_timestamp()
          WHERE id = $1::uuid AND status = 'CREATED'
        `, [row.payment_intent_id]);
        await this.writePaymentEvent(client, row.payment_intent_id, 'AUTHORIZED', `telemed-authorized:${command.providerEventId}`, command.providerEventId, {
          caseId: row.case_id,
          paymentFenceToken: row.payment_fence_token,
        });
      }

      await client.query(`
        UPDATE telemed_schema.telemed_cases
        SET state = 'QUEUED',
            queue_priority = queue_priority + 100,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state IN ('PAYMENT_PENDING', 'FUNDS_RESERVED')
      `, [row.case_id]);
      await this.writePaymentEvent(client, row.payment_intent_id, 'QUEUE_ENTERED', `telemed-queue-entered:${row.case_id}`, command.providerEventId, {
        caseId: row.case_id,
      });

      return this.queuedResult(client, { ...row, payment_status: 'AUTHORIZED', case_state: 'QUEUED', queue_priority: row.queue_priority + 100 });
    });
  }

  private async createLocalIntent(input: { intakeId: string; ownerId: string; idempotencyKey: string }): Promise<TelemedPaymentIntentResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");

      const result = await client.query<LocalIntentRow>(`
        WITH intake AS (
          SELECT id, owner_id, pet_id, expected_service_level, eligibility_outcome, symptom_duration
          FROM telemed_schema.telemed_intakes
          WHERE id = $1::uuid AND owner_id = $2::uuid
          FOR SHARE
        ),
        eligible AS (
          SELECT *
          FROM intake
          WHERE eligibility_outcome = 'TELEMED_ELIGIBLE'
        ),
        upsert_case AS (
          INSERT INTO telemed_schema.telemed_cases (
            intake_id, owner_id, pet_id, state, urgency_band, service_level, queue_priority, refund_policy_version
          )
          SELECT
            id, owner_id, pet_id, 'PAYMENT_PENDING',
            CASE WHEN symptom_duration = 'LESS_THAN_24H' THEN 'SOON' ELSE 'ROUTINE' END,
            expected_service_level,
            CASE WHEN expected_service_level = 'EXPRESS' THEN 20 ELSE 10 END,
            'telemed-refund-v1'
          FROM eligible
          ON CONFLICT (intake_id) DO UPDATE
          SET state = CASE
                WHEN telemed_schema.telemed_cases.state = 'DRAFT' THEN 'PAYMENT_PENDING'
                ELSE telemed_schema.telemed_cases.state
              END,
              updated_at = clock_timestamp()
          RETURNING id, intake_id, refund_policy_version
        ),
        upsert_payment AS (
          INSERT INTO telemed_schema.telemed_payment_intents (
            case_id, amount, currency, status, idempotency_key
          )
          SELECT id, $4::numeric, 'RUB', 'PENDING_PROVIDER', $3::uuid
          FROM upsert_case
          ON CONFLICT (case_id) DO UPDATE
          SET status = CASE
                WHEN telemed_schema.telemed_payment_intents.status = 'FAILED' THEN 'PENDING_PROVIDER'
                ELSE telemed_schema.telemed_payment_intents.status
              END,
              idempotency_key = CASE
                WHEN telemed_schema.telemed_payment_intents.status = 'FAILED' THEN EXCLUDED.idempotency_key
                ELSE telemed_schema.telemed_payment_intents.idempotency_key
              END,
              provider_last_error = CASE
                WHEN telemed_schema.telemed_payment_intents.status = 'FAILED' THEN NULL
                ELSE telemed_schema.telemed_payment_intents.provider_last_error
              END,
              updated_at = clock_timestamp()
          RETURNING
            id,
            case_id,
            payment_fence_token::text,
            amount::text,
            currency,
            status,
            idempotency_key::text,
            provider_payment_id,
            checkout_url
        )
        SELECT
          c.id::text AS case_id,
          c.intake_id::text AS intake_id,
          p.id::text AS payment_intent_id,
          p.payment_fence_token,
          c.refund_policy_version,
          p.amount,
          p.currency,
          p.status,
          p.idempotency_key,
          p.provider_payment_id,
          p.checkout_url
        FROM upsert_case c
        JOIN upsert_payment p ON p.case_id = c.id
      `, [input.intakeId, input.ownerId, input.idempotencyKey, TelemedPaymentService.PRICE_AMOUNT]);

      const row = result.rows[0];
      if (!row) {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_INTAKE_NOT_ELIGIBLE', 'Telemedicine payment requires a telemedicine-eligible intake');
      }
      return view(row);
    });
  }

  private async persistRemoteIntent(paymentIntentId: string, remoteId: string, checkoutUrl: string): Promise<TelemedPaymentIntentResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const result = await client.query<LocalIntentRow>(`
        UPDATE telemed_schema.telemed_payment_intents payment
        SET provider_payment_id = $2,
            checkout_url = $3,
            provider_last_error = NULL,
            status = 'CREATED',
            updated_at = clock_timestamp()
        FROM telemed_schema.telemed_cases telemed_case
        WHERE payment.id = $1::uuid
          AND payment.case_id = telemed_case.id
          AND payment.status = 'PENDING_PROVIDER'
        RETURNING
          telemed_case.id::text AS case_id,
          telemed_case.intake_id::text AS intake_id,
          payment.id::text AS payment_intent_id,
          payment.payment_fence_token::text AS payment_fence_token,
          telemed_case.refund_policy_version,
          payment.amount::text AS amount,
          payment.currency,
          payment.status,
          payment.idempotency_key::text AS idempotency_key,
          payment.provider_payment_id,
          payment.checkout_url
      `, [paymentIntentId, remoteId, checkoutUrl]);
      const row = result.rows[0] ?? await this.readIntent(client, paymentIntentId);
      if (row.status !== 'CREATED') {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_PAYMENT_STATE_CONFLICT', 'Telemedicine payment changed while checkout was being created');
      }
      return view(row);
    });
  }

  private async persistProviderFailure(paymentIntentId: string, message: string): Promise<void> {
    await this.database.query(`
      UPDATE telemed_schema.telemed_payment_intents
      SET status = 'FAILED',
          provider_last_error = $2,
          updated_at = clock_timestamp()
      WHERE id = $1::uuid AND status = 'PENDING_PROVIDER'
    `, [paymentIntentId, message.slice(0, 1000)]);
  }

  private async readIntent(client: Queryable, paymentIntentId: string): Promise<LocalIntentRow> {
    const result = await client.query<LocalIntentRow>(`
      SELECT
        telemed_case.id::text AS case_id,
        telemed_case.intake_id::text AS intake_id,
        payment.id::text AS payment_intent_id,
        payment.payment_fence_token::text AS payment_fence_token,
        telemed_case.refund_policy_version,
        payment.amount::text AS amount,
        payment.currency,
        payment.status,
        payment.idempotency_key::text AS idempotency_key,
        payment.provider_payment_id,
        payment.checkout_url
      FROM telemed_schema.telemed_payment_intents payment
      JOIN telemed_schema.telemed_cases telemed_case ON telemed_case.id = payment.case_id
      WHERE payment.id = $1::uuid
    `, [paymentIntentId]);
    const row = result.rows[0];
    if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_PAYMENT_NOT_FOUND', 'Telemedicine payment intent not found');
    return row;
  }

  private async queuedResult(client: Queryable, row: TelemedPaymentWebhookRow): Promise<TelemedPaymentAuthorizedResult> {
    const result = await client.query<{ state: 'QUEUED'; queue_priority: number; server_now: Date }>(`
      SELECT state, queue_priority, clock_timestamp() AS server_now
      FROM telemed_schema.telemed_cases
      WHERE id = $1::uuid
    `, [row.case_id]);
    const queued = result.rows[0];
    if (!queued || queued.state !== 'QUEUED') {
      throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_CASE_NOT_QUEUED', 'Telemedicine case is not queued');
    }
    return {
      caseId: row.case_id,
      paymentIntentId: row.payment_intent_id,
      state: queued.state,
      queuePriority: queued.queue_priority,
      serverNow: queued.server_now.toISOString(),
    };
  }

  private async writePaymentEvent(
    client: Queryable,
    paymentIntentId: string,
    eventType: 'PROVIDER_WEBHOOK_RECEIVED' | 'AUTHORIZED' | 'QUEUE_ENTERED' | 'DUPLICATE_WEBHOOK_OBSERVED',
    idempotencyKey: string,
    providerEventId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(`
      INSERT INTO telemed_schema.telemed_payment_events (
        payment_intent_id, event_type, provider_event_id, idempotency_key, payload_json
      ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb)
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [paymentIntentId, eventType, providerEventId, idempotencyKey, JSON.stringify(payload)]);
  }
}

function view(row: LocalIntentRow): TelemedPaymentIntentResult {
  return {
    caseId: row.case_id,
    intakeId: row.intake_id,
    paymentIntentId: row.payment_intent_id,
    paymentFenceToken: row.payment_fence_token,
    refundPolicyVersion: row.refund_policy_version,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    remoteId: row.provider_payment_id,
    checkoutUrl: row.checkout_url,
    nextState: 'PAYMENT_PENDING',
  };
}

export function newTelemedPaymentIdempotencyKey(): string {
  return randomUUID();
}
