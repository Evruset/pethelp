import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET ??= 'telemed-owner-cancel-test-secret-at-least-32-bytes';
process.env.JWT_ISSUER ??= 'vethelp-test';
process.env.JWT_AUDIENCE ??= 'vethelp-test';
process.env.WORKER_SERVICE_TOKEN ??= 'telemed-owner-cancel-worker-token';
process.env.LIVEKIT_API_URL = 'wss://livekit.test';
process.env.LIVEKIT_API_KEY = 'livekit-test-api-key';
process.env.LIVEKIT_API_SECRET = 'livekit-test-api-secret';

const { DomainException } = require('../src/common/domain-error') as typeof import('../src/common/domain-error');
const { DatabaseService } = require('../src/database/database.service') as typeof import('../src/database/database.service');
const { LiveKitService } = require('../src/modules/telemed/livekit.service') as typeof import('../src/modules/telemed/livekit.service');
const { TelemedOwnerSessionService } = require('../src/modules/telemed/telemed-owner-session.service') as typeof import('../src/modules/telemed/telemed-owner-session.service');
const {
  TelemedOwnerCancellationService,
} = require('../src/modules/telemed/telemed-owner-cancellation.service') as typeof import('../src/modules/telemed/telemed-owner-cancellation.service');
const { TelemedService } = require('../src/modules/telemed/telemed.service') as typeof import('../src/modules/telemed/telemed.service');
const { TraceContext } = require('../src/observability/trace-context.context') as typeof import('../src/observability/trace-context.context');

jest.setTimeout(30_000);

type DatabaseServiceInstance = InstanceType<typeof DatabaseService>;
type TelemedOwnerCancellationServiceInstance = InstanceType<typeof TelemedOwnerCancellationService>;
type TelemedServiceInstance = InstanceType<typeof TelemedService>;
type TelemedOwnerSessionServiceInstance = InstanceType<typeof TelemedOwnerSessionService>;
type DomainExceptionInstance = InstanceType<typeof DomainException>;

describe('Telemed owner cancellation', () => {
  let database: DatabaseServiceInstance;
  let cancellation: TelemedOwnerCancellationServiceInstance;
  let telemed: TelemedServiceInstance;
  let ownerSessions: TelemedOwnerSessionServiceInstance;
  let traceContext: InstanceType<typeof TraceContext>;

  beforeAll(() => {
    database = new DatabaseService();
    traceContext = new TraceContext();
    cancellation = new TelemedOwnerCancellationService(database, traceContext);
    telemed = new TelemedService(database, traceContext, new LiveKitService());
    ownerSessions = new TelemedOwnerSessionService(database);
  });

  beforeEach(async () => resetDatabase(database));
  afterAll(async () => database.onModuleDestroy());

  it('cancels only once, requests an authorization void and fences doctor connection', async () => {
    const fixture = await createFixture(database);
    const idempotencyKey = randomUUID();

    const first = await cancellation.cancel({ sessionId: fixture.sessionId, ownerId: fixture.ownerId, idempotencyKey });
    const replay = await cancellation.cancel({ sessionId: fixture.sessionId, ownerId: fixture.ownerId, idempotencyKey });

    expect(first).toMatchObject({
      sessionId: fixture.sessionId,
      state: 'CANCELLED',
      telemedCaseState: 'CANCELLED_BY_OWNER',
      paymentStatus: 'VOID_REQUESTED',
      refundState: 'VOID_REQUESTED',
    });
    expect(replay).toMatchObject({ state: 'CANCELLED', paymentStatus: 'VOID_REQUESTED' });

    const stored = await database.query<{
      session_state: string;
      case_state: string;
      payment_status: string;
      outbox_count: string;
      event_count: string;
    }>(`
      SELECT
        session.state AS session_state,
        telemed_case.state AS case_state,
        payment.status AS payment_status,
        (SELECT count(*)::text FROM booking_schema.outbox_events WHERE deduplication_key = $2) AS outbox_count,
        (SELECT count(*)::text FROM telemed_schema.telemed_case_events WHERE case_id = telemed_case.id AND event_type = 'OWNER_CANCELLED') AS event_count
      FROM telemed_schema.telemed_sessions session
      JOIN telemed_schema.telemed_cases telemed_case ON telemed_case.id = session.telemed_case_id
      JOIN telemed_schema.telemed_payment_intents payment ON payment.case_id = telemed_case.id
      WHERE session.id = $1::uuid
    `, [fixture.sessionId, `payment.acquiring.telemed.owner-cancel.void.requested.v1:${fixture.paymentId}`]);

    expect(stored.rows[0]).toEqual({
      session_state: 'CANCELLED',
      case_state: 'CANCELLED_BY_OWNER',
      payment_status: 'VOID_REQUESTED',
      outbox_count: '1',
      event_count: '1',
    });

    const snapshot = await ownerSessions.read(fixture.sessionId, fixture.ownerId);
    expect(snapshot).toMatchObject({
      sessionId: fixture.sessionId,
      state: 'CANCELLED',
      telemedCaseState: 'CANCELLED_BY_OWNER',
      paymentStatus: 'VOID_REQUESTED',
      refundState: 'VOID_REQUESTED',
    });

    const list = await ownerSessions.list(fixture.ownerId);
    expect(list).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sessionId: fixture.sessionId,
        state: 'CANCELLED',
        telemedCaseState: 'CANCELLED_BY_OWNER',
        paymentStatus: 'VOID_REQUESTED',
        refundState: 'VOID_REQUESTED',
        bucket: 'HISTORY',
      }),
    ]));

    await expectDomainError(
      telemed.connectDoctor(fixture.sessionId, fixture.doctorId),
      409,
      'TELEMED_SESSION_NOT_JOINABLE',
    );
  });

  it('rejects a second cancellation with a different idempotency key', async () => {
    const fixture = await createFixture(database);
    await cancellation.cancel({ sessionId: fixture.sessionId, ownerId: fixture.ownerId, idempotencyKey: randomUUID() });

    await expectDomainError(
      cancellation.cancel({
        sessionId: fixture.sessionId,
        ownerId: fixture.ownerId,
        idempotencyKey: randomUUID(),
      }),
      409,
      'TELEMED_SESSION_ALREADY_CANCELLED',
    );
  });
});


async function expectDomainError(
  request: Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  try {
    await request;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DomainException);
    const finalError = error as DomainExceptionInstance;
    expect(finalError.getStatus()).toBe(status);
    expect(finalError.getResponse()).toMatchObject({ code });
  }
}

async function createFixture(database: DatabaseServiceInstance) {
  const ownerId = randomUUID();
  const petId = randomUUID();
  const intakeId = randomUUID();
  const caseId = randomUUID();
  const paymentId = randomUUID();
  const sessionId = randomUUID();
  const doctorId = randomUUID();

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Owner cancel pet', 'CAT')`, [petId, ownerId]);
  await database.query(`
    INSERT INTO telemed_schema.telemed_intakes (
      id, owner_id, pet_id, category, symptom_duration, prior_clinic_visit,
      emergency_red_flags, attachment_refs, consent_version,
      expected_service_level, eligibility_outcome, routing_target, guardrails
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, 'GENERAL_QUESTION', 'NO_SYMPTOMS', false,
      ARRAY[]::text[], ARRAY[]::text[], 'test-consent-v1',
      'STANDARD', 'TELEMED_ELIGIBLE', 'TELEMED_PAYMENT_QUEUE', ARRAY[]::text[]
    )
  `, [intakeId, ownerId, petId]);
  await database.query(`
    INSERT INTO telemed_schema.telemed_cases (
      id, intake_id, owner_id, pet_id, state, urgency_band, service_level, queue_priority
    ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'DOCTOR_JOINED', 'ROUTINE', 'STANDARD', 110)
  `, [caseId, intakeId, ownerId, petId]);
  await database.query(`
    INSERT INTO telemed_schema.telemed_payment_intents (
      id, case_id, payment_attempt_no, amount, currency, status, idempotency_key, provider_payment_id
    ) VALUES ($1::uuid, $2::uuid, 1, 1500.00::numeric, 'RUB', 'AUTHORIZED', $3::uuid, 'telemed-owner-cancel-provider-payment')
  `, [paymentId, caseId, randomUUID()]);
  await database.query(`
    INSERT INTO telemed_schema.telemed_sessions (
      id, telemed_case_id, owner_id, state, room_name, expires_at
    ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'WAITING_FOR_DOCTOR', $4, clock_timestamp() + interval '5 minutes')
  `, [sessionId, caseId, ownerId, `telemed-owner-cancel-${sessionId.replace(/-/g, '')}`]);

  return { ownerId, sessionId, paymentId, doctorId };
}

async function resetDatabase(database: DatabaseServiceInstance): Promise<void> {
  await database.query(`
    TRUNCATE TABLE
      telemed_schema.telemed_payment_events,
      telemed_schema.telemed_provider_webhook_events,
      telemed_schema.telemed_case_events,
      telemed_schema.telemed_sessions,
      telemed_schema.telemed_payment_intents,
      telemed_schema.telemed_cases,
      telemed_schema.telemed_intakes,
      booking_schema.outbox_events,
      audit_schema.audit_log,
      pet_schema.pets,
      identity_schema.users
    RESTART IDENTITY CASCADE
  `);
}
