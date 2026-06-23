import { AccessToken } from 'livekit-server-sdk';
import { createHash, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { DatabaseService } from '../src/database/database.service';
import { ContextLoggerService } from '../src/observability/context-logger.service';
import { TraceContext } from '../src/observability/trace-context.context';
import { LiveKitWebhookController } from '../src/modules/telemed/livekit-webhook.controller';
import { LiveKitWebhookService } from '../src/modules/telemed/livekit-webhook.service';
import { LiveKitService } from '../src/modules/telemed/livekit.service';

const LIVEKIT_API_KEY = 'livekit-webhook-test-key';
const LIVEKIT_API_SECRET = 'livekit-webhook-test-secret';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

jest.setTimeout(30_000);

describe('LiveKit telemedicine webhooks', () => {
  let database: DatabaseService;
  let traceContext: TraceContext;
  let logger: ContextLoggerService;
  let controller: LiveKitWebhookController;

  beforeAll(() => {
    process.env.LIVEKIT_API_URL = 'wss://livekit.test';
    process.env.LIVEKIT_API_KEY = LIVEKIT_API_KEY;
    process.env.LIVEKIT_API_SECRET = LIVEKIT_API_SECRET;
    database = new DatabaseService();
    traceContext = new TraceContext();
    logger = new ContextLoggerService(traceContext);
    const liveKitService = new LiveKitService();
    const webhookService = new LiveKitWebhookService(database, traceContext, logger, liveKitService);
    controller = new LiveKitWebhookController(webhookService);
  });

  beforeEach(async () => resetDatabase(database));
  afterAll(async () => database.onModuleDestroy());

  it('verifies a signed room_finished webhook and atomically completes the session with session correlation in logs', async () => {
    const fixture = await createConnectedSession(database);
    const rawBody = JSON.stringify({ event: 'room_finished', room: { name: fixture.roomName } });
    const authorization = await signedAuthorization(rawBody);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await controller.receive({ rawBody: Buffer.from(rawBody) } as RawBodyRequest, authorization);

    const session = await database.query<{ state: string }>(`
      SELECT state FROM telemed_schema.telemed_sessions WHERE id = $1::uuid
    `, [fixture.sessionId]);
    expect(session.rows[0]?.state).toBe('COMPLETED');

    const completionLog = consoleSpy.mock.calls
      .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
      .find((line) => line.message === 'LiveKit room finished and session completed');
    expect(completionLog).toMatchObject({
      correlationId: fixture.correlationId,
      telemedSessionId: fixture.sessionId,
      roomName: fixture.roomName,
    });
    consoleSpy.mockRestore();
  });

  it('records precise doctor join audit only when participant identity matches assigned doctor', async () => {
    const fixture = await createConnectedSession(database);
    const rawBody = JSON.stringify({
      event: 'participant_joined',
      room: { name: fixture.roomName },
      participant: { identity: fixture.doctorId },
    });

    await controller.receive({ rawBody: Buffer.from(rawBody) } as RawBodyRequest, await signedAuthorization(rawBody));

    const audit = await database.query<{ action: string; actor_id: string; correlation_id: string | null }>(`
      SELECT action, actor_id, correlation_id::text AS correlation_id
      FROM audit_schema.audit_log
      WHERE aggregate_id = $1::uuid
        AND action = 'TELEMED_DOCTOR_JOINED_LIVEKIT'
    `, [fixture.sessionId]);
    expect(audit.rows[0]).toMatchObject({
      action: 'TELEMED_DOCTOR_JOINED_LIVEKIT',
      actor_id: fixture.doctorId,
      correlation_id: fixture.correlationId,
    });
  });

  async function signedAuthorization(rawBody: string): Promise<string> {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: 'livekit-webhook-test',
      ttl: '5m',
    });
    token.sha256 = createHash('sha256').update(rawBody).digest('base64');
    return token.toJwt();
  }
});

async function createConnectedSession(database: DatabaseService) {
  const ownerId = randomUUID();
  const petId = randomUUID();
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const slotId = randomUUID();
  const holdId = randomUUID();
  const sessionId = randomUUID();
  const doctorId = randomUUID();
  const correlationId = randomUUID();
  const roomName = `livekit-room-${sessionId}`;

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'LiveKit Pet', 'DOG')`, [petId, ownerId]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'LiveKit Clinic LLC', 'LiveKit Clinic')`, [clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'LiveKit address')`, [locationId, clinicId]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, starts_at, ends_at, capacity, held_count) VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '1 hour', clock_timestamp() + interval '90 minutes', 1, 1)`, [slotId, locationId]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'CONFIRMED', clock_timestamp() + interval '10 minutes')`, [holdId, slotId, ownerId, petId]);
  await database.query(`
    INSERT INTO telemed_schema.telemed_sessions (
      id, booking_hold_id, owner_id, doctor_id, state,
      room_name, correlation_id, expires_at
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'CONNECTED',
      $5, $6::uuid, clock_timestamp() + interval '5 minutes'
    )
  `, [sessionId, holdId, ownerId, doctorId, roomName, correlationId]);

  return { sessionId, doctorId, correlationId, roomName };
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
