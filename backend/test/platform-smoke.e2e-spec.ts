import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import nock from 'nock';
import request from 'supertest';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { TelemedSessionStartWorker } from '../src/modules/telemed/telemed-session-start.worker';
import { NestRoot } from '../src/nest-root-full';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service';

jest.setTimeout(45_000);

/**
 * Uses only UUID values because JwtAuthGuard and TraceContext correctly reject
 * arbitrary strings. The values remain deterministic to simplify SQL triage.
 */
const IDS = {
  owner: '11111111-1111-4111-8111-111111111111',
  receptionist: '22222222-2222-4222-8222-222222222222',
  pet: '33333333-3333-4333-8333-333333333333',
  clinic: '44444444-4444-4444-8444-444444444444',
  location: '55555555-5555-4555-8555-555555555555',
  service: '66666666-6666-4666-8666-666666666666',
  slot1: '77777777-7777-4777-8777-777777777777',
  slot2: '88888888-8888-4888-8888-888888888888',
  trace: '99999999-9999-4999-8999-999999999999',
  holdCreateKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
  let database: DatabaseService;
  let ownerToken: string;
  let receptionistToken: string;
  let holdId: string;

  beforeAll(async () => {
    /* Worker timers remain disabled; individual workers are called deterministically below. */
    process.env.WORKERS_ENABLED = 'false';
    process.env.ACQUIRING_API_BASE_URL = acquiringBaseUrl;
    process.env.ACQUIRING_API_KEY = 'platform-smoke-acquiring-key';
    process.env.ACQUIRING_WEBHOOK_SECRET = acquiringWebhookSecret;

    nock.disableNetConnect();

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

  it('preserves one correlation ID through hold, clinic alternative, payment and telemed activation', async () => {
    // Step 1 — Level C local hold. Current Booking Core materializes the
    // manual queue directly as MANUAL_CONFIRM_PENDING; it has no separate
    // LOCAL_HOLD_CREATED persisted state.
    await assertHttpLockBudget(database);
    const createHold = await request(app.getHttpServer())
      .post('/v1/booking-holds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.holdCreateKey)
      .set('X-Correlation-ID', IDS.trace)
      .send({ slotId: IDS.slot1, petId: IDS.pet })
      .expect(201);

    holdId = createHold.body.holdId as string;
    expect(holdId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(createHold.body.state).toBe('MANUAL_CONFIRM_PENDING');

    const created = await readHold(database, holdId);
    expect(created).toMatchObject({ state: 'MANUAL_CONFIRM_PENDING', slot_id: IDS.slot1, alternative_slot_id: null });
    expect(created.confirmation_sla_expires_at).not.toBeNull();
    await expectOutboxCorrelation(database, 'booking.hold.created.v1', holdId);

    // Step 2 — emulate generic relay. It publishes the durable event without
    // mutating the already materialized Level-C manual queue.
    await app.get(OutboxRelayService).poll();
    const postRelay = await readHold(database, holdId);
    expect(postRelay.state).toBe('MANUAL_CONFIRM_PENDING');
    const slaWindow = await database.query<{ valid: boolean }>(`
      SELECT confirmation_sla_expires_at > clock_timestamp() + interval '14 minutes'
             AND confirmation_sla_expires_at < clock_timestamp() + interval '16 minutes' AS valid
      FROM booking_schema.booking_holds
      WHERE id = $1::uuid
    `, [holdId]);
    expect(slaWindow.rows[0]?.valid).toBe(true);

    // Step 3 — clinic offers a second slot. Both counters must remain held.
    await assertHttpLockBudget(database);
    const proposal = await request(app.getHttpServer())
      .post(`/v1/clinic/booking-holds/${holdId}/alternative-slot`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .set('X-Correlation-ID', IDS.trace)
      .send({ newSlotId: IDS.slot2 })
      .expect(200);

    expect(proposal.body).toMatchObject({ holdId, sourceSlotId: IDS.slot1, alternativeSlotId: IDS.slot2, state: 'ALTERNATIVE_PENDING' });
    const proposedInvariant = await database.query<{
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
    `, [holdId, IDS.slot1, IDS.slot2]);
    expect(proposedInvariant.rows[0]).toMatchObject({
      state: 'ALTERNATIVE_PENDING',
      alternative_slot_id: IDS.slot2,
      source_held: 1,
      source_status: 'LOCKED_BY_HOLD',
      alternative_held: 1,
      alternative_status: 'LOCKED_BY_HOLD',
    });

    // Step 4 — owner accepts. Source is returned to marketplace, alternative
    // remains held in MIS_HELD until payment confirmation.
    await assertHttpLockBudget(database);
    const accepted = await request(app.getHttpServer())
      .post(`/v1/booking-holds/${holdId}/alternative-slot/accept`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Correlation-ID', IDS.trace)
      .send({})
      .expect(200);
    expect(accepted.body).toMatchObject({ holdId, sourceSlotId: IDS.slot1, slotId: IDS.slot2, state: 'MIS_HELD' });

    const acceptedInvariant = await database.query<{
      state: string;
      slot_id: string;
      source_held: number;
      source_status: string;
      second_held: number;
      second_booked: number;
      second_status: string;
    }>(`
      SELECT
        (SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid) AS state,
        (SELECT slot_id::text FROM booking_schema.booking_holds WHERE id = $1::uuid) AS slot_id,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS source_held,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS source_status,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS second_held,
        (SELECT booked_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS second_booked,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS second_status
    `, [holdId, IDS.slot1, IDS.slot2]);
    expect(acceptedInvariant.rows[0]).toMatchObject({
      state: 'MIS_HELD',
      slot_id: IDS.slot2,
      source_held: 0,
      source_status: 'AVAILABLE',
      second_held: 1,
      second_booked: 0,
      second_status: 'LOCKED_BY_HOLD',
    });

    // Step 5 — acquiring intent and signed authorization webhook.
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

    const webhookBody = JSON.stringify({
      idempotencyKey: intent.body.idempotencyKey,
      eventId: IDS.providerEvent,
      providerPaymentId,
    });
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

    const paymentInvariant = await database.query<{
      payment_status: string;
      hold_state: string;
      held_count: number;
      booked_count: number;
      slot_status: string;
      telemed_events: string;
      telemed_correlation_id: string | null;
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
    expect(paymentInvariant.rows[0]).toMatchObject({
      payment_status: 'AUTHORIZED',
      hold_state: 'CONFIRMED',
      held_count: 0,
      booked_count: 1,
      slot_status: 'BOOKED',
      telemed_events: '1',
      telemed_correlation_id: IDS.trace,
    });

    // Step 6 — durable CONFIRMED -> telemed outbox relay.
    const previousWorkers = process.env.WORKERS_ENABLED;
    process.env.WORKERS_ENABLED = 'true';
    try {
      await app.get(TelemedSessionStartWorker).relayConfirmedSessions();
    } finally {
      process.env.WORKERS_ENABLED = previousWorkers;
    }

    const telemed = await database.query<{ state: string; correlation_id: string | null }>(`
      SELECT state, correlation_id::text AS correlation_id
      FROM telemed_schema.telemed_sessions
      WHERE booking_hold_id = $1::uuid
    `, [holdId]);
    expect(telemed.rows[0]).toEqual({ state: 'WAITING_FOR_DOCTOR', correlation_id: IDS.trace });

    const audit = await database.query<{ count: string; all_match: boolean }>(`
      SELECT COUNT(*)::text AS count,
             COALESCE(bool_and(correlation_id = $2::uuid), false) AS all_match
      FROM audit_schema.audit_log
      WHERE aggregate_type = 'booking_hold'
        AND aggregate_id = $1::uuid
    `, [holdId, IDS.trace]);
    expect(Number(audit.rows[0]?.count)).toBeGreaterThanOrEqual(3);
    expect(audit.rows[0]?.all_match).toBe(true);
  });
});

async function assertHttpLockBudget(database: DatabaseService): Promise<void> {
  await database.withTransaction(async (client) => {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
    const settings = await client.query<{ lock_timeout: string; statement_timeout: string }>(`
      SELECT current_setting('lock_timeout') AS lock_timeout,
             current_setting('statement_timeout') AS statement_timeout
    `);
    expect(settings.rows[0]).toEqual({ lock_timeout: '50ms', statement_timeout: '50ms' });
  });
}

async function readHold(database: DatabaseService, holdId: string): Promise<HoldSnapshot> {
  const result = await database.query<HoldSnapshot>(`
    SELECT id, state, slot_id::text, alternative_slot_id::text, confirmation_sla_expires_at
    FROM booking_schema.booking_holds
    WHERE id = $1::uuid
  `, [holdId]);
  expect(result.rows[0]).toBeDefined();
  return result.rows[0];
}

async function expectOutboxCorrelation(database: DatabaseService, eventType: string, aggregateId: string): Promise<void> {
  const result = await database.query<{ correlation_id: string | null }>(`
    SELECT correlation_id::text AS correlation_id
    FROM booking_schema.outbox_events
    WHERE event_type = $1
      AND aggregate_type = 'booking_hold'
      AND aggregate_id = $2::uuid
    ORDER BY created_at, id
    LIMIT 1
  `, [eventType, aggregateId]);
  expect(result.rows[0]?.correlation_id).toBe(IDS.trace);
}

async function resetFixtures(database: DatabaseService): Promise<void> {
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log CASCADE');

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid), ($2::uuid)', [IDS.owner, IDS.receptionist]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Platform smoke pet', 'DOG')`, [IDS.pet, IDS.owner]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Platform Smoke LLC', 'Platform Smoke Clinic')`, [IDS.clinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Smoke street 1')`, [IDS.location, IDS.clinic]);
  await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role) VALUES ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST')`, [IDS.receptionist, IDS.location]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'SMOKE_VISIT', 'Smoke visit', 30)`, [IDS.service, IDS.location]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots (
      id, clinic_location_id, service_id, starts_at, ends_at,
      capacity, status, integration_mode, last_freshness_sync
    ) VALUES
      ($1::uuid, $3::uuid, $5::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 'AVAILABLE', 'LEVEL_C', clock_timestamp()),
      ($2::uuid, $3::uuid, $5::uuid, clock_timestamp() + interval '3 hours', clock_timestamp() + interval '210 minutes', 1, 'AVAILABLE', 'LEVEL_C', clock_timestamp())
  `, [IDS.slot1, IDS.slot2, IDS.location, IDS.clinic, IDS.service]);
}
