import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';

jest.setTimeout(120_000);

const MIGRATIONS = [
  '1719630000000_add_clinic_booking_contract_profile.js',
  '1719640000000_harden_clinic_booking_contract_profile_audit.js',
  '1719650000000_protect_clinic_booking_contract_profile_audit.js',
] as const;

describe('v1.5 clinic contract profile migration (real PostgreSQL)', () => {
  it('applies the complete canonical chain on a fresh database', async () => {
    await withDatabase(async ({ client, databaseUrl, migrationDir }) => {
      copyCanonicalMigrations(migrationDir, true);
      migrate('up', databaseUrl, migrationDir);
      const columns = await client.query<{ column_name: string; column_default: string | null }>(`
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_schema='clinic_schema' AND table_name='clinics'
          AND column_name LIKE 'booking_contract_profile%'
        ORDER BY column_name
      `);
      expect(columns.rows.map((row) => row.column_name)).toEqual([
        'booking_contract_profile',
        'booking_contract_profile_updated_at',
        'booking_contract_profile_version',
      ]);
      expect(columns.rows.find((row) => row.column_name === 'booking_contract_profile')?.column_default)
        .toContain('MVP_V1_MANUAL');
      expect(() => migrate('down', databaseUrl, migrationDir)).toThrow();
      const ledger = await client.query(`SELECT name FROM public.schema_migrations WHERE name='1719650000000_protect_clinic_booking_contract_profile_audit'`);
      expect(ledger.rows).toHaveLength(1);
      const retained = await client.query(`
        SELECT COUNT(*)::int count FROM information_schema.columns
        WHERE table_schema='clinic_schema' AND table_name='clinics'
          AND column_name='booking_contract_profile'
      `);
      expect(retained.rows[0].count).toBe(1);
    });
  });

  it('upgrades populated current schema, audits policy changes and refuses destructive schema rollback', async () => {
    await withDatabase(async ({ client, databaseUrl, migrationDir }) => {
      copyCanonicalMigrations(migrationDir, false);
      migrate('up', databaseUrl, migrationDir);
      const clinic = await client.query<{ id: string }>(`
        INSERT INTO clinic_schema.clinics (legal_name, public_name)
        VALUES ('Upgrade LLC', 'Upgrade clinic') RETURNING id
      `);
      for (const migration of MIGRATIONS) {
        copyFileSync(join(process.cwd(), 'migrations/node-pg', migration), join(migrationDir, migration));
      }
      migrate('up', databaseUrl, migrationDir);

      const initial = await client.query(`
        SELECT booking_contract_profile, booking_contract_profile_version
        FROM clinic_schema.clinics WHERE id=$1
      `, [clinic.rows[0].id]);
      expect(initial.rows[0]).toEqual({ booking_contract_profile: 'MVP_V1_MANUAL', booking_contract_profile_version: 1 });
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.change_reference','WAVE1-ACCEPTANCE',true)");
      await client.query("UPDATE clinic_schema.clinics SET booking_contract_profile='V15_AUTO_CONFIRM' WHERE id=$1", [clinic.rows[0].id]);
      await client.query('COMMIT');
      const history = await client.query(`
        SELECT version, contract_profile, changed_by, change_reference
        FROM audit_schema.clinic_booking_contract_profile_audit
        WHERE clinic_id=$1 ORDER BY version
      `, [clinic.rows[0].id]);
      expect(history.rows).toEqual([
        { version: 1, contract_profile: 'MVP_V1_MANUAL', changed_by: 'vethelp', change_reference: 'wave1-initial-backfill' },
        { version: 2, contract_profile: 'V15_AUTO_CONFIRM', changed_by: 'vethelp', change_reference: 'WAVE1-ACCEPTANCE' },
      ]);

      await expect(client.query(`UPDATE audit_schema.clinic_booking_contract_profile_audit SET change_reference='tampered' WHERE clinic_id=$1`, [clinic.rows[0].id]))
        .rejects.toThrow(/append-only/);
      await expect(client.query(`DELETE FROM audit_schema.clinic_booking_contract_profile_audit WHERE clinic_id=$1`, [clinic.rows[0].id]))
        .rejects.toThrow(/append-only/);
      await expect(client.query('TRUNCATE audit_schema.clinic_booking_contract_profile_audit'))
        .rejects.toThrow(/append-only/);
      expect(() => migrate('down', databaseUrl, migrationDir)).toThrow();
      const ledger = await client.query(`SELECT name FROM public.schema_migrations WHERE name='1719650000000_protect_clinic_booking_contract_profile_audit'`);
      expect(ledger.rows).toHaveLength(1);
      const preserved = await client.query('SELECT id::text FROM clinic_schema.clinics WHERE id=$1', [clinic.rows[0].id]);
      expect(preserved.rows).toEqual([{ id: clinic.rows[0].id }]);
      const archived = await client.query(`
        SELECT version, contract_profile, changed_by, change_reference
        FROM audit_schema.clinic_booking_contract_profile_audit
        WHERE clinic_id=$1 ORDER BY version
      `, [clinic.rows[0].id]);
      expect(archived.rows).toEqual(history.rows);
    });
  });
});

function copyCanonicalMigrations(target: string, includeWave1: boolean): void {
  const source = join(process.cwd(), 'migrations/node-pg');
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(source).filter((name) => name.endsWith('.js'))) {
    if (!includeWave1 && (MIGRATIONS as readonly string[]).includes(file)) continue;
    copyFileSync(join(source, file), join(target, file));
  }
}

function migrate(direction: 'up' | 'down', databaseUrl: string, migrationDir: string): void {
  execFileSync(join(process.cwd(), 'node_modules/.bin/node-pg-migrate'), [
    direction,
    '--migrations-dir', migrationDir,
    '--migrations-schema', 'public',
    '--migrations-table', 'schema_migrations',
    '--single-transaction',
  ], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
}

async function withDatabase(assertion: (context: { client: Client; databaseUrl: string; migrationDir: string }) => Promise<void>): Promise<void> {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) throw new Error('DATABASE_URL is required');
  const admin = new Client({ connectionString: configuredUrl });
  const databaseName = `vethelp_v15_${process.pid}_${Date.now()}`;
  const target = new URL(configuredUrl);
  target.pathname = `/${databaseName}`;
  const migrationDir = mkdtempSync(join(tmpdir(), 'vethelp-v15-migrations-'));
  let client: Client | null = null;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    client = new Client({ connectionString: target.toString() });
    await client.connect();
    await assertion({ client, databaseUrl: target.toString(), migrationDir });
  } finally {
    if (client) await client.end();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
    rmSync(migrationDir, { recursive: true, force: true });
  }
}
