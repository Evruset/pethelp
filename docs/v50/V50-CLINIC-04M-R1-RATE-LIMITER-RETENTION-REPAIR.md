# V50-CLINIC-04M-R1 — Shared Rate Limiter Retention Contract Repair

Status: `COMPLETE / DOCUMENTATION_ONLY`.

## Decision

The original 04M contract incorrectly treated effective limiter-state expiry
and physical row deletion as the same hard 65-minute guarantee. Repository
evidence showed that this was impossible to prove without a database-resident
scheduler: existing maintenance workers stop when all backend replicas stop.
No `pg_cron`, `pg_timetable`, Redis or platform-managed database job exists,
and this repair adds none.

The corrected contract separates:

- strict logical expiry: effective limiter state expires no later than 3,900
  seconds, using PostgreSQL time, window boundaries and `expires_at`
  predicates;
- bounded physical retention: expired rows target deletion within 86,400
  seconds while the application maintenance loop is healthy.

After `expires_at`, a row cannot participate in `consume`, increment an active
counter, block a request or contribute to `Retry-After`. A new fixed window is
created without placing physical deletion on the consume path.

## Cleanup and outage behavior

The existing application worker mechanism owns cleanup. A healthy maintenance
owner runs it at startup and every 900 seconds by default. Each iteration
deletes at most 1,000 expired rows through an `expires_at` index. The operation
is idempotent and safe for concurrent replicas; it must not take a full-table
lock or block counter consumption.

During a complete backend outage, cleanup pauses and the 24-hour physical
target may temporarily be exceeded. No limiter decisions are served then.
After recovery, database-time expiry remains authoritative and startup cleanup
reduces the backlog. Expired counters never reactivate.

## Configuration

```text
logicalStateRetentionSeconds = 3900 maximum
physicalCleanupTargetSeconds = 86400
cleanupIntervalSeconds = 900
cleanupBatchSize = 1000
```

Logical retention must cover the largest configured window and remain at most
3,900 seconds. Physical target must be no shorter than logical retention and no
longer than 86,400 seconds. Cleanup interval and batch size must be positive.

## Privacy and alerts

Rows contain only actor, clinic, location, action, window, count and timestamp
dimensions. They contain no reference value/key, patient or owner data, query,
URL, session token, authorization material, result or fingerprint.

Operational alerts cover an oldest expired row older than 24 hours while the
backend is healthy, growing backlog, cleanup failures, batches repeatedly
reaching the limit and startup cleanup failing to reduce backlog. Alert payload
fields are limited to expired-row count, oldest age, cleanup duration, deleted
count and technical outcome; limiter identity dimensions are forbidden.

## Future proofs

```text
R-01 expired row does not affect consume after logical TTL
R-02 logical expiry uses database time
R-03 expired row does not affect Retry-After
R-04 new window is created without preliminary physical DELETE
R-05 periodic cleanup removes expired rows
R-06 startup cleanup removes backlog
R-07 cleanup uses bounded batches
R-08 cleanup uses the expires_at index
R-09 concurrent cleanup is safe
R-10 backend outage does not change logical-expiry semantics
R-11 physical deletion target is <=24 hours with a healthy worker
R-12 stale backlog after recovery produces an alert
R-13 logs and alerts exclude limiter identity dimensions
R-14 consume correctness is independent of cleanup availability
```

The existing M-01..M-32 matrix remains required, with M-27 clarified as strict
logical state expiry independent of physical cleanup.

## Handoff

The one next slice is:

`V50-CLINIC-04N-A / Shared Replica-Safe PostgreSQL Rate Limiter Foundation`.

It may add one reversible migration, PostgreSQL atomic counters, database time,
logical expiry within 65 minutes, the existing application maintenance worker,
startup cleanup, bounded batches, a healthy-worker physical deletion target of
24 hours and focused multi-instance/concurrency tests. It must not integrate
the limiter into the Registry product endpoint.
