import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../src/database/database.service';
import { loadSharedRateLimitConfig } from '../src/platform/rate-limit/rate-limit.config';
import { RateLimitCleanupWorker } from '../src/platform/rate-limit/rate-limit-cleanup.worker';
import { RateLimitDatabaseService } from '../src/platform/rate-limit/rate-limit-database.service';
import { PostgresRateLimitService } from '../src/platform/rate-limit/postgres-rate-limit.service';
import { SharedRateLimitTelemetry } from '../src/platform/rate-limit/rate-limit.telemetry';
import {
  InvalidRateLimitPolicyError,
  SharedRateLimiterUnavailableError,
} from '../src/platform/rate-limit/rate-limit.types';

jest.setTimeout(120_000);

type Migration = {
  up: (pgm: { sql: (statement: string) => void }) => void;
  down: (pgm: { sql: (statement: string) => void }) => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const migration = require('../migrations/node-pg/1719490000000_add_shared_rate_limit_windows.js') as Migration;

const dbA = new DatabaseService();
const dbB = new DatabaseService();
const limiterDbA = new RateLimitDatabaseService();
const limiterDbB = new RateLimitDatabaseService();
const telemetryA = new SharedRateLimitTelemetry();
const telemetryB = new SharedRateLimitTelemetry();
const limiterA = new PostgresRateLimitService(limiterDbA, telemetryA);
const limiterB = new PostgresRateLimitService(limiterDbB, telemetryB);
const actorId = '91000000-0000-4000-8000-000000000001';
const clinicId = '92000000-0000-4000-8000-000000000001';
const locationId = '93000000-0000-4000-8000-000000000001';

describe('PostgreSQL shared rate limiter foundation', () => {
  beforeAll(async () => {
    const table = await dbA.query<{ exists: string | null }>(
      "SELECT to_regclass('public.shared_rate_limit_windows')::text AS exists",
    );
    if (!table.rows[0].exists) await applyMigration('up');
    await truncateWindows();
  });

  beforeEach(async () => {
    await truncateWindows();
  });

  afterAll(async () => {
    await dbA.query('DROP TABLE IF EXISTS public.rate_limit_unrelated_marker_test');
    await dbA.onModuleDestroy();
    await dbB.onModuleDestroy();
    await limiterDbA.onModuleDestroy();
    await limiterDbB.onModuleDestroy();
  });

  it('N-01..N-05 atomically creates, increments, enforces the boundary and returns database-side Retry-After', async () => {
    const input = baseInput([{ windowSeconds: 60, limit: 2 }]);
    const first = await limiterA.consume(input);
    const second = await limiterA.consume(input);
    const denied = await limiterA.consume(input);

    expect(first.allowed).toBe(true);
    expect(first.policies[0]).toMatchObject({ currentCount: 1, remaining: 1 });
    expect(second).toMatchObject({ allowed: true, retryAfterSeconds: null });
    expect(denied.allowed).toBe(false);
    expect(denied.policies[0]).toMatchObject({ currentCount: 3, remaining: 0 });
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(Date.parse(first.evaluatedAt)).toBeLessThanOrEqual(Date.parse(first.policies[0].resetsAt));
  });

  it('N-06..N-09 ignores physically present expired rows and evaluates multiple policies together', async () => {
    await insertExpiredWindow();
    const result = await limiterA.consume(baseInput([
      { windowSeconds: 60, limit: 2 },
      { windowSeconds: 3_600, limit: 10 },
    ]));

    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBeNull();
    expect(result.policies.map((policy) => [policy.windowSeconds, policy.currentCount]))
      .toEqual([[60, 1], [3_600, 1]]);
    expect((await dbA.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM public.shared_rate_limit_windows',
    )).rows[0].count).toBe('3');
  });

  it('returns the latest reset at which the next multi-policy consume can succeed', async () => {
    const input = baseInput([
      { windowSeconds: 60, limit: 1 },
      { windowSeconds: 3_600, limit: 2 },
    ]);
    expect((await limiterA.consume(input)).allowed).toBe(true);
    const denied = await limiterA.consume(input);
    expect(denied.allowed).toBe(false);
    expect(denied.policies.find((policy) => policy.windowSeconds === 3_600)?.currentCount).toBe(2);
    expect(denied.retryAfterSeconds).toBeGreaterThan(
      secondsUntil(denied.evaluatedAt, denied.policies[0].resetsAt),
    );
  });

  it('N-10 fails closed with a typed error when PostgreSQL is unavailable', async () => {
    const failingDatabase = {
      withTransaction: async () => {
        throw new Error('private database detail');
      },
    } as unknown as RateLimitDatabaseService;
    const telemetry = new SharedRateLimitTelemetry();
    const limiter = new PostgresRateLimitService(failingDatabase, telemetry);

    await expect(limiter.consume(baseInput([{ windowSeconds: 60, limit: 1 }])))
      .rejects.toBeInstanceOf(SharedRateLimiterUnavailableError);
    expect(telemetry.snapshot().consumeDatabaseFailures).toBe(1);
  });

  it('N-11..N-17 shares state across two replica instances without lost updates or overshoot', async () => {
    const input = baseInput([{ windowSeconds: 60, limit: 37 }]);
    const gate = deferred<void>();
    const calls = Array.from({ length: 100 }, (_, index) =>
      gate.promise.then(() => (index % 2 === 0 ? limiterA : limiterB).consume(input)));

    gate.resolve();
    const results = await Promise.all(calls);
    expect(results.filter((result) => result.allowed)).toHaveLength(37);
    expect(results.filter((result) => !result.allowed)).toHaveLength(63);
    expect(results.every((result) => result.policies[0].currentCount >= 1)).toBe(true);

    const stored = await dbA.query<{ hit_count: number }>(`
      SELECT hit_count
      FROM public.shared_rate_limit_windows
      WHERE namespace = $1
        AND actor_id = $2::uuid
        AND clinic_id = $3::uuid
        AND location_id = $4::uuid
        AND window_seconds = 60
    `, [input.namespace, actorId, clinicId, locationId]);
    expect(stored.rows).toEqual([{ hit_count: 100 }]);

    const restarted = new PostgresRateLimitService(limiterDbB, new SharedRateLimitTelemetry());
    expect((await restarted.consume(input)).allowed).toBe(false);
  });

  it('isolates actor, clinic, location and namespace dimensions', async () => {
    const policy = [{ windowSeconds: 60, limit: 1 }] as const;
    await limiterA.consume(baseInput(policy));
    expect((await limiterA.consume(baseInput(policy))).allowed).toBe(false);

    for (const input of [
      { ...baseInput(policy), actorId: randomUUID() },
      { ...baseInput(policy), clinicId: randomUUID() },
      { ...baseInput(policy), locationId: randomUUID() },
      { ...baseInput(policy), namespace: 'another.exact-search' },
    ]) {
      expect((await limiterB.consume(input)).allowed).toBe(true);
    }
  });

  it('N-18..N-21 deletes only expired rows in bounded replica-safe batches', async () => {
    await seedCleanupRows(1_005, true);
    await seedCleanupRows(3, false);

    const [first, second] = await Promise.all([
      limiterA.cleanupExpired(1_000),
      limiterB.cleanupExpired(1_000),
    ]);
    expect(first.deletedRows + second.deletedRows).toBe(1_005);
    expect(first.deletedRows).toBeLessThanOrEqual(1_000);
    expect(second.deletedRows).toBeLessThanOrEqual(1_000);
    expect((await dbA.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM public.shared_rate_limit_windows',
    )).rows[0].count).toBe('3');
  });

  it('N-22..N-25 keeps cleanup separate from consume and processes backlog without an unbounded transaction', async () => {
    await seedCleanupRows(1_001, true);
    const [cleanup, consume] = await Promise.all([
      limiterA.cleanupExpired(1_000),
      limiterB.consume(baseInput([{ windowSeconds: 60, limit: 1 }])),
    ]);
    expect(cleanup.deletedRows).toBe(1_000);
    expect(consume.allowed).toBe(true);
    expect((await limiterA.cleanupExpired(1_000)).deletedRows).toBe(1);
  });

  it('N-26..N-30 rejects malformed policy/TTL and stores no query or patient fields', async () => {
    await expect(limiterA.consume({
      ...baseInput([{ windowSeconds: 60, limit: 1 }]),
      logicalStateRetentionSeconds: 3_901,
    })).rejects.toBeInstanceOf(InvalidRateLimitPolicyError);
    await expect(limiterA.consume(baseInput([{ windowSeconds: 0, limit: 1 }])))
      .rejects.toBeInstanceOf(InvalidRateLimitPolicyError);

    const columns = (await dbA.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'shared_rate_limit_windows'
      ORDER BY ordinal_position
    `)).rows.map((row) => row.column_name);
    expect(columns).not.toEqual(expect.arrayContaining([
      'reference',
      'query',
      'patient_id',
      'owner_id',
      'session_token',
      'metadata',
    ]));
    expect(telemetryA.snapshot()).toEqual(expect.not.objectContaining({
      actorId: expect.anything(),
      clinicId: expect.anything(),
      locationId: expect.anything(),
    }));
  });

  it('validates safe configuration defaults and rejects invalid overrides', () => {
    expect(loadSharedRateLimitConfig({})).toEqual({
      logicalStateRetentionSeconds: 3_900,
      physicalCleanupTargetSeconds: 86_400,
      cleanupIntervalSeconds: 900,
      cleanupBatchSize: 1_000,
      cleanupMaxBatchesPerRun: 10,
    });
    expect(() => loadSharedRateLimitConfig({
      VETHELP_SHARED_RATE_LIMIT_LOGICAL_TTL_SECONDS: '3901',
    })).toThrow('violates the retention contract');
    expect(() => loadSharedRateLimitConfig({
      VETHELP_SHARED_RATE_LIMIT_CLEANUP_BATCH_SIZE: '0',
    })).toThrow('positive integer');
  });

  it('applies reversible migration UP, DOWN and DOWN -> UP without touching unrelated data', async () => {
    await dbA.query('DROP TABLE IF EXISTS public.rate_limit_unrelated_marker_test');
    await dbA.query('CREATE TABLE public.rate_limit_unrelated_marker_test (value text)');
    await dbA.query("INSERT INTO public.rate_limit_unrelated_marker_test VALUES ('preserved')");
    await applyMigration('down');
    expect((await dbA.query<{ exists: string | null }>(
      "SELECT to_regclass('public.shared_rate_limit_windows')::text AS exists",
    )).rows[0].exists).toBeNull();

    await applyMigration('up');
    expect((await dbA.query<{ value: string }>(
      'SELECT value FROM public.rate_limit_unrelated_marker_test',
    )).rows).toEqual([{ value: 'preserved' }]);
    await dbA.query('DROP TABLE public.rate_limit_unrelated_marker_test');
  });

  it('uses the unique conflict arbiter and expires_at cleanup index on representative rows', async () => {
    await seedCleanupRows(5_000, true);
    await dbA.query('ANALYZE public.shared_rate_limit_windows');
    const indexes = await dbA.query<{ indexname: string; indexdef: string }>(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'shared_rate_limit_windows'
      ORDER BY indexname
    `);
    expect(indexes.rows.map((row) => row.indexname)).toEqual(expect.arrayContaining([
      'shared_rate_limit_windows_identity_key',
      'shared_rate_limit_windows_expires_at_id_idx',
    ]));

    const plan = await dbA.withTransaction(async (client) => {
      await client.query('SET LOCAL enable_seqscan = off');
      return client.query<{ 'QUERY PLAN': string }>(`
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT id
        FROM public.shared_rate_limit_windows
        WHERE expires_at <= clock_timestamp()
        ORDER BY expires_at, id
        LIMIT 1000
      `);
    });
    expect(plan.rows.map((row) => row['QUERY PLAN']).join('\n'))
      .toContain('shared_rate_limit_windows_expires_at_id_idx');
  });
});

describe('RateLimitCleanupWorker lifecycle', () => {
  it('coalesces overlapping runs, records safe telemetry and shuts down without an open timer', async () => {
    const previous = process.env.WORKERS_ENABLED;
    process.env.WORKERS_ENABLED = 'true';
    const cleanup = deferred<{ deletedRows: number; oldestExpiredAgeSeconds: number | null }>();
    const limiter = {
      cleanupExpired: jest.fn(() => cleanup.promise),
    } as unknown as PostgresRateLimitService;
    const telemetry = new SharedRateLimitTelemetry();
    const worker = new RateLimitCleanupWorker(limiter, telemetry);

    try {
      const first = worker.runOnce();
      const second = worker.runOnce();
      expect(limiter.cleanupExpired).toHaveBeenCalledTimes(1);
      cleanup.resolve({ deletedRows: 5, oldestExpiredAgeSeconds: 10 });
      await Promise.all([first, second]);
      await worker.onModuleDestroy();
      expect(telemetry.snapshot()).toMatchObject({
        cleanupDeletedRows: 5,
        cleanupFailures: 0,
        oldestExpiredAgeBucket: 'UNDER_24H',
      });
    } finally {
      if (previous === undefined) delete process.env.WORKERS_ENABLED;
      else process.env.WORKERS_ENABLED = previous;
    }
  });

  it('contains cleanup failure and does not change limiter correctness state', async () => {
    const limiter = {
      cleanupExpired: jest.fn().mockRejectedValue(new Error('private row detail')),
    } as unknown as PostgresRateLimitService;
    const telemetry = new SharedRateLimitTelemetry();
    const worker = new RateLimitCleanupWorker(limiter, telemetry);

    await expect(worker.runOnce()).resolves.toBeUndefined();
    expect(telemetry.snapshot().cleanupFailures).toBe(1);
  });

  it('runs bounded startup cleanup and closes its scheduled lifecycle', async () => {
    const previous = process.env.WORKERS_ENABLED;
    process.env.WORKERS_ENABLED = 'true';
    const limiter = {
      cleanupExpired: jest.fn().mockResolvedValue({
        deletedRows: 0,
        oldestExpiredAgeSeconds: null,
      }),
    } as unknown as PostgresRateLimitService;
    const worker = new RateLimitCleanupWorker(limiter, new SharedRateLimitTelemetry());
    try {
      await worker.onModuleInit();
      expect(limiter.cleanupExpired).toHaveBeenCalledTimes(1);
      await worker.onModuleDestroy();
    } finally {
      if (previous === undefined) delete process.env.WORKERS_ENABLED;
      else process.env.WORKERS_ENABLED = previous;
    }
  });

  it('bounds catch-up work and records saturation without identity dimensions', async () => {
    const limiter = {
      cleanupExpired: jest.fn().mockResolvedValue({
        deletedRows: 1_000,
        oldestExpiredAgeSeconds: 90_000,
      }),
    } as unknown as PostgresRateLimitService;
    const telemetry = new SharedRateLimitTelemetry();
    const worker = new RateLimitCleanupWorker(limiter, telemetry);

    await worker.runOnce();
    expect(limiter.cleanupExpired).toHaveBeenCalledTimes(10);
    expect(telemetry.snapshot()).toMatchObject({
      cleanupDeletedRows: 10_000,
      cleanupSaturatedRuns: 1,
      oldestExpiredAgeBucket: 'OVER_24H',
    });
  });
});

function baseInput(policies: ReadonlyArray<{ windowSeconds: number; limit: number }>) {
  return {
    namespace: 'administrative-reference-exact',
    actorId,
    clinicId,
    locationId,
    policies,
  };
}

async function truncateWindows() {
  await dbA.query('TRUNCATE public.shared_rate_limit_windows RESTART IDENTITY');
}

async function insertExpiredWindow() {
  await dbA.query(`
    WITH db_time AS MATERIALIZED (
      SELECT clock_timestamp() AS evaluated_at
    )
    INSERT INTO public.shared_rate_limit_windows (
      namespace, actor_id, clinic_id, location_id, window_seconds,
      window_started_at, window_ends_at, expires_at, hit_count
    )
    SELECT
      'administrative-reference-exact', $1::uuid, $2::uuid, $3::uuid, 60,
      db_time.evaluated_at - interval '2 hours',
      db_time.evaluated_at - interval '119 minutes',
      db_time.evaluated_at - interval '55 minutes',
      500
    FROM db_time
  `, [actorId, clinicId, locationId]);
}

async function seedCleanupRows(count: number, expired: boolean) {
  await dbA.query(`
    WITH db_time AS MATERIALIZED (
      SELECT clock_timestamp() AS evaluated_at
    )
    INSERT INTO public.shared_rate_limit_windows (
      namespace, actor_id, clinic_id, location_id, window_seconds,
      window_started_at, window_ends_at, expires_at, hit_count
    )
    SELECT
      'cleanup-proof',
      md5('actor-' || n)::uuid,
      md5('clinic-' || n)::uuid,
      md5('location-' || n)::uuid,
      60,
      db_time.evaluated_at ${expired ? "- interval '2 hours'" : "+ interval '1 hour'"},
      db_time.evaluated_at ${expired ? "- interval '119 minutes'" : "+ interval '61 minutes'"},
      db_time.evaluated_at ${expired ? "- interval '55 minutes'" : "+ interval '125 minutes'"},
      1
    FROM generate_series(1, $1::integer) AS n
    CROSS JOIN db_time
  `, [count]);
}

async function applyMigration(direction: 'up' | 'down') {
  const statements: string[] = [];
  migration[direction]({ sql: (statement) => statements.push(statement) });
  for (const statement of statements) await dbA.query(statement);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function secondsUntil(evaluatedAt: string, resetsAt: string): number {
  return Math.max(1, Math.ceil((Date.parse(resetsAt) - Date.parse(evaluatedAt)) / 1_000));
}
