# V50-CLINIC-04N-A — PostgreSQL Rate Limiter Foundation

Status: `COMPLETE / TESTED`.

Authority:

- `V50-CLINIC-PATIENT-ADMIN-REFERENCE-SEARCH-OPERATIONS-CONTRACT.md`;
- `V50-CLINIC-04M-R1-RATE-LIMITER-RETENTION-REPAIR.md`.

## Scope and boundary

This slice adds a reusable PostgreSQL fixed-window limiter foundation. It does
not connect the limiter to Patients Registry, create an HTTP response, change a
role/capability, or expose a product flag. The existing process-local Registry
limiter remains explicitly legacy/test-only until 04N-B.

## Storage

Migration `1719490000000_add_shared_rate_limit_windows.js` creates only
`public.shared_rate_limit_windows`:

- bounded namespace plus actor, clinic and location UUIDs;
- fixed window duration, start/end, logical `expires_at`, hit count and
  database timestamps;
- a unique logical-window identity across namespace/scope/duration/start;
- positive counter/window and 65-minute lifetime constraints;
- `(expires_at, id)` cleanup index.

There is no reference/query, patient/owner data, request payload, token,
fingerprint, JSON metadata or cascading foreign key. Down drops only this
foundation table.

## Atomic consume

`PostgresRateLimitService.consume` validates a bounded policy set, sorts it by
window duration and runs one transaction. One materialized
`clock_timestamp()` is the authority for every policy. A set-based
`INSERT ... ON CONFLICT ... DO UPDATE` atomically creates or increments all
fixed-window counters in deterministic order. A failure rolls the whole policy
set back.

Blocked attempts are committed and remain visible in the shared counter.
`allowed` is true only while every returned count is within its configured
limit. When one or more windows block, PostgreSQL calculates a positive
`Retry-After` from the latest active blocking reset. Database/transaction
failure becomes typed `SHARED_RATE_LIMIT_UNAVAILABLE`, never `allowed=true`.

Two backend instances use separate pools/connections but the same unique rows.
No Node.js clock, mutex, cache, sticky session, advisory lock, Redis or gateway
counter participates.

## Expiry and cleanup

Fixed epoch-aligned windows create a new unique start. Logical expiry is
bounded by `window_started_at + logicalStateRetentionSeconds`, never more than
3,900 seconds and never shorter than the largest policy window. Old physical
rows cannot match or affect a current window and never participate in
`Retry-After`.

`RateLimitCleanupWorker` uses the existing Nest application lifecycle. With
workers enabled it performs one bounded startup run, then runs every 900
seconds. Overlap is coalesced per replica; shutdown clears the unref'd timer
and awaits an in-flight run.

Cleanup selects at most 1,000 expired rows using database time,
`(expires_at,id)`, `FOR UPDATE SKIP LOCKED`, then deletes them in the same
short transaction. Multiple replicas may cooperate. Cleanup failure is
contained and retried next cycle; it cannot change consume. The physical
deletion target is 86,400 seconds with a healthy maintenance loop, not a hard
guarantee while all backend replicas are stopped.

## Configuration

Defaults:

```text
VETHELP_SHARED_RATE_LIMIT_LOGICAL_TTL_SECONDS=3900
VETHELP_SHARED_RATE_LIMIT_PHYSICAL_CLEANUP_TARGET_SECONDS=86400
VETHELP_SHARED_RATE_LIMIT_CLEANUP_INTERVAL_SECONDS=900
VETHELP_SHARED_RATE_LIMIT_CLEANUP_BATCH_SIZE=1000
VETHELP_SHARED_RATE_LIMIT_CLEANUP_MAX_BATCHES_PER_RUN=10
```

Values must be positive. Logical TTL must cover the largest consume window and
be at most 3,900 seconds. Physical target must be between logical TTL and
86,400 seconds. One cleanup transaction cannot exceed 1,000 rows and one
startup/periodic run cannot exceed ten transactions. Repeated saturation is a
bounded backlog signal. Invalid configuration or policy fails closed.

## Privacy-safe telemetry

The foundation records only aggregate allowed/denied/database-failure counts,
cleanup deleted/failure counts, duration, last success and a bounded oldest-age
bucket. Cleanup logs contain only a static operation description. They contain
no actor, clinic, location, row/key, namespace supplied by a user, reference,
patient, query or database error detail.

## Evidence

The focused PostgreSQL 16 suite maps `N-01..N-30` and `R-01..R-14` across
atomic boundaries, two service instances, 100 concurrent consumes, restart,
scope isolation, expired-row behavior, cleanup batching/concurrency,
configuration/privacy, database failure and lifecycle shutdown.

Migration UP/DOWN/DOWN-UP and unrelated-data preservation are covered. A
representative 5,000-row plan proof validates the unique conflict arbiter and
the `(expires_at,id)` cleanup index. PostgreSQL 16.14 foundation tests pass
16/16, existing Registry/reference regressions pass 28/28, Node 22.23.1 build
and migration checksum verification pass. Security/concurrency and business
continuity reviews pass after the bounded Retry-After, catch-up/lifecycle and
dedicated-pool repairs.

## Known limits and non-goals

- Application workers cannot guarantee physical deletion during total outage;
  strict logical expiry remains independent.
- The foundation accepts at most four fixed windows, each no longer than one
  hour. There is no sliding window, token bucket or dynamic policy store.
- Product authority ordering, safe 429 mapping, redaction, search metrics,
  Registry EXPLAIN fixtures and rollout alerts remain outside this slice.

## Next slice

`V50-CLINIC-04N-B / Administrative Reference Search Operational Hardening
Integration`.

It may replace the process-local exact-search limiter and add the already
approved endpoint-safe 429, telemetry/redaction, performance and rollout
proofs. It must not broaden search semantics.
