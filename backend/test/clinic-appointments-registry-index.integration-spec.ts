import { Pool } from 'pg';
import { config } from '../src/config';

jest.setTimeout(120_000);

const SLOT_INDEX = 'appointment_slots_registry_location_starts_idx';
const APPOINTMENT_INDEX = 'appointments_registry_slot_id_idx';
const LOCATION = '82000000-0000-4000-8000-000000000001';
const OTHER_LOCATION = '82000000-0000-4000-8000-000000000002';
const SNAPSHOT = '2026-07-23T09:00:00.123456Z';
const TERMINAL = ['COMPLETED', 'NO_SHOW', 'CLINIC_CANCELLED', 'CANCELLED'];

type Plan = {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Sort Key'?: string[];
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Heap Fetches'?: number;
  'Scan Direction'?: string;
  Plans?: Plan[];
};

type RegistryRow = {
  appointment_id: string;
  clinic_location_id: string;
  starts_at: Date;
  starts_cursor: string;
};

type Migration = {
  up: (pgm: { sql: (statement: string) => void }) => void;
  down: (pgm: { sql: (statement: string) => void }) => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const migration = require('../migrations/node-pg/1719450000000_add_clinic_appointments_registry_indexes.js') as Migration;

const pool = new Pool({ connectionString: config.databaseUrl });

describe('clinic appointments registry query indexes', () => {
  beforeAll(async () => {
    await resetAndSeed();
    await pool.query('ANALYZE clinic_schema.appointment_slots');
    await pool.query('ANALYZE booking_schema.appointments');
  });

  afterAll(async () => {
    await ensureIndexes();
    await pool.end();
  });

  it('applies the exact covering index definitions', async () => {
    const result = await pool.query<{ indexname: string; indexdef: string }>(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE indexname = ANY($1::text[])
      ORDER BY indexname
    `, [[APPOINTMENT_INDEX, SLOT_INDEX]]);

    expect(result.rows.map((row) => row.indexname)).toEqual([SLOT_INDEX, APPOINTMENT_INDEX]);
    expect(result.rows.find((row) => row.indexname === SLOT_INDEX)?.indexdef)
      .toContain('(clinic_location_id, starts_at, id) INCLUDE (ends_at, service_id)');
    expect(result.rows.find((row) => row.indexname === APPOINTMENT_INDEX)?.indexdef)
      .toContain('(slot_id, id) INCLUDE (clinic_location_id, created_at, status, version, pet_id)');
    expect((await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM public.schema_migrations
      WHERE name = '1719450000000_add_clinic_appointments_registry_indexes'
    `)).rows[0].count).toBe('1');
  });

  it.each(['upcoming', 'history'] as const)('uses bounded indexed access for %s', async (bucket) => {
    const plan = await explain(bucket);
    const nodes = flatten(plan);
    const targetScans = nodes.filter((node) =>
      node['Relation Name'] === 'appointment_slots' || node['Relation Name'] === 'appointments');

    expect(targetScans.some((node) => node['Node Type'] === 'Seq Scan')).toBe(false);
    expect(nodes.some((node) => node['Index Name'] === SLOT_INDEX)).toBe(true);
    expect(nodes.some((node) => node['Index Name'] === APPOINTMENT_INDEX)).toBe(true);
    expect(nodes.some((node) => node['Node Type'] === 'Sort')).toBe(false);
    expect(plan['Actual Rows']).toBeLessThanOrEqual(101);

    const slotScan = nodes.find((node) => node['Index Name'] === SLOT_INDEX)!;
    const appointmentScan = nodes.find((node) => node['Index Name'] === APPOINTMENT_INDEX)!;
    expect(slotScan['Scan Direction']).toBe(bucket === 'history' ? 'Backward' : 'Forward');
    const boundedWork = 101 * 16;
    expect((slotScan['Shared Hit Blocks'] ?? 0) + (slotScan['Shared Read Blocks'] ?? 0)).toBeLessThan(boundedWork);
    expect(appointmentScan['Actual Loops']).toBeLessThan(boundedWork);
    expect(appointmentScan['Heap Fetches']).toBeLessThan(boundedWork);
    for (const incremental of nodes.filter((node) => node['Node Type'] === 'Incremental Sort')) {
      expect(incremental['Actual Rows']).toBeLessThanOrEqual(101);
    }
  });

  it.each(['upcoming', 'history'] as const)('preserves keyset page two, ties, tenant isolation and output order for %s', async (bucket) => {
    const first = await queryRegistry(bucket, null, null, 37);
    const tail = first.at(-1)!;
    const second = await queryRegistry(bucket, tail.starts_cursor, tail.appointment_id, 37);
    const combined = [...first, ...second];

    expect(new Set(combined.map((row) => row.appointment_id)).size).toBe(combined.length);
    expect(combined.every((row) => row.clinic_location_id === LOCATION)).toBe(true);
    expect(isOrdered(combined, bucket)).toBe(true);
    expect(combined.some((row, index) =>
      index > 0 && row.starts_at.getTime() === combined[index - 1].starts_at.getTime())).toBe(true);
  });

  it('supports rollback/reapply without data loss and keeps writes healthy', async () => {
    const before = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM booking_schema.appointments');
    const businessIdsBefore = (await queryRegistry('upcoming', null, null, 100))
      .map((row) => row.appointment_id);
    await applyMigration('down');
    expect(await indexNames()).toEqual([]);

    await applyMigration('up');
    expect(await indexNames()).toEqual([SLOT_INDEX, APPOINTMENT_INDEX]);
    expect((await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM booking_schema.appointments')).rows[0])
      .toEqual(before.rows[0]);
    expect((await queryRegistry('upcoming', null, null, 100)).map((row) => row.appointment_id))
      .toEqual(businessIdsBefore);

    await pool.query(`
      WITH slot AS (
        INSERT INTO clinic_schema.appointment_slots
          (id, clinic_location_id, service_id, starts_at, ends_at, capacity, status, integration_mode)
        VALUES
          ('83000000-0000-4000-8000-000000099999', $1, '84000000-0000-4000-8000-000000000001',
           $2::timestamptz + interval '30 days', $2::timestamptz + interval '30 days 30 minutes', 1, 'OPEN', 'LEVEL_A')
        RETURNING id
      ), hold AS (
        INSERT INTO booking_schema.booking_holds
          (id, slot_id, owner_id, pet_id, state, expires_at)
        SELECT '85000000-0000-4000-8000-000000099999', id,
               '86000000-0000-4000-8000-000000000001',
               '87000000-0000-4000-8000-000000000001',
               'CONFIRMED', $2::timestamptz + interval '1 day'
        FROM slot
        RETURNING id
      )
      INSERT INTO booking_schema.appointments
        (id, hold_id, owner_id, pet_id, clinic_location_id, slot_id, status, created_at)
      SELECT '88000000-0000-4000-8000-000000099999', hold.id,
             '86000000-0000-4000-8000-000000000001',
             '87000000-0000-4000-8000-000000000001', $1,
             '83000000-0000-4000-8000-000000099999', 'CONFIRMED', $2::timestamptz
      FROM hold
    `, [LOCATION, SNAPSHOT]);

    await pool.query(`
      UPDATE clinic_schema.appointment_slots
      SET starts_at = starts_at + interval '1 day',
          ends_at = ends_at + interval '1 day',
          version = version + 1
      WHERE id = '83000000-0000-4000-8000-000000099999'
    `);
    await pool.query(`
      UPDATE booking_schema.appointments
      SET status = 'CLINIC_CANCELLED', version = version + 1
      WHERE id = '88000000-0000-4000-8000-000000099999'
    `);
    expect((await queryRegistry('history', null, null, 200))
      .some((row) => row.appointment_id === '88000000-0000-4000-8000-000000099999')).toBe(true);
    await pool.query(`
      UPDATE booking_schema.appointments
      SET status = 'COMPLETED', version = version + 1
      WHERE id = '88000000-0000-4000-8000-000000099999'
    `);
    expect((await pool.query<{ status: string }>(`
      SELECT status FROM booking_schema.appointments
      WHERE id = '88000000-0000-4000-8000-000000099999'
    `)).rows[0].status).toBe('COMPLETED');
  });
});

async function resetAndSeed() {
  await pool.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await pool.query(`INSERT INTO identity_schema.users (id)
    VALUES ('86000000-0000-4000-8000-000000000001')`);
  await pool.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name)
    VALUES
      ('81000000-0000-4000-8000-000000000001', 'Registry Index LLC', 'Registry Index'),
      ('81000000-0000-4000-8000-000000000002', 'Noise LLC', 'Noise Clinic')`);
  await pool.query(`
    INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address)
    VALUES
      ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'Target'),
      ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000002', 'Noise')
  `);
  await pool.query(`
    INSERT INTO clinic_schema.clinic_services
      (id, clinic_location_id, code, display_name, duration_minutes)
    VALUES ('84000000-0000-4000-8000-000000000001', $1, 'REGISTRY', 'Registry service', 30)
  `, [LOCATION]);
  await pool.query(`
    INSERT INTO pet_schema.pets (id, owner_id, name, species)
    VALUES ('87000000-0000-4000-8000-000000000001',
            '86000000-0000-4000-8000-000000000001', 'Index Pet', 'CAT')
  `);

  await pool.query(`
    INSERT INTO clinic_schema.appointment_slots
      (id, clinic_location_id, service_id, starts_at, ends_at, capacity, status, integration_mode)
    SELECT md5('registry-slot-' || n)::uuid,
           CASE WHEN n % 5 = 0 THEN $2::uuid ELSE $1::uuid END,
           CASE WHEN n % 5 = 0 THEN NULL ELSE '84000000-0000-4000-8000-000000000001'::uuid END,
           $3::timestamptz + ((n / 3) - 3000) * interval '2 minutes',
           $3::timestamptz + ((n / 3) - 3000) * interval '2 minutes' + interval '30 minutes',
           1, 'OPEN', 'LEVEL_A'
    FROM generate_series(1, 15000) AS n
  `, [LOCATION, OTHER_LOCATION, SNAPSHOT]);

  await pool.query(`
    INSERT INTO booking_schema.booking_holds
      (id, slot_id, owner_id, pet_id, state, expires_at, created_at)
    SELECT md5('registry-hold-' || n)::uuid, md5('registry-slot-' || n)::uuid,
           '86000000-0000-4000-8000-000000000001',
           '87000000-0000-4000-8000-000000000001',
           'CONFIRMED', $1::timestamptz + interval '1 day',
           $1::timestamptz - interval '1 day'
    FROM generate_series(1, 15000) AS n
  `, [SNAPSHOT]);
  await pool.query(`
    INSERT INTO booking_schema.appointments
      (id, hold_id, owner_id, pet_id, clinic_location_id, slot_id, status, created_at)
    SELECT md5('registry-appointment-' || n)::uuid, md5('registry-hold-' || n)::uuid,
           '86000000-0000-4000-8000-000000000001',
           '87000000-0000-4000-8000-000000000001',
           CASE WHEN n % 5 = 0 THEN $2::uuid ELSE $1::uuid END,
           md5('registry-slot-' || n)::uuid,
           CASE WHEN n % 11 = 0 OR n IN (14998, 14999) THEN 'COMPLETED' ELSE 'CONFIRMED' END,
           $3::timestamptz - interval '1 day'
    FROM generate_series(1, 15000) AS n;
  `, [LOCATION, OTHER_LOCATION, SNAPSHOT]);
}

async function explain(bucket: 'upcoming' | 'history'): Promise<Plan> {
  const result = await pool.query<{ 'QUERY PLAN': Array<{ Plan: Plan }> }>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${registrySql(bucket)}`,
    [LOCATION, SNAPSHOT, null, null, 101, ...TERMINAL],
  );
  return result.rows[0]['QUERY PLAN'][0].Plan;
}

async function queryRegistry(bucket: 'upcoming' | 'history', sortAt: string | null, appointmentId: string | null, limit: number) {
  const result = await pool.query<RegistryRow>(registrySql(bucket), [
    LOCATION, SNAPSHOT, sortAt, appointmentId, limit, ...TERMINAL,
  ]);
  return result.rows;
}

function registrySql(bucket: 'upcoming' | 'history') {
  const history = bucket === 'history';
  return `
    SELECT a.id AS appointment_id, a.clinic_location_id, s.starts_at,
           s.starts_at::text AS starts_cursor
    FROM booking_schema.appointments a
    JOIN clinic_schema.appointment_slots s ON s.id = a.slot_id
    JOIN pet_schema.pets p ON p.id = a.pet_id
    LEFT JOIN clinic_schema.clinic_services cs ON cs.id = s.service_id
    WHERE a.clinic_location_id = $1::uuid
      AND s.clinic_location_id = $1::uuid
      AND a.created_at <= $2::timestamptz
      AND (${history
        ? `(a.status IN ($6,$7,$8,$9) OR (a.status NOT IN ($6,$7,$8,$9) AND s.ends_at < $2::timestamptz))`
        : `(a.status NOT IN ($6,$7,$8,$9) AND s.ends_at >= $2::timestamptz)`})
      AND ($3::timestamptz IS NULL OR ${(history
        ? '(s.starts_at, a.id) < ($3::timestamptz, $4::uuid)'
        : '(s.starts_at, a.id) > ($3::timestamptz, $4::uuid)')})
    ORDER BY s.starts_at ${history ? 'DESC' : 'ASC'}, a.id ${history ? 'DESC' : 'ASC'}
    LIMIT $5
  `;
}

function flatten(plan: Plan): Plan[] {
  return [plan, ...(plan.Plans ?? []).flatMap(flatten)];
}

function isOrdered(rows: RegistryRow[], bucket: 'upcoming' | 'history') {
  return rows.every((row, index) => {
    if (index === 0) return true;
    const previous = rows[index - 1];
    const time = row.starts_at.getTime() - previous.starts_at.getTime();
    const id = row.appointment_id.localeCompare(previous.appointment_id);
    return bucket === 'upcoming' ? time > 0 || (time === 0 && id > 0) : time < 0 || (time === 0 && id < 0);
  });
}

async function indexNames() {
  const result = await pool.query<{ indexname: string }>(
    'SELECT indexname FROM pg_indexes WHERE indexname = ANY($1::text[]) ORDER BY indexname',
    [[APPOINTMENT_INDEX, SLOT_INDEX]],
  );
  return result.rows.map((row) => row.indexname);
}

async function ensureIndexes() {
  if ((await indexNames()).length !== 2) await applyMigration('up');
}

async function applyMigration(direction: 'up' | 'down') {
  const statements: string[] = [];
  migration[direction]({ sql: (statement) => statements.push(statement) });
  for (const statement of statements) await pool.query(statement);
}
