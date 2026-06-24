import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { LiveKitService } from '../src/modules/telemed/livekit.service';
import { TelemedOwnerEndService } from '../src/modules/telemed/telemed-owner-end.service';
import { TelemedOwnerService } from '../src/modules/telemed/telemed-owner.service';
import { TelemedService } from '../src/modules/telemed/telemed.service';
import { TraceContext } from '../src/observability/trace-context.context';

jest.setTimeout(30000);

describe('Telemed owner controls', () => {
  const database = new DatabaseService();
  const liveKit = new LiveKitService();
  const telemed = new TelemedService(database, new TraceContext(), liveKit);
  const owner = new TelemedOwnerService(database, liveKit);
  const end = new TelemedOwnerEndService(database);

  beforeAll(() => {
    process.env.LIVEKIT_API_URL = 'wss://livekit.test';
    process.env.LIVEKIT_API_KEY = 'owner-test-key';
    process.env.LIVEKIT_API_SECRET = 'owner-test-secret';
  });

  beforeEach(async () => {
    await database.query(`TRUNCATE TABLE telemed_schema.telemed_sessions, booking_schema.outbox_events, booking_schema.idempotency_records, booking_schema.booking_holds, pet_schema.pets, identity_schema.users, clinic_schema.clinics RESTART IDENTITY CASCADE`);
  });

  afterAll(() => database.onModuleDestroy());

  it('returns owner-safe waiting snapshot and persists a room close request after connection', async () => {
    const fixture = await createFixture(database);
    const session = await telemed.startSessionAfterPayment(fixture.holdId);
    const waiting = await owner.read(session.id, fixture.ownerId);
    expect(waiting).toMatchObject({ state: 'WAITING_FOR_DOCTOR', refundState: 'NOT_APPLICABLE', endRequested: false });

    await telemed.connectDoctor(session.id, randomUUID());
    const request = await end.requestEnd({
      sessionId: session.id,
      ownerId: fixture.ownerId,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    expect(request.state).toBe('ENDING');

    const outbox = await database.query<{ event_type: string; status: string }>(`
      SELECT event_type, status FROM booking_schema.outbox_events
      WHERE event_type = 'telemed.room.close.requested.v1' AND aggregate_id = $1::uuid
    `, [session.id]);
    expect(outbox.rows[0]).toMatchObject({ event_type: 'telemed.room.close.requested.v1', status: 'PENDING' });
  });
});

async function createFixture(database: DatabaseService) {
  const ownerId = randomUUID();
  const petId = randomUUID();
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const slotId = randomUUID();
  const holdId = randomUUID();
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id,owner_id,name,species) VALUES ($1::uuid,$2::uuid,'Owner Pet','DOG')`, [petId, ownerId]);
  await database.query(`INSERT INTO clinic_schema.clinics (id,legal_name,public_name) VALUES ($1::uuid,'Owner LLC','Owner clinic')`, [clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id,clinic_id,address) VALUES ($1::uuid,$2::uuid,'Owner address')`, [locationId, clinicId]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id,clinic_location_id,starts_at,ends_at,capacity,held_count) VALUES ($1::uuid,$2::uuid,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '90 minutes',1,1)`, [slotId, locationId]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id,slot_id,owner_id,pet_id,state,expires_at) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'CONFIRMED',clock_timestamp()+interval '10 minutes')`, [holdId, slotId, ownerId, petId]);
  return { ownerId, holdId };
}
