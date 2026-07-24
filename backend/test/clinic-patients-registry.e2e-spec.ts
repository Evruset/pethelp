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

const I = {
  owner: 'a1000000-0000-4000-8000-000000000001',
  employee: 'a1000000-0000-4000-8000-000000000002',
  admin: 'a1000000-0000-4000-8000-000000000003',
  vet: 'a1000000-0000-4000-8000-000000000004',
  clinic: 'a2000000-0000-4000-8000-000000000001',
  location: 'a3000000-0000-4000-8000-000000000001',
  otherLocation: 'a3000000-0000-4000-8000-000000000002',
  service: 'a4000000-0000-4000-8000-000000000001',
  pet1: 'a5000000-0000-4000-8000-000000000001',
  pet2: 'a5000000-0000-4000-8000-000000000002',
  pet3: 'a5000000-0000-4000-8000-000000000003',
};

type Actor = { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] };

describe('Clinic patients registry HTTP/PostgreSQL contract', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'registry-test-v1';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
    process.env.VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT = '2';
    process.env.VETHELP_CLINIC_PATIENTS_SEARCH_WINDOW_SECONDS = '1';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    db = app.get(DatabaseService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => seed(db));
  afterAll(async () => {
    await app?.close();
    delete process.env.VETHELP_CLINIC_PATIENTS_REGISTRY;
    delete process.env.VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT;
    delete process.env.VETHELP_CLINIC_PATIENTS_SEARCH_WINDOW_SECONDS;
  });

  const allowed = (role = Role.CLINIC_RECEPTIONIST): Actor => ({
    sub: role === Role.CLINIC_ADMIN ? I.admin : I.employee,
    roles: [role], clinicIds: [I.clinic], locationIds: [I.location],
  });
  const token = (actor: Actor) => jwt.signAsync(actor, {
    secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256',
  });
  const list = async (actor: Actor | null, options: { q?: string; limit?: number; cursor?: string; location?: string } = {}) => {
    const query = new URLSearchParams();
    if (options.q !== undefined) query.set('q', options.q);
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    if (options.cursor !== undefined) query.set('cursor', options.cursor);
    const call = request(app.getHttpServer()).get(`/v1/clinic/${I.clinic}/locations/${options.location ?? I.location}/patients?${query}`);
    return actor ? call.set('Authorization', `Bearer ${await token(actor)}`) : call;
  };

  it('is default-off and enabled only by the backend rollout flag', async () => {
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'false';
    expect((await list(allowed())).status).toBe(404);
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    expect((await list(allowed())).status).toBe(200);
  });

  it('returns only the administrative allowlist from active association and consent state', async () => {
    const response = await list(allowed(Role.CLINIC_ADMIN));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ clinicId: I.clinic, locationId: I.location, nextCursor: null });
    expect(response.body.items.map((item: { patientId: string }) => item.patientId)).toEqual([I.pet2, I.pet1]);
    expect(response.body.items[1]).toEqual({
      patientId: I.pet1,
      pet: { displayName: 'Барсик', speciesLabel: 'Кошка', breed: 'Сибирская', sexCode: 'MALE', birthDate: '2020-02-29' },
      owner: { displayName: null },
      relationship: { firstSeenAt: expect.any(String), lastSeenAt: expect.any(String) },
      appointments: { lastVisitAt: expect.any(String), nextAppointmentAt: expect.any(String) },
    });
    const serialized = JSON.stringify(response.body).toLowerCase();
    for (const forbidden of ['ownerid', 'phone', 'email', 'diagnos', 'prescription', 'payment', 'consent', 'association', 'version']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('supports Unicode NFKC prefix search and bounded search rate limiting', async () => {
    expect((await list(allowed(), { q: '  БАР ' })).body.items.map((x: { patientId: string }) => x.patientId)).toEqual([I.pet1]);
    expect((await list(allowed(), { q: 'ба' })).status).toBe(200);
    const limited = await list(allowed(), { q: 'ба' });
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('1');
    expect(limited.body).toMatchObject({ code: 'PATIENTS_REGISTRY_SEARCH_RATE_LIMITED' });
    expect((await list(allowed(Role.CLINIC_ADMIN), { q: 'ба' })).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 1_050));
    expect((await list(allowed(), { q: 'ба' })).status).toBe(200);
    expect((await list(allowed(), { q: 'x' })).status).toBe(400);
  });

  it('uses opaque fixed-snapshot keyset pagination and rejects bound cursor mismatches', async () => {
    const first = await list(allowed(), { limit: 1 });
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const sequence = decode(first.body.nextCursor).snapshotSequence;
    await addAssociation(db, I.pet3, 3);
    const second = await list(allowed(), { limit: 1, cursor: first.body.nextCursor });
    expect(second.body.items.map((x: { patientId: string }) => x.patientId)).toEqual([I.pet1]);
    expect(second.body.nextCursor).toBeNull();
    expect(decode(first.body.nextCursor).snapshotSequence).toBe(sequence);
    expect((await list(allowed(), { limit: 2, cursor: first.body.nextCursor })).status).toBe(400);
    expect((await list(allowed(), { q: 'ба', limit: 1, cursor: first.body.nextCursor })).status).toBe(400);
    expect((await list(allowed(), { limit: 1, cursor: `${first.body.nextCursor}x` })).status).toBe(400);
  });

  it('applies current privacy state over an older snapshot immediately', async () => {
    const first = await list(allowed(), { limit: 1 });
    await db.query(`UPDATE clinic_schema.clinic_patient_consents SET revoked_at=clock_timestamp(),revoked_by_actor_type='OWNER',revoked_by_actor_id=$2,revoke_reason='WITHDRAWN' WHERE pet_id=$1`, [I.pet1, I.owner]);
    const second = await list(allowed(), { limit: 1, cursor: first.body.nextCursor });
    expect(second.body.items).toEqual([]);
    expect(second.body.nextCursor).toBeNull();
  });

  it('excludes revoked/expired/archived state and treats no-results as an authoritative empty page', async () => {
    await db.query(`UPDATE clinic_schema.clinic_patient_associations SET status='REVOKED',revoked_at=clock_timestamp(),revoke_reason='CONSENT_WITHDRAWN' WHERE pet_id=$1`, [I.pet1]);
    await db.query(`UPDATE clinic_schema.clinic_patient_consents SET expires_at=clock_timestamp()-interval '1 second' WHERE pet_id=$1`, [I.pet2]);
    await db.query(`UPDATE pet_schema.pets SET archived_at=clock_timestamp() WHERE id=$1`, [I.pet3]);
    const empty = await list(allowed());
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ items: [], nextCursor: null });
    const noResults = await list(allowed(Role.CLINIC_ADMIN), { q: 'нет' });
    expect(noResults.status).toBe(200);
    expect(noResults.body.items).toEqual([]);
  });

  it('fails closed for authority, policy and technical failures without fake empty output', async () => {
    expect((await list(null)).status).toBe(401);
    expect((await list({ sub: I.vet, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [I.clinic], locationIds: [I.location] })).status).toBe(403);
    expect((await list({ ...allowed(), locationIds: [I.otherLocation] })).status).toBe(403);
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION;
    expect((await list(allowed())).status).toBe(503);
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'registry-test-v1';
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS;
    expect((await list(allowed())).status).toBe(503);
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect((await list(allowed(), { q: 'ба' })).status).toBe(503);
    process.env.NODE_ENV = nodeEnv;
    const failure = jest.spyOn(db, 'withTransaction').mockRejectedValueOnce(new Error('private SQL'));
    const response = await list(allowed());
    failure.mockRestore();
    expect(response.status).toBe(500);
    expect(response.body.items).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('private SQL');
  });

  it('is read-only and uses the registry indexes in a bounded production-like plan', async () => {
    await addProductionLikeNoise(db);
    const before = await effects(db);
    await list(allowed());
    await list(allowed());
    expect(await effects(db)).toEqual(before);
    const plan = await db.query<{ 'QUERY PLAN': string }>(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      WITH snapshot_rows AS MATERIALIZED (
        SELECT DISTINCT ON (r.association_id)
          r.association_id,r.pet_id,r.status,r.current_consent_id,r.visibility_expires_at,r.last_qualified_at
        FROM clinic_schema.clinic_patient_association_revisions r
        WHERE r.clinic_id=$1::uuid AND r.clinic_location_id=$2::uuid
          AND r.revision_sequence <= $3::bigint
        ORDER BY r.association_id,r.revision_sequence DESC
      ), visible AS MATERIALIZED (
        SELECT r.pet_id,r.last_qualified_at
        FROM snapshot_rows r
        JOIN clinic_schema.clinic_patient_associations a ON a.id=r.association_id
          AND a.clinic_id=$1::uuid AND a.clinic_location_id=$2::uuid AND a.pet_id=r.pet_id
          AND a.current_consent_id=r.current_consent_id
        JOIN clinic_schema.clinic_patient_consents c ON c.id=r.current_consent_id
          AND c.clinic_id=$1::uuid AND c.clinic_location_id=$2::uuid AND c.pet_id=r.pet_id
        JOIN pet_schema.pets p ON p.id=r.pet_id AND p.archived_at IS NULL
        WHERE r.status='ACTIVE' AND r.visibility_expires_at > $4::timestamptz
          AND a.status='ACTIVE' AND a.revoked_at IS NULL AND a.archived_at IS NULL
          AND a.visibility_policy_version=$5 AND a.visibility_expires_at > $4::timestamptz
          AND c.purpose='PATIENT_ADMIN_REGISTRY' AND c.revoked_at IS NULL
          AND c.granted_at <= $4::timestamptz AND (c.expires_at IS NULL OR c.expires_at > $4::timestamptz)
          AND lower(p.name) LIKE $6::text || '%' ESCAPE '\\'
        ORDER BY r.last_qualified_at DESC,r.pet_id DESC LIMIT 51
      ), appointment_aggregates AS (
        SELECT v.pet_id,MIN(a.created_at) AS first_seen_at,MAX(a.created_at) AS last_seen_at,
          MAX(s.starts_at) FILTER (WHERE s.starts_at <= $4 AND a.status IN ('COMPLETED','NO_SHOW')) AS last_visit_at,
          MIN(s.starts_at) FILTER (WHERE s.starts_at > $4 AND a.status NOT IN ('CLINIC_CANCELLED','CANCELLED')) AS next_appointment_at
        FROM visible v
        JOIN booking_schema.appointments a ON a.pet_id=v.pet_id AND a.clinic_location_id=$2::uuid
        JOIN clinic_schema.appointment_slots s ON s.id=a.slot_id AND s.clinic_location_id=$2::uuid
        GROUP BY v.pet_id
      )
      SELECT v.pet_id,p.name,aa.first_seen_at,v.last_qualified_at,aa.last_visit_at,aa.next_appointment_at
      FROM visible v JOIN pet_schema.pets p ON p.id=v.pet_id
      JOIN appointment_aggregates aa ON aa.pet_id=v.pet_id
      ORDER BY v.last_qualified_at DESC,v.pet_id DESC
    `, [I.clinic, I.location, 2, new Date(), 'registry-test-v1', 'б']);
    const text = plan.rows.map((row) => row['QUERY PLAN']).join('\n');
    expect(text).toMatch(/Limit/);
  });
});

function decode(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor.split('.')[0], 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function seed(db: DatabaseService) {
  await db.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await db.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  await db.query('ALTER SEQUENCE clinic_schema.clinic_patient_association_revision_sequence RESTART WITH 1');
  await db.query('INSERT INTO identity_schema.users(id) SELECT unnest($1::uuid[])', [[I.owner, I.employee, I.admin, I.vet]]);
  await db.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES($1,'Patients LLC','Patients')`, [I.clinic]);
  await db.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES($1,$2,'Main'),($3,$2,'Other')`, [I.location, I.clinic, I.otherLocation]);
  await db.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES($1,$3,'CLINIC_RECEPTIONIST'),($2,$3,'CLINIC_ADMIN')`, [I.employee, I.admin, I.location]);
  await db.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES($1,$2,'PAT','Приём',30)`, [I.service, I.location]);
  await db.query(`
    INSERT INTO pet_schema.pets(id,owner_id,name,species,breed,birth_date,sex) VALUES
      ($1,$4,'Барсик','CAT','Сибирская','2020-02-29','MALE'),
      ($2,$4,'Белка','DOG',NULL,NULL,NULL),
      ($3,$4,'Будущий','DOG',NULL,NULL,'UNKNOWN')
  `, [I.pet1, I.pet2, I.pet3, I.owner]);
  await appointment(db, I.pet1, 1, -120, 'COMPLETED');
  await appointment(db, I.pet1, 2, 120, 'CONFIRMED');
  await appointment(db, I.pet2, 3, -60, 'NO_SHOW');
  await addAssociation(db, I.pet1, 1);
  await addAssociation(db, I.pet2, 2);
}

async function appointment(db: DatabaseService, petId: string, n: number, minutes: number, status: string) {
  const suffix = String(n).padStart(12, '0');
  const slot = `a6000000-0000-4000-8000-${suffix}`;
  const hold = `a7000000-0000-4000-8000-${suffix}`;
  const id = `a8000000-0000-4000-8000-${suffix}`;
  await db.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode) VALUES($1,$2,$3,clock_timestamp()+$4*interval '1 minute',clock_timestamp()+($4+30)*interval '1 minute',1,'BOOKED','LEVEL_C')`, [slot, I.location, I.service, minutes]);
  await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')`, [hold, slot, I.owner, petId]);
  await db.query(`INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+$8*interval '1 minute')`, [id, hold, I.owner, petId, I.location, slot, status, n]);
}

async function addAssociation(db: DatabaseService, petId: string, n: number) {
  if (petId === I.pet3) await appointment(db, petId, 9, 180, 'CONFIRMED');
  const suffix = String(n).padStart(12, '0');
  const consent = `a9000000-0000-4000-8000-${suffix}`;
  const association = `aa000000-0000-4000-8000-${suffix}`;
  const sourceNumber = petId === I.pet1 ? 1 : petId === I.pet2 ? 3 : 9;
  const source = `a8000000-0000-4000-8000-${String(sourceNumber).padStart(12, '0')}`;
  await db.query(`INSERT INTO clinic_schema.clinic_patient_consents(id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at) VALUES($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days')`, [consent, I.clinic, I.location, petId, I.owner]);
  await db.query(`
    INSERT INTO clinic_schema.clinic_patient_associations(id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at)
    VALUES($1,$2,$3,$4,'ACTIVE','APPOINTMENT',$5,$6,'registry-test-v1',clock_timestamp()+interval '30 days',clock_timestamp()-interval '2 days',clock_timestamp()+$7 * interval '1 minute')
  `, [association, I.clinic, I.location, petId, source, consent, n]);
  await db.query(`
    INSERT INTO clinic_schema.clinic_patient_association_revisions(association_id,association_version,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at)
    SELECT id,version,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at
    FROM clinic_schema.clinic_patient_associations WHERE id=$1
  `, [association]);
}

async function effects(db: DatabaseService) {
  const result = await db.query(`
    SELECT (SELECT SUM(version) FROM clinic_schema.clinic_patient_associations)::text associations,
      (SELECT COUNT(*) FROM clinic_schema.clinic_patient_association_revisions)::text revisions,
      (SELECT COUNT(*) FROM clinic_schema.clinic_patient_association_event_receipts)::text receipts,
      (SELECT COUNT(*) FROM booking_schema.outbox_events)::text outbox
  `);
  return result.rows[0];
}

async function addProductionLikeNoise(db: DatabaseService) {
  await db.query(`
    INSERT INTO pet_schema.pets(id,owner_id,name,species)
    SELECT ('b5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      $1::uuid,'Бета ' || n,CASE WHEN n % 2=0 THEN 'DOG' ELSE 'CAT' END
    FROM generate_series(1,120) n
  `, [I.owner]);

  await db.query(`
    INSERT INTO clinic_schema.appointment_slots
      (id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode)
    SELECT ('b6000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      $1::uuid,$2::uuid,clock_timestamp()+n*interval '1 minute',
      clock_timestamp()+(n+30)*interval '1 minute',1,'BOOKED','LEVEL_C'
    FROM generate_series(1,120) n
  `, [I.location, I.service]);

  await db.query(`
    INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at)
    SELECT ('b7000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      ('b6000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$1::uuid,
      ('b5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'CONFIRMED',clock_timestamp()+interval '1 day'
    FROM generate_series(1,120) n
  `, [I.owner]);

  await db.query(`
    INSERT INTO booking_schema.appointments
      (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,created_at)
    SELECT ('b8000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      ('b7000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$1::uuid,
      ('b5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$2::uuid,
      ('b6000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'CONFIRMED',clock_timestamp()-n*interval '1 minute'
    FROM generate_series(1,120) n
  `, [I.owner, I.location]);

  await db.query(`
    INSERT INTO clinic_schema.clinic_patient_consents
      (id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at)
    SELECT ('b9000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$3::uuid,$2::uuid,
      ('b5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$1::uuid,
      'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',
      clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days'
    FROM generate_series(1,120) n
  `, [I.owner, I.location, I.clinic]);

  await db.query(`
    INSERT INTO clinic_schema.clinic_patient_associations
      (id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,
       visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at)
    SELECT ('ba000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$2::uuid,$1::uuid,
      ('b5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'ACTIVE','APPOINTMENT',
      ('b8000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      ('b9000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'registry-test-v1',clock_timestamp()+interval '30 days',
      clock_timestamp()-interval '2 days',clock_timestamp()-n*interval '1 second'
    FROM generate_series(1,120) n
  `, [I.location, I.clinic]);

  await db.query(`
    INSERT INTO clinic_schema.clinic_patient_association_revisions
      (association_id,association_version,clinic_id,clinic_location_id,pet_id,status,source_type,
       source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at)
    SELECT id,version,clinic_id,clinic_location_id,pet_id,status,source_type,
      source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at
    FROM clinic_schema.clinic_patient_associations
    WHERE id::text LIKE 'ba000000-0000-4000-8000-%'
  `);
}
