import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from 'pg';

jest.setTimeout(120_000);

describe('migration checksum preflight', () => {
  it('accepts only empty or internally consistent execution/checksum history', async () => {
    await withDatabase(async (client, databaseUrl) => {
      expect(runPreflight(databaseUrl)).toEqual({ ok: true, output: expect.any(String) });

      await client.query(`${checksumTableSql}
        INSERT INTO public.schema_migration_checksums(file_name, sha256)
        VALUES ('1719110000000_init_schemas_and_booking_core.js', repeat('0', 64));`);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('Migration checksum registry exists without migration execution history') });

      await client.query(`DROP TABLE public.schema_migration_checksums; ${migrationTableSql}
        INSERT INTO public.schema_migrations(name) VALUES ('1719110000000_init_schemas_and_booking_core');`);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('Migration checksum registry is missing for an existing migration history') });

      await client.query(checksumTableSql);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('Checksum is missing for applied migration: 1719110000000_init_schemas_and_booking_core.js') });

      await client.query(`TRUNCATE public.schema_migrations; INSERT INTO public.schema_migrations(name) VALUES ('9999999999999_missing_history');`);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('Applied migration file is missing: 9999999999999_missing_history.js') });

      const file = '1719110000000_init_schemas_and_booking_core.js';
      const hash = createHash('sha256').update(readFileSync(join(process.cwd(), 'migrations/node-pg', file))).digest('hex');
      await client.query(`TRUNCATE public.schema_migrations, public.schema_migration_checksums;
        INSERT INTO public.schema_migrations(name) VALUES ('1719110000000_init_schemas_and_booking_core');`);
      await client.query('INSERT INTO public.schema_migration_checksums(file_name, sha256) VALUES ($1, $2)', [file, hash]);
      expect(runPreflight(databaseUrl)).toEqual({ ok: true, output: expect.any(String) });
    });
  });

  it('rejects historical drift before any pending migration writes schema', async () => {
    await withDatabase(async (client, databaseUrl) => {
      await client.query(`
        ${migrationTableSql}
        ${checksumTableSql}
        INSERT INTO public.schema_migrations(name)
        VALUES ('1719110000000_init_schemas_and_booking_core');
        INSERT INTO public.schema_migration_checksums(file_name, sha256)
        VALUES ('1719110000000_init_schemas_and_booking_core.js', repeat('0', 64));
      `);

      const { ok, output } = runCommand('migrate:up', databaseUrl);

      expect(ok).toBe(false);
      expect(output).toContain('Migration checksum mismatch: 1719110000000_init_schemas_and_booking_core.js');
      expect((await client.query('SELECT count(*)::int count FROM public.schema_migrations')).rows[0].count).toBe(1);
      expect((await client.query("SELECT to_regclass('identity_schema.users') value")).rows[0].value).toBeNull();
    });
  });

  it('attests only the exact 171961/171962 legacy state and supports normal forward migration', async () => {
    await withDatabase(async (client, databaseUrl) => {
      expect(runCommand('migrate:up', databaseUrl)).toMatchObject({ ok: true });
      const exact = runPreflight(databaseUrl);
      expect(exact.ok).toBe(true);
      expect(exact.output).not.toContain('LEGACY_MIGRATION_ATTESTATION_USED');

      const initial = await historyCounts(client);
      expect(initial).toEqual({ migrations: 69, checksums: 69 });
      await setLegacyState(client);

      const attested = runPreflight(databaseUrl);
      expect(attested).toMatchObject({ ok: true });
      expect(attested.output).toContain('LEGACY_MIGRATION_ATTESTATION_USED=171961');
      expect(attested.output).toContain('LEGACY_MIGRATION_ATTESTATION_USED=171962');
      expect(attested.output.match(/LEGACY_PROVENANCE=UNKNOWN/g)).toHaveLength(2);

      const originalFunction = (await client.query(`SELECT pg_get_functiondef(p.oid) definition FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='clinical_schema' AND p.proname='protect_published_clinical_data'`)).rows[0].definition;
      await client.query(`CREATE OR REPLACE FUNCTION clinical_schema.protect_published_clinical_data()
        RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$`);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('171961:function:protect_published_clinical_data') });
      await client.query(originalFunction);

      await client.query('ALTER TABLE clinical_schema.visit_results DISABLE TRIGGER visit_results_immutability_trigger');
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('171961:trigger:visit_results_immutability_trigger') });
      await client.query('ALTER TABLE clinical_schema.visit_results ENABLE TRIGGER visit_results_immutability_trigger');

      const originalTrigger = (await client.query(`SELECT pg_get_triggerdef(t.oid, true) definition FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='clinical_schema' AND c.relname='visit_results' AND t.tgname='visit_results_immutability_trigger'`)).rows[0].definition;
      await client.query('DROP TRIGGER visit_results_immutability_trigger ON clinical_schema.visit_results');
      await client.query(`CREATE TRIGGER visit_results_immutability_trigger BEFORE INSERT ON clinical_schema.visit_results
        FOR EACH ROW EXECUTE FUNCTION clinical_schema.protect_published_clinical_data()`);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('171961:trigger:visit_results_immutability_trigger') });
      await client.query('DROP TRIGGER visit_results_immutability_trigger ON clinical_schema.visit_results');
      await client.query(originalTrigger);

      await client.query('ALTER TABLE clinical_schema.visits DROP CONSTRAINT visits_appointment_context_fkey');
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('171961:constraint:visits_appointment_context_fkey') });
      await client.query(`ALTER TABLE clinical_schema.visits ADD CONSTRAINT visits_appointment_context_fkey
        FOREIGN KEY (appointment_id, booking_hold_id, owner_id, location_id, slot_id)
        REFERENCES booking_schema.appointments (id, hold_id, owner_id, clinic_location_id, slot_id) ON DELETE RESTRICT`);

      await client.query("UPDATE public.schema_migration_checksums SET sha256=repeat('0',64) WHERE file_name=$1", [migration171961File]);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining(`Migration checksum mismatch: ${migration171961File}`) });
      await client.query('UPDATE public.schema_migration_checksums SET sha256=$1 WHERE file_name=$2', [legacy171961Sha, migration171961File]);

      await withBackendCopy((backendCopy) => {
        appendFileSync(join(backendCopy, 'migrations/node-pg', migration171961File), '\n// test-only artifact drift\n');
        expect(runPreflight(databaseUrl, backendCopy)).toMatchObject({ ok: false, output: expect.stringContaining(`Legacy migration current artifact mismatch: ${migration171961File}`) });
      });

      await client.query('ALTER TABLE clinical_schema.visit_results DROP CONSTRAINT visit_results_visit_key');
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining('171962:constraint:visit_results_visit_key') });
      await client.query('ALTER TABLE clinical_schema.visit_results ADD CONSTRAINT visit_results_visit_key UNIQUE (visit_id)');

      await client.query('DELETE FROM public.schema_migration_checksums WHERE file_name=$1', [migration171960File]);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining(`Checksum is missing for applied migration: ${migration171960File}`) });
      await registerCurrentChecksum(client, migration171960File);

      await client.query("UPDATE public.schema_migration_checksums SET sha256=repeat('0',64) WHERE file_name=$1", [migration171960File]);
      expect(runPreflight(databaseUrl)).toMatchObject({ ok: false, output: expect.stringContaining(`Migration checksum mismatch: ${migration171960File}`) });
      await registerCurrentChecksum(client, migration171960File);

      await withBackendCopy(async (backendCopy) => {
        const futureFile = '9999999999999_test_only_attested_forward.js';
        writeFileSync(join(backendCopy, 'migrations/node-pg', futureFile), `exports.up = (pgm) => pgm.sql('CREATE TABLE public.attested_forward_probe(id integer PRIMARY KEY)');\nexports.down = (pgm) => pgm.sql('DROP TABLE public.attested_forward_probe');\n`);
        const first = runCommand('migrate:up', databaseUrl, backendCopy);
        expect(first.ok).toBe(true);
        expect(first.output).toContain('LEGACY_MIGRATION_ATTESTATION_USED=171961');
        expect(first.output).toContain('LEGACY_MIGRATION_ATTESTATION_USED=171962');
        expect(await historyCounts(client)).toEqual({ migrations: 70, checksums: 69 });
        expect((await client.query('SELECT sha256 FROM public.schema_migration_checksums WHERE file_name=$1', [futureFile])).rows).toHaveLength(1);
        const second = runCommand('migrate:up', databaseUrl, backendCopy);
        expect(second.ok).toBe(true);
        expect(second.output).toContain('No migrations to run!');
        expect(await historyCounts(client)).toEqual({ migrations: 70, checksums: 69 });
      });
    });
  });
});

const migration171960File = '1719600000000_allow_terminal_reallocation_acceptance_lineage.js';
const migration171961File = '1719610000000_add_clinical_visit_result_foundation.js';
const legacy171961Sha = 'ecb597aa248f97418f17d05d807c452409a46868f15ae758f0a0fb41b309a7a3';

const migrationTableSql = `CREATE TABLE public.schema_migrations (
  id serial PRIMARY KEY, name text NOT NULL, run_on timestamptz NOT NULL DEFAULT clock_timestamp()
);`;
const checksumTableSql = `CREATE TABLE public.schema_migration_checksums (
  file_name text PRIMARY KEY, sha256 char(64) NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);`;

function runPreflight(databaseUrl: string, cwd = process.cwd()) { return runCommand('migrate:preflight', databaseUrl, cwd); }
function runCommand(script: string, databaseUrl: string, cwd = process.cwd()) {
  try {
    const output = execFileSync('npm', ['run', script], { cwd, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, output };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

async function setLegacyState(client: Client) {
  await client.query('UPDATE public.schema_migration_checksums SET sha256=$1 WHERE file_name=$2', [legacy171961Sha, migration171961File]);
  await client.query("DELETE FROM public.schema_migration_checksums WHERE file_name='1719620000000_enforce_one_clinical_result_per_visit.js'");
}

async function registerCurrentChecksum(client: Client, file: string) {
  const hash = createHash('sha256').update(readFileSync(join(process.cwd(), 'migrations/node-pg', file))).digest('hex');
  await client.query(`INSERT INTO public.schema_migration_checksums(file_name, sha256) VALUES ($1, $2)
    ON CONFLICT (file_name) DO UPDATE SET sha256=excluded.sha256`, [file, hash]);
}

async function historyCounts(client: Client) {
  const result = await client.query(`SELECT
    (SELECT count(*)::integer FROM public.schema_migrations) migrations,
    (SELECT count(*)::integer FROM public.schema_migration_checksums) checksums`);
  return result.rows[0] as { migrations: number; checksums: number };
}

async function withBackendCopy(run: (backendCopy: string) => void | Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'vethelp-attestation-'));
  const backendCopy = join(root, 'backend');
  try {
    mkdirSync(join(backendCopy, 'scripts'), { recursive: true });
    mkdirSync(join(backendCopy, 'migrations/node-pg'), { recursive: true });
    copyFileSync(join(process.cwd(), 'package.json'), join(backendCopy, 'package.json'));
    for (const file of ['verify-migration-checksums.cjs', 'legacy-migration-attestations.cjs']) {
      copyFileSync(join(process.cwd(), 'scripts', file), join(backendCopy, 'scripts', file));
    }
    for (const file of readdirSync(join(process.cwd(), 'migrations/node-pg'))) {
      if (/^\d+_.+\.js$/.test(file)) copyFileSync(join(process.cwd(), 'migrations/node-pg', file), join(backendCopy, 'migrations/node-pg', file));
    }
    symlinkSync(join(process.cwd(), 'node_modules'), join(backendCopy, 'node_modules'));
    await run(backendCopy);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function withDatabase(run: (client: Client, databaseUrl: string) => Promise<void>) {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error('DATABASE_URL is required');
  const admin = new Client({ connectionString: configured });
  const name = `vethelp_migration_preflight_${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const target = new URL(configured);
  target.pathname = `/${name}`;
  let client: Client | null = null;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    client = new Client({ connectionString: target.toString() });
    await client.connect();
    await run(client, target.toString());
  } finally {
    await client?.end();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [name]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  }
}
