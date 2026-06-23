import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import nock from 'nock';
import { DatabaseService } from '../src/database/database.service';
import { AcquiringClient } from '../src/modules/payments/acquiring-client.service';
import { AcquiringWebhookVerifier } from '../src/modules/payments/acquiring-webhook-verifier';
import { PaymentOutboxRelayWorker } from '../src/modules/payments/payment-outbox-relay.worker';
import { PaymentReconciliationWorker } from '../src/modules/payments/payment-reconciliation.worker';
import { PaymentAuthorizedWebhookCommand, PaymentService } from '../src/modules/payments/payment.service';

const PROVIDER_URL = 'https://acquiring.test';
const WEBHOOK_SECRET = 'payment-webhook-test-secret';
const PROVIDER_PAYMENT_ID = 'provider-payment-reliability';

jest.setTimeout(30_000);

describe('Payment reliability: signed webhook, outbox void and reconciliation', () => {
  let database: DatabaseService;
  let service: PaymentService;
  let acquiringClient: AcquiringClient;
  let relay: PaymentOutboxRelayWorker;
  let reconciliation: PaymentReconciliationWorker;
  let verifier: AcquiringWebhookVerifier;

  beforeAll(() => {
    process.env.WORKERS_ENABLED = 'true';
    process.env.ACQUIRING_API_BASE_URL = PROVIDER_URL;
    process.env.ACQUIRING_API_KEY = 'acquiring-test-key';
    process.env.ACQUIRING_WEBHOOK_SECRET = WEBHOOK_SECRET;

    database = new DatabaseService();
    acquiringClient = new AcquiringClient(new HttpService(axios.create({ proxy: false })));
    service = new PaymentService(database, acquiringClient);
    relay = new PaymentOutboxRelayWorker(database, acquiringClient);
    reconciliation = new PaymentReconciliationWorker(database, acquiringClient);
    verifier = new AcquiringWebhookVerifier();
    nock.disableNetConnect();
  });

  beforeEach(async () => {
    nock.cleanAll();
    await resetDatabase(database);
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
    await database.onModuleDestroy();
  });

  it('verifies HMAC and durably relays then reconciles a fenced void', async () => {
    const fixture = await createExpiredPaymentFixture(database, service);
    const rawPayload = JSON.stringify({
      idempotencyKey: fixture.intent.idempotencyKey,
      eventId: 'provider-event-reliability',
      providerPaymentId: PROVIDER_PAYMENT_ID,
    });
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(Buffer.from(rawPayload)).digest('hex');
    expect(verifier.verify(Buffer.from(rawPayload), `sha256=${signature}`)).toBe(true);
    expect(verifier.verify(Buffer.from(rawPayload), 'sha256=bad')).toBe(false);

    const command: PaymentAuthorizedWebhookCommand = {
      idempotencyKey: fixture.intent.idempotencyKey,
      providerEventId: 'provider-event-reliability',
      providerPaymentId: PROVIDER_PAYMENT_ID,
      rawPayload,
      payloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
    };
    await expect(service.handlePaymentAuthorized(command)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAYMENT_FENCED_SLOT_EXPIRED' }),
    });

    const voidScope = nock(PROVIDER_URL)
      .matchHeader('authorization', 'Bearer acquiring-test-key')
      .matchHeader('idempotency-key', `void:${fixture.intent.id}`)
      .post(`/v1/payment-intents/${PROVIDER_PAYMENT_ID}/void`, { merchantPaymentId: fixture.intent.id })
      .reply(200, { status: 'PENDING' });
    await relay.relay();
    expect(voidScope.isDone()).toBe(true);
    await expectPaymentTimestamps(database, fixture.intent.id, { void_sent_at: true, void_confirmed_at: false });
    await expectLedger(database, fixture.intent.id, 'VOID_SENT');

    const reconciliationScope = nock(PROVIDER_URL)
      .matchHeader('authorization', 'Bearer acquiring-test-key')
      .get(`/v1/payment-intents/${PROVIDER_PAYMENT_ID}`)
      .reply(200, { status: 'VOIDED' });
    await reconciliation.reconcile();
    expect(reconciliationScope.isDone()).toBe(true);
    await expectPaymentTimestamps(database, fixture.intent.id, { void_sent_at: true, void_confirmed_at: true });
    await expectLedger(database, fixture.intent.id, 'VOID_CONFIRMED');
  });
});

async function createExpiredPaymentFixture(database: DatabaseService, service: PaymentService) {
  const ownerId = randomUUID();
  const petId = randomUUID();
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const slotId = randomUUID();
  const holdId = randomUUID();

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Reliability Pet', 'DOG')`, [petId, ownerId]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Reliability Clinic LLC', 'Reliability Clinic')`, [clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Reliability test address')`, [locationId, clinicId]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, starts_at, ends_at, capacity, held_count) VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '1 hour', clock_timestamp() + interval '90 minutes', 1, 1)`, [slotId, locationId]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'MIS_HELD', clock_timestamp() + interval '10 minutes')`, [holdId, slotId, ownerId, petId]);

  const createScope = nock(PROVIDER_URL)
    .matchHeader('authorization', 'Bearer acquiring-test-key')
    .matchHeader('idempotency-key', (value) => typeof value === 'string' && value.length > 0)
    .post('/v1/payment-intents', (body) => typeof body?.merchantPaymentId === 'string' && body.amount === 1000)
    .reply(201, { id: PROVIDER_PAYMENT_ID, checkoutUrl: 'https://checkout.test/reliability' });
  const intent = await service.createPaymentIntent(holdId, ownerId);
  expect(createScope.isDone()).toBe(true);
  await database.query(`UPDATE booking_schema.booking_holds SET state = 'EXPIRED', version = version + 1 WHERE id = $1::uuid`, [holdId]);
  return { intent };
}

async function resetDatabase(database: DatabaseService): Promise<void> {
  await database.query(`
    TRUNCATE TABLE
      payment_schema.provider_webhook_events,
      payment_schema.ledger_entries,
      payment_schema.payment_intents,
      audit_schema.audit_log,
      booking_schema.outbox_events,
      booking_schema.appointment_events,
      booking_schema.appointments,
      booking_schema.idempotency_records,
      booking_schema.booking_holds,
      pet_schema.pets,
      identity_schema.users,
      clinic_schema.clinics
    RESTART IDENTITY CASCADE
  `);
}

async function expectPaymentTimestamps(
  database: DatabaseService,
  paymentIntentId: string,
  expected: { void_sent_at: boolean; void_confirmed_at: boolean },
): Promise<void> {
  const result = await database.query<{ void_sent_at: Date | null; void_confirmed_at: Date | null }>(
    `SELECT void_sent_at, void_confirmed_at FROM payment_schema.payment_intents WHERE id = $1::uuid`,
    [paymentIntentId],
  );
  expect(Boolean(result.rows[0]?.void_sent_at)).toBe(expected.void_sent_at);
  expect(Boolean(result.rows[0]?.void_confirmed_at)).toBe(expected.void_confirmed_at);
}

async function expectLedger(database: DatabaseService, paymentIntentId: string, type: string): Promise<void> {
  const result = await database.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM payment_schema.ledger_entries WHERE payment_intent_id = $1::uuid AND entry_type = $2`,
    [paymentIntentId, type],
  );
  expect(result.rows[0].count).toBe('1');
}
