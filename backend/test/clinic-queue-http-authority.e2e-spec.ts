import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(45_000);

const IDS = {
  owner: '11000000-0000-4000-8000-000000000001',
  allowed: '11000000-0000-4000-8000-000000000002',
  revoked: '11000000-0000-4000-8000-000000000004',
  noMembership: '11000000-0000-4000-8000-000000000005',
  veterinarian: '11000000-0000-4000-8000-000000000006',
  clinic: '21000000-0000-4000-8000-000000000001',
  otherClinic: '21000000-0000-4000-8000-000000000002',
  location: '31000000-0000-4000-8000-000000000001',
  otherLocation: '31000000-0000-4000-8000-000000000002',
  otherClinicLocation: '31000000-0000-4000-8000-000000000003',
  pet: '41000000-0000-4000-8000-000000000001',
  service: '51000000-0000-4000-8000-000000000001',
  otherService: '51000000-0000-4000-8000-000000000002',
  slot: '61000000-0000-4000-8000-000000000001',
  hold: '71000000-0000-4000-8000-000000000001',
};

type Actor = {
  sub: string;
  roles: Role[];
  clinicIds?: string[];
  locationIds?: string[];
  capabilities?: string[];
};

describe('Clinic Queue HTTP authority matrix', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => resetFixtures(database));
  afterAll(async () => app?.close());

  const tokenFor = (input: Actor) => jwt.signAsync(input, {
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    algorithm: 'HS256',
  });

  const queue = async (input: Parameters<typeof tokenFor>[0], clinicId = IDS.clinic, locationId = IDS.location) => request(app.getHttpServer())
    .get(`/v1/clinic/${clinicId}/locations/${locationId}/booking-queue`)
    .set('Authorization', `Bearer ${await tokenFor(input)}`);

  const confirm = async (input: Parameters<typeof tokenFor>[0], idempotencyKey = randomUUID()) => request(app.getHttpServer())
    .post(`/v1/clinic/booking-holds/${IDS.hold}/confirm`)
    .set('Authorization', `Bearer ${await tokenFor(input)}`)
    .set('Idempotency-Key', idempotencyKey)
    .set('If-Match', '1')
    .set('X-Correlation-ID', randomUUID());

  const decline = async (input: Parameters<typeof tokenFor>[0], idempotencyKey = randomUUID()) => request(app.getHttpServer())
    .post(`/v1/clinic/booking-holds/${IDS.hold}/decline`)
    .set('Authorization', `Bearer ${await tokenFor(input)}`)
    .set('Idempotency-Key', idempotencyKey)
    .set('If-Match', '1')
    .set('X-Correlation-ID', randomUUID())
    .send({ declineReason: 'Owner requested another clinic' });

  const requestNotes = async (input: Parameters<typeof tokenFor>[0], idempotencyKey = randomUUID()) => request(app.getHttpServer())
    .post(`/v1/clinic/booking-holds/${IDS.hold}/request-notes`)
    .set('Authorization', `Bearer ${await tokenFor(input)}`)
    .set('Idempotency-Key', idempotencyKey)
    .set('If-Match', '1')
    .set('X-Correlation-ID', randomUUID())
    .send({ noteRequest: 'Please confirm the pet vaccination date' });

  const allowed = () => ({
    sub: IDS.allowed,
    roles: [Role.CLINIC_RECEPTIONIST],
    clinicIds: [IDS.clinic],
    locationIds: [IDS.location],
  });

  const deniedActors = (): Array<[string, Actor]> => [
    ['role denied', { sub: IDS.veterinarian, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing membership', { sub: IDS.noMembership, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location], capabilities: ['booking.queue.read'] }],
    ['revoked membership', { sub: IDS.revoked, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [IDS.location] }],
    ['incompatible clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.otherClinic], locationIds: [IDS.location] }],
    ['missing location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic] }],
    ['incompatible location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.otherLocation] }],
  ];

  it('allows the scoped receptionist to read only its queue', async () => {
    const response = await queue(allowed());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ clinicId: IDS.clinic, locationId: IDS.location });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ holdId: IDS.hold });
  });

  it.each([
    ['role denied', { sub: IDS.veterinarian, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['revoked membership', { sub: IDS.revoked, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['claims without membership', { sub: IDS.noMembership, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location], capabilities: ['booking.queue.read'] }],
    ['missing clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [IDS.location] }],
    ['incompatible clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.otherClinic], locationIds: [IDS.location] }],
    ['missing location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic] }],
    ['incompatible location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.otherLocation] }],
  ])('denies queue read for %s without leaking queue data', async (_name, actor) => {
    const response = await queue(actor);
    expect(response.status).toBe(403);
    expectNoLeak(response.body);
  });

  it('denies cross-clinic and cross-location queue reads without payload disclosure', async () => {
    const crossClinic = await queue(allowed(), IDS.otherClinic, IDS.otherClinicLocation);
    const crossLocation = await queue(allowed(), IDS.clinic, IDS.otherLocation);
    expect(crossClinic.status).toBe(403);
    expect(crossLocation.status).toBe(403);
    expectNoLeak(crossClinic.body);
    expectNoLeak(crossLocation.body);
  });

  it.each([
    ['role denied', { sub: IDS.veterinarian, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing membership', { sub: IDS.noMembership, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location], capabilities: ['booking.queue.read'] }],
    ['revoked membership', { sub: IDS.revoked, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [IDS.location] }],
    ['incompatible clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.otherClinic], locationIds: [IDS.location] }],
    ['missing location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic] }],
    ['incompatible location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.otherLocation] }],
  ])('denies confirm for %s without state, appointment, audit or outbox effects', async (_name, actor) => {
    const before = await mutationSnapshot(database);
    const response = await confirm(actor);
    expect(response.status).toBe(403);
    expectNoLeak(response.body);
    expect(await mutationSnapshot(database)).toEqual(before);
  });

  it('confirms idempotently and publishes the authoritative owner readback', async () => {
    const key = randomUUID();
    const first = await confirm(allowed(), key);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ holdId: IDS.hold, state: 'CONFIRMED' });
    const repeated = await confirm(allowed(), key);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(first.body);

    const ownerToken = await tokenFor({ sub: IDS.owner, roles: [Role.OWNER] });
    const readback = await request(app.getHttpServer())
      .get(`/v1/booking-holds/${IDS.hold}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(readback.body).toMatchObject({
      holdId: IDS.hold,
      state: 'CONFIRMED',
      confirmationMode: 'MANUAL',
      nextActionCode: 'VIEW_APPOINTMENT',
      aggregateVersion: 2,
    });
    expect(await mutationSnapshot(database)).toEqual({
      state: 'CONFIRMED', version: 2, heldCount: 0, appointments: '1', events: '1', audits: '1',
    });
  });

  it.each(['decline', 'request-notes'] as const)('denies %s across the authority matrix without side effects', async (command) => {
    for (const [name, actor] of deniedActors()) {
      await resetFixtures(database);
      const before = await mutationSnapshot(database);
      const response = command === 'decline' ? await decline(actor) : await requestNotes(actor);
      expect(response.status).toBe(403);
      expectNoLeak(response.body);
      expect(await mutationSnapshot(database)).toEqual(before);
      expect(JSON.stringify(response.body)).not.toContain(name === 'role denied' ? 'Queue pet' : IDS.hold);
    }
  });

  it('declines idempotently with authoritative release, reason, audit, outbox and owner readback', async () => {
    const key = randomUUID();
    const first = await decline(allowed(), key);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ holdId: IDS.hold, slotId: IDS.slot, state: 'RELEASED' });
    expect((await decline(allowed(), key)).body).toEqual(first.body);
    expect(await mutationSnapshot(database)).toEqual({
      state: 'RELEASED', version: 2, heldCount: 0, appointments: '0', events: '1', audits: '1',
    });
    const evidence = await database.query<{ event_reason: string; audit_reason: string }>(`
      SELECT event.payload_json->>'declineReason' AS event_reason, audit.payload_json->>'reason' AS audit_reason
      FROM booking_schema.outbox_events event
      JOIN audit_schema.audit_log audit ON audit.aggregate_id = event.aggregate_id
      WHERE event.aggregate_id = $1::uuid
        AND event.event_type = 'booking.hold.released.v1'
        AND audit.action = 'booking.declined'
    `, [IDS.hold]);
    expect(evidence.rows[0]).toEqual({ event_reason: 'Owner requested another clinic', audit_reason: 'Owner requested another clinic' });

    const ownerToken = await tokenFor({ sub: IDS.owner, roles: [Role.OWNER] });
    const readback = await request(app.getHttpServer()).get(`/v1/booking-holds/${IDS.hold}`).set('Authorization', `Bearer ${ownerToken}`).expect(200);
    expect(readback.body).toMatchObject({ state: 'RELEASED', nextActionCode: 'CHOOSE_ANOTHER_SLOT', aggregateVersion: 2 });
  });

  it('requests notes idempotently while preserving the pending hold and publishing the request text', async () => {
    const key = randomUUID();
    const first = await requestNotes(allowed(), key);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      holdId: IDS.hold,
      state: 'MANUAL_CONFIRM_PENDING',
      version: 2,
      requestedNote: 'Please confirm the pet vaccination date',
    });
    expect((await requestNotes(allowed(), key)).body).toEqual(first.body);
    expect(await mutationSnapshot(database)).toEqual({
      state: 'MANUAL_CONFIRM_PENDING', version: 2, heldCount: 1, appointments: '0', events: '1', audits: '1',
    });
    const evidence = await database.query<{ event_note: string; audit_note: string }>(`
      SELECT event.payload_json->>'requestedNote' AS event_note, audit.payload_json->>'noteRequest' AS audit_note
      FROM booking_schema.outbox_events event
      JOIN audit_schema.audit_log audit ON audit.aggregate_id = event.aggregate_id
      WHERE event.aggregate_id = $1::uuid
        AND event.event_type = 'booking.notes.requested.v1'
        AND audit.action = 'booking.notes.requested'
    `, [IDS.hold]);
    expect(evidence.rows[0]).toEqual({
      event_note: 'Please confirm the pet vaccination date',
      audit_note: 'Please confirm the pet vaccination date',
    });
  });

  it.each(['decline', 'request-notes'] as const)('rejects %s from terminal CONFIRMED without side effects', async (command) => {
    await database.query(`UPDATE booking_schema.booking_holds SET state = 'CONFIRMED', confirmation_sla_expires_at = NULL WHERE id = $1::uuid`, [IDS.hold]);
    const before = await mutationSnapshot(database);
    const response = command === 'decline' ? await decline(allowed()) : await requestNotes(allowed());
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(await mutationSnapshot(database)).toEqual(before);
  });
});

function expectNoLeak(body: Record<string, unknown>) {
  expect(body).toHaveProperty('code');
  expect(body).not.toHaveProperty('holdId');
  expect(body).not.toHaveProperty('slotId');
  expect(body).not.toHaveProperty('items');
  expect(JSON.stringify(body)).not.toMatch(/Queue pet|Queue service|booking\.confirmed|appointmentId/i);
}

async function mutationSnapshot(database: DatabaseService) {
  const result = await database.query<{
    state: string; version: number; heldCount: number; appointments: string; events: string; audits: string;
  }>(`
    SELECT hold.state, hold.version, slot.held_count AS "heldCount",
      (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE hold_id = hold.id) AS appointments,
      (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = hold.id AND event_type = ANY(ARRAY['booking.confirmed.v1','booking.hold.released.v1','booking.notes.requested.v1'])) AS events,
      (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id = hold.id AND action = ANY(ARRAY['booking.confirmed','booking.declined','booking.notes.requested'])) AS audits
    FROM booking_schema.booking_holds hold
    JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
    WHERE hold.id = $1::uuid
  `, [IDS.hold]);
  return result.rows[0];
}

async function resetFixtures(database: DatabaseService) {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)
    VALUES
      ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST', true, NULL),
      ($3::uuid, $2::uuid, 'CLINIC_RECEPTIONIST', false, clock_timestamp())
  `, [IDS.allowed, IDS.location, IDS.revoked]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'QUEUE', 'Queue service', 30), ($3::uuid, $4::uuid, 'OTHER', 'Other service', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Queue pet', 'CAT')`, [IDS.pet, IDS.owner]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode)
    VALUES ($1::uuid, $2::uuid, $3::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C')
  `, [IDS.slot, IDS.location, IDS.service]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at, state_changed_at)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'MANUAL_CONFIRM_PENDING', clock_timestamp() + interval '16 minutes', clock_timestamp() + interval '15 minutes', clock_timestamp() - interval '1 minute')
  `, [IDS.hold, IDS.slot, IDS.owner, IDS.pet]);
}
