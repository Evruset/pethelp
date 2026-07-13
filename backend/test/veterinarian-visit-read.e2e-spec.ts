import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { Role } from '../src/auth/auth.types';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

const IDS = {
  vet: '10000000-0000-4000-8000-000000000001', admin: '10000000-0000-4000-8000-000000000002', receptionist: '10000000-0000-4000-8000-000000000003', inactive: '10000000-0000-4000-8000-000000000004', revoked: '10000000-0000-4000-8000-000000000005', owner: '10000000-0000-4000-8000-000000000006',
  clinic: '20000000-0000-4000-8000-000000000001', otherClinic: '20000000-0000-4000-8000-000000000002', location: '30000000-0000-4000-8000-000000000001', otherLocation: '30000000-0000-4000-8000-000000000002', otherClinicLocation: '30000000-0000-4000-8000-000000000003',
  pet: '40000000-0000-4000-8000-000000000001', service: '50000000-0000-4000-8000-000000000001', otherService: '50000000-0000-4000-8000-000000000002', otherClinicService: '50000000-0000-4000-8000-000000000003',
  confirmedSlot: '60000000-0000-4000-8000-000000000001', completedSlot: '60000000-0000-4000-8000-000000000002', cancelledSlot: '60000000-0000-4000-8000-000000000003', expiredSlot: '60000000-0000-4000-8000-000000000004', otherLocationSlot: '60000000-0000-4000-8000-000000000005', otherClinicSlot: '60000000-0000-4000-8000-000000000006',
  confirmed: '70000000-0000-4000-8000-000000000001', completed: '70000000-0000-4000-8000-000000000002', cancelled: '70000000-0000-4000-8000-000000000003', expired: '70000000-0000-4000-8000-000000000004', otherLocationHold: '70000000-0000-4000-8000-000000000005', otherClinicHold: '70000000-0000-4000-8000-000000000006', missing: '70000000-0000-4000-8000-000000000007',
};
const fields = ['clinicId', 'holdId', 'locationId', 'petDisplayName', 'scheduledEnd', 'scheduledStart', 'species', 'status'];

describe('veterinarian visit read HTTP matrix', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let token: (sub: string, roles: Role[], clinicIds?: string[], locationIds?: string[], extra?: object) => Promise<string>;
  let vetToken: string;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    await resetFixtures(database);
    const jwt = app.get(JwtService);
    token = (sub, roles, clinicIds, locationIds, extra = {}) => jwt.signAsync(
      { sub, roles, clinicIds, locationIds, ...extra },
      { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
    );
    vetToken = await token(IDS.vet, [Role.CLINIC_VETERINARIAN], [IDS.clinic], [IDS.location]);
  });

  afterAll(async () => { await app?.close(); });

  const list = (accessToken: string) => request(app.getHttpServer()).get(`/v1/clinic/${IDS.clinic}/locations/${IDS.location}/vet/visits`).set('Authorization', `Bearer ${accessToken}`);
  const detail = (accessToken: string, holdId: string) => request(app.getHttpServer()).get(`/v1/clinic/${IDS.clinic}/locations/${IDS.location}/vet/visits/${holdId}`).set('Authorization', `Bearer ${accessToken}`);

  it('lists only allowed scoped states with the eight-field projection', async () => {
    const response = await list(vetToken).expect(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((row: { holdId: string }) => row.holdId)).toEqual([IDS.confirmed, IDS.completed]);
    for (const row of response.body) expect(Object.keys(row).sort()).toEqual(fields);
    expect(JSON.stringify(response.body)).not.toMatch(/owner|phone|email|address|audit|note|version/i);
  });

  it.each([
    ['clinic admin', IDS.admin, [Role.CLINIC_ADMIN], [IDS.clinic], [IDS.location]],
    ['non-veterinarian', IDS.receptionist, [Role.CLINIC_RECEPTIONIST], [IDS.clinic], [IDS.location]],
    ['inactive membership', IDS.inactive, [Role.CLINIC_VETERINARIAN], [IDS.clinic], [IDS.location]],
    ['revoked membership', IDS.revoked, [Role.CLINIC_VETERINARIAN], [IDS.clinic], [IDS.location]],
    ['clinic scope mismatch', IDS.vet, [Role.CLINIC_VETERINARIAN], [IDS.otherClinic], [IDS.location]],
    ['location scope mismatch', IDS.vet, [Role.CLINIC_VETERINARIAN], [IDS.clinic], [IDS.otherLocation]],
    ['capability-shaped JWT claim without grant', IDS.admin, [Role.CLINIC_ADMIN], [IDS.clinic], [IDS.location]],
  ])('normalizes list denial for %s', async (_name, sub, roles, clinics, locations) => {
    const response = await list(await token(sub, roles, clinics, locations, { capabilities: ['clinical.visit.workspace.read'] })).expect(403);
    expectNoLeak(response.body);
  });

  it('returns allowed detail with the same projection', async () => {
    const response = await detail(vetToken, IDS.confirmed).expect(200);
    expect(Object.keys(response.body).sort()).toEqual(fields);
    expect(response.body).toMatchObject({ holdId: IDS.confirmed, status: 'CONFIRMED', clinicId: IDS.clinic, locationId: IDS.location });
  });

  it.each([IDS.otherClinicHold, IDS.otherLocationHold, IDS.missing, IDS.cancelled, IDS.expired])('normalizes non-readable detail %s', async (holdId) => {
    const response = await detail(vetToken, holdId).expect(403);
    expectNoLeak(response.body);
  });

  it.each([
    ['clinic admin', IDS.admin, [Role.CLINIC_ADMIN], [IDS.clinic], [IDS.location]],
    ['non-veterinarian', IDS.receptionist, [Role.CLINIC_RECEPTIONIST], [IDS.clinic], [IDS.location]],
    ['inactive membership', IDS.inactive, [Role.CLINIC_VETERINARIAN], [IDS.clinic], [IDS.location]],
    ['revoked membership', IDS.revoked, [Role.CLINIC_VETERINARIAN], [IDS.clinic], [IDS.location]],
    ['clinic scope mismatch', IDS.vet, [Role.CLINIC_VETERINARIAN], [IDS.otherClinic], [IDS.location]],
    ['location scope mismatch', IDS.vet, [Role.CLINIC_VETERINARIAN], [IDS.clinic], [IDS.otherLocation]],
    ['capability-shaped JWT claim without grant', IDS.admin, [Role.CLINIC_ADMIN], [IDS.clinic], [IDS.location]],
  ])('normalizes detail denial for %s', async (_name, sub, roles, clinics, locations) => {
    const response = await detail(await token(sub, roles, clinics, locations, { capabilities: ['clinical.visit.workspace.read'] }), IDS.confirmed).expect(403);
    expectNoLeak(response.body);
  });
});

function expectNoLeak(body: Record<string, unknown>) {
  expect(body.code).toBe('CLINIC_SCOPE_MISMATCH');
  expect(JSON.stringify(body)).not.toMatch(/holdId|petDisplayName|species|clinicId|locationId|membership|capability|reason|select|postgres|sql/i);
}

async function resetFixtures(database: DatabaseService) {
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
  await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);
  const slots = [IDS.confirmedSlot, IDS.completedSlot, IDS.cancelledSlot, IDS.expiredSlot, IDS.otherLocationSlot, IDS.otherClinicSlot];
  for (const [index, slot] of slots.entries()) await database.query(`INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, service_id, starts_at, ends_at, capacity, status, integration_mode, last_freshness_sync) VALUES ($1::uuid, $2::uuid, $3::uuid, clock_timestamp() + ($4 * interval '1 hour'), clock_timestamp() + (($4 + 1) * interval '1 hour'), 1, 'AVAILABLE', 'LEVEL_C', clock_timestamp())`, [slot, index === 4 ? IDS.otherLocation : index === 5 ? IDS.otherClinicLocation : IDS.location, index === 4 ? IDS.otherService : index === 5 ? IDS.otherClinicService : IDS.service, index + 1]);
  const holds = [[IDS.confirmed, IDS.confirmedSlot, 'CONFIRMED'], [IDS.completed, IDS.completedSlot, 'COMPLETED'], [IDS.cancelled, IDS.cancelledSlot, 'CANCELLATION_REQUESTED'], [IDS.expired, IDS.expiredSlot, 'EXPIRED'], [IDS.otherLocationHold, IDS.otherLocationSlot, 'CONFIRMED'], [IDS.otherClinicHold, IDS.otherClinicSlot, 'CONFIRMED']];
  for (const [hold, slot, state] of holds) await database.query(`INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, clock_timestamp() + interval '1 day', clock_timestamp())`, [hold, slot, IDS.owner, IDS.pet, state]);
}
