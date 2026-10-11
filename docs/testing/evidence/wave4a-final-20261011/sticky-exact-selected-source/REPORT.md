# Exact candidate validation — corrected snapshot

Verdict: EXACT_CANDIDATE_VALIDATED / READY_FOR_OWNER_SIGNOFF.

Owner resource-profile and commit-scope approval: PENDING. Wave4A PARTIAL. Wave4B/OCR NOT STARTED. No commit/push, consolidated regression, final Security or Independent Review performed.

## Identity and preservation

Local and freshly fetched remote HEAD: bd9d2c1fab893c1bb7ee72de887fe82d826be38b.
Branch: agent/v15-transition-wave-01.
Candidate Git tree: ea930ca31ae7fcacaf4682e2ffb6094371fd8f0e.
Full 34-file snapshot SHA256: cb4c64706b0861ac9323e7993daa4e80ad330506f860fa9b9c9b71e672fdef43.
Backend source snapshot SHA256: f70aedc781a4cfb5b08d7980e33fd89ce481e754b26c4a843a9fa43436769104.
Git tree body SHA256: 5e0b6cba98e83fece2787c90c5c7e7bb560ff11980734b29d43667e4e90683e0.
Canonical source patch SHA256: 5ff2a9893f481212f4174457a4cdfb795ac692ff58b3e919800d948c7f27b9f2.

Exactly one trailing ASCII space removed from original reconciliation document line2063 and its candidate copy. All 634 other inventoried files unchanged, 635 verified. Original index/status unchanged, WORKING TREE: DIRTY. Known ./.... remains ordinary untracked zero-byte file. Existing diagnostics and artifacts preserved, excluded from candidate. All34 selected hashes and tree unchanged after tests. All29 previously existing Docker containers preserved with same IDs/states.

Historical tree 7d1e9a32dab5f122a0a796015f93222a3665e2f6 and historical evidence ../validation remain untouched. Backend source SHA is unchanged because the correction only affects documentation; new full-file snapshot and tree are recorded separately in snapshot.json. Historical document hash 360f76d42133bcb7b5ff9406f7b14467ce8f2399d9eafc4bb19adb1d0a4223ef; corrected hash df19a2aeea168491b08d6f97b052bffdc404a68f511141a03adb783607dcd3ce.

## Environment and acceptance

Project pethelp-wave4a-t044-exact-20261011c has its own PostgreSQL volume/network. Fresh databases t044_exact_11c_run1/run2/run3 were cloned from the newly migrated clean base (69 migrations through171973). Historical suites create their own databases at required boundaries. No developer/retained database was reset or used. PostgreSQL and actual Node test containers:4 available CPU,cpuset0-3,no cgroup CPU quota. Memory8221097984 bytes (~8.22GB). Node22.23.1,PostgreSQL16.14. Node before/after snapshots verify4 available parallel CPUs, no diagnostics env, no throttling/OOM. Resource snapshots run outside Jest, not inside measured paths.

Canonical pool20,connection timeout700ms,lock timeout50ms,statement timeout250ms unchanged in hashed production source. B30 contenders/capacity5 and D100 concurrent same-key requests unchanged. No hooks, production/migration/API/dependency changes, added retries, or weakened assertions.

| Check | Result |
|---|---|
| Cached and working diff whitespace | PASS |
| Backend build | PASS |
| Fresh migrate:up / migrate:verify | PASS |
| Historical migration suites | 5 PASS /0 FAIL /0 skipped |
| Run1 full T044 | 9 PASS /0 FAIL /0 skipped; B p95 650.68ms; D100/100 |
| Run2 full T044 | 9 PASS /0 FAIL /0 skipped; B p95 650.18ms; D100/100 |
| Run3 full T044 | 9 PASS /0 FAIL /0 skipped; B p95 670.20ms; D100/100 |

Each run: exactly5 B acquisitions/holds/audit/outbox effects; D exactly1 business mutation/hold/audit/outbox effect,100 stable initial successes, stable later replay, changed fingerprint rejected. All profile capacity/counter invariants, deadlock and pool gates PASS. Unexpected failures0; PostgreSQL deadlocks0; post-profile pool in-use/waiting0; no stuck transactions; no container restart/OOM. Full9 test definitions executed in each run. See run-N/jest.log,jest-results.json,results.json,postgres-final-state.txt,node-before.json,node-after.json,container.json.

Initial PostgreSQL setup read occurred before the new server socket was ready; it created no DB and executed no acceptance workload. postgres-preflight.log preserves this. After explicit healthy readiness, postgres-ready.log records successful setup. No measured acceptance was retried.

## Comparison and limits

Previous measured dirty4CPU snapshot: test SHA7cf3c680872f0493a6d429aa41a8395df73268c6fe2678d81f75d37f581d13d3; source SHA889379032d8f2cd1b36bb2f3bdaa16f5771c1ce7b1b3bb6f90f586a7f21fff2f; B p95600.59/666.48/753.18ms; D100/100 in all3. Exact candidate without hooks: test SHA02da614fbca7c34ed26d3494ab6640d5660a077dad3fd30d15ce6da48f1f9bbc; B650.68/650.18/670.20ms; D100/100 all3. Both satisfy4CPU thresholds, but are separately identified source snapshots.

Raw canonical report interpretation includes historical hard-coded one-CPU pool prose. That prose is not a measured resource fact and does not override measured4CPU environment manifests. No new per-request instrumentation was introduced; this run does not causally separate pool/locks/WAL/Node delays, restore1CPU acceptance, or prove historical resource equivalence. Frozen34-file bundle contains earlier preparation metadata; this separate report records the new exact-candidate execution without rewriting frozen historical files.

## Exact selected34 files

- backend/test/booking-core-performance.integration-spec.ts
- backend/test/clinical-foundation-migration.integration-spec.ts
- backend/test/clinical-result-cardinality-migration.integration-spec.ts
- backend/test/v15-clinic-contract-profile-migration.integration-spec.ts
- docs/ai/current-state.md
- docs/testing/evidence/wave4a-t044-20261011-4cpu/README.md
- docs/testing/evidence/wave4a-t044-20261011-4cpu/SHA256SUMS
- docs/testing/evidence/wave4a-t044-20261011-4cpu/commit-plan.md
- docs/testing/evidence/wave4a-t044-20261011-4cpu/engine.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/environment-manifest.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/manifest.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/container.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/jest-results.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/jest.log
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/node-resources-after.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/node-resources-before.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/postgres-final-state.raw.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/results.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/container.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/jest-results.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/jest.log
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/node-resources-after.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/node-resources-before.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/postgres-final-state.raw.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/results.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/container.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/jest-results.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/jest.log
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/node-resources-after.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/node-resources-before.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/postgres-final-state.raw.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/results.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/source-hashes.json
- docs/v15/13-wave4a-regression-reconciliation.md

## Evidence and next action

This directory contains full candidate.diff,snapshot.json,selection-verification.json,summary.json,selected-files.txt,build-migrations.log,history-jest.log/history-jest-results.json,all3 full T044 logs/results and resource/DB state evidence. SHA256SUMS covers new evidence except itself. Prior evidence retained. Temporary worktree and test project retained.

STOP for explicit owner approval of4CPU resource profile and exact34-file commit scope. No acceptance approval is inferred. Original source remains dirty and uncommitted.

