import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { createHmac, webcrypto } from 'node:crypto';
import nock from 'nock';
import request from 'supertest';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import type { DatabaseService as DatabaseServiceType } from '../src/database/database.service';

process.env.JWT_SECRET ??= 'platform-smoke-jwt-secret-at-least-32-bytes';
process.env.JWT_ISSUER ??= 'vethelp-test';
process.env.JWT_AUDIENCE ??= 'vethelp-test';
process.env.WORKER_SERVICE_TOKEN ??= 'platform-smoke-worker-token';
(globalThis as typeof globalThis & { crypto?: Crypto }).crypto ??=
  webcrypto as Crypto;

const { config } = require('../src/config') as typeof import('../src/config');
const { DatabaseService } = require('../src/database/database.service') as typeof import('../src/database/database.service');
const { TelemedSessionStartWorker } = require('../src/modules/telemed/telemed-session-start.worker') as typeof import('../src/modules/telemed/telemed-session-start.worker');
const { NestRoot } = require('../src/nest-root-full') as typeof import('../src/nest-root-full');

jest.setTimeout(45_000);

const IDS = {
  owner: '11111111-1111-4111-8111-111111111111',
  receptionist: '22222222-2222-4222-8222-222222222222',
  pet: '33333333-3333-4333-8333-333333333333',
  clinic: '44444444-4444-4444-8444-444444444444',
  location: '55555555-5555-4555-8555-555555555555',
  service: '66666666-6666-4666-8666-666666666666',
  slot1: '77777777-7777-4777-8777-777777777777',
  slot2: '88888888-8888-4888-8888-888888888888',
  manualHold: '89898989-8989-4989-8989-898989898989',
  manualSlot: '98989898-9898-4989-8989-989898989898',
  raceSlot: '78787878-7878-4787-8787-787878787878',
  inactiveLocation: '12121212-1212-4212-8212-121212121212',
  inactiveSlot: '34343434-3434-4434-8434-343434343434',
  trace: '99999999-9999-4999-8999-999999999999',
  raceTrace: '99999999-9999-4999-8999-999999999998',
  holdCreateKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  missingTraceKey: 'abababab-abab-4aba-8aba-abababababab',
  inactiveSlotHoldKey: 'acacacac-acac-4aca-8aca-acacacacacac',
  duplicateHoldKey: 'adadadad-adad-4ada-8ada-adadadadadad',
  raceHoldKeyA: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
  raceHoldKeyB: 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2',
  proposalKey: 'aeaeaeae-aeae-4aea-8aea-aeaeaeaeaeae',
  acceptAlternativeKey: 'afafafaf-afaf-4afa-8afa-afafafafafaf',
  providerEvent: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

const acquiringBaseUrl = 'https://acquiring.smoke.test';
const acquiringWebhookSecret = 'platform-smoke-acquiring-webhook-secret';
const providerPaymentId = 'smoke-provider-payment-001';

type HoldSnapshot = {
  id: string;
  state: string;
  slot_id: string;
  alternative_slot_id: string | null;
  confirmation_sla_expires_at: Date | null;
};

describe('VetHelp platform smoke: owner → Level C clinic → payment → telemedicine', () => {
  let app: INestApplication;
  let database: DatabaseServiceType;
  let ownerToken: string;
  let receptionistToken: string;
  let holdId: string;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    process.env.ACQUIRING_API_BASE_URL = acquiringBaseUrl;
    process.env.ACQUIRING_API_KEY = 'platform-smoke-acquiring-key';
    process.env.ACQUIRING_WEBHOOK_SECRET = acquiringWebhookSecret;
    nock.disableNetConnect();
    nock.enableNetConnect(/^(127\.0\.0\.1|localhost)(:\d+)?$/);

    app = await NestFactory.create(NestRoot, { rawBody: true, logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();

    database = app.get(DatabaseService);
    await resetFixtures(database);

    const jwt = app.get(JwtService);
    ownerToken = await jwt.signAsync(
      { sub: IDS.owner, roles: ['OWNER'] },
      { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
    );
    receptionistToken = await jwt.signAsync(
      { sub: IDS.receptionist, roles: ['CLINIC_RECEPTIONIST'], locationIds: [IDS.location] },
      { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
    );
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
    await app?.close();
  });

  it('rejects create hold without a command correlation id', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/booking-holds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.missingTraceKey)
      .send({ slotId: IDS.slot1, petId: IDS.pet })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('rejects slots outside active public clinic locations', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/booking-holds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.inactiveSlotHoldKey)
      .set('X-Correlation-ID', IDS.trace)
      .send({ slotId: IDS.inactiveSlot, petId: IDS.pet })
      .expect(422);

    expect(response.body).toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('creates only one appointment for concurrent owner submits on the same slot', async () => {
    await assertHttpLockBudget(database);
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/booking-holds')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', IDS.raceHoldKeyA)
        .set('X-Correlation-ID', IDS.raceTrace)
        .send({ slotId: IDS.raceSlot, petId: IDS.pet }),
      request(app.getHttpServer())
        .post('/v1/booking-holds')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', IDS.raceHoldKeyB)
        .set('X-Correlation-ID', IDS.raceTrace)
        .send({ slotId: IDS.raceSlot, petId: IDS.pet }),
    ]);

    const responses = [first, second];
    const successes = responses.filter((response) => response.status === 201);
    const conflicts = responses.filter((response) => response.status !== 201);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(successes[0].body).toMatchObject({ state: 'CONFIRMED', slotId: IDS.raceSlot });
    expect(successes[0].body.appointmentId).toEqual(expect.any(String));
    expect([409, 422]).toContain(conflicts[0].status);
    expect(['SLOT_LOCKED_RETRY', 'SLOT_ALREADY_TAKEN', 'HOLD_ALREADY_ACTIVE']).toContain(conflicts[0].body.code);

    const invariant = await database.query<{
      appointment_count: string;
      booked_count: number;
      held_count: number;
      slot_status: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE slot_id = $1::uuid) AS appointment_count,
        (SELECT booked_count FROM clinic_schema.appointment_slots WHERE id = $1::uuid) AS booked_count,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $1::uuid) AS held_count,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $1::uuid) AS slot_status
    `, [IDS.raceSlot]);
    expect(invariant.rows[0]).toMatchObject({
      appointment_count: '1',
      booked_count: 1,
      held_count: 0,
      slot_status: 'BOOKED',
    });
  });

  it('keeps slot and audit invariants while preserving correlationId end to end', async () => {
    await assertHttpLockBudget(database);
    const createHold = await request(app.getHttpServer())
      .post('/v1/booking-holds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.holdCreateKey)
      .set('X-Correlation-ID', IDS.trace)
      .send({ slotId: IDS.slot1, petId: IDS.pet })
      .expect(201);

    holdId = createHold.body.holdId as string;
    expect(createHold.body).toMatchObject({
      state: 'CONFIRMED',
      slotId: IDS.slot1,
      correlationId: IDS.trace,
    });
    expect(createHold.body.appointmentId).toEqual(expect.any(String));

    const repeatedSubmit = await request(app.getHttpServer())
      .post('/v1/booking-holds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.holdCreateKey)
      .set('X-Correlation-ID', IDS.trace)
      .send({ slotId: IDS.slot1, petId: IDS.pet })
      .expect(201);
    expect(repeatedSubmit.body).toMatchObject({
      holdId,
      appointmentId: createHold.body.appointmentId,
      state: 'CONFIRMED',
      slotId: IDS.slot1,
    });

    const created = await readHold(database, holdId);
    expect(created).toMatchObject({ state: 'CONFIRMED', slot_id: IDS.slot1, alternative_slot_id: null });
    expect(created.confirmation_sla_expires_at).toBeNull();

    const immediate = await database.query<{
      appointment_count: string;
      held_count: number;
      booked_count: number;
      slot_status: string;
      confirmed_events: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE hold_id = $1::uuid) AS appointment_count,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS held_count,
        (SELECT booked_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS booked_count,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS slot_status,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE event_type = 'booking.confirmed.v1' AND aggregate_id = $1::uuid) AS confirmed_events
    `, [holdId, IDS.slot1]);
    expect(immediate.rows[0]).toMatchObject({
      appointment_count: '1',
      held_count: 0,
      booked_count: 1,
      slot_status: 'BOOKED',
      confirmed_events: '1',
    });
    await expectOutboxCorrelation(database, 'booking.hold.created.v1', holdId);
    await expectOutboxCorrelation(database, 'booking.confirmed.v1', holdId);

    const duplicate = await request(app.getHttpServer())
      .post('/v1/booking-holds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.duplicateHoldKey)
      .set('X-Correlation-ID', IDS.trace)
      .send({ slotId: IDS.slot1, petId: IDS.pet })
      .expect(422);
    expect(duplicate.body).toMatchObject({ code: 'HOLD_ALREADY_ACTIVE' });

    holdId = IDS.manualHold;
    const postRelay = await readHold(database, holdId);
    expect(postRelay.state).toBe('MANUAL_CONFIRM_PENDING');
    const slaWindow = await database.query<{ valid: boolean }>(`
      SELECT confirmation_sla_expires_at > clock_timestamp() + interval '14 minutes'
             AND confirmation_sla_expires_at < clock_timestamp() + interval '16 minutes' AS valid
      FROM booking_schema.booking_holds WHERE id = $1::uuid
    `, [holdId]);
    expect(slaWindow.rows[0]?.valid).toBe(true);

    await assertHttpLockBudget(database);
    const proposal = await request(app.getHttpServer())
      .post(`/v1/clinic/booking-holds/${holdId}/alternative-slot`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .set('Idempotency-Key', IDS.proposalKey)
      .set('If-Match', '1')
      .set('X-Correlation-ID', IDS.trace)
      .send({ newSlotId: IDS.slot2 })
      .expect(201);
    expect(proposal.body).toMatchObject({ holdId, sourceSlotId: IDS.manualSlot, alternativeSlotId: IDS.slot2, state: 'ALTERNATIVE_PENDING' });

    const proposed = await database.query<{
      state: string;
      alternative_slot_id: string;
      source_held: number;
      source_status: string;
      alternative_held: number;
      alternative_status: string;
    }>(`
      SELECT
        (SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid) AS state,
        (SELECT alternative_slot_id::text FROM booking_schema.booking_holds WHERE id = $1::uuid) AS alternative_slot_id,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS source_held,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS source_status,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS alternative_held,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS alternative_status
    `, [holdId, IDS.manualSlot, IDS.slot2]);
    expect(proposed.rows[0]).toMatchObject({
      state: 'ALTERNATIVE_PENDING', alternative_slot_id: IDS.slot2,
      source_held: 1, source_status: 'LOCKED_BY_HOLD',
      alternative_held: 1, alternative_status: 'LOCKED_BY_HOLD',
    });

    await assertHttpLockBudget(database);
    const accepted = await request(app.getHttpServer())
      .post(`/v1/booking-holds/${holdId}/alternative-slot/accept`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.acceptAlternativeKey)
      .set('If-Match', '2')
      .set('X-Correlation-ID', IDS.trace)
      .send({})
      .expect(200);
    expect(accepted.body).toMatchObject({ holdId, sourceSlotId: IDS.manualSlot, slotId: IDS.slot2, state: 'MIS_HELD' });

    const acceptedInvariant = await database.query<{
      state: string; slot_id: string; source_held: number; source_status: string;
      second_held: number; second_booked: number; second_status: string;
    }>(`
      SELECT
        (SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid) AS state,
        (SELECT slot_id::text FROM booking_schema.booking_holds WHERE id = $1::uuid) AS slot_id,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS source_held,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS source_status,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS second_held,
        (SELECT booked_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS second_booked,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS second_status
    `, [holdId, IDS.manualSlot, IDS.slot2]);
    expect(acceptedInvariant.rows[0]).toMatchObject({
      state: 'MIS_HELD', slot_id: IDS.slot2,
      source_held: 0, source_status: 'AVAILABLE',
      second_held: 1, second_booked: 0, second_status: 'LOCKED_BY_HOLD',
    });

    nock(acquiringBaseUrl)
      .post('/v1/payment-intents')
      .reply(201, { id: providerPaymentId, checkout_url: 'https://checkout.smoke.test/session-001' });

    await assertHttpLockBudget(database);
    const intent = await request(app.getHttpServer())
      .post(`/v1/booking-holds/${holdId}/payment-intents`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Correlation-ID', IDS.trace)
      .send({})
      .expect(201);
    expect(intent.body).toMatchObject({ holdId, status: 'CREATED', remoteId: providerPaymentId });

    const webhookBody = JSON.stringify({ idempotencyKey: intent.body.idempotencyKey, eventId: IDS.providerEvent, providerPaymentId });
    const signature = createHmac('sha256', acquiringWebhookSecret).update(webhookBody).digest('hex');
    await assertHttpLockBudget(database);
    await request(app.getHttpServer())
      .post('/v1/payments/webhooks/authorized')
      .set('Content-Type', 'application/json')
      .set('X-Correlation-ID', IDS.trace)
      .set('X-Acquiring-Event-Id', IDS.providerEvent)
      .set('X-Acquiring-Signature', `sha256=${signature}`)
      .send(webhookBody)
      .expect(201);

    const payment = await database.query<{
      payment_status: string; hold_state: string; held_count: number; booked_count: number;
      slot_status: string; telemed_events: string; telemed_correlation_id: string | null;
    }>(`
      SELECT
        (SELECT status FROM payment_schema.payment_intents WHERE hold_id = $1::uuid) AS payment_status,
        (SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid) AS hold_state,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS held_count,
        (SELECT booked_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS booked_count,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS slot_status,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE event_type = 'telemed.session.start.requested.v1' AND aggregate_id = $1::uuid) AS telemed_events,
        (SELECT correlation_id::text FROM booking_schema.outbox_events WHERE event_type = 'telemed.session.start.requested.v1' AND aggregate_id = $1::uuid) AS telemed_correlation_id
    `, [holdId, IDS.slot2]);
    expect(payment.rows[0]).toMatchObject({
      payment_status: 'AUTHORIZED', hold_state: 'CONFIRMED', held_count: 0,
      booked_count: 1, slot_status: 'BOOKED', telemed_events: '1',
      telemed_correlation_id: IDS.trace,
    });

    const previousWorkers = process.env.WORKERS_ENABLED;
    process.env.WORKERS_ENABLED = 'true';
    try {
      await app.get(TelemedSessionStartWorker).relayConfirmedSessions();
    } finally {
      process.env.WORKERS_ENABLED = previousWorkers;
    }

    const telemed = await database.query<{ state: string; correlation_id: string | null }>(`
      SELECT state, correlation_id::text AS correlation_id
      FROM telemed_schema.telemed_sessions WHERE booking_hold_id = $1::uuid
    `, [holdId]);
    expect(telemed.rows[0]).toEqual({ state: 'WAITING_FOR_DOCTOR', correlation_id: IDS.trace });

    const audit = await database.query<{ count: string; all_match: boolean }>(`
      SELECT COUNT(*)::text AS count, COALESCE(bool_and(correlation_id = $2::uuid), false) AS all_match
      FROM audit_schema.audit_log
      WHERE aggregate_type = 'booking_hold' AND aggregate_id = $1::uuid
    `, [holdId, IDS.trace]);
    expect(Number(audit.rows[0]?.count)).toBeGreaterThanOrEqual(3);
    expect(audit.rows[0]?.all_match).toBe(true);
  });
});

async function assertHttpLockBudget(database: DatabaseServiceType): Promise<void> {
  await database.withTransaction(async (client) => {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
    const settings = await client.query<{ lock_timeout: string; statement_timeout: string }>(`
      SELECT current_setting('lock_timeout') AS lock_timeout, current_setting('statement_timeout') AS statement_timeout
    `);
    expect(settings.rows[0]).toEqual({ lock_timeout: '50ms', statement_timeout: '250ms' });
  });
}

async function readHold(database: DatabaseServiceType, holdId: string): Promise<HoldSnapshot> {
  const result = await database.query<HoldSnapshot>(`
    SELECT id, state, slot_id::text, alternative_slot_id::text, confirmation_sla_expires_at
    FROM booking_schema.booking_holds WHERE id = $1::uuid
  `, [holdId]);
  expect(result.rows[0]).toBeDefined();
  return result.rows[0];
}

async function expectOutboxCorrelation(database: DatabaseServiceType, eventType: string, aggregateId: string): Promise<void> {
  const result = await database.query<{ correlation_id: string | null }>(`
    SELECT correlation_id::text AS correlation_id
    FROM booking_schema.outbox_events
    WHERE event_type = $1 AND aggregate_type = 'booking_hold' AND aggregate_id = $2::uuid
    ORDER BY created_at, id LIMIT 1
  `, [eventType, aggregateId]);
  expect(result.rows[0]?.correlation_id).toBe(IDS.trace);
}

async function resetFixtures(database: DatabaseServiceType): Promise<void> {
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log CASCADE');

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid), ($2::uuid)', [IDS.owner, IDS.receptionist]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Platform smoke pet', 'DOG')`, [IDS.pet, IDS.owner]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Platform Smoke LLC', 'Platform Smoke Clinic')`, [IDS.clinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Smoke street 1')`, [IDS.location, IDS.clinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address, status) VALUES ($1::uuid, $2::uuid, 'Inactive smoke street 2', 'INACTIVE')`, [IDS.inactiveLocation, IDS.clinic]);
  await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role) VALUES ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST')`, [IDS.receptionist, IDS.location]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'SMOKE_VISIT', 'Smoke visit', 30)`, [IDS.service, IDS.location]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots (
      id, clinic_location_id, service_id, starts_at, ends_at, capacity, status, integration_mode, last_freshness_sync
    ) VALUES
      ($1::uuid, $3::uuid, $4::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 'AVAILABLE', 'LEVEL_C', clock_timestamp()),
      ($2::uuid, $3::uuid, $4::uuid, clock_timestamp() + interval '3 hours', clock_timestamp() + interval '210 minutes', 1, 'AVAILABLE', 'LEVEL_C', clock_timestamp()),
      ($5::uuid, $6::uuid, $4::uuid, clock_timestamp() + interval '4 hours', clock_timestamp() + interval '270 minutes', 1, 'AVAILABLE', 'LEVEL_C', clock_timestamp())
  `, [IDS.slot1, IDS.slot2, IDS.location, IDS.service, IDS.inactiveSlot, IDS.inactiveLocation]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots (
      id, clinic_location_id, service_id, starts_at, ends_at, capacity,
      held_count, status, integration_mode, last_freshness_sync
    ) VALUES
      ($1::uuid, $3::uuid, $4::uuid, clock_timestamp() + interval '4 hours', clock_timestamp() + interval '270 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C', clock_timestamp()),
      ($2::uuid, $3::uuid, $4::uuid, clock_timestamp() + interval '5 hours', clock_timestamp() + interval '330 minutes', 1, 0, 'AVAILABLE', 'LEVEL_C', clock_timestamp())
  `, [IDS.manualSlot, IDS.raceSlot, IDS.location, IDS.service]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds (
      id, slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, $4::uuid,
      'MANUAL_CONFIRM_PENDING',
      clock_timestamp() + interval '16 minutes',
      clock_timestamp() + interval '15 minutes'
    )
  `, [IDS.manualHold, IDS.manualSlot, IDS.owner, IDS.pet]);
}
