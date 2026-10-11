# Proposed commit scope — NOT STAGED / NOT AUTHORIZED TO COMMIT

Resource decision: RECOMMENDED_FOR_HUMAN_APPROVAL.
Owner sign-off: PENDING. Wave4A PARTIAL. WORKING TREE: DIRTY.

## Exact candidate file list (34)

- backend/test/clinical-foundation-migration.integration-spec.ts
- backend/test/v15-clinic-contract-profile-migration.integration-spec.ts
- backend/test/clinical-result-cardinality-migration.integration-spec.ts
- backend/test/booking-core-performance.integration-spec.ts
- docs/ai/current-state.md
- docs/v15/13-wave4a-regression-reconciliation.md
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
- docs/testing/evidence/wave4a-t044-20261011-4cpu/engine.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/environment-manifest.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/source-hashes.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/manifest.json
- docs/testing/evidence/wave4a-t044-20261011-4cpu/README.md
- docs/testing/evidence/wave4a-t044-20261011-4cpu/commit-plan.md
- docs/testing/evidence/wave4a-t044-20261011-4cpu/SHA256SUMS

The performance file is PARTIAL-HUNK staging only; do not git add the whole
file. Accepted candidate SHA256: 02da614fbca7c34ed26d3494ab6640d5660a077dad3fd30d15ce6da48f1f9bbc.
Local selection patch: .artifacts/wave4a-t044-commit-preparation/20261011-01/accepted-performance.patch
SHA256: 5ff2a9893f481212f4174457a4cdfb795ac692ff58b3e919800d948c7f27b9f2.
Patch applicability to current empty index verified with git apply --check --cached.
No index mutation performed. Patch and candidate exports remain local/excluded.

## Classification

Three historical migration tests: ACCEPTED_TEST_FIX (existing5/5 sticky PASS;
no applied migration changes). T044 catalog/identity assertions,raw plan capture,
and equivalent all100-success error detail: ACCEPTED_TEST_FIX.
T044 dynamic require,lifecycle hooks,request wrapper,B/D captures: OPTIONAL_DIAGNOSTIC;
all excluded from proposed accepted patch, preserved in working tree.
Two reconciliation docs and28-file durable evidence bundle: DOCUMENTATION.
./.... and all .artifacts/** except the profiler itself: LOCAL_ARTIFACT;
profiler instrument.cjs: OPTIONAL_DIAGNOSTIC,not a commit candidate.
No UNEXPECTED files in the inspected pending inventory. Per-file full inventory:
.artifacts/wave4a-t044-commit-preparation/20261011-01/inventory.json.

## Scoped review (not final Security/Independent Review)

Accepted fixes retain historical boundaries,irreversible DOWN/checksum guards,
cardinality negatives and indexed authoritative slot identity proof. No prod/
migration/API/timeout/threshold changes. Assertions are not disabled/weakened.
All24 raw evidence copies byte-match originals (three psql outputs use lossless
UTF8 JSON wrappers with original byte checksums); source hashes match current
measured tree; original artifacts preserved. Log warnings concern retained
one-off project containers only; no cleanup executed.

Default diagnostics: no module load,observer,wrapper,retry probe or sensitive
payload capture when env unset; measured outcome calls direct await task().
Optional awaits in beforeAll/afterAll/post-burst still add microtask boundaries,
so literal zero execution/timing difference is not claimed. They are outside
measured request path. Opt-in utility does not retain SQL parameters,payloads,
tokens or raw response values; only metadata/phase labels/comparison flags.
Trust boundary: arbitrary module path is executable trusted test configuration,
not an API input; never accept it from untrusted users. Ownership check is a
substring test,not parsed fail-closed DB validation. Failed start/finish can
prevent cleanup; wrappers are not restored and assume disposable process.
These diagnostic-only robustness limitations justify EXCLUSION,not acceptance
as functionality. No hook modifications requested or made in this task.
Targeted secret/PII pattern scan of selected raw evidence/docs/hook source found
no private keys,tokens,credential URLs,JWTs or emails. This is scoped inspection,
not proof of every possible secret format or a final privacy gate. Synthetic
fixture UUIDs in raw plans are test data,not real Owner/Pet PII.

## Commands — ONLY AFTER explicit profile/scope approval and selected-source validation

The measured test contains disabled diagnostic hooks; selected accepted source
does not. Proposed candidate has NOT been runtime-executed. Before committing,
validate final chosen source in an isolated owned Docker snapshot with canonical
T044. Do not claim byte identity to the2026-10-11 measured file.
If proposed scope changes,regenerate/review candidate hashes and manifest first.

Commit1: test(backend): reconcile historical migration cutoffs

```sh
git add -- backend/test/clinical-foundation-migration.integration-spec.ts backend/test/v15-clinic-contract-profile-migration.integration-spec.ts backend/test/clinical-result-cardinality-migration.integration-spec.ts
git diff --cached --check
git diff --cached
git commit -m "test(backend): reconcile historical migration cutoffs"
git push origin agent/v15-transition-wave-01
git fetch origin
git rev-parse HEAD
git rev-parse origin/agent/v15-transition-wave-01
```

Require equality after push; if rejected,STOP before any next commit.

Commit2: test(backend): reconcile T044 identity assertions

```sh
git apply --check --cached .artifacts/wave4a-t044-commit-preparation/20261011-01/accepted-performance.patch
git apply --cached .artifacts/wave4a-t044-commit-preparation/20261011-01/accepted-performance.patch
git diff --cached --check
git diff --cached
git commit -m "test(backend): reconcile T044 identity assertions"
git push origin agent/v15-transition-wave-01
git fetch origin
git rev-parse HEAD
git rev-parse origin/agent/v15-transition-wave-01
```

Require equality. Hooks intentionally remain unstaged/dirty; never reset them.

Commit3: docs(v15): recommend four-CPU T044 acceptance

```sh
git add -- \
  docs/ai/current-state.md \
  docs/v15/13-wave4a-regression-reconciliation.md \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/container.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/jest-results.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/jest.log \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/node-resources-after.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/node-resources-before.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/postgres-final-state.raw.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/results.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/container.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/jest-results.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/jest.log \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/node-resources-after.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/node-resources-before.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/postgres-final-state.raw.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-2/results.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/container.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/jest-results.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/jest.log \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/node-resources-after.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/node-resources-before.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/postgres-final-state.raw.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/run-3/results.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/engine.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/environment-manifest.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/source-hashes.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/manifest.json \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/README.md \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/commit-plan.md \
  docs/testing/evidence/wave4a-t044-20261011-4cpu/SHA256SUMS
git diff --cached --check
git diff --cached --stat
git commit -m "docs(v15): recommend four-CPU T044 acceptance"
git push origin agent/v15-transition-wave-01
git fetch origin
git rev-parse HEAD
git rev-parse origin/agent/v15-transition-wave-01
git status --short
```

Commands are a proposal,not executed permission. If owner approves resource
profile,record actual named sign-off separately before final commit; never
silently replace current PENDING status. No blanket git add,no ./....,
diagnostic exports,secrets,local artifacts or unrelated files.
After preparation STOP. No consolidated regression/OCR/Wave4B/final reviews.
