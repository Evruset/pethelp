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
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import {
  ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE,
  ClinicPatientsRegistryReferenceRateLimitConfig,
  loadClinicPatientsRegistryReferenceRateLimitConfig,
} from '../src/booking-core/clinic-patients-registry-rate-limit.config';
import { ClinicPatientsRegistryService } from '../src/booking-core/clinic-patients-registry.service';
import { PostgresRateLimitService } from '../src/platform/rate-limit/postgres-rate-limit.service';
import { RateLimitDatabaseService } from '../src/platform/rate-limit/rate-limit-database.service';
import { SharedRateLimitTelemetry } from '../src/platform/rate-limit/rate-limit.telemetry';

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
  let registry: ClinicPatientsRegistryService;
  let sharedLimiter: PostgresRateLimitService;
  let secondLimiterDatabase: RateLimitDatabaseService;
  let secondRegistry: ClinicPatientsRegistryService;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'registry-test-v1';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
    process.env.VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT = '2';
    process.env.VETHELP_CLINIC_PATIENTS_SEARCH_WINDOW_SECONDS = '1';
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH = 'true';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    db = app.get(DatabaseService);
    jwt = app.get(JwtService);
    registry = app.get(ClinicPatientsRegistryService);
    sharedLimiter = app.get(PostgresRateLimitService);
    secondLimiterDatabase = new RateLimitDatabaseService();
    secondRegistry = new ClinicPatientsRegistryService(
      db,
      app.get(ClinicEmployeeAccessService),
      new PostgresRateLimitService(secondLimiterDatabase, new SharedRateLimitTelemetry()),
    );
  });

  beforeEach(async () => {
    process.env.VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT = '2';
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH = 'true';
    (registry as unknown as { searchBuckets: Map<string, unknown> }).searchBuckets.clear();
    setReferencePolicy(registry, { shortLimit: 100, sustainedLimit: 1_000 });
    setReferencePolicy(secondRegistry, { shortLimit: 100, sustainedLimit: 1_000 });
    await clearReferenceRateLimits(db);
    await seed(db);
  });
  afterAll(async () => {
    await clearReferenceRateLimits(db);
    await secondLimiterDatabase?.onModuleDestroy();
    await app?.close();
    delete process.env.VETHELP_CLINIC_PATIENTS_REGISTRY;
    delete process.env.VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT;
    delete process.env.VETHELP_CLINIC_PATIENTS_SEARCH_WINDOW_SECONDS;
    delete process.env.VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH;
  });

  const allowed = (role = Role.CLINIC_RECEPTIONIST): Actor => ({
    sub: role === Role.CLINIC_ADMIN ? I.admin : I.employee,
    roles: [role], clinicIds: [I.clinic], locationIds: [I.location],
  });
  const token = (actor: Actor) => jwt.signAsync(actor, {
    secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256',
  });
  const list = async (actor: Actor | null, options: {
    q?: string; limit?: number; cursor?: string; location?: string; administrativeReference?: string;
    extra?: Record<string, string>;
  } = {}) => {
    const query = new URLSearchParams();
    if (options.q !== undefined) query.set('q', options.q);
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    if (options.cursor !== undefined) query.set('cursor', options.cursor);
    if (options.administrativeReference !== undefined) query.set('administrativeReference', options.administrativeReference);
    for (const [key, value] of Object.entries(options.extra ?? {})) query.set(key, value);
    const call = request(app.getHttpServer()).get(`/v1/clinic/${I.clinic}/locations/${options.location ?? I.location}/patients?${query}`);
    return actor ? call.set('Authorization', `Bearer ${await token(actor)}`) : call;
  };

  it('is default-off and enabled only by the backend rollout flag', async () => {
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'false';
    expect((await list(allowed())).status).toBe(404);
    process.env.VETHELP_CLINIC_PATIENTS_REGISTRY = 'true';
    expect((await list(allowed())).status).toBe(200);
  });

  it('N-B-01..N-B-07 loads bounded typed defaults and rejects invalid shared policies', () => {
    expect(loadClinicPatientsRegistryReferenceRateLimitConfig({})).toMatchObject({
      shortWindowSeconds: 60,
      shortLimit: 20,
      sustainedWindowSeconds: 3_600,
      sustainedLimit: 200,
    });
    for (const env of [
      { VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SHORT_LIMIT: '0' },
      { VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SHORT_WINDOW_SECONDS: '60', VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SUSTAINED_WINDOW_SECONDS: '60' },
      { VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SHORT_LIMIT: '21', VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SUSTAINED_LIMIT: '20' },
      { VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SUSTAINED_WINDOW_SECONDS: '999999999' },
    ]) {
      expect(() => loadClinicPatientsRegistryReferenceRateLimitConfig(env)).toThrow();
    }
  });

  it('returns only the administrative allowlist from active association and consent state', async () => {
    const response = await list(allowed(Role.CLINIC_ADMIN));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ clinicId: I.clinic, locationId: I.location, nextCursor: null });
    expect(response.body.items.map((item: { patientId: string }) => item.patientId)).toEqual([I.pet2, I.pet1]);
    expect(response.body.items[1]).toEqual({
      patientId: I.pet1,
      administrativeReference: 'Straße-1',
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

  it('K-01/K-02/K-11..K-13/K-17..K-19/K-28 exact-normalizes into the canonical 0/1 envelope', async () => {
    process.env.VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT = '20';
    for (const administrativeReference of ['STRASSE-1', 'Straße-1', '  Straße-1  ']) {
      const response = await list(allowed(), { administrativeReference });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        clinicId: I.clinic, locationId: I.location, nextCursor: null,
        items: [{ patientId: I.pet1, administrativeReference: 'Straße-1' }],
      });
      expect(response.body.items).toHaveLength(1);
      expect(JSON.stringify(response.body)).not.toContain('administrativeReferenceKey');
    }
    const missing = await list(allowed(), { administrativeReference: 'UNKNOWN-1' });
    expect(missing.status).toBe(200);
    expect(missing.body.items).toEqual([]);
    expect(missing.body.nextCursor).toBeNull();
    for (const administrativeReference of ['Pe\u0301T 004', 'PéT   004']) {
      const response = await list(allowed(), { administrativeReference });
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([
        expect.objectContaining({ patientId: I.pet2, administrativeReference: 'PéT  004' }),
      ]);
    }
  });

  it('K-10/K-14..K-16 rejects malformed exact queries after authority but before limiter/reference lookup', async () => {
    for (const administrativeReference of ['', 'PET*', 'line\nbreak', 'x'.repeat(41)]) {
      const limiter = jest.spyOn(sharedLimiter, 'consume');
      const query = jest.spyOn(
        registry as unknown as { query: (...args: unknown[]) => Promise<unknown> },
        'query',
      );
      const response = await list(allowed(), { administrativeReference });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_ADMINISTRATIVE_REFERENCE_QUERY');
      expect(limiter).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      limiter.mockRestore();
      query.mockRestore();
    }
    expect((await list(allowed(), { administrativeReference: 'PET-1', q: 'ба' })).body.code)
      .toBe('INVALID_SEARCH_COMBINATION');
    expect((await list(allowed(), { administrativeReference: 'PET-1', cursor: 'opaque' })).body.code)
      .toBe('INVALID_SEARCH_COMBINATION');
    expect((await list(allowed(), { administrativeReference: 'PET-1', extra: { status: 'ACTIVE' } })).status).toBe(400);
  });

  it('K-03/K-04/K-31 never finds identical references stored outside the exact location scope', async () => {
    await addScopedReference(db, I.clinic, I.otherLocation, false, 7);
    await addScopedReference(db, 'a2000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000003', true, 8);
    const response = await list(allowed(), { administrativeReference: 'SCOPE-ONLY' });
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('K-05..K-09 preserves authority-first no-leak behavior for reference matches', async () => {
    process.env.VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT = '20';
    expect((await list(null, { administrativeReference: 'Straße-1' })).status).toBe(401);
    expect((await list({ sub: I.vet, roles: [Role.CLINIC_VETERINARIAN] }, { administrativeReference: 'Straße-1' })).status).toBe(403);
    await expect(registry.list({
      clinicId: I.clinic, locationId: I.location,
      employee: {
        sub: I.vet, roles: [Role.CLINIC_VETERINARIAN],
        clinicIds: [I.clinic], locationIds: [I.location],
      },
      limit: 50, administrativeReference: 'Straße-1',
    })).rejects.toMatchObject({ status: 403 });
    expect((await list(allowed(), {
      location: I.otherLocation,
      administrativeReference: 'Straße-1',
    })).status).toBe(403);
    await expect(registry.list({
      clinicId: 'a2000000-0000-4000-8000-000000000099',
      locationId: 'a3000000-0000-4000-8000-000000000099',
      employee: allowed(),
      limit: 50,
      administrativeReference: 'Straße-1',
    })).rejects.toMatchObject({ status: 403 });
    await db.query(`UPDATE clinic_schema.employee_location_memberships
      SET active=false,revoked_at=clock_timestamp()
      WHERE employee_id=$1 AND clinic_location_id=$2`, [I.employee, I.location]);
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).status).toBe(403);
    expect(await referenceRateLimitRowCount(db)).toBe(0);
    await seed(db);
    await db.query(`UPDATE clinic_schema.clinic_patient_associations
      SET status='REVOKED',revoked_at=clock_timestamp(),revoke_reason='WITHDRAWN' WHERE pet_id=$1`, [I.pet1]);
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).body.items).toEqual([]);
    await seed(db);
    await db.query(`UPDATE clinic_schema.clinic_patient_consents
      SET expires_at=clock_timestamp()-interval '1 second' WHERE pet_id=$1`, [I.pet1]);
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).body.items).toEqual([]);
    await seed(db);
    await db.query(`UPDATE clinic_schema.clinic_patient_associations
      SET status='ARCHIVED',archived_at=clock_timestamp(),archive_reason='STALE'
      WHERE pet_id=$1`, [I.pet1]);
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).body.items).toEqual([]);
  });

  it('K-20 fails closed if repository cardinality is corrupt', async () => {
    const row = {
      patient_id: I.pet1, display_name: 'Барсик', species: 'CAT', breed: null, sex: null,
      birth_date: null, administrative_reference: 'Straße-1',
      first_seen_at: new Date(), last_seen_at: new Date(), last_visit_at: null, next_appointment_at: null,
    };
    const telemetry = jest.spyOn(
      (registry as unknown as { logger: { error: (message: string) => void } }).logger,
      'error',
    ).mockImplementation();
    const query = jest.spyOn(
      registry as unknown as { query: (...args: unknown[]) => Promise<{ rows: unknown[] }> },
      'query',
    ).mockResolvedValue({ rows: [row, row] });
    const response = await list(allowed(), { administrativeReference: 'Straße-1' });
    query.mockRestore();
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'SEARCH_INVARIANT_VIOLATION' });
    expect(JSON.stringify(response.body)).not.toContain(I.pet1);
    expect(telemetry).toHaveBeenCalledWith(expect.stringContaining('result_count=2'));
    expect(telemetry.mock.calls.flat().join(' ')).not.toContain('Straße-1');
    expect(telemetry.mock.calls.flat().join(' ')).not.toContain(I.pet1);
    telemetry.mockRestore();
  });

  it('K-21..K-23 search flag rolls back independently', async () => {
    const limiter = jest.spyOn(sharedLimiter, 'consume');
    const query = jest.spyOn(
      registry as unknown as { query: (...args: unknown[]) => Promise<unknown> },
      'query',
    );
    process.env.VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH = 'false';
    const blocked = await list(allowed(), { administrativeReference: 'Straße-1' });
    expect(blocked.status).toBe(404);
    expect(blocked.body.code).toBe('ADMINISTRATIVE_REFERENCE_SEARCH_UNAVAILABLE');
    expect(limiter).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    const ordinary = await list(allowed());
    expect(ordinary.status).toBe(200);
    expect(ordinary.body.items).toHaveLength(2);
    limiter.mockRestore();
    query.mockRestore();
  });

  it('N-B-08..N-B-10/N-B-20/N-B-22 uses shared PostgreSQL once before exact lookup and never invokes legacy limiting', async () => {
    setReferencePolicy(registry, { shortLimit: 2, sustainedLimit: 100 });
    const shared = jest.spyOn(sharedLimiter, 'consume');
    const legacy = jest.spyOn(
      registry as unknown as { consumeSearch: (...args: unknown[]) => void },
      'consumeSearch',
    );
    const query = jest.spyOn(
      registry as unknown as { query: (...args: unknown[]) => Promise<unknown> },
      'query',
    );
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).status).toBe(200);
    expect((await list(allowed(), { administrativeReference: 'UNKNOWN-1' })).status).toBe(200);
    const denied = await list(allowed(), { administrativeReference: 'Straße-1' });
    expect(denied.status).toBe(429);
    expect(denied.body).toEqual({
      statusCode: 429,
      code: 'PATIENTS_REGISTRY_SEARCH_RATE_LIMITED',
      message: 'Search rate limit exceeded',
    });
    expect(Number(denied.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(shared).toHaveBeenCalledTimes(3);
    expect(legacy).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(2);
    expect(await referenceRateLimitState(db, I.employee, I.location)).toEqual([
      { window_seconds: 60, hit_count: 3 },
      { window_seconds: 3600, hit_count: 3 },
    ]);
    shared.mockRestore();
    legacy.mockRestore();
    query.mockRestore();
  });

  it('N-B-11 returns the sustained next-admissible database boundary', async () => {
    setReferencePolicy(registry, { shortLimit: 100, sustainedLimit: 2 });
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).status).toBe(200);
    expect((await list(allowed(), { administrativeReference: 'UNKNOWN-1' })).status).toBe(200);
    const denied = await list(allowed(), { administrativeReference: 'Straße-1' });
    expect(denied.status).toBe(429);
    expect(Number(denied.headers['retry-after'])).toBeGreaterThan(60);
  });

  it('N-B-12 admits a new database window without physical pre-delete', async () => {
    setReferencePolicy(registry, {
      shortWindowSeconds: 1,
      shortLimit: 1,
      sustainedWindowSeconds: 2,
      sustainedLimit: 10,
    });
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).status).toBe(200);
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).status).toBe(200);
    const count = await db.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM public.shared_rate_limit_windows
      WHERE namespace=$1 AND actor_id=$2::uuid AND clinic_id=$3::uuid AND location_id=$4::uuid
    `, [ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE, I.employee, I.clinic, I.location]);
    expect(Number(count.rows[0].count)).toBeGreaterThanOrEqual(3);
  });

  it('N-B-13..N-B-17 isolates actor scope and leaves ordinary Registry outside shared enforcement', async () => {
    setReferencePolicy(registry, { shortLimit: 1, sustainedLimit: 10 });
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).status).toBe(200);
    expect((await list(allowed(), { administrativeReference: 'Straße-1' })).status).toBe(429);
    expect((await list(allowed(Role.CLINIC_ADMIN), { administrativeReference: 'Straße-1' })).status).toBe(200);
    await addScopedReference(db, I.clinic, I.otherLocation, false, 17);
    await db.query(`
      INSERT INTO clinic_schema.employee_location_memberships(
        employee_id,clinic_location_id,role
      ) VALUES($1,$2,'CLINIC_RECEPTIONIST')
    `, [I.employee, I.otherLocation]);
    const crossLocationActor: Actor = {
      ...allowed(),
      locationIds: [I.location, I.otherLocation],
    };
    expect((await list(crossLocationActor, {
      location: I.otherLocation,
      administrativeReference: 'SCOPE-ONLY',
    })).status).toBe(200);
    expect((await list(allowed(), { q: 'ба' })).status).toBe(200);
    const state = await db.query<{ actor_id: string; location_id: string }>(`
      SELECT DISTINCT actor_id::text,location_id::text
      FROM public.shared_rate_limit_windows
      WHERE namespace=$1 AND clinic_id=$2::uuid
      ORDER BY actor_id,location_id
    `, [ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE, I.clinic]);
    expect(state.rows).toEqual([
      { actor_id: I.employee, location_id: I.location },
      { actor_id: I.employee, location_id: I.otherLocation },
      { actor_id: I.admin, location_id: I.location },
    ]);
  });

  it('N-B-18/N-B-19 shares one threshold across two Registry service instances with zero over-admission', async () => {
    setReferencePolicy(registry, { shortLimit: 5, sustainedLimit: 100 });
    setReferencePolicy(secondRegistry, { shortLimit: 5, sustainedLimit: 100 });
    const calls = Array.from({ length: 20 }, (_, index) =>
      (index % 2 === 0 ? registry : secondRegistry).list({
        clinicId: I.clinic,
        locationId: I.location,
        employee: allowed(),
        limit: 50,
        administrativeReference: 'Straße-1',
      }));
    const results = await Promise.allSettled(calls);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(5);
    expect(results.filter((result) =>
      result.status === 'rejected'
      && (result.reason as { status?: number }).status === 429)).toHaveLength(15);
    expect(await referenceRateLimitState(db, I.employee, I.location)).toEqual([
      { window_seconds: 60, hit_count: 20 },
      { window_seconds: 3600, hit_count: 20 },
    ]);
  });

  it('N-B-21/N-B-23/N-B-24 fails closed without lookup, fallback, domain effects or raw-reference persistence', async () => {
    const before = await effects(db);
    const shared = jest.spyOn(sharedLimiter, 'consume')
      .mockRejectedValueOnce(new Error('private database detail'));
    const query = jest.spyOn(
      registry as unknown as { query: (...args: unknown[]) => Promise<unknown> },
      'query',
    );
    const response = await list(allowed(), { administrativeReference: 'SECRET-REFERENCE-1' });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      statusCode: 503,
      code: 'PATIENTS_REGISTRY_POLICY_UNAVAILABLE',
      message: 'Patients registry policy unavailable',
    });
    expect(query).not.toHaveBeenCalled();
    expect((registry as unknown as { searchBuckets: Map<string, unknown> }).searchBuckets.size).toBe(0);
    expect(JSON.stringify(response.body)).not.toContain('SECRET-REFERENCE-1');
    expect(await effects(db)).toEqual(before);
    const persistent = await db.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM public.shared_rate_limit_windows
      WHERE row_to_json(shared_rate_limit_windows)::text LIKE '%SECRET-REFERENCE-1%'
    `);
    expect(persistent.rows[0].count).toBe('0');
    shared.mockRestore();
    query.mockRestore();
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
          AND EXISTS (
            SELECT 1 FROM clinic_schema.clinic_patient_local_profiles lp_filter
            WHERE lp_filter.clinic_id=$1::uuid
              AND lp_filter.clinic_location_id=$2::uuid
              AND lp_filter.patient_id=r.pet_id
              AND lp_filter.administrative_reference_key=$7::text
          )
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
    `, [I.clinic, I.location, 2, new Date(), 'registry-test-v1', 'б', 'noise-99']);
    const text = plan.rows.map((row) => row['QUERY PLAN']).join('\n');
    expect(text).toMatch(/Limit/);
    expect(text).toContain('clinic_patient_local_profiles_reference_location_key');
    expect(text).not.toMatch(/Seq Scan on clinic_patient_local_profiles/);
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
  await db.query(`INSERT INTO clinic_schema.clinic_patient_local_profiles
    (clinic_id,clinic_location_id,patient_id,administrative_reference,administrative_reference_key)
    VALUES
      ($1,$2,$3,'Straße-1','strasse-1'),
      ($1,$2,$4,'PéT  004','pét 004')`, [I.clinic, I.location, I.pet1, I.pet2]);
}

async function addScopedReference(db: DatabaseService, clinicId: string, locationId: string, createClinic: boolean, n: number) {
  const suffix = String(n).padStart(12, '0');
  const service = `c4000000-0000-4000-8000-${suffix}`;
  const slot = `c6000000-0000-4000-8000-${suffix}`;
  const hold = `c7000000-0000-4000-8000-${suffix}`;
  const appointmentId = `c8000000-0000-4000-8000-${suffix}`;
  const consent = `c9000000-0000-4000-8000-${suffix}`;
  const association = `ca000000-0000-4000-8000-${suffix}`;
  if (createClinic) {
    await db.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES($1,'Scope LLC','Scope')`, [clinicId]);
    await db.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES($1,$2,'Scope')`, [locationId, clinicId]);
  }
  await db.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes)
    VALUES($1,$2,$3,'Scope',30)`, [service, locationId, `SCOPE-${n}`]);
  await db.query(`INSERT INTO clinic_schema.appointment_slots
    (id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode)
    VALUES($1,$2,$3,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '90 minutes',1,'BOOKED','LEVEL_C')`,
  [slot, locationId, service]);
  await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at)
    VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')`, [hold, slot, I.owner, I.pet3]);
  await db.query(`INSERT INTO booking_schema.appointments
    (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,created_at)
    VALUES($1,$2,$3,$4,$5,$6,'COMPLETED',clock_timestamp()-interval '1 day')`,
  [appointmentId, hold, I.owner, I.pet3, locationId, slot]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_consents
    (id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at)
    VALUES($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',
      clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days')`,
  [consent, clinicId, locationId, I.pet3, I.owner]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_associations
    (id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,
     visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at)
    VALUES($1,$2,$3,$4,'ACTIVE','APPOINTMENT',$5,$6,'registry-test-v1',
      clock_timestamp()+interval '30 days',clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 hour')`,
  [association, clinicId, locationId, I.pet3, appointmentId, consent]);
  await db.query(`INSERT INTO clinic_schema.clinic_patient_local_profiles
    (clinic_id,clinic_location_id,patient_id,administrative_reference,administrative_reference_key)
    VALUES($1,$2,$3,'SCOPE-ONLY','scope-only')`, [clinicId, locationId, I.pet3]);
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

function setReferencePolicy(
  service: ClinicPatientsRegistryService,
  override: Partial<ClinicPatientsRegistryReferenceRateLimitConfig>,
) {
  const target = service as unknown as {
    referenceRateLimitConfig: ClinicPatientsRegistryReferenceRateLimitConfig;
  };
  target.referenceRateLimitConfig = Object.freeze({
    ...target.referenceRateLimitConfig,
    ...override,
  });
}

async function clearReferenceRateLimits(db: DatabaseService) {
  await db.query(`
    DELETE FROM public.shared_rate_limit_windows
    WHERE namespace=$1
      AND actor_id=ANY($2::uuid[])
  `, [ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE, [I.employee, I.admin, I.vet]]);
}

async function referenceRateLimitState(
  db: DatabaseService,
  actorId: string,
  locationId: string,
) {
  const result = await db.query<{ window_seconds: number; hit_count: number }>(`
    SELECT window_seconds,hit_count
    FROM public.shared_rate_limit_windows
    WHERE namespace=$1
      AND actor_id=$2::uuid
      AND clinic_id=$3::uuid
      AND location_id=$4::uuid
    ORDER BY window_seconds
  `, [ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE, actorId, I.clinic, locationId]);
  return result.rows;
}

async function referenceRateLimitRowCount(db: DatabaseService) {
  const result = await db.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM public.shared_rate_limit_windows
    WHERE namespace=$1
      AND actor_id=ANY($2::uuid[])
  `, [ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE, [I.employee, I.admin, I.vet]]);
  return Number(result.rows[0].count);
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
  await db.query(`
    INSERT INTO clinic_schema.clinic_patient_local_profiles
      (clinic_id,clinic_location_id,patient_id,administrative_reference,administrative_reference_key)
    SELECT $1::uuid,$2::uuid,
      ('b5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'NOISE-' || n,'noise-' || n
    FROM generate_series(1,120) n
  `, [I.clinic, I.location]);
}
