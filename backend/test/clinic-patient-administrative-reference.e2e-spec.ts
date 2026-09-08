import 'reflect-metadata';
import { resetBookingPersistence } from './helpers/booking-test-reset';
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

jest.setTimeout(90_000);

const I = {
  owner: 'e1000000-0000-4000-8000-000000000001',
  employee: 'e1000000-0000-4000-8000-000000000002',
  admin: 'e1000000-0000-4000-8000-000000000003',
  vet: 'e1000000-0000-4000-8000-000000000004',
  inactive: 'e1000000-0000-4000-8000-000000000005',
  clinic: 'e2000000-0000-4000-8000-000000000001',
  foreignClinic: 'e2000000-0000-4000-8000-000000000002',
  location: 'e3000000-0000-4000-8000-000000000001',
  otherLocation: 'e3000000-0000-4000-8000-000000000002',
  foreignLocation: 'e3000000-0000-4000-8000-000000000003',
  service: 'e4000000-0000-4000-8000-000000000001',
  pet: 'e5000000-0000-4000-8000-000000000001',
  consent: 'e9000000-0000-4000-8000-000000000001',
  association: 'ea000000-0000-4000-8000-000000000001',
  slot: 'e6000000-0000-4000-8000-000000000001',
  hold: 'e7000000-0000-4000-8000-000000000001',
  appointment: 'e8000000-0000-4000-8000-000000000001',
  owner2: 'f1000000-0000-4000-8000-000000000001',
  pet2: 'f5000000-0000-4000-8000-000000000001',
  consent2: 'f9000000-0000-4000-8000-000000000001',
  association2: 'fa000000-0000-4000-8000-000000000001',
  slot2: 'f6000000-0000-4000-8000-000000000001',
  hold2: 'f7000000-0000-4000-8000-000000000001',
  appointment2: 'f8000000-0000-4000-8000-000000000001',
};
type Actor = { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] };

describe('Clinic patient administrative reference HTTP/PostgreSQL contract', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS = 'true';
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'reference-test-v1';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    db = app.get(DatabaseService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS = 'true';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'reference-test-v1';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
    await seed(db);
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS;
    delete process.env.VETHELP_CLINIC_PATIENTS_REGISTRY;
  });

  const actor = (role = Role.CLINIC_RECEPTIONIST): Actor => ({
    sub: role === Role.CLINIC_ADMIN ? I.admin : role === Role.CLINIC_VETERINARIAN ? I.vet : I.employee,
    roles: [role], clinicIds: [I.clinic], locationIds: [I.location],
  });
  const token = (value: Actor) => jwt.signAsync(value, {
    secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256',
  });
  const patch = async (options: {
    value?: Actor | null; administrativeReference?: unknown; version?: string | null; key?: string;
    clinicId?: string; locationId?: string; patientId?: string; extra?: Record<string, unknown>;
  } = {}) => {
    const call = request(app.getHttpServer())
      .patch(`/v1/clinic/${options.clinicId ?? I.clinic}/locations/${options.locationId ?? I.location}/patients/${options.patientId ?? I.pet}/local-profile/reference`)
      .send({ administrativeReference: options.administrativeReference === undefined ? 'Барсик Петровых' : options.administrativeReference, ...(options.extra ?? {}) });
    const value = options.value === undefined ? actor() : options.value;
    if (value) call.set('Authorization', `Bearer ${await token(value)}`);
    if (options.version !== null) call.set('If-Match', options.version ?? '"0"');
    call.set('Idempotency-Key', options.key ?? randomUUID());
    return call;
  };

  it('H-01..H-05/H-28 reads absent, sets, replaces and clears with authoritative shared versions', async () => {
    const absent = await request(app.getHttpServer())
      .get(`/v1/clinic/${I.clinic}/locations/${I.location}/patients/${I.pet}`)
      .set('Authorization', `Bearer ${await token(actor())}`);
    expect(absent.body.patient.localProfile).toEqual({
      alias: null, administrativeReference: null, aggregateVersion: 0, updatedAt: null,
    });
    const set = await patch();
    expect(set.status).toBe(200);
    expect(set.body).toEqual({
      patientId: I.pet, clinicId: I.clinic, locationId: I.location,
      alias: null, administrativeReference: 'Барсик Петровых', aggregateVersion: 1, updatedAt: expect.any(String),
    });
    const projected = await request(app.getHttpServer())
      .get(`/v1/clinic/${I.clinic}/locations/${I.location}/patients/${I.pet}`)
      .set('Authorization', `Bearer ${await token(actor())}`);
    expect(projected.body.patient.localProfile).toEqual({
      alias: null, administrativeReference: 'Барсик Петровых', aggregateVersion: 1, updatedAt: expect.any(String),
    });
    const replace = await patch({ administrativeReference: '  Семейный Барсик  ', version: '"1"' });
    expect(replace.status).toBe(200);
    expect(replace.body).toMatchObject({ administrativeReference: 'Семейный Барсик', aggregateVersion: 2 });
    const clear = await patch({ administrativeReference: null, version: '"2"' });
    expect(clear.status).toBe(200);
    expect(clear.body).toMatchObject({ administrativeReference: null, aggregateVersion: 3 });
    const stored = await db.query(`SELECT alias,administrative_reference,administrative_reference_key,aggregate_version
      FROM clinic_schema.clinic_patient_local_profiles`);
    expect(stored.rows).toEqual([{
      alias: null, administrative_reference: null, administrative_reference_key: null, aggregate_version: 3,
    }]);
  });

  it('increments version for a same-value command with a new idempotency key', async () => {
    expect((await patch({ administrativeReference: 'Барсик' })).body.aggregateVersion).toBe(1);
    const repeated = await patch({ administrativeReference: 'Барсик', version: '"1"' });
    expect(repeated.status).toBe(200);
    expect(repeated.body).toMatchObject({ administrativeReference: 'Барсик', aggregateVersion: 2 });
  });

  it('H-12..H-14/H-22..H-26 denies unauthorized, foreign and lifecycle states without leakage/effects', async () => {
    expect((await patch({ value: null })).status).toBe(401);
    expect((await patch({ value: actor(Role.CLINIC_VETERINARIAN) })).status).toBe(403);
    expect((await patch({ clinicId: I.foreignClinic })).status).toBe(404);
    expect((await patch({ locationId: I.otherLocation })).status).toBe(404);
    expect((await patch({ value: { ...actor(), sub: I.inactive } })).status).toBe(404);
    expect((await patch({ patientId: 'not-a-uuid' })).status).toBe(404);
    expect(await effects(db)).toEqual({ profiles: '0', audit: '0', outbox: '0', idempotency: '0' });
  });

  it('H-15..H-16 requires a strong current If-Match and leaves no effects', async () => {
    expect((await patch({ version: null })).status).toBe(428);
    expect((await patch({ version: '0' })).status).toBe(428);
    expect((await patch({ version: 'W/"0"' })).status).toBe(428);
    expect((await patch({ version: '"nope"' })).status).toBe(428);
    expect((await patch({ version: '"1"' })).status).toBe(409);
    expect((await patch({ version: '"999"' })).status).toBe(409);
    expect(await effects(db)).toEqual({ profiles: '0', audit: '0', outbox: '0', idempotency: '0' });
  });

  it('H-20 serializes concurrent reference writers so one matching version wins', async () => {
    const responses = await Promise.all([
      patch({ administrativeReference: 'Первый', version: '"0"' }),
      patch({ administrativeReference: 'Второй', version: '"0"' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await db.query('SELECT COUNT(*)::text count,MAX(aggregate_version) version FROM clinic_schema.clinic_patient_local_profiles')).rows[0])
      .toEqual({ count: '1', version: 1 });
  });

  it('H-09/H-21/H-28 normalizes same-location collisions, has one concurrent winner, and clear releases the key', async () => {
    const responses = await Promise.all([
      patch({ patientId: I.pet, administrativeReference: 'Straße-1' }),
      patch({ patientId: I.pet2, administrativeReference: 'STRASSE-1' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = responses[0].status === 200 ? I.pet : I.pet2;
    const loser = winner === I.pet ? I.pet2 : I.pet;
    const clear = await patch({ patientId: winner, administrativeReference: null, version: '"1"' });
    expect(clear.status).toBe(200);
    const reuse = await patch({ patientId: loser, administrativeReference: 'strasse-1' });
    expect(reuse.status).toBe(200);
    expect(reuse.body.administrativeReference).toBe('strasse-1');
  });

  it('H-10/H-11 allows the same normalized key in another location and another clinic', async () => {
    expect((await patch({ administrativeReference: 'PET-004281' })).status).toBe(200);
    await seedReferenceScope(db, I.clinic, I.otherLocation, false);
    await seedReferenceScope(db, I.foreignClinic, I.foreignLocation, true);
    const references = await db.query(`
      SELECT clinic_id,clinic_location_id,administrative_reference_key
      FROM clinic_schema.clinic_patient_local_profiles
      ORDER BY clinic_id,clinic_location_id
    `);
    expect(references.rows).toHaveLength(3);
    expect(references.rows.every((row) => row.administrative_reference_key === 'pet-004281')).toBe(true);
    expect(new Set(references.rows.map((row) => `${row.clinic_id}/${row.clinic_location_id}`)).size).toBe(3);
  });

  it('H-17..H-18 replays one result and rejects same-key different normalized payload', async () => {
    const key = randomUUID();
    const first = await patch({ key, administrativeReference: 'Барсик' });
    const replay = await patch({ key, administrativeReference: 'Барсик' });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(await effects(db)).toEqual({ profiles: '1', audit: '1', outbox: '1', idempotency: '1' });
    const mismatch = await patch({ key, administrativeReference: 'Другой' });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('H-22..H-24 rechecks association, archive, consent and policy after prior visibility', async () => {
    await db.query(`UPDATE clinic_schema.clinic_patient_associations
      SET status='REVOKED',revoked_at=clock_timestamp(),revoke_reason='WITHDRAWN' WHERE id=$1`, [I.association]);
    expect((await patch()).status).toBe(404);
    await seed(db);
    await db.query(`UPDATE clinic_schema.clinic_patient_associations
      SET status='ARCHIVED',archived_at=clock_timestamp(),archive_reason='STALE' WHERE id=$1`, [I.association]);
    expect((await patch()).status).toBe(404);
    await seed(db);
    await db.query(`UPDATE clinic_schema.clinic_patient_consents
      SET revoked_at=clock_timestamp(),revoked_by_actor_type='OWNER',revoked_by_actor_id=$2,revoke_reason='WITHDRAWN'
      WHERE id=$1`, [I.consent, I.owner]);
    expect((await patch()).status).toBe(404);
    await seed(db);
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION;
    expect((await patch()).status).toBe(503);
    expect(await effects(db)).toEqual({ profiles: '0', audit: '0', outbox: '0', idempotency: '0' });
  });

  it('H-27/H-32 is default-off without affecting authoritative Detail read', async () => {
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS = 'false';
    const before = await effects(db);
    expect((await patch()).status).toBe(404);
    const read = await request(app.getHttpServer())
      .get(`/v1/clinic/${I.clinic}/locations/${I.location}/patients/${I.pet}`)
      .set('Authorization', `Bearer ${await token(actor())}`);
    expect(read.status).toBe(200);
    expect(read.body.patient.localProfile).toEqual({
      alias: null, administrativeReference: null, aggregateVersion: 0, updatedAt: null,
    });
    const registry = await request(app.getHttpServer())
      .get(`/v1/clinic/${I.clinic}/locations/${I.location}/patients`)
      .set('Authorization', `Bearer ${await token(actor())}`);
    expect(registry.status).toBe(200);
    expect(registry.body.items).not.toHaveLength(0);
    expect(registry.body.items[0].administrativeReference).toBeNull();
    expect(JSON.stringify(registry.body.items[0])).not.toContain('localProfile');
    expect(await effects(db)).toEqual(before);
  });

  it('H-06..H-08 strictly validates, NFC-normalizes, folds spaces and rejects unknown fields', async () => {
    for (const administrativeReference of [
      'x'.repeat(41), '   ', 'line\nbreak', `control${String.fromCharCode(1)}`,
      '🐕-123', 'www.example.com', '123 456 7890', 'mail@example.com',
    ]) {
      const response = await patch({ administrativeReference });
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('INVALID_ADMINISTRATIVE_REFERENCE');
    }
    expect((await patch({ extra: { note: 'forbidden' } })).status).toBe(400);
    expect(await effects(db)).toEqual({ profiles: '0', audit: '0', outbox: '0', idempotency: '0' });
    const normalized = await patch({ administrativeReference: '  Pe\u0301T   004  ' });
    expect(normalized.status).toBe(200);
    expect(normalized.body.administrativeReference).toBe('PéT 004');
    expect((await db.query(`SELECT administrative_reference_key key
      FROM clinic_schema.clinic_patient_local_profiles`)).rows[0].key).toBe('pét 004');
  });

  it('H-25 writes safe transactional audit/outbox without raw value', async () => {
    expect((await patch({ administrativeReference: 'SECRET-004281' })).status).toBe(200);
    const evidence = await db.query(`SELECT
      (SELECT payload_json FROM audit_schema.audit_log WHERE action='clinic.patient-administrative-reference.updated') audit,
      (SELECT payload_json FROM booking_schema.outbox_events WHERE event_type='clinic.patient-administrative-reference.updated.v1') outbox`);
    const serialized = JSON.stringify(evidence.rows[0]);
    expect(serialized).toContain('"changedFields":["administrativeReference"]');
    expect(serialized).toContain('"operation":"SET"');
    expect(serialized).not.toContain('SECRET-004281');
    expect((await patch({ clinicId: I.foreignClinic, version: '"1"' })).status).toBe(404);
    expect((await db.query('SELECT COUNT(*)::text count FROM clinic_schema.clinic_patient_local_profiles')).rows[0].count).toBe('1');
  });

  it('H-30 rolls back reference, version, idempotency and audit when outbox insertion fails', async () => {
    await db.query(`
      CREATE OR REPLACE FUNCTION public.v50_reference_outbox_failure() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.producer='clinic-patient-local-profile' THEN
          RAISE EXCEPTION 'forced reference outbox failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER v50_reference_outbox_failure
      BEFORE INSERT ON booking_schema.outbox_events
      FOR EACH ROW EXECUTE FUNCTION public.v50_reference_outbox_failure()
    `);
    try {
      expect((await patch()).status).toBe(500);
      expect(await effects(db)).toEqual({ profiles: '0', audit: '0', outbox: '0', idempotency: '0' });
    } finally {
      await db.query(`
        DROP TRIGGER IF EXISTS v50_reference_outbox_failure ON booking_schema.outbox_events;
        DROP FUNCTION IF EXISTS public.v50_reference_outbox_failure()
      `);
    }
  });

  it('H-19 proves alias and reference commands share one aggregate version', async () => {
    expect((await patch({ administrativeReference: 'PET-1' })).body.aggregateVersion).toBe(1);
    const alias = await request(app.getHttpServer())
      .patch(`/v1/clinic/${I.clinic}/locations/${I.location}/patients/${I.pet}/local-profile`)
      .set('Authorization', `Bearer ${await token(actor())}`)
      .set('If-Match', '"1"').set('Idempotency-Key', randomUUID()).send({ alias: 'Барсик клиники' });
    expect(alias.body.aggregateVersion).toBe(2);
    expect((await patch({ administrativeReference: 'PET-2', version: '"1"' })).status).toBe(409);
    const reference = await patch({ administrativeReference: 'PET-2', version: '"2"' });
    expect(reference.body).toMatchObject({ alias: 'Барсик клиники', administrativeReference: 'PET-2', aggregateVersion: 3 });
    const staleAlias = await request(app.getHttpServer())
      .patch(`/v1/clinic/${I.clinic}/locations/${I.location}/patients/${I.pet}/local-profile`)
      .set('Authorization', `Bearer ${await token(actor())}`)
      .set('If-Match', '"2"').set('Idempotency-Key', randomUUID()).send({ alias: 'stale' });
    expect(staleAlias.status).toBe(409);
  });
});

async function seed(db: DatabaseService) {
  await db.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await resetBookingPersistence(db);
  await db.query('INSERT INTO identity_schema.users(id) SELECT unnest($1::uuid[])',
    [[I.owner, I.owner2, I.employee, I.admin, I.vet, I.inactive]]);
  await db.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name)
    VALUES($1,'Alias LLC','Alias'),($2,'Foreign LLC','Foreign')`, [I.clinic, I.foreignClinic]);
  await db.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address)
    VALUES($1,$2,'Main'),($3,$2,'Other')`, [I.location, I.clinic, I.otherLocation]);
  await db.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role)
    VALUES($1,$3,'CLINIC_RECEPTIONIST'),($2,$3,'CLINIC_ADMIN'),($4,$3,'CLINIC_VETERINARIAN')`,
  [I.employee, I.admin, I.location, I.vet]);
  await db.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active,revoked_at)
    VALUES($1,$2,'CLINIC_RECEPTIONIST',false,clock_timestamp())`, [I.inactive, I.location]);
  await db.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes)
    VALUES($1,$2,'ALIAS','Приём',30)`, [I.service, I.location]);
  await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species)
    VALUES($1,$2,'Барсик','CAT'),($3,$4,'Мурзик','CAT')`, [I.pet, I.owner, I.pet2, I.owner2]);
  await db.query(`INSERT INTO clinic_schema.appointment_slots
    (id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode)
    VALUES($1,$2,$3,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '90 minutes',1,'BOOKED','LEVEL_C')`,
  [I.slot, I.location, I.service]);
  await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at)
    VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')`, [I.hold, I.slot, I.owner, I.pet]);
  await db.query(`INSERT INTO booking_schema.appointments
    (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,created_at)
    VALUES($1,$2,$3,$4,$5,$6,'COMPLETED',clock_timestamp()-interval '1 day')`,
  [I.appointment, I.hold, I.owner, I.pet, I.location, I.slot]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_consents
    (id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at)
    VALUES($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',
      clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days')`,
  [I.consent, I.clinic, I.location, I.pet, I.owner]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_associations
    (id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,
     visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at)
    VALUES($1,$2,$3,$4,'ACTIVE','APPOINTMENT',$5,$6,'reference-test-v1',
      clock_timestamp()+interval '30 days',clock_timestamp()-interval '3 days',clock_timestamp()-interval '1 hour')`,
  [I.association, I.clinic, I.location, I.pet, I.appointment, I.consent]);
  await db.query(`INSERT INTO clinic_schema.appointment_slots
    (id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode)
    VALUES($1,$2,$3,clock_timestamp()-interval '4 hours',clock_timestamp()-interval '210 minutes',1,'BOOKED','LEVEL_C')`,
  [I.slot2, I.location, I.service]);
  await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at)
    VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')`, [I.hold2, I.slot2, I.owner2, I.pet2]);
  await db.query(`INSERT INTO booking_schema.appointments
    (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,created_at)
    VALUES($1,$2,$3,$4,$5,$6,'COMPLETED',clock_timestamp()-interval '1 day')`,
  [I.appointment2, I.hold2, I.owner2, I.pet2, I.location, I.slot2]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_consents
    (id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at)
    VALUES($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',
      clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days')`,
  [I.consent2, I.clinic, I.location, I.pet2, I.owner2]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_associations
    (id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,
     visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at)
    VALUES($1,$2,$3,$4,'ACTIVE','APPOINTMENT',$5,$6,'reference-test-v1',
      clock_timestamp()+interval '30 days',clock_timestamp()-interval '3 days',clock_timestamp()-interval '1 hour')`,
  [I.association2, I.clinic, I.location, I.pet2, I.appointment2, I.consent2]);
  await db.query(`
    INSERT INTO clinic_schema.clinic_patient_association_revisions
      (association_id,association_version,clinic_id,clinic_location_id,pet_id,status,source_type,
       source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at)
    SELECT id,version,clinic_id,clinic_location_id,pet_id,status,source_type,
      source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at
    FROM clinic_schema.clinic_patient_associations
    WHERE id=ANY($1::uuid[])
  `, [[I.association, I.association2]]);
}

async function effects(db: DatabaseService) {
  const result = await db.query(`SELECT
    (SELECT COUNT(*) FROM clinic_schema.clinic_patient_local_profiles)::text profiles,
    (SELECT COUNT(*) FROM audit_schema.audit_log)::text audit,
    (SELECT COUNT(*) FROM booking_schema.outbox_events)::text outbox,
    (SELECT COUNT(*) FROM booking_schema.idempotency_records)::text idempotency`);
  return result.rows[0];
}

async function seedReferenceScope(
  db: DatabaseService,
  clinicId: string,
  locationId: string,
  createLocation: boolean,
) {
  const ids = Array.from({ length: 6 }, () => randomUUID());
  const [serviceId, slotId, holdId, appointmentId, consentId, associationId] = ids;
  if (createLocation) {
    await db.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address)
      VALUES($1,$2,'Reference scope')`, [locationId, clinicId]);
  }
  await db.query(`INSERT INTO clinic_schema.clinic_services
    (id,clinic_location_id,code,display_name,duration_minutes)
    VALUES($1,$2,$3,'Reference scope',30)`, [serviceId, locationId, `REF-${locationId.slice(-4)}`]);
  await db.query(`INSERT INTO clinic_schema.appointment_slots
    (id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode)
    VALUES($1,$2,$3,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '90 minutes',1,'BOOKED','LEVEL_C')`,
  [slotId, locationId, serviceId]);
  await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at)
    VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')`, [holdId, slotId, I.owner, I.pet]);
  await db.query(`INSERT INTO booking_schema.appointments
    (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,created_at)
    VALUES($1,$2,$3,$4,$5,$6,'COMPLETED',clock_timestamp()-interval '1 day')`,
  [appointmentId, holdId, I.owner, I.pet, locationId, slotId]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_consents
    (id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at)
    VALUES($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',
      clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days')`,
  [consentId, clinicId, locationId, I.pet, I.owner]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_associations
    (id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,
     visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at)
    VALUES($1,$2,$3,$4,'ACTIVE','APPOINTMENT',$5,$6,'reference-test-v1',
      clock_timestamp()+interval '30 days',clock_timestamp()-interval '3 days',clock_timestamp()-interval '1 hour')`,
  [associationId, clinicId, locationId, I.pet, appointmentId, consentId]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_local_profiles
    (clinic_id,clinic_location_id,patient_id,administrative_reference,administrative_reference_key)
    VALUES($1,$2,$3,'pet-004281','pet-004281')`, [clinicId, locationId, I.pet]);
}
