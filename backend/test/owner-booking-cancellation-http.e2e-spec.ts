import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { resetBookingPersistence } from './helpers/booking-test-reset';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';
import { BookingSecurityService } from '../src/booking-core/booking-security.service';
import { BookingService } from '../src/booking-core/booking.service';

jest.setTimeout(90_000);

const I = {
  owner: '12000000-0000-4000-8000-000000000001',
  foreign: '12000000-0000-4000-8000-000000000002',
  vet: '12000000-0000-4000-8000-000000000003',
  employee: '12000000-0000-4000-8000-000000000004',
  clinic: '22000000-0000-4000-8000-000000000001',
  location: '32000000-0000-4000-8000-000000000001',
  pet: '42000000-0000-4000-8000-000000000001',
  foreignPet: '42000000-0000-4000-8000-000000000002',
  service: '52000000-0000-4000-8000-000000000001',
  pendingSlot: '62000000-0000-4000-8000-000000000001',
  secondSlot: '62000000-0000-4000-8000-000000000002',
  confirmedSlot: '62000000-0000-4000-8000-000000000003',
  foreignSlot: '62000000-0000-4000-8000-000000000004',
  terminalSlot: '62000000-0000-4000-8000-000000000005',
  alternativeSlot: '62000000-0000-4000-8000-000000000006',
  alternativeTargetSlot: '62000000-0000-4000-8000-000000000007',
  pending: '72000000-0000-4000-8000-000000000001',
  second: '72000000-0000-4000-8000-000000000002',
  confirmed: '72000000-0000-4000-8000-000000000003',
  foreignHold: '72000000-0000-4000-8000-000000000004',
  terminal: '72000000-0000-4000-8000-000000000005',
  alternative: '72000000-0000-4000-8000-000000000006',
  alternativeSwap: '82000000-0000-4000-8000-000000000001',
};

describe('Owner booking cancellation HTTP contract (real PostgreSQL)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;
  let bookingSecurity: BookingSecurityService;
  let booking: BookingService;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
    bookingSecurity = app.get(BookingSecurityService);
    booking = app.get(BookingService);
  });
  beforeEach(async () => seed(database));
  afterAll(async () => app?.close());

  const token = (sub: string, roles: Role[]) => jwt.signAsync({ sub, roles }, {
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    algorithm: 'HS256',
  });

  const cancel = async (holdId: string, options: {
    sub?: string;
    roles?: Role[];
    key?: string;
    version?: number;
    correlationId?: string | string[];
    body?: unknown;
    authenticated?: boolean;
  } = {}) => {
    let command = request(app.getHttpServer())
      .post(`/v1/owner/bookings/${holdId}/cancel`)
      .set('Idempotency-Key', options.key ?? randomUUID())
      .set('If-Match', String(options.version ?? 1));
    if (options.correlationId !== '') command = command.set('X-Correlation-ID', (options.correlationId ?? randomUUID()) as string);
    if (options.authenticated !== false) command = command.set('Authorization', `Bearer ${await token(options.sub ?? I.owner, options.roles ?? [Role.OWNER])}`);
    if (options.body !== undefined) command = command.send(options.body as string | object);
    return command;
  };

  it('enforces Owner authority, required headers and a closed safe payload without effects', async () => {
    await cancel(I.pending, { authenticated: false }).then((response) => expect(response.status).toBe(401));
    await cancel(I.pending, { sub: I.vet, roles: [Role.CLINIC_VETERINARIAN] }).then((response) => expect(response.status).toBe(403));
    await cancel(I.pending, { body: { reasonCode: 'OTHER', injected: true } }).then((response) => expect(response.status).toBe(400));
    await cancel(I.pending, { body: { reasonCode: 'free text' } }).then((response) => expect(response.status).toBe(400));

    const reusedKey = randomUUID();
    await cancel(I.pending, { key: reusedKey, version: 99 }).then((response) => expect(response.status).toBe(409));
    const foreign = await cancel(I.foreignHold, { key: reusedKey });
    const absent = await cancel(randomUUID(), { key: reusedKey });
    expect(foreign.status).toBe(404);
    expect(absent.status).toBe(404);
    expect(foreign.body).toEqual(absent.body);
    expect(await effects(database, I.pending, I.pendingSlot)).toEqual({ state: 'MANUAL_CONFIRM_PENDING', held: 1, booked: 0, audits: '0', outbox: '0' });
  });

  it('requires correlation presence and sanitizes malformed or duplicated supplied values', async () => {
    const missing = await cancel(I.pending, { correlationId: '' });
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ code: 'INVALID_REQUEST' });
    const supplied = [
      { header: 'not-a-uuid', rejected: ['not-a-uuid'] },
      { header: [randomUUID(), randomUUID()], rejected: [] },
    ];
    for (const item of supplied) {
      await seed(database);
      const response = await cancel(I.pending, { correlationId: item.header });
      expect(response.status).toBe(200);
      expect(response.body.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(item.rejected).not.toContain(response.body.correlationId);
      if (Array.isArray(item.header)) expect(item.header).not.toContain(response.body.correlationId);
    }
  });

  it('cancels pending capacity once with complete authoritative response and owner-scoped replay', async () => {
    const ownerToken = await token(I.owner, [Role.OWNER]);
    await request(app.getHttpServer()).get(`/v1/booking-holds/${I.pending}`).set('Authorization', `Bearer ${ownerToken}`)
      .expect(200).expect(({ body }) => expect(body.canCancel).toBe(true));

    const key = randomUUID();
    const correlationId = randomUUID();
    const first = await cancel(I.pending, { key, correlationId, body: { reasonCode: 'OWNER_PLANS_CHANGED' } });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      holdId: I.pending,
      slotId: I.pendingSlot,
      status: 'CANCELLED',
      correlationId,
      aggregateVersion: 2,
      lastUpdatedAt: expect.any(String),
      serverNow: expect.any(String),
    });
    const replay = await cancel(I.pending, { key, correlationId: randomUUID(), body: { reasonCode: 'OWNER_PLANS_CHANGED' } });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    const changed = await cancel(I.pending, { key, version: 2, body: { reasonCode: 'OTHER' } });
    expect(changed.status).toBe(409);
    expect(changed.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const crossHold = await cancel(I.second, { key });
    expect(crossHold.status).toBe(409);
    expect(crossHold.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await effects(database, I.pending, I.pendingSlot)).toEqual({ state: 'RELEASED', held: 0, booked: 0, audits: '1', outbox: '1' });
    await request(app.getHttpServer()).get(`/v1/booking-holds/${I.pending}`).set('Authorization', `Bearer ${ownerToken}`)
      .expect(200).expect(({ body }) => expect(body).toMatchObject({ status: 'CANCELLED', canCancel: false }));
  });

  it('durably replays stale and terminal BOOKING_STATE_CONFLICT without mutation', async () => {
    for (const [holdId, version] of [[I.pending, 99], [I.terminal, 1]] as const) {
      const key = randomUUID();
      const first = await cancel(holdId, { key, version });
      const replay = await cancel(holdId, { key, version, correlationId: randomUUID() });
      expect(first.status).toBe(409);
      expect(first.body).toMatchObject({ code: 'BOOKING_STATE_CONFLICT' });
      expect(replay.body).toEqual(first.body);
    }
    await database.query(`UPDATE booking_schema.booking_holds SET version=2 WHERE id=$1`, [I.confirmed]);
    const postConfirmKey = randomUUID();
    const staleAfterConfirm = await cancel(I.confirmed, { key: postConfirmKey, version: 1 });
    const staleAfterConfirmReplay = await cancel(I.confirmed, { key: postConfirmKey, version: 1, correlationId: randomUUID() });
    expect(staleAfterConfirm.status).toBe(409);
    expect(staleAfterConfirm.body).toMatchObject({ code: 'BOOKING_STATE_CONFLICT' });
    expect(staleAfterConfirmReplay.body).toEqual(staleAfterConfirm.body);
    expect(await effects(database, I.confirmed, I.confirmedSlot)).toEqual({ state: 'CONFIRMED', held: 0, booked: 1, audits: '0', outbox: '0' });
    const ledger = await database.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM booking_schema.idempotency_records
      WHERE scope=$1 AND status='COMPLETED' AND response_status=409
    `, [`booking.owner-cancel:${I.owner}`]);
    expect(ledger.rows[0].count).toBe('3');
    expect(await effects(database, I.pending, I.pendingSlot)).toEqual({ state: 'MANUAL_CONFIRM_PENDING', held: 1, booked: 0, audits: '0', outbox: '0' });

  });

  it('cancels an active ALTERNATIVE_PENDING projection and releases both held slots exactly once', async () => {
    const ownerToken = await token(I.owner, [Role.OWNER]);
    await request(app.getHttpServer()).get(`/v1/booking-holds/${I.alternative}`).set('Authorization', `Bearer ${ownerToken}`)
      .expect(200).expect(({ body }) => {
        expect(body).toMatchObject({ status: 'PENDING_CONFIRMATION', canCancel: true });
        expect(body).not.toHaveProperty('alternativeSlotId');
      });
    const response = await cancel(I.alternative);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'CANCELLED', holdId: I.alternative, slotId: I.alternativeSlot });
    const rows = await database.query<{ held_count: number }>(`
      SELECT held_count FROM clinic_schema.appointment_slots
      WHERE id = ANY($1::uuid[]) ORDER BY id
    `, [[I.alternativeSlot, I.alternativeTargetSlot]]);
    expect(rows.rows.map((row) => row.held_count)).toEqual([0, 0]);
    const swap = await database.query<{ state: string; aggregate_version: number }>(`
      SELECT state, aggregate_version FROM booking_schema.alternative_swap_groups WHERE id=$1
    `, [I.alternativeSwap]);
    expect(swap.rows[0]).toEqual({ state: 'DECLINED', aggregate_version: 2 });
    expect(await effects(database, I.alternative, I.alternativeSlot)).toEqual({ state: 'RELEASED', held: 0, booked: 0, audits: '1', outbox: '1' });
  });

  it('canonicalizes a worker-lagged expired pending hold before returning durable conflict', async () => {
    await database.query(`UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1`, [I.pending]);
    const key = randomUUID();
    const first = await cancel(I.pending, { key });
    const replay = await cancel(I.pending, { key, correlationId: randomUUID() });
    expect(first.status).toBe(409);
    expect(first.body).toMatchObject({ code: 'BOOKING_STATE_CONFLICT' });
    expect(replay.body).toEqual(first.body);
    expect(await effects(database, I.pending, I.pendingSlot)).toEqual({ state: 'EXPIRED', held: 0, booked: 0, audits: '1', outbox: '1' });
    const ownerToken = await token(I.owner, [Role.OWNER]);
    await request(app.getHttpServer()).get(`/v1/booking-holds/${I.pending}`).set('Authorization', `Bearer ${ownerToken}`)
      .expect(200).expect(({ body }) => expect(body).toMatchObject({ status: 'EXPIRED', canCancel: false }));
  });

  it('keeps REJECTED and CLINIC_CANCELLED terminal projections non-cancellable', async () => {
    await database.query(`UPDATE booking_schema.booking_holds SET state='RELEASED', updated_at=clock_timestamp() WHERE id=$1`, [I.terminal]);
    await database.query(`
      INSERT INTO audit_schema.audit_log(actor_type,action,aggregate_type,aggregate_id,correlation_id,payload_json)
      VALUES ('CLINIC_EMPLOYEE','booking.declined','booking_hold',$1,$2,'{}'::jsonb)
    `, [I.terminal, randomUUID()]);
    const ownerToken = await token(I.owner, [Role.OWNER]);
    await request(app.getHttpServer()).get(`/v1/booking-holds/${I.terminal}`).set('Authorization', `Bearer ${ownerToken}`)
      .expect(200).expect(({ body }) => expect(body).toMatchObject({ status: 'REJECTED', canCancel: false }));
    const rejected = await cancel(I.terminal);
    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({ code: 'BOOKING_STATE_CONFLICT' });

    await seed(database);
    await database.query(`UPDATE booking_schema.appointments SET status='CLINIC_CANCELLED' WHERE hold_id=$1`, [I.confirmed]);
    const clinicCancelled = await cancel(I.confirmed);
    expect(clinicCancelled.status).toBe(409);
    expect(clinicCancelled.body).toMatchObject({ code: 'BOOKING_STATE_CONFLICT' });
    const unchanged = await database.query<{ status: string }>(`SELECT status FROM booking_schema.appointments WHERE hold_id=$1`, [I.confirmed]);
    expect(unchanged.rows[0].status).toBe('CLINIC_CANCELLED');
  });

  it('cancels only an active confirmed appointment and never overwrites completed, no-show or cancelled rows', async () => {
    const first = await cancel(I.confirmed, { body: { reasonCode: 'PET_RECOVERED' } });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      holdId: I.confirmed,
      slotId: I.confirmedSlot,
      status: 'CANCELLED',
      appointmentId: expect.any(String),
      aggregateVersion: 2,
      lastUpdatedAt: expect.any(String),
      serverNow: expect.any(String),
    });
    expect(await effects(database, I.confirmed, I.confirmedSlot)).toEqual({ state: 'RELEASED', held: 0, booked: 0, audits: '1', outbox: '1' });
    const eventCount = await database.query<{ count: string }>(`SELECT count(*)::text AS count FROM booking_schema.appointment_events WHERE hold_id=$1 AND event_type='CANCELLED'`, [I.confirmed]);
    expect(eventCount.rows[0].count).toBe('1');

    for (const status of ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'CLINIC_CANCELLED']) {
      await seed(database);
      await database.query(`UPDATE booking_schema.appointments SET status=$2 WHERE hold_id=$1`, [I.confirmed, status]);
      const response = await cancel(I.confirmed);
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'BOOKING_STATE_CONFLICT' });
      const unchanged = await database.query<{ status: string }>(`SELECT status FROM booking_schema.appointments WHERE hold_id=$1`, [I.confirmed]);
      expect(unchanged.rows[0].status).toBe(status);
      expect(await effects(database, I.confirmed, I.confirmedSlot)).toEqual({ state: 'CONFIRMED', held: 0, booked: 1, audits: '0', outbox: '0' });
    }
  });

  it('serializes canonical Owner cancel against clinic confirm, clinic decline and authoritative expiry', async () => {
    const owner = { sub: I.owner, roles: [Role.OWNER] };
    const employee = {
      sub: I.employee,
      roles: [Role.CLINIC_RECEPTIONIST],
      clinicIds: [I.clinic],
      locationIds: [I.location],
    };
    const ownerCommand = () => bookingSecurity.cancelOwnerBooking({
      holdId: I.pending, owner, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1,
    });

    const confirmRace = await Promise.allSettled([
      ownerCommand(),
      bookingSecurity.confirmManualHold({
        holdId: I.pending, employee, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1,
      }),
    ]);
    expect(confirmRace.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const afterConfirmRace = await effects(database, I.pending, I.pendingSlot);
    expect(['RELEASED', 'CONFIRMED']).toContain(afterConfirmRace.state);
    expect(afterConfirmRace.audits).toBe('1');
    const decisionOutbox = await database.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM booking_schema.outbox_events
      WHERE aggregate_id=$1 AND event_type IN ('booking.hold.released.v1','booking.confirmed.v1')
    `, [I.pending]);
    expect(decisionOutbox.rows[0].count).toBe('1');
    expect({ held: afterConfirmRace.held, booked: afterConfirmRace.booked })
      .toEqual(afterConfirmRace.state === 'CONFIRMED' ? { held: 0, booked: 1 } : { held: 0, booked: 0 });

    await seed(database);
    const declineRace = await Promise.allSettled([
      ownerCommand(),
      bookingSecurity.declineManualHold({
        holdId: I.pending, employee, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1,
        declineReason: 'CAPACITY_UNAVAILABLE',
      }),
    ]);
    expect(declineRace.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await effects(database, I.pending, I.pendingSlot)).toEqual({ state: 'RELEASED', held: 0, booked: 0, audits: '1', outbox: '1' });

    await seed(database);
    await database.query(`UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1`, [I.pending]);
    const expiryRace = await Promise.allSettled([ownerCommand(), booking.expireHolds(1)]);
    expect(expiryRace[0].status).toBe('rejected');
    expect(await effects(database, I.pending, I.pendingSlot)).toEqual({ state: 'EXPIRED', held: 0, booked: 0, audits: '1', outbox: '1' });
  });

  it('serializes concurrent cancellations to one transition, counter, audit and outbox', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, () => cancel(I.pending)));
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status !== 200).every((response) => response.status === 409)).toBe(true);
    expect(await effects(database, I.pending, I.pendingSlot)).toEqual({ state: 'RELEASED', held: 0, booked: 0, audits: '1', outbox: '1' });
  });

  it('enforces the shared Owner/operation rate limit before creating an idempotency row', async () => {
    const replayKey = randomUUID();
    const first = await cancel(I.pending, { key: replayKey });
    expect(first.status).toBe(200);
    await database.query(`
      UPDATE public.shared_rate_limit_windows SET hit_count=60
      WHERE namespace='owner-booking-cancel' AND actor_id=$1 AND window_seconds=60
    `, [I.owner]);
    const replay = await cancel(I.pending, { key: replayKey });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    const deniedKey = randomUUID();
    await database.query(`
      CREATE OR REPLACE FUNCTION public.test_defer_owner_cancel_quota() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$;
      CREATE TRIGGER test_defer_owner_cancel_quota
      BEFORE INSERT OR UPDATE ON public.shared_rate_limit_windows
      FOR EACH ROW EXECUTE FUNCTION public.test_defer_owner_cancel_quota()
    `);
    let responses: Awaited<ReturnType<typeof cancel>>[] = [];
    try {
      responses = await Promise.all(Array.from({ length: 8 }, () => cancel(I.second, { key: deniedKey })));
    } finally {
      await database.query(`
        DROP TRIGGER IF EXISTS test_defer_owner_cancel_quota ON public.shared_rate_limit_windows;
        DROP FUNCTION IF EXISTS public.test_defer_owner_cancel_quota()
      `);
    }
    expect(responses.map((response) => response.status)).toEqual(Array(8).fill(429));
    expect(responses.every((response) => response.headers['retry-after'] === responses[0].headers['retry-after'])).toBe(true);
    expect(responses.every((response) => JSON.stringify(response.body) === JSON.stringify(responses[0].body))).toBe(true);
    expect(responses[0].headers['retry-after']).toMatch(/^\d+$/);
    expect(responses[0].body).toMatchObject({ code: 'RATE_LIMITED' });
    const consumed = await database.query<{ hit_count: number }>(`
      SELECT hit_count FROM public.shared_rate_limit_windows
      WHERE namespace='owner-booking-cancel' AND actor_id=$1 AND window_seconds=60
    `, [I.owner]);
    expect(consumed.rows[0].hit_count).toBe(61);
    const ledger = await database.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM booking_schema.idempotency_records
      WHERE scope=$1
    `, [`booking.owner-cancel:${I.owner}`]);
    expect(ledger.rows[0].count).toBe('2');
  });

  it('cleans a bounded old COMPLETED ledger batch while preserving PROCESSING and replay-horizon rows', async () => {
    await database.query(`
      INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,response_status,response_body,created_at,updated_at)
      SELECT $1,gen_random_uuid(),'COMPLETED',200,'{}'::jsonb,
             clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days'
      FROM generate_series(1,30)
    `, [`booking.owner-cancel:${I.owner}`]);
    await database.query(`
      INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,created_at,updated_at)
      VALUES ($1,gen_random_uuid(),'PROCESSING',clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days')
    `, [`booking.owner-cancel:${I.owner}`]);
    await database.query(`
      INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,response_status,response_body)
      VALUES ($1,gen_random_uuid(),'COMPLETED',200,'{}'::jsonb)
    `, [`booking.owner-cancel:${I.owner}`]);
    await database.query(`
      INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,response_status,response_body,created_at,updated_at)
      VALUES
        ($1,gen_random_uuid(),'COMPLETED',200,'{}'::jsonb,clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days'),
        ('booking.owner-cancel:legacy-shape',gen_random_uuid(),'COMPLETED',200,'{}'::jsonb,clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days')
    `, [`booking.owner-cancel:${I.foreign}`]);
    expect((await cancel(I.pending)).status).toBe(200);
    const retained = await database.query<{ status: string; old: boolean; count: string }>(`
      SELECT status, updated_at < clock_timestamp()-interval '24 hours' AS old, count(*)::text AS count
      FROM booking_schema.idempotency_records
      WHERE scope=$1
      GROUP BY status, old ORDER BY status, old
    `, [`booking.owner-cancel:${I.owner}`]);
    expect(retained.rows).toEqual([
      { status: 'COMPLETED', old: false, count: '2' },
      { status: 'COMPLETED', old: true, count: '5' },
      { status: 'PROCESSING', old: true, count: '1' },
    ]);
    const isolated = await database.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM booking_schema.idempotency_records
      WHERE scope IN ($1, 'booking.owner-cancel:legacy-shape')
    `, [`booking.owner-cancel:${I.foreign}`]);
    expect(isolated.rows[0].count).toBe('2');
  });
});

async function seed(database: DatabaseService) {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await resetBookingPersistence(database);
  await database.query('TRUNCATE public.shared_rate_limit_windows');
  await database.query(`INSERT INTO identity_schema.users(id) VALUES ($1),($2),($3),($4)`, [I.owner, I.foreign, I.vet, I.employee]);
  await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES ($1,$2,'Owner pet','DOG'),($3,$4,'Foreign pet','CAT')`, [I.pet, I.owner, I.foreignPet, I.foreign]);
  await database.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES ($1,'S16 LLC','S16 clinic')`, [I.clinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES ($1,$2,'S16 address')`, [I.location, I.clinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES ($1,$2,'S16','S16 service',30)`, [I.service, I.location]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,booked_count,integration_mode)
    VALUES
      ($1,$6,$7,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '150 minutes',1,1,0,'LEVEL_C'),
      ($2,$6,$7,clock_timestamp()+interval '3 hours',clock_timestamp()+interval '210 minutes',1,1,0,'LEVEL_C'),
      ($3,$6,$7,clock_timestamp()+interval '4 hours',clock_timestamp()+interval '270 minutes',1,0,1,'LEVEL_C'),
      ($4,$6,$7,clock_timestamp()+interval '5 hours',clock_timestamp()+interval '330 minutes',1,1,0,'LEVEL_C'),
      ($5,$6,$7,clock_timestamp()+interval '6 hours',clock_timestamp()+interval '390 minutes',1,0,0,'LEVEL_C'),
      ($8,$6,$7,clock_timestamp()+interval '7 hours',clock_timestamp()+interval '450 minutes',1,1,0,'LEVEL_C'),
      ($9,$6,$7,clock_timestamp()+interval '8 hours',clock_timestamp()+interval '510 minutes',1,1,0,'LEVEL_C')
  `, [I.pendingSlot, I.secondSlot, I.confirmedSlot, I.foreignSlot, I.terminalSlot, I.location, I.service, I.alternativeSlot, I.alternativeTargetSlot]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at)
    VALUES
      ($1,$6,$11,$12,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '20 minutes',clock_timestamp()+interval '15 minutes'),
      ($2,$7,$11,$12,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '20 minutes',clock_timestamp()+interval '15 minutes'),
      ($3,$8,$11,$12,'CONFIRMED',clock_timestamp()+interval '1 day',NULL),
      ($4,$9,$13,$14,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '20 minutes',clock_timestamp()+interval '15 minutes'),
      ($5,$10,$11,$12,'COMPLETED',clock_timestamp()-interval '1 day',NULL)
  `, [I.pending, I.second, I.confirmed, I.foreignHold, I.terminal, I.pendingSlot, I.secondSlot, I.confirmedSlot, I.foreignSlot, I.terminalSlot, I.owner, I.pet, I.foreign, I.foreignPet]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds(
      id,slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at,
      alternative_slot_id,alternative_expires_at
    ) VALUES ($1,$2,$3,$4,'ALTERNATIVE_PENDING',clock_timestamp()+interval '20 minutes',
      clock_timestamp()+interval '15 minutes',$5,clock_timestamp()+interval '10 minutes')
  `, [I.alternative, I.alternativeSlot, I.owner, I.pet, I.alternativeTargetSlot]);
  await database.query(`
    INSERT INTO booking_schema.alternative_swap_groups(
      id,original_hold_id,original_slot_id,alternative_slot_id,owner_id,expires_at,state
    ) VALUES ($1,$2,$3,$4,$5,clock_timestamp()+interval '10 minutes','PENDING')
  `, [I.alternativeSwap, I.alternative, I.alternativeSlot, I.alternativeTargetSlot, I.owner]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active,revoked_at)
    VALUES ($1,$2,'CLINIC_RECEPTIONIST',true,NULL)
  `, [I.employee, I.location]);
  await database.query(`INSERT INTO booking_schema.appointments(hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES ($1,$2,$3,$4,$5,'CONFIRMED')`, [I.confirmed, I.owner, I.pet, I.location, I.confirmedSlot]);
}

async function effects(database: DatabaseService, holdId: string, slotId: string) {
  const row = await database.query<{ state: string; held: number; booked: number; audits: string; outbox: string }>(`
    SELECT hold.state, slot.held_count AS held, slot.booked_count AS booked,
      (SELECT count(*)::text FROM audit_schema.audit_log audit WHERE audit.aggregate_id=hold.id) AS audits,
      (SELECT count(*)::text FROM booking_schema.outbox_events event WHERE event.aggregate_id=hold.id) AS outbox
    FROM booking_schema.booking_holds hold
    JOIN clinic_schema.appointment_slots slot ON slot.id=$2::uuid
    WHERE hold.id=$1::uuid
  `, [holdId, slotId]);
  return row.rows[0];
}
