import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { config } from '../src/config';
import { ClinicPatientsRegistryService } from '../src/booking-core/clinic-patients-registry.service';
import { RegistryReferenceTelemetry } from '../src/observability/registry-reference-telemetry';

jest.setTimeout(240_000);

const OWNER = 'd0000000-0000-4000-8000-000000000001';
const CLINIC = 'd1000000-0000-4000-8000-000000000001';
const LOCATION = 'd2000000-0000-4000-8000-000000000001';
const OTHER_LOCATION = 'd2000000-0000-4000-8000-000000000002';
const POLICY_VERSION = 'registry-reference-performance-v1';
const INDEX_FAMILY = 'clinic_patient_local_profiles_reference_location_key';
const fixtureRows = Number(process.env.REFERENCE_PERF_ROWS ?? '10000');

type Plan = {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Index Cond'?: string;
  'Filter'?: string;
  'Actual Rows'?: number;
  'Plan Rows'?: number;
  'Actual Loops'?: number;
  'Temp Read Blocks'?: number;
  'Temp Written Blocks'?: number;
  'Sort Space Type'?: string;
  'Sort Method'?: string;
  'Sort Space Used'?: number;
  'Hash Batches'?: number;
  'Peak Memory Usage'?: number;
  'Rows Removed by Filter'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  Plans?: Plan[];
};

type ExplainedPlan = {
  Plan: Plan;
  Settings?: Record<string, string>;
  'Planning Time'?: number;
  'Execution Time'?: number;
};

type RegistryPlanInput = {
  clinicId: string;
  locationId: string;
  limit: number;
  administrativeReferenceKey: string;
};

const pool = new Pool({ connectionString: config.databaseUrl });
let fixtureClient: PoolClient;
let fixtureBuildMs = 0;
const service = new ClinicPatientsRegistryService(
  {} as never,
  {} as never,
  {} as never,
  new RegistryReferenceTelemetry({ event: jest.fn() } as never),
);

describe('Clinic patients Registry exact-reference semantic performance guard', () => {
  beforeAll(async () => {
    if (fixtureRows !== 10_000 && fixtureRows !== 100_000) {
      throw new Error('REFERENCE_PERF_ROWS must be 10000 or 100000');
    }
    await assertFixtureClean();
    fixtureClient = await pool.connect();
    await fixtureClient.query('BEGIN');
    try {
      const fixtureStartedAt = process.hrtime.bigint();
      await seed(fixtureClient, fixtureRows);
      fixtureBuildMs = Number(process.hrtime.bigint() - fixtureStartedAt) / 1_000_000;
    } catch (error) {
      await fixtureClient.query('ROLLBACK');
      fixtureClient.release();
      throw error;
    }
  }, 600_000);

  afterAll(async () => {
    const cleanupStartedAt = process.hrtime.bigint();
    if (fixtureClient) {
      await fixtureClient.query('ROLLBACK');
      fixtureClient.release();
    }
    await assertFixtureClean();
    const cleanupMs = Number(process.hrtime.bigint() - cleanupStartedAt) / 1_000_000;
    await appendLifecycleEvidence(cleanupMs);
    await pool.end();
  }, 600_000);

  it('C-18..C-28 preserves scoped indexed semantics and controlled latency', async () => {
    const now = new Date();
    const snapshot = (await fixtureClient.query<{ sequence: string }>(`
      SELECT MAX(revision_sequence)::text AS sequence
      FROM clinic_schema.clinic_patient_association_revisions
      WHERE clinic_id=$1::uuid AND clinic_location_id=$2::uuid
    `, [CLINIC, LOCATION])).rows[0].sequence;
    const input = {
      clinicId: CLINIC,
      locationId: LOCATION,
      limit: 50,
      administrativeReferenceKey: 'target-synthetic',
    };
    const settings = await databaseSettings(fixtureClient);
    const explainedRuns: ExplainedPlan[] = [];
    for (let run = 0; run < 3; run += 1) {
      const explainClient = {
        query: (sql: string, parameters: unknown[]) =>
          fixtureClient.query(
            `EXPLAIN (ANALYZE, BUFFERS, WAL, SETTINGS, VERBOSE, FORMAT JSON) ${sql}`,
            parameters,
          ),
      } as unknown as PoolClient;
      const explained = await registryQuery(explainClient, input, now, snapshot);
      explainedRuns.push(
        (explained.rows[0] as unknown as { 'QUERY PLAN': ExplainedPlan[] })['QUERY PLAN'][0],
      );
    }
    const nodesByRun = explainedRuns.map((explained) => flatten(explained.Plan));
    const nodes = nodesByRun.flat();
    const localProfileNodes = nodes.filter(
      (node) => node['Relation Name'] === 'clinic_patient_local_profiles',
    );
    const planText = JSON.stringify(explainedRuns.map((explained) => explained.Plan));

    for (const runNodes of nodesByRun) {
      const runLocalProfileNodes = runNodes.filter(
        (node) => node['Relation Name'] === 'clinic_patient_local_profiles',
      );
      expect(runLocalProfileNodes.length).toBeGreaterThan(0);
      expect(runLocalProfileNodes.some((node) => node['Node Type'] === 'Seq Scan')).toBe(false);
      expect(runLocalProfileNodes.some((node) => node['Index Name'] === INDEX_FAMILY)).toBe(true);
      expect(runNodes.some(isSpillingNode)).toBe(false);
      expect(runNodes[0]['Temp Read Blocks'] ?? 0).toBe(0);
      expect(runNodes[0]['Temp Written Blocks'] ?? 0).toBe(0);
    }
    expect(planText).toContain('clinic_id');
    expect(planText).toContain('clinic_location_id');
    expect(planText).toContain('administrative_reference_key');
    expect(Math.max(...localProfileNodes.map((node) => node['Actual Rows'] ?? 0))).toBeLessThanOrEqual(2);
    expect(Math.max(...localProfileNodes.map((node) => node['Plan Rows'] ?? 0))).toBeLessThanOrEqual(2);
    const durations: number[] = [];
    let queryCount = 0;
    let resultCardinality = -1;
    const measuredClient = {
      query: async (sql: string, parameters: unknown[]) => {
        queryCount += 1;
        return fixtureClient.query(sql, parameters);
      },
    } as unknown as PoolClient;
    for (let iteration = 0; iteration < 70; iteration += 1) {
      const startedAt = process.hrtime.bigint();
      const result = await registryQuery(measuredClient, input, now, snapshot);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (iteration >= 10) durations.push(durationMs);
      resultCardinality = result.rows.length;
    }
    const planRuns = explainedRuns.map((explained, run) => ({
      run: run + 1,
      planningTimeMs: explained['Planning Time'] ?? 0,
      executionTimeMs: explained['Execution Time'] ?? 0,
      spills: flatten(explained.Plan)
        .filter(isSpillingNode)
        .map(summarizeNode),
    }));
    const evidence = {
      fixtureRows,
      fixtureBuildMs: Number(fixtureBuildMs.toFixed(3)),
      postgresVersion: settings.serverVersion,
      settings,
      queryCount,
      measuredQueries: durations.length,
      p50Ms: percentile(durations, 0.50),
      p95Ms: percentile(durations, 0.95),
      p99Ms: percentile(durations, 0.99),
      indexFamily: INDEX_FAMILY,
      localProfileSeqScans: localProfileNodes.filter((node) => node['Node Type'] === 'Seq Scan').length,
      spillNodes: nodes.filter((node) =>
        isSpillingNode(node)).length,
      tempReadBlocks: Math.max(...explainedRuns.map(
        (explained) => explained.Plan['Temp Read Blocks'] ?? 0)),
      tempWrittenBlocks: Math.max(...explainedRuns.map(
        (explained) => explained.Plan['Temp Written Blocks'] ?? 0)),
      resultCardinality,
      planRuns,
    };

    if (process.env.REFERENCE_PERF_EVIDENCE_PATH) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(
        process.env.REFERENCE_PERF_EVIDENCE_PATH,
        `${JSON.stringify(evidence, null, 2)}\n`,
        { mode: 0o600 },
      );
    }
    expect(evidence.spillNodes).toBe(0);
    expect(evidence.queryCount).toBe(70);
    expect(evidence.resultCardinality).toBe(1);
    expect(evidence.p95Ms).toBeLessThanOrEqual(150);
    expect(evidence.p99Ms).toBeLessThanOrEqual(300);
  });
});

async function registryQuery(
  client: PoolClient,
  input: RegistryPlanInput,
  now: Date,
  snapshot: string,
) {
  return (service as unknown as {
    query: (
      client: PoolClient,
      input: RegistryPlanInput,
      policyVersion: string,
      now: Date,
      snapshot: string,
    ) => Promise<QueryResult<QueryResultRow>>;
  }).query(client, input, POLICY_VERSION, now, snapshot);
}

function flatten(plan: Plan): Plan[] {
  return [plan, ...(plan.Plans ?? []).flatMap(flatten)];
}

function isSpillingNode(node: Plan): boolean {
  const spillCapableNode = [
    'Aggregate',
    'Hash',
    'Hash Join',
    'Incremental Sort',
    'Materialize',
    'Memoize',
    'Sort',
    'WindowAgg',
  ].includes(node['Node Type']);
  return node['Sort Space Type'] === 'Disk'
    || (node['Hash Batches'] ?? 1) > 1
    || (spillCapableNode
      && ((node['Temp Read Blocks'] ?? 0) > 0 || (node['Temp Written Blocks'] ?? 0) > 0));
}

async function appendLifecycleEvidence(cleanupMs: number) {
  const path = process.env.REFERENCE_PERF_EVIDENCE_PATH;
  if (!path) return;
  const fs = await import('node:fs/promises');
  try {
    const evidence = JSON.parse(await fs.readFile(path, 'utf8')) as Record<string, unknown>;
    evidence.cleanupMs = Number(cleanupMs.toFixed(3));
    evidence.cleanupCounts = '0|0|0|0';
    await fs.writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function summarizeNode(node: Plan) {
  return {
    nodeType: node['Node Type'],
    relationName: node['Relation Name'] ?? null,
    indexName: node['Index Name'] ?? null,
    actualRows: node['Actual Rows'] ?? 0,
    actualLoops: node['Actual Loops'] ?? 0,
    planRows: node['Plan Rows'] ?? 0,
    sortMethod: node['Sort Method'] ?? null,
    sortSpaceType: node['Sort Space Type'] ?? null,
    sortSpaceUsedKb: node['Sort Space Used'] ?? 0,
    hashBatches: node['Hash Batches'] ?? 1,
    peakMemoryKb: node['Peak Memory Usage'] ?? 0,
    tempReadBlocks: node['Temp Read Blocks'] ?? 0,
    tempWrittenBlocks: node['Temp Written Blocks'] ?? 0,
    sharedHitBlocks: node['Shared Hit Blocks'] ?? 0,
    sharedReadBlocks: node['Shared Read Blocks'] ?? 0,
    rowsRemovedByFilter: node['Rows Removed by Filter'] ?? 0,
  };
}

async function databaseSettings(client: PoolClient) {
  const names = [
    'work_mem',
    'shared_buffers',
    'random_page_cost',
    'effective_cache_size',
    'max_parallel_workers_per_gather',
    'max_parallel_workers',
  ];
  const values: Array<readonly [string, string]> = [];
  for (const name of names) {
    const result = await client.query<Record<string, string>>(`SHOW ${name}`);
    values.push([name, result.rows[0][name]] as const);
  }
  const version = await client.query<{ server_version: string }>('SHOW server_version');
  return {
    serverVersion: version.rows[0].server_version,
    ...Object.fromEntries(values),
  };
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return Number(sorted[index].toFixed(3));
}

async function seed(database: PoolClient, rows: number) {
  await database.query('INSERT INTO identity_schema.users(id) VALUES($1)', [OWNER]);
  await database.query(`
    INSERT INTO clinic_schema.clinics(id,legal_name,public_name)
    VALUES($1,'Synthetic Registry Performance','Synthetic Registry Performance')
  `, [CLINIC]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address)
    VALUES($1,$3,'Synthetic A'),($2,$3,'Synthetic B')
  `, [LOCATION, OTHER_LOCATION, CLINIC]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_services(
      id,clinic_location_id,code,display_name,duration_minutes
    ) VALUES('d3000000-0000-4000-8000-000000000001',$1,'SYN-PERF','Synthetic',30)
  `, [LOCATION]);
  await database.query(`
    INSERT INTO pet_schema.pets(id,owner_id,name,species,archived_at)
    SELECT ('d5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      $1::uuid,'Synthetic ' || n,'CAT',
      CASE WHEN n=5 THEN clock_timestamp() ELSE NULL END
    FROM generate_series(1,$2::integer) n
  `, [OWNER, rows]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots(
      id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode
    )
    SELECT ('d6000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      $1::uuid,'d3000000-0000-4000-8000-000000000001'::uuid,
      clock_timestamp()-interval '2 hours',clock_timestamp()-interval '90 minutes',
      1,'BOOKED','LEVEL_C'
    FROM generate_series(1,1) n
  `, [LOCATION]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at)
    SELECT ('d7000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      ('d6000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$1::uuid,
      ('d5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'CONFIRMED',clock_timestamp()+interval '1 day'
    FROM generate_series(1,1) n
  `, [OWNER]);
  await database.query(`
    INSERT INTO booking_schema.appointments(
      id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,created_at
    )
    SELECT ('d8000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      ('d7000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$1::uuid,
      ('d5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$2::uuid,
      ('d6000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'COMPLETED',clock_timestamp()-n*interval '1 minute'
    FROM generate_series(1,1) n
  `, [OWNER, LOCATION]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_patient_consents(
      id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,
      consent_version,source,actor_type,granted_at,expires_at
    )
    SELECT ('d9000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      $1::uuid,CASE WHEN n % 2 = 0 THEN $4::uuid ELSE $2::uuid END,
      ('d5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$3::uuid,
      'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',
      clock_timestamp()-interval '2 days',
      CASE WHEN n=2 THEN clock_timestamp()-interval '1 day'
        ELSE clock_timestamp()+interval '30 days' END
    FROM generate_series(1,$5::integer) n
  `, [CLINIC, LOCATION, OWNER, OTHER_LOCATION, rows]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_patient_associations(
      id,clinic_id,clinic_location_id,pet_id,status,source_type,
      source_appointment_id,current_consent_id,visibility_policy_version,
      visibility_expires_at,first_qualified_at,last_qualified_at,
      revoked_at,revoke_reason,archived_at,archive_reason
    )
    SELECT ('da000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      $1::uuid,CASE WHEN n % 2 = 0 THEN $4::uuid ELSE $2::uuid END,
      ('d5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      CASE WHEN n=3 THEN 'REVOKED' WHEN n=4 THEN 'ARCHIVED' ELSE 'ACTIVE' END,
      'APPOINTMENT',
      'd8000000-0000-4000-8000-000000000001'::uuid,
      ('d9000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,$3,
      CASE WHEN n=5 THEN clock_timestamp()-interval '1 day'
        ELSE clock_timestamp()+interval '30 days' END,
      clock_timestamp()-interval '365 days',clock_timestamp()-n*interval '1 minute',
      CASE WHEN n=3 THEN clock_timestamp() ELSE NULL END,
      CASE WHEN n=3 THEN 'WITHDRAWN' ELSE NULL END,
      CASE WHEN n=4 THEN clock_timestamp() ELSE NULL END,
      CASE WHEN n=4 THEN 'STALE' ELSE NULL END
    FROM generate_series(1,$5::integer) n
  `, [CLINIC, LOCATION, POLICY_VERSION, OTHER_LOCATION, rows]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_patient_association_revisions(
      association_id,association_version,clinic_id,clinic_location_id,pet_id,
      status,source_type,source_appointment_id,current_consent_id,
      visibility_expires_at,last_qualified_at
    )
    SELECT id,version,clinic_id,clinic_location_id,pet_id,status,source_type,
      source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at
    FROM clinic_schema.clinic_patient_associations
    WHERE clinic_id=$1::uuid
  `, [CLINIC]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_patient_local_profiles(
      clinic_id,clinic_location_id,patient_id,
      administrative_reference,administrative_reference_key
    )
    SELECT $1::uuid,
      CASE WHEN n % 2 = 0 THEN $3::uuid ELSE $2::uuid END,
      ('d5000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'SYNTHETIC-' || n,'synthetic-' || n
    FROM generate_series(1,$4::integer) n
  `, [CLINIC, LOCATION, OTHER_LOCATION, rows]);
  await database.query(`
    UPDATE clinic_schema.clinic_patient_local_profiles
    SET administrative_reference='TARGET-SYNTHETIC',
        administrative_reference_key='target-synthetic'
    WHERE patient_id IN (
      'd5000000-0000-4000-8000-000000000001'::uuid,
      'd5000000-0000-4000-8000-000000000002'::uuid
    )
  `);
  await database.query('ANALYZE clinic_schema.clinic_patient_local_profiles');
  await database.query('ANALYZE clinic_schema.clinic_patient_association_revisions');
  await database.query('ANALYZE clinic_schema.clinic_patient_associations');
}

async function assertFixtureClean() {
  const result = await pool.query<{
    profiles: string;
    associations: string;
    pets: string;
    users: string;
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM clinic_schema.clinic_patient_local_profiles
        WHERE clinic_id=$1::uuid) AS profiles,
      (SELECT COUNT(*)::text FROM clinic_schema.clinic_patient_associations
        WHERE clinic_id=$1::uuid) AS associations,
      (SELECT COUNT(*)::text FROM pet_schema.pets
        WHERE id::text LIKE 'd5000000-0000-4000-8000-%') AS pets,
      (SELECT COUNT(*)::text FROM identity_schema.users
        WHERE id=$2::uuid) AS users
  `, [CLINIC, OWNER]);
  expect(result.rows[0]).toEqual({
    profiles: '0',
    associations: '0',
    pets: '0',
    users: '0',
  });
}
