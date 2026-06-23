import { createHash, randomUUID } from 'node:crypto';
import { DomainException } from '../src/common/domain-error';
import { DatabaseService } from '../src/database/database.service';
import { AcquiringClient } from '../src/modules/payments/acquiring-client.service';
import { PaymentAuthorizedWebhookCommand, PaymentService } from '../src/modules/payments/payment.service';

interface Fixture {
  ownerId: string;
  petId: string;
  clinicId: string;
  locationId: string;
  slotId: string;
  holdId: string;
}

jest.setTimeout(30_000);

describe('Payment attempt fencing', () => {
  let database: DatabaseService;
  let service: PaymentService;
  let fixture: Fixture;
  let acquiringClient: { createRemoteIntent: jest.Mock };

  beforeAll(() => {
    database = new DatabaseService();
    acquiringClient = {
      createRemoteIntent: jest.fn(async (paymentId: string) => ({
        remoteId: `remote-${paymentId}`,
        checkoutUrl: `https://checkout.test/${paymentId}`,
      })),
    };
    service = new PaymentService(database, acquiringClient as unknown as AcquiringClient);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDatabase(database);
    fixture = await createFixture(database, 'MIS_HELD');
  });

  afterAll(async () => {
    await database.onModuleDestroy();
  });

  it('creates one remote provider intent per hold version', async () => {
    const first = await service.createPaymentIntent(fixture.holdId, fixture.ownerId);
    const second = await service.createPaymentIntent(fixture.holdId, fixture.ownerId);

    expect(first.status).toBe('CREATED');
    expect(first.remoteId).toBeTruthy();
    expect(first.checkoutUrl).toBeTruthy();
    expect(second.id).toBe(first.id);
    expect(acquiringClient.createRemoteIntent).toHaveBeenCalledTimes(1);

    const count = await database.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM payment_schema.payment_intents WHERE hold_id = $1::uuid',
      [fixture.holdId],
    );
    expect(count.rows[0].count).toBe('1');
    await expectLedgerEntry(database, first.id, 'PROVIDER_INTENT_CREATED');
  });

  it('authorizes a legitimate hold and queues capture instead of marking it CAPTURED in webhook transaction', async () => {
    const intent = await service.createPaymentIntent(fixture.holdId, fixture.ownerId);

    const result = await service.handlePaymentAuthorized(webhookCommand(intent.idempotencyKey, intent.remoteId ?? undefined));

    expect(result.status).toBe('AUTHORIZED');
    const hold = await readHold(database, fixture.holdId);
    expect(hold.state).toBe('CONFIRMED');
    expect(Number(hold.version)).toBe(intent.holdVersion + 1);
    await expectPaymentStatus(database, intent.id, 'AUTHORIZED');
    await expectLedgerEntry(database, intent.id, 'CAPTURE_REQUESTED');
    const captureOutbox = await database.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM booking_schema.outbox_events
      WHERE event_type = 'payment.acquiring.capture.requested.v1'
        AND aggregate_id = $1::uuid
        AND status = 'PENDING'
    `, [intent.id]);
    expect(captureOutbox.rows[0].count).toBe('1');
  });

  it('fences a late authorization, queues void and preserves no capture command', async () => {
    const intent = await service.createPaymentIntent(fixture.holdId, fixture.ownerId);
    await database.query(
      `UPDATE booking_schema.booking_holds
       SET state = 'EXPIRED', version = version + 1, state_changed_at = clock_timestamp()
       WHERE id = $1::uuid`,
      [fixture.holdId],
    );

    await expect(service.handlePaymentAuthorized(webhookCommand(intent.idempotencyKey, intent.remoteId ?? undefined))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAYMENT_FENCED_SLOT_EXPIRED' }),
    } as DomainException);

    await expectPaymentStatus(database, intent.id, 'VOIDED');
    await expectLedgerEntry(database, intent.id, 'VOID_REQUESTED');
    const captureOutbox = await database.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM booking_schema.outbox_events
      WHERE event_type = 'payment.acquiring.capture.requested.v1'
        AND aggregate_id = $1::uuid
    `, [intent.id]);
    expect(captureOutbox.rows[0].count).toBe('0');
  });
});

function webhookCommand(idempotencyKey: string, providerPaymentId?: string): PaymentAuthorizedWebhookCommand {
  const providerEventId = `provider-event-${randomUUID()}`;
  const rawPayload = JSON.stringify({ idempotencyKey, providerEventId, providerPaymentId });
  return {
    idempotencyKey,
    providerEventId,
    providerPaymentId,
    rawPayload,
    payloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
  };
}

async function resetDatabase(database: DatabaseService): Promise<void> {
  await database.query(`
    TRUNCATE TABLE
      payment_schema.provider_webhook_events,
      payment_schema.ledger_entries,
      payment_schema.payment_intents,
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

async function createFixture(database: DatabaseService, holdState: string): Promise<Fixture> {
  const ownerId = randomUUID();
  const petId = randomUUID();
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const slotId = randomUUID();
  const holdId = randomUUID();

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Payment Test Pet', 'DOG')`, [petId, ownerId]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Payment Test Clinic LLC', 'Payment Test Clinic')`, [clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Payment test address')`, [locationId, clinicId]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, starts_at, ends_at, capacity, held_count) VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '1 hour', clock_timestamp() + interval '90 minutes', 1, 1)`, [slotId, locationId]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, clock_timestamp() + interval '10 minutes')`, [holdId, slotId, ownerId, petId, holdState]);

  return { ownerId, petId, clinicId, locationId, slotId, holdId };
}

async function readHold(database: DatabaseService, holdId: string): Promise<{ state: string; version: number }> {
  const result = await database.query<{ state: string; version: number }>('SELECT state, version FROM booking_schema.booking_holds WHERE id = $1::uuid', [holdId]);
  return result.rows[0];
}

async function expectPaymentStatus(database: DatabaseService, paymentId: string, status: string): Promise<void> {
  const result = await database.query<{ status: string }>('SELECT status FROM payment_schema.payment_intents WHERE id = $1::uuid', [paymentId]);
  expect(result.rows[0]?.status).toBe(status);
}

async function expectLedgerEntry(database: DatabaseService, paymentId: string, entryType: string): Promise<void> {
  const result = await database.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM payment_schema.ledger_entries
    WHERE payment_intent_id = $1::uuid AND entry_type = $2
  `, [paymentId, entryType]);
  expect(result.rows[0].count).toBe('1');
}
