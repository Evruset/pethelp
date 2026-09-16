# ORCH-MOE-02 routing benchmark

Baseline: `065cf6df80f8b29bd4fdd6711624eba027e2c8a8`. Mode: deterministic dry-run, 200 repetitions per route.

| Scenario | VetHelp fixture | v1 gate | v1 experts | MoE gate | MoE experts | MoE status |
|---|---|---:|---:|---:|---:|---|
| c0-r0-config | ORCH policy comment/config correction | FAIL | 2 | PASS | 1 | READY |
| c1-r1-local-bug | OWNER-R2K local fail-closed adapter bug | FAIL | 3 | PASS | 2 | READY |
| c2-r1-ui-api | OWNER-R2K UI plus existing cancellation API integration | FAIL | 6 | PASS | 4 | READY |
| c2-r2-backend-contract | V50-CLINIC-01B HTTP authority matrix | FAIL | 5 | PASS | 3 | READY |
| c3-r2-architecture | Stage-3 centralized capability evaluator architecture | FAIL | 5 | PASS | 3 | READY |
| c3-r3-concurrency-security | V50-OWNER-05 hold idempotency/concurrency invariant dry-run | FAIL | 5 | PASS | 3 | READY |
| required-specialist-unavailable | OWNER responsive defect requiring browser reproduction | FAIL | 3 | PASS | 0 | BLOCKED_SPECIALIST |
| required-test-failure | Clinic Queue focused HTTP test failure | FAIL | 1 | PASS | 1 | REPAIR |

## Totals

- Acceptance: v1 `0/8`; MoE `8/8`.
- Activated experts: v1 `30`; MoE `17`.
- Sum of per-scenario median decision time: v1 `15775 ns`; MoE `66192 ns`.
- Model input/output tokens, actually used models, repair execution and model wall-clock: NOT OBSERVED because this benchmark does not invoke models.
- Router-internal tool calls and repeated policy reads per route: `0`; context overflow is recorded per scenario; no product operation is executed.

## Reproduced defects and repairs

- Search policy contradicted continuation discovery order; it now makes continuation/new-scope ordering explicit.
- Policy TOML was reread on every decision; immutable tables are now cached at module load.
- Stale PASS evidence was dropped but not scheduled; structured three-part fingerprints now route stale checks to targeted rerun.
- The v1 adapter preserves unresolved legacy roles and optional/hard-core activation semantics from the frozen contract.

## Limitations

The timing comparison covers only local routing-decision computation and currently favors v1. It is not end-to-end delivery time. Token savings and model-execution time are BLOCKED by unavailable per-route runtime telemetry; no pricing or savings are inferred.
