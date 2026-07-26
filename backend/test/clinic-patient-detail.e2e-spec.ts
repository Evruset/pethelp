import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { CLINIC_PATIENT_DETAIL_SQL, ClinicPatientDetailService } from '../src/booking-core/clinic-patient-detail.service';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(90_000);

const I = {
  owner: 'c1000000-0000-4000-8000-000000000001',
  employee: 'c1000000-0000-4000-8000-000000000002',
  admin: 'c1000000-0000-4000-8000-000000000003',
  vet: 'c1000000-0000-4000-8000-000000000004',
  inactive: 'c1000000-0000-4000-8000-000000000005',
  revoked: 'c1000000-0000-4000-8000-000000000006',
  clinic: 'c2000000-0000-4000-8000-000000000001',
  foreignClinic: 'c2000000-0000-4000-8000-000000000002',
  location: 'c3000000-0000-4000-8000-000000000001',
  otherLocation: 'c3000000-0000-4000-8000-000000000002',
  service: 'c4000000-0000-4000-8000-000000000001',
  pet: 'c5000000-0000-4000-8000-000000000001',
  unrelatedPet: 'c5000000-0000-4000-8000-000000000002',
  consent: 'c9000000-0000-4000-8000-000000000001',
  association: 'ca000000-0000-4000-8000-000000000001',
};
type Actor = { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] };

describe('Clinic patient administrative detail HTTP/PostgreSQL contract', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS = 'false';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'detail-test-v1';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    db = app.get(DatabaseService);
    jwt = app.get(JwtService);
  });
  beforeEach(async () => {
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'detail-test-v1';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
    await seed(db);
  });
  afterAll(async () => {
    await app?.close();
    delete process.env.VETHELP_CLINIC_PATIENTS_REGISTRY;
  });

  const actor = (role = Role.CLINIC_RECEPTIONIST): Actor => ({
    sub: role === Role.CLINIC_ADMIN ? I.admin : I.employee,
    roles: [role], clinicIds: [I.clinic], locationIds: [I.location],
  });
  const token = (value: Actor) => jwt.signAsync(value, {
    secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256',
  });
  const detail = async (value: Actor | null, patientId = I.pet, clinicId = I.clinic, locationId = I.location) => {
    const call = request(app.getHttpServer()).get(
      `/v1/clinic/${clinicId}/locations/${locationId}/patients/${patientId}`,
    );
    return value ? call.set('Authorization', `Bearer ${await token(value)}`) : call;
  };

  it('is default-off and returns the exact privacy-safe projection for receptionist/admin/multi-role', async () => {
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'false';
    expect((await detail(actor())).status).toBe(404);
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    for (const value of [
      actor(), actor(Role.CLINIC_ADMIN),
      { ...actor(), roles: [Role.CLINIC_VETERINARIAN, Role.CLINIC_RECEPTIONIST] },
    ]) {
      const response = await detail(value);
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store, private');
      expect(response.body).toEqual({
        clinicId: I.clinic,
        locationId: I.location,
        serverNow: expect.any(String),
        patient: {
          patientId: I.pet,
          pet: {
            displayName: 'Барсик', speciesLabel: 'Кошка', breed: 'Сибирская',
            sexCode: 'MALE', birthDate: '2020-02-29',
          },
          owner: { displayName: null },
          relationship: { firstSeenAt: expect.any(String), lastSeenAt: expect.any(String) },
          appointments: {
            last: expect.objectContaining({ statusCode: 'COMPLETED' }),
            next: expect.objectContaining({ statusCode: 'SCHEDULED' }),
            recent: [expect.objectContaining({ statusCode: 'COMPLETED' })],
          },
          localProfile: { alias: null, administrativeReference: null, aggregateVersion: 0, updatedAt: null },
        },
      });
      const serialized = JSON.stringify(response.body).toLowerCase();
      for (const forbidden of [
        'ownerid', 'phone', 'email', 'address', 'clinical', 'complaint', 'diagnos',
        'allerg', 'prescription', 'document', 'ocr', 'insurance', 'payment',
        'consent', 'association', 'revision', 'audit', 'holdid', 'eventid',
      ]) expect(serialized).not.toContain(forbidden);
    }
  });

  it('enforces authentication, administrative capability, exact claims and active membership', async () => {
    expect((await detail(null)).status).toBe(401);
    expect((await detail({ ...actor(), sub: I.vet, roles: [Role.CLINIC_VETERINARIAN] })).status).toBe(403);
    expect((await detail({ ...actor(), clinicIds: [] })).status).toBe(403);
    expect((await detail({ ...actor(), locationIds: [] })).status).toBe(403);
    expect((await detail({ ...actor(), sub: I.inactive })).status).toBe(403);
    expect((await detail({ ...actor(), sub: I.revoked })).status).toBe(403);
    expect((await detail(actor(), I.pet, I.clinic, I.otherLocation)).status).toBe(403);
    expect((await detail(actor(), I.pet, I.foreignClinic, I.location)).status).toBe(403);
  });

  it('normalizes malformed, absent, foreign and unassociated pet identities without leakage', async () => {
    for (const patientId of ['not-a-uuid', 'c5000000-0000-4000-8000-000000000099', I.unrelatedPet]) {
      const response = await detail(actor(), patientId);
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
      expect(response.body.patient).toBeUndefined();
    }
  });

  it('projects absent, existing and cleared exact-scope local profiles independently of the write flag', async () => {
    const absent = await detail(actor());
    expect(absent.body.patient.localProfile).toEqual({
      alias: null, administrativeReference: null, aggregateVersion: 0, updatedAt: null,
    });
    expect((await db.query('SELECT COUNT(*)::text count FROM clinic_schema.clinic_patient_local_profiles')).rows[0].count).toBe('0');

    await db.query(`INSERT INTO clinic_schema.clinic_patient_local_profiles
      (clinic_id,clinic_location_id,patient_id,alias,aggregate_version)
      VALUES($1,$2,$3,'Барсик Петровых',3)`, [I.clinic, I.location, I.pet]);
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS = 'false';
    const existing = await detail(actor());
    expect(existing.body.patient.localProfile).toEqual({
      alias: 'Барсик Петровых', administrativeReference: null,
      aggregateVersion: 3, updatedAt: expect.any(String),
    });
    await db.query(`UPDATE clinic_schema.clinic_patient_local_profiles
      SET alias=NULL,aggregate_version=4,updated_at=clock_timestamp()
      WHERE clinic_id=$1 AND clinic_location_id=$2 AND patient_id=$3`, [I.clinic, I.location, I.pet]);
    expect((await detail(actor())).body.patient.localProfile).toEqual({
      alias: null, administrativeReference: null, aggregateVersion: 4, updatedAt: expect.any(String),
    });
  });

  it('never substitutes another location profile and preserves foreign/no-leak authority', async () => {
    const otherConsent = 'c9000000-0000-4000-8000-000000000002';
    const otherAssociation = 'ca000000-0000-4000-8000-000000000002';
    await db.query(`INSERT INTO clinic_schema.clinic_patient_consents
      (id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at)
      VALUES($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',
        clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days')`,
    [otherConsent, I.clinic, I.otherLocation, I.pet, I.owner]);
    await db.query(`INSERT INTO clinic_schema.clinic_patient_associations
      (id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,
       visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at)
      VALUES($1,$2,$3,$4,'ACTIVE','APPOINTMENT',$5,$6,'detail-test-v1',
        clock_timestamp()+interval '30 days',clock_timestamp()-interval '3 days',clock_timestamp()-interval '1 hour')`,
    [otherAssociation, I.clinic, I.otherLocation, I.pet, appointmentId(1), otherConsent]);
    await db.query(`INSERT INTO clinic_schema.clinic_patient_local_profiles
      (clinic_id,clinic_location_id,patient_id,alias)
      VALUES($1,$2,$3,'Чужая локация')`, [I.clinic, I.otherLocation, I.pet]);

    expect((await detail(actor())).body.patient.localProfile).toEqual({
      alias: null, administrativeReference: null, aggregateVersion: 0, updatedAt: null,
    });
    const foreign = await detail(actor(), I.pet, I.foreignClinic, I.location);
    expect(foreign.status).toBe(403);
    expect(JSON.stringify(foreign.body)).not.toContain('Чужая локация');
  });

  it('keeps mutation create/replace/clear/stale-conflict compatible with authoritative detail reads', async () => {
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS = 'true';
    const mutate = async (alias: string | null, version: number) => request(app.getHttpServer())
      .patch(`/v1/clinic/${I.clinic}/locations/${I.location}/patients/${I.pet}/local-profile`)
      .set('Authorization', `Bearer ${await token(actor())}`)
      .set('If-Match', `"${version}"`)
      .set('Idempotency-Key', randomUUID())
      .send({ alias });

    expect((await detail(actor())).body.patient.localProfile.aggregateVersion).toBe(0);
    expect((await mutate('Первый alias', 0)).body.aggregateVersion).toBe(1);
    expect((await detail(actor())).body.patient.localProfile).toMatchObject({ alias: 'Первый alias', aggregateVersion: 1 });
    expect((await mutate('Второй alias', 1)).body.aggregateVersion).toBe(2);
    const stale = await mutate('Устаревший alias', 1);
    expect(stale.status).toBe(409);
    expect((await detail(actor())).body.patient.localProfile).toMatchObject({ alias: 'Второй alias', aggregateVersion: 2 });
    expect((await mutate(null, 2)).body.aggregateVersion).toBe(3);
    expect((await detail(actor())).body.patient.localProfile).toEqual({
      alias: null, administrativeReference: null, aggregateVersion: 3, updatedAt: expect.any(String),
    });
  });

  it('re-evaluates revoke, archive, expiry, policy and reactivation on every stale URL request', async () => {
    expect((await detail(actor())).status).toBe(200);
    await db.query(`UPDATE clinic_schema.clinic_patient_associations
      SET status='REVOKED',revoked_at=clock_timestamp(),revoke_reason='CONSENT_WITHDRAWN'
      WHERE id=$1`, [I.association]);
    expect((await detail(actor())).status).toBe(404);
    await seed(db);
    await db.query(`UPDATE clinic_schema.clinic_patient_associations
      SET status='ARCHIVED',archived_at=clock_timestamp(),archive_reason='STALE'
      WHERE id=$1`, [I.association]);
    expect((await detail(actor())).status).toBe(404);
    await seed(db);
    await db.query(`UPDATE clinic_schema.clinic_patient_consents SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1`, [I.consent]);
    expect((await detail(actor())).status).toBe(404);
    await seed(db);
    await db.query(`UPDATE clinic_schema.clinic_patient_consents SET revoked_at=clock_timestamp(),revoked_by_actor_type='OWNER',revoked_by_actor_id=$2,revoke_reason='WITHDRAWN' WHERE id=$1`, [I.consent, I.owner]);
    expect((await detail(actor())).status).toBe(404);
    await seed(db);
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'denied-v2';
    expect((await detail(actor())).status).toBe(404);
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'detail-test-v1';
    expect((await detail(actor())).status).toBe(200);
  });

  it('bounds and deterministically orders appointments without using them as inclusion authority', async () => {
    for (let n = 3; n <= 14; n += 1) await appointment(db, I.pet, n, -n, n % 2 ? 'NO_SHOW' : 'COMPLETED');
    await db.query(`UPDATE clinic_schema.appointment_slots
      SET starts_at=statement_timestamp()-interval '1 minute',ends_at=statement_timestamp()+interval '29 minutes'
      WHERE id IN ('c6000000-0000-4000-8000-000000000013','c6000000-0000-4000-8000-000000000014')`);
    const response = await detail(actor());
    expect(response.status).toBe(200);
    expect(response.body.patient.appointments.recent).toHaveLength(10);
    const times = response.body.patient.appointments.recent.map((item: { startsAt: string }) => item.startsAt);
    expect(times).toEqual([...times].sort().reverse());
    const tied = response.body.patient.appointments.recent
      .filter((item: { appointmentId: string }) => [appointmentId(13), appointmentId(14)].includes(item.appointmentId));
    expect(tied.map((item: { appointmentId: string }) => item.appointmentId)).toEqual([appointmentId(14), appointmentId(13)]);
    expect(tied[0].startsAt).toBe(tied[1].startsAt);
    await db.query(`DELETE FROM booking_schema.appointments WHERE id=$1`, [appointmentId(2)]);
    expect((await detail(actor())).body.patient.appointments.next).toBeNull();
    await db.query('DELETE FROM clinic_schema.clinic_patient_associations WHERE id=$1', [I.association]);
    expect((await detail(actor())).status).toBe(404);
  });

  it('rejects impossible appointment timestamps and duplicate/internal projection rows', () => {
    const service = app.get(ClinicPatientDetailService) as any;
    const summary = {
      appointmentId: appointmentId(1),
      startsAt: '2025-02-30T10:00:00.000Z',
      endsAt: '2025-02-30T10:30:00.000Z',
      statusCode: 'SCHEDULED',
      serviceName: null,
      veterinarianName: null,
      internalEventId: 'forbidden',
    };
    const row = {
      patient_id: I.pet, display_name: 'Барсик', species: 'CAT', breed: null, sex: null,
      birth_date: null, first_seen_at: new Date(), last_seen_at: new Date(),
      last_appointment: summary, next_appointment: null, recent_appointments: [],
      local_alias: null, local_administrative_reference: null,
      local_aggregate_version: 0, local_updated_at: null,
    };
    expect(() => service.toDto(
      { clinicId: I.clinic, locationId: I.location, patientId: I.pet }, new Date(), row,
    )).toThrow('Invalid patient detail timestamp');
    const valid = { ...summary, startsAt: '2025-02-28T10:00:00.000Z', endsAt: '2025-02-28T10:30:00.000Z' };
    expect(() => service.toDto(
      { clinicId: I.clinic, locationId: I.location, patientId: I.pet }, new Date(),
      { ...row, last_appointment: valid, recent_appointments: [valid, valid] },
    )).toThrow('Invalid patient detail appointments');
  });

  it('fails closed for unavailable policy, malformed source and technical database failure', async () => {
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION;
    expect((await detail(actor())).status).toBe(503);
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'detail-test-v1';
    await db.query(`UPDATE pet_schema.pets SET name='' WHERE id=$1`, [I.pet]);
    const malformed = await detail(actor());
    expect(malformed.status).toBe(500);
    expect(malformed.body.patient).toBeUndefined();
    await seed(db);
    const failure = jest.spyOn(db, 'withTransaction').mockRejectedValueOnce(new Error('private SQL'));
    const technical = await detail(actor());
    failure.mockRestore();
    expect(technical.status).toBe(500);
    expect(technical.body.patient).toBeUndefined();
    expect(JSON.stringify(technical.body)).not.toContain('private SQL');
  });

  it('has no read side effects under replay/concurrency and uses a bounded production-like plan', async () => {
    await addNoise(db);
    const before = await effects(db);
    const responses = await Promise.all([detail(actor()), detail(actor()), detail(actor())]);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(await effects(db)).toEqual(before);
    const now = new Date();
    const plan = await db.query<{ 'QUERY PLAN': string }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${CLINIC_PATIENT_DETAIL_SQL}`,
      [I.clinic, I.location, I.pet, 'detail-test-v1', now],
    );
    const text = plan.rows.map((row) => row['QUERY PLAN']).join('\n');
    expect(text).toMatch(/Limit/);
    expect(text).not.toMatch(/external merge|Disk:/i);
  });
});

async function seed(db: DatabaseService) {
  await db.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await db.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  await db.query('INSERT INTO identity_schema.users(id) SELECT unnest($1::uuid[])', [[I.owner, I.employee, I.admin, I.vet, I.inactive, I.revoked]]);
  await db.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES($1,'Detail LLC','Detail')`, [I.clinic]);
  await db.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES($1,$2,'Main'),($3,$2,'Other')`, [I.location, I.clinic, I.otherLocation]);
  await db.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES($1,$3,'CLINIC_RECEPTIONIST'),($2,$3,'CLINIC_ADMIN')`, [I.employee, I.admin, I.location]);
  await db.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active,revoked_at)
    VALUES($1,$2,'CLINIC_RECEPTIONIST',false,clock_timestamp())`, [I.revoked, I.location]);
  await db.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES($1,$2,'DETAIL','Приём',30)`, [I.service, I.location]);
  await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species,breed,birth_date,sex) VALUES
    ($1,$3,'Барсик','CAT','Сибирская','2020-02-29','MALE'),($2,$3,'Чужой','DOG',NULL,NULL,NULL)`,
  [I.pet, I.unrelatedPet, I.owner]);
  await appointment(db, I.pet, 1, -120, 'COMPLETED');
  await appointment(db, I.pet, 2, 120, 'CONFIRMED');
  await db.query(`INSERT INTO clinic_schema.clinic_patient_consents
    (id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at)
    VALUES($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days')`,
  [I.consent, I.clinic, I.location, I.pet, I.owner]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_associations
    (id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,
     visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at)
    VALUES($1,$2,$3,$4,'ACTIVE','APPOINTMENT',$5,$6,'detail-test-v1',clock_timestamp()+interval '30 days',
      clock_timestamp()-interval '3 days',clock_timestamp()-interval '1 hour')`,
  [I.association, I.clinic, I.location, I.pet, appointmentId(1), I.consent]);
}

const appointmentId = (n: number) => `c8000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function appointment(db: DatabaseService, petId: string, n: number, minutes: number, status: string) {
  const suffix = String(n).padStart(12, '0');
  const slot = `c6000000-0000-4000-8000-${suffix}`;
  const hold = `c7000000-0000-4000-8000-${suffix}`;
  await db.query(`INSERT INTO clinic_schema.appointment_slots
    (id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode)
    VALUES($1,$2,$3,clock_timestamp()+$4*interval '1 minute',clock_timestamp()+($4+30)*interval '1 minute',1,'BOOKED','LEVEL_C')`,
  [slot, I.location, I.service, minutes]);
  await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at)
    VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')`, [hold, slot, I.owner, petId]);
  await db.query(`INSERT INTO booking_schema.appointments
    (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp())`,
  [appointmentId(n), hold, I.owner, petId, I.location, slot, status]);
}

async function effects(db: DatabaseService) {
  const result = await db.query(`SELECT
    (SELECT SUM(version) FROM clinic_schema.clinic_patient_associations)::text associations,
    (SELECT COUNT(*) FROM clinic_schema.clinic_patient_association_revisions)::text revisions,
    (SELECT COUNT(*) FROM clinic_schema.clinic_patient_association_event_receipts)::text receipts,
    (SELECT COUNT(*) FROM booking_schema.outbox_events)::text outbox,
    (SELECT COUNT(*) FROM audit_schema.audit_log)::text audit`);
  return result.rows[0];
}

async function addNoise(db: DatabaseService) {
  await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species)
    SELECT ('d5000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1::uuid,'Noise '||n,'DOG'
    FROM generate_series(1,200) n`, [I.owner]);
}
