# Wave 4A backend authority checkpoint

Date: 2026-10-06. Status: bounded backend metadata-read slice accepted locally; Wave 4A remains PARTIAL.

Base: `c80b620e6e106c7ce679d60163ab44ad3a18f86f`. Branch: `agent/v15-transition-wave-01`.

## Implemented boundary

Migration `171973` is preserved. Appointment-derived owner/pet/location/clinic context and composite resource FKs prevent authority forgery. Resource grants are immutable references to published Results, individual Amendments or original medical Documents. Grant/revoke audit and outbox effects are atomic and contain IDs, not medical content. ACTIVE grants permit only exact-location active veterinarian membership plus capability and active clinic/location. Administrative registry consent is not consulted.

New grants allow confirmed/reschedule-proposed/completed appointments. Cancellation/no-show denies new grants and does not silently revoke an existing grant. Owner revoke fences version and retry; all subsequent medical reads deny. Missing/foreign/unshared/revoked resources use `MEDICAL_SHARE_NOT_FOUND`; administrative roles are role-denied irrespective of resource existence.

`SELECTED` supports up to 200 explicit resources even with larger history. `ALL_CURRENT` resolves a bounded finite snapshot and rejects more than 200 rather than partially granting history. Owner context flags truncation explicitly. Deleted documents are not eligible and cannot be read. Document read currently returns metadata only, not original bytes.

## Reproduction

Use project `pethelp-wave4a`, both `docker-compose.local.yml` and `dev/wave4a-acceptance.compose.yml`. The worktree is mounted at `/workspace`; PostgreSQL runs as Compose `postgres`. Separate project volumes, no host PostgreSQL and no Pilot data. Workers disabled, scope PILOT_V1. Initial `up -d backend` applied the complete chain to a fresh PostgreSQL 16 database. Upgrade test creates and drops its exact temporary database inside this isolated PostgreSQL server.

Execute via `docker compose -p pethelp-wave4a -f docker-compose.local.yml -f dev/wave4a-acceptance.compose.yml exec -T backend`:

- `npm test -- appointment-medical-sharing-contract.spec.ts --runInBand --silent`: 26/26 PASS (initial combined invocation; runtime compilation failed independently).
- `npm test -- appointment-medical-sharing-http.e2e-spec.ts --runInBand --silent`: final 20/20 PASS.
- `npm test -- --runTestsByPath test/appointment-medical-sharing-migration.e2e-spec.ts --runInBand --silent --passWithNoTests=false`: 1/1 PASS, populated Wave3/legacy OCR preserved and no grants auto-created.
- `npm test -- src/auth/capability.spec.ts src/auth/capability-evaluator.service.spec.ts --runInBand --silent`: 35/35 PASS.
- `npm run build`, `npm run migrate:verify`, `npm run openapi:export`, `node scripts/assert-openapi.cjs`: PASS, exit 0.
- `git diff --check`: PASS.

20-case HTTP matrix covers no automatic history, selected Result/Document metadata, snapshot/future exclusion and snapshot seal, cross-owner/unknown-resource/forged fields, exact tenant/location/role denial, clinic/location inactive, atomic membership inactive+revoked, revoke/version/replay, concurrent create, injected failure rollback, six eligibility combinations, existing grant retained on cancellation, both revoke/read orderings, deleted documents and 201-resource history. Race test observes a PostgreSQL Lock wait before releasing the competing row lock; it does not infer timing from sleeps alone.

Intermediate failures were repaired: test input typing and membership fixture coherence; exact clinical-role enforcement and selected-resource eligibility were strengthened during review. A build concurrent with edits failed and final stabilized build passed. An initial migration test discovery returned zero tests and was NOT counted; explicit runTestsByPath produced the actual PASS. The PG concurrent-query deprecation warning is non-failing; current driver serializes Promise.all reads on one client.

## Review and remaining work

Fresh read-only `wave4a_authority_review`: PASS for this backend metadata-read slice, no residual actionable findings. Root final diff review: PASS. Source document deletion is soft-delete; alternative acceptance is same-location, so composite context FKs preserve existing supported workflows. This is not the final Wave4 DB/Security/Independent quorum.

Outstanding: BP-11 operational minimum and client reconciliation, authorized document-byte retrieval, Owner/Clinic sharing UI, history pagination beyond the first 200 selectable resources, membership revoke/read race and expanded attacks in the final matrix, Wave4B OCR, consolidated Waves1–4 regression, final migration/OCR acceptance and fresh final reviews. Wave4A and Wave4 are NOT READY_FOR_HUMAN_REVIEW. Jira/Confluence unchanged; Wave5 not started.

Only after commit/push and fresh local/remote SHA equality may the next substantial slice begin.
