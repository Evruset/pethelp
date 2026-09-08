import { Pool, PoolClient } from 'pg';
import { config } from '../src/config';

jest.setTimeout(120_000);

type Migration = {
  up: (pgm: { sql: (statement: string) => void }) => void;
  down: (pgm: { sql: (statement: string) => void }) => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const migration = require('../migrations/node-pg/1719460000000_add_clinic_patient_association_schema.js') as Migration;
const pool = new Pool({ connectionString: config.databaseUrl, max: 6 });

const IDS = {
  owner: '91000000-0000-4000-8000-000000000001',
  clinic: '91000000-0000-4000-8000-000000000002',
  otherClinic: '91000000-0000-4000-8000-000000000003',
  location: '91000000-0000-4000-8000-000000000004',
  otherLocation: '91000000-0000-4000-8000-000000000005',
  service: '91000000-0000-4000-8000-000000000006',
  pet: '91000000-0000-4000-8000-000000000007',
  slot: '91000000-0000-4000-8000-000000000008',
  hold: '91000000-0000-4000-8000-000000000009',
  appointment: '91000000-0000-4000-8000-000000000010',
  consent: '91000000-0000-4000-8000-000000000011',
  otherConsent: '91000000-0000-4000-8000-000000000012',
  association: '91000000-0000-4000-8000-000000000013',
};

describe('clinic patient association schema migration', () => {
  beforeAll(async () => {
    await ensureMigration('up');
  });

  beforeEach(async () => {
    await clearPatientStructures();
    await seedBaseFixture();
  });

  afterEach(async () => {
    if (await tableExists('clinic_patient_associations')) {
      await clearPatientStructures();
    }
    await deleteBaseFixture();
  });

  afterAll(async () => {
    await ensureMigration('up');
    await pool.end();
  });

  it('creates exact tables, columns, constraints and required bounded indexes', async () => {
    const tables = await pool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'clinic_schema'
        AND table_name LIKE 'clinic_patient_%'
      ORDER BY table_name
    `);
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      'clinic_patient_association_event_receipts',
      'clinic_patient_association_revisions',
      'clinic_patient_associations',
      'clinic_patient_consents',
    ]);

    const indexes = await pool.query<{ indexname: string; indexdef: string }>(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'clinic_schema'
        AND indexname = ANY($1::text[])
      ORDER BY indexname
    `, [[
      'clinic_patient_associations_registry_idx',
      'clinic_patient_consents_scope_purpose_idx',
      'clinic_patient_consents_revocation_idx',
      'clinic_patient_association_receipts_association_idx',
      'clinic_patient_association_revisions_snapshot_idx',
      'clinic_patient_association_revisions_registry_idx',
    ]]);
    expect(indexes.rows).toHaveLength(6);
    expect(indexes.rows.find((row) => row.indexname === 'clinic_patient_associations_registry_idx')?.indexdef)
      .toContain('(clinic_id, clinic_location_id, status, last_qualified_at DESC, pet_id DESC)');
    expect(indexes.rows.find((row) => row.indexname === 'clinic_patient_association_revisions_registry_idx')?.indexdef)
      .toContain('(clinic_id, clinic_location_id, status, last_qualified_at DESC, pet_id DESC, revision_sequence)');

    const constraints = await pool.query<{ conname: string; definition: string }>(`
      SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'clinic_schema'
        AND t.relname = ANY($1::text[])
    `, [[
      'clinic_patient_consents',
      'clinic_patient_associations',
      'clinic_patient_association_event_receipts',
      'clinic_patient_association_revisions',
    ]]);
    const definitions = constraints.rows.map((row) => row.definition).join('\n');
    expect(definitions).toContain('UNIQUE (clinic_id, clinic_location_id, pet_id)');
    expect(definitions).toContain("status = ANY (ARRAY['ACTIVE'::text, 'ARCHIVED'::text, 'REVOKED'::text])");
    expect(definitions).toContain("purpose = 'PATIENT_ADMIN_REGISTRY'::text");
    expect(definitions).not.toMatch(/\b(now|clock_timestamp)\s*\(/i);

    const prohibited = await pool.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'clinic_schema'
        AND table_name LIKE 'clinic_patient_%'
        AND column_name ~* '(diagnosis|clinical|prescription|treatment|phone|email|address|payment|insurance|payload|support|search_query|binary)'
    `);
    expect(prohibited.rows).toEqual([]);
  });

  it('enforces consent purpose, dates, revocation metadata and exact-scope reference', async () => {
    await expectQueryError(insertConsent({ purpose: 'MARKETING' }), 'clinic_patient_consents_purpose_check');
    await expectQueryError(insertConsent({ expiresAt: '2026-01-01T00:00:00Z' }), 'clinic_patient_consents_dates_check');
    await expectQueryError(insertConsent({ revokedAt: '2026-01-01T00:00:00Z' }), 'clinic_patient_consents_dates_check');
    await expectQueryError(insertConsent({ revokedAt: '2027-02-01T00:00:00Z' }), 'clinic_patient_consents_revocation_check');
    await expectQueryError(insertConsent({
      revokedAt: '2027-02-01T00:00:00Z',
      revokedActorType: 'OWNER',
      revokeReason: 'WITHDRAWN',
    }), 'clinic_patient_consents_revocation_check');

    await insertConsent();
    await insertConsent({ id: IDS.otherConsent, locationId: IDS.otherLocation });
    await expectQueryError(
      insertAssociation({ consentId: IDS.otherConsent }),
      'clinic_patient_associations_consent_scope_fkey',
    );
  });

  it('enforces lifecycle, source, positive versions and exact-scope uniqueness', async () => {
    await insertConsent();
    await expectCheckViolation(insertAssociation({ status: 'PENDING' }));
    await expectQueryError(insertAssociation({ sourceType: 'IMPORT' }), 'clinic_patient_associations_source_check');
    await expectQueryError(insertAssociation({ version: 0 }), 'clinic_patient_associations_version_check');
    await expectQueryError(
      insertAssociation({ status: 'ARCHIVED', archivedAt: null, archiveReason: null }),
      'clinic_patient_associations_lifecycle_check',
    );

    await insertAssociation();
    await expectQueryError(insertAssociation({ id: '91000000-0000-4000-8000-000000000099' }), 'clinic_patient_associations_scope_key');
  });

  it('fences concurrent scope inserts and duplicate semantic receipts', async () => {
    await insertConsent();
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query('BEGIN');
      await second.query('BEGIN');
      await insertAssociation({}, first);
      const competing = insertAssociation(
        { id: '91000000-0000-4000-8000-000000000099', onConflict: true },
        second,
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      await first.query('COMMIT');
      expect((await competing).rowCount).toBe(0);
      await second.query('COMMIT');
    } finally {
      await safeRollback(first);
      await safeRollback(second);
      first.release();
      second.release();
    }

    await pool.query(`
      INSERT INTO clinic_schema.clinic_patient_association_event_receipts
        (source_event_id, association_id, source_aggregate_id,
         source_aggregate_version, event_type)
      VALUES ($1, $2, $3, 1, 'booking.confirmed.v1')
    `, ['91000000-0000-4000-8000-000000000020', IDS.association, IDS.appointment]);
    await expectQueryError(pool.query(`
      INSERT INTO clinic_schema.clinic_patient_association_event_receipts
        (source_event_id, association_id, source_aggregate_id,
         source_aggregate_version, event_type)
      VALUES ($1, $2, $3, 1, 'booking.confirmed.v1')
    `, ['91000000-0000-4000-8000-000000000021', IDS.association, IDS.appointment]),
    'clinic_patient_association_receipts_semantic_key');
  });

  it('keeps revision identities ordered and aggregate versions unique', async () => {
    await insertConsent();
    await insertAssociation();
    const first = await insertRevision(1);
    const second = await insertRevision(2);
    expect(BigInt(second.revision_sequence)).toBeGreaterThan(BigInt(first.revision_sequence));
    await expectQueryError(insertRevision(2), 'clinic_patient_association_revisions_association_version_key');
    await expectQueryError(insertRevision(0), 'clinic_patient_association_revisions_version_check');
  });

  it('does not backfill historical appointments or mutate shared data', async () => {
    expect((await count('clinic_schema.clinic_patient_associations'))).toBe('0');
    expect((await count('clinic_schema.clinic_patient_consents'))).toBe('0');
    expect((await count('booking_schema.appointments', 'id = $1', [IDS.appointment]))).toBe('1');
    expect((await count('pet_schema.pets', 'id = $1', [IDS.pet]))).toBe('1');
    expect((await count('booking_schema.outbox_events'))).toBe('0');
  });

  it('rolls back only new structures, preserves shared rows and reapplies cleanly', async () => {
    const before = {
      appointments: await count('booking_schema.appointments', 'id = $1', [IDS.appointment]),
      pets: await count('pet_schema.pets', 'id = $1', [IDS.pet]),
      outbox: await count('booking_schema.outbox_events'),
    };
    await applyMigration('down');
    expect(await tableExists('clinic_patient_associations')).toBe(false);
    expect(await tableExists('clinic_patient_consents')).toBe(false);
    expect(await count('booking_schema.appointments', 'id = $1', [IDS.appointment])).toBe(before.appointments);
    expect(await count('pet_schema.pets', 'id = $1', [IDS.pet])).toBe(before.pets);
    expect(await count('booking_schema.outbox_events')).toBe(before.outbox);

    await applyMigration('up');
    expect(await tableExists('clinic_patient_associations')).toBe(true);
    expect(await tableExists('clinic_patient_association_revisions')).toBe(true);
    expect(await count('clinic_schema.clinic_patient_associations')).toBe('0');
  });
});

async function seedBaseFixture() {
  await pool.query('INSERT INTO identity_schema.users (id) VALUES ($1) ON CONFLICT DO NOTHING', [IDS.owner]);
  await pool.query(`
    INSERT INTO clinic_schema.clinics (id, legal_name, public_name)
    VALUES ($1, 'Patient Schema LLC', 'Patient Schema'), ($2, 'Other LLC', 'Other')
    ON CONFLICT DO NOTHING
  `, [IDS.clinic, IDS.otherClinic]);
  await pool.query(`
    INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address)
    VALUES ($1, $2, 'Target'), ($3, $4, 'Other')
    ON CONFLICT DO NOTHING
  `, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinic]);
  await pool.query(`
    INSERT INTO clinic_schema.clinic_services
      (id, clinic_location_id, code, display_name, duration_minutes)
    VALUES ($1, $2, 'PATIENT_SCHEMA', 'Patient schema', 30)
    ON CONFLICT DO NOTHING
  `, [IDS.service, IDS.location]);
  await pool.query(`
    INSERT INTO pet_schema.pets (id, owner_id, name, species)
    VALUES ($1, $2, 'Schema Pet', 'CAT')
    ON CONFLICT DO NOTHING
  `, [IDS.pet, IDS.owner]);
  await pool.query(`
    INSERT INTO clinic_schema.appointment_slots
      (id, clinic_location_id, service_id, starts_at, ends_at, capacity, status, integration_mode)
    VALUES ($1, $2, $3, '2027-01-01T10:00:00Z', '2027-01-01T10:30:00Z', 1, 'BOOKED', 'LEVEL_C')
    ON CONFLICT DO NOTHING
  `, [IDS.slot, IDS.location, IDS.service]);
  await pool.query(`
    INSERT INTO booking_schema.booking_holds
      (id, slot_id, owner_id, pet_id, state, expires_at)
    VALUES ($1, $2, $3, $4, 'CONFIRMED', '2027-01-01T09:00:00Z')
    ON CONFLICT DO NOTHING
  `, [IDS.hold, IDS.slot, IDS.owner, IDS.pet]);
  await pool.query(`
    INSERT INTO booking_schema.appointments
      (id, hold_id, owner_id, pet_id, clinic_location_id, slot_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED')
    ON CONFLICT DO NOTHING
  `, [IDS.appointment, IDS.hold, IDS.owner, IDS.pet, IDS.location, IDS.slot]);
}

async function deleteBaseFixture() {
  await pool.query('DELETE FROM booking_schema.appointments WHERE id = $1', [IDS.appointment]);
  await pool.query('DELETE FROM booking_schema.booking_holds WHERE id = $1', [IDS.hold]);
  await pool.query('DELETE FROM clinic_schema.appointment_slots WHERE id = $1', [IDS.slot]);
  await pool.query('DELETE FROM clinic_schema.clinic_services WHERE id = $1', [IDS.service]);
  await pool.query('DELETE FROM pet_schema.pets WHERE id = $1', [IDS.pet]);
  await pool.query('DELETE FROM clinic_schema.clinic_locations WHERE id = ANY($1::uuid[])', [[IDS.location, IDS.otherLocation]]);
  await pool.query('DELETE FROM clinic_schema.clinics WHERE id = ANY($1::uuid[])', [[IDS.clinic, IDS.otherClinic]]);
  await pool.query('DELETE FROM identity_schema.users WHERE id = $1', [IDS.owner]);
}

async function clearPatientStructures() {
  await pool.query(`
    TRUNCATE
      clinic_schema.clinic_patient_association_revisions,
      clinic_schema.clinic_patient_association_event_receipts,
      clinic_schema.clinic_patient_associations,
      clinic_schema.clinic_patient_consents
    RESTART IDENTITY
  `);
}

function insertConsent(input: {
  id?: string;
  locationId?: string;
  purpose?: string;
  expiresAt?: string;
  revokedAt?: string | null;
  revokedActorType?: string | null;
  revokedActorId?: string | null;
  revokeReason?: string | null;
} = {}) {
  return pool.query(`
    INSERT INTO clinic_schema.clinic_patient_consents
      (id, clinic_id, clinic_location_id, pet_id, subject_owner_id, purpose,
       consent_version, source, actor_type, actor_id, granted_at, expires_at,
       revoked_at, revoked_by_actor_type, revoked_by_actor_id, revoke_reason)
    VALUES ($1, $2, $3, $4, $5, $6, 'v1', 'OWNER_BOOKING', 'OWNER', $5::uuid::text,
            '2027-01-01T00:00:00Z', $7, $8, $9, $10, $11)
  `, [
    input.id ?? IDS.consent,
    input.locationId === IDS.otherLocation ? IDS.otherClinic : IDS.clinic,
    input.locationId ?? IDS.location,
    IDS.pet,
    IDS.owner,
    input.purpose ?? 'PATIENT_ADMIN_REGISTRY',
    input.expiresAt ?? '2028-01-01T00:00:00Z',
    input.revokedAt ?? null,
    input.revokedActorType ?? null,
    input.revokedActorId ?? null,
    input.revokeReason ?? null,
  ]);
}

function insertAssociation(input: {
  id?: string;
  consentId?: string;
  status?: string;
  sourceType?: string;
  version?: number;
  archivedAt?: string | null;
  archiveReason?: string | null;
  onConflict?: boolean;
} = {}, client: Pool | PoolClient = pool) {
  return client.query(`
    INSERT INTO clinic_schema.clinic_patient_associations
      (id, clinic_id, clinic_location_id, pet_id, status, source_type,
       source_appointment_id, current_consent_id, visibility_policy_version,
       visibility_expires_at, first_qualified_at, last_qualified_at,
       archived_at, archive_reason, version)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pilot-v1',
            '2028-01-01T00:00:00Z', '2027-01-01T00:00:00Z',
            '2027-01-02T00:00:00Z', $9, $10, $11)
    ${input.onConflict ? 'ON CONFLICT (clinic_id, clinic_location_id, pet_id) DO NOTHING' : ''}
  `, [
    input.id ?? IDS.association,
    IDS.clinic,
    IDS.location,
    IDS.pet,
    input.status ?? 'ACTIVE',
    input.sourceType ?? 'APPOINTMENT',
    IDS.appointment,
    input.consentId ?? IDS.consent,
    input.archivedAt ?? null,
    input.archiveReason ?? null,
    input.version ?? 1,
  ]);
}

async function insertRevision(version: number) {
  const result = await pool.query<{ revision_sequence: string }>(`
    INSERT INTO clinic_schema.clinic_patient_association_revisions
      (association_id, association_version, clinic_id, clinic_location_id,
       pet_id, status, source_type, source_appointment_id, current_consent_id,
       visibility_expires_at, last_qualified_at)
    VALUES ($1, $2, $3, $4, $5, 'ACTIVE', 'APPOINTMENT', $6, $7,
            '2028-01-01T00:00:00Z', '2027-01-02T00:00:00Z')
    RETURNING revision_sequence::text
  `, [IDS.association, version, IDS.clinic, IDS.location, IDS.pet, IDS.appointment, IDS.consent]);
  return result.rows[0];
}

async function expectQueryError(query: Promise<unknown>, constraint: string) {
  await expect(query).rejects.toMatchObject({ constraint });
}

async function expectCheckViolation(query: Promise<unknown>) {
  await expect(query).rejects.toMatchObject({ code: '23514' });
}

async function count(table: string, predicate = 'true', values: unknown[] = []) {
  return (await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} WHERE ${predicate}`,
    values,
  )).rows[0].count;
}

async function tableExists(table: string) {
  return (await pool.query<{ exists: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`clinic_schema.${table}`],
  )).rows[0].exists;
}

async function applyMigration(direction: 'up' | 'down') {
  const statements: string[] = [];
  migration[direction]({ sql: (statement) => statements.push(statement) });
  for (const statement of statements) await pool.query(statement);
}

async function ensureMigration(direction: 'up') {
  if (!(await tableExists('clinic_patient_associations'))) await applyMigration(direction);
}

async function safeRollback(client: PoolClient) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The transaction may already be committed.
  }
}
