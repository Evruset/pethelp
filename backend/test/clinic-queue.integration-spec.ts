import { randomUUID } from 'node:crypto';
import { Role, JwtPayload } from '../src/auth/auth.types';
import { BookingSecurityService } from '../src/booking-core/booking-security.service';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { ClinicQueueService } from '../src/booking-core/clinic-queue.service';
import { DatabaseService } from '../src/database/database.service';

jest.setTimeout(30_000);

describe('ClinicQueueService', () => {
  const database = new DatabaseService();
  const access = new ClinicEmployeeAccessService();
  const service = new ClinicQueueService(database, access);
  const bookingSecurity = new BookingSecurityService(database, access);

  afterAll(async () => {
    await database.onModuleDestroy();
  });

  it('returns only the requested Level-C location in strict FIFO order with PostgreSQL server time', async () => {
    const fixture = await createQueueFixture(database);

    const result = await service.listManualConfirmationQueue({
      clinicId: fixture.clinicId,
      locationId: fixture.locationId,
      employee: fixture.employee,
      limit: 50,
    });

    expect(result.clinicId).toBe(fixture.clinicId);
    expect(result.locationId).toBe(fixture.locationId);
    expect(Number.isNaN(Date.parse(result.serverNow))).toBe(false);
    expect(result.items.map((item) => item.holdId)).toEqual([fixture.firstHoldId, fixture.secondHoldId]);
    expect(result.items.map((item) => item.pet.name)).toEqual(['Первый', 'Второй']);
    expect(result.items.every((item) => item.confirmationSlaExpiresAt.length > 0)).toBe(true);
  });

  it('rejects confirmation of a later pending hold until the earlier queue item is resolved', async () => {
    const fixture = await createQueueFixture(database);

    await expect(bookingSecurity.confirmManualHold({
      holdId: fixture.secondHoldId,
      employee: fixture.employee,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    })).rejects.toMatchObject({
      response: { code: 'QUEUE_FIFO_VIOLATION' },
      status: 409,
    });

    await expect(bookingSecurity.confirmManualHold({
      holdId: fixture.firstHoldId,
      employee: fixture.employee,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    })).resolves.toMatchObject({
      holdId: fixture.firstHoldId,
      state: 'CONFIRMED',
    });

    await expect(bookingSecurity.confirmManualHold({
      holdId: fixture.secondHoldId,
      employee: fixture.employee,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    })).resolves.toMatchObject({
      holdId: fixture.secondHoldId,
      state: 'CONFIRMED',
    });
  });

  it('allows the next actionable hold after the queue head SLA has expired', async () => {
    const fixture = await createQueueFixture(database);
    await database.query(`
      UPDATE booking_schema.booking_holds
      SET confirmation_sla_expires_at = clock_timestamp() - interval '1 second'
      WHERE id = $1::uuid
    `, [fixture.firstHoldId]);

    await expect(bookingSecurity.confirmManualHold({
      holdId: fixture.secondHoldId,
      employee: fixture.employee,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    })).resolves.toMatchObject({
      holdId: fixture.secondHoldId,
      state: 'CONFIRMED',
    });
  });

  it('rejects a URL location outside the employee locationIds scope', async () => {
    const fixture = await createQueueFixture(database);
    const employee: JwtPayload = {
      ...fixture.employee,
      locationIds: [randomUUID()],
    };

    await expect(service.listManualConfirmationQueue({
      clinicId: fixture.clinicId,
      locationId: fixture.locationId,
      employee,
      limit: 50,
    })).rejects.toMatchObject({
      response: { code: 'CLINIC_SCOPE_MISMATCH' },
      status: 403,
    });
  });
});

async function createQueueFixture(database: DatabaseService): Promise<{
  clinicId: string;
  locationId: string;
  firstHoldId: string;
  secondHoldId: string;
  employee: JwtPayload;
}> {
  const employeeId = randomUUID();
  const ownerId = randomUUID();

  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid), ($2::uuid)', [employeeId, ownerId]);
  const clinic = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinics (legal_name, public_name)
    VALUES ('Queue LLC', 'Queue clinic')
    RETURNING id
  `);
  const location = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinic_locations (clinic_id, address)
    VALUES ($1::uuid, 'Queue location')
    RETURNING id
  `, [clinic.rows[0].id]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role)
    VALUES ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST')
  `, [employeeId, location.rows[0].id]);
  const service = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinic_services (clinic_location_id, code, display_name, duration_minutes)
    VALUES ($1::uuid, 'QUEUE_VISIT', 'Первичный приём', 30)
    RETURNING id
  `, [location.rows[0].id]);
  const pets = await database.query<{ id: string }>(`
    INSERT INTO pet_schema.pets (owner_id, name, species)
    VALUES ($1::uuid, 'Первый', 'CAT'), ($1::uuid, 'Второй', 'DOG')
    RETURNING id
  `, [ownerId]);
  const slots = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (
      clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode
    ) VALUES
      ($1::uuid, $2::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C'),
      ($1::uuid, $2::uuid, clock_timestamp() + interval '3 hours', clock_timestamp() + interval '210 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C')
    RETURNING id
  `, [location.rows[0].id, service.rows[0].id]);
  const holds = await database.query<{ id: string }>(`
    INSERT INTO booking_schema.booking_holds (
      slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at, state_changed_at
    ) VALUES
      ($1::uuid, $2::uuid, $3::uuid, 'MANUAL_CONFIRM_PENDING', clock_timestamp() + interval '10 minutes', clock_timestamp() + interval '15 minutes', clock_timestamp() - interval '2 minutes'),
      ($4::uuid, $2::uuid, $5::uuid, 'MANUAL_CONFIRM_PENDING', clock_timestamp() + interval '10 minutes', clock_timestamp() + interval '15 minutes', clock_timestamp() - interval '1 minute')
    RETURNING id
  `, [slots.rows[0].id, ownerId, pets.rows[0].id, slots.rows[1].id, ownerId, pets.rows[1].id]);

  return {
    clinicId: clinic.rows[0].id,
    locationId: location.rows[0].id,
    firstHoldId: holds.rows[0].id,
    secondHoldId: holds.rows[1].id,
    employee: {
      sub: employeeId,
      roles: [Role.CLINIC_RECEPTIONIST],
      clinicIds: [clinic.rows[0].id],
      locationIds: [location.rows[0].id],
    },
  };
}
