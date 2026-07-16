import { randomUUID } from 'node:crypto';
import { BookingHoldCreationService } from '../src/booking-core/booking-hold-creation.service';
import { BookingHoldReadService } from '../src/booking-core/booking-hold-read.service';
import { BookingRepository } from '../src/booking-core/booking.repository';
import { Role } from '../src/auth/auth.types';
import { DomainException } from '../src/common/domain-error';
import { DatabaseService } from '../src/database/database.service';

jest.setTimeout(45_000);

describe('V50 owner booking hold/status (real PostgreSQL)', () => {
  const database = new DatabaseService();
  const creation = new BookingHoldCreationService(database, new BookingRepository());
  const clinicAccess = { assertBookingHoldReadAccess: jest.fn() } as never;
  const read = new BookingHoldReadService(database, clinicAccess);

  afterAll(async () => database.onModuleDestroy());

  it('binds idempotency to the canonical payload and returns an owner-safe snapshot', async () => {
    const fixture = await seedFixture(database, 1);
    const key = randomUUID();
    const input = command(fixture, fixture.owners[0], fixture.pets[0], key);
    const first = await creation.createLocalHold(input);
    const replay = await creation.createLocalHold(input);
    expect(replay).toEqual(first);

    await expect(creation.createLocalHold({ ...input, serviceId: randomUUID() }))
      .rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' } });

    const snapshot = await read.readForActor(first.holdId, { sub: fixture.owners[0], roles: [Role.OWNER] });
    expect(snapshot).toMatchObject({
      holdId: first.holdId,
      aggregateVersion: 1,
      pet: { id: fixture.pets[0], name: 'V50 pet 0' },
      service: { id: fixture.serviceId },
    });
    expect(new Date(snapshot.serverNow).getTime()).toBeGreaterThan(0);
    expect(snapshot).not.toHaveProperty('ownerId');
    await expect(read.readForActor(first.holdId, { sub: randomUUID(), roles: [Role.OWNER] }))
      .rejects.toMatchObject({ status: 404, response: { code: 'HOLD_NOT_FOUND' } });
    await expect(read.readForActor(randomUUID(), { sub: fixture.owners[0], roles: [Role.OWNER] }))
      .rejects.toMatchObject({ status: 404, response: { code: 'HOLD_NOT_FOUND' } });
  });

  it('allows exactly one logical success across 100 requests and restores pool/invariants', async () => {
    const fixture = await seedFixture(database, 100);
    const baseline = database.poolStats().waitingCount;
    const settled = await Promise.allSettled(fixture.owners.map((ownerId, index) =>
      creation.createLocalHold(command(fixture, ownerId, fixture.pets[index], randomUUID())),
    ));
    const successes = settled.filter((item) => item.status === 'fulfilled');
    const errors = settled.filter((item): item is PromiseRejectedResult => item.status === 'rejected')
      .map((item) => item.reason as DomainException);
    expect(successes).toHaveLength(1);
    expect(errors).toHaveLength(99);
    expect(errors.every((error) => {
      const response = error.getResponse() as { code?: string };
      return ['SLOT_LOCKED_RETRY', 'SLOT_ALREADY_TAKEN', 'SLOT_VERSION_STALE'].includes(response.code ?? '');
    })).toBe(true);

    const invariant = await database.query<{ active: string; held_count: number; effects: string; audits: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM booking_schema.booking_holds WHERE slot_id = $1::uuid AND state <> ALL(ARRAY['EXPIRED','RELEASED','SLA_BREACHED'])) AS active,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $1::uuid) AS held_count,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id IN (SELECT id FROM booking_schema.booking_holds WHERE slot_id = $1::uuid) AND event_type = 'booking.hold.created.v1') AS effects,
        (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id IN (SELECT id FROM booking_schema.booking_holds WHERE slot_id = $1::uuid) AND action = 'booking.hold.created') AS audits
    `, [fixture.slotId]);
    expect(invariant.rows[0]).toEqual({ active: '1', held_count: 1, effects: '1', audits: '1' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(database.poolStats().waitingCount).toBe(baseline);
    expect(database.poolStats().inUseCount).toBe(0);
  });
});

function command(fixture: Awaited<ReturnType<typeof seedFixture>>, ownerId: string, petId: string, idempotencyKey: string) {
  return { slotId: fixture.slotId, ownerId, petId, idempotencyKey, correlationId: randomUUID(), expectedSlotVersion: 1, serviceId: fixture.serviceId, doctorId: null };
}

async function seedFixture(database: DatabaseService, count: number) {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  const owners = Array.from({ length: count }, () => randomUUID());
  const pets = Array.from({ length: count }, () => randomUUID());
  for (let index = 0; index < count; index += 1) {
    await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [owners[index]]);
    await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species, external_patient_id) VALUES ($1::uuid, $2::uuid, $3, 'DOG', $4)`, [pets[index], owners[index], `V50 pet ${index}`, `v50-patient-${index}`]);
  }
  const clinic = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name, public_name, mis_type) VALUES ('V50 LLC', 'V50 clinic', 'VETMANAGER') RETURNING id`);
  const location = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id, address) VALUES ($1::uuid, 'V50 address') RETURNING id`, [clinic.rows[0].id]);
  const service = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services (clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, 'V50', 'V50 service', 30) RETURNING id`, [location.rows[0].id]);
  const slot = await database.query<{ id: string }>(`INSERT INTO clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, ends_at, capacity, integration_mode) VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 'LEVEL_A') RETURNING id`, [location.rows[0].id, service.rows[0].id]);
  return { owners, pets, serviceId: service.rows[0].id, slotId: slot.rows[0].id };
}
