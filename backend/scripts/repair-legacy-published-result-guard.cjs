const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { Client } = require('pg');
const { verifyAppliedHistory } = require('./verify-migration-checksums.cjs');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const migrationsDir = resolve(process.cwd(), 'migrations/node-pg');
const repairName = '1719630000000_repair_published_clinical_data_immutability';
const repairFile = `${repairName}.js`;
const repairSha256 = 'c47aae64033d546512f14190e7938c38ae8208de400f7fda0deeb2b9f005ed52';
const legacyFunctionSha256 = 'b139058a999e4de6d57693ebfd831cb45ce201321894a24eecdf71cff1cb4078';
const canonicalFunctionSha256 = '674cb89be31a3905e533af7f46ca0d5e0bf45a05c85a3a0f44532a24f5b4d4a0';
const migration171961File = '1719610000000_add_clinical_visit_result_foundation.js';
const migration171962File = '1719620000000_enforce_one_clinical_result_per_visit.js';
const legacy171961Checksum = 'ecb597aa248f97418f17d05d807c452409a46868f15ae758f0a0fb41b309a7a3';

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function functionSha256(client) {
  const result = await client.query(`
    SELECT pg_get_functiondef(p.oid) definition FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'clinical_schema' AND p.proname = 'protect_published_clinical_data'
      AND pg_get_function_result(p.oid) = 'trigger'
  `);
  if (result.rows.length !== 1) throw new Error('Legacy repair function identity failed');
  return createHash('sha256').update(result.rows[0].definition).digest('hex');
}

async function verifyChecksumFileSet(client, expectedFiles, phase) {
  const result = await client.query('SELECT file_name FROM public.schema_migration_checksums ORDER BY file_name');
  const observed = result.rows.map((row) => row.file_name);
  if (JSON.stringify(observed) !== JSON.stringify([...expectedFiles].sort())) {
    throw new Error(`Legacy repair checksum registry differs from the exact ${phase} state`);
  }
}

async function main() {
  const files = (await readdir(migrationsDir)).filter((name) => /^\d+_.+\.js$/.test(name)).sort();
  const hashes = new Map(await Promise.all(files.map(async (file) => [file, await sha256(resolve(migrationsDir, file))])));
  const repairLineageFiles = files.filter((file) => file <= repairFile);
  if (!files.includes(repairFile) || hashes.get(repairFile) !== repairSha256) {
    throw new Error(`Legacy repair migration artifact mismatch: ${repairFile}`);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const before = await client.query('SELECT name FROM public.schema_migrations ORDER BY id');
    const appliedNames = before.rows.map((row) => row.name);
    const expectedBefore = repairLineageFiles.filter((file) => file !== repairFile).map((file) => file.slice(0, -3));
    if (appliedNames.includes(repairName)) {
      const appliedFiles = files.filter((file) => appliedNames.includes(file.slice(0, -3)));
      if (JSON.stringify(appliedNames) !== JSON.stringify(appliedFiles.map((file) => file.slice(0, -3)))
        || JSON.stringify(appliedFiles) !== JSON.stringify(files.slice(0, appliedFiles.length))) {
        throw new Error('Legacy repair execution history differs from the exact post-repair state');
      }
      await verifyAppliedHistory(client, appliedFiles, hashes);
      await verifyChecksumFileSet(client, appliedFiles.filter((file) => file !== migration171962File), 'post-repair');
      const repairChecksum = await client.query('SELECT sha256 FROM public.schema_migration_checksums WHERE file_name=$1', [repairFile]);
      if (repairChecksum.rows.length !== 1 || repairChecksum.rows[0].sha256 !== repairSha256
        || await functionSha256(client) !== canonicalFunctionSha256) {
        throw new Error('Legacy repair post-state verification failed');
      }
      console.log(`LEGACY_REPAIR_ALREADY_APPLIED=${repairName}`);
      return;
    }

    if (JSON.stringify(appliedNames) !== JSON.stringify(expectedBefore)) {
      throw new Error('Legacy repair execution history differs from the exact authorized pre-repair state');
    }
    await verifyChecksumFileSet(client,
      repairLineageFiles.filter((file) => file !== migration171962File && file !== repairFile), 'authorized pre-repair');
    const attested = await verifyAppliedHistory(client, repairLineageFiles, hashes, {
      schemaFunctionHashes: { 171961: { protect_published_clinical_data: legacyFunctionSha256 } },
      emitAudit: false,
    });
    if (JSON.stringify([...attested].sort()) !== JSON.stringify([migration171961File, migration171962File].sort())) {
      throw new Error('Legacy repair requires the exact 171961/171962 attestation pair');
    }
    if (await functionSha256(client) !== legacyFunctionSha256) {
      throw new Error('Legacy repair source function hash mismatch');
    }
    const legacyRows = await client.query(`SELECT file_name, sha256 FROM public.schema_migration_checksums
      WHERE file_name = ANY($1) ORDER BY file_name`, [[migration171961File, migration171962File]]);
    if (legacyRows.rows.length !== 1 || legacyRows.rows[0].file_name !== migration171961File
      || legacyRows.rows[0].sha256 !== legacy171961Checksum) {
      throw new Error('Legacy repair checksum state mismatch');
    }
    console.log('LEGACY_REPAIR_AUTHORIZATION=PASS');
    console.log('LEGACY_PROVENANCE=UNKNOWN');
  } finally {
    await client.end();
  }

  const runner = resolve(process.cwd(), 'node_modules/.bin/node-pg-migrate');
  execFileSync(runner, ['up', '1', '--migrations-dir', 'migrations/node-pg', '--migrations-schema', 'public',
    '--migrations-table', 'schema_migrations', '--single-transaction'], {
    cwd: process.cwd(), env: process.env, stdio: 'inherit',
  });
  execFileSync(process.execPath, ['scripts/verify-migration-checksums.cjs', '--write-missing', `--through-file=${repairFile}`], {
    cwd: process.cwd(), env: process.env, stdio: 'inherit',
  });

  const post = new Client({ connectionString: databaseUrl });
  await post.connect();
  try {
    const hashesAfter = new Map(await Promise.all(files.map(async (file) => [file, await sha256(resolve(migrationsDir, file))])));
    await verifyAppliedHistory(post, repairLineageFiles, hashesAfter);
    await verifyChecksumFileSet(post, repairLineageFiles.filter((file) => file !== migration171962File), 'post-repair');
    if (await functionSha256(post) !== canonicalFunctionSha256) throw new Error('Legacy repair canonical function verification failed');
    const state = await post.query(`SELECT
      (SELECT count(*)::integer FROM public.schema_migrations WHERE name=$1) repair_execution_count,
      (SELECT count(*)::integer FROM public.schema_migration_checksums WHERE file_name=$2 AND sha256=$3) repair_checksum_count,
      (SELECT sha256 FROM public.schema_migration_checksums WHERE file_name=$4) legacy_171961_checksum,
      (SELECT count(*)::integer FROM public.schema_migration_checksums WHERE file_name=$5) legacy_171962_checksum_count`,
    [repairName, repairFile, repairSha256, migration171961File, migration171962File]);
    const row = state.rows[0];
    if (row.repair_execution_count !== 1 || row.repair_checksum_count !== 1
      || row.legacy_171961_checksum !== legacy171961Checksum || row.legacy_171962_checksum_count !== 0) {
      throw new Error('Legacy repair history preservation verification failed');
    }
    console.log(`LEGACY_REPAIR_APPLIED=${repairName}`);
    console.log(`LEGACY_REPAIR_FUNCTION_SHA256=${canonicalFunctionSha256}`);
  } finally {
    await post.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
