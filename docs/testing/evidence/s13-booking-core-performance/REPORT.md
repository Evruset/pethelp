# T044 Booking Core engineering baseline

**Classification:** ENGINEERING BASELINE / NOT PRODUCTION SLA.

Branch: `agent/v51-stage-01-architecture`; HEAD: `e9b7b2fb8a9208fb76e0ba2003246a741f3a1c8b`; dirty snapshot: `6788af384dfcab4fb208ce77c4a035fb031ddd28ee9d6fc3870d6d05bd835dac`.

## Fixed engineering thresholds

Hard gates: invariant violations, duplicate mutations, unexpected 5xx, PostgreSQL deadlocks and pool leaks = **0**. Hot contention completion <= 2000 ms; multi-capacity p95 <= 2000 ms; distributed p95 <= 1500 ms; 50-hold expiry cycle <= 2000 ms; waiting pool clients after each profile = 0. These are local stability thresholds, not an SLA.

| Profile | Requests | Concurrency | Success | Controlled | Unexpected | p50 ms | p95 ms | p99 ms | req/s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| final-unit-50-1 | 50 | 50 | 1 | 49 | 0 | 570.61 | 642.99 | 645.01 | 77.16 |
| final-unit-50-2 | 50 | 50 | 1 | 49 | 0 | 311.27 | 382.09 | 392.47 | 125.9 |
| final-unit-50-3 | 50 | 50 | 1 | 49 | 0 | 187.14 | 271.84 | 276.9 | 179.95 |
| final-unit-100-4 | 100 | 100 | 1 | 99 | 0 | 530.6 | 695.79 | 703.42 | 140.77 |
| multi-capacity-5-of-30 | 30 | 30 | 5 | 25 | 0 | 1459.05 | 1548.42 | 1550.32 | 19.35 |
| distributed-c1 | 40 | 1 | 40 | 0 | 0 | 8.36 | 15.83 | 25.32 | 103.35 |
| distributed-c5 | 40 | 5 | 40 | 0 | 0 | 56.08 | 101.23 | 139.73 | 80.49 |
| distributed-c10 | 40 | 10 | 40 | 0 | 0 | 140.66 | 237.57 | 282.95 | 68.41 |
| distributed-c20 | 40 | 20 | 40 | 0 | 0 | 162.53 | 432.24 | 440.15 | 90.85 |
| distributed-c40 | 80 | 40 | 80 | 0 | 0 | 492.73 | 750.39 | 775.72 | 69.72 |
| idempotency-storm-100 | 100 | 100 | 100 | 0 | 0 | 143.08 | 221.25 | 225.35 | 440.8 |
| stale-version-50 | 50 | 50 | 0 | 50 | 0 | 186.26 | 260.98 | 263.29 | 189.66 |
| mixed-command-race-36 | 36 | 36 | 12 | 24 | 0 | 84.81 | 135.79 | 136.49 | 260.23 |
| expiry-backlog-50-cycle | 1 | 1 | 1 | 0 | 0 | 319.6 | 319.6 | 319.6 | 3.13 |

Expiry is one measured worker cycle; its row contains one batch latency. Processed count and items/sec are in results.json; no per-hold percentile is fabricated.

## Bottleneck and safety-margin interpretation

Maximum validated hot-row concurrency: 100. Maximum validated distributed concurrency: 40. Pool max and observed peak are both 20. Pool capacity is reached near concurrency 20; c40 oversubscribes it and produced the highest distributed p95 in this run. The limiting local resource is the 20-connection application pool on a one-CPU container. Concurrency 10 is the conservative repeatable local safety-margin point because it remains below pool capacity; this is not production sizing guidance. No correctness failure justified runtime/index/pool churn.

## Database plans

Slot lookup: LockRows -> Index Scan via appointment_slots_pkey. Idempotency lookup: LockRows -> Index Scan via idempotency_records_scope_idempotency_key_key. Exact runtime expiry claim shape: Limit -> LockRows -> Index Scan via booking_holds_manual_confirmation_sla_idx.

## Method and limitations

Real PostgreSQL 16, Node v22.23.1, application service transactions, setup excluded from latency. The canonical runner creates and always drops a disposable database, so audit/outbox/fixtures cannot accumulate. Source and dirty-snapshot hashes bind the measured working tree. Percentiles are local/container measurements only. No production/pilot capacity or SLA is claimed.

## Reproduce

`scripts/performance/run-t044-booking-core.sh`
