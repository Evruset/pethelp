import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(90_000);

const IDS = {
  owner: '12000000-0000-4000-8000-000000000001',
  allowed: '12000000-0000-4000-8000-000000000002',
  admin: '12000000-0000-4000-8000-000000000003',
  revoked: '12000000-0000-4000-8000-000000000004',
  noMembership: '12000000-0000-4000-8000-000000000005',
  vet: '12000000-0000-4000-8000-000000000006',
  clinic: '22000000-0000-4000-8000-000000000001',
  otherClinic: '22000000-0000-4000-8000-000000000002',
  location: '32000000-0000-4000-8000-000000000001',
  otherLocation: '32000000-0000-4000-8000-000000000002',
  otherClinicLocation: '32000000-0000-4000-8000-000000000003',
  service: '52000000-0000-4000-8000-000000000001',
};

type Actor = { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] };

describe('Clinic appointments registry HTTP authority and cursor matrix', () => {
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

  const tokenFor = (actor: Actor) => jwt.signAsync(actor, {
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    algorithm: 'HS256',
  });
  const allowed = (role = Role.CLINIC_RECEPTIONIST): Actor => ({
    sub: role === Role.CLINIC_ADMIN ? IDS.admin : IDS.allowed,
    roles: [role],
    clinicIds: [IDS.clinic],
    locationIds: [IDS.location],
  });
  const registry = async (actor: Actor | null, input: { bucket?: string; limit?: string | number; cursor?: string; clinicId?: string; locationId?: string } = {}) => {
    const query = new URLSearchParams();
    if (input.bucket !== undefined) query.set('bucket', input.bucket);
    if (input.limit !== undefined) query.set('limit', String(input.limit));
    if (input.cursor !== undefined) query.set('cursor', input.cursor);
    const call = request(app.getHttpServer()).get(`/v1/clinic/${input.clinicId ?? IDS.clinic}/locations/${input.locationId ?? IDS.location}/appointments?${query}`);
    return actor ? call.set('Authorization', `Bearer ${await tokenFor(actor)}`) : call;
  };

  it('returns safe upcoming and history projections for receptionist and admin', async () => {
    const upcoming = await registry(allowed(), { bucket: 'upcoming' });
    const history = await registry(allowed(Role.CLINIC_ADMIN), { bucket: 'history' });
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.items.map((item: { statusCode: string }) => item.statusCode)).toEqual(['SCHEDULED', 'SCHEDULED', 'SCHEDULED', 'SCHEDULED']);
    expect(history.status).toBe(200);
    expect(new Set(history.body.items.map((item: { statusCode: string }) => item.statusCode))).toEqual(new Set(['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED']));
    expect(upcoming.body).toMatchObject({ clinicId: IDS.clinic, locationId: IDS.location, nextCursor: null });
    expect(Date.parse(upcoming.body.serverNow)).not.toBeNaN();
  });

  it('uses stable keyset ties and a fixed snapshot without duplicates or inserted rows', async () => {
    const first = await registry(allowed(), { bucket: 'upcoming', limit: 1 });
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const snapshotAt = decodeCursor(first.body.nextCursor).snapshotAt;

    await insertAppointment(database, 90, 'CONFIRMED', '39000000-0000-4000-8000-000000000099');
    await database.query(`UPDATE booking_schema.appointments SET created_at = clock_timestamp() WHERE id = '39000000-0000-4000-8000-000000000099'`);
    const ids = first.body.items.map((item: { appointmentId: string }) => item.appointmentId);
    let cursor = first.body.nextCursor as string | null;
    while (cursor) {
      const page = await registry(allowed(), { bucket: 'upcoming', limit: 1, cursor });
      expect(page.status).toBe(200);
      ids.push(...page.body.items.map((item: { appointmentId: string }) => item.appointmentId));
      if (page.body.nextCursor) expect(decodeCursor(page.body.nextCursor).snapshotAt).toBe(snapshotAt);
      cursor = page.body.nextCursor;
    }
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain('39000000-0000-4000-8000-000000000099');
    expect(ids.slice(1, 3)).toEqual(['39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000056']);
  });

  it('keeps the exact end boundary in upcoming and excludes it from history for the cursor snapshot', async () => {
    const first = await registry(allowed(), { bucket: 'upcoming', limit: 1 });
    const snapshotAt = decodeCursor(first.body.nextCursor).snapshotAt as string;
    const boundaryId = '39000000-0000-4000-8000-000000000051';
    await database.query(`
      UPDATE clinic_schema.appointment_slots s
      SET starts_at = $1::timestamptz - interval '30 minutes', ends_at = $1::timestamptz
      FROM booking_schema.appointments a
      WHERE a.id = $2::uuid AND a.slot_id = s.id
    `, [snapshotAt, boundaryId]);
    const page = await registry(allowed(), { bucket: 'upcoming', limit: 1, cursor: first.body.nextCursor });
    expect(page.body.items.map((item: { appointmentId: string }) => item.appointmentId)).toContain(boundaryId);
    const membership = await database.query<{ upcoming: string; history: string }>(`
      SELECT COUNT(*) FILTER (WHERE a.status NOT IN ('COMPLETED','NO_SHOW','CLINIC_CANCELLED','CANCELLED') AND s.ends_at >= $1)::text AS upcoming,
             COUNT(*) FILTER (WHERE a.status IN ('COMPLETED','NO_SHOW','CLINIC_CANCELLED','CANCELLED') OR (a.status NOT IN ('COMPLETED','NO_SHOW','CLINIC_CANCELLED','CANCELLED') AND s.ends_at < $1))::text AS history
      FROM booking_schema.appointments a JOIN clinic_schema.appointment_slots s ON s.id=a.slot_id WHERE a.id=$2
    `, [snapshotAt, boundaryId]);
    expect(membership.rows[0]).toEqual({ upcoming: '1', history: '0' });
  });

  it('returns authoritative empty output distinct from a technical failure', async () => {
    await database.query('DELETE FROM booking_schema.appointments');
    const empty = await registry(allowed(), { bucket: 'upcoming' });
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ items: [], nextCursor: null });

    const original = database.withTransaction.bind(database);
    const failure = jest.spyOn(database, 'withTransaction').mockRejectedValueOnce(new Error('private SQL detail'));
    const response = await registry(allowed(), { bucket: 'upcoming' });
    failure.mockImplementation(original);
    expect(response.status).toBe(500);
    expect(response.body.items).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('private SQL detail');
  });

  it('does not expose sensitive or internal fields anywhere in the response', async () => {
    const response = await registry(allowed(), { bucket: 'history' });
    const serialized = JSON.stringify(response.body).toLowerCase();
    for (const forbidden of ['ownerid', 'owners', 'clinicalsummary', 'diagnosis', 'prescription', 'payment', 'insurance', 'provider', 'audit', 'email', 'phone', 'holdid', 'createdat', 'updatedat']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('is side-effect free across repeated reads', async () => {
    const before = await sideEffects(database);
    await registry(allowed(), { bucket: 'upcoming' });
    await registry(allowed(), { bucket: 'history' });
    expect(await sideEffects(database)).toEqual(before);
  });

  it.each([
    ['missing membership', { sub: IDS.noMembership, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['revoked membership', { sub: IDS.revoked, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['role denied', { sub: IDS.vet, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [IDS.location] }],
    ['incompatible clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.otherClinic], locationIds: [IDS.location] }],
    ['missing location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic] }],
    ['incompatible location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.otherLocation] }],
  ] as Array<[string, Actor]>)('denies %s without projection leakage', async (_name, actor) => {
    const response = await registry(actor, { bucket: 'upcoming' });
    expect(response.status).toBe(403);
    expect(['CLINIC_SCOPE_MISMATCH', 'ROLE_FORBIDDEN']).toContain(response.body.code);
    expect(response.body.items).toBeUndefined();
  });

  it('denies unauthenticated, cross-location and cross-clinic requests without leakage', async () => {
    expect((await registry(null, { bucket: 'upcoming' })).status).toBe(401);
    for (const scoped of [
      { bucket: 'upcoming', locationId: IDS.otherLocation },
      { bucket: 'upcoming', clinicId: IDS.otherClinic, locationId: IDS.otherClinicLocation },
    ]) {
      const response = await registry(allowed(), scoped);
      expect(response.status).toBe(403);
      expect(response.body.items).toBeUndefined();
    }
  });

  it.each([undefined, 'invalid'] as Array<string | undefined>)('rejects missing or invalid bucket %s', async (bucket) => {
    const response = await registry(allowed(), { bucket });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_APPOINTMENT_REGISTRY_QUERY' });
  });

  it.each(['0', '-1', '1.5', '101', 'many', '1e2', '0x10', '01', ' 1 '])('rejects invalid limit %s', async (limit) => {
    const response = await registry(allowed(), { bucket: 'upcoming', limit });
    expect(response.status).toBe(400);
  });

  it('uses default 50 and accepts maximum 100', async () => {
    expect((await registry(allowed(), { bucket: 'upcoming' })).status).toBe(200);
    expect((await registry(allowed(), { bucket: 'upcoming', limit: 100 })).status).toBe(200);
  });

  it('rejects malformed, tampered, cross-bucket and cross-scope cursors uniformly', async () => {
    const first = await registry(allowed(), { bucket: 'upcoming', limit: 1 });
    const cursor = first.body.nextCursor as string;
    const [body, signature] = cursor.split('.');
    await database.query(`
      INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)
      VALUES ($1, $2, 'CLINIC_RECEPTIONIST', true, NULL), ($1, $3, 'CLINIC_RECEPTIONIST', true, NULL)
    `, [IDS.allowed, IDS.otherLocation, IDS.otherClinicLocation]);
    const broadActor: Actor = { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic, IDS.otherClinic], locationIds: [IDS.location, IDS.otherLocation, IDS.otherClinicLocation] };
    const invalidAttempts = [
      registry(allowed(), { bucket: 'upcoming', limit: 1, cursor: 'malformed' }),
      registry(allowed(), { bucket: 'upcoming', limit: 1, cursor: `${body.slice(0, -1)}A.${signature}` }),
      registry(allowed(), { bucket: 'history', limit: 1, cursor }),
      registry(allowed(), { bucket: 'upcoming', limit: 2, cursor }),
    ];
    for (const attempt of invalidAttempts) {
      const response = await attempt;
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'INVALID_APPOINTMENT_REGISTRY_CURSOR' });
      expect(response.body.items).toBeUndefined();
    }
    const crossScopeAttempts = [
      registry(broadActor, { bucket: 'upcoming', limit: 1, cursor, locationId: IDS.otherLocation }),
      registry(broadActor, { bucket: 'upcoming', limit: 1, cursor, clinicId: IDS.otherClinic, locationId: IDS.otherClinicLocation }),
    ];
    for (const attempt of crossScopeAttempts) {
      const response = await attempt;
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'INVALID_APPOINTMENT_REGISTRY_CURSOR' });
      expect(response.body.items).toBeUndefined();
    }
  });
});

function decodeCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor.split('.')[0], 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function resetFixtures(database: DatabaseService) {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)
    VALUES ($1, $2, 'CLINIC_RECEPTIONIST', true, NULL), ($3, $2, 'CLINIC_ADMIN', true, NULL), ($4, $2, 'CLINIC_RECEPTIONIST', false, clock_timestamp())
  `, [IDS.allowed, IDS.location, IDS.admin, IDS.revoked]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1, $2, 'REGISTRY', 'Первичный приём', 30)`, [IDS.service, IDS.location]);
  await database.query(`
    INSERT INTO pet_schema.pets (id, owner_id, name, species)
    SELECT ('42000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid, $1, 'Pet ' || series, CASE WHEN series % 2 = 0 THEN 'DOG' ELSE 'CAT' END
    FROM generate_series(1, 8) series
  `, [IDS.owner]);
  for (const fixture of [
    [-120, 60, 'CONFIRMED', '39000000-0000-4000-8000-000000000050'],
    [50, 90, 'CONFIRMED', '39000000-0000-4000-8000-000000000051'],
    [-90, -60, 'CONFIRMED', '39000000-0000-4000-8000-000000000052'],
    [120, 150, 'COMPLETED', '39000000-0000-4000-8000-000000000053'],
    [-180, -150, 'NO_SHOW', '39000000-0000-4000-8000-000000000054'],
    [180, 210, 'CLINIC_CANCELLED', '39000000-0000-4000-8000-000000000055'],
    [50, 120, 'CONFIRMED', '39000000-0000-4000-8000-000000000056'],
    [70, 130, 'CONFIRMED', '39000000-0000-4000-8000-000000000057'],
  ] as const) await insertAppointment(database, fixture[1], fixture[2], fixture[3], fixture[0]);
}

async function insertAppointment(database: DatabaseService, endMinutes: number, status: string, appointmentId: string, startMinutes = endMinutes - 30) {
  const suffix = appointmentId.slice(-12);
  const slotId = `62000000-0000-4000-8000-${suffix}`;
  const holdId = `72000000-0000-4000-8000-${suffix}`;
  const petNumber = Number(suffix) % 8 + 1;
  const petId = `42000000-0000-4000-8000-${String(petNumber).padStart(12, '0')}`;
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode)
    VALUES ($1, $2, $3, clock_timestamp()+$4*interval '1 minute', clock_timestamp()+$5*interval '1 minute', 1, 0, 'BOOKED', 'LEVEL_C')
  `, [slotId, IDS.location, IDS.service, startMinutes, endMinutes]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, clinical_summary)
    VALUES ($1, $2, $3, $4, 'CONFIRMED', clock_timestamp()+interval '1 day', clock_timestamp()-interval '1 day', 'private diagnosis and prescription')
  `, [holdId, slotId, IDS.owner, petId]);
  await database.query(`
    INSERT INTO booking_schema.appointments (id, hold_id, owner_id, pet_id, clinic_location_id, slot_id, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, clock_timestamp()-interval '1 day')
  `, [appointmentId, holdId, IDS.owner, petId, IDS.location, slotId, status]);
}

async function sideEffects(database: DatabaseService) {
  const result = await database.query<{
    appointments: string; versions: string; holdVersions: string; capacity: string; outbox: string; audit: string; idempotency: string;
  }>(`
    SELECT (SELECT COUNT(*) FROM booking_schema.appointments)::text AS appointments,
           (SELECT SUM(version) FROM booking_schema.appointments)::text AS versions,
           (SELECT SUM(version) FROM booking_schema.booking_holds)::text AS "holdVersions",
           (SELECT SUM(held_count + booked_count) FROM clinic_schema.appointment_slots)::text AS capacity,
           (SELECT COUNT(*) FROM booking_schema.outbox_events)::text AS outbox,
           (SELECT COUNT(*) FROM audit_schema.audit_log)::text AS audit,
           (SELECT COUNT(*) FROM booking_schema.idempotency_records)::text AS idempotency
  `);
  return result.rows[0];
}
