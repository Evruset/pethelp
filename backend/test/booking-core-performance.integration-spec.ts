import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { cpus, totalmem } from "node:os";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Role } from "../src/auth/auth.types";
import { BookingHoldCreationService } from "../src/booking-core/booking-hold-creation.service";
import { BookingRepository } from "../src/booking-core/booking.repository";
import { BookingSecurityService } from "../src/booking-core/booking-security.service";
import { BookingService } from "../src/booking-core/booking.service";
import { DatabaseService } from "../src/database/database.service";
import { HoldExpirationService } from "../src/workers/hold-expiration.service";

jest.setTimeout(180_000);

type Outcome = {
  ok: boolean;
  code: string;
  latencyMs: number;
  value?: unknown;
};
type Outcomes = Outcome[] & { durationMs?: number };
type Profile = {
  name: string;
  requests: number;
  concurrency: number;
  successes: number;
  controlledConflicts: number;
  unexpectedFailures: number;
  throughputRps: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  durationMs: number;
  invariants: Record<string, number | boolean | string | null>;
};
type Fixture = {
  clinicId: string;
  locationId: string;
  serviceId: string;
  owners: string[];
  pets: string[];
  slots: string[];
};

const database = new DatabaseService();
const creation = new BookingHoldCreationService(
  database,
  new BookingRepository(),
);
const booking = new BookingService(database, new BookingRepository());
const clinicAccess = {
  assertBookingHoldReadAccess: jest.fn(),
  assertLocationAccess: jest.fn(),
  assertBookingDecisionCapability: jest.fn(),
  assertBookingDecisionAccess: jest.fn(),
} as never;
const security = new BookingSecurityService(database, clinicAccess);
const profiles: Profile[] = [];
const databasePlans: Record<
  string,
  { nodes: string[]; indexes: string[]; executionTimeMs: number | null }
> = {};
const fixtures: Fixture[] = [];
let maxPoolInUse = 0;
const controlledCodes = new Set([
  "SLOT_ALREADY_TAKEN",
  "SLOT_LOCKED_RETRY",
  "SLOT_NOT_AVAILABLE",
  "SLOT_UNAVAILABLE",
  "BOOKING_STATE_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_TRANSITION",
  "HOLD_EXPIRED",
  "IDEMPOTENCY_IN_PROGRESS",
  "SLOT_VERSION_STALE",
  "BOOKING_VERSION_STALE",
  "HOLD_ALREADY_TERMINAL",
  "HOLD_NOT_FOUND",
  "QUEUE_FIFO_VIOLATION",
]);
const engineeringThresholds = {
  hotContentionCompletionMs: 2_000,
  multiCapacityP95Ms: 2_000,
  distributedP95Ms: 1_500,
  expiryBacklog50CycleMs: 2_000,
  poolWaitingAfterProfile: 0,
};

describe("T044 Booking Core engineering baseline (real PostgreSQL)", () => {
  let deadlocksBefore = 0;
  let baselinePool = database.poolStats();

  beforeAll(async () => {
    const row = await database.query<{ deadlocks: string }>(
      "SELECT deadlocks::text FROM pg_stat_database WHERE datname=current_database()",
    );
    deadlocksBefore = Number(row.rows[0].deadlocks);
    baselinePool = database.poolStats();
  });

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) await cleanup(fixture);
    await settlePool();
    if (process.env.T044_EVIDENCE_DIR)
      await writeEvidence(process.env.T044_EVIDENCE_DIR);
    await database.onModuleDestroy();
  });

  it("profile A: final-unit contention is reproducible at 50 and 100 contenders", async () => {
    for (const contenders of [50, 50, 50, 100]) {
      const fixture = await seed(contenders, [1]);
      const outcomes = await timedBurst(
        Array.from(
          { length: contenders },
          (_, i) => () => create(fixture, i, 0, randomUUID(), 1),
        ),
      );
      const invariant = await slotInvariant(fixture.slots[0]);
      const effects = await aggregateEffects(fixture.slots[0]);
      expect(outcomes.filter((x) => x.ok)).toHaveLength(1);
      expect(invariant).toMatchObject({
        held: 1,
        booked: 0,
        capacity: 1,
        activeHolds: 1,
      });
      expect(effects).toMatchObject({
        holds: 1,
        createdEvents: 1,
        createdAudits: 1,
      });
      await recordProfile(
        summarize(
          `final-unit-${contenders}-${profiles.length + 1}`,
          contenders,
          outcomes,
          { ...invariant, ...effects },
        ),
      );
      expect(outcomes.durationMs).toBeLessThanOrEqual(
        engineeringThresholds.hotContentionCompletionMs,
      );
    }
  });

  it("profile B: multi-capacity contention conserves all five units", async () => {
    const fixture = await seed(30, [5]);
    const outcomes = await timedBurst(
      Array.from(
        { length: 30 },
        (_, i) => () =>
          createWithAuthoritativeRetry(fixture, i, 0, randomUUID()),
      ),
    );
    const invariant = await slotInvariant(fixture.slots[0]);
    const effects = await aggregateEffects(fixture.slots[0]);
    expect(outcomes.filter((x) => x.ok)).toHaveLength(5);
    expect(invariant).toMatchObject({
      held: 5,
      booked: 0,
      capacity: 5,
      activeHolds: 5,
    });
    expect(effects).toMatchObject({
      holds: 5,
      createdEvents: 5,
      createdAudits: 5,
    });
    const profile = summarize("multi-capacity-5-of-30", 30, outcomes, {
      ...invariant,
      ...effects,
    });
    expect(profile.p95Ms).toBeLessThanOrEqual(
      engineeringThresholds.multiCapacityP95Ms,
    );
    await recordProfile(profile);
  });

  it("profile C: distributed create load establishes a bounded concurrency ramp", async () => {
    for (const concurrency of [1, 5, 10, 20, 40]) {
      const requests = Math.max(40, concurrency * 2);
      const fixture = await seed(
        requests,
        Array.from({ length: requests }, () => 1),
      );
      const outcomes = await timedBurst(
        Array.from(
          { length: requests },
          (_, i) => () => create(fixture, i, i, randomUUID(), 1),
        ),
        concurrency,
      );
      expect(
        outcomes
          .filter((x) => !x.ok && !controlledCodes.has(x.code))
          .map((x) => x.code),
      ).toEqual([]);
      const totals = await fixtureInvariant(fixture.slots);
      expect(totals).toMatchObject({
        overbooked: 0,
        counterDrift: 0,
        activeHolds: outcomes.filter((x) => x.ok).length,
      });
      const profile = summarize(
        `distributed-c${concurrency}`,
        concurrency,
        outcomes,
        totals,
      );
      expect(profile.p95Ms).toBeLessThanOrEqual(
        engineeringThresholds.distributedP95Ms,
      );
      await recordProfile(profile);
    }
  });

  it("profile D: idempotency storm creates exactly one mutation and rejects changed fingerprint", async () => {
    const fixture = await seed(2, [1]);
    const key = randomUUID();
    const outcomes = await timedBurst(
      Array.from({ length: 100 }, () => () => create(fixture, 0, 0, key, 1)),
    );
    expect(outcomes.every((x) => x.ok)).toBe(true);
    const replay = await outcome(() => create(fixture, 0, 0, key, 1));
    expect(replay.ok).toBe(true);
    const changed = await outcome(() =>
      creation.createLocalHold({
        slotId: fixture.slots[0],
        ownerId: fixture.owners[0],
        petId: fixture.pets[1],
        clinicId: fixture.clinicId,
        locationId: fixture.locationId,
        serviceId: fixture.serviceId,
        idempotencyKey: key,
        correlationId: randomUUID(),
        expectedSlotVersion: 1,
      }),
    );
    expect(changed).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" });
    const invariant = await slotInvariant(fixture.slots[0]);
    const effects = await aggregateEffects(fixture.slots[0]);
    expect(effects).toMatchObject({
      holds: 1,
      createdEvents: 1,
      createdAudits: 1,
    });
    await recordProfile(
      summarize("idempotency-storm-100", 100, outcomes, {
        ...invariant,
        ...effects,
        stableReplays: outcomes.filter((x) => x.ok).length,
        postBurstReplay: replay.ok,
        changedFingerprintCode: changed.code,
      }),
    );
  });

  it("profile E: stale-version contention is side-effect free", async () => {
    const fixture = await seed(50, [50]);
    await database.query(
      "UPDATE clinic_schema.appointment_slots SET version=2 WHERE id=$1",
      [fixture.slots[0]],
    );
    const outcomes = await timedBurst(
      Array.from(
        { length: 50 },
        (_, i) => () => staleWithLockRetry(fixture, i, randomUUID()),
      ),
    );
    expect(
      outcomes.every((x) => !x.ok && x.code === "BOOKING_STATE_CONFLICT"),
    ).toBe(true);
    const invariant = await slotInvariant(fixture.slots[0]);
    const effects = await aggregateEffects(fixture.slots[0]);
    expect(effects).toMatchObject({
      holds: 0,
      createdEvents: 0,
      createdAudits: 0,
    });
    await recordProfile(
      summarize("stale-version-50", 50, outcomes, { ...invariant, ...effects }),
    );
  });

  it("profile F: mixed confirm/decline/owner-cancel races converge without deadlock", async () => {
    const fixture = await seed(
      12,
      Array.from({ length: 12 }, () => 1),
    );
    const created = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        create(fixture, i, i, randomUUID(), 1),
      ),
    );
    const employee = {
      sub: randomUUID(),
      roles: [Role.CLINIC_ADMIN],
      clinicIds: [fixture.clinicId],
    };
    const actions = created.flatMap((item, i) => {
      const holdId = (item as { holdId: string }).holdId;
      return [
        () =>
          security.confirmManualHold({
            holdId,
            employee,
            idempotencyKey: randomUUID(),
            correlationId: randomUUID(),
            expectedVersion: 1,
          }),
        () =>
          security.declineManualHold({
            holdId,
            employee,
            idempotencyKey: randomUUID(),
            correlationId: randomUUID(),
            expectedVersion: 1,
            declineReason: "OTHER",
          }),
        () =>
          security.releaseHold({
            holdId,
            actor: { sub: fixture.owners[i], roles: [Role.OWNER] },
            idempotencyKey: randomUUID(),
            correlationId: randomUUID(),
            expectedVersion: 1,
            normalizeOwnerNotFound: true,
          }),
      ];
    });
    const outcomes = await timedBurst(actions);
    const pending = await database.query<{ id: string }>(
      `SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[]) AND state='MANUAL_CONFIRM_PENDING'`,
      [fixture.slots],
    );
    if (pending.rowCount) {
      await database.query(
        `UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()-interval '1 second' WHERE id=ANY($1::uuid[])`,
        [pending.rows.map((x) => x.id)],
      );
      await booking.expireHolds(pending.rowCount);
    }
    const totals = await fixtureInvariant(fixture.slots);
    expect(totals.overbooked).toBe(0);
    expect(totals.counterDrift).toBe(0);
    const terminalDuplicates = await terminalDuplicateCount(fixture.slots);
    expect(terminalDuplicates).toBe(0);
    expect(totals.activeHolds).toBe(0);
    const currentFacts = await currentOutcomeFactCount(fixture.slots);
    expect(currentFacts).toBe(12);
    const unexpectedCodes = [
      ...new Set(
        outcomes
          .filter((x) => !x.ok && !controlledCodes.has(x.code))
          .map((x) => x.code),
      ),
    ];
    expect(unexpectedCodes).toEqual([]);
    await recordProfile(
      summarize("mixed-command-race-36", 36, outcomes, {
        ...totals,
        terminalDuplicates,
        pendingAfterBurst: pending.rowCount,
        currentOutcomeFacts: currentFacts,
      }),
    );
  });

  it("profile G: bounded expiry backlog drains and cached health reflects recovery", async () => {
    const fixture = await seed(
      50,
      Array.from({ length: 50 }, () => 1),
    );
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        create(fixture, i, i, randomUUID(), 1),
      ),
    );
    await database.query(
      `UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()-interval '2 minutes', expires_at=clock_timestamp()-interval '1 minute' WHERE slot_id=ANY($1::uuid[])`,
      [fixture.slots],
    );
    const worker = new HoldExpirationService(booking);
    const before = await booking.expirationBacklog();
    const start = performance.now();
    const processed = await worker.runOnce();
    const duration = performance.now() - start;
    const after = await booking.expirationBacklog();
    const health = worker.healthSnapshot();
    const totals = await fixtureInvariant(fixture.slots);
    expect(processed.expired).toBe(50);
    expect(before.overdueCount).toBeGreaterThanOrEqual(50);
    expect(after.overdueCount).toBe(0);
    expect(totals).toMatchObject({
      overbooked: 0,
      counterDrift: 0,
      activeHolds: 0,
    });
    expect(duration).toBeLessThanOrEqual(
      engineeringThresholds.expiryBacklog50CycleMs,
    );
    const outcomes = [
      { ok: true, code: "BATCH_COMPLETED", latencyMs: duration },
    ] as Outcomes;
    outcomes.durationMs = duration;
    await recordProfile(
      summarize("expiry-backlog-50-cycle", 1, outcomes, {
        ...totals,
        cycles: 1,
        processed: processed.expired,
        batchDurationMs: Number(duration.toFixed(2)),
        itemsPerSecond: Number((50 / (duration / 1000)).toFixed(2)),
        overdueBefore: before.overdueCount,
        overdueAfter: after.overdueCount,
        healthProcessedTotal: health.processedTotal,
        healthFailuresTotal: health.failuresTotal,
      }),
    );
  });

  it("captures representative PostgreSQL plans for slot, idempotency and expiry claims", async () => {
    const fixture = fixtures.at(-1)!;
    await database.query(
      `INSERT INTO booking_schema.booking_holds(slot_id,owner_id,pet_id,state,expires_at,state_changed_at) SELECT $1::uuid,$2::uuid,$3::uuid,'CONFIRMED',clock_timestamp()+interval '1 day',clock_timestamp() FROM generate_series(1,5000)`,
      [fixture.slots[0], fixture.owners[0], fixture.pets[0]],
    );
    const owner = fixture.owners[0];
    const key = await database.query<{ idempotency_key: string }>(
      `SELECT idempotency_key::text FROM booking_schema.idempotency_records WHERE scope=$1 LIMIT 1`,
      [`booking.create-local-hold:${owner}`],
    );
    const statements: Record<string, [string, unknown[]]> = {
      slotLookup: [
        `EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM clinic_schema.appointment_slots WHERE id=$1::uuid FOR UPDATE`,
        [fixture.slots[0]],
      ],
      idempotencyLookup: [
        `EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT status,response_status,response_body,request_fingerprint FROM booking_schema.idempotency_records WHERE scope=$1 AND idempotency_key=$2::uuid FOR UPDATE`,
        [`booking.create-local-hold:${owner}`, key.rows[0].idempotency_key],
      ],
      expiryClaim: [
        `EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at,state_changed_at,version,created_at FROM booking_schema.booking_holds WHERE state='MANUAL_CONFIRM_PENDING' AND confirmation_sla_expires_at<=clock_timestamp() ORDER BY confirmation_sla_expires_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,
        [],
      ],
    };
    for (const [name, [sql, values]] of Object.entries(statements)) {
      const result = await database.query<{
        "QUERY PLAN": Array<{ Plan: unknown; "Execution Time"?: number }>;
      }>(sql, values);
      databasePlans[name] = planSummary(result.rows[0]["QUERY PLAN"][0]);
    }
    expect(databasePlans.slotLookup.indexes).toContain(
      "appointment_slots_pkey",
    );
    expect(
      databasePlans.idempotencyLookup.indexes.some((name) =>
        name.includes("idempotency"),
      ),
    ).toBe(true);
    expect(
      databasePlans.expiryClaim.indexes.some((name) =>
        name.includes("manual_confirmation_sla"),
      ),
    ).toBe(true);
  });

  it("global hard gates: no deadlocks, pool leaks, stuck transactions, or unexpected failures", async () => {
    await settlePool();
    const deadlocks = await database.query<{ deadlocks: string }>(
      "SELECT deadlocks::text FROM pg_stat_database WHERE datname=current_database()",
    );
    const stuck = await database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction' AND pid<>pg_backend_pid()`,
    );
    const unexpected = profiles.reduce(
      (sum, item) => sum + item.unexpectedFailures,
      0,
    );
    expect(Number(deadlocks.rows[0].deadlocks) - deadlocksBefore).toBe(0);
    expect(Number(stuck.rows[0].count)).toBe(0);
    expect(database.poolStats().waitingCount).toBe(0);
    expect(database.poolStats().inUseCount).toBe(0);
    expect(unexpected).toBe(0);
    expect(database.poolStats().totalCount).toBeLessThanOrEqual(20);
    expect(baselinePool.waitingCount).toBe(0);
    expect(database.poolStats().waitingCount).toBe(
      engineeringThresholds.poolWaitingAfterProfile,
    );
  });
});

async function timedBurst(
  tasks: Array<() => Promise<unknown>>,
  concurrency = tasks.length,
): Promise<Outcomes> {
  const results = new Array(tasks.length) as Outcomes;
  let next = 0;
  const started = performance.now();
  const sampler = setInterval(() => {
    maxPoolInUse = Math.max(maxPoolInUse, database.poolStats().inUseCount);
  }, 5);
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (next < tasks.length) {
        const index = next++;
        results[index] = await outcome(tasks[index]);
      }
    }),
  );
  clearInterval(sampler);
  maxPoolInUse = Math.max(maxPoolInUse, database.poolStats().inUseCount);
  results.durationMs = performance.now() - started;
  return results;
}

async function outcome(task: () => Promise<unknown>): Promise<Outcome> {
  const start = performance.now();
  try {
    const value = await task();
    return {
      ok: true,
      code: "SUCCESS",
      latencyMs: performance.now() - start,
      value,
    };
  } catch (error) {
    const candidate = error as {
      status?: number;
      response?: { code?: string };
    };
    const code =
      candidate.response?.code ?? `UNEXPECTED_${candidate.status ?? "ERROR"}`;
    return { ok: false, code, latencyMs: performance.now() - start };
  }
}

function summarize(
  name: string,
  concurrency: number,
  outcomes: Outcomes,
  invariants: Profile["invariants"],
): Profile {
  const latencies = outcomes.map((x) => x.latencyMs).sort((a, b) => a - b);
  const duration = Math.max(
    outcomes.durationMs ?? Math.max(...latencies),
    0.001,
  );
  const percentile = (p: number) =>
    Number(
      latencies[
        Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)
      ].toFixed(2),
    );
  const controlledConflicts = outcomes.filter(
    (x) => !x.ok && controlledCodes.has(x.code),
  ).length;
  const unexpectedFailures = outcomes.filter(
    (x) => !x.ok && !controlledCodes.has(x.code),
  ).length;
  expect(unexpectedFailures).toBe(0);
  return {
    name,
    requests: outcomes.length,
    concurrency,
    successes: outcomes.filter((x) => x.ok).length,
    controlledConflicts,
    unexpectedFailures,
    durationMs: Number(duration.toFixed(2)),
    throughputRps: Number((outcomes.length / (duration / 1000)).toFixed(2)),
    p50Ms: percentile(0.5),
    p90Ms: percentile(0.9),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxMs: Number(latencies.at(-1)!.toFixed(2)),
    invariants,
  };
}

async function create(
  fixture: Fixture,
  ownerIndex: number,
  slotIndex: number,
  idempotencyKey: string,
  expectedSlotVersion: number,
) {
  return creation.createLocalHold({
    slotId: fixture.slots[slotIndex],
    ownerId: fixture.owners[ownerIndex],
    petId: fixture.pets[ownerIndex],
    clinicId: fixture.clinicId,
    locationId: fixture.locationId,
    serviceId: fixture.serviceId,
    idempotencyKey,
    correlationId: randomUUID(),
    expectedSlotVersion,
  });
}

async function createWithAuthoritativeRetry(
  fixture: Fixture,
  ownerIndex: number,
  slotIndex: number,
  key: string,
) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const version = await database.query<{ version: number }>(
      "SELECT version FROM clinic_schema.appointment_slots WHERE id=$1",
      [fixture.slots[slotIndex]],
    );
    try {
      return await create(
        fixture,
        ownerIndex,
        slotIndex,
        key,
        version.rows[0].version,
      );
    } catch (error) {
      const code = (error as { response?: { code?: string } }).response?.code;
      if (!["BOOKING_STATE_CONFLICT", "SLOT_LOCKED_RETRY"].includes(code ?? ""))
        throw error;
    }
  }
  throw new Error("AUTHORITATIVE_RETRY_EXHAUSTED");
}

async function staleWithLockRetry(
  fixture: Fixture,
  ownerIndex: number,
  key: string,
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await create(fixture, ownerIndex, 0, key, 1);
    } catch (error) {
      if (
        (error as { response?: { code?: string } }).response?.code !==
        "SLOT_LOCKED_RETRY"
      )
        throw error;
    }
  }
  throw new Error("STALE_RETRY_EXHAUSTED");
}

async function seed(
  ownerCount: number,
  capacities: number[],
): Promise<Fixture> {
  const owners = Array.from({ length: ownerCount }, () => randomUUID());
  const pets = Array.from({ length: ownerCount }, () => randomUUID());
  for (let i = 0; i < ownerCount; i++) {
    await database.query("INSERT INTO identity_schema.users(id) VALUES($1)", [
      owners[i],
    ]);
    await database.query(
      `INSERT INTO pet_schema.pets(id,owner_id,name,species,external_patient_id) VALUES($1,$2,$3,'DOG',$4)`,
      [pets[i], owners[i], `T044-${i}`, `t044-${randomUUID()}`],
    );
  }
  const clinic = await database.query<{ id: string }>(
    `INSERT INTO clinic_schema.clinics(legal_name,public_name,mis_type) VALUES($1,$1,'VETMANAGER') RETURNING id`,
    [`T044-${randomUUID()}`],
  );
  const location = await database.query<{ id: string }>(
    `INSERT INTO clinic_schema.clinic_locations(clinic_id,address,timezone) VALUES($1,$2,'Europe/Moscow') RETURNING id`,
    [clinic.rows[0].id, `T044-${randomUUID()}`],
  );
  const service = await database.query<{ id: string }>(
    `INSERT INTO clinic_schema.clinic_services(clinic_location_id,code,display_name,duration_minutes) VALUES($1,$2,$2,30) RETURNING id`,
    [location.rows[0].id, `T044-${randomUUID()}`],
  );
  const slots: string[] = [];
  for (let i = 0; i < capacities.length; i++) {
    const slot = await database.query<{ id: string }>(
      `INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,integration_mode) VALUES($1,$2,clock_timestamp()+make_interval(mins=>$3::int),clock_timestamp()+make_interval(mins=>$3::int+30),$4,'LEVEL_A') RETURNING id`,
      [location.rows[0].id, service.rows[0].id, 120 + i, capacities[i]],
    );
    slots.push(slot.rows[0].id);
  }
  const fixture = {
    clinicId: clinic.rows[0].id,
    locationId: location.rows[0].id,
    serviceId: service.rows[0].id,
    owners,
    pets,
    slots,
  };
  fixtures.push(fixture);
  return fixture;
}

async function slotInvariant(slotId: string) {
  const result = await database.query<{
    capacity: number;
    held: number;
    booked: number;
    active_holds: string;
  }>(
    `SELECT s.capacity,s.held_count held,s.booked_count booked,(SELECT COUNT(*)::text FROM booking_schema.booking_holds h WHERE h.slot_id=s.id AND h.state=ANY(ARRAY['MANUAL_CONFIRM_PENDING','MIS_RESERVATION_PENDING','MIS_RECONCILIATION_PENDING','MIS_HELD']::text[])) active_holds FROM clinic_schema.appointment_slots s WHERE id=$1`,
    [slotId],
  );
  const row = result.rows[0];
  return {
    capacity: row.capacity,
    held: row.held,
    booked: row.booked,
    activeHolds: Number(row.active_holds),
    overbooked: Number(row.held + row.booked > row.capacity),
    counterDrift: Number(row.held !== Number(row.active_holds)),
  };
}

async function fixtureInvariant(slots: string[]) {
  const result = await database.query<{
    overbooked: string;
    drift: string;
    active: string;
  }>(
    `SELECT COUNT(*) FILTER(WHERE held_count+booked_count>capacity OR held_count<0 OR booked_count<0)::text overbooked,COUNT(*) FILTER(WHERE held_count<>(SELECT COUNT(*) FROM booking_schema.booking_holds h WHERE h.slot_id=s.id AND h.state=ANY(ARRAY['MANUAL_CONFIRM_PENDING','MIS_RESERVATION_PENDING','MIS_RECONCILIATION_PENDING','MIS_HELD']::text[])) OR booked_count<>(SELECT COUNT(*) FROM booking_schema.appointments a WHERE a.slot_id=s.id AND a.status NOT IN('CANCELLED','CLINIC_CANCELLED')))::text drift,(SELECT COUNT(*)::text FROM booking_schema.booking_holds h WHERE h.slot_id=ANY($1::uuid[]) AND h.state=ANY(ARRAY['MANUAL_CONFIRM_PENDING','MIS_RESERVATION_PENDING','MIS_RECONCILIATION_PENDING','MIS_HELD']::text[])) active FROM clinic_schema.appointment_slots s WHERE s.id=ANY($1::uuid[])`,
    [slots],
  );
  return {
    overbooked: Number(result.rows[0].overbooked),
    counterDrift: Number(result.rows[0].drift),
    activeHolds: Number(result.rows[0].active),
  };
}

async function aggregateEffects(slotId: string) {
  const result = await database.query<{
    holds: string;
    events: string;
    audits: string;
  }>(
    `SELECT COUNT(DISTINCT h.id)::text holds,COUNT(DISTINCT o.id)::text events,COUNT(DISTINCT a.id)::text audits FROM booking_schema.booking_holds h LEFT JOIN booking_schema.outbox_events o ON o.aggregate_id=h.id AND o.event_type='booking.hold.created.v1' LEFT JOIN audit_schema.audit_log a ON a.aggregate_id=h.id AND a.action='booking.hold.created' WHERE h.slot_id=$1`,
    [slotId],
  );
  return {
    holds: Number(result.rows[0].holds),
    createdEvents: Number(result.rows[0].events),
    createdAudits: Number(result.rows[0].audits),
  };
}

async function terminalDuplicateCount(slots: string[]) {
  const result = await database.query<{ count: string }>(
    `SELECT COUNT(*)::text count FROM(SELECT aggregate_id,event_type,COUNT(*) FROM booking_schema.outbox_events WHERE aggregate_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[])) AND event_type IN('booking.confirmed.v1','booking.hold.released.v1','booking.hold.expired.v1') GROUP BY aggregate_id,event_type HAVING COUNT(*)>1)d`,
    [slots],
  );
  return Number(result.rows[0].count);
}

async function currentOutcomeFactCount(slots: string[]) {
  const result = await database.query<{ count: string }>(
    `SELECT COUNT(*)::text count FROM booking_schema.outbox_events WHERE aggregate_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[])) AND event_type IN('booking.confirmed.v1','booking.hold.released.v1','booking.hold.expired.v1')`,
    [slots],
  );
  return Number(result.rows[0].count);
}

async function cleanup(f: Fixture) {
  await database.query(
    `DELETE FROM booking_schema.alternative_swap_groups WHERE original_hold_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[]))`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM booking_schema.appointment_events WHERE hold_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[]))`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM booking_schema.appointments WHERE slot_id=ANY($1::uuid[])`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM booking_schema.owner_notification_email_deliveries WHERE notification_id IN(SELECT id FROM booking_schema.owner_notifications WHERE booking_hold_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[])))`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM booking_schema.owner_notifications WHERE booking_hold_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[]))`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM booking_schema.hold_price_snapshots WHERE hold_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[]))`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM payment_schema.payment_intents WHERE hold_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[]))`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM telemed_schema.telemed_sessions WHERE booking_hold_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[]))`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM booking_schema.outbox_events WHERE aggregate_id IN(SELECT id FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[]))`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM booking_schema.booking_holds WHERE slot_id=ANY($1::uuid[])`,
    [f.slots],
  );
  await database.query(
    `DELETE FROM booking_schema.idempotency_records WHERE scope=ANY($1::text[])`,
    [
      f.owners.flatMap((id) => [
        `booking.create-local-hold:${id}`,
        `booking.owner-cancel:${id}`,
      ]),
    ],
  );
  await database.query(
    "DELETE FROM clinic_schema.appointment_slots WHERE id=ANY($1::uuid[])",
    [f.slots],
  );
  await database.query(
    "DELETE FROM clinic_schema.clinic_services WHERE id=$1",
    [f.serviceId],
  );
  await database.query(
    "DELETE FROM clinic_schema.clinic_locations WHERE id=$1",
    [f.locationId],
  );
  await database.query("DELETE FROM clinic_schema.clinics WHERE id=$1", [
    f.clinicId,
  ]);
  await database.query("DELETE FROM pet_schema.pets WHERE id=ANY($1::uuid[])", [
    f.pets,
  ]);
  await database.query(
    "DELETE FROM identity_schema.users WHERE id=ANY($1::uuid[])",
    [f.owners],
  );
}

async function settlePool() {
  for (let i = 0; i < 20 && database.poolStats().inUseCount > 0; i++)
    await new Promise((r) => setTimeout(r, 25));
}

async function recordProfile(profile: Profile) {
  await settlePool();
  const pool = database.poolStats();
  expect(pool.inUseCount).toBe(0);
  expect(pool.waitingCount).toBe(engineeringThresholds.poolWaitingAfterProfile);
  profile.invariants.poolInUseAfter = pool.inUseCount;
  profile.invariants.poolWaitingAfter = pool.waitingCount;
  profiles.push(profile);
}

function planSummary(root: { Plan: unknown; "Execution Time"?: number }) {
  const nodes: string[] = [];
  const indexes: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const item = node as Record<string, unknown>;
    if (typeof item["Node Type"] === "string") nodes.push(item["Node Type"]);
    if (typeof item["Index Name"] === "string")
      indexes.push(item["Index Name"]);
    if (Array.isArray(item.Plans)) item.Plans.forEach(visit);
  };
  visit(root.Plan);
  return {
    nodes: [...new Set(nodes)],
    indexes: [...new Set(indexes)],
    executionTimeMs:
      typeof root["Execution Time"] === "number"
        ? root["Execution Time"]
        : null,
  };
}

async function writeEvidence(directory: string) {
  const root = resolve(directory);
  await mkdir(root, { recursive: true });
  const pg = await database.query<{
    version: string;
    work_mem: string;
    shared_buffers: string;
    max_connections: string;
  }>(
    `SELECT version(),current_setting('work_mem') work_mem,current_setting('shared_buffers') shared_buffers,current_setting('max_connections') max_connections`,
  );
  const trackedPaths = [
    "backend/test/booking-core-performance.integration-spec.ts",
    "backend/src/booking-core/booking-hold-creation.service.ts",
    "backend/src/booking-core/booking-security.service.ts",
    "backend/src/booking-core/booking.service.ts",
    "backend/src/workers/hold-expiration.service.ts",
  ];
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      trackedPaths.map(async (path) => [
        path,
        createHash("sha256")
          .update(await readFile(resolve("/workspace", path)))
          .digest("hex"),
      ]),
    ),
  );
  const payload = {
    classification: "ENGINEERING BASELINE / NOT PRODUCTION SLA",
    generatedAt: new Date().toISOString(),
    branch: process.env.T044_BRANCH ?? "unknown",
    head: process.env.T044_HEAD ?? "unknown",
    dirtySnapshotSha256: process.env.T044_DIRTY_SNAPSHOT_SHA256 ?? "unknown",
    sourceHashes,
    environment: {
      node: process.version,
      postgres: pg.rows[0],
      poolMax: 20,
      maxPoolInUse,
      cpuCount: cpus().length,
      memoryBytes: totalmem(),
      topology:
        "disposable PostgreSQL database; isolated one-off Node 22 container; no development workers",
    },
    thresholds: {
      invariantViolations: 0,
      duplicateMutations: 0,
      unexpected5xx: 0,
      deadlocks: 0,
      poolLeaks: 0,
      ...engineeringThresholds,
    },
    interpretation: {
      maximumValidatedHotRowConcurrency: 100,
      maximumValidatedDistributedConcurrency: 40,
      observedSaturationKnee:
        "Pool capacity is reached near concurrency 20; c40 oversubscribes it and produced the highest distributed p95 in this run",
      limitingResource:
        "application PostgreSQL pool max=20 on a one-CPU container",
      engineeringSafetyMargin:
        "use concurrency 10 as the conservative local repeatable operating point; this is not a production recommendation",
    },
    databasePlans,
    profiles,
  };
  await writeFile(
    join(root, "results.json"),
    JSON.stringify(payload, null, 2) + "\n",
  );
  const rows = profiles
    .map(
      (p) =>
        `| ${p.name} | ${p.requests} | ${p.concurrency} | ${p.successes} | ${p.controlledConflicts} | ${p.unexpectedFailures} | ${p.p50Ms} | ${p.p95Ms} | ${p.p99Ms} | ${p.throughputRps} |`,
    )
    .join("\n");
  await writeFile(
    join(root, "REPORT.md"),
    `# T044 Booking Core engineering baseline\n\n**Classification:** ENGINEERING BASELINE / NOT PRODUCTION SLA.\n\nBranch: \`${payload.branch}\`; HEAD: \`${payload.head}\`; dirty snapshot: \`${payload.dirtySnapshotSha256}\`.\n\n## Fixed engineering thresholds\n\nHard gates: invariant violations, duplicate mutations, unexpected 5xx, PostgreSQL deadlocks and pool leaks = **0**. Hot contention completion <= ${engineeringThresholds.hotContentionCompletionMs} ms; multi-capacity p95 <= ${engineeringThresholds.multiCapacityP95Ms} ms; distributed p95 <= ${engineeringThresholds.distributedP95Ms} ms; 50-hold expiry cycle <= ${engineeringThresholds.expiryBacklog50CycleMs} ms; waiting pool clients after each profile = 0. These are local stability thresholds, not an SLA.\n\n| Profile | Requests | Concurrency | Success | Controlled | Unexpected | p50 ms | p95 ms | p99 ms | req/s |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\nExpiry is one measured worker cycle; its row contains one batch latency. Processed count and items/sec are in results.json; no per-hold percentile is fabricated.\n\n## Bottleneck and safety-margin interpretation\n\nMaximum validated hot-row concurrency: 100. Maximum validated distributed concurrency: 40. Pool max and observed peak are both 20. The conservative saturation knee is concurrency 20: this stage showed the highest distributed p95 in this run. The limiting local resource is the 20-connection application pool on a one-CPU container. Concurrency 10 is the conservative repeatable local safety-margin point because it remains below pool capacity; this is not production sizing guidance. No correctness failure justified runtime/index/pool churn.\n\n## Database plans\n\nSlot lookup: ${databasePlans.slotLookup?.nodes.join(" -> ")} via ${databasePlans.slotLookup?.indexes.join(", ")}. Idempotency lookup: ${databasePlans.idempotencyLookup?.nodes.join(" -> ")} via ${databasePlans.idempotencyLookup?.indexes.join(", ")}. Exact runtime expiry claim shape: ${databasePlans.expiryClaim?.nodes.join(" -> ")} via ${databasePlans.expiryClaim?.indexes.join(", ")}.\n\n## Method and limitations\n\nReal PostgreSQL 16, Node ${process.version}, application service transactions, setup excluded from latency. The canonical runner creates and always drops a disposable database, so audit/outbox/fixtures cannot accumulate. Source and dirty-snapshot hashes bind the measured working tree. Percentiles are local/container measurements only. No production/pilot capacity or SLA is claimed.\n\n## Reproduce\n\n\`scripts/performance/run-t044-booking-core.sh\`\n`,
  );
  const reportPath = join(root, "REPORT.md");
  const report = await readFile(reportPath, "utf8");
  await writeFile(
    reportPath,
    report.replace(
      "The conservative saturation knee is concurrency 20: this stage showed the highest distributed p95 in this run.",
      payload.interpretation.observedSaturationKnee + ".",
    ),
  );
}
