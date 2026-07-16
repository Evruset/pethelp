import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { AlternativeSlotService } from '../src/booking-core/alternative-slot.service';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { OwnerAlternativeAcceptanceService } from '../src/booking-core/owner-alternative-acceptance.service';
import { OwnerAlternativeSnapshotService } from '../src/booking-core/owner-alternative-snapshot.service';
import { DatabaseService } from '../src/database/database.service';
import { TraceContext } from '../src/observability/trace-context.context';

jest.setTimeout(60_000);

describe('V50 owner alternative proposal resolution (PostgreSQL)', () => {
  const db = new DatabaseService();
  const trace = new TraceContext();
  const alternatives = new AlternativeSlotService(db, new ClinicEmployeeAccessService(), trace);
  const resolution = new OwnerAlternativeAcceptanceService(alternatives, db);
  const snapshots = new OwnerAlternativeSnapshotService(db);

  afterAll(async () => db.onModuleDestroy());

  it('returns an owner-only authoritative proposal snapshot', async () => {
    const f = await fixture(db, alternatives, trace);
    await expect(snapshots.read(f.hold, f.owner)).resolves.toMatchObject({
      holdId: f.hold, swapGroupId: f.proposal, version: 2,
      originalSlot: { id: f.source }, alternativeSlot: { id: f.proposed },
    });
    await expect(snapshots.read(f.hold, randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it('accepts exactly once, binds replay payload, and preserves proposed capacity', async () => {
    const f = await fixture(db, alternatives, trace);
    const key = randomUUID();
    const command = { expectedVersion: 2, idempotencyKey: key, correlationId: randomUUID() };
    const first = await resolution.resolve(f.proposal, f.owner, 'ACCEPT', command);
    const replay = await resolution.resolve(f.proposal, f.owner, 'ACCEPT', command);
    expect(replay).toEqual(first);
    await expect(resolution.resolve(f.proposal, f.owner, 'ACCEPT', { ...command, expectedVersion: 3 }))
      .rejects.toMatchObject({ status: 409 });
    expect(await state(db, f)).toMatchObject({ state: 'MIS_HELD', slot_id: f.proposed, source_held: 0, proposed_held: 1, audits: '1', events: '1' });
  });

  it('declines by releasing only proposed capacity and preserving truthful source state', async () => {
    const f = await fixture(db, alternatives, trace);
    const result = await resolution.resolve(f.proposal, f.owner, 'DECLINE', command());
    expect(result).toMatchObject({ decision: 'DECLINE', state: 'MANUAL_CONFIRM_PENDING', slotId: f.source, aggregateVersion: 3 });
    expect(await state(db, f)).toMatchObject({ state: 'MANUAL_CONFIRM_PENDING', slot_id: f.source, source_held: 1, proposed_held: 0, audits: '1', events: '1' });
  });

  it('normalizes foreign/wrong proposals and rejects stale and expired commands', async () => {
    const f = await fixture(db, alternatives, trace);
    await expect(resolution.resolve(f.proposal, randomUUID(), 'ACCEPT', command())).rejects.toMatchObject({ status: 404 });
    await expect(resolution.resolve(randomUUID(), f.owner, 'ACCEPT', command())).rejects.toMatchObject({ status: 404 });
    await expect(resolution.resolve(f.proposal, f.owner, 'ACCEPT', { ...command(), expectedVersion: 1 })).rejects.toMatchObject({ status: 409 });
    await db.query(`UPDATE booking_schema.alternative_swap_groups SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1::uuid`, [f.proposal]);
    await expect(resolution.resolve(f.proposal, f.owner, 'ACCEPT', command())).rejects.toMatchObject({ status: 410 });
  });

  it('rolls back counters and state when the outbox write fails', async () => {
    const f = await fixture(db, alternatives, trace);
    await db.query(`CREATE OR REPLACE FUNCTION booking_schema.v50_fail_alt_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='booking.alternative.accepted.v1' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$`);
    await db.query(`CREATE TRIGGER v50_fail_alt_outbox BEFORE INSERT ON booking_schema.outbox_events FOR EACH ROW EXECUTE FUNCTION booking_schema.v50_fail_alt_outbox()`);
    try {
      await expect(resolution.resolve(f.proposal, f.owner, 'ACCEPT', command())).rejects.toBeDefined();
      expect(await state(db, f)).toMatchObject({ state: 'ALTERNATIVE_PENDING', source_held: 1, proposed_held: 1, audits: '0', events: '0' });
    } finally {
      await db.query('DROP TRIGGER IF EXISTS v50_fail_alt_outbox ON booking_schema.outbox_events');
      await db.query('DROP FUNCTION IF EXISTS booking_schema.v50_fail_alt_outbox()');
    }
  });

  it('controls 20 accepts and a 10v10 accept/decline race without duplicate effects or 5xx', async () => {
    const f = await fixture(db, alternatives, trace);
    const before = db.poolStats();
    const twenty = await Promise.allSettled(Array.from({ length: 20 }, () => resolution.resolve(f.proposal, f.owner, 'ACCEPT', command())));
    expect(twenty.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await state(db, f)).toMatchObject({ source_held: 0, proposed_held: 1, audits: '1', events: '1' });

    const race = await fixture(db, alternatives, trace);
    const settled = await Promise.allSettled([
      ...Array.from({ length: 10 }, () => resolution.resolve(race.proposal, race.owner, 'ACCEPT', command())),
      ...Array.from({ length: 10 }, () => resolution.resolve(race.proposal, race.owner, 'DECLINE', command())),
    ]);
    expect(settled.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const final = await state(db, race);
    expect(Number(final.source_held) + Number(final.proposed_held)).toBe(1);
    expect(final.audits).toBe('1'); expect(final.events).toBe('1');
    expect(settled.filter((x) => x.status === 'rejected').every((x: any) => (x.reason?.status ?? 409) < 500)).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));
    const after = db.poolStats();
    expect(after.waitingCount).toBe(0);
    expect(after.inUseCount).toBe(0);
    expect(after.totalCount).toBeGreaterThanOrEqual(before.totalCount);
  });
});

const command = () => ({ expectedVersion: 2, idempotencyKey: randomUUID(), correlationId: randomUUID() });

async function fixture(db: DatabaseService, alternatives: AlternativeSlotService, trace: TraceContext) {
  await db.query('TRUNCATE clinic_schema.clinics CASCADE');
  await db.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await db.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  const owner = randomUUID(), employee = randomUUID(), pet = randomUUID();
  await db.query('INSERT INTO identity_schema.users(id) VALUES($1::uuid),($2::uuid)', [owner, employee]);
  await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1::uuid,$2::uuid,'Alt pet','DOG')`, [pet, owner]);
  const clinic = (await db.query<{ id: string }>(`INSERT INTO clinic_schema.clinics(legal_name,public_name) VALUES('Alt LLC','Alt') RETURNING id`)).rows[0].id;
  const location = (await db.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations(clinic_id,address) VALUES($1::uuid,'Alt address') RETURNING id`, [clinic])).rows[0].id;
  await db.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES($1::uuid,$2::uuid,'CLINIC_RECEPTIONIST')`, [employee, location]);
  const service = (await db.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services(clinic_location_id,code,display_name,duration_minutes) VALUES($1::uuid,'ALT','Alt',30) RETURNING id`, [location])).rows[0].id;
  const source = (await db.query<{ id: string }>(`INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,status,integration_mode) VALUES($1::uuid,$2::uuid,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '150 min',1,1,'LOCKED_BY_HOLD','LEVEL_C') RETURNING id`, [location, service])).rows[0].id;
  const proposed = (await db.query<{ id: string }>(`INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode) VALUES($1::uuid,$2::uuid,clock_timestamp()+interval '3 hours',clock_timestamp()+interval '210 min',1,'AVAILABLE','LEVEL_C') RETURNING id`, [location, service])).rows[0].id;
  const hold = (await db.query<{ id: string }>(`INSERT INTO booking_schema.booking_holds(slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at) VALUES($1::uuid,$2::uuid,$3::uuid,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '16 min',clock_timestamp()+interval '15 min') RETURNING id`, [source, owner, pet])).rows[0].id;
  const proposal = await trace.run({ correlationId: randomUUID(), userId: employee }, () => alternatives.proposeAlternativeSlot(hold, proposed, { sub: employee, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [location] }, { expectedVersion: 1, idempotencyKey: randomUUID() }));
  return { owner, source, proposed, hold, proposal: proposal.swapGroupId };
}

async function state(db: DatabaseService, f: { hold: string; source: string; proposed: string }) {
  return (await db.query<any>(`SELECT h.state,h.slot_id::text,(SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$2::uuid) source_held,(SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$3::uuid) proposed_held,(SELECT count(*)::text FROM audit_schema.audit_log WHERE aggregate_id=$1::uuid AND action IN ('BOOKING_ALTERNATIVE_ACCEPTED','BOOKING_ALTERNATIVE_DECLINED')) audits,(SELECT count(*)::text FROM booking_schema.outbox_events WHERE aggregate_id=$1::uuid AND event_type IN ('booking.alternative.accepted.v1','booking.alternative.declined.v1')) events FROM booking_schema.booking_holds h WHERE h.id=$1::uuid`, [f.hold, f.source, f.proposed])).rows[0];
}
