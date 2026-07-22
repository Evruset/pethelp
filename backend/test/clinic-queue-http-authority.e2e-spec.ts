import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(90_000);

const IDS = {
  owner: '11000000-0000-4000-8000-000000000001',
  otherOwner: '11000000-0000-4000-8000-000000000007',
  allowed: '11000000-0000-4000-8000-000000000002',
  revoked: '11000000-0000-4000-8000-000000000004',
  noMembership: '11000000-0000-4000-8000-000000000005',
  veterinarian: '11000000-0000-4000-8000-000000000006',
  clinic: '21000000-0000-4000-8000-000000000001',
  otherClinic: '21000000-0000-4000-8000-000000000002',
  location: '31000000-0000-4000-8000-000000000001',
  otherLocation: '31000000-0000-4000-8000-000000000002',
  otherClinicLocation: '31000000-0000-4000-8000-000000000003',
  pet: '41000000-0000-4000-8000-000000000001',
  service: '51000000-0000-4000-8000-000000000001',
  otherService: '51000000-0000-4000-8000-000000000002',
  slot: '61000000-0000-4000-8000-000000000001',
  alternativeSlot: '61000000-0000-4000-8000-000000000002',
  hold: '71000000-0000-4000-8000-000000000001',
  recoveryOlderHold: '71000000-0000-4000-8000-000000000010',
  recoveryTieHold: '71000000-0000-4000-8000-000000000011',
  recoveryForeignHold: '71000000-0000-4000-8000-000000000012',
};

type Actor = {
  sub: string;
  roles: Role[];
  clinicIds?: string[];
  locationIds?: string[];
  capabilities?: string[];
};

describe('Clinic Queue HTTP authority matrix', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => resetFixtures(database));
  afterAll(async () => app?.close());

  const tokenFor = (input: Actor) => jwt.signAsync(input, {
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    algorithm: 'HS256',
  });

  const queue = async (input: Parameters<typeof tokenFor>[0], clinicId = IDS.clinic, locationId = IDS.location, limit?: number) => request(app.getHttpServer())
    .get(`/v1/clinic/${clinicId}/locations/${locationId}/booking-queue${limit ? `?limit=${limit}` : ''}`)
    .set('Authorization', `Bearer ${await tokenFor(input)}`);

  const confirm = async (input: Actor, idempotencyKey = randomUUID(), version: number | null = 1) => {
    const command = request(app.getHttpServer())
      .post(`/v1/clinic/booking-holds/${IDS.hold}/confirm`)
      .set('Authorization', `Bearer ${await tokenFor(input)}`)
      .set('Idempotency-Key', idempotencyKey)
      .set('X-Correlation-ID', randomUUID());
    return version === null ? command : command.set('If-Match', String(version));
  };

  const decline = async (input: Actor, idempotencyKey = randomUUID(), version: number | null = 1, declineReason = 'Owner requested another clinic') => {
    const command = request(app.getHttpServer())
      .post(`/v1/clinic/booking-holds/${IDS.hold}/decline`)
      .set('Authorization', `Bearer ${await tokenFor(input)}`)
      .set('Idempotency-Key', idempotencyKey)
      .set('X-Correlation-ID', randomUUID())
      .send({ declineReason });
    return version === null ? command : command.set('If-Match', String(version));
  };

  const requestNotes = async (input: Actor, idempotencyKey = randomUUID(), version: number | null = 1, noteRequest = 'Please confirm the pet vaccination date') => {
    const command = request(app.getHttpServer())
      .post(`/v1/clinic/booking-holds/${IDS.hold}/request-notes`)
      .set('Authorization', `Bearer ${await tokenFor(input)}`)
      .set('Idempotency-Key', idempotencyKey)
      .set('X-Correlation-ID', randomUUID())
      .send({ noteRequest });
    return version === null ? command : command.set('If-Match', String(version));
  };

  const proposeAlternative = async (input: Actor, idempotencyKey = randomUUID(), version: number | null = 1, newSlotId = IDS.alternativeSlot) => {
    const command = request(app.getHttpServer())
      .post(`/v1/clinic/booking-holds/${IDS.hold}/alternative-slot`)
      .set('Authorization', `Bearer ${await tokenFor(input)}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ newSlotId });
    return version === null ? command : command.set('If-Match', String(version));
  };

  const readAlternative = async (input: Actor) => request(app.getHttpServer())
    .get(`/v1/booking-holds/${IDS.hold}/alternative`)
    .set('Authorization', `Bearer ${await tokenFor(input)}`);

  const acceptAlternative = async (input: Actor, idempotencyKey = randomUUID(), version = 2) => request(app.getHttpServer())
    .post(`/v1/booking-holds/${IDS.hold}/alternative-slot/accept`)
    .set('Authorization', `Bearer ${await tokenFor(input)}`)
    .set('Idempotency-Key', idempotencyKey)
    .set('If-Match', String(version));

  const allowed = () => ({
    sub: IDS.allowed,
    roles: [Role.CLINIC_RECEPTIONIST],
    clinicIds: [IDS.clinic],
    locationIds: [IDS.location],
  });

  const deniedActors = (): Array<[string, Actor]> => [
    ['role denied', { sub: IDS.veterinarian, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing membership', { sub: IDS.noMembership, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location], capabilities: ['booking.queue.read'] }],
    ['revoked membership', { sub: IDS.revoked, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [IDS.location] }],
    ['incompatible clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.otherClinic], locationIds: [IDS.location] }],
    ['missing location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic] }],
    ['incompatible location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.otherLocation] }],
  ];

  it('allows the scoped receptionist to read only its queue', async () => {
    const response = await queue(allowed());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ clinicId: IDS.clinic, locationId: IDS.location });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ holdId: IDS.hold, version: 1 });
  });

  it('returns a repeatable authoritative FIFO snapshot with stable tie-breaker and no read side effects', async () => {
    await seedRecoveryQueue(database);
    const before = await readSideEffects(database);
    const first = await queue(allowed());
    const repeated = await queue(allowed());
    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(first.body.items.map((item: { holdId: string }) => item.holdId)).toEqual([
      IDS.recoveryOlderHold, IDS.hold, IDS.recoveryTieHold,
    ]);
    expect(new Set(first.body.items.map((item: { holdId: string }) => item.holdId)).size).toBe(3);
    expect(repeated.body.items).toEqual(first.body.items);
    expect(first.body.items.every((item: { version: number }) => item.version === 1)).toBe(true);
    expect(first.body.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ holdId: IDS.recoveryForeignHold }),
    ]));
    expect((await queue(allowed(), IDS.clinic, IDS.location, 2)).body.items.map((item: { holdId: string }) => item.holdId)).toEqual([
      IDS.recoveryOlderHold, IDS.hold,
    ]);
    expect(await readSideEffects(database)).toEqual(before);
  });

  it('applies the documented default 50 and maximum 100 snapshot limits without duplicates', async () => {
    await seedQueueVolume(database, 101);
    const defaultPage = await queue(allowed());
    const clampedPage = await queue(allowed(), IDS.clinic, IDS.location, 999);
    expect(defaultPage.status).toBe(200);
    expect(defaultPage.body.items).toHaveLength(50);
    expect(clampedPage.status).toBe(200);
    expect(clampedPage.body.items).toHaveLength(100);
    expect(new Set(clampedPage.body.items.map((item: { holdId: string }) => item.holdId)).size).toBe(100);
    expect(clampedPage.body.items.slice(0, 50)).toEqual(defaultPage.body.items);
  });

  it('polls the authoritative version after a missed non-terminal update and converges after multiple missed updates', async () => {
    const initial = await queue(allowed());
    expect(initial.body.items).toEqual([expect.objectContaining({ holdId: IDS.hold, version: 1 })]);

    const notes = await requestNotes(allowed(), randomUUID(), 1, 'Reconnect evidence');
    expect(notes.status).toBe(200);
    const afterNotes = await queue(allowed());
    expect(afterNotes.body.items).toEqual([
      expect.objectContaining({ holdId: IDS.hold, version: 2, latestAudit: expect.objectContaining({ action: 'booking.notes.requested' }) }),
    ]);

    const proposal = await proposeAlternative(allowed(), randomUUID(), 2);
    expect(proposal.status).toBe(201);
    expect(proposal.body).toMatchObject({ state: 'ALTERNATIVE_PENDING' });
    const recovered = await queue(allowed());
    expect(recovered.status).toBe(200);
    expect(recovered.body.items).toEqual([]);
    expect(await alternativeSnapshot(database)).toMatchObject({ state: 'ALTERNATIVE_PENDING', version: 3 });
  });

  it('removes confirmed and declined terminal holds from the next poll and preserves owner readback', async () => {
    const confirmed = await confirm(allowed());
    expect(confirmed.status).toBe(200);
    expect((await queue(allowed())).body.items).toEqual([]);
    const ownerToken = await tokenFor({ sub: IDS.owner, roles: [Role.OWNER] });
    const confirmedOwner = await request(app.getHttpServer())
      .get(`/v1/booking-holds/${IDS.hold}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(confirmedOwner.body).toMatchObject({ state: 'CONFIRMED', aggregateVersion: 2 });

    await resetFixtures(database);
    const declined = await decline(allowed());
    expect(declined.status).toBe(200);
    expect((await queue(allowed())).body.items).toEqual([]);
    const declinedOwner = await request(app.getHttpServer())
      .get(`/v1/booking-holds/${IDS.hold}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(declinedOwner.body).toMatchObject({ state: 'RELEASED', aggregateVersion: 2 });
  });

  it.each(['confirm', 'request-notes'] as const)('returns only a transactionally consistent snapshot during concurrent %s', async (command) => {
    const [read, mutation] = await Promise.all([
      queue(allowed()),
      command === 'confirm' ? confirm(allowed()) : requestNotes(allowed()),
    ]);
    expect(read.status).toBe(200);
    expect(mutation.status).toBe(200);
    if (command === 'request-notes') expect(read.body.items).toHaveLength(1);
    expect(read.body.items.length).toBeLessThanOrEqual(1);
    if (read.body.items[0]) {
      expect(read.body.items[0]).toMatchObject({ holdId: IDS.hold });
      if (command === 'confirm') expect(read.body.items[0].version).toBe(1);
      else {
        expect([1, 2]).toContain(read.body.items[0].version);
        if (read.body.items[0].version === 2) {
          expect(read.body.items[0].latestAudit).toMatchObject({ action: 'booking.notes.requested' });
        }
      }
    }
    const final = await queue(allowed());
    if (command === 'confirm') expect(final.body.items).toEqual([]);
    else expect(final.body.items).toEqual([expect.objectContaining({ holdId: IDS.hold, version: 2 })]);
  });

  it('does not normalize a technical read failure into a successful empty queue', async () => {
    jest.spyOn(database as any, 'withTransaction').mockRejectedValueOnce(new Error('controlled read failure'));
    const failed = await queue(allowed());
    expect(failed.status).toBe(500);
    expect(failed.body).not.toHaveProperty('items');
    const recovered = await queue(allowed());
    expect(recovered.status).toBe(200);
    expect(recovered.body.items).toEqual([expect.objectContaining({ holdId: IDS.hold, version: 1 })]);
  });

  it.each([
    ['role denied', { sub: IDS.veterinarian, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['revoked membership', { sub: IDS.revoked, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['claims without membership', { sub: IDS.noMembership, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location], capabilities: ['booking.queue.read'] }],
    ['missing clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [IDS.location] }],
    ['incompatible clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.otherClinic], locationIds: [IDS.location] }],
    ['missing location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic] }],
    ['incompatible location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.otherLocation] }],
  ])('denies queue read for %s without leaking queue data', async (_name, actor) => {
    const response = await queue(actor);
    expect(response.status).toBe(403);
    expectNoLeak(response.body);
  });

  it('denies cross-clinic and cross-location queue reads without payload disclosure', async () => {
    const crossClinic = await queue(allowed(), IDS.otherClinic, IDS.otherClinicLocation);
    const crossLocation = await queue(allowed(), IDS.clinic, IDS.otherLocation);
    expect(crossClinic.status).toBe(403);
    expect(crossLocation.status).toBe(403);
    expectNoLeak(crossClinic.body);
    expectNoLeak(crossLocation.body);
  });

  it.each([
    ['role denied', { sub: IDS.veterinarian, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing membership', { sub: IDS.noMembership, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location], capabilities: ['booking.queue.read'] }],
    ['revoked membership', { sub: IDS.revoked, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] }],
    ['missing clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [IDS.location] }],
    ['incompatible clinic scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.otherClinic], locationIds: [IDS.location] }],
    ['missing location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic] }],
    ['incompatible location scope', { sub: IDS.allowed, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.otherLocation] }],
  ])('denies confirm for %s without state, appointment, audit or outbox effects', async (_name, actor) => {
    const before = await mutationSnapshot(database);
    const response = await confirm(actor);
    expect(response.status).toBe(403);
    expectNoLeak(response.body);
    expect(await mutationSnapshot(database)).toEqual(before);
  });

  it('confirms idempotently and publishes the authoritative owner readback', async () => {
    const key = randomUUID();
    const first = await confirm(allowed(), key);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ holdId: IDS.hold, state: 'CONFIRMED' });
    const repeated = await confirm(allowed(), key);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(first.body);

    const ownerToken = await tokenFor({ sub: IDS.owner, roles: [Role.OWNER] });
    const readback = await request(app.getHttpServer())
      .get(`/v1/booking-holds/${IDS.hold}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(readback.body).toMatchObject({
      holdId: IDS.hold,
      state: 'CONFIRMED',
      confirmationMode: 'MANUAL',
      nextActionCode: 'VIEW_APPOINTMENT',
      aggregateVersion: 2,
    });
    expect(await mutationSnapshot(database)).toEqual({
      state: 'CONFIRMED', version: 2, heldCount: 0, appointments: '1', events: '1', audits: '1',
    });
  });

  it.each(['decline', 'request-notes'] as const)('denies %s across the authority matrix without side effects', async (command) => {
    for (const [name, actor] of deniedActors()) {
      await resetFixtures(database);
      const before = await mutationSnapshot(database);
      const response = command === 'decline' ? await decline(actor) : await requestNotes(actor);
      expect(response.status).toBe(403);
      expectNoLeak(response.body);
      expect(await mutationSnapshot(database)).toEqual(before);
      expect(JSON.stringify(response.body)).not.toContain(name === 'role denied' ? 'Queue pet' : IDS.hold);
    }
  });

  it('declines idempotently with authoritative release, reason, audit, outbox and owner readback', async () => {
    const key = randomUUID();
    const first = await decline(allowed(), key);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ holdId: IDS.hold, slotId: IDS.slot, state: 'RELEASED' });
    expect((await decline(allowed(), key)).body).toEqual(first.body);
    expect(await mutationSnapshot(database)).toEqual({
      state: 'RELEASED', version: 2, heldCount: 0, appointments: '0', events: '1', audits: '1',
    });
    const evidence = await database.query<{ event_reason: string; audit_reason: string }>(`
      SELECT event.payload_json->>'declineReason' AS event_reason, audit.payload_json->>'reason' AS audit_reason
      FROM booking_schema.outbox_events event
      JOIN audit_schema.audit_log audit ON audit.aggregate_id = event.aggregate_id
      WHERE event.aggregate_id = $1::uuid
        AND event.event_type = 'booking.hold.released.v1'
        AND audit.action = 'booking.declined'
    `, [IDS.hold]);
    expect(evidence.rows[0]).toEqual({ event_reason: 'Owner requested another clinic', audit_reason: 'Owner requested another clinic' });

    const ownerToken = await tokenFor({ sub: IDS.owner, roles: [Role.OWNER] });
    const readback = await request(app.getHttpServer()).get(`/v1/booking-holds/${IDS.hold}`).set('Authorization', `Bearer ${ownerToken}`).expect(200);
    expect(readback.body).toMatchObject({ state: 'RELEASED', nextActionCode: 'CHOOSE_ANOTHER_SLOT', aggregateVersion: 2 });
  });

  it('requests notes idempotently while preserving the pending hold and publishing the request text', async () => {
    const key = randomUUID();
    const first = await requestNotes(allowed(), key);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      holdId: IDS.hold,
      state: 'MANUAL_CONFIRM_PENDING',
      version: 2,
      requestedNote: 'Please confirm the pet vaccination date',
    });
    expect((await requestNotes(allowed(), key)).body).toEqual(first.body);
    expect(await mutationSnapshot(database)).toEqual({
      state: 'MANUAL_CONFIRM_PENDING', version: 2, heldCount: 1, appointments: '0', events: '1', audits: '1',
    });
    const evidence = await database.query<{ event_note: string; audit_note: string }>(`
      SELECT event.payload_json->>'requestedNote' AS event_note, audit.payload_json->>'noteRequest' AS audit_note
      FROM booking_schema.outbox_events event
      JOIN audit_schema.audit_log audit ON audit.aggregate_id = event.aggregate_id
      WHERE event.aggregate_id = $1::uuid
        AND event.event_type = 'booking.notes.requested.v1'
        AND audit.action = 'booking.notes.requested'
    `, [IDS.hold]);
    expect(evidence.rows[0]).toEqual({
      event_note: 'Please confirm the pet vaccination date',
      audit_note: 'Please confirm the pet vaccination date',
    });
  });

  it.each(['decline', 'request-notes'] as const)('rejects %s from terminal CONFIRMED without side effects', async (command) => {
    await database.query(`UPDATE booking_schema.booking_holds SET state = 'CONFIRMED', confirmation_sla_expires_at = NULL WHERE id = $1::uuid`, [IDS.hold]);
    const before = await mutationSnapshot(database);
    const response = command === 'decline' ? await decline(allowed()) : await requestNotes(allowed());
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(await mutationSnapshot(database)).toEqual(before);
  });

  it('proposes an alternative idempotently with exact clinic scope, reserved capacity and owner readback', async () => {
    const key = randomUUID();
    const first = await proposeAlternative(allowed(), key);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ holdId: IDS.hold, sourceSlotId: IDS.slot, alternativeSlotId: IDS.alternativeSlot, state: 'ALTERNATIVE_PENDING' });
    const repeated = await proposeAlternative(allowed(), key);
    expect(repeated.status).toBe(201);
    expect(repeated.body).toEqual(first.body);
    expect(await alternativeSnapshot(database)).toEqual({
      state: 'ALTERNATIVE_PENDING', version: 2, sourceHeld: 1, alternativeHeld: 1,
      swaps: '1', appointments: '0', events: '1', audits: '1',
    });

    const ownerRead = await readAlternative({ sub: IDS.owner, roles: [Role.OWNER] });
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body).toMatchObject({
      holdId: IDS.hold,
      state: 'ALTERNATIVE_PENDING',
      aggregateVersion: 2,
      originalSlot: { id: IDS.slot },
      alternativeSlot: { id: IDS.alternativeSlot },
      actions: { canAccept: true, canDecline: true },
    });
  });

  it('denies clinic proposal across role, membership and exact scope without alternative effects', async () => {
    for (const [, actor] of deniedActors()) {
      await resetFixtures(database);
      const before = await alternativeSnapshot(database);
      const response = await proposeAlternative(actor);
      expect(response.status).toBe(403);
      expectNoLeak(response.body);
      expect(await alternativeSnapshot(database)).toEqual(before);
    }
  });

  it('normalizes foreign owner read and rejects staff or unauthenticated access without disclosure', async () => {
    await proposeAlternative(allowed()).then((response) => expect(response.status).toBe(201));
    const foreign = await readAlternative({ sub: IDS.otherOwner, roles: [Role.OWNER] });
    expect(foreign.status).toBe(404);
    expectNoAlternativeLeak(foreign.body);
    const staff = await readAlternative(allowed());
    expect(staff.status).toBe(403);
    expectNoAlternativeLeak(staff.body);
    await request(app.getHttpServer()).get(`/v1/booking-holds/${IDS.hold}/alternative`).expect(401);
  });

  it('accepts once, replays the same key, and rejects a second key without duplicate effects', async () => {
    await proposeAlternative(allowed()).then((response) => expect(response.status).toBe(201));
    const owner = { sub: IDS.owner, roles: [Role.OWNER] };
    const key = randomUUID();
    const first = await acceptAlternative(owner, key);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ holdId: IDS.hold, sourceSlotId: IDS.slot, slotId: IDS.alternativeSlot, state: 'MIS_HELD' });
    const replay = await acceptAlternative(owner, key);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    const accepted = await alternativeSnapshot(database);
    expect(accepted).toEqual({
      state: 'MIS_HELD', version: 3, sourceHeld: 0, alternativeHeld: 1,
      swaps: '1', appointments: '0', events: '2', audits: '2',
    });
    const secondKey = await acceptAlternative(owner, randomUUID(), 3);
    expect(secondKey.status).toBe(422);
    expect(secondKey.body).toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(await alternativeSnapshot(database)).toEqual(accepted);
  });

  it('denies foreign-owner accept without proposal, capacity, appointment, audit or outbox effects', async () => {
    await proposeAlternative(allowed()).then((response) => expect(response.status).toBe(201));
    const before = await alternativeSnapshot(database);
    const response = await acceptAlternative({ sub: IDS.otherOwner, roles: [Role.OWNER] });
    expect(response.status).toBe(403);
    expectNoAlternativeLeak(response.body);
    expect(await alternativeSnapshot(database)).toEqual(before);
  });

  it('rejects expired, stale and conflicted accepts while preserving capacity and effects', async () => {
    await proposeAlternative(allowed()).then((response) => expect(response.status).toBe(201));
    const owner = { sub: IDS.owner, roles: [Role.OWNER] };
    let before = await alternativeSnapshot(database);
    const stale = await acceptAlternative(owner, randomUUID(), 1);
    expect(stale.status).toBe(409);
    expect(await alternativeSnapshot(database)).toEqual(before);

    await database.query(`UPDATE booking_schema.alternative_swap_groups SET expires_at = clock_timestamp() - interval '1 second' WHERE original_hold_id = $1::uuid`, [IDS.hold]);
    await database.query(`UPDATE booking_schema.booking_holds SET alternative_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1::uuid`, [IDS.hold]);
    before = await alternativeSnapshot(database);
    const expired = await acceptAlternative(owner);
    expect(expired.status).toBe(422);
    expect(expired.body).toMatchObject({ code: 'HOLD_EXPIRED' });
    expect(await alternativeSnapshot(database)).toEqual(before);

    await resetFixtures(database);
    await proposeAlternative(allowed()).then((response) => expect(response.status).toBe(201));
    await database.query(`UPDATE clinic_schema.appointment_slots SET held_count = 0 WHERE id = $1::uuid`, [IDS.alternativeSlot]);
    before = await alternativeSnapshot(database);
    const conflicted = await acceptAlternative(owner);
    expect(conflicted.status).toBe(409);
    expect(conflicted.status).toBeLessThan(500);
    expect(await alternativeSnapshot(database)).toEqual(before);
  });

  it.each(['confirm', 'decline', 'request-notes', 'propose-alternative'] as const)('requires If-Match for %s without side effects', async (name) => {
    const before = await commandSnapshot(database);
    const response = name === 'confirm' ? await confirm(allowed(), randomUUID(), null)
      : name === 'decline' ? await decline(allowed(), randomUUID(), null)
        : name === 'request-notes' ? await requestNotes(allowed(), randomUUID(), null)
          : await proposeAlternative(allowed(), randomUUID(), null);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(await commandSnapshot(database)).toEqual(before);
  });

  it.each(['confirm', 'decline', 'request-notes', 'propose-alternative'] as const)('rejects impossible future version for %s without side effects', async (name) => {
    const before = await commandSnapshot(database);
    const response = name === 'confirm' ? await confirm(allowed(), randomUUID(), 101)
      : name === 'decline' ? await decline(allowed(), randomUUID(), 101)
        : name === 'request-notes' ? await requestNotes(allowed(), randomUUID(), 101)
          : await proposeAlternative(allowed(), randomUUID(), 101);
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'SLOT_VERSION_STALE' });
    expect(await commandSnapshot(database)).toEqual(before);
  });

  it('rejects a stale confirm after request-notes advances the authoritative version', async () => {
    const notes = await requestNotes(allowed(), randomUUID(), 1);
    expect(notes.status).toBe(200);
    const before = await commandSnapshot(database);
    const stale = await confirm(allowed(), randomUUID(), 1);
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: 'SLOT_VERSION_STALE' });
    expect(await commandSnapshot(database)).toEqual(before);
  });

  it('replays the first request-notes result for the same key without overwriting a changed payload', async () => {
    const key = randomUUID();
    const first = await requestNotes(allowed(), key, 1, 'First authoritative note request');
    expect(first.status).toBe(200);
    const before = await commandSnapshot(database);
    const replay = await requestNotes(allowed(), key, 1, 'Conflicting replacement text');
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(replay.body).toMatchObject({ requestedNote: 'First authoritative note request' });
    expect(await commandSnapshot(database)).toEqual(before);
  });

  it.each(['confirm', 'decline'] as const)('rejects a different-key replay after terminal %s without duplicate effects', async (name) => {
    const first = name === 'confirm' ? await confirm(allowed()) : await decline(allowed());
    expect(first.status).toBe(200);
    const before = await commandSnapshot(database);
    const second = name === 'confirm' ? await confirm(allowed(), randomUUID(), 2) : await decline(allowed(), randomUUID(), 2);
    expect(second.status).toBe(422);
    expect(second.body).toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(await commandSnapshot(database)).toEqual(before);
  });

  it('serializes duplicate concurrent confirm delivery to one business transition', async () => {
    const key = randomUUID();
    const [first, second] = await Promise.all([confirm(allowed(), key, 1), confirm(allowed(), key, 1)]);
    expect([first.status, second.status].every((status) => status === 200 || status === 409 || status === 425)).toBe(true);
    expect([first.status, second.status].filter((status) => status === 200).length).toBeGreaterThanOrEqual(1);
    expect(await commandSnapshot(database)).toMatchObject({
      state: 'CONFIRMED', version: 2, appointments: '1', events: '1', audits: '1',
    });
  });

  it.each([
    ['confirm-vs-decline', 'confirm', 'decline'],
    ['request-notes-vs-propose', 'request-notes', 'propose'],
  ] as const)('serializes %s with one winner, controlled loser and one effect set', async (_label, left, right) => {
    const responses = await Promise.all([
      left === 'confirm' ? confirm(allowed(), randomUUID(), 1) : requestNotes(allowed(), randomUUID(), 1),
      right === 'decline' ? decline(allowed(), randomUUID(), 1) : proposeAlternative(allowed(), randomUUID(), 1),
    ]);
    const successes = responses.filter((response) => response.status === 200 || response.status === 201);
    expect(successes).toHaveLength(1);
    const loser = responses.find((response) => response !== successes[0]);
    expect(loser?.status).toBe(409);
    expect(['SLOT_LOCKED_RETRY', 'SLOT_VERSION_STALE']).toContain(loser?.body.code);
    const winner = successes[0];
    const snapshot = await commandSnapshot(database);
    expect(snapshot.version).toBe(2);
    expect(Number(snapshot.events)).toBe(1);
    expect(Number(snapshot.audits)).toBe(1);
    if (left === 'confirm') {
      expect(snapshot.state).toBe(winner.body.state);
      expect(snapshot.appointments).toBe(winner.body.state === 'CONFIRMED' ? '1' : '0');
      expect(snapshot.swaps).toBe('0');
      expect(snapshot.sourceHeld).toBe(0);
      expect(snapshot.alternativeHeld).toBe(0);
    } else {
      expect(snapshot.state).toBe(winner.body.state);
      expect(snapshot.appointments).toBe('0');
      expect(snapshot.sourceHeld).toBe(1);
      expect(snapshot.swaps).toBe(winner.body.state === 'ALTERNATIVE_PENDING' ? '1' : '0');
      expect(snapshot.alternativeHeld).toBe(winner.body.state === 'ALTERNATIVE_PENDING' ? 1 : 0);
    }
  });
});

function expectNoLeak(body: Record<string, unknown>) {
  expect(body).toHaveProperty('code');
  expect(body).not.toHaveProperty('holdId');
  expect(body).not.toHaveProperty('slotId');
  expect(body).not.toHaveProperty('items');
  expect(JSON.stringify(body)).not.toMatch(/Queue pet|Queue service|booking\.confirmed|appointmentId/i);
}

function expectNoAlternativeLeak(body: Record<string, unknown>) {
  expect(body).toHaveProperty('code');
  expect(body).not.toHaveProperty('holdId');
  expect(body).not.toHaveProperty('proposalId');
  expect(body).not.toHaveProperty('alternativeSlot');
  expect(JSON.stringify(body)).not.toMatch(/Queue pet|Queue service|alternativeSlotId|sourceSlotId/i);
}

async function mutationSnapshot(database: DatabaseService) {
  const result = await database.query<{
    state: string; version: number; heldCount: number; appointments: string; events: string; audits: string;
  }>(`
    SELECT hold.state, hold.version, slot.held_count AS "heldCount",
      (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE hold_id = hold.id) AS appointments,
      (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = hold.id AND event_type = ANY(ARRAY['booking.confirmed.v1','booking.hold.released.v1','booking.notes.requested.v1'])) AS events,
      (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id = hold.id AND action = ANY(ARRAY['booking.confirmed','booking.declined','booking.notes.requested'])) AS audits
    FROM booking_schema.booking_holds hold
    JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
    WHERE hold.id = $1::uuid
  `, [IDS.hold]);
  return result.rows[0];
}

async function alternativeSnapshot(database: DatabaseService) {
  return (await database.query<{
    state: string; version: number; sourceHeld: number; alternativeHeld: number;
    swaps: string; appointments: string; events: string; audits: string;
  }>(`
    SELECT hold.state, hold.version,
      (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS "sourceHeld",
      (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS "alternativeHeld",
      (SELECT COUNT(*)::text FROM booking_schema.alternative_swap_groups WHERE original_hold_id = hold.id) AS swaps,
      (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE hold_id = hold.id) AS appointments,
      (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = hold.id AND event_type LIKE 'booking.alternative.%') AS events,
      (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id = hold.id AND action LIKE '%ALTERNATIVE%') AS audits
    FROM booking_schema.booking_holds hold
    WHERE hold.id = $1::uuid
  `, [IDS.hold, IDS.slot, IDS.alternativeSlot])).rows[0];
}

async function commandSnapshot(database: DatabaseService) {
  return (await database.query<{
    state: string; version: number; sourceHeld: number; alternativeHeld: number;
    swaps: string; appointments: string; events: string; audits: string;
  }>(`
    SELECT hold.state, hold.version,
      (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS "sourceHeld",
      (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $3::uuid) AS "alternativeHeld",
      (SELECT COUNT(*)::text FROM booking_schema.alternative_swap_groups WHERE original_hold_id = hold.id) AS swaps,
      (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE hold_id = hold.id) AS appointments,
      (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id = hold.id AND event_type = ANY(ARRAY['booking.confirmed.v1','booking.hold.released.v1','booking.notes.requested.v1','booking.alternative.proposed.v1'])) AS events,
      (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id = hold.id AND action = ANY(ARRAY['booking.confirmed','booking.declined','booking.notes.requested','BOOKING_ALTERNATIVE_PROPOSED'])) AS audits
    FROM booking_schema.booking_holds hold
    WHERE hold.id = $1::uuid
  `, [IDS.hold, IDS.slot, IDS.alternativeSlot])).rows[0];
}

async function readSideEffects(database: DatabaseService) {
  return (await database.query<{ outbox: string; audits: string }>(`
    SELECT
      (SELECT COUNT(*)::text FROM booking_schema.outbox_events) AS outbox,
      (SELECT COUNT(*)::text FROM audit_schema.audit_log) AS audits
  `)).rows[0];
}

async function seedRecoveryQueue(database: DatabaseService) {
  await database.query(`
    INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES
      ('41000000-0000-4000-8000-000000000010', $1::uuid, 'Older queue pet', 'DOG'),
      ('41000000-0000-4000-8000-000000000011', $1::uuid, 'Tie queue pet', 'CAT'),
      ('41000000-0000-4000-8000-000000000012', $1::uuid, 'Foreign queue pet', 'DOG')
  `, [IDS.owner]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots
      (id, clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode)
    VALUES
      ('61000000-0000-4000-8000-000000000010', $1::uuid, $2::uuid, clock_timestamp()+interval '4 hours', clock_timestamp()+interval '270 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C'),
      ('61000000-0000-4000-8000-000000000011', $1::uuid, $2::uuid, clock_timestamp()+interval '5 hours', clock_timestamp()+interval '330 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C'),
      ('61000000-0000-4000-8000-000000000012', $3::uuid, $4::uuid, clock_timestamp()+interval '6 hours', clock_timestamp()+interval '390 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C')
  `, [IDS.location, IDS.service, IDS.otherLocation, IDS.otherService]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds
      (id, slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at, state_changed_at)
    VALUES
      ($2::uuid, '61000000-0000-4000-8000-000000000010', $1::uuid, '41000000-0000-4000-8000-000000000010', 'MANUAL_CONFIRM_PENDING', clock_timestamp()+interval '16 minutes', clock_timestamp()+interval '15 minutes', clock_timestamp()-interval '3 minutes'),
      ($3::uuid, '61000000-0000-4000-8000-000000000011', $1::uuid, '41000000-0000-4000-8000-000000000011', 'MANUAL_CONFIRM_PENDING', clock_timestamp()+interval '16 minutes', clock_timestamp()+interval '15 minutes', clock_timestamp()-interval '1 minute'),
      ($4::uuid, '61000000-0000-4000-8000-000000000012', $1::uuid, '41000000-0000-4000-8000-000000000012', 'MANUAL_CONFIRM_PENDING', clock_timestamp()+interval '16 minutes', clock_timestamp()+interval '15 minutes', clock_timestamp()-interval '2 minutes')
  `, [IDS.owner, IDS.recoveryOlderHold, IDS.recoveryTieHold, IDS.recoveryForeignHold]);
  await database.query(`
    WITH marker AS (SELECT clock_timestamp()-interval '1 minute' AS changed_at)
    UPDATE booking_schema.booking_holds h SET state_changed_at=marker.changed_at FROM marker
    WHERE h.id=ANY($1::uuid[])
  `, [[IDS.hold, IDS.recoveryTieHold]]);
}

async function seedQueueVolume(database: DatabaseService, count: number) {
  await database.query(`
    INSERT INTO pet_schema.pets (id, owner_id, name, species)
    SELECT ('81000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
           $1::uuid, 'Volume pet ' || series, 'CAT'
    FROM generate_series(1, $2::integer) series
  `, [IDS.owner, count]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots
      (id, clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode)
    SELECT ('82000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
           $1::uuid, $2::uuid, clock_timestamp()+interval '8 hours'+series*interval '1 minute',
           clock_timestamp()+interval '8 hours'+(series+30)*interval '1 minute',
           1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C'
    FROM generate_series(1, $3::integer) series
  `, [IDS.location, IDS.service, count]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds
      (id, slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at, state_changed_at)
    SELECT ('83000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
           ('82000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
           $1::uuid,
           ('81000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
           'MANUAL_CONFIRM_PENDING', clock_timestamp()+interval '30 minutes',
           clock_timestamp()+interval '29 minutes', clock_timestamp()-interval '10 minutes'+series*interval '1 second'
    FROM generate_series(1, $2::integer) series
  `, [IDS.owner, count]);
}

async function resetFixtures(database: DatabaseService) {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)
    VALUES
      ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST', true, NULL),
      ($3::uuid, $2::uuid, 'CLINIC_RECEPTIONIST', false, clock_timestamp())
  `, [IDS.allowed, IDS.location, IDS.revoked]);
  await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'QUEUE', 'Queue service', 30), ($3::uuid, $4::uuid, 'OTHER', 'Other service', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Queue pet', 'CAT')`, [IDS.pet, IDS.owner]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode)
    VALUES
      ($1::uuid, $2::uuid, $3::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C'),
      ($4::uuid, $2::uuid, $3::uuid, clock_timestamp() + interval '3 hours', clock_timestamp() + interval '210 minutes', 1, 0, 'AVAILABLE', 'LEVEL_C')
  `, [IDS.slot, IDS.location, IDS.service, IDS.alternativeSlot]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at, state_changed_at)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'MANUAL_CONFIRM_PENDING', clock_timestamp() + interval '16 minutes', clock_timestamp() + interval '15 minutes', clock_timestamp() - interval '1 minute')
  `, [IDS.hold, IDS.slot, IDS.owner, IDS.pet]);
}
