import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from 'pg';

type Fixture = 'EMPTY_DATABASE' | 'POPULATED_ACTIVE_PETS' | 'POPULATED_ALREADY_ARCHIVED';

describe('owner pet archival migration on real PostgreSQL', () => {
  const sourceMigration = join(
    process.cwd(),
    'migrations/node-pg/1719420000000_add_pet_archival.js',
  );
  const migrationBinary = join(
    process.cwd(),
    'node_modules/.bin/node-pg-migrate',
  );
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const petId = '22222222-2222-4222-8222-222222222222';

  for (const fixture of [
    'EMPTY_DATABASE',
    'POPULATED_ACTIVE_PETS',
    'POPULATED_ALREADY_ARCHIVED',
  ] as const) {
    it(`${fixture} preserves rows and installs valid archive schema`, async () => {
      await withFixtureDatabase(fixture, async ({ client, databaseUrl, migrationDir }) => {
        runMigration('up', databaseUrl, migrationDir);

        const column = await client.query(
          `SELECT is_nullable, data_type
             FROM information_schema.columns
            WHERE table_schema = 'pet_schema'
              AND table_name = 'pets'
              AND column_name = 'archived_at'`,
        );
        expect(column.rows).toEqual([
          { is_nullable: 'YES', data_type: 'timestamp with time zone' },
        ]);
        const index = await client.query(
          `SELECT indexdef
             FROM pg_indexes
            WHERE schemaname = 'pet_schema'
              AND indexname = 'pets_owner_active_created_idx'`,
        );
        expect(index.rows).toHaveLength(1);
        expect(index.rows[0].indexdef).toContain('WHERE (archived_at IS NULL)');

        const pets = await client.query(
          `SELECT id::text, owner_id::text, archived_at
             FROM pet_schema.pets
            ORDER BY id`,
        );
        if (fixture === 'EMPTY_DATABASE') {
          expect(pets.rows).toEqual([]);
        } else {
          expect(pets.rows).toHaveLength(1);
          expect(pets.rows[0].id).toBe(petId);
          expect(pets.rows[0].owner_id).toBe(ownerId);
          if (fixture === 'POPULATED_ACTIVE_PETS') {
            expect(pets.rows[0].archived_at).toBeNull();
          } else {
            expect(pets.rows[0].archived_at).not.toBeNull();
          }
        }

        if (fixture === 'POPULATED_ALREADY_ARCHIVED') {
          runMigration('down', databaseUrl, migrationDir);
          const afterRollback = await client.query(
            `SELECT archived_at
               FROM pet_schema.pets
              WHERE id = $1`,
            [petId],
          );
          expect(afterRollback.rows).toHaveLength(1);
          expect(afterRollback.rows[0].archived_at).not.toBeNull();
        }
      });
    });
  }

  it('REPEATED_MIGRATION_RUN records and applies the migration once', async () => {
    await withFixtureDatabase(
      'POPULATED_ACTIVE_PETS',
      async ({ client, databaseUrl, migrationDir }) => {
        runMigration('up', databaseUrl, migrationDir);
        runMigration('up', databaseUrl, migrationDir);
        const records = await client.query(
          `SELECT name
             FROM public.schema_migrations
            WHERE name = '1719420000000_add_pet_archival'`,
        );
        expect(records.rows).toHaveLength(1);
        const pets = await client.query(
          `SELECT id::text, archived_at FROM pet_schema.pets`,
        );
        expect(pets.rows).toEqual([{ id: petId, archived_at: null }]);
      },
    );
  });

  function runMigration(
    direction: 'up' | 'down',
    databaseUrl: string,
    migrationDir: string,
  ) {
    execFileSync(
      migrationBinary,
      [
        direction,
        '--migrations-dir',
        migrationDir,
        '--migrations-schema',
        'public',
        '--migrations-table',
        'schema_migrations',
        '--single-transaction',
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      },
    );
  }

  async function withFixtureDatabase(
    fixture: Fixture,
    assertion: (context: {
      client: Client;
      databaseUrl: string;
      migrationDir: string;
    }) => Promise<void>,
  ) {
    const configuredUrl = process.env.DATABASE_URL;
    if (!configuredUrl) {
      throw new Error('DATABASE_URL is required for real migration fixtures');
    }
    const admin = new Client({ connectionString: configuredUrl });
    const databaseName = `vethelp_owner_archive_${process.pid}_${Date.now()}`;
    const target = new URL(configuredUrl);
    target.pathname = `/${databaseName}`;
    const migrationDir = mkdtempSync(join(tmpdir(), 'vethelp-owner-archive-'));
    copyFileSync(
      sourceMigration,
      join(migrationDir, '1719420000000_add_pet_archival.js'),
    );
    let client: Client | null = null;
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      client = new Client({ connectionString: target.toString() });
      await client.connect();
      await client.query(`
        CREATE SCHEMA pet_schema;
        CREATE TABLE pet_schema.pets (
          id uuid PRIMARY KEY,
          owner_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      if (fixture === 'POPULATED_ALREADY_ARCHIVED') {
        await client.query(
          'ALTER TABLE pet_schema.pets ADD COLUMN archived_at timestamptz',
        );
      }
      if (fixture !== 'EMPTY_DATABASE') {
        await client.query(
          fixture === 'POPULATED_ALREADY_ARCHIVED'
            ? `INSERT INTO pet_schema.pets (id, owner_id, archived_at)
               VALUES ($1, $2, '2026-07-01T00:00:00Z')`
            : `INSERT INTO pet_schema.pets (id, owner_id) VALUES ($1, $2)`,
          [petId, ownerId],
        );
      }
      await assertion({
        client,
        databaseUrl: target.toString(),
        migrationDir,
      });
    } finally {
      if (client) await client.end();
      await admin.query(
        `SELECT pg_terminate_backend(pid)
           FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.end();
      rmSync(migrationDir, { recursive: true, force: true });
    }
  }
});
