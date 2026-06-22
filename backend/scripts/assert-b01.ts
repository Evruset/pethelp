import { Client } from 'pg';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const slotId = required('B01_SLOT_ID');
  const client = new Client({ connectionString: required('DATABASE_URL') });
  await client.connect();
  try {
    const slot = await client.query<{ capacity: number; held_count: number; booked_count: number }>(`
      SELECT capacity, held_count, booked_count
      FROM clinic_schema.appointment_slots
      WHERE id = $1
    `, [slotId]);
    const holds = await client.query<{ count: string }>(`
      SELECT count(*)
      FROM booking_schema.booking_holds
      WHERE slot_id = $1 AND state = 'MANUAL_CONFIRM_PENDING'
    `, [slotId]);
    const outbox = await client.query<{ count: string }>(`SELECT count(*) FROM booking_schema.outbox_events WHERE event_type = 'booking.hold.created.v1'`);
    const idempotency = await client.query<{ count: string }>(`SELECT count(*) FROM booking_schema.idempotency_records`);
    const idleInTransaction = await client.query<{ count: string }>(`
      SELECT count(*)
      FROM pg_stat_activity
      WHERE datname = current_database() AND state = 'idle in transaction'
    `);

    const actual = {
      slot: slot.rows[0],
      activeHolds: Number(holds.rows[0].count),
      createdOutboxEvents: Number(outbox.rows[0].count),
      completedIdempotencyRecords: Number(idempotency.rows[0].count),
      idleInTransactionConnections: Number(idleInTransaction.rows[0].count),
    };

    const valid = actual.slot?.capacity === 1 &&
      actual.slot.held_count === 1 &&
      actual.slot.booked_count === 0 &&
      actual.activeHolds === 1 &&
      actual.createdOutboxEvents === 1 &&
      actual.completedIdempotencyRecords === 1 &&
      actual.idleInTransactionConnections === 0;

    if (!valid) throw new Error(`B-01 invariant failed: ${JSON.stringify(actual)}`);
    process.stdout.write(`${JSON.stringify(actual)}\n`);
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
