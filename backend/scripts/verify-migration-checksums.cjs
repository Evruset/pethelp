const { createHash } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { Client } = require('pg');

const writeMissing = process.argv.includes('--write-missing');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const migrationsDir = resolve(process.cwd(), 'migrations/node-pg');

async function checksum(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function main() {
  const files = (await readdir(migrationsDir))
    .filter((name) => /^\d+_.+\.js$/.test(name))
    .sort();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migration_checksums (
        file_name text PRIMARY KEY,
        sha256 char(64) NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
      )
    `);

    const expected = new Set(files);
    const stored = await client.query('SELECT file_name, sha256 FROM public.schema_migration_checksums');

    for (const row of stored.rows) {
      if (!expected.has(row.file_name)) {
        throw new Error(`Migration file was removed after checksum registration: ${row.file_name}`);
      }
    }

    for (const file of files) {
      const hash = await checksum(resolve(migrationsDir, file));
      const existing = stored.rows.find((row) => row.file_name === file);

      if (!existing) {
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
        throw new Error(`Migration checksum mismatch: ${file}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
