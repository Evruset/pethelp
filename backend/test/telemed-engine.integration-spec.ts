import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { ContextLoggerService } from '../src/observability/context-logger.service';
import { ObservabilityMetricsService } from '../src/observability/observability.metrics';
import { TraceContext } from '../src/observability/trace-context.context';
import { LiveKitService } from '../src/modules/telemed/livekit.service';
import { TelemedService } from '../src/modules/telemed/telemed.service';
import { TelemedSessionStartWorker } from '../src/modules/telemed/telemed-session-start.worker';
import { TelemedSlaWorker } from '../src/modules/telemed/telemed-sla.worker';

jest.setTimeout(30_000);

describe('Telemedicine Engine', () => {
  let database: DatabaseService;
  let traceContext: TraceContext;
  let logger: ContextLoggerService;
  let metrics: ObservabilityMetricsService;
  let liveKitService: LiveKitService;
  let telemedService: TelemedService;
  let startWorker: TelemedSessionStartWorker;
  let slaWorker: TelemedSlaWorker;

  beforeAll(() => {
    process.env.WORKERS_ENABLED = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'telemed-test-jwt-secret-at-least-32-bytes';
    process.env.LIVEKIT_API_URL = 'wss://livekit.test';
    process.env.LIVEKIT_API_KEY = 'livekit-test-api-key';
    process.env.LIVEKIT_API_SECRET = 'livekit-test-api-secret';
    database = new DatabaseService();
    traceContext = new TraceContext();
    logger = new ContextLoggerService(traceContext);
    metrics = new ObservabilityMetricsService(logger);
    liveKitService = new LiveKitService();
    telemedService = new TelemedService(database, traceContext, liveKitService);
    startWorker = new TelemedSessionStartWorker(database, telemedService, traceContext, logger);
    slaWorker = new TelemedSlaWorker(database, traceContext, logger, metrics);
  });

  beforeEach(async () => resetDatabase(database));
  afterAll(async () => database.onModuleDestroy());

  it('activates a waiting session from CONFIRMED hold outbox event', async () => {
    const fixture = await createFixture(database, 'MIS_HELD');
    const correlationId = randomUUID();
    await traceContext.run({ correlationId }, () => database.withTransaction(async (client) => {
      await client.query(`UPDATE booking_schema.booking_holds SET state = 'CONFIRMED', version = version + 1, state_changed_at = clock_timestamp() WHERE id = $1::uuid`, [fixture.holdId]);
    }));

    await startWorker.relayConfirmedSessions();
    const session = await readSessionByHold(database, fixture.holdId);
    expect(session.state).toBe('WAITING_FOR_DOCTOR');
    expect(session.owner_id).toBe(fixture.ownerId);
    expect(session.correlation_id).toBe(correlationId);

    const outbox = await database.query<{ status: string; correlation_id: string | null }>(`
      SELECT status, correlation_id FROM booking_schema.outbox_events
      WHERE event_type = 'telemed.session.start.requested.v1' AND aggregate_id = $1::uuid
    `, [fixture.holdId]);
    expect(outbox.rows[0]).toMatchObject({ status: 'PUBLISHED', correlation_id: correlationId });
  });

  it('locks session, assigns doctor and returns a native 30-minute LiveKit token', async () => {
    const fixture = await createFixture(database, 'CONFIRMED');
    const session = await telemedService.startSessionAfterPayment(fixture.holdId);
    const doctorId = randomUUID();
    const connected = await telemedService.connectDoctor(session.id, doctorId);

    expect(connected.session.state).toBe('CONNECTED');
    expect(connected.session.doctorId).toBe(doctorId);
    expect(connected.accessToken.split('.')).toHaveLength(3);
    expect(connected.livekitUrl).toBe('wss://livekit.test');
    expect(new Date(connected.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 60 * 1000);
  });

  it('times out a no-show doctor and atomically requests a refund for captured payment', async () => {
    const fixture = await createFixture(database, 'CONFIRMED');
    const correlationId = randomUUID();
    const session = await traceContext.run({ correlationId }, () => telemedService.startSessionAfterPayment(fixture.holdId));
    const paymentId = randomUUID();

    await database.query(`
      INSERT INTO payment_schema.payment_intents (
        id, hold_id, hold_version, amount, currency, status, idempotency_key, provider_payment_id
      ) VALUES ($1::uuid, $2::uuid, 1, 1000.00::numeric, 'RUB', 'CAPTURED', $3, 'telemed-provider-payment')
    `, [paymentId, fixture.holdId, `telemed-payment-${paymentId}`]);
    await database.query(`UPDATE telemed_schema.telemed_sessions SET expires_at = clock_timestamp() - interval '1 second' WHERE id = $1::uuid`, [session.id]);

    await slaWorker.enforceExpiredSessions();

    expect((await readSession(database, session.id)).state).toBe('DOCTOR_TIMEOUT');
    const payment = await database.query<{ status: string; refunded_amount: string }>(`
      SELECT status, refunded_amount::text AS refunded_amount FROM payment_schema.payment_intents WHERE id = $1::uuid
    `, [paymentId]);
    expect(payment.rows[0]).toMatchObject({ status: 'REFUND_SENT', refunded_amount: '0.00' });
  });
});

async function createFixture(database: DatabaseService, state: 'MIS_HELD' | 'CONFIRMED') {
  const ownerId = randomUUID(); const petId = randomUUID(); const clinicId = randomUUID();
  const locationId = randomUUID(); const slotId = randomUUID(); const holdId = randomUUID();
  const serviceId = randomUUID();
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Telemed Pet', 'DOG')`, [petId, ownerId]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Telemed Clinic LLC', 'Telemed Clinic')`, [clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Telemed address')`, [locationId, clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'TELEMED_TEST', 'Telemed test', 30)`, [serviceId, locationId]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, service_id, starts_at, ends_at, capacity, held_count) VALUES ($1::uuid, $2::uuid, $3::uuid, clock_timestamp() + interval '1 hour', clock_timestamp() + interval '90 minutes', 1, 1)`, [slotId, locationId, serviceId]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, clock_timestamp() + interval '10 minutes')`, [holdId, slotId, ownerId, petId, state]);
  return { ownerId, holdId };
}

async function resetDatabase(database: DatabaseService): Promise<void> {
  await database.query(`
    TRUNCATE TABLE telemed_schema.telemed_sessions, payment_schema.provider_webhook_events,
      payment_schema.ledger_entries, payment_schema.payment_intents, audit_schema.audit_log,
      booking_schema.outbox_events, booking_schema.appointment_events, booking_schema.appointments,
      booking_schema.idempotency_records, booking_schema.booking_holds, pet_schema.pets,
      identity_schema.users, clinic_schema.clinics RESTART IDENTITY CASCADE
  `);
}

async function readSessionByHold(database: DatabaseService, holdId: string) {
  const result = await database.query<{ state: string; owner_id: string; correlation_id: string | null }>(`
    SELECT state, owner_id, correlation_id FROM telemed_schema.telemed_sessions WHERE booking_hold_id = $1::uuid
  `, [holdId]);
  return result.rows[0];
}

async function readSession(database: DatabaseService, sessionId: string) {
  const result = await database.query<{ state: string }>(`SELECT state FROM telemed_schema.telemed_sessions WHERE id = $1::uuid`, [sessionId]);
  return result.rows[0];
}
