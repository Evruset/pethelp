import { randomUUID } from 'node:crypto';
import { resetBookingPersistence } from './helpers/booking-test-reset';
import { BookingHoldCreationService } from '../src/booking-core/booking-hold-creation.service';
import { BookingHoldReadService } from '../src/booking-core/booking-hold-read.service';
import { BookingRepository } from '../src/booking-core/booking.repository';
import { BookingService } from '../src/booking-core/booking.service';
import { Role } from '../src/auth/auth.types';
import { DomainException } from '../src/common/domain-error';
import { DatabaseService } from '../src/database/database.service';
import { ClinicQueueService } from '../src/booking-core/clinic-queue.service';
import { BookingSecurityService } from '../src/booking-core/booking-security.service';
import { HoldExpirationService } from '../src/workers/hold-expiration.service';

jest.setTimeout(45_000);

describe('V50 owner booking hold/status (real PostgreSQL)', () => {
  const database = new DatabaseService();
  const creation = new BookingHoldCreationService(database, new BookingRepository());
  const clinicAccess = { assertBookingHoldReadAccess: jest.fn(), assertLocationAccess: jest.fn(), assertBookingDecisionCapability: jest.fn(), assertBookingDecisionAccess: jest.fn() } as never;
  const read = new BookingHoldReadService(database, clinicAccess);
  const queueAccess = { assertBookingQueueReadAccess: jest.fn() } as never;
  const queue = new ClinicQueueService(database, queueAccess);
  const booking = new BookingService(database, new BookingRepository());
  const bookingSecurity = new BookingSecurityService(database, clinicAccess);

  beforeAll(() => {
    if (process.env.MVP_SCOPE_PROFILE !== 'PILOT_V1') {
      throw new Error('WAVE1_TEST_REQUIRES_MVP_SCOPE_PROFILE_PILOT_V1');
    }
  });

  afterAll(async () => database.onModuleDestroy());

  it('binds idempotency to the canonical payload and returns an owner-safe snapshot', async () => {
    const fixture = await seedFixture(database, 2);
    const key = randomUUID();
    const input = command(fixture, fixture.owners[0], fixture.pets[0], key);
    await expect(creation.createLocalHold({ ...input, expectedSlotVersion: undefined }))
      .rejects.toMatchObject({ status: 400, response: { code: 'INVALID_REQUEST' } });
    const first = await creation.createLocalHold(input);
    const replay = await creation.createLocalHold(input);
    expect(replay).toEqual(first);

    if (process.env.MVP_SCOPE_PROFILE === 'PILOT_V1') {
      expect(first).toMatchObject({ status: 'PENDING_CONFIRMATION', confirmationMode: 'MANUAL' });
      expect(first).not.toHaveProperty('state');
      expect(first).not.toHaveProperty('displayStatus');
      expect(first.lastUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(first).not.toHaveProperty('appointmentId');
      const persisted = await database.query<{ state: string; held_count: number; appointments: string; mis_effects: string; deadline_seconds: string; payment_effects: string }>(`
        SELECT h.state, s.held_count,
          EXTRACT(EPOCH FROM (h.confirmation_sla_expires_at - h.created_at))::text AS deadline_seconds,
          (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE hold_id = h.id) AS appointments,
          (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = h.id AND event_type = 'mis.reservation.requested.v1') AS mis_effects,
          (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = h.id AND event_type LIKE 'payment.%') AS payment_effects
        FROM booking_schema.booking_holds h JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        WHERE h.id = $1::uuid
      `, [first.holdId]);
      expect(persisted.rows[0]).toMatchObject({ state: 'MANUAL_CONFIRM_PENDING', held_count: 1, appointments: '0', mis_effects: '0', payment_effects: '0' });
      expect(Number(persisted.rows[0].deadline_seconds)).toBeGreaterThanOrEqual(899);
      expect(Number(persisted.rows[0].deadline_seconds)).toBeLessThanOrEqual(901);
      expect(Date.parse(first.expiresAt!) - Date.parse(first.serverNow!)).toBeGreaterThanOrEqual(899_000);
      expect(Date.parse(first.expiresAt!) - Date.parse(first.serverNow!)).toBeLessThanOrEqual(901_000);
      const visible = await queue.listManualConfirmationQueue({
        clinicId: fixture.clinicId,
        locationId: fixture.locationId,
        employee: { sub: randomUUID(), roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [fixture.clinicId] },
        limit: 50,
      });
      expect(visible.items.map((item) => item.holdId)).toEqual([first.holdId]);
    }

    await expect(creation.createLocalHold({ ...input, serviceId: randomUUID() }))
      .rejects.toMatchObject({ status: 409, response: { code: process.env.MVP_SCOPE_PROFILE === 'PILOT_V1' ? 'IDEMPOTENCY_CONFLICT' : 'IDEMPOTENCY_PAYLOAD_CONFLICT' } });
    const afterConflict = await database.query<{ holds: string; held_count: number; effects: string; audits: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM booking_schema.booking_holds WHERE slot_id=$1) holds,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$1) held_count,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id=$2 AND event_type='booking.hold.created.v1') effects,
        (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id=$2 AND action='booking.hold.created') audits
    `, [fixture.slotId, first.holdId]);
    expect(afterConflict.rows[0]).toEqual({ holds: '1', held_count: 1, effects: '1', audits: '1' });
    await expect(creation.createLocalHold({ ...command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()), clinicId: randomUUID() }))
      .rejects.toMatchObject({ status: 404 });
    await expect(creation.createLocalHold({ ...command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()), locationId: randomUUID() }))
      .rejects.toMatchObject({ status: 404 });
    await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[1], randomUUID())))
      .rejects.toMatchObject({ status: 422, response: { code: 'PET_OWNERSHIP_MISMATCH' } });

    const snapshot = await read.readForActor(first.holdId, { sub: fixture.owners[0], roles: [Role.OWNER] });
    expect(snapshot).toMatchObject({
      holdId: first.holdId,
      aggregateVersion: 1,
      ...(process.env.MVP_SCOPE_PROFILE === 'PILOT_V1' ? { statusCode: 'PENDING_CONFIRMATION' } : {}),
      ...(process.env.MVP_SCOPE_PROFILE === 'PILOT_V1'
        ? { confirmationMode: 'MANUAL' }
        : { statusCode: 'MIS_RESERVATION_PENDING', confirmationMode: 'MIS' }),
      pet: { id: fixture.pets[0], name: 'V50 pet 0' },
      service: { id: fixture.serviceId },
    });
    expect(new Date(snapshot.serverNow).getTime()).toBeGreaterThan(0);
    expect(snapshot).not.toHaveProperty('ownerId');
    await expect(read.readForActor(first.holdId, { sub: randomUUID(), roles: [Role.OWNER] }))
      .rejects.toMatchObject({ status: 404, response: { code: 'HOLD_NOT_FOUND' } });
    await expect(read.readForActor(randomUUID(), { sub: fixture.owners[0], roles: [Role.OWNER] }))
      .rejects.toMatchObject({ status: 404, response: { code: 'HOLD_NOT_FOUND' } });

    if (process.env.MVP_SCOPE_PROFILE === 'PILOT_V1') {
      await bookingSecurity.confirmManualHold({
        holdId: first.holdId,
        employee: { sub: randomUUID(), roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [fixture.clinicId], locationIds: [fixture.locationId] },
        idempotencyKey: randomUUID(),
        correlationId: randomUUID(),
        expectedVersion: first.aggregateVersion!,
      });
      const confirmed = await read.readForActor(first.holdId, { sub: fixture.owners[0], roles: [Role.OWNER] });
      expect(confirmed).toMatchObject({ status: 'CONFIRMED', statusCode: 'CONFIRMED', confirmationMode: 'MANUAL' });
      expect(confirmed).not.toHaveProperty('state');
    }
  });

  it('preserves the LEGACY_COMPAT create contract when expectedSlotVersion is omitted', async () => {
    if (process.env.MVP_SCOPE_PROFILE === 'PILOT_V1') return;
    const fixture = await seedFixture(database, 1);
    const created = await creation.createLocalHold({
      ...command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()),
      expectedSlotVersion: undefined,
    });
    expect(created).toMatchObject({ state: 'CONFIRMED' });
    const persisted = await database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM booking_schema.booking_holds WHERE slot_id = $1`,
      [fixture.slotId],
    );
    expect(persisted.rows[0].count).toBe('1');
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
      return ['SLOT_LOCKED_RETRY', 'SLOT_ALREADY_TAKEN', process.env.MVP_SCOPE_PROFILE === 'PILOT_V1' ? 'BOOKING_STATE_CONFLICT' : 'SLOT_VERSION_STALE'].includes(response.code ?? '');
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

  it('keeps a declined PILOT Level A request manual in owner readback', async () => {

    const fixture = await seedFixture(database, 1);
    const created = await creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()));
    await bookingSecurity.declineManualHold({
      holdId: created.holdId,
      employee: { sub: randomUUID(), roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [fixture.clinicId], locationIds: [fixture.locationId] },
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
      expectedVersion: created.aggregateVersion!,
      declineReason: 'STAFF_UNAVAILABLE',
    });

    const declined = await read.readForActor(created.holdId, { sub: fixture.owners[0], roles: [Role.OWNER] });
    expect(declined).toMatchObject({ status: 'REJECTED', statusCode: 'REJECTED', confirmationMode: 'MANUAL' });
    expect(declined).not.toHaveProperty('state');
    expect(declined.statusCode).not.toBe('CONFIRMED');
  });

  it('expires a pending hold exactly once and never expires a confirmed hold', async () => {
    const fixture = await seedFixture(database, 1);
    const created = await creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()));
    await database.query(`UPDATE booking_schema.booking_holds SET expires_at = clock_timestamp() - interval '1 second', confirmation_sla_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1::uuid`, [created.holdId]);

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

    await database.query(`UPDATE booking_schema.booking_holds SET state = 'CONFIRMED', expires_at = clock_timestamp() - interval '1 second', confirmation_sla_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1::uuid`, [created.holdId]);
    await expect(booking.expireHolds()).resolves.toEqual({ expired: 0 });
    const terminal = await database.query<{ state: string }>('SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid', [created.holdId]);
    expect(terminal.rows[0].state).toBe('CONFIRMED');
  });

  it('reclaims an expired hold once across replicas and restores availability', async () => {
    const fixture = await seedFixture(database, 1);
    const created = await creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()));
    await database.query(`UPDATE booking_schema.booking_holds SET expires_at=clock_timestamp()-interval '1 second', confirmation_sla_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1::uuid`, [created.holdId]);

    const results = await Promise.all([booking.expireHolds(1), booking.expireHolds(1)]);
    expect(results.reduce((sum, result) => sum + result.expired, 0)).toBe(1);
    const evidence = await database.query<{ state: string; held_count: number; effects: string; audits: string }>(`
      SELECT h.state, s.held_count,
        (SELECT count(*)::text FROM booking_schema.outbox_events WHERE aggregate_id=h.id AND event_type='booking.hold.expired.v1') effects,
        (SELECT count(*)::text FROM audit_schema.audit_log WHERE aggregate_id=h.id AND action='booking.hold.expired') audits
      FROM booking_schema.booking_holds h JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id
      WHERE h.id=$1::uuid
    `, [created.holdId]);
    expect(evidence.rows[0]).toEqual({ state: 'EXPIRED', held_count: 0, effects: '1', audits: '1' });
  });

  it.each(['confirm', 'decline'] as const)('denies late %s and converges to one EXPIRED effect set without resurrection', async (decision) => {
    const fixture = await seedFixture(database, 1);
    const created = await creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()));
    await database.query(`UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1`, [created.holdId]);
    const employee = { sub: randomUUID(), roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [fixture.clinicId], locationIds: [fixture.locationId] };
    const action = decision === 'confirm'
      ? bookingSecurity.confirmManualHold({ holdId: created.holdId, employee, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1 })
      : bookingSecurity.declineManualHold({ holdId: created.holdId, employee, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1, declineReason: 'CAPACITY_UNAVAILABLE' });
    await expect(action).rejects.toMatchObject({ status: 422, response: { code: 'HOLD_EXPIRED' } });
    const invariant = await database.query<{ state: string; held_count: number; appointments: string; expired_events: string; expired_audits: string; confirmed_events: string; declined_audits: string }>(`
      SELECT h.state,s.held_count,
        (SELECT count(*)::text FROM booking_schema.appointments WHERE hold_id=h.id) appointments,
        (SELECT count(*)::text FROM booking_schema.outbox_events WHERE aggregate_id=h.id AND event_type='booking.hold.expired.v1') expired_events,
        (SELECT count(*)::text FROM audit_schema.audit_log WHERE aggregate_id=h.id AND action='booking.hold.expired') expired_audits,
        (SELECT count(*)::text FROM booking_schema.outbox_events WHERE aggregate_id=h.id AND event_type='booking.confirmed.v1') confirmed_events,
        (SELECT count(*)::text FROM audit_schema.audit_log WHERE aggregate_id=h.id AND action='booking.declined') declined_audits
      FROM booking_schema.booking_holds h JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id WHERE h.id=$1 GROUP BY h.id,s.held_count
    `, [created.holdId]);
    expect(invariant.rows[0]).toEqual({ state: 'EXPIRED', held_count: 0, appointments: '0', expired_events: '1', expired_audits: '1', confirmed_events: '0', declined_audits: '0' });
  });

  it('bounds confirm and decline races with expiry to one terminal state and one effect family', async () => {
    if (process.env.MVP_SCOPE_PROFILE !== 'PILOT_V1') return;
    const terminalCommands = ['confirm', 'decline'] as const;
    for (const terminal of terminalCommands) {
      const fixture = await seedFixture(database, 2);
      const created = await creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()));
      await database.query(`UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()+interval '20 milliseconds' WHERE id=$1`, [created.holdId]);
      const employee = { sub: randomUUID(), roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [fixture.clinicId], locationIds: [fixture.locationId] };
      await new Promise((resolve) => setTimeout(resolve, 15));
      const competing = terminal === 'confirm'
        ? bookingSecurity.confirmManualHold({ holdId: created.holdId, employee, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1 })
        : bookingSecurity.declineManualHold({ holdId: created.holdId, employee, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedVersion: 1, declineReason: 'CAPACITY_UNAVAILABLE' });
      const settled = await Promise.race([
        Promise.allSettled([booking.expireHolds(1), competing]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`deadlock timeout: ${terminal}`)), 3_000)),
      ]);
      expect(settled).toHaveLength(2);
      for (const result of settled) {
        if (result.status === 'rejected') {
          expect(result.reason).toBeInstanceOf(DomainException);
          const reason = result.reason as DomainException;
          expect([409, 422, 503]).toContain(reason.getStatus());
          expect(['HOLD_EXPIRED', 'SLOT_LOCKED_RETRY', 'BOOKING_STATE_CONFLICT']).toContain(
            (reason.getResponse() as { code?: string }).code,
          );
        }
      }
      // A bounded lock conflict may leave the pending row for the next cycle;
      // it must remain reclaimable and converge without operator repair.
      await expect(booking.expireHolds(1)).resolves.toEqual(expect.objectContaining({ expired: expect.any(Number) }));
      const invariant = await database.query<{ state: string; held_count: number; booked_count: number; appointments: string; confirmed_events: string; released_events: string; expired_events: string; confirmed_audits: string; declined_audits: string; expired_audits: string }>(`
        SELECT
          h.state,s.held_count,s.booked_count,
          (SELECT count(*)::text FROM booking_schema.appointments WHERE hold_id=h.id) appointments,
          (SELECT count(*)::text FROM booking_schema.outbox_events e WHERE e.aggregate_id=h.id AND e.event_type='booking.confirmed.v1') confirmed_events,
          (SELECT count(*)::text FROM booking_schema.outbox_events e WHERE e.aggregate_id=h.id AND e.event_type='booking.hold.released.v1') released_events,
          (SELECT count(*)::text FROM booking_schema.outbox_events e WHERE e.aggregate_id=h.id AND e.event_type='booking.hold.expired.v1') expired_events,
          (SELECT count(*)::text FROM audit_schema.audit_log a WHERE a.aggregate_id=h.id AND a.action='booking.confirmed') confirmed_audits,
          (SELECT count(*)::text FROM audit_schema.audit_log a WHERE a.aggregate_id=h.id AND a.action='booking.declined') declined_audits,
          (SELECT count(*)::text FROM audit_schema.audit_log a WHERE a.aggregate_id=h.id AND a.action='booking.hold.expired') expired_audits
        FROM booking_schema.booking_holds h JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id
        WHERE h.id=$1 GROUP BY h.id,s.booked_count,s.held_count
      `, [created.holdId]);
      const row = invariant.rows[0];
      expect(terminal === 'confirm' ? ['CONFIRMED', 'EXPIRED'] : ['RELEASED', 'EXPIRED']).toContain(row.state);
      expect(row.held_count).toBe(0);
      expect(row.booked_count).toBe(row.state === 'CONFIRMED' ? 1 : 0);
      expect(row.appointments).toBe(row.state === 'CONFIRMED' ? '1' : '0');
      expect(Number(row.confirmed_events) + Number(row.released_events) + Number(row.expired_events)).toBe(1);
      expect(Number(row.confirmed_audits) + Number(row.declined_audits) + Number(row.expired_audits)).toBe(1);
      const ownerView = await read.readForActor(created.holdId, { sub: fixture.owners[0], roles: [Role.OWNER] });
      expect(ownerView.status).toBe(row.state === 'CONFIRMED' ? 'CONFIRMED' : row.state === 'RELEASED' ? 'REJECTED' : 'EXPIRED');
    }
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
    if (process.env.MVP_SCOPE_PROFILE === 'PILOT_V1') {
      await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
        .resolves.toMatchObject({ status: 'PENDING_CONFIRMATION' });
    } else {
      await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
        .rejects.toMatchObject({ status: 409, response: { code: 'SLOT_VERSION_STALE' } });
    }

    fixture = await seedFixture(database, 1);
    const specialty = await database.query<{ id: string }>(`SELECT id FROM catalog_schema.specialties ORDER BY id LIMIT 1`);
    const doctor = await database.query<{ id: string }>(`
      INSERT INTO catalog_schema.doctors (clinic_location_id, full_name, specialty_id, active, public_booking_enabled)
      VALUES ($1::uuid, 'Inactive V50 doctor', $2::uuid, false, false) RETURNING id
    `, [fixture.locationId, specialty.rows[0].id]);
    await database.query('UPDATE clinic_schema.appointment_slots SET doctor_id = $2::uuid WHERE id = $1::uuid', [fixture.slotId, doctor.rows[0].id]);
    const doctorCommand = creation.createLocalHold({
      ...command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()),
      doctorId: doctor.rows[0].id,
    });
    await expect(doctorCommand).rejects.toMatchObject({ status: 422, response: { code: 'DOCTOR_NOT_AVAILABLE' } });

    fixture = await seedFixture(database, 1);
    const created = await creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID()));
    await database.query(`UPDATE booking_schema.booking_holds SET expires_at = clock_timestamp() - interval '1 second', confirmation_sla_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1::uuid`, [created.holdId]);
    await database.query('UPDATE clinic_schema.appointment_slots SET held_count = 0 WHERE id = $1::uuid', [fixture.slotId]);
    await expect(booking.expireHolds()).rejects.toMatchObject({ status: 503, response: { code: 'BOOKING_TEMPORARILY_UNAVAILABLE' } });
    const rolledBack = await database.query<{ state: string; effects: string }>(`
      SELECT state,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = $1::uuid AND event_type = 'booking.hold.expired.v1') AS effects
      FROM booking_schema.booking_holds WHERE id = $1::uuid
    `, [created.holdId]);
    expect(rolledBack.rows[0]).toEqual({
      state: process.env.MVP_SCOPE_PROFILE === 'PILOT_V1' ? 'MANUAL_CONFIRM_PENDING' : 'MIS_RESERVATION_PENDING',
      effects: '0',
    });
    const backlog = await booking.expirationBacklog();
    expect(backlog).toMatchObject({ pendingCount: 1, overdueCount: 1 });
    expect(backlog.oldestOverdueAgeSeconds).toEqual(expect.any(Number));

    // Simulate repair plus a fresh worker instance after a process crash. The
    // prior mid-transaction failure must have left the hold reclaimable.
    await database.query('UPDATE clinic_schema.appointment_slots SET held_count = 1 WHERE id = $1::uuid', [fixture.slotId]);
    const restartedWorker = new HoldExpirationService(new BookingService(database, new BookingRepository()));
    await expect(restartedWorker.runOnce()).resolves.toEqual({ expired: 1 });
    await expect(restartedWorker.runOnce()).resolves.toEqual({ expired: 0 });
    const recovered = await database.query<{ state: string; held_count: number; effects: string; audits: string }>(`
      SELECT h.state, s.held_count,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id=h.id AND event_type='booking.hold.expired.v1') effects,
        (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id=h.id AND action='booking.hold.expired') audits
      FROM booking_schema.booking_holds h JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id
      WHERE h.id=$1::uuid
    `, [created.holdId]);
    expect(recovered.rows[0]).toEqual({ state: 'EXPIRED', held_count: 0, effects: '1', audits: '1' });
  });

  it('fails closed for inactive context, stale version and occupied capacity', async () => {
    let fixture = await seedFixture(database, 1);
    await database.query('UPDATE clinic_schema.clinic_services SET active=false WHERE id=$1', [fixture.serviceId]);
    await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
      .rejects.toMatchObject({ status: 422, response: { code: 'SERVICE_NOT_AVAILABLE' } });

    fixture = await seedFixture(database, 1);
    await database.query("UPDATE clinic_schema.clinic_locations SET status='INACTIVE' WHERE id=$1", [fixture.locationId]);
    await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
      .rejects.toMatchObject({ status: 422, response: { code: 'SLOT_UNAVAILABLE' } });

    fixture = await seedFixture(database, 1);
    await database.query('UPDATE clinic_schema.appointment_slots SET version=version+1 WHERE id=$1', [fixture.slotId]);
    await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
      .rejects.toMatchObject({ status: 409, response: { code: process.env.MVP_SCOPE_PROFILE === 'PILOT_V1' ? 'BOOKING_STATE_CONFLICT' : 'SLOT_VERSION_STALE' } });
    const staleEffects = await database.query<{ holds: string; held_count: number; effects: string; audits: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM booking_schema.booking_holds WHERE slot_id=$1) holds,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$1) held_count,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id IN (SELECT id FROM booking_schema.booking_holds WHERE slot_id=$1)) effects,
        (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id IN (SELECT id FROM booking_schema.booking_holds WHERE slot_id=$1)) audits
    `, [fixture.slotId]);
    expect(staleEffects.rows[0]).toEqual({ holds: '0', held_count: 0, effects: '0', audits: '0' });

    fixture = await seedFixture(database, 1);
    await database.query('UPDATE clinic_schema.appointment_slots SET booked_count=capacity WHERE id=$1', [fixture.slotId]);
    await expect(creation.createLocalHold(command(fixture, fixture.owners[0], fixture.pets[0], randomUUID())))
      .rejects.toMatchObject({ status: 409, response: { code: 'SLOT_ALREADY_TAKEN' } });
  });
});

function command(fixture: Awaited<ReturnType<typeof seedFixture>>, ownerId: string, petId: string, idempotencyKey: string) {
  return { slotId: fixture.slotId, ownerId, petId, idempotencyKey, correlationId: randomUUID(), expectedSlotVersion: 1, clinicId: fixture.clinicId, locationId: fixture.locationId, serviceId: fixture.serviceId };
}

async function seedFixture(database: DatabaseService, count: number) {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await resetBookingPersistence(database);
  const owners = Array.from({ length: count }, () => randomUUID());
  const pets = Array.from({ length: count }, () => randomUUID());
  for (let index = 0; index < count; index += 1) {
    await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [owners[index]]);
    await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species, external_patient_id) VALUES ($1::uuid, $2::uuid, $3, 'DOG', $4)`, [pets[index], owners[index], `V50 pet ${index}`, `v50-patient-${index}`]);
  }
  const clinic = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name, public_name, mis_type) VALUES ('V50 LLC', 'V50 clinic', 'VETMANAGER') RETURNING id`);
  const location = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id, address, timezone) VALUES ($1::uuid, 'V50 address', 'Europe/Moscow') RETURNING id`, [clinic.rows[0].id]);
  const service = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services (clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, 'V50', 'V50 service', 30) RETURNING id`, [location.rows[0].id]);
  const slot = await database.query<{ id: string }>(`INSERT INTO clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, ends_at, capacity, integration_mode) VALUES ($1::uuid, $2::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 'LEVEL_A') RETURNING id`, [location.rows[0].id, service.rows[0].id]);
  return { owners, pets, clinicId: clinic.rows[0].id, locationId: location.rows[0].id, serviceId: service.rows[0].id, slotId: slot.rows[0].id };
}
