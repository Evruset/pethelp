import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { ClinicAvailableSlotsService } from '../src/booking-core/clinic-available-slots.service';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { DatabaseService } from '../src/database/database.service';

jest.setTimeout(30000);

describe('ClinicAvailableSlotsService', () => {
  const database = new DatabaseService();
  const service = new ClinicAvailableSlotsService(database, new ClinicEmployeeAccessService());

  afterAll(() => database.onModuleDestroy());

  it('returns only available slots in the employee scoped location', async () => {
    const fixture = await createFixture(database);
    const result = await service.list({
      clinicId: fixture.clinicId,
      locationId: fixture.locationId,
      employee: fixture.employee,
      excludedSlotId: fixture.excludedSlotId,
      limit: 50,
    });

    expect(result.items.map((slot) => slot.id)).toEqual([fixture.availableSlotId]);
    expect(Number.isNaN(Date.parse(result.serverNow))).toBe(false);
  });

  it('denies a location that is outside the JWT scope', async () => {
    const fixture = await createFixture(database);
    await expect(service.list({
      clinicId: fixture.clinicId,
      locationId: fixture.locationId,
      employee: { ...fixture.employee, locationIds: [randomUUID()] },
      limit: 50,
    })).rejects.toMatchObject({ response: { code: 'CLINIC_SCOPE_MISMATCH' }, status: 403 });
  });
});

async function createFixture(database: DatabaseService) {
  const employeeId = randomUUID();
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE identity_schema.users CASCADE');
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [employeeId]);
  const clinic = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinics (legal_name,public_name) VALUES ('Slots LLC','Slots') RETURNING id");
  const location = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinic_locations (clinic_id,address) VALUES ($1::uuid,'Slots address') RETURNING id", [clinic.rows[0].id]);
  await database.query("INSERT INTO clinic_schema.employee_location_memberships (employee_id,clinic_location_id,role) VALUES ($1::uuid,$2::uuid,'CLINIC_RECEPTIONIST')", [employeeId, location.rows[0].id]);
  const slots = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (clinic_location_id,starts_at,ends_at,capacity,status,integration_mode)
    VALUES
      ($1::uuid,clock_timestamp()+interval '3 hours',clock_timestamp()+interval '210 minutes',1,'AVAILABLE','LEVEL_C'),
      ($1::uuid,clock_timestamp()+interval '4 hours',clock_timestamp()+interval '270 minutes',1,'BOOKED','LEVEL_C')
    RETURNING id
  `, [location.rows[0].id]);
  return {
    clinicId: clinic.rows[0].id,
    locationId: location.rows[0].id,
    availableSlotId: slots.rows[0].id,
    excludedSlotId: randomUUID(),
    employee: {
      sub: employeeId,
      roles: [Role.CLINIC_RECEPTIONIST],
      clinicIds: [clinic.rows[0].id],
      locationIds: [location.rows[0].id],
    },
  };
}
