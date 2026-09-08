import { randomUUID } from 'node:crypto';
import { resetBookingPersistence } from './helpers/booking-test-reset';
import { Role } from '../src/auth/auth.types';
import { BookingEventReplayService } from '../src/booking-core/booking-event-replay.service';
import { DatabaseService } from '../src/database/database.service';

describe('T060 public booking history (real PostgreSQL)', () => {
  const database = new DatabaseService();
  const clinicAccess = { assertBookingReplayReadAccess: jest.fn() };
  const service = new BookingEventReplayService(database, clinicAccess as never);

  beforeEach(async () => {
    await resetBookingPersistence(database);
    await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  });
  afterAll(() => database.onModuleDestroy());

  it('pages same-timestamp events deterministically and hides raw evidence', async () => {
    const fixture = await seed(database);
    const owner = { sub: fixture.ownerId, roles: [Role.OWNER] } as never;
    const first = await service.history(fixture.holdId, owner, 1);
    const second = await service.history(fixture.holdId, owner, 1, first.nextCursor!);
    expect([...first.events, ...second.events].map((event) => event.eventType)).toEqual(['BOOKING_REQUESTED', 'BOOKING_CONFIRMED']);
    expect(first.events[0].eventId < second.events[0].eventId).toBe(true);
    expect(JSON.stringify([first, second])).not.toMatch(/payload|actorId|correlationId|MANUAL_CONFIRM_PENDING/);
    await expect(service.history(fixture.holdId, { sub: randomUUID(), roles: [Role.OWNER] } as never))
      .rejects.toMatchObject({ status: 404 });
  });
});

async function seed(database: DatabaseService) {
  const ownerId = randomUUID(); const petId = randomUUID();
  await database.query('INSERT INTO identity_schema.users(id) VALUES($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1::uuid,$2::uuid,'History pet','DOG')`, [petId, ownerId]);
  const clinicId = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics(legal_name,public_name) VALUES('History','History') RETURNING id`)).rows[0].id;
  const locationId = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations(clinic_id,address) VALUES($1::uuid,'History') RETURNING id`, [clinicId])).rows[0].id;
  const serviceId = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services(clinic_location_id,code,display_name,duration_minutes) VALUES($1::uuid,'HISTORY','History',30) RETURNING id`, [locationId])).rows[0].id;
  const slotId = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,integration_mode) VALUES($1::uuid,$2::uuid,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '90 minutes',1,'LEVEL_C') RETURNING id`, [locationId, serviceId])).rows[0].id;
  const holdId = (await database.query<{ id: string }>(`INSERT INTO booking_schema.booking_holds(slot_id,owner_id,pet_id,state,expires_at) VALUES($1::uuid,$2::uuid,$3::uuid,'CONFIRMED',clock_timestamp()+interval '1 hour') RETURNING id`, [slotId, ownerId, petId])).rows[0].id;
  const at = '2026-08-09T10:00:00.000Z';
  const ids = [randomUUID(), randomUUID()].sort();
  await database.query(`INSERT INTO audit_schema.audit_log(id,occurred_at,actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES
    ($1,$3,'OWNER',$4,'booking.hold.created','booking_hold',$5,$6,'{"token":"secret"}'),
    ($2,$3,'CLINIC_EMPLOYEE','staff-private','booking.confirmed','booking_hold',$5,$6,'{"actorId":"private"}')`,
  [ids[0], ids[1], at, ownerId, holdId, randomUUID()]);
  return { ownerId, holdId };
}
