import { randomUUID } from 'node:crypto';
import { AlternativeSlotService } from '../src/booking-core/alternative-slot.service';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { OwnerAlternativeSnapshotService } from '../src/booking-core/owner-alternative-snapshot.service';
import { Role } from '../src/auth/auth.types';
import { DatabaseService } from '../src/database/database.service';
import { TraceContext } from '../src/observability/trace-context.context';

jest.setTimeout(30_000);

describe('Owner alternative slot snapshot', () => {
  const database = new DatabaseService();
  const trace = new TraceContext();
  const access = new ClinicEmployeeAccessService();
  const alternatives = new AlternativeSlotService(database, access, trace);
  const snapshots = new OwnerAlternativeSnapshotService(database);

  afterAll(async () => {
    await database.onModuleDestroy();
  });

  it('returns only the active proposal owned by the caller and includes server clock', async () => {
    const fixture = await createFixture(database);
    await trace.run({ correlationId: randomUUID(), userId: fixture.employeeId }, () =>
      alternatives.proposeAlternativeSlot(fixture.holdId, fixture.alternativeSlotId, {
        sub: fixture.employeeId,
        roles: [Role.CLINIC_RECEPTIONIST],
        locationIds: [fixture.locationId],
      }, {
        expectedVersion: 1,
        idempotencyKey: randomUUID(),
      }),
    );

    const snapshot = await snapshots.read(fixture.holdId, fixture.ownerId);
    expect(snapshot).toMatchObject({
      holdId: fixture.holdId,
      state: 'ALTERNATIVE_PENDING',
      originalSlot: { id: fixture.sourceSlotId },
      alternativeSlot: { id: fixture.alternativeSlotId },
    });
    expect(Date.parse(snapshot.serverNow)).not.toBeNaN();
    expect(Date.parse(snapshot.expiresAt)).toBeGreaterThan(Date.parse(snapshot.serverNow));

    await expect(snapshots.read(fixture.holdId, randomUUID())).rejects.toMatchObject({
      response: { code: 'HOLD_NOT_FOUND' },
      status: 404,
    });
  });
});

async function createFixture(database: DatabaseService): Promise<{
  ownerId: string;
  employeeId: string;
  locationId: string;
  sourceSlotId: string;
  alternativeSlotId: string;
  holdId: string;
}> {
  const ownerId = randomUUID();
  const employeeId = randomUUID();
  const petId = randomUUID();

  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid), ($2::uuid)', [ownerId, employeeId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Snapshot pet', 'DOG')`, [petId, ownerId]);

  const clinic = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('Snapshot LLC', 'Snapshot') RETURNING id`);
  const location = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id, address) VALUES ($1::uuid, 'Snapshot location') RETURNING id`, [clinic.rows[0].id]);
  await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role) VALUES ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST')`, [employeeId, location.rows[0].id]);
  const service = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services (clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, 'SNAPSHOT', 'Snapshot visit', 30) RETURNING id`, [location.rows[0].id]);
  const source = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode)
    VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C')
    RETURNING id
  `, [location.rows[0].id, service.rows[0].id]);
  const alternative = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, ends_at, capacity, status, integration_mode)
    VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '3 hours', clock_timestamp() + interval '210 minutes', 1, 'AVAILABLE', 'LEVEL_C')
    RETURNING id
  `, [location.rows[0].id, service.rows[0].id]);
  const hold = await database.query<{ id: string }>(`
    INSERT INTO booking_schema.booking_holds (slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at)
    VALUES ($1::uuid, $2::uuid, $3::uuid, 'MANUAL_CONFIRM_PENDING', clock_timestamp() + interval '16 minutes', clock_timestamp() + interval '15 minutes')
    RETURNING id
  `, [source.rows[0].id, ownerId, petId]);

  return {
    ownerId,
    employeeId,
    locationId: location.rows[0].id,
    sourceSlotId: source.rows[0].id,
    alternativeSlotId: alternative.rows[0].id,
    holdId: hold.rows[0].id,
  };
}
