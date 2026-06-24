import { createHash } from 'node:crypto';
import { Client } from 'pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const rows = await client.query(`
      SELECT id::text, payment_intent_id::text, entry_type, amount::text, currency,
             idempotency_key, provider_event_id, correlation_id::text, payload_json,
             created_at::text
      FROM payment_schema.ledger_entries
      ORDER BY id
    `);
    process.stdout.write(createHash('sha256').update(JSON.stringify(rows.rows)).digest('hex'));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
