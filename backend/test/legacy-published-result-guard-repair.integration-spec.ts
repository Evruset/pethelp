import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from 'pg';

jest.setTimeout(180_000);

const repairFile = '1719630000000_repair_published_clinical_data_immutability.js';
const consentFile = '1719640000000_add_doctor_public_profile_consent_events.js';
const repairName = repairFile.slice(0, -3);
const migration171961File = '1719610000000_add_clinical_visit_result_foundation.js';
const migration171962File = '1719620000000_enforce_one_clinical_result_per_visit.js';
const legacy171961Sha = 'ecb597aa248f97418f17d05d807c452409a46868f15ae758f0a0fb41b309a7a3';
const canonicalFunctionSha = '674cb89be31a3905e533af7f46ca0d5e0bf45a05c85a3a0f44532a24f5b4d4a0';
const repairSha = 'c47aae64033d546512f14190e7938c38ae8208de400f7fda0deeb2b9f005ed52';

describe('legacy published-result guard repair', () => {
  it('fails closed for every non-exact repair state, then repairs through normal migration mechanics', async () => {
    await withDatabase(async (client, databaseUrl) => {
      await withBackendCopy(async (backendCopy) => {
        const copiedRepair = join(backendCopy, 'migrations/node-pg', repairFile);
        const copiedConsent = join(backendCopy, 'migrations/node-pg', consentFile);
        rmSync(copiedRepair);
        rmSync(copiedConsent);
        expect(runCommand('migrate:up', databaseUrl, backendCopy).ok).toBe(true);
        copyFileSync(join(process.cwd(), 'migrations/node-pg', repairFile), copiedRepair);
        copyFileSync(join(process.cwd(), 'migrations/node-pg', consentFile), copiedConsent);
        await installLegacyState(client);
        await seedClinicalResult(client);

        await client.query("UPDATE clinical_schema.visit_results SET version=version+1 WHERE id='40000000-0000-0000-0000-000000000001'");
        expect((await client.query("SELECT version FROM clinical_schema.visit_results WHERE id='40000000-0000-0000-0000-000000000001'")).rows[0].version).toBe(2);

        const before = await repairState(client);
        expect(before).toMatchObject({ migrations: 67, checksums: 66, legacy171961: legacy171961Sha, legacy171962: 0, repairExecutions: 0, repairChecksums: 0 });

        await client.query('INSERT INTO public.schema_migration_checksums(file_name,sha256) VALUES ($1,$2)', [repairFile, repairSha]);
        expect(runCommand('migrate:repair-published-result-guard', databaseUrl, backendCopy)).toMatchObject({ ok: false, output: expect.stringContaining('exact authorized pre-repair state') });
        await client.query('DELETE FROM public.schema_migration_checksums WHERE file_name=$1', [repairFile]);

        await client.query("UPDATE public.schema_migration_checksums SET sha256=repeat('0',64) WHERE file_name=$1", [migration171961File]);
        expect(runCommand('migrate:repair-published-result-guard', databaseUrl, backendCopy)).toMatchObject({ ok: false });
        await client.query('UPDATE public.schema_migration_checksums SET sha256=$1 WHERE file_name=$2', [legacy171961Sha, migration171961File]);

        await client.query(`CREATE OR REPLACE FUNCTION clinical_schema.protect_published_clinical_data()
          RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$`);
        expect(runCommand('migrate:repair-published-result-guard', databaseUrl, backendCopy)).toMatchObject({ ok: false, output: expect.stringContaining('171961:function:protect_published_clinical_data') });
        await client.query(legacyFunctionSql);

        await client.query('DROP INDEX clinical_schema.visits_clinic_location_time_idx');
        expect(runCommand('migrate:repair-published-result-guard', databaseUrl, backendCopy)).toMatchObject({ ok: false, output: expect.stringContaining('171961:index:visits_clinic_location_time_idx') });
        await client.query('CREATE INDEX visits_clinic_location_time_idx ON clinical_schema.visits (clinic_id, location_id, completed_at DESC, id DESC)');

        await withMutatedBackend(backendCopy, migration171961File, (mutated) => {
          expect(runCommand('migrate:repair-published-result-guard', databaseUrl, mutated)).toMatchObject({ ok: false, output: expect.stringContaining(`Legacy migration current artifact mismatch: ${migration171961File}`) });
        });

        await client.query('ALTER TABLE clinical_schema.visit_results DROP CONSTRAINT visit_results_visit_key');
        expect(runCommand('migrate:repair-published-result-guard', databaseUrl, backendCopy)).toMatchObject({ ok: false, output: expect.stringContaining('171962:constraint:visit_results_visit_key') });
        await client.query('ALTER TABLE clinical_schema.visit_results ADD CONSTRAINT visit_results_visit_key UNIQUE (visit_id)');

        await client.query("INSERT INTO public.schema_migrations(name,run_on) VALUES ('1719625000000_unrelated_history_drift',clock_timestamp())");
        expect(runCommand('migrate:repair-published-result-guard', databaseUrl, backendCopy)).toMatchObject({ ok: false, output: expect.stringContaining('exact authorized pre-repair state') });
        await client.query("DELETE FROM public.schema_migrations WHERE name='1719625000000_unrelated_history_drift'");

        await withMutatedBackend(backendCopy, repairFile, (mutated) => {
          expect(runCommand('migrate:repair-published-result-guard', databaseUrl, mutated)).toMatchObject({ ok: false, output: expect.stringContaining(`Legacy repair migration artifact mismatch: ${repairFile}`) });
        });
        expect(await repairState(client)).toEqual(before);

        const repaired = runCommand('migrate:repair-published-result-guard', databaseUrl, backendCopy);
        if (!repaired.ok) throw new Error(repaired.output);
        expect(repaired.output).toContain('LEGACY_REPAIR_AUTHORIZATION=PASS');
        expect(repaired.output).toContain(`LEGACY_REPAIR_APPLIED=${repairName}`);
        expect(repaired.output).toContain(`LEGACY_REPAIR_FUNCTION_SHA256=${canonicalFunctionSha}`);
        expect(await repairState(client)).toMatchObject({ migrations: 68, checksums: 67, legacy171961: legacy171961Sha, legacy171962: 0, repairExecutions: 1, repairChecksums: 1 });
        expect((await client.query("SELECT count(*)::int count FROM public.schema_migrations WHERE name='1719640000000_add_doctor_public_profile_consent_events'")).rows[0].count).toBe(0);
        expect(await functionHash(client)).toBe(canonicalFunctionSha);

        await expect(client.query("UPDATE clinical_schema.visit_results SET version=version+1 WHERE id='40000000-0000-0000-0000-000000000001'")).rejects.toMatchObject({ code: '23514' });
        await expect(client.query("UPDATE clinical_schema.visit_results SET clinical_summary='Direct correction' WHERE id='40000000-0000-0000-0000-000000000001'")).rejects.toMatchObject({ code: '23514' });
        await expect(client.query("DELETE FROM clinical_schema.visit_results WHERE id='40000000-0000-0000-0000-000000000001'")).rejects.toMatchObject({ code: '23514' });
        await client.query("UPDATE clinical_schema.visit_results SET clinical_summary='Editable draft' WHERE id='40000000-0000-0000-0000-000000000002'");
        await client.query('BEGIN');
        await client.query(`INSERT INTO clinical_schema.visit_result_amendments
          (id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,idempotency_key)
          VALUES ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','Append-only correction','50000000-0000-0000-0000-000000000002')`);
        await client.query(`INSERT INTO clinical_schema.diary_entries
          (owner_id,pet_id,visit_id,source_amendment_id,occurred_at)
          VALUES ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',clock_timestamp())`);
        await client.query('COMMIT');

        const second = runCommand('migrate:repair-published-result-guard', databaseUrl, backendCopy);
        expect(second).toMatchObject({ ok: true, output: expect.stringContaining(`LEGACY_REPAIR_ALREADY_APPLIED=${repairName}`) });
        expect(await repairState(client)).toMatchObject({ migrations: 68, checksums: 67 });
        const normal = runCommand('migrate:up', databaseUrl, backendCopy);
        expect(normal).toMatchObject({ ok: true, output: expect.stringContaining('1719640000000_add_doctor_public_profile_consent_events') });
        expect(await repairState(client)).toMatchObject({ migrations: 69, checksums: 68 });
      });
    });
  });
});

const legacyFunctionSql = `CREATE OR REPLACE FUNCTION clinical_schema.protect_published_clinical_data()
RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME <> 'visit_results' THEN
          RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_RECORD' USING ERRCODE = '23514';
        END IF;
        IF OLD.status = 'PUBLISHED' THEN
          RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_RECORD' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
      END IF;

      IF TG_TABLE_NAME = 'visit_results' THEN
        IF OLD.status = 'PUBLISHED' AND (
          NEW.status IS DISTINCT FROM OLD.status OR
          NEW.clinical_summary IS DISTINCT FROM OLD.clinical_summary OR
          NEW.visit_id IS DISTINCT FROM OLD.visit_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
          NEW.pet_id IS DISTINCT FROM OLD.pet_id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR
          NEW.location_id IS DISTINCT FROM OLD.location_id OR NEW.author_id IS DISTINCT FROM OLD.author_id OR
          NEW.published_at IS DISTINCT FROM OLD.published_at
        ) THEN
          RAISE EXCEPTION 'W7A_PUBLISHED_RESULT_IMMUTABLE' USING ERRCODE = '23514';
        END IF;
      ELSE
        RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_PROJECTION' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$`;

async function installLegacyState(client: Client) {
  await client.query(legacyFunctionSql);
  await client.query('UPDATE public.schema_migration_checksums SET sha256=$1 WHERE file_name=$2', [legacy171961Sha, migration171961File]);
  await client.query('DELETE FROM public.schema_migration_checksums WHERE file_name=$1', [migration171962File]);
}

async function seedClinicalResult(client: Client) {
  await client.query(`
    INSERT INTO identity_schema.users(id) VALUES ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
    INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES ('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Pet','CAT');
    INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES ('10000000-0000-0000-0000-000000000004','Clinic','Clinic');
    INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,timezone) VALUES ('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000004','Address','Europe/Moscow');
    INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,starts_at,ends_at) VALUES
      ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000005',clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 1 hour'),
      ('10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000005',clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 1 hour');
    INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','CONFIRMED',clock_timestamp()+interval '1 day'),
      ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','CONFIRMED',clock_timestamp()+interval '2 days');
    INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id) VALUES
      ('20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000006'),
      ('20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000007');
    INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES
      ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002'),
      ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000002');
  `);
  await client.query('BEGIN');
  await client.query(`INSERT INTO clinical_schema.visit_results(id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,status,clinical_summary,idempotency_key,published_at)
    VALUES ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','PUBLISHED','Published result','40000000-0000-0000-0000-000000000002',clock_timestamp())`);
  await client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,occurred_at)
    VALUES ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',clock_timestamp())`);
  await client.query('COMMIT');
  await client.query(`INSERT INTO clinical_schema.visit_results(id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key)
    VALUES ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','Draft result','40000000-0000-0000-0000-000000000003')`);
}

async function functionHash(client: Client) {
  const result = await client.query(`SELECT pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='clinical_schema' AND p.proname='protect_published_clinical_data'`);
  return createHash('sha256').update(result.rows[0].definition).digest('hex');
}

async function repairState(client: Client) {
  const result = await client.query(`SELECT
    (SELECT count(*)::integer FROM public.schema_migrations) migrations,
    (SELECT count(*)::integer FROM public.schema_migration_checksums) checksums,
    (SELECT sha256 FROM public.schema_migration_checksums WHERE file_name=$1) "legacy171961",
    (SELECT count(*)::integer FROM public.schema_migration_checksums WHERE file_name=$2) "legacy171962",
    (SELECT count(*)::integer FROM public.schema_migrations WHERE name=$3) "repairExecutions",
    (SELECT count(*)::integer FROM public.schema_migration_checksums WHERE file_name=$4) "repairChecksums"`,
  [migration171961File, migration171962File, repairName, repairFile]);
  return result.rows[0];
}

function runCommand(script: string, databaseUrl: string, cwd: string) {
  try {
    const output = execFileSync('npm', ['run', script], { cwd, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, output };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

async function withMutatedBackend(source: string, file: string, run: (copy: string) => void | Promise<void>) {
  await withBackendCopy(async (copy) => {
    copyFileSync(join(source, 'package.json'), join(copy, 'package.json'));
    for (const script of ['verify-migration-checksums.cjs', 'legacy-migration-attestations.cjs', 'repair-legacy-published-result-guard.cjs']) copyFileSync(join(source, 'scripts', script), join(copy, 'scripts', script));
    for (const migration of readdirSync(join(source, 'migrations/node-pg'))) copyFileSync(join(source, 'migrations/node-pg', migration), join(copy, 'migrations/node-pg', migration));
    writeFileSync(join(copy, 'migrations/node-pg', file), `${readFileSync(join(copy, 'migrations/node-pg', file), 'utf8')}\n// test drift\n`);
    await run(copy);
  });
}

async function withBackendCopy(run: (copy: string) => void | Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'vethelp-r4-'));
  const copy = join(root, 'backend');
  try {
    mkdirSync(join(copy, 'scripts'), { recursive: true });
    mkdirSync(join(copy, 'migrations/node-pg'), { recursive: true });
    copyFileSync(join(process.cwd(), 'package.json'), join(copy, 'package.json'));
    for (const script of ['verify-migration-checksums.cjs', 'legacy-migration-attestations.cjs', 'repair-legacy-published-result-guard.cjs']) copyFileSync(join(process.cwd(), 'scripts', script), join(copy, 'scripts', script));
    for (const migration of readdirSync(join(process.cwd(), 'migrations/node-pg'))) if (/^\d+_.+\.js$/.test(migration)) copyFileSync(join(process.cwd(), 'migrations/node-pg', migration), join(copy, 'migrations/node-pg', migration));
    symlinkSync(join(process.cwd(), 'node_modules'), join(copy, 'node_modules'));
    await run(copy);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function withDatabase(run: (client: Client, databaseUrl: string) => Promise<void>) {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error('DATABASE_URL is required');
  const admin = new Client({ connectionString: configured });
  const name = `vethelp_r4_${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const target = new URL(configured); target.pathname = `/${name}`;
  let client: Client | undefined;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    client = new Client({ connectionString: target.toString() }); await client.connect();
    await run(client, target.toString());
  } finally {
    await client?.end();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [name]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  }
}
