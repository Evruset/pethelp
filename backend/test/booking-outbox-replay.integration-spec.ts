import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service';
import { OutboxService } from '../src/outbox/outbox.service';

jest.setTimeout(30_000);

describe('Booking outbox replay reliability', () => {
  let database: DatabaseService;
  let outbox: OutboxService;

  beforeAll(() => {
    database = new DatabaseService();
    outbox = new OutboxService(database);
  });

  beforeEach(async () => {
    await database.query('TRUNCATE booking_schema.outbox_events');
  });

  afterAll(async () => {
    await database.onModuleDestroy();
  });

  it('publishes once and never selects the completed record again', async () => {
    const eventId = await insertEvent(database, 'booking.confirmed.v1');
    const relay = new OutboxRelayService(outbox);
    const published = jest.spyOn((relay as any).logger, 'log');

    await relay.poll();
    const completed = await eventState(database, eventId);
    expect(completed).toMatchObject({ status: 'PUBLISHED', attempts: 1, last_error: null });
    expect(completed.published_at).not.toBeNull();
    expect(completed.lease_until).toBeNull();

    await relay.poll();
    expect(await eventState(database, eventId)).toEqual(completed);
    expect(published).toHaveBeenCalledTimes(1);
    expect(published.mock.calls[0][0]).toContain(eventId);
  });

  it('persists retry metadata across relay restart and succeeds once after recovery', async () => {
    const eventId = await insertEvent(database, 'booking.notes.requested.v1');
    const firstRelay = new OutboxRelayService(outbox);
    jest.spyOn(firstRelay as any, 'publish').mockRejectedValueOnce(new Error('private owner note: do not persist'));

    await firstRelay.poll();
    const failedAttempt = await eventState(database, eventId);
    expect(failedAttempt).toMatchObject({
      status: 'PENDING', attempts: 1, last_error: 'outbox delivery failed', published_at: null, lease_until: null,
    });
    expect(new Date(failedAttempt.available_at).getTime()).toBeGreaterThan(Date.now());

    await makeAvailable(database, eventId);
    const restartedRelay = new OutboxRelayService(new OutboxService(database));
    const published = jest.spyOn((restartedRelay as any).logger, 'log');
    await restartedRelay.poll();

    expect(await eventState(database, eventId)).toMatchObject({
      status: 'PUBLISHED', attempts: 2, last_error: null, lease_until: null,
    });
    expect(published).toHaveBeenCalledTimes(1);
  });

  it('allows only one of two workers to claim a record and recovers an abandoned lease', async () => {
    const eventId = await insertEvent(database, 'booking.confirmed.v1');
    const secondOutbox = new OutboxService(database);
    const [left, right] = await Promise.all([outbox.claimBatch(1), secondOutbox.claimBatch(1)]);
    expect([...left, ...right].map((event) => event.id)).toEqual([eventId]);
    expect(await eventState(database, eventId)).toMatchObject({ status: 'LEASED', attempts: 1 });

    await database.query(`
      UPDATE booking_schema.outbox_events SET lease_until = clock_timestamp() - interval '1 second'
      WHERE id = $1
    `, [eventId]);
    const recovered = await secondOutbox.claimBatch(1);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({ id: eventId, attempts: 2 });

    expect(await outbox.markPublished(eventId, [...left, ...right][0].lease_token)).toBe(false);
    expect(await outbox.releaseForRetry(eventId, [...left, ...right][0].lease_token, 'stale worker')).toBeUndefined();
    expect(await eventState(database, eventId)).toMatchObject({
      status: 'LEASED', attempts: 2,
    });
    expect(await secondOutbox.markPublished(eventId, recovered[0].lease_token)).toBe(true);
    expect(await eventState(database, eventId)).toMatchObject({ status: 'PUBLISHED', attempts: 2, lease_until: null });
  });

  it('isolates poison events, stops them at the terminal limit and keeps errors free of payload data', async () => {
    const poisonId = await insertEvent(database, 'booking.notes.requested.v1', { ownerNote: 'sensitive-owner-note' });
    const validId = await insertEvent(database, 'booking.confirmed.v1');
    const relay = new OutboxRelayService(outbox);
    const originalPublish = (relay as any).publish.bind(relay);
    jest.spyOn(relay as any, 'publish').mockImplementation(async (...args: unknown[]) => {
      const event = args[0] as { id: string };
      if (event.id === poisonId) throw new Error('sensitive-owner-note');
      return originalPublish(event);
    });
    const terminalLog = jest.spyOn((relay as any).logger, 'error');

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await relay.poll();
      if (attempt < 5) await makeAvailable(database, poisonId);
    }

    expect(await eventState(database, validId)).toMatchObject({ status: 'PUBLISHED', attempts: 1 });
    expect(await eventState(database, poisonId)).toMatchObject({
      status: 'FAILED', attempts: 5, last_error: 'outbox delivery failed', published_at: null, lease_until: null,
    });
    await relay.poll();
    expect((await eventState(database, poisonId)).attempts).toBe(5);
    expect(terminalLog).toHaveBeenCalledTimes(1);
    expect(terminalLog.mock.calls[0][0]).toContain(poisonId);
    expect(terminalLog.mock.calls[0][0]).not.toContain('sensitive-owner-note');
  });

  it('rolls an outbox insert back with its transaction', async () => {
    const eventId = randomUUID();
    await expect(database.withTransaction(async (client) => {
      await client.query(`
        INSERT INTO booking_schema.outbox_events
          (id, event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key)
        VALUES ($1, 'booking.confirmed.v1', 'booking_hold', $2, 2, '{}'::jsonb, $3)
      `, [eventId, randomUUID(), `rollback:${eventId}`]);
      throw new Error('controlled rollback');
    })).rejects.toThrow('controlled rollback');
    expect((await database.query('SELECT id FROM booking_schema.outbox_events WHERE id = $1', [eventId])).rowCount).toBe(0);
  });
});

async function insertEvent(database: DatabaseService, eventType: string, payload: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  await database.query(`
    INSERT INTO booking_schema.outbox_events
      (id, event_type, correlation_id, aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key)
    VALUES ($1, $2, $3, 'booking_hold', $4, 2, $5::jsonb, $6)
  `, [id, eventType, randomUUID(), randomUUID(), JSON.stringify(payload), `test:${id}`]);
  return id;
}

async function eventState(database: DatabaseService, eventId: string): Promise<any> {
  return (await database.query(`
    SELECT status, attempts, available_at, lease_until, published_at, last_error
    FROM booking_schema.outbox_events WHERE id = $1
  `, [eventId])).rows[0];
}

async function makeAvailable(database: DatabaseService, eventId: string): Promise<void> {
  await database.query(`
    UPDATE booking_schema.outbox_events SET available_at = clock_timestamp() - interval '1 second'
    WHERE id = $1 AND status = 'PENDING'
  `, [eventId]);
}
