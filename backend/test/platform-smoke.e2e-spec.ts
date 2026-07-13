import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { createHmac } from 'node:crypto';
import nock from 'nock';
import request from 'supertest';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { CapabilityEvaluatorService } from '../src/auth/capability-evaluator.service';
import { Role } from '../src/auth/auth.types';
import { config } from '../src/config';
import { featureFlags } from '../src/config/feature-flags.config';
import { DatabaseService } from '../src/database/database.service';
import { TelemedSessionStartWorker } from '../src/modules/telemed/telemed-session-start.worker';
import { NestRoot } from '../src/nest-root-full';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service';

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
  inactiveLocation: '12121212-1212-4212-8212-121212121212',
  inactiveSlot: '34343434-3434-4434-8434-343434343434',
  trace: '99999999-9999-4999-8999-999999999999',
  holdCreateKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  missingTraceKey: 'abababab-abab-4aba-8aba-abababababab',
  inactiveSlotHoldKey: 'acacacac-acac-4aca-8aca-acacacacacac',
  duplicateHoldKey: 'adadadad-adad-4ada-8ada-adadadadadad',
  proposalKey: 'aeaeaeae-aeae-4aea-8aea-aeaeaeaeaeae',
  acceptAlternativeKey: 'afafafaf-afaf-4afa-8afa-afafafafafaf',
  providerEvent: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

const acquiringBaseUrl = 'https://acquiring.smoke.test';
const acquiringWebhookSecret = 'platform-smoke-acquiring-webhook-secret';
const providerPaymentId = 'smoke-provider-payment-001';
const QUALITY = {
  allowed: '10101010-1010-4010-8010-101010101010',
  deniedRole: '20202020-2020-4020-8020-202020202020',
  otherClinicEmployee: '30303030-3030-4030-8030-303030303030',
  otherLocationEmployee: '40404040-4040-4040-8040-404040404040',
  inactiveMembershipEmployee: '50505050-5050-4050-8050-505050505050',
  revokedMembershipEmployee: '60606060-6060-4060-8060-606060606060',
  clinic: '70707070-7070-4070-8070-707070707070',
  location: '80808080-8080-4080-8080-808080808080',
  otherClinic: '90909090-9090-4090-8090-909090909090',
  sameClinicOtherLocation: 'a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0',
  otherClinicLocation: 'b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b0b0',
};
const REPLAY = {
  owner: 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  pet: 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
  service: 'e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0',
  slot: 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0',
  hold: 'abababab-1111-4111-8111-111111111111',
};

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

  it('keeps slot and audit invariants while preserving correlationId end to end', async () => {
    // Current persisted model materializes Level-C holds directly as
    // MANUAL_CONFIRM_PENDING; LOCAL_HOLD_CREATED is a logical API phase only.
    await assertHttpLockBudget(database);
    const createHold = await request(app.getHttpServer())
      .post('/v1/booking-holds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.holdCreateKey)
      .set('X-Correlation-ID', IDS.trace)
      .send({ slotId: IDS.slot1, petId: IDS.pet })
      .expect(201);

    holdId = createHold.body.holdId as string;
    expect(createHold.body.state).toBe('MANUAL_CONFIRM_PENDING');
    const created = await readHold(database, holdId);
    expect(created).toMatchObject({ state: 'MANUAL_CONFIRM_PENDING', slot_id: IDS.slot1, alternative_slot_id: null });
    expect(created.confirmation_sla_expires_at).not.toBeNull();
    await expectOutboxCorrelation(database, 'booking.hold.created.v1', holdId);

    const duplicate = await request(app.getHttpServer())
      .post('/v1/booking-holds')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.duplicateHoldKey)
      .set('X-Correlation-ID', IDS.trace)
      .send({ slotId: IDS.slot1, petId: IDS.pet })
      .expect(422);
    expect(duplicate.body).toMatchObject({ code: 'HOLD_ALREADY_ACTIVE' });

    // Generic relay publishes the original durable event; manual queue state is already materialized.
    await app.get(OutboxRelayService).poll();
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
    expect(proposal.body).toMatchObject({ holdId, sourceSlotId: IDS.slot1, alternativeSlotId: IDS.slot2, state: 'ALTERNATIVE_PENDING' });

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
    `, [holdId, IDS.slot1, IDS.slot2]);
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
    expect(accepted.body).toMatchObject({ holdId, sourceSlotId: IDS.slot1, slotId: IDS.slot2, state: 'MIS_HELD' });

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
    `, [holdId, IDS.slot1, IDS.slot2]);
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

describe('Clinic quality dashboard quality.read HTTP matrix', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();

    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
    await resetQualityFixtures(database);
  });

  afterAll(async () => {
    await app?.close();
  });

  const dashboard = (token: string) => request(app.getHttpServer())
    .get(`/v1/clinic/${QUALITY.clinic}/locations/${QUALITY.location}/quality-dashboard`)
    .query({ from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' })
    .set('Authorization', `Bearer ${token}`);

  const tokenFor = (input: { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] }) => jwt.signAsync(
    input,
    { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
  );

  const expectNormalizedDeny = (body: Record<string, unknown>) => {
    expect(body).toMatchObject({ statusCode: 403, code: 'CLINIC_SCOPE_MISMATCH', message: 'Clinic scope mismatch' });
    expect(JSON.stringify(body)).not.toMatch(/capability|quality\.read|membership|role/i);
    expect(body).not.toHaveProperty('clinicId');
    expect(body).not.toHaveProperty('locationId');
    expect(body).not.toHaveProperty('metrics');
  };

  if (featureFlags.QUALITY_READ_CAPABILITY_V1) {
    it('allows an active receptionist with matching quality.read role, clinic/location scopes and membership', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const allowed = jest.spyOn(evaluator, 'assertAllowed');
      const response = await dashboard(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(200);

      expect(response.body).toMatchObject({ clinicId: QUALITY.clinic, locationId: QUALITY.location });
      expect(response.body.metrics).toBeDefined();
      expect(allowed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        capability: 'quality.read',
        resource: { aggregateType: 'quality.dashboard', clinicId: QUALITY.clinic, locationId: QUALITY.location },
      }));
      allowed.mockRestore();
    });

    it('denies an active member whose role has no quality.read capability', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.deniedRole,
        roles: [Role.CLINIC_VETERINARIAN],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(403);

      expect(response.body).toEqual({
        code: 'ROLE_FORBIDDEN',
        message: 'The current principal has no required role.',
        requiredRoles: [Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN],
      });
      expect(response.body).not.toHaveProperty('clinicId');
      expect(response.body).not.toHaveProperty('metrics');
    });

    it('denies a member scoped to another clinic without returning target clinic data', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.otherClinicEmployee,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.otherClinic],
        locationIds: [QUALITY.otherClinicLocation],
      })).expect(403);
      expectNormalizedDeny(response.body);
    });

    it('denies a member in the same clinic when the target location is outside the effective scope', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.otherLocationEmployee,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.sameClinicOtherLocation],
      })).expect(403);
      expectNormalizedDeny(response.body);
    });

    it('denies an employee with no active membership for the target location', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.inactiveMembershipEmployee,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(403);
      expectNormalizedDeny(response.body);
    });

    it('denies an explicitly revoked membership for the target location', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.revokedMembershipEmployee,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(403);
      expectNormalizedDeny(response.body);
    });

    it('denies a JWT without a location scope', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
      })).expect(403);
      expectNormalizedDeny(response.body);
    });

    it('denies a JWT with an incompatible clinic scope', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.otherClinic],
        locationIds: [QUALITY.location],
      })).expect(403);
      expectNormalizedDeny(response.body);
    });

    it('denies a JWT with an incompatible location scope', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.sameClinicOtherLocation],
      })).expect(403);
      expectNormalizedDeny(response.body);
    });

    it('uses the centralized evaluator and keeps its deny reason out of the HTTP response', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const denied = jest.spyOn(evaluator, 'assertAllowed');
      const response = await dashboard(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
      })).expect(403);

      expect(denied).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ capability: 'quality.read' }));
      expectNormalizedDeny(response.body);
      denied.mockRestore();
    });
  } else {
    it('uses the legacy rollback access path and preserves its HTTP contract', async () => {
      const response = await dashboard(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        locationIds: [QUALITY.location],
      })).expect(200);

      expect(response.body).toMatchObject({ clinicId: QUALITY.clinic, locationId: QUALITY.location });
      // The centralized evaluator would reject this legacy token because its
      // clinicIds scope is absent; successful HTTP access proves rollback.
      expect(response.body.metrics).toBeDefined();
    });
  }
});

describe('Clinic schedule slots schedule.read HTTP matrix', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
    await resetQualityFixtures(database);
  });

  afterAll(async () => {
    await app?.close();
  });

  const slots = (token: string) => request(app.getHttpServer())
    .get(`/v1/clinic/${QUALITY.clinic}/locations/${QUALITY.location}/schedule/slots`)
    .query({ from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' })
    .set('Authorization', `Bearer ${token}`);

  const tokenFor = (input: { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] }) => jwt.signAsync(
    input,
    { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
  );

  const expectScopedDeny = (body: Record<string, unknown>) => {
    expect(body).toMatchObject({ statusCode: 403, code: 'CLINIC_SCOPE_MISMATCH', message: 'Clinic scope mismatch' });
    expect(JSON.stringify(body)).not.toMatch(/capability|schedule\.read|membership|role/i);
    expect(body).not.toHaveProperty('clinicId');
    expect(body).not.toHaveProperty('locationId');
    expect(body).not.toHaveProperty('slots');
  };

  if (featureFlags.SCHEDULE_READ_CAPABILITY_V1) {
    it('allows an active receptionist with matching schedule.read and clinic/location scopes', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const allowed = jest.spyOn(evaluator, 'assertAllowed');
      const response = await slots(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(200);

      expect(response.body).toMatchObject({ clinicId: QUALITY.clinic, locationId: QUALITY.location });
      expect(response.body.slots).toEqual([]);
      expect(allowed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        capability: 'schedule.read',
        resource: { aggregateType: 'schedule.slots', clinicId: QUALITY.clinic, locationId: QUALITY.location },
      }));
      allowed.mockRestore();
    });

    it('denies an active member without the schedule.read role', async () => {
      const response = await slots(await tokenFor({
        sub: QUALITY.deniedRole,
        roles: [Role.CLINIC_VETERINARIAN],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(403);
      expect(response.body).toEqual({
        code: 'ROLE_FORBIDDEN',
        message: 'The current principal has no required role.',
        requiredRoles: [Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN],
      });
      expect(response.body).not.toHaveProperty('slots');
    });

    it.each([
      ['cross clinic', QUALITY.otherClinicEmployee, [QUALITY.otherClinic], [QUALITY.otherClinicLocation]],
      ['cross location', QUALITY.otherLocationEmployee, [QUALITY.clinic], [QUALITY.sameClinicOtherLocation]],
      ['inactive membership', QUALITY.inactiveMembershipEmployee, [QUALITY.clinic], [QUALITY.location]],
      ['revoked membership', QUALITY.revokedMembershipEmployee, [QUALITY.clinic], [QUALITY.location]],
      ['missing location scope', QUALITY.allowed, [QUALITY.clinic], undefined],
      ['incompatible clinic scope', QUALITY.allowed, [QUALITY.otherClinic], [QUALITY.location]],
      ['incompatible location scope', QUALITY.allowed, [QUALITY.clinic], [QUALITY.sameClinicOtherLocation]],
    ])('denies %s without returning schedule data', async (_name, sub, clinicIds, locationIds) => {
      const response = await slots(await tokenFor({
        sub,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds,
        locationIds,
      })).expect(403);
      expectScopedDeny(response.body);
    });

    it('uses the centralized evaluator and normalizes its deny response', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const denied = jest.spyOn(evaluator, 'assertAllowed');
      const response = await slots(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        locationIds: [QUALITY.location],
      })).expect(403);
      expect(denied).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ capability: 'schedule.read' }));
      expectScopedDeny(response.body);
      denied.mockRestore();
    });
  } else {
    it('preserves the legacy schedule slots contract when rollback is enabled', async () => {
      const response = await slots(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(200);
      expect(response.body).toMatchObject({ clinicId: QUALITY.clinic, locationId: QUALITY.location, slots: [] });
    });
  }
});

describe('Booking hold events booking.replay.read HTTP matrix', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
    await resetReplayFixtures(database);
  });

  afterAll(async () => {
    await app?.close();
  });

  const replay = (token: string) => request(app.getHttpServer())
    .get(`/v1/booking-holds/${REPLAY.hold}/events`)
    .set('Authorization', `Bearer ${token}`);

  const tokenFor = (input: { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] }) => jwt.signAsync(
    input,
    { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
  );

  const expectScopedDeny = (body: Record<string, unknown>) => {
    expect(body).toMatchObject({ statusCode: 403, code: 'CLINIC_SCOPE_MISMATCH', message: 'Clinic scope mismatch' });
    expect(JSON.stringify(body)).not.toMatch(/capability|booking\.replay\.read|membership|role/i);
    expect(body).not.toHaveProperty('holdId');
    expect(body).not.toHaveProperty('events');
  };

  if (featureFlags.BOOKING_REPLAY_READ_CAPABILITY_V1) {
    it('allows an active receptionist with matching replay capability and scopes', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const allowed = jest.spyOn(evaluator, 'assertAllowed');
      const response = await replay(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(200);
      expect(response.body).toMatchObject({ holdId: REPLAY.hold, events: [] });
      expect(allowed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        capability: 'booking.replay.read',
        resource: { aggregateType: 'booking.hold.replay', clinicId: QUALITY.clinic, locationId: QUALITY.location },
      }));
      allowed.mockRestore();
    });

    it('denies a role without booking.replay.read', async () => {
      const response = await replay(await tokenFor({
        sub: QUALITY.deniedRole,
        roles: [Role.CLINIC_VETERINARIAN],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(403);
      expect(response.body).toEqual({
        code: 'ROLE_FORBIDDEN',
        message: 'The current principal has no required role.',
        requiredRoles: [Role.OWNER, Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN, Role.SYSTEM_WORKER],
      });
    });

    it.each([
      ['cross clinic', QUALITY.otherClinicEmployee, [QUALITY.otherClinic], [QUALITY.otherClinicLocation]],
      ['cross location', QUALITY.otherLocationEmployee, [QUALITY.clinic], [QUALITY.sameClinicOtherLocation]],
      ['inactive membership', QUALITY.inactiveMembershipEmployee, [QUALITY.clinic], [QUALITY.location]],
      ['revoked membership', QUALITY.revokedMembershipEmployee, [QUALITY.clinic], [QUALITY.location]],
      ['missing location scope', QUALITY.allowed, [QUALITY.clinic], undefined],
      ['incompatible clinic scope', QUALITY.allowed, [QUALITY.otherClinic], [QUALITY.location]],
      ['incompatible location scope', QUALITY.allowed, [QUALITY.clinic], [QUALITY.sameClinicOtherLocation]],
    ])('denies %s without returning hold events', async (_name, sub, clinicIds, locationIds) => {
      const response = await replay(await tokenFor({
        sub,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds,
        locationIds,
      })).expect(403);
      expectScopedDeny(response.body);
    });

    it('uses the centralized evaluator and normalizes replay denial', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const denied = jest.spyOn(evaluator, 'assertAllowed');
      const response = await replay(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        locationIds: [QUALITY.location],
      })).expect(403);
      expect(denied).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ capability: 'booking.replay.read' }));
      expectScopedDeny(response.body);
      denied.mockRestore();
    });
  } else {
    it('preserves the legacy clinic replay contract when rollback is enabled', async () => {
      const response = await replay(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        locationIds: [QUALITY.location],
      })).expect(200);
      expect(response.body).toMatchObject({ holdId: REPLAY.hold, events: [] });
    });
  }
});

describe('Booking hold booking.hold.read HTTP matrix', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
    await resetReplayFixtures(database);
  });

  afterAll(async () => {
    await app?.close();
  });

  const hold = (token: string) => request(app.getHttpServer())
    .get(`/v1/booking-holds/${REPLAY.hold}`)
    .set('Authorization', `Bearer ${token}`);

  const tokenFor = (input: { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] }) => jwt.signAsync(
    input,
    { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
  );

  const expectScopedDeny = (body: Record<string, unknown>) => {
    expect(body).toMatchObject({ statusCode: 403, code: 'CLINIC_SCOPE_MISMATCH', message: 'Clinic scope mismatch' });
    expect(JSON.stringify(body)).not.toMatch(/capability|booking\.hold\.read|membership|role/i);
    expect(body).not.toHaveProperty('holdId');
    expect(body).not.toHaveProperty('slotId');
    expect(body).not.toHaveProperty('clinicLocationId');
  };

  if (featureFlags.BOOKING_HOLD_READ_CAPABILITY_V1) {
    it('allows an active receptionist with matching booking.hold.read capability and scopes', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const allowed = jest.spyOn(evaluator, 'assertAllowed');
      const response = await hold(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(200);
      expect(response.body).toMatchObject({ holdId: REPLAY.hold, clinicLocationId: QUALITY.location });
      expect(allowed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        capability: 'booking.hold.read',
        resource: { aggregateType: 'booking.hold', clinicId: QUALITY.clinic, locationId: QUALITY.location },
      }));
      allowed.mockRestore();
    });

    it('denies an incompatible role before reading hold data', async () => {
      const response = await hold(await tokenFor({
        sub: QUALITY.deniedRole,
        roles: [Role.CLINIC_VETERINARIAN],
        clinicIds: [QUALITY.clinic],
        locationIds: [QUALITY.location],
      })).expect(403);
      expect(response.body).toEqual({
        code: 'ROLE_FORBIDDEN',
        message: 'The current principal has no required role.',
        requiredRoles: [Role.OWNER, Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN, Role.SYSTEM_WORKER],
      });
    });

    it.each([
      ['cross clinic', QUALITY.otherClinicEmployee, [QUALITY.otherClinic], [QUALITY.otherClinicLocation]],
      ['cross location', QUALITY.otherLocationEmployee, [QUALITY.clinic], [QUALITY.sameClinicOtherLocation]],
      ['inactive membership', QUALITY.inactiveMembershipEmployee, [QUALITY.clinic], [QUALITY.location]],
      ['revoked membership', QUALITY.revokedMembershipEmployee, [QUALITY.clinic], [QUALITY.location]],
      ['missing location JWT scope', QUALITY.allowed, [QUALITY.clinic], undefined],
      ['incompatible clinic JWT scope', QUALITY.allowed, [QUALITY.otherClinic], [QUALITY.location]],
      ['incompatible location JWT scope', QUALITY.allowed, [QUALITY.clinic], [QUALITY.sameClinicOtherLocation]],
    ])('denies %s with a normalized response and no hold data', async (_name, sub, clinicIds, locationIds) => {
      const response = await hold(await tokenFor({ sub, roles: [Role.CLINIC_RECEPTIONIST], clinicIds, locationIds })).expect(403);
      expectScopedDeny(response.body);
    });

    it('keeps the owner and system-worker legacy paths unchanged', async () => {
      await expect(hold(await tokenFor({ sub: REPLAY.owner, roles: [Role.OWNER] }))).resolves.toMatchObject({ status: 200 });
      await expect(hold(await tokenFor({ sub: QUALITY.allowed, roles: [Role.SYSTEM_WORKER] }))).resolves.toMatchObject({ status: 200 });
    });
  } else {
    it('preserves the legacy clinic hold contract when rollback is enabled', async () => {
      const response = await hold(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.CLINIC_RECEPTIONIST],
        locationIds: [QUALITY.location],
      })).expect(200);
      expect(response.body).toMatchObject({ holdId: REPLAY.hold, clinicLocationId: QUALITY.location });
    });
  }
});

describe('Telemed veterinarian queue telemed.vet.queue.read HTTP matrix', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  const queue = (token: string) => request(app.getHttpServer())
    .get('/v1/telemed/vet/queue')
    .set('Authorization', `Bearer ${token}`);

  const tokenFor = (input: { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] }) => jwt.signAsync(
    input,
    { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
  );

  if (featureFlags.TELEMED_VET_QUEUE_READ_CAPABILITY_V1) {
    it('allows a platform veterinarian and uses the centralized platform resource descriptor', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const allowed = jest.spyOn(evaluator, 'assertAllowed');
      const response = await queue(await tokenFor({ sub: QUALITY.allowed, roles: [Role.TELEMED_VETERINARIAN] })).expect(200);
      expect(response.body).toMatchObject({ availableCases: expect.any(Array), assignedCases: expect.any(Array) });
      expect(allowed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        capability: 'telemed.vet.queue.read',
        resource: { aggregateType: 'telemed.vet.queue' },
      }));
      allowed.mockRestore();
    });

    it('denies a non-veterinarian role without returning queue data', async () => {
      const response = await queue(await tokenFor({ sub: QUALITY.allowed, roles: [Role.CLINIC_RECEPTIONIST] })).expect(403);
      expect(response.body).toEqual({
        code: 'ROLE_FORBIDDEN',
        message: 'The current principal has no required role.',
        requiredRoles: [Role.TELEMED_VETERINARIAN],
      });
      expect(response.body).not.toHaveProperty('availableCases');
      expect(response.body).not.toHaveProperty('assignedCases');
    });

    it('does not treat clinic/location JWT claims as authority for the platform queue', async () => {
      const response = await queue(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.TELEMED_VETERINARIAN],
        clinicIds: [QUALITY.otherClinic],
        locationIds: [QUALITY.otherClinicLocation],
      })).expect(200);
      expect(response.body).toMatchObject({ availableCases: expect.any(Array), assignedCases: expect.any(Array) });
    });
  } else {
    it('preserves the legacy telemedicine veterinarian queue contract when rollback is enabled', async () => {
      const response = await queue(await tokenFor({ sub: QUALITY.allowed, roles: [Role.TELEMED_VETERINARIAN] })).expect(200);
      expect(response.body).toMatchObject({ availableCases: expect.any(Array), assignedCases: expect.any(Array) });
    });
  }
});

describe('Telemed veterinarian audit trail assignment/data-category HTTP matrix', () => {
  const caseId = '71717171-7171-4171-8171-717171717171';
  const forbiddenCaseId = '72727272-7272-4272-8272-727272727272';
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await NestFactory.create(NestRoot, { logger: false });
    await app.init();
    database = app.get(DatabaseService);
    await resetFixtures(database);
    jwt = app.get(JwtService);
    await database.query(`
      INSERT INTO telemed_schema.telemed_intakes (id, owner_id, pet_id, category, symptom_duration, consent_version, eligibility_outcome, routing_target)
      VALUES
        ('73737373-7373-4373-8373-737373737373', $1::uuid, $2::uuid, 'GENERAL_QUESTION', 'NO_SYMPTOMS', 'v1', 'TELEMED_ELIGIBLE', 'TELEMED_PAYMENT_QUEUE'),
        ('74747474-7474-4474-8474-747474747474', $1::uuid, $2::uuid, 'VOMITING_DIARRHEA', 'NO_SYMPTOMS', 'v1', 'TELEMED_ELIGIBLE', 'TELEMED_PAYMENT_QUEUE'),
        ('75757575-7575-4575-8575-757575757575', $1::uuid, $2::uuid, 'GENERAL_QUESTION', 'NO_SYMPTOMS', 'v1', 'TELEMED_ELIGIBLE', 'TELEMED_PAYMENT_QUEUE')
      ON CONFLICT (id) DO NOTHING
    `, [IDS.owner, IDS.pet]);
    await database.query(`
      INSERT INTO telemed_schema.telemed_cases (id, intake_id, owner_id, pet_id, state, assigned_employee_id)
      VALUES
        ($3::uuid, '73737373-7373-4373-8373-737373737373'::uuid, $1::uuid, $2::uuid, 'ASSIGNED', $4::uuid),
        ($5::uuid, '74747474-7474-4474-8474-747474747474'::uuid, $1::uuid, $2::uuid, 'ASSIGNED', $4::uuid)
      ON CONFLICT (id) DO UPDATE SET assigned_employee_id = EXCLUDED.assigned_employee_id
    `, [IDS.owner, IDS.pet, caseId, QUALITY.allowed, forbiddenCaseId]);
    await database.query(`
      INSERT INTO telemed_schema.telemed_case_events (case_id, actor_type, actor_id, event_type, payload_json)
      VALUES
        ($1::uuid, 'TELEMED_VETERINARIAN', $2::uuid, 'ASSIGNED', '{"ownerPhone":"+79990000000","ownerEmail":"owner@example.test","token":"secret","stack":"trace","authorizationReason":"internal","internalHost":"host","secret":"value","nested":{"unsafe":true}}')
      ON CONFLICT DO NOTHING
    `, [caseId, QUALITY.allowed]);
  });

  afterAll(async () => app?.close());

  const tokenFor = (input: { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] }) => jwt.signAsync(
    input, { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
  );
  const audit = (id: string, token: string) => request(app.getHttpServer())
    .get(`/v1/telemed/vet/cases/${id}/audit-trail`).set('Authorization', `Bearer ${token}`);

  if (featureFlags.TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1) {
    it('allows the assigned veterinarian, including irrelevant clinic/location claims', async () => {
      const response = await audit(caseId, await tokenFor({ sub: QUALITY.allowed, roles: [Role.TELEMED_VETERINARIAN], clinicIds: [QUALITY.otherClinic], locationIds: [QUALITY.otherClinicLocation] })).expect(200);
      expect(response.body).toMatchObject({ caseId, items: expect.any(Array) });
      expect(response.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: 'ASSIGNED', summaryCode: 'ASSIGNED', createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/) })]));
      expect(response.body.items[0]).toEqual(expect.objectContaining({ id: expect.any(String), eventType: expect.any(String), summaryCode: expect.any(String), createdAt: expect.any(String) }));
      expect(Object.keys(response.body.items[0]).sort()).toEqual(['createdAt', 'eventType', 'id', 'summaryCode']);
      expect(JSON.stringify(response.body)).not.toMatch(/ownerPhone|ownerEmail|token|stack|authorizationReason|internalHost|secret|nested|payload/i);
    });
    it('denies role, unassigned doctor, and forbidden category without audit data leakage', async () => {
      const roleDenied = await audit(caseId, await tokenFor({ sub: QUALITY.allowed, roles: [Role.CLINIC_RECEPTIONIST] })).expect(403);
      const unassigned = await audit(caseId, await tokenFor({ sub: QUALITY.deniedRole, roles: [Role.TELEMED_VETERINARIAN] })).expect(403);
      const forbidden = await audit(forbiddenCaseId, await tokenFor({ sub: QUALITY.allowed, roles: [Role.TELEMED_VETERINARIAN] })).expect(403);
      expect(roleDenied.body).not.toHaveProperty('items');
      for (const response of [unassigned, forbidden]) {
        expect(response.body).toEqual({ code: 'CLINIC_SCOPE_MISMATCH', message: 'Clinic scope mismatch' });
        expect(response.body).not.toHaveProperty('items');
        expect(response.body).not.toHaveProperty('caseId');
      }
    });
  } else {
    it('preserves the assigned-veterinarian legacy audit trail contract when rollback is enabled', async () => {
      const response = await audit(caseId, await tokenFor({ sub: QUALITY.allowed, roles: [Role.TELEMED_VETERINARIAN] })).expect(200);
      expect(response.body).toMatchObject({ caseId, items: expect.any(Array) });
    });
  }
});

describe('Operational SLO snapshot ops.slo.snapshot.read HTTP matrix', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  const snapshot = (token: string) => request(app.getHttpServer())
    .get('/v1/ops/slo-snapshot')
    .set('Authorization', `Bearer ${token}`);

  const tokenFor = (input: { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] }) => jwt.signAsync(
    input,
    { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
  );

  if (featureFlags.OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1) {
    it('allows a platform admin through the centralized platform descriptor', async () => {
      const evaluator = app.get(CapabilityEvaluatorService);
      const allowed = jest.spyOn(evaluator, 'assertAllowed');
      const response = await snapshot(await tokenFor({ sub: QUALITY.allowed, roles: [Role.PLATFORM_ADMIN] })).expect(200);
      expect(response.body).toMatchObject({ technical: expect.any(Object), security: expect.any(Object), business: expect.any(Object) });
      expect(allowed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        capability: 'ops.slo.snapshot.read',
        resource: { aggregateType: 'ops.slo.snapshot', authorityModel: 'platform' },
      }));
      allowed.mockRestore();
    });

    it('denies a role without the platform capability without returning operational data', async () => {
      const response = await snapshot(await tokenFor({ sub: QUALITY.allowed, roles: [Role.CLINIC_ADMIN] })).expect(403);
      expect(response.body).toEqual({
        code: 'ROLE_FORBIDDEN',
        message: 'The current principal has no required role.',
        requiredRoles: [Role.PLATFORM_ADMIN, Role.SECURITY_AUDITOR],
      });
      expect(response.body).not.toHaveProperty('technical');
      expect(response.body).not.toHaveProperty('security');
      expect(response.body).not.toHaveProperty('business');
    });

    it('does not make clinic or location claims authority for the platform snapshot', async () => {
      const response = await snapshot(await tokenFor({
        sub: QUALITY.allowed,
        roles: [Role.PLATFORM_ADMIN],
        clinicIds: [QUALITY.otherClinic],
        locationIds: [QUALITY.otherClinicLocation],
      })).expect(200);
      expect(response.body).toMatchObject({ technical: expect.any(Object), security: expect.any(Object), business: expect.any(Object) });
    });
  } else {
    it('preserves the legacy operational SLO snapshot contract when rollback is enabled', async () => {
      const response = await snapshot(await tokenFor({ sub: QUALITY.allowed, roles: [Role.PLATFORM_ADMIN] })).expect(200);
      expect(response.body).toMatchObject({ technical: expect.any(Object), security: expect.any(Object), business: expect.any(Object) });
    });
  }
});

async function assertHttpLockBudget(database: DatabaseService): Promise<void> {
  await database.withTransaction(async (client) => {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
    const settings = await client.query<{ lock_timeout: string; statement_timeout: string }>(`
      SELECT current_setting('lock_timeout') AS lock_timeout, current_setting('statement_timeout') AS statement_timeout
    `);
    expect(settings.rows[0]).toEqual({ lock_timeout: '50ms', statement_timeout: '250ms' });
  });
}

async function readHold(database: DatabaseService, holdId: string): Promise<HoldSnapshot> {
  const result = await database.query<HoldSnapshot>(`
    SELECT id, state, slot_id::text, alternative_slot_id::text, confirmation_sla_expires_at
    FROM booking_schema.booking_holds WHERE id = $1::uuid
  `, [holdId]);
  expect(result.rows[0]).toBeDefined();
  return result.rows[0];
}

async function expectOutboxCorrelation(database: DatabaseService, eventType: string, aggregateId: string): Promise<void> {
  const result = await database.query<{ correlation_id: string | null }>(`
    SELECT correlation_id::text AS correlation_id
    FROM booking_schema.outbox_events
    WHERE event_type = $1 AND aggregate_type = 'booking_hold' AND aggregate_id = $2::uuid
    ORDER BY created_at, id LIMIT 1
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
}

async function resetQualityFixtures(database: DatabaseService): Promise<void> {
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log CASCADE');

  await database.query(`
    INSERT INTO identity_schema.users (id) VALUES
      ($1::uuid), ($2::uuid), ($3::uuid), ($4::uuid), ($5::uuid), ($6::uuid)
  `, [
    QUALITY.allowed,
    QUALITY.deniedRole,
    QUALITY.otherClinicEmployee,
    QUALITY.otherLocationEmployee,
    QUALITY.inactiveMembershipEmployee,
    QUALITY.revokedMembershipEmployee,
  ]);
  await database.query(`
    INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES
      ($1::uuid, 'Quality LLC', 'Quality Clinic'),
      ($2::uuid, 'Other Quality LLC', 'Other Quality Clinic')
  `, [QUALITY.clinic, QUALITY.otherClinic]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES
      ($1::uuid, $2::uuid, 'Quality street 1'),
      ($3::uuid, $2::uuid, 'Quality street 2'),
      ($4::uuid, $5::uuid, 'Other quality street 1')
  `, [QUALITY.location, QUALITY.clinic, QUALITY.sameClinicOtherLocation, QUALITY.otherClinicLocation, QUALITY.otherClinic]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES
      ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST', true, NULL),
      ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL),
      ($4::uuid, $5::uuid, 'CLINIC_RECEPTIONIST', true, NULL),
      ($6::uuid, $7::uuid, 'CLINIC_RECEPTIONIST', true, NULL),
      ($8::uuid, $2::uuid, 'CLINIC_RECEPTIONIST', false, clock_timestamp()),
      ($9::uuid, $2::uuid, 'CLINIC_RECEPTIONIST', false, clock_timestamp())
  `, [
    QUALITY.allowed,
    QUALITY.location,
    QUALITY.deniedRole,
    QUALITY.otherClinicEmployee,
    QUALITY.otherClinicLocation,
    QUALITY.otherLocationEmployee,
    QUALITY.sameClinicOtherLocation,
    QUALITY.inactiveMembershipEmployee,
    QUALITY.revokedMembershipEmployee,
  ]);
}

async function resetReplayFixtures(database: DatabaseService): Promise<void> {
  await resetQualityFixtures(database);
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [REPLAY.owner]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Replay pet', 'DOG')`, [REPLAY.pet, REPLAY.owner]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'REPLAY', 'Replay service', 30)`, [REPLAY.service, QUALITY.location]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots (
      id, clinic_location_id, service_id, starts_at, ends_at, capacity, status, integration_mode, last_freshness_sync
    ) VALUES ($1::uuid, $2::uuid, $3::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 'AVAILABLE', 'LEVEL_C', clock_timestamp())
  `, [REPLAY.slot, QUALITY.location, REPLAY.service]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at, state_changed_at)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'MANUAL_CONFIRM_PENDING', clock_timestamp() + interval '10 minutes', clock_timestamp() + interval '15 minutes', clock_timestamp())
  `, [REPLAY.hold, REPLAY.slot, REPLAY.owner, REPLAY.pet]);
}
