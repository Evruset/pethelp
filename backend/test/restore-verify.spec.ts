import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

const enabled = process.env.NODE_ENV === 'restore-verify' && process.env.RESTORE_VERIFY_ENABLED === 'true';
const suite = enabled ? describe : describe.skip;
const databaseUrl = process.env.RESTORE_VERIFY_DATABASE_URL;
const requiredMigration = process.env.RESTORE_VERIFY_REQUIRED_MIGRATION ?? '1719131000000_add_emergency_ops_reviews';
const expectedLedgerFingerprint = process.env.RESTORE_VERIFY_LEDGER_FINGERPRINT;
const migrationsDir = path.resolve(process.cwd(), 'migrations/node-pg');

suite('Post-restore verification drill', () => {
  let client: Client;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('RESTORE_VERIFY_DATABASE_URL is required for restore verification');
    if (!expectedLedgerFingerprint) throw new Error('RESTORE_VERIFY_LEDGER_FINGERPRINT must be captured before pg_restore');
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterAll(async () => client?.end());

  it('contains all repository migrations through the Emergency Ops migration floor', async () => {
    const migrations = await localMigrations();
    const applied = await client.query<{ name: string }>('SELECT name FROM public.schema_migrations ORDER BY id');
    const names = new Set(applied.rows.map((row) => normalize(row.name)));
    expect(names.has(normalize(requiredMigration))).toBe(true);
    migrations.forEach((migration) => expect(names.has(normalize(migration))).toBe(true));
  });

  it('validates restored migration checksums against repository source', async () => {
    const migrations = await localMigrations();
    const checksums = await client.query<{ file_name: string; sha256: string }>('SELECT file_name, sha256 FROM public.schema_migration_checksums');
    const stored = new Map(checksums.rows.map((row) => [normalize(row.file_name), row.sha256]));
    for (const migration of migrations) {
      const expected = createHash('sha256').update(await readFile(path.join(migrationsDir, migration))).digest('hex');
      expect(stored.get(normalize(migration))).toBe(expected);
    }
  });

  it('keeps slot held counters and capacity invariants after restore', async () => {
    const invalid = await client.query<{ slot_id: string }>(`
      WITH active_holds AS (
        SELECT slot_id, COUNT(*)::integer AS active_holds
        FROM booking_schema.booking_holds
        WHERE state IN (
          'MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING',
          'MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING', 'MIS_HELD',
          'PAYMENT_PENDING', 'PAYMENT_IN_PROGRESS', 'PAYMENT_RECONCILIATION_PENDING'
        )
        GROUP BY slot_id
      )
      SELECT s.id::text AS slot_id
      FROM clinic_schema.appointment_slots s
      LEFT JOIN active_holds h ON h.slot_id = s.id
      WHERE s.held_count <> COALESCE(h.active_holds, 0)
         OR s.held_count < 0
         OR s.booked_count < 0
         OR s.held_count + s.booked_count > s.capacity
    `);
    expect(invalid.rows).toEqual([]);
  });

  it('keeps ledger records identical to the pre-restore fingerprint and restores immutable trigger', async () => {
    expect(await ledgerFingerprint(client)).toBe(expectedLedgerFingerprint);
    const trigger = await client.query<{ trigger_definition: string }>(`
      SELECT pg_get_triggerdef(trigger.oid) AS trigger_definition
      FROM pg_trigger trigger
      JOIN pg_class table_ref ON table_ref.oid = trigger.tgrelid
      JOIN pg_namespace schema_ref ON schema_ref.oid = table_ref.relnamespace
      WHERE schema_ref.nspname = 'payment_schema'
        AND table_ref.relname = 'ledger_entries'
        AND trigger.tgname = 'ledger_entries_immutable'
        AND NOT trigger.tgisinternal
    `);
    expect(trigger.rows).toHaveLength(1);
    expect(trigger.rows[0].trigger_definition).toMatch(/BEFORE UPDATE OR DELETE/i);
  });
});

async function localMigrations(): Promise<string[]> {
  return (await readdir(migrationsDir)).filter((name) => /^\d+_.+\.js$/.test(name)).sort();
}

async function ledgerFingerprint(client: Client): Promise<string> {
  const rows = await client.query(`
    SELECT id::text, payment_intent_id::text, entry_type, amount::text, currency,
           idempotency_key, provider_event_id, correlation_id::text, payload_json,
           created_at::text
    FROM payment_schema.ledger_entries
    ORDER BY id
  `);
  return createHash('sha256').update(JSON.stringify(rows.rows)).digest('hex');
}

function normalize(name: string): string {
  return name.replace(/\.js$/, '');
}
