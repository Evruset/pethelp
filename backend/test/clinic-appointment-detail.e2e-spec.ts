import 'reflect-metadata';
import { resetBookingPersistence } from './helpers/booking-test-reset';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { strictIsoTimestamp } from '../src/booking-core/clinic-appointments-registry.service';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(90_000);

const IDS = {
  owner: '13000000-0000-4000-8000-000000000001',
  employee: '13000000-0000-4000-8000-000000000002',
  admin: '13000000-0000-4000-8000-000000000003',
  revoked: '13000000-0000-4000-8000-000000000004',
  missingMembership: '13000000-0000-4000-8000-000000000005',
  veterinarian: '13000000-0000-4000-8000-000000000006',
  clinic: '23000000-0000-4000-8000-000000000001',
  otherClinic: '23000000-0000-4000-8000-000000000002',
  location: '33000000-0000-4000-8000-000000000001',
  otherLocation: '33000000-0000-4000-8000-000000000002',
  otherClinicLocation: '33000000-0000-4000-8000-000000000003',
  service: '53000000-0000-4000-8000-000000000001',
  staff: '53000000-0000-4000-8000-000000000002',
  resource: '53000000-0000-4000-8000-000000000003',
  pet: '43000000-0000-4000-8000-000000000001',
  slot: '63000000-0000-4000-8000-000000000001',
  hold: '73000000-0000-4000-8000-000000000001',
  appointment: '39000000-0000-4000-8000-000000000061',
  foreignLocationAppointment: '39000000-0000-4000-8000-000000000062',
  foreignClinicAppointment: '39000000-0000-4000-8000-000000000063',
};

type Actor = { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] };

describe('Clinic appointment detail HTTP authority and privacy', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY = 'true';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
  });
  beforeEach(async () => {
    process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY = 'true';
    await resetFixtures(database);
  });
  afterAll(async () => app?.close());

  const actor = (role = Role.CLINIC_RECEPTIONIST): Actor => ({
    sub: role === Role.CLINIC_ADMIN ? IDS.admin : IDS.employee,
    roles: [role],
    clinicIds: [IDS.clinic],
    locationIds: [IDS.location],
  });
  const tokenFor = (input: Actor) => jwt.signAsync(input, {
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    algorithm: 'HS256',
  });
  const detail = async (input: Actor | null, overrides: Partial<{ clinicId: string; locationId: string; appointmentId: string }> = {}) => {
    const call = request(app.getHttpServer()).get(
      `/v1/clinic/${overrides.clinicId ?? IDS.clinic}/locations/${overrides.locationId ?? IDS.location}/appointments/${overrides.appointmentId ?? IDS.appointment}`,
    );
    return input ? call.set('Authorization', `Bearer ${await tokenFor(input)}`) : call;
  };

  it.each([Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN])('returns the exact administrative projection for %s', async (role) => {
    const response = await detail(actor(role));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      clinicId: IDS.clinic,
      locationId: IDS.location,
      serverNow: expect.any(String),
      appointment: {
        appointmentId: IDS.appointment,
        aggregateVersion: 1,
        statusCode: 'SCHEDULED',
        statusLabel: 'Запланирована',
        createdAt: expect.any(String),
      },
      schedule: {
        startsAt: expect.any(String),
        endsAt: expect.any(String),
        timezone: 'Europe/Moscow',
        sourceLabel: 'Вручную',
      },
      owner: null,
      pet: { id: IDS.pet, displayName: 'Барсик', speciesLabel: 'Кошка' },
      service: { displayName: 'Первичный приём' },
      veterinarian: { displayName: 'Доктор Айболит' },
      resource: { displayName: 'Кабинет 1' },
      availableActions: [],
    });
    for (const timestamp of [response.body.serverNow, response.body.appointment.createdAt, response.body.schedule.startsAt, response.body.schedule.endsAt]) {
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    }
    expect(JSON.stringify(response.body)).not.toMatch(/hold|clinical|diagnos|prescription|phone|email|price|payment|audit/i);
  });

  it('is default-off and cannot be bypassed through the backend route', async () => {
    process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY = 'false';
    const response = await detail(actor());
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('requires authentication, allowed role, exact claims and active membership', async () => {
    expect((await detail(null)).status).toBe(401);
    expect((await detail({ ...actor(), roles: [Role.OWNER] })).status).toBe(403);
    expect((await detail({ ...actor(), clinicIds: [] })).status).toBe(403);
    expect((await detail({ ...actor(), locationIds: [] })).status).toBe(403);
    expect((await detail({ ...actor(), sub: IDS.missingMembership })).status).toBe(403);
    expect((await detail({ ...actor(), sub: IDS.revoked })).status).toBe(403);
    expect((await detail({ ...actor(), sub: IDS.veterinarian, roles: [Role.CLINIC_VETERINARIAN] })).status).toBe(403);
  });

  it.each([
    { appointmentId: 'not-a-uuid' },
    { appointmentId: '39000000-0000-4000-8000-000000000099' },
    { appointmentId: IDS.foreignLocationAppointment },
    { appointmentId: IDS.foreignClinicAppointment },
  ])('normalizes malformed, absent and foreign resources without data leakage', async (scope) => {
    const response = await detail(actor(), scope);
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'CLINIC_SCOPE_MISMATCH' });
    expect(response.body.appointment).toBeUndefined();
  });

  it('returns authoritative nulls for absent optional display projections', async () => {
    await database.query(`UPDATE clinic_schema.appointment_slots SET service_id = NULL, staff_id = NULL, resource_id = NULL WHERE id = $1`, [IDS.slot]);
    const response = await detail(actor());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ owner: null, service: null, veterinarian: null, resource: null });
  });

  it('uses a safe presentation for unknown stored status without leaking the raw enum', async () => {
    await database.query(`UPDATE booking_schema.appointments SET status = 'INTERNAL_FUTURE_STATE' WHERE id = $1`, [IDS.appointment]);
    const response = await detail(actor());
    expect(response.status).toBe(200);
    expect(response.body.appointment).toMatchObject({ statusCode: 'UNKNOWN', statusLabel: 'Статус уточняется' });
    expect(JSON.stringify(response.body)).not.toContain('INTERNAL_FUTURE_STATE');
  });

  it('strictly validates UTC, offset, microseconds and impossible calendar timestamps', () => {
    expect(strictIsoTimestamp('2026-07-23T10:11:12Z')).toBe('2026-07-23T10:11:12.000Z');
    expect(strictIsoTimestamp('2026-07-23T13:11:12.123456+03:00')).toBe('2026-07-23T10:11:12.123Z');
    for (const invalid of ['2026-02-30T10:00:00Z', '2026-13-01T10:00:00Z', '2026-01-01T25:00:00Z', '2026-01-01T10:00:00', 'Invalid Date']) {
      expect(() => strictIsoTimestamp(invalid)).toThrow('Malformed appointment timestamp');
    }
  });

  it('is stable, reflects authoritative status/version changes and creates no side effects', async () => {
    const before = await sideEffects(database);
    const first = await detail(actor());
    const repeated = await detail(actor());
    expect(repeated.body).toEqual({ ...first.body, serverNow: repeated.body.serverNow });
    await database.query(`UPDATE booking_schema.appointments SET status = 'COMPLETED', version = version + 1 WHERE id = $1`, [IDS.appointment]);
    const updated = await detail(actor());
    expect(updated.body.appointment).toMatchObject({ aggregateVersion: 2, statusCode: 'COMPLETED', statusLabel: 'Завершена' });
    const after = await sideEffects(database);
    expect(after).toEqual({ ...before, versions: String(Number(before.versions) + 1) });
  });

  it('keeps technical failures distinct from empty, missing or successful reads', async () => {
    const before = await sideEffects(database);
    const original = database.withTransaction.bind(database);
    const spy = jest.spyOn(database, 'withTransaction').mockRejectedValueOnce(new Error('database unavailable'));
    const failure = await detail(actor());
    expect(failure.status).toBe(500);
    expect(JSON.stringify(failure.body)).not.toMatch(/database unavailable|stack|SELECT|clinical|diagnos|prescription/i);
    expect(await sideEffects(database)).toEqual(before);
    spy.mockImplementation(original);
    expect((await detail(actor())).status).toBe(200);
    spy.mockRestore();
  });
});

async function resetFixtures(database: DatabaseService) {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await resetBookingPersistence(database);
  await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)
    VALUES ($1, $2, 'CLINIC_RECEPTIONIST', true, NULL), ($3, $2, 'CLINIC_ADMIN', true, NULL),
           ($4, $2, 'CLINIC_RECEPTIONIST', false, clock_timestamp()), ($5, $2, 'CLINIC_VETERINARIAN', true, NULL)
  `, [IDS.employee, IDS.location, IDS.admin, IDS.revoked, IDS.veterinarian]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1, $2, 'DETAIL', 'Первичный приём', 30)`, [IDS.service, IDS.location]);
  await database.query(`INSERT INTO clinic_schema.clinic_staff (id, clinic_location_id, code, display_name) VALUES ($1, $2, 'VET', 'Доктор Айболит')`, [IDS.staff, IDS.location]);
  await database.query(`INSERT INTO clinic_schema.clinic_resources (id, clinic_location_id, code, display_name) VALUES ($1, $2, 'ROOM', 'Кабинет 1')`, [IDS.resource, IDS.location]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1, $2, 'Барсик', 'CAT')`, [IDS.pet, IDS.owner]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots
      (id, clinic_location_id, service_id, staff_id, resource_id, starts_at, ends_at, capacity, held_count, status, integration_mode, source)
    VALUES ($1, $2, $3, $4, $5, clock_timestamp()+interval '1 hour', clock_timestamp()+interval '90 minutes', 1, 0, 'BOOKED', 'LEVEL_C', 'MANUAL')
  `, [IDS.slot, IDS.location, IDS.service, IDS.staff, IDS.resource]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, clinical_summary)
    VALUES ($1, $2, $3, $4, 'CONFIRMED', clock_timestamp()+interval '1 day', clock_timestamp()-interval '1 day', 'private diagnosis and prescription')
  `, [IDS.hold, IDS.slot, IDS.owner, IDS.pet]);
  await database.query(`
    INSERT INTO booking_schema.appointments (id, hold_id, owner_id, pet_id, clinic_location_id, slot_id, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', clock_timestamp()-interval '1 day')
  `, [IDS.appointment, IDS.hold, IDS.owner, IDS.pet, IDS.location, IDS.slot]);
  await insertForeignAppointment(database, IDS.foreignLocationAppointment, IDS.otherLocation);
  await insertForeignAppointment(database, IDS.foreignClinicAppointment, IDS.otherClinicLocation);
}

async function insertForeignAppointment(database: DatabaseService, appointmentId: string, locationId: string) {
  const suffix = appointmentId.slice(-12);
  const slotId = `63000000-0000-4000-8000-${suffix}`;
  const holdId = `73000000-0000-4000-8000-${suffix}`;
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots
      (id, clinic_location_id, starts_at, ends_at, capacity, held_count, status, integration_mode)
    VALUES ($1, $2, clock_timestamp()+interval '2 hours', clock_timestamp()+interval '150 minutes', 1, 0, 'BOOKED', 'LEVEL_C')
  `, [slotId, locationId]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at)
    VALUES ($1, $2, $3, $4, 'CONFIRMED', clock_timestamp()+interval '1 day', clock_timestamp())
  `, [holdId, slotId, IDS.owner, IDS.pet]);
  await database.query(`
    INSERT INTO booking_schema.appointments (id, hold_id, owner_id, pet_id, clinic_location_id, slot_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED')
  `, [appointmentId, holdId, IDS.owner, IDS.pet, locationId, slotId]);
}

async function sideEffects(database: DatabaseService) {
  const result = await database.query(`
    SELECT (SELECT SUM(version) FROM booking_schema.appointments)::text AS versions,
           (SELECT SUM(version) FROM booking_schema.booking_holds)::text AS "holdVersions",
           (SELECT SUM(held_count + booked_count) FROM clinic_schema.appointment_slots)::text AS capacity,
           (SELECT COUNT(*) FROM booking_schema.outbox_events)::text AS outbox,
           (SELECT COUNT(*) FROM audit_schema.audit_log)::text AS audit,
           (SELECT COUNT(*) FROM booking_schema.idempotency_records)::text AS idempotency
  `);
  return result.rows[0];
}
