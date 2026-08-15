import { randomUUID } from 'node:crypto';
import { resetBookingPersistence } from './helpers/booking-test-reset';
import { DatabaseService } from '../src/database/database.service';
import { NotificationFoundationRepository } from '../src/notifications/notification-foundation.repository';

jest.setTimeout(60_000);

describe('MVP notification persistence foundation (real PostgreSQL)', () => {
  const database = new DatabaseService();
  const repository = new NotificationFoundationRepository(database);

  afterAll(async () => database.onModuleDestroy());

  beforeEach(async () => {
    await resetBookingPersistence(database);
    await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  });

  it('creates the bounded constraints and access-path indexes', async () => {
    const objects = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='booking_schema'
        AND table_name IN ('owner_notifications','owner_notification_email_deliveries')
      ORDER BY table_name
    `);
    expect(objects.rows.map((row) => row.table_name)).toEqual([
      'owner_notification_email_deliveries', 'owner_notifications',
    ]);
    const indexes = await database.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes WHERE schemaname='booking_schema'
        AND indexname IN (
          'owner_notifications_owner_created_id_idx','owner_notifications_owner_unread_created_id_idx',
          'owner_notification_email_due_idx','owner_notification_email_expired_lease_idx'
        ) ORDER BY indexname
    `);
    expect(indexes.rows).toHaveLength(4);
  });

  it('deduplicates concurrent event projection and persists owner-scoped read state', async () => {
    const fixture = await seed(database, 'booking.confirmed.v1');
    const projected = await Promise.all(Array.from({ length: 20 }, () => repository.projectAuthoritativeEvent(fixture.eventId)));
    expect(new Set(projected.map((row) => row.id)).size).toBe(1);
    expect(projected[0]).toMatchObject({
      recipientOwnerId: fixture.ownerId,
      sourceOutboxEventId: fixture.eventId,
      bookingHoldId: fixture.holdId,
      notificationType: 'CONFIRMED',
      aggregateVersion: 1,
      readAt: null,
    });
    const counts = await database.query<{ notifications: string; deliveries: string }>(`
      SELECT
        (SELECT count(*)::text FROM booking_schema.owner_notifications) notifications,
        (SELECT count(*)::text FROM booking_schema.owner_notification_email_deliveries) deliveries
    `);
    expect(counts.rows[0]).toEqual({ notifications: '1', deliveries: '1' });
    await expect(repository.listForOwner(fixture.ownerId, 20)).resolves.toHaveLength(1);
    await expect(repository.listForOwner(fixture.foreignOwnerId, 20)).resolves.toEqual([]);
    await expect(repository.markRead(fixture.foreignOwnerId, projected[0].id)).resolves.toBe(false);
    await expect(repository.markRead(fixture.ownerId, projected[0].id)).resolves.toBe(true);
    await expect(repository.markRead(fixture.ownerId, projected[0].id)).resolves.toBe(true);
    const reread = await repository.listForOwner(fixture.ownerId, 20);
    expect(reread[0].readAt).toEqual(expect.any(String));
    await expect(repository.markReadAndGet(fixture.ownerId, projected[0].id)).resolves.toMatchObject({ id: projected[0].id });
    await expect(repository.markReadAndGet(fixture.foreignOwnerId, projected[0].id)).resolves.toBeUndefined();
  });

  it('does not create an Owner notification for PENDING_CONFIRMATION', async () => {
    const fixture = await seed(database, 'booking.hold.created.v1');
    await repository.projectPendingForOwner(fixture.ownerId);
    await expect(repository.listForOwner(fixture.ownerId, 20)).resolves.toEqual([]);
    await expect(repository.projectAuthoritativeEvent(fixture.eventId)).rejects.toThrow('NOTIFICATION_EVENT_TYPE_NOT_ALLOWED');
  });

  it.each([
    ['booking.confirmed.v1', {}, 'CONFIRMED'],
    ['booking.hold.released.v1', { reason: 'CLINIC_DECLINED' }, 'REJECTED'],
    ['booking.hold.released.v1', { reason: 'OWNER_CANCELLED' }, 'CANCELLED'],
    ['booking.hold.expired.v1', {}, 'EXPIRED'],
  ])('maps only authoritative %s events to %s', async (eventType, payload, expected) => {
    const fixture = await seed(database, eventType, payload);
    await expect(repository.projectAuthoritativeEvent(fixture.eventId)).resolves.toMatchObject({ notificationType: expected });
  });

  it('projects committed events without an Owner read and skips system/unknown releases', async () => {
    const confirmed = await seed(database, 'booking.confirmed.v1');
    const systemRelease = await seed(database, 'booking.hold.released.v1', { reason: 'SYSTEM_RELEASE' });
    await expect(repository.projectPendingBatch()).resolves.toBe(1);
    await expect(repository.listForOwner(confirmed.ownerId, 20)).resolves.toHaveLength(1);
    await expect(repository.listForOwner(systemRelease.ownerId, 20)).resolves.toEqual([]);
    await expect(repository.projectAuthoritativeEvent(systemRelease.eventId)).rejects.toThrow('NOTIFICATION_EVENT_TYPE_NOT_ALLOWED');
  });

  it('leaves unrelated external outbox rows untouched', async () => {
    const fixture = await seed(database, 'mis.reservation.requested.v1');
    await expect(repository.projectAuthoritativeEvent(fixture.eventId)).rejects.toThrow('NOTIFICATION_EVENT_TYPE_NOT_ALLOWED');
    const event = await database.query<{ status: string; attempts: number; published_at: Date | null }>(
      'SELECT status,attempts,published_at FROM booking_schema.outbox_events WHERE id=$1::uuid', [fixture.eventId],
    );
    expect(event.rows[0]).toEqual({ status: 'PENDING', attempts: 0, published_at: null });
  });

  it('allows one lease claimant, recovers an expired lease and terminates at five attempts', async () => {
    const fixture = await seed(database, 'booking.confirmed.v1');
    await repository.projectAuthoritativeEvent(fixture.eventId);
    const claims = await Promise.all(Array.from({ length: 12 }, () => repository.claimDueEmail()));
    const first = claims.filter(Boolean);
    expect(first).toHaveLength(1);
    await database.query(`
      UPDATE booking_schema.owner_notification_email_deliveries
      SET lease_until=clock_timestamp()-interval '1 second'
      WHERE id=$1::uuid
    `, [first[0]!.id]);
    const recovered = await repository.claimDueEmail();
    expect(recovered).toMatchObject({ id: first[0]!.id, attemptCount: 2 });

    let current = recovered!;
    for (let attempt = 2; attempt <= 5; attempt += 1) {
      const status = await repository.recordEmailFailure(current.id, current.leaseToken, 'TRANSIENT_PROVIDER_FAILURE');
      if (attempt === 5) {
        expect(status).toBe('TERMINAL_FAILED');
        break;
      }
      expect(status).toBe('RETRY_WAIT');
      await database.query(`UPDATE booking_schema.owner_notification_email_deliveries SET next_attempt_at=clock_timestamp() WHERE id=$1::uuid`, [current.id]);
      current = (await repository.claimDueEmail())!;
      expect(current.attemptCount).toBe(attempt + 1);
    }
    await expect(repository.claimDueEmail()).resolves.toBeUndefined();
    const terminal = await database.query<{ status: string; attempt_count: number; terminal_failed_at: Date | null; last_error: string }>(
      'SELECT status,attempt_count,terminal_failed_at,last_error FROM booking_schema.owner_notification_email_deliveries WHERE id=$1::uuid', [current.id],
    );
    expect(terminal.rows[0]).toMatchObject({ status: 'TERMINAL_FAILED', attempt_count: 5, terminal_failed_at: expect.any(Date), last_error: 'TRANSIENT_PROVIDER_FAILURE' });
  });

  it('terminalizes an expired fifth lease and never persists raw provider errors', async () => {
    const fixture = await seed(database, 'booking.confirmed.v1');
    await repository.projectAuthoritativeEvent(fixture.eventId);
    const claim = (await repository.claimDueEmail())!;
    await expect(repository.recordEmailFailure(claim.id, claim.leaseToken, 'token=secret owner@example.test' as never)).resolves.toBe('RETRY_WAIT');
    let state = await database.query<{ last_error: string }>('SELECT last_error FROM booking_schema.owner_notification_email_deliveries WHERE id=$1::uuid', [claim.id]);
    expect(state.rows[0].last_error).toBe('UNKNOWN_SAFE');
    expect(state.rows[0].last_error).not.toMatch(/secret|@/);

    await database.query(`
      UPDATE booking_schema.owner_notification_email_deliveries
      SET status='LEASED',attempt_count=5,lease_token=gen_random_uuid(),
          lease_until=clock_timestamp()-interval '1 second',terminal_failed_at=NULL
      WHERE id=$1::uuid
    `, [claim.id]);
    await expect(repository.claimDueEmail()).resolves.toBeUndefined();
    state = await database.query<{ last_error: string }>('SELECT last_error FROM booking_schema.owner_notification_email_deliveries WHERE id=$1::uuid', [claim.id]);
    expect(state.rows[0].last_error).toBe('LEASE_EXPIRED_AFTER_MAX_ATTEMPTS');
  });

  it('fences delivery completion by lease token and preserves notification history', async () => {
    const fixture = await seed(database, 'booking.confirmed.v1');
    const notification = await repository.projectAuthoritativeEvent(fixture.eventId);
    const claim = (await repository.claimDueEmail())!;
    await expect(repository.markEmailDelivered(claim.id, randomUUID())).resolves.toBe(false);
    await expect(repository.markEmailDelivered(claim.id, claim.leaseToken)).resolves.toBe(true);
    await expect(repository.markEmailDelivered(claim.id, claim.leaseToken)).resolves.toBe(false);
    await expect(database.query('DELETE FROM booking_schema.outbox_events WHERE id=$1::uuid', [fixture.eventId])).rejects.toThrow();
    await expect(repository.listForOwner(fixture.ownerId, 20)).resolves.toEqual([expect.objectContaining({ id: notification.id })]);
  });
});

async function seed(database: DatabaseService, eventType: string, payload: Record<string, unknown> = {}) {
  const ownerId = randomUUID();
  const foreignOwnerId = randomUUID();
  const petId = randomUUID();
  await database.query('INSERT INTO identity_schema.users(id) VALUES($1::uuid),($2::uuid)', [ownerId, foreignOwnerId]);
  await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1::uuid,$2::uuid,'Notify pet','DOG')`, [petId, ownerId]);
  const clinicId = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics(legal_name,public_name) VALUES('Notify','Notify clinic') RETURNING id`)).rows[0].id;
  const locationId = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations(clinic_id,address) VALUES($1::uuid,'Notify address') RETURNING id`, [clinicId])).rows[0].id;
  const serviceId = (await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services(clinic_location_id,code,display_name,duration_minutes) VALUES($1::uuid,'NOTIFY','Notify service',30) RETURNING id`, [locationId])).rows[0].id;
  const slotId = (await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,integration_mode)
    VALUES($1::uuid,$2::uuid,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '90 minutes',1,'LEVEL_C') RETURNING id
  `, [locationId, serviceId])).rows[0].id;
  const holdId = (await database.query<{ id: string }>(`
    INSERT INTO booking_schema.booking_holds(slot_id,owner_id,pet_id,state,expires_at)
    VALUES($1::uuid,$2::uuid,$3::uuid,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '1 hour') RETURNING id
  `, [slotId, ownerId, petId])).rows[0].id;
  const eventId = (await database.query<{ id: string }>(`
    INSERT INTO booking_schema.outbox_events(event_type,aggregate_type,aggregate_id,aggregate_version,payload_json)
    VALUES($1,'booking_hold',$2::uuid,1,$3::jsonb) RETURNING id
  `, [eventType, holdId, JSON.stringify(payload)])).rows[0].id;
  return { ownerId, foreignOwnerId, holdId, eventId };
}
