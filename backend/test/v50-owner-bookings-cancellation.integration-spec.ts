import { randomUUID } from 'node:crypto';
import { OwnerAppointmentsService } from '../src/auth/owner-appointments.service';
import { Role } from '../src/auth/auth.types';
import { BookingSecurityService } from '../src/booking-core/booking-security.service';
import { DomainException } from '../src/common/domain-error';
import { DatabaseService } from '../src/database/database.service';

jest.setTimeout(60_000);

describe('V50 owner bookings and cancellation (real PostgreSQL)', () => {
  const database = new DatabaseService();
  const bookings = new OwnerAppointmentsService(database);
  const security = new BookingSecurityService(database, {} as never);
  afterAll(async () => database.onModuleDestroy());

  it('isolates owners and returns stable server-classified pages with pet filtering', async () => {
    const fixture = await seed(database);
    const owner = { sub: fixture.owner, roles: [Role.OWNER] };
    const first = await bookings.listV50(owner, { limit: 2 });
    expect(new Date(first.serverNow).getTime()).toBeGreaterThan(0);
    expect([...first.requiresAction, ...first.active, ...first.history]).toHaveLength(2);
    expect(first.requiresAction).toHaveLength(1);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await bookings.listV50(owner, { limit: 2, cursor: first.nextCursor! });
    const ids = [...first.requiresAction, ...first.active, ...first.history, ...second.requiresAction, ...second.active, ...second.history].map((row) => row.holdId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(fixture.foreignHold);
    const petPage = await bookings.listV50(owner, { limit: 20, petId: fixture.pet });
    expect([...petPage.requiresAction, ...petPage.active, ...petPage.history].every((row) => row.pet.id === fixture.pet)).toBe(true);

    const bulkPet = randomUUID();
    await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'Массовый','DOG')`, [bulkPet, fixture.owner]);
    await database.query(`
      WITH slots AS (
        INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,booked_count,integration_mode)
        SELECT s.clinic_location_id,s.service_id,clock_timestamp()-(g||' hours')::interval,
               clock_timestamp()-((g-1)||' hours')::interval,1,0,0,'LEVEL_C'
        FROM clinic_schema.appointment_slots s CROSS JOIN generate_series(10,1014) g
        WHERE s.id=$1::uuid RETURNING id
      ) INSERT INTO booking_schema.booking_holds(slot_id,owner_id,pet_id,state,expires_at)
        SELECT id,$2,$3,'RELEASED',clock_timestamp()-interval '1 day' FROM slots
    `, [fixture.localSlot, fixture.owner, bulkPet]);
    const filteredBeyondCap = await bookings.listV50(owner, { limit: 20, petId: fixture.pet });
    expect([...filteredBeyondCap.requiresAction, ...filteredBeyondCap.active, ...filteredBeyondCap.history].every((row) => row.pet.id === fixture.pet)).toBe(true);
    const thousand = await bookings.listV50(owner, { limit: 1000 });
    expect([...thousand.requiresAction, ...thousand.active, ...thousand.history]).toHaveLength(1000);
    expect(thousand.nextCursor).toEqual(expect.any(String));
    const beyondThousand = await bookings.listV50(owner, { limit: 20, cursor: thousand.nextCursor! });
    expect([...beyondThousand.requiresAction, ...beyondThousand.active, ...beyondThousand.history].length).toBeGreaterThan(0);

    const detail = await bookings.read(owner, fixture.localHold);
    expect(detail).toMatchObject({ holdId: fixture.localHold, cancellation: { canCancel: true, aggregateVersion: 1 } });
    expect(detail?.timeline.every((event) => !/payload|correlation|stack|mis response/i.test(JSON.stringify(event)))).toBe(true);
    await expect(bookings.read(owner, fixture.foreignHold)).resolves.toBeUndefined();
    await expect(bookings.read(owner, randomUUID())).resolves.toBeUndefined();

    await database.query(`UPDATE booking_schema.booking_holds SET state='MIS_HELD' WHERE id=$1`, [fixture.localHold]);
    const mis = await bookings.read(owner, fixture.localHold);
    expect(mis).toMatchObject({
      actions: { canCancel: true },
      cancellation: { canCancel: true, cancellationPolicyCode: 'CLINIC_CONFIRMATION_REQUIRED_V1' },
    });
  });

  it('releases a local hold once with payload-bound idempotency and version fencing', async () => {
    const fixture = await seed(database);
    const actor = { sub: fixture.owner, roles: [Role.OWNER] };
    const key = randomUUID();
    const correlationId = randomUUID();
    const first = await security.releaseHold({ holdId: fixture.localHold, actor, idempotencyKey: key, correlationId, expectedVersion: 1, reasonCode: 'OWNER_PLANS_CHANGED', normalizeOwnerNotFound: true });
    const replay = await security.releaseHold({ holdId: fixture.localHold, actor, idempotencyKey: key, correlationId: randomUUID(), expectedVersion: 1, reasonCode: 'OWNER_PLANS_CHANGED', normalizeOwnerNotFound: true });
    expect(replay).toEqual(first);
    await expect(security.releaseHold({ holdId: fixture.localHold, actor, idempotencyKey: key, correlationId, expectedVersion: 2, reasonCode: 'OTHER', normalizeOwnerNotFound: true }))
      .rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' } });
    const invariant = await cancellationInvariant(database, fixture.localHold, fixture.localSlot);
    expect(invariant).toEqual({ state: 'RELEASED', held_count: 0, booked_count: 0, audits: '1', effects: '1' });
  });

  it('requests confirmed cancellation without freeing booked capacity and denies stale/foreign/terminal', async () => {
    const fixture = await seed(database);
    const actor = { sub: fixture.owner, roles: [Role.OWNER] };
    await expect(security.releaseHold({ holdId: fixture.confirmedHold, actor, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 99, normalizeOwnerNotFound: true }))
      .rejects.toMatchObject({ status: 409, response: { code: 'BOOKING_VERSION_STALE' } });
    const result = await security.releaseHold({ holdId: fixture.confirmedHold, actor, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1, normalizeOwnerNotFound: true });
    expect(result.state).toBe('CANCELLATION_REQUESTED');
    const confirmed = await cancellationInvariant(database, fixture.confirmedHold, fixture.confirmedSlot);
    expect(confirmed).toEqual({ state: 'CANCELLATION_REQUESTED', held_count: 0, booked_count: 1, audits: '1', effects: '1' });
    await expect(security.releaseHold({ holdId: fixture.foreignHold, actor, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1, normalizeOwnerNotFound: true }))
      .rejects.toMatchObject({ status: 404, response: { code: 'HOLD_NOT_FOUND' } });
    await expect(security.releaseHold({ holdId: fixture.expiredHold, actor, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1, normalizeOwnerNotFound: true }))
      .rejects.toMatchObject({ status: 422, response: { code: 'INVALID_STATE_TRANSITION' } });
  });

  it('allows one logical transition across 20 concurrent cancellation requests and restores the pool', async () => {
    const fixture = await seed(database);
    const actor = { sub: fixture.owner, roles: [Role.OWNER] };
    const baseline = database.poolStats().waitingCount;
    const settled = await Promise.allSettled(Array.from({ length: 20 }, () => security.releaseHold({
      holdId: fixture.localHold, actor, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1, normalizeOwnerNotFound: true,
    })));
    const success = settled.filter((item) => item.status === 'fulfilled');
    const errors = settled.filter((item): item is PromiseRejectedResult => item.status === 'rejected').map((item) => item.reason as DomainException);
    expect(success).toHaveLength(1);
    expect(errors).toHaveLength(19);
    expect(errors.every((error) => [409, 422].includes(error.getStatus()))).toBe(true);
    expect(await cancellationInvariant(database, fixture.localHold, fixture.localSlot)).toEqual({ state: 'RELEASED', held_count: 0, booked_count: 0, audits: '1', effects: '1' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(database.poolStats().waitingCount).toBe(baseline);
    expect(database.poolStats().inUseCount).toBe(0);
  });
});

async function seed(database: DatabaseService) {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  const owner = randomUUID(), foreign = randomUUID(), pet = randomUUID(), foreignPet = randomUUID();
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid),($2::uuid)', [owner, foreign]);
  await database.query(`INSERT INTO pet_schema.pets (id,owner_id,name,species) VALUES ($1,$2,'Барсик','DOG'),($3,$4,'Чужой','CAT')`, [pet, owner, foreignPet, foreign]);
  const clinic = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name,public_name) VALUES ('V50','V50 clinic') RETURNING id`)).rows[0].id;
  const location = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id,address) VALUES ($1,'V50 address') RETURNING id`, [clinic])).rows[0].id;
  const service = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services (clinic_location_id,code,display_name,duration_minutes) VALUES ($1,'V50','Приём',30) RETURNING id`, [location])).rows[0].id;
  const slot = async (hours: number, held: number, booked: number) => (await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,booked_count,integration_mode)
    VALUES ($1,$2,clock_timestamp()+($3*interval '1 hour'),clock_timestamp()+(($3+1)*interval '1 hour'),1,$4,$5,'LEVEL_C') RETURNING id
  `, [location, service, hours, held, booked])).rows[0].id;
  const localSlot = await slot(5, 1, 0), confirmedSlot = await slot(6, 0, 1), actionSlot = await slot(4, 1, 0), historySlot = await slot(-3, 0, 0), foreignSlot = await slot(8, 1, 0), expiredSlot = await slot(7, 0, 0);
  const hold = async (slotId: string, ownerId: string, petId: string, state: string, alternative = false) => (await database.query<{ id: string }>(`
    INSERT INTO booking_schema.booking_holds (slot_id,owner_id,pet_id,state,expires_at,alternative_expires_at)
    VALUES ($1,$2,$3,$4,clock_timestamp()+interval '1 day',CASE WHEN $5 THEN clock_timestamp()+interval '1 hour' ELSE NULL END) RETURNING id
  `, [slotId, ownerId, petId, state, alternative])).rows[0].id;
  const localHold = await hold(localSlot, owner, pet, 'MANUAL_CONFIRM_PENDING');
  const confirmedHold = await hold(confirmedSlot, owner, pet, 'CONFIRMED');
  const actionHold = await hold(actionSlot, owner, pet, 'ALTERNATIVE_PENDING', true);
  const historyHold = await hold(historySlot, owner, pet, 'RELEASED');
  const foreignHold = await hold(foreignSlot, foreign, foreignPet, 'MANUAL_CONFIRM_PENDING');
  const expiredHold = await hold(expiredSlot, owner, pet, 'EXPIRED');
  return { owner, pet, localSlot, localHold, confirmedSlot, confirmedHold, actionHold, historyHold, foreignHold, expiredHold };
}

async function cancellationInvariant(database: DatabaseService, holdId: string, slotId: string) {
  const row = await database.query<{ state: string; held_count: number; booked_count: number; audits: string; effects: string }>(`
    SELECT h.state,s.held_count,s.booked_count,
      (SELECT count(*)::text FROM audit_schema.audit_log WHERE aggregate_id=h.id AND action IN ('booking.hold.released','booking.cancellation_requested')) audits,
      (SELECT count(*)::text FROM booking_schema.outbox_events WHERE aggregate_id=h.id AND event_type IN ('booking.hold.released.v1','booking.cancellation.requested.v1')) effects
    FROM booking_schema.booking_holds h JOIN clinic_schema.appointment_slots s ON s.id=$2 WHERE h.id=$1
  `, [holdId, slotId]);
  return row.rows[0];
}
