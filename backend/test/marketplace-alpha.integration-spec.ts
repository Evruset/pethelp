import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { AlternativeSlotService } from '../src/booking-core/alternative-slot.service';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { DatabaseService } from '../src/database/database.service';
import { TraceContext } from '../src/observability/trace-context.context';

jest.setTimeout(30_000);

describe('Marketplace Alpha alternative slots', () => {
  const database = new DatabaseService();
  const trace = new TraceContext();
  const access = new ClinicEmployeeAccessService();
  const service = new AlternativeSlotService(database, access, trace);

  afterAll(async () => {
    await database.onModuleDestroy();
  });

  it('keeps the original slot held until owner accepts and keeps the accepted slot held until payment', async () => {
    const fixture = await createFixture(database);
    const employee = { sub: fixture.employeeId, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [fixture.locationId] };

    await trace.run({ correlationId: randomUUID(), userId: fixture.employeeId }, () =>
      service.proposeAlternativeSlot(fixture.holdId, fixture.alternativeSlotId, employee),
    );

    const beforeAccept = await database.query<{ source_held: number; alternative_held: number }>(`
      SELECT
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $1::uuid) AS source_held,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS alternative_held
    `, [fixture.sourceSlotId, fixture.alternativeSlotId]);
    expect(beforeAccept.rows[0]).toMatchObject({ source_held: 1, alternative_held: 1 });

    const accepted = await trace.run({ correlationId: randomUUID(), userId: fixture.ownerId }, () =>
      service.acceptAlternativeSlot(fixture.holdId, fixture.ownerId),
    );
    expect(accepted).toMatchObject({ state: 'MIS_HELD', slotId: fixture.alternativeSlotId });

    const afterAccept = await database.query<{
      hold_state: string;
      hold_slot_id: string;
      source_held: number;
      source_status: string;
      alternative_held: number;
      alternative_booked: number;
      alternative_status: string;
      appointments: string;
    }>(`
      SELECT
        (SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid) AS hold_state,
        (SELECT slot_id::text FROM booking_schema.booking_holds WHERE id = $1::uuid) AS hold_slot_id,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS source_held,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS source_status,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS alternative_held,
        (SELECT booked_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS alternative_booked,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS alternative_status,
        (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE hold_id = $1::uuid) AS appointments
    `, [fixture.holdId, fixture.sourceSlotId, fixture.alternativeSlotId]);

    expect(afterAccept.rows[0]).toMatchObject({
      hold_state: 'MIS_HELD',
      hold_slot_id: fixture.alternativeSlotId,
      source_held: 0,
      source_status: 'AVAILABLE',
      alternative_held: 1,
      alternative_booked: 0,
      alternative_status: 'LOCKED_BY_HOLD',
      appointments: '0',
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
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Marketplace pet', 'DOG')`, [petId, ownerId]);

  const clinic = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('Marketplace LLC', 'Marketplace') RETURNING id`);
  const location = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id, address) VALUES ($1::uuid, 'Marketplace test location') RETURNING id`, [clinic.rows[0].id]);
  await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role) VALUES ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST')`, [employeeId, location.rows[0].id]);
  const clinicService = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services (clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, 'MARKETPLACE', 'Marketplace visit', 30) RETURNING id`, [location.rows[0].id]);
  const source = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode)
    VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C')
    RETURNING id
  `, [location.rows[0].id, clinicService.rows[0].id]);
  const alternative = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, ends_at, capacity, status, integration_mode)
    VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '3 hours', clock_timestamp() + interval '210 minutes', 1, 'AVAILABLE', 'LEVEL_C')
    RETURNING id
  `, [location.rows[0].id, clinicService.rows[0].id]);
  const hold = await database.query<{ id: string }>(`
    INSERT INTO booking_schema.booking_holds (slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at)
    VALUES ($1::uuid, $2::uuid, $3::uuid, 'MANUAL_CONFIRM_PENDING', clock_timestamp() + interval '16 minutes', clock_timestamp() + interval '15 minutes')
    RETURNING id
  `, [source.rows[0].id, ownerId, petId]);

  return { ownerId, employeeId, locationId: location.rows[0].id, sourceSlotId: source.rows[0].id, alternativeSlotId: alternative.rows[0].id, holdId: hold.rows[0].id };
}
