const { createHash } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { Client } = require('pg');
const { attestations } = require('./legacy-migration-attestations.cjs');

const writeMissing = process.argv.includes('--write-missing');
const appliedOnly = process.argv.includes('--applied-only');
const throughFile = process.argv.find((argument) => argument.startsWith('--through-file='))?.slice('--through-file='.length);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const migrationsDir = resolve(process.cwd(), 'migrations/node-pg');

async function checksum(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function verifySchema(client, attestation, { functionHashes = {} } = {}) {
  for (const [table, expected] of Object.entries(attestation.schema.columns ?? {})) {
    const result = await client.query(`
      SELECT jsonb_agg(jsonb_build_array(a.attname, format_type(a.atttypid, a.atttypmod),
        a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')) ORDER BY a.attnum) value
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE n.nspname = 'clinical_schema' AND c.relname = $1
        AND a.attnum > 0 AND NOT a.attisdropped
    `, [table]);
    if (JSON.stringify(result.rows[0]?.value) !== JSON.stringify(expected)) {
      throw new Error(`Legacy migration schema attestation failed: ${attestation.shortId}:columns:${table}`);
    }
  }

  for (const [schema, table, name, definition] of attestation.schema.constraints ?? []) {
    const result = await client.query(`
      SELECT pg_get_constraintdef(con.oid, true) definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2 AND con.conname = $3
    `, [schema, table, name]);
    if (result.rows.length !== 1 || result.rows[0].definition !== definition) {
      throw new Error(`Legacy migration schema attestation failed: ${attestation.shortId}:constraint:${name}`);
    }
  }

  for (const [schema, name, definition] of attestation.schema.indexes ?? []) {
    const result = await client.query(`
      SELECT pg_get_indexdef(c.oid) definition
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind = 'i'
    `, [schema, name]);
    if (result.rows.length !== 1 || result.rows[0].definition !== definition) {
      throw new Error(`Legacy migration schema attestation failed: ${attestation.shortId}:index:${name}`);
    }
  }

  for (const [name, expectedSha256] of attestation.schema.functions ?? []) {
    const result = await client.query(`
      SELECT pg_get_functiondef(p.oid) definition FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'clinical_schema' AND p.proname = $1
        AND pg_get_function_result(p.oid) = 'trigger'
    `, [name]);
    const definitions = result.rows.map((row) => createHash('sha256').update(row.definition).digest('hex'));
    const requiredSha256 = functionHashes[name] ?? expectedSha256;
    if (result.rows.length !== 1 || definitions[0] !== requiredSha256) {
      throw new Error(`Legacy migration schema attestation failed: ${attestation.shortId}:function:${name}`);
    }
  }

  for (const [table, name, expectedDefinition, expectedEnabled] of attestation.schema.triggers ?? []) {
    const result = await client.query(`
      SELECT pg_get_triggerdef(t.oid, true) definition, t.tgenabled enabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'clinical_schema' AND c.relname = $1
        AND t.tgname = $2 AND NOT t.tgisinternal
    `, [table, name]);
    const row = result.rows[0];
    if (result.rows.length !== 1 || row.definition !== expectedDefinition || row.enabled !== expectedEnabled) {
      throw new Error(`Legacy migration schema attestation failed: ${attestation.shortId}:trigger:${name}`);
    }
  }
}

function verifyExecutionOrder(appliedNames, attestation) {
  const index = appliedNames.indexOf(attestation.migrationName);
  if (index < 0 || appliedNames.lastIndexOf(attestation.migrationName) !== index) {
    throw new Error(`Legacy migration execution identity failed: ${attestation.shortId}`);
  }
  const { immediatelyAfter, immediatelyBefore } = attestation.executionOrder;
  if ((immediatelyAfter && appliedNames[index - 1] !== immediatelyAfter)
    || (immediatelyBefore && appliedNames[index + 1] !== immediatelyBefore)) {
    throw new Error(`Legacy migration execution order failed: ${attestation.shortId}`);
  }
}

async function verifyAppliedHistory(client, files, hashes, {
  allowMissingNormal = false,
  schemaFunctionHashes = {},
  emitAudit = true,
} = {}) {
  const tables = await client.query(`
    SELECT to_regclass('public.schema_migrations')::text migrations_table,
      to_regclass('public.schema_migration_checksums')::text checksums_table
  `);
  if (!tables.rows[0]?.migrations_table) {
    if (tables.rows[0]?.checksums_table) {
      const stored = await client.query('SELECT file_name FROM public.schema_migration_checksums LIMIT 1');
      if (stored.rows.length > 0) throw new Error('Migration checksum registry exists without migration execution history');
    }
    return new Set();
  }

  const applied = await client.query('SELECT name FROM public.schema_migrations ORDER BY id');
  if (applied.rows.length === 0) {
    if (tables.rows[0]?.checksums_table) {
      const stored = await client.query('SELECT file_name FROM public.schema_migration_checksums LIMIT 1');
      if (stored.rows.length > 0) throw new Error('Migration checksum registry is non-empty while migration execution history is empty');
    }
    return new Set();
  }
  if (!tables.rows[0]?.checksums_table) throw new Error('Migration checksum registry is missing for an existing migration history');

  const stored = await client.query('SELECT file_name, sha256 FROM public.schema_migration_checksums');
  const storedByFile = new Map(stored.rows.map((row) => [row.file_name, row.sha256]));
  const expectedFiles = new Set(files);
  const candidates = new Map();

  for (const row of stored.rows) {
    if (!expectedFiles.has(row.file_name)) throw new Error(`Migration file was removed after checksum registration: ${row.file_name}`);
    const hash = hashes.get(row.file_name);
    if (row.sha256 === hash) continue;
    const attestation = attestations.find((item) => item.fileName === row.file_name
      && item.legacyChecksumState.kind === 'MISMATCH'
      && item.legacyChecksumState.sha256 === row.sha256);
    if (!attestation) throw new Error(`Migration checksum mismatch: ${row.file_name}`);
    if (hash !== attestation.currentSha256) throw new Error(`Legacy migration current artifact mismatch: ${row.file_name}`);
    candidates.set(attestation.shortId, attestation);
  }

  for (const row of applied.rows) {
    const file = `${row.name}.js`;
    if (!expectedFiles.has(file)) throw new Error(`Applied migration file is missing: ${file}`);
    if (storedByFile.has(file)) continue;
    const attestation = attestations.find((item) => item.fileName === file && item.legacyChecksumState.kind === 'MISSING');
    if (!attestation) {
      if (allowMissingNormal) continue;
      throw new Error(`Checksum is missing for applied migration: ${file}`);
    }
    if (hashes.get(file) !== attestation.currentSha256) throw new Error(`Legacy migration current artifact mismatch: ${file}`);
    candidates.set(attestation.shortId, attestation);
  }

  for (const attestation of candidates.values()) {
    if (attestation.requiresAttestation && !candidates.has(attestation.requiresAttestation)) {
      if (allowMissingNormal) {
        candidates.delete(attestation.shortId);
        continue;
      }
      throw new Error(`Legacy migration attestation dependency failed: ${attestation.shortId}`);
    }
    verifyExecutionOrder(applied.rows.map((row) => row.name), attestation);
    await verifySchema(client, attestation, { functionHashes: schemaFunctionHashes[attestation.shortId] });
    if (emitAudit) {
      console.log(`LEGACY_MIGRATION_ATTESTATION_USED=${attestation.shortId}`);
      console.log('LEGACY_PROVENANCE=UNKNOWN');
    }
  }
  return new Set([...candidates.values()].map((item) => item.fileName));
}

async function main() {
  const allFiles = (await readdir(migrationsDir))
    .filter((name) => /^\d+_.+\.js$/.test(name))
    .sort();
  if (throughFile && !allFiles.includes(throughFile)) throw new Error(`Migration checksum boundary file is missing: ${throughFile}`);
  const files = throughFile ? allFiles.filter((file) => file <= throughFile) : allFiles;
  const hashes = new Map(await Promise.all(files.map(async (file) => [file, await checksum(resolve(migrationsDir, file))])));

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (appliedOnly) {
      await verifyAppliedHistory(client, files, hashes);
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migration_checksums (
        file_name text PRIMARY KEY,
        sha256 char(64) NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
      )
    `);

    const attestedFiles = await verifyAppliedHistory(client, files, hashes, { allowMissingNormal: true });

    const expected = new Set(files);
    const stored = await client.query('SELECT file_name, sha256 FROM public.schema_migration_checksums');

    for (const row of stored.rows) {
      if (!expected.has(row.file_name)) {
        throw new Error(`Migration file was removed after checksum registration: ${row.file_name}`);
      }
      if (row.sha256 !== hashes.get(row.file_name) && !attestedFiles.has(row.file_name)) {
        throw new Error(`Migration checksum mismatch: ${row.file_name}`);
      }
    }

    for (const file of files) {
      const hash = hashes.get(file);
      const existing = stored.rows.find((row) => row.file_name === file);

      if (!existing) {
        if (attestedFiles.has(file)) continue;
        if (!writeMissing) {
          throw new Error(`Checksum is missing for migration: ${file}`);
        }
        await client.query(
          'INSERT INTO public.schema_migration_checksums (file_name, sha256) VALUES ($1, $2)',
          [file, hash],
        );
        continue;
      }

      if (existing.sha256 !== hash) {
        if (attestedFiles.has(file)) continue;
        throw new Error(`Migration checksum mismatch: ${file}`);
      }
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { checksum, verifyAppliedHistory, verifySchema };
