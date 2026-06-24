import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { AlternativeSlotService } from '../src/booking-core/alternative-slot.service';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { DatabaseService } from '../src/database/database.service';
import { TraceContext } from '../src/observability/trace-context.context';

jest.setTimeout(30000);

describe('Level-C alternative slot', () => {
  const database = new DatabaseService();
  const service = new AlternativeSlotService(database, new ClinicEmployeeAccessService(), new TraceContext());

  afterAll(() => database.onModuleDestroy());

  it('confirms the alternative and balances both counters', async () => {
    const fixture = await fixtureFor(database);
    const employee = {
      sub: fixture.employeeId,
      roles: [Role.CLINIC_RECEPTIONIST],
      clinicIds: [fixture.clinicId],
      locationIds: [fixture.locationId],
    };
    await service.proposeAlternativeSlot(fixture.holdId, fixture.altSlotId, employee, {
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    const version = await database.query<{ version: number }>('SELECT version FROM booking_schema.booking_holds WHERE id=$1::uuid', [fixture.holdId]);
    const result = await service.acceptAlternativeSlot(fixture.holdId, fixture.ownerId, {
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
      expectedVersion: version.rows[0].version,
    });
    expect(result.state).toBe('CONFIRMED');
    expect(result.appointmentId).toBeTruthy();

    const state = await database.query<{ hold: string; sourceHeld: number; altHeld: number; altBooked: number; appointments: string }>(`
      SELECT
        (SELECT state FROM booking_schema.booking_holds WHERE id=$1::uuid) AS hold,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$2::uuid) AS "sourceHeld",
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$3::uuid) AS "altHeld",
        (SELECT booked_count FROM clinic_schema.appointment_slots WHERE id=$3::uuid) AS "altBooked",
        (SELECT count(*)::text FROM booking_schema.appointments WHERE hold_id=$1::uuid) AS appointments
    `, [fixture.holdId, fixture.sourceSlotId, fixture.altSlotId]);
    expect(state.rows[0]).toMatchObject({ hold: 'CONFIRMED', sourceHeld: 0, altHeld: 0, altBooked: 1, appointments: '1' });
  });
});

async function fixtureFor(database: DatabaseService) {
  const ownerId = randomUUID();
  const employeeId = randomUUID();
  const petId = randomUUID();
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid), ($2::uuid)', [ownerId, employeeId]);
  await database.query("INSERT INTO pet_schema.pets (id,owner_id,name,species) VALUES ($1::uuid,$2::uuid,'pet','DOG')", [petId, ownerId]);
  const clinic = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinics (legal_name,public_name) VALUES ('Legal','Public') RETURNING id");
  const location = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinic_locations (clinic_id,address) VALUES ($1::uuid,'Address') RETURNING id", [clinic.rows[0].id]);
  await database.query("INSERT INTO clinic_schema.employee_location_memberships (employee_id,clinic_location_id,role) VALUES ($1::uuid,$2::uuid,'CLINIC_RECEPTIONIST')", [employeeId, location.rows[0].id]);
  const service = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinic_services (clinic_location_id,code,display_name,duration_minutes) VALUES ($1::uuid,'VISIT','Visit',30) RETURNING id", [location.rows[0].id]);
  const slots = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,status,integration_mode)
    VALUES
      ($1::uuid,$2::uuid,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '150 minutes',1,1,'LOCKED_BY_HOLD','LEVEL_C'),
      ($1::uuid,$2::uuid,clock_timestamp()+interval '3 hours',clock_timestamp()+interval '210 minutes',1,0,'AVAILABLE','LEVEL_C')
    RETURNING id
  `, [location.rows[0].id, service.rows[0].id]);
  const hold = await database.query<{ id: string }>(`
    INSERT INTO booking_schema.booking_holds (slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at)
    VALUES ($1::uuid,$2::uuid,$3::uuid,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '20 minutes',clock_timestamp()+interval '15 minutes')
    RETURNING id
  `, [slots.rows[0].id, ownerId, petId]);
  return { clinicId: clinic.rows[0].id, locationId: location.rows[0].id, ownerId, employeeId, holdId: hold.rows[0].id, sourceSlotId: slots.rows[0].id, altSlotId: slots.rows[1].id };
}
