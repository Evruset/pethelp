import { randomUUID } from 'node:crypto';
import { BookingHoldCreationService } from '../src/booking-core/booking-hold-creation.service';
import { BookingHoldReadService } from '../src/booking-core/booking-hold-read.service';
import { BookingRepository } from '../src/booking-core/booking.repository';
import { BookingService } from '../src/booking-core/booking.service';
import { Role } from '../src/auth/auth.types';
import { DomainException } from '../src/common/domain-error';
import { DatabaseService } from '../src/database/database.service';

jest.setTimeout(45_000);

describe('V50 owner booking hold/status (real PostgreSQL)', () => {
  const database = new DatabaseService();
  const creation = new BookingHoldCreationService(database, new BookingRepository());
  const clinicAccess = { assertBookingHoldReadAccess: jest.fn() } as never;
  const read = new BookingHoldReadService(database, clinicAccess);
  const booking = new BookingService(database, new BookingRepository());

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

  it('expires a pending hold exactly once and never expires a confirmed hold', async () => {
    const fixture = await seedFixture(database, 1);
    const created = await creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()));
    await database.query(`UPDATE booking_schema.booking_holds SET expires_at = clock_timestamp() - interval '1 second' WHERE id = $1::uuid`, [created.holdId]);

    await expect(booking.expireHolds()).resolves.toEqual({ expired: 1 });
    await expect(booking.expireHolds()).resolves.toEqual({ expired: 0 });
    const expired = await database.query<{ state: string; held_count: number; events: string; audits: string }>(`
      SELECT h.state, s.held_count,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = h.id AND event_type = 'booking.hold.expired.v1') AS events,
        (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id = h.id AND action = 'booking.hold.expired') AS audits
      FROM booking_schema.booking_holds h JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      WHERE h.id = $1::uuid
    `, [created.holdId]);
    expect(expired.rows[0]).toEqual({ state: 'EXPIRED', held_count: 0, events: '1', audits: '1' });

    await database.query(`UPDATE booking_schema.booking_holds SET state = 'CONFIRMED', expires_at = clock_timestamp() - interval '1 second' WHERE id = $1::uuid`, [created.holdId]);
    await expect(booking.expireHolds()).resolves.toEqual({ expired: 0 });
    const terminal = await database.query<{ state: string }>('SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid', [created.holdId]);
    expect(terminal.rows[0].state).toBe('CONFIRMED');
  });

  it('rejects archived/incompatible/stale authority and rolls back expiration drift', async () => {
    let fixture = await seedFixture(database, 1);
    await database.query('UPDATE pet_schema.pets SET archived_at = clock_timestamp() WHERE id = $1::uuid', [fixture.pets[0]]);
    await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
      .rejects.toMatchObject({ status: 422, response: { code: 'PET_OWNERSHIP_MISMATCH' } });

    fixture = await seedFixture(database, 1);
    await database.query(`UPDATE clinic_schema.clinic_services SET supported_species = ARRAY['CAT']::text[] WHERE id = $1::uuid`, [fixture.serviceId]);
    await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
      .rejects.toMatchObject({ status: 422, response: { code: 'SERVICE_NOT_AVAILABLE' } });

    fixture = await seedFixture(database, 1);
    await database.query(`UPDATE clinic_schema.appointment_slots SET last_freshness_sync = clock_timestamp() - interval '16 minutes' WHERE id = $1::uuid`, [fixture.slotId]);
    await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
      .rejects.toMatchObject({ status: 409, response: { code: 'SLOT_VERSION_STALE' } });

    fixture = await seedFixture(database, 1);
    const specialty = await database.query<{ id: string }>(`SELECT id FROM catalog_schema.specialties ORDER BY id LIMIT 1`);
    const doctor = await database.query<{ id: string }>(`
      INSERT INTO catalog_schema.doctors (clinic_location_id, full_name, specialty_id, active, public_booking_enabled)
      VALUES ($1::uuid, 'Inactive V50 doctor', $2::uuid, false, false) RETURNING id
    `, [fixture.locationId, specialty.rows[0].id]);
    await database.query('UPDATE clinic_schema.appointment_slots SET doctor_id = $2::uuid WHERE id = $1::uuid', [fixture.slotId, doctor.rows[0].id]);
    await expect(creation.createLocalHold({
      ...command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()),
      doctorId: doctor.rows[0].id,
    })).rejects.toMatchObject({ status: 422, response: { code: 'DOCTOR_NOT_AVAILABLE' } });

    fixture = await seedFixture(database, 1);
    const created = await creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()));
    await database.query(`UPDATE booking_schema.booking_holds SET expires_at = clock_timestamp() - interval '1 second' WHERE id = $1::uuid`, [created.holdId]);
    await database.query('UPDATE clinic_schema.appointment_slots SET held_count = 0 WHERE id = $1::uuid', [fixture.slotId]);
    await expect(booking.expireHolds()).rejects.toMatchObject({ status: 503, response: { code: 'BOOKING_TEMPORARILY_UNAVAILABLE' } });
    const rolledBack = await database.query<{ state: string; effects: string }>(`
      SELECT state,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = $1::uuid AND event_type = 'booking.hold.expired.v1') AS effects
      FROM booking_schema.booking_holds WHERE id = $1::uuid
    `, [created.holdId]);
    expect(rolledBack.rows[0]).toEqual({ state: 'MIS_RESERVATION_PENDING', effects: '0' });
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
  return { owners, pets, locationId: location.rows[0].id, serviceId: service.rows[0].id, slotId: slot.rows[0].id };
}
