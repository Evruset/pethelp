import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { createHash, randomUUID } from 'node:crypto';
import nock from 'nock';
import { DatabaseService } from '../src/database/database.service';
import { ContextLoggerService } from '../src/observability/context-logger.service';
import { ObservabilityMetricsService } from '../src/observability/observability.metrics';
import { TraceContext } from '../src/observability/trace-context.context';
import { TelemedSlaWorker } from '../src/modules/telemed/telemed-sla.worker';
import { AcquiringClient } from '../src/modules/payments/acquiring-client.service';
import { PaymentOutboxRelayWorker } from '../src/modules/payments/payment-outbox-relay.worker';
import { PaymentRefundService } from '../src/modules/payments/payment-refund.service';

const PROVIDER_URL = 'https://acquiring.test';

jest.setTimeout(30_000);

describe('Captured payment refund flow', () => {
  let database: DatabaseService;
  let traceContext: TraceContext;
  let logger: ContextLoggerService;
  let metrics: ObservabilityMetricsService;
  let acquiringClient: AcquiringClient;
  let slaWorker: TelemedSlaWorker;
  let relay: PaymentOutboxRelayWorker;
  let refundService: PaymentRefundService;

  beforeAll(() => {
    process.env.WORKERS_ENABLED = 'true';
    process.env.ACQUIRING_API_BASE_URL = PROVIDER_URL;
    process.env.ACQUIRING_API_KEY = 'refund-test-key';
    database = new DatabaseService();
    traceContext = new TraceContext();
    logger = new ContextLoggerService(traceContext);
    metrics = new ObservabilityMetricsService(logger);
    acquiringClient = new AcquiringClient(new HttpService(axios.create({ proxy: false })));
    slaWorker = new TelemedSlaWorker(database, traceContext, logger, metrics);
    relay = new PaymentOutboxRelayWorker(database, acquiringClient, traceContext, logger, metrics);
    refundService = new PaymentRefundService(database, traceContext, metrics);
    nock.disableNetConnect();
  });

  beforeEach(async () => {
    nock.cleanAll();
    await resetDatabase(database);
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
    await database.onModuleDestroy();
  });

  it('creates one full refund for captured SLA breach, dispatches it and confirms it idempotently', async () => {
    const fixture = await createCapturedTelemedFixture(database);
    const providerRefundId = 'provider-refund-001';

    await slaWorker.enforceExpiredSessions();
    const afterSla = await paymentState(database, fixture.paymentId);
    expect(afterSla).toMatchObject({ status: 'REFUND_SENT', refunded_amount: '0.00' });

    nock(PROVIDER_URL)
      .post(`/v1/payment-intents/${fixture.providerPaymentId}/refunds`, {
        merchantPaymentId: fixture.paymentId,
        amount: 1000,
      })
      .matchHeader('authorization', 'Bearer refund-test-key')
      .matchHeader('idempotency-key', `refund:${fixture.paymentId}`)
      .reply(200, { refundId: providerRefundId, status: 'PENDING' });

    await relay.relay();
    expect(nock.isDone()).toBe(true);

    const dispatched = await paymentState(database, fixture.paymentId);
    expect(dispatched).toMatchObject({ status: 'REFUND_SENT', refund_provider_id: providerRefundId });
    await expectLedger(database, fixture.paymentId, 'REFUND_DISPATCHED', fixture.correlationId);

    const webhookCorrelationId = randomUUID();
    await traceContext.run({ correlationId: webhookCorrelationId }, () => refundService.handlePaymentRefunded({
      idempotencyKey: fixture.idempotencyKey,
      providerEventId: 'provider-refund-webhook-001',
      providerRefundId,
      rawPayload: JSON.stringify({ event: 'payment.refunded', refundId: providerRefundId }),
      payloadSha256: createHash('sha256').update('refund-webhook-001').digest('hex'),
    }));

    const refunded = await paymentState(database, fixture.paymentId);
    expect(refunded).toMatchObject({
      status: 'REFUNDED',
      refunded_amount: '1000.00',
      refund_provider_id: providerRefundId,
    });
    await expectLedger(database, fixture.paymentId, 'REFUND_CONFIRMED', webhookCorrelationId);

    await traceContext.run({ correlationId: webhookCorrelationId }, () => refundService.handlePaymentRefunded({
      idempotencyKey: fixture.idempotencyKey,
      providerEventId: 'provider-refund-webhook-001',
      providerRefundId,
      rawPayload: JSON.stringify({ event: 'payment.refunded', refundId: providerRefundId }),
      payloadSha256: createHash('sha256').update('refund-webhook-001').digest('hex'),
    }));

    const confirmationCount = await database.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM payment_schema.ledger_entries
      WHERE payment_intent_id = $1::uuid AND entry_type = 'REFUND_CONFIRMED'
    `, [fixture.paymentId]);
    expect(confirmationCount.rows[0]?.count).toBe('1');
  });
});

async function createCapturedTelemedFixture(database: DatabaseService) {
  const ownerId = randomUUID(); const petId = randomUUID(); const clinicId = randomUUID();
  const locationId = randomUUID(); const slotId = randomUUID(); const holdId = randomUUID();
  const sessionId = randomUUID(); const paymentId = randomUUID(); const correlationId = randomUUID();
  const idempotencyKey = `refund-payment-${paymentId}`;
  const providerPaymentId = 'provider-captured-001';

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Refund Pet', 'DOG')`, [petId, ownerId]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Refund Clinic LLC', 'Refund Clinic')`, [clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Refund address')`, [locationId, clinicId]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, starts_at, ends_at, capacity, held_count) VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '1 hour', clock_timestamp() + interval '90 minutes', 1, 1)`, [slotId, locationId]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'CONFIRMED', clock_timestamp() + interval '10 minutes')`, [holdId, slotId, ownerId, petId]);
  await database.query(`
    INSERT INTO telemed_schema.telemed_sessions (id, booking_hold_id, owner_id, state, room_name, correlation_id, expires_at)
    VALUES ($1::uuid, $2::uuid, $3::uuid, 'WAITING_FOR_DOCTOR', 'refund-room-${sessionId}', $4::uuid, clock_timestamp() - interval '1 second')
  `, [sessionId, holdId, ownerId, correlationId]);
  await database.query(`
    INSERT INTO payment_schema.payment_intents (
      id, hold_id, hold_version, amount, currency, status, idempotency_key, provider_payment_id
    ) VALUES ($1::uuid, $2::uuid, 1, 1000.00::numeric, 'RUB', 'CAPTURED', $3, $4)
  `, [paymentId, holdId, idempotencyKey, providerPaymentId]);

  return { paymentId, idempotencyKey, providerPaymentId, correlationId };
}

async function paymentState(database: DatabaseService, paymentId: string) {
  const result = await database.query<{ status: string; refunded_amount: string; refund_provider_id: string | null }>(`
    SELECT status, refunded_amount::text AS refunded_amount, refund_provider_id
    FROM payment_schema.payment_intents WHERE id = $1::uuid
  `, [paymentId]);
  return result.rows[0];
}

async function expectLedger(database: DatabaseService, paymentId: string, entryType: string, correlationId: string) {
  const result = await database.query<{ count: string; correlation_id: string | null }>(`
    SELECT COUNT(*)::text AS count, MAX(correlation_id::text) AS correlation_id
    FROM payment_schema.ledger_entries
    WHERE payment_intent_id = $1::uuid AND entry_type = $2
    GROUP BY payment_intent_id
  `, [paymentId, entryType]);
  expect(result.rows[0]).toMatchObject({ count: '1', correlation_id: correlationId });
}

async function resetDatabase(database: DatabaseService) {
  await database.query(`
    TRUNCATE TABLE telemed_schema.telemed_sessions, payment_schema.provider_webhook_events,
      payment_schema.ledger_entries, payment_schema.payment_intents, audit_schema.audit_log,
      booking_schema.outbox_events, booking_schema.appointment_events, booking_schema.appointments,
      booking_schema.idempotency_records, booking_schema.booking_holds, pet_schema.pets,
      identity_schema.users, clinic_schema.clinics RESTART IDENTITY CASCADE
  `);
}
