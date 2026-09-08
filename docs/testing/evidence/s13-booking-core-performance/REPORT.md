# T044 Booking Core engineering baseline

**Classification:** ENGINEERING BASELINE / NOT PRODUCTION SLA.

Branch: `agent/v51-stage-01-architecture`; HEAD: `62efdc0300537a1621d92c681f0a7efbac5b67bf`; dirty snapshot: `f2dcf692857e7ad257a8dc9ab88ce31f5e094ef5cfc79d9dc67e6752b43d6ad2`.

## Fixed engineering thresholds

Hard gates: invariant violations, duplicate mutations, unexpected 5xx, PostgreSQL deadlocks and pool leaks = **0**. Hot contention completion <= 2000 ms; multi-capacity p95 <= 2000 ms; distributed p95 <= 1500 ms; 50-hold expiry cycle <= 2000 ms; waiting pool clients after each profile = 0. These are local stability thresholds, not an SLA.

| Profile | Requests | Concurrency | Success | Controlled | Unexpected | p50 ms | p95 ms | p99 ms | req/s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| final-unit-50-1 | 50 | 50 | 1 | 49 | 0 | 502.07 | 574.78 | 580.64 | 85.75 |
| final-unit-50-2 | 50 | 50 | 1 | 49 | 0 | 227.93 | 312.35 | 316.5 | 157.7 |
| final-unit-50-3 | 50 | 50 | 1 | 49 | 0 | 163.66 | 234.62 | 237.13 | 210.34 |
| final-unit-100-4 | 100 | 100 | 1 | 99 | 0 | 432.41 | 783.2 | 806.59 | 122.86 |
| multi-capacity-5-of-30 | 30 | 30 | 5 | 25 | 0 | 1032.21 | 1064.81 | 1067.06 | 28.11 |
| distributed-c1 | 40 | 1 | 40 | 0 | 0 | 7.54 | 12.69 | 15.13 | 126.98 |
| distributed-c5 | 40 | 5 | 40 | 0 | 0 | 35.34 | 46.85 | 112.26 | 125.26 |
| distributed-c10 | 40 | 10 | 40 | 0 | 0 | 69.79 | 161.77 | 275.85 | 120.36 |
| distributed-c20 | 40 | 20 | 40 | 0 | 0 | 145.9 | 382.19 | 390.98 | 102.26 |
| distributed-c40 | 80 | 40 | 80 | 0 | 0 | 371.59 | 507.3 | 518.26 | 103.85 |
| idempotency-storm-100 | 100 | 100 | 100 | 0 | 0 | 130.8 | 208.41 | 211.48 | 469.04 |
| stale-version-50 | 50 | 50 | 0 | 50 | 0 | 107.19 | 147.09 | 148.88 | 335.02 |
| mixed-command-race-36 | 36 | 36 | 7 | 29 | 0 | 111.37 | 232.77 | 232.79 | 151.93 |
| expiry-backlog-50-cycle | 1 | 1 | 1 | 0 | 0 | 258.98 | 258.98 | 258.98 | 3.86 |

Expiry is one measured worker cycle; its row contains one batch latency. Processed count and items/sec are in results.json; no per-hold percentile is fabricated.

## Bottleneck and safety-margin interpretation

Maximum validated hot-row concurrency: 100. Maximum validated distributed concurrency: 40. Pool max and observed peak are both 20. Pool capacity is reached near concurrency 20; c40 oversubscribes it and produced the highest distributed p95 in this run. The limiting local resource is the 20-connection application pool on a one-CPU container. Concurrency 10 is the conservative repeatable local safety-margin point because it remains below pool capacity; this is not production sizing guidance. No correctness failure justified runtime/index/pool churn.

## Database plans

Slot lookup: LockRows -> Index Scan via appointment_slots_pkey. Idempotency lookup: LockRows -> Index Scan via idempotency_records_scope_idempotency_key_key. Exact runtime expiry claim shape: Limit -> LockRows -> Index Scan via booking_holds_manual_confirmation_sla_idx.

## Method and limitations

Real PostgreSQL 16, Node v22.23.1, application service transactions, setup excluded from latency. The canonical runner creates and always drops a disposable database, so audit/outbox/fixtures cannot accumulate. Source and dirty-snapshot hashes bind the measured working tree. Percentiles are local/container measurements only. No production/pilot capacity or SLA is claimed.

## Reproduce

`scripts/performance/run-t044-booking-core.sh`
