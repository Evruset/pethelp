import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { createHash, randomUUID } from 'node:crypto';
import nock from 'nock';
import { DatabaseService } from '../src/database/database.service';
import { AcquiringClient } from '../src/modules/payments/acquiring-client.service';
import { PaymentOutboxRelayWorker } from '../src/modules/payments/payment-outbox-relay.worker';
import { PaymentReconciliationWorker } from '../src/modules/payments/payment-reconciliation.worker';
import { PaymentService } from '../src/modules/payments/payment.service';

const PROVIDER_URL = 'https://capture.acquiring.test';
const PROVIDER_KEY = 'capture-test-api-key';
const REMOTE_ID = 'remote-intent-capture-1';

jest.setTimeout(30_000);

describe('Remote acquiring intent and two-phase capture', () => {
  let database: DatabaseService;
  let service: PaymentService;
  let relay: PaymentOutboxRelayWorker;
  let reconciliation: PaymentReconciliationWorker;

  beforeAll(() => {
    process.env.WORKERS_ENABLED = 'true';
    process.env.ACQUIRING_API_BASE_URL = PROVIDER_URL;
    process.env.ACQUIRING_API_KEY = PROVIDER_KEY;

    database = new DatabaseService();
    const client = new AcquiringClient(new HttpService(axios.create({ proxy: false })));
    service = new PaymentService(database, client);
    relay = new PaymentOutboxRelayWorker(database, client);
    reconciliation = new PaymentReconciliationWorker(database, client);
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

  it('creates checkout remotely and captures only through outbox plus reconciliation', async () => {
    const fixture = await createFixture(database);
    const createScope = nock(PROVIDER_URL)
      .matchHeader('authorization', `Bearer ${PROVIDER_KEY}`)
      .matchHeader('idempotency-key', (value: string) => value.length > 0)
      .post('/v1/payment-intents', (body: { merchantPaymentId?: unknown; amount?: unknown }) => typeof body.merchantPaymentId === 'string' && body.amount === 1000)
      .reply(201, { remoteId: REMOTE_ID, checkoutUrl: 'https://checkout.test/capture-1' });

    const intent = await service.createPaymentIntent(fixture.holdId, fixture.ownerId);

    expect(createScope.isDone()).toBe(true);
    expect(intent.status).toBe('CREATED');
    expect(intent.remoteId).toBe(REMOTE_ID);
    expect(intent.checkoutUrl).toBe('https://checkout.test/capture-1');
    await expectStatus(database, intent.id, 'CREATED');

    const providerEventId = 'capture-authorized-event';
    const rawPayload = JSON.stringify({ idempotencyKey: intent.idempotencyKey, eventId: providerEventId, providerPaymentId: REMOTE_ID });
    const authorized = await service.handlePaymentAuthorized({
      idempotencyKey: intent.idempotencyKey,
      providerEventId,
      providerPaymentId: REMOTE_ID,
      rawPayload,
      payloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
    });

    expect(authorized.status).toBe('AUTHORIZED');
    await expectStatus(database, intent.id, 'AUTHORIZED');
    await expectHoldState(database, fixture.holdId, 'CONFIRMED');
    await expectOutbox(database, intent.id, 'payment.acquiring.capture.requested.v1', 'PENDING');

    const captureScope = nock(PROVIDER_URL)
      .matchHeader('authorization', `Bearer ${PROVIDER_KEY}`)
      .matchHeader('idempotency-key', `capture:${intent.id}`)
      .post(`/v1/payment-intents/${REMOTE_ID}/capture`, { merchantPaymentId: intent.id })
      .reply(200, { captured: true });
    await relay.relay();
    expect(captureScope.isDone()).toBe(true);
    await expectTimestamp(database, intent.id, 'capture_sent_at', true);
    await expectLedger(database, intent.id, 'CAPTURE_SENT');
    await expectStatus(database, intent.id, 'AUTHORIZED');

    const stateScope = nock(PROVIDER_URL)
      .matchHeader('authorization', `Bearer ${PROVIDER_KEY}`)
      .get(`/v1/payment-intents/${REMOTE_ID}`)
      .reply(200, { status: 'CAPTURED' });
    await reconciliation.reconcile();
    expect(stateScope.isDone()).toBe(true);

    await expectStatus(database, intent.id, 'CAPTURED');
    await expectTimestamp(database, intent.id, 'capture_confirmed_at', true);
    await expectLedger(database, intent.id, 'CAPTURE_CONFIRMED');
  });

  it('persists FAILED when remote checkout creation is unavailable', async () => {
    const fixture = await createFixture(database);
    const createScope = nock(PROVIDER_URL)
      .matchHeader('authorization', `Bearer ${PROVIDER_KEY}`)
      .post('/v1/payment-intents')
      .reply(500, { message: 'provider unavailable' });

    await expect(service.createPaymentIntent(fixture.holdId, fixture.ownerId)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACQUIRING_PROVIDER_UNAVAILABLE' }),
    });
    expect(createScope.isDone()).toBe(true);

    const result = await database.query<{ status: string; provider_last_error: string | null }>(`
      SELECT status, provider_last_error
      FROM payment_schema.payment_intents
      WHERE hold_id = $1::uuid
    `, [fixture.holdId]);
    expect(result.rows[0]?.status).toBe('FAILED');
    expect(result.rows[0]?.provider_last_error).toBeTruthy();
  });
});

async function createFixture(database: DatabaseService): Promise<{ ownerId: string; holdId: string }> {
  const ownerId = randomUUID();
  const petId = randomUUID();
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const serviceId = randomUUID();
  const slotId = randomUUID();
  const holdId = randomUUID();

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Capture Pet', 'DOG')`, [petId, ownerId]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Capture Clinic LLC', 'Capture Clinic')`, [clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Capture test address')`, [locationId, clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'CAPTURE_TEST', 'Capture test', 30)`, [serviceId, locationId]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, service_id, starts_at, ends_at, capacity, held_count) VALUES ($1::uuid, $2::uuid, $3::uuid, clock_timestamp() + interval '1 hour', clock_timestamp() + interval '90 minutes', 1, 1)`, [slotId, locationId, serviceId]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'MIS_HELD', clock_timestamp() + interval '10 minutes')`, [holdId, slotId, ownerId, petId]);
  return { ownerId, holdId };
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

async function expectStatus(database: DatabaseService, paymentId: string, status: string): Promise<void> {
  const result = await database.query<{ status: string }>('SELECT status FROM payment_schema.payment_intents WHERE id = $1::uuid', [paymentId]);
  expect(result.rows[0]?.status).toBe(status);
}

async function expectHoldState(database: DatabaseService, holdId: string, state: string): Promise<void> {
  const result = await database.query<{ state: string }>('SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid', [holdId]);
  expect(result.rows[0]?.state).toBe(state);
}

async function expectOutbox(database: DatabaseService, paymentId: string, eventType: string, status: string): Promise<void> {
  const result = await database.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM booking_schema.outbox_events
    WHERE aggregate_id = $1::uuid AND event_type = $2 AND status = $3
  `, [paymentId, eventType, status]);
  expect(result.rows[0]?.count).toBe('1');
}

async function expectTimestamp(database: DatabaseService, paymentId: string, column: 'capture_sent_at' | 'capture_confirmed_at', expected: boolean): Promise<void> {
  const result = await database.query<{ value: Date | null }>(`SELECT ${column} AS value FROM payment_schema.payment_intents WHERE id = $1::uuid`, [paymentId]);
  expect(Boolean(result.rows[0]?.value)).toBe(expected);
}

async function expectLedger(database: DatabaseService, paymentId: string, type: string): Promise<void> {
  const result = await database.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM payment_schema.ledger_entries
    WHERE payment_intent_id = $1::uuid AND entry_type = $2
  `, [paymentId, type]);
  expect(result.rows[0]?.count).toBe('1');
}
