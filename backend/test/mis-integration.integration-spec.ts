import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import nock from 'nock';
import { randomUUID } from 'node:crypto';
import { setTimeout as retryDelay } from 'node:timers/promises';
import type { DatabaseService } from '../src/database/database.service';
import type { MisCommandDispatcherService } from '../src/modules/mis-integration/mis-command-dispatcher.service';
import type { MisReservationRequestedPayload } from '../src/modules/mis-integration/interfaces/mis-event.interface';

jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn(() => Promise.resolve()),
}));

const VET_MANAGER_BASE_URL = 'https://vetmanager.test';
const mockedRetryDelay = retryDelay as jest.MockedFunction<typeof retryDelay>;

interface Fixture {
  clinicId: string;
  slotId: string;
  holdId: string;
  ownerId: string;
  petId: string;
  externalPatientId: string;
  payload: MisReservationRequestedPayload;
}

interface HoldProjection {
  state: string;
  external_hold_id: string | null;
}

jest.setTimeout(30_000);

describe('MisCommandDispatcherService integration', () => {
  let database: DatabaseService;
  let dispatcher: MisCommandDispatcherService;
  let fixture: Fixture;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for MIS integration tests');
    }

    process.env.MIS_VET_MANAGER_BASE_URL = VET_MANAGER_BASE_URL;
    process.env.MIS_VET_MANAGER_API_KEY = 'mis-test-key';
    process.env.WORKERS_ENABLED = 'false';
    process.env.JWT_SECRET ??= 'mis-integration-test-jwt-secret';
    process.env.JWT_ISSUER ??= 'mis-integration-test-issuer';
    process.env.JWT_AUDIENCE ??= 'mis-integration-test-audience';
    process.env.WORKER_SERVICE_TOKEN ??= 'mis-integration-test-worker-token';

    const [
      { DatabaseService },
      { VetManagerAdapter },
      { MisAdapterFactory },
      { MisCommandDispatcherService },
    ] = await Promise.all([
      import('../src/database/database.service'),
      import('../src/modules/mis-integration/adapters/vet-manager.adapter'),
      import('../src/modules/mis-integration/mis-adapter.factory'),
      import('../src/modules/mis-integration/mis-command-dispatcher.service'),
    ]);

    database = new DatabaseService();
    const http = new HttpService(axios.create({ proxy: false }));
    const adapter = new VetManagerAdapter(http);
    const factory = new MisAdapterFactory(adapter);
    dispatcher = new MisCommandDispatcherService(database, factory);

    nock.disableNetConnect();
  });

  beforeEach(async () => {
    nock.cleanAll();
    jest.clearAllMocks();
    await resetDatabase(database);
    fixture = await createMisReservationFixture(database);
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
    await database.onModuleDestroy();
  });

  it('commits MIS_HELD, external hold id and audit event on a successful VetManager reservation', async () => {
    const externalHoldId = 'vetmanager-hold-success';
    const scope = reserveScope(fixture)
      .reply(200, { success: true, external_hold_id: externalHoldId, ttl_minutes: 7 });

    await dispatcher.dispatchReservation(fixture.payload);

    const hold = await readHold(database, fixture.holdId);
    expect(hold).toEqual({ state: 'MIS_HELD', external_hold_id: externalHoldId });
    await expectAuditAction(database, fixture.holdId, 'mis.reservation.held');
    await expectHeldCount(database, fixture.slotId, 1);
    expect(scope.isDone()).toBe(true);
    expect(mockedRetryDelay).not.toHaveBeenCalled();
  });

  it('retries two transport failures and commits MIS_HELD on the third attempt without compensation', async () => {
    const externalHoldId = 'vetmanager-hold-after-retry';
    const scope = reserveScope(fixture)
      .reply(500, { message: 'temporary outage 1' })
      .post('/api/v1/reservations', expectedRequestBody(fixture))
      .reply(500, { message: 'temporary outage 2' })
      .post('/api/v1/reservations', expectedRequestBody(fixture))
      .reply(200, { success: true, external_hold_id: externalHoldId });

    await dispatcher.dispatchReservation(fixture.payload);

    const hold = await readHold(database, fixture.holdId);
    expect(hold).toEqual({ state: 'MIS_HELD', external_hold_id: externalHoldId });
    await expectAuditAction(database, fixture.holdId, 'mis.reservation.held');
    await expectHeldCount(database, fixture.slotId, 1);
    expect(scope.isDone()).toBe(true);
    expect(mockedRetryDelay.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([1_000, 2_000]);
  });

  it('marks the hold MIS_BOOKING_FAILED and compensates held_count after all network attempts fail', async () => {
    const scope = reserveScope(fixture)
      .reply(500, { message: 'outage 1' })
      .post('/api/v1/reservations', expectedRequestBody(fixture))
      .reply(500, { message: 'outage 2' })
      .post('/api/v1/reservations', expectedRequestBody(fixture))
      .reply(500, { message: 'outage 3' });

    await dispatcher.dispatchReservation(fixture.payload);

    const hold = await readHold(database, fixture.holdId);
    expect(hold).toEqual({ state: 'MIS_BOOKING_FAILED', external_hold_id: null });
    await expectHeldCount(database, fixture.slotId, 0);
    await expectAuditAction(database, fixture.holdId, 'mis.reservation.failed');
    expect(scope.isDone()).toBe(true);
    expect(mockedRetryDelay.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([1_000, 2_000]);
  });

  it('does not retry a non-retryable VetManager 400 and compensates immediately', async () => {
    const scope = reserveScope(fixture).reply(400, { message: 'invalid external patient' });

    await dispatcher.dispatchReservation(fixture.payload);

    const hold = await readHold(database, fixture.holdId);
    expect(hold).toEqual({ state: 'MIS_BOOKING_FAILED', external_hold_id: null });
    await expectHeldCount(database, fixture.slotId, 0);
    await expectAuditAction(database, fixture.holdId, 'mis.reservation.failed');
    expect(scope.isDone()).toBe(true);
    expect(mockedRetryDelay).not.toHaveBeenCalled();
  });
});

function reserveScope(fixture: Fixture): nock.Scope {
  return nock(VET_MANAGER_BASE_URL)
    .matchHeader('idempotency-key', fixture.holdId)
    .matchHeader('x-api-key', 'mis-test-key')
    .post('/api/v1/reservations', expectedRequestBody(fixture));
}

function expectedRequestBody(fixture: Fixture): (body: unknown) => boolean {
  return (body: unknown): boolean => {
    if (typeof body !== 'object' || body === null) return false;
    const value = body as Record<string, unknown>;
    return value.reservationId === fixture.holdId
      && value.slotId === fixture.slotId
      && value.clinicId === fixture.clinicId
      && value.patientId === fixture.externalPatientId;
  };
}

async function resetDatabase(database: DatabaseService): Promise<void> {
  await database.query(`
    TRUNCATE TABLE
      audit_schema.audit_log,
      booking_schema.outbox_events,
      booking_schema.appointment_events,
      booking_schema.appointments,
      booking_schema.idempotency_records,
      booking_schema.booking_holds,
      pet_schema.pets,
      identity_schema.users,
      clinic_schema.clinics
    RESTART IDENTITY CASCADE
  `);
}

async function createMisReservationFixture(database: DatabaseService): Promise<Fixture> {
  const ownerId = randomUUID();
  const petId = randomUUID();
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const slotId = randomUUID();
  const holdId = randomUUID();
  const correlationId = randomUUID();
  const externalPatientId = `vetmanager-patient-${randomUUID()}`;

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(
    `INSERT INTO pet_schema.pets (id, owner_id, name, species, external_patient_id)
     VALUES ($1::uuid, $2::uuid, 'MIS Test Pet', 'DOG', $3)`,
    [petId, ownerId, externalPatientId],
  );
  await database.query(
    `INSERT INTO clinic_schema.clinics (id, legal_name, public_name, mis_type)
     VALUES ($1::uuid, 'MIS Test Clinic LLC', 'MIS Test Clinic', 'VET_MANAGER_API')`,
    [clinicId],
  );
  await database.query(
    `INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address)
     VALUES ($1::uuid, $2::uuid, 'MIS test address')`,
    [locationId, clinicId],
  );
  await database.query(
    `INSERT INTO clinic_schema.appointment_slots (
       id, clinic_location_id, starts_at, ends_at, capacity, held_count
     ) VALUES (
       $1::uuid, $2::uuid,
       clock_timestamp() + interval '1 hour',
       clock_timestamp() + interval '90 minutes',
       1, 1
     )`,
    [slotId, locationId],
  );
  await database.query(
    `INSERT INTO booking_schema.booking_holds (
       id, slot_id, owner_id, pet_id, state, expires_at
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid,
       'MIS_RESERVATION_PENDING', clock_timestamp() + interval '10 minutes'
     )`,
    [holdId, slotId, ownerId, petId],
  );

  return {
    clinicId,
    slotId,
    holdId,
    ownerId,
    petId,
    externalPatientId,
    payload: {
      holdId,
      slotId,
      clinicId,
      externalPatientId,
      correlationId,
    },
  };
}

async function readHold(database: DatabaseService, holdId: string): Promise<HoldProjection> {
  const result = await database.query<HoldProjection>(
    `SELECT state, external_hold_id
     FROM booking_schema.booking_holds
     WHERE id = $1::uuid`,
    [holdId],
  );
  expect(result.rowCount).toBe(1);
  return result.rows[0];
}

async function expectHeldCount(database: DatabaseService, slotId: string, expected: number): Promise<void> {
  const result = await database.query<{ held_count: number }>(
    'SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $1::uuid',
    [slotId],
  );
  expect(result.rows[0]?.held_count).toBe(expected);
}

async function expectAuditAction(database: DatabaseService, holdId: string, action: string): Promise<void> {
  const result = await database.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM audit_schema.audit_log
     WHERE aggregate_type = 'booking_hold'
       AND aggregate_id = $1::uuid
       AND action = $2`,
    [holdId, action],
  );
  expect(result.rows[0]?.count).toBe('1');
}
