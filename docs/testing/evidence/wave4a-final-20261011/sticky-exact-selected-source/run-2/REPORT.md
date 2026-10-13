# T044 Booking Core engineering baseline

**Classification:** ENGINEERING BASELINE / NOT PRODUCTION SLA.

Branch: `agent/v15-transition-wave-01`; HEAD: `bd9d2c1fab893c1bb7ee72de887fe82d826be38b`; dirty snapshot: `5ff2a9893f481212f4174457a4cdfb795ac692ff58b3e919800d948c7f27b9f2`.

## Fixed engineering thresholds

Hard gates: invariant violations, duplicate mutations, unexpected 5xx, PostgreSQL deadlocks and pool leaks = **0**. Hot contention completion <= 2000 ms; multi-capacity p95 <= 2000 ms; distributed p95 <= 1500 ms; 50-hold expiry cycle <= 2000 ms; waiting pool clients after each profile = 0. These are local stability thresholds, not an SLA.

| Profile | Requests | Concurrency | Success | Controlled | Unexpected | p50 ms | p95 ms | p99 ms | req/s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| final-unit-50-1 | 50 | 50 | 1 | 49 | 0 | 290.68 | 352.23 | 360.32 | 137.96 |
| final-unit-50-2 | 50 | 50 | 1 | 49 | 0 | 138.35 | 204.54 | 211.94 | 234.87 |
| final-unit-50-3 | 50 | 50 | 1 | 49 | 0 | 127.72 | 187.82 | 191.64 | 260.13 |
| final-unit-100-4 | 100 | 100 | 1 | 99 | 0 | 186.52 | 298.48 | 305.92 | 323.79 |
| multi-capacity-5-of-30 | 30 | 30 | 5 | 25 | 0 | 590.37 | 650.18 | 656.83 | 45.66 |
| distributed-c1 | 40 | 1 | 40 | 0 | 0 | 10.2 | 14.18 | 16.7 | 92.66 |
| distributed-c5 | 40 | 5 | 40 | 0 | 0 | 17.29 | 34.7 | 41.92 | 242.16 |
| distributed-c10 | 40 | 10 | 40 | 0 | 0 | 30.81 | 63.9 | 74.34 | 268.15 |
| distributed-c20 | 40 | 20 | 40 | 0 | 0 | 64.57 | 75.71 | 86.36 | 290.06 |
| distributed-c40 | 80 | 40 | 80 | 0 | 0 | 136.79 | 204.31 | 236.32 | 254.08 |
| idempotency-storm-100 | 100 | 100 | 100 | 0 | 0 | 109.04 | 187.48 | 191.69 | 516.63 |
| stale-version-50 | 50 | 50 | 0 | 50 | 0 | 69.63 | 123.68 | 127.48 | 390.81 |
| mixed-command-race-36 | 36 | 36 | 12 | 24 | 0 | 90.86 | 120.19 | 121.88 | 291.39 |
| expiry-backlog-50-cycle | 1 | 1 | 1 | 0 | 0 | 349.77 | 349.77 | 349.77 | 2.86 |

Expiry is one measured worker cycle; its row contains one batch latency. Processed count and items/sec are in results.json; no per-hold percentile is fabricated.

## Bottleneck and safety-margin interpretation

Maximum validated hot-row concurrency: 100. Maximum validated distributed concurrency: 40. Pool max and observed peak are both 20. Pool capacity is reached near concurrency 20; c40 oversubscribes it and produced the highest distributed p95 in this run. The limiting local resource is the 20-connection application pool on a one-CPU container. Concurrency 10 is the conservative repeatable local safety-margin point because it remains below pool capacity; this is not production sizing guidance. No correctness failure justified runtime/index/pool churn.

## Database plans

Slot lookup: LockRows -> Index Scan via appointment_slots_clinical_location_key. Idempotency lookup: LockRows -> Index Scan via idempotency_records_scope_idempotency_key_key. Exact runtime expiry claim shape: Limit -> LockRows -> Index Scan via booking_holds_manual_confirmation_sla_idx.

## Method and limitations

Real PostgreSQL 16, Node v22.23.1, application service transactions, setup excluded from latency. The canonical runner creates and always drops a disposable database, so audit/outbox/fixtures cannot accumulate. Source and dirty-snapshot hashes bind the measured working tree. Percentiles are local/container measurements only. No production/pilot capacity or SLA is claimed.

## Reproduce

`scripts/performance/run-t044-booking-core.sh`
