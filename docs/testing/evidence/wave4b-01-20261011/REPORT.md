# V15-W4B-01 — executed backend foundation evidence

WAVE4B_01_MACHINE_COMPLETE=YES
WAVE4B_01_READY_FOR_REVIEW=YES
WAVE4B_HUMAN_ACCEPTANCE=NOT_RECORDED

## Source, changes and architecture

Published origin/agent/v15-transition-wave-01 and HEAD verified at16888e1a191bf410a6aeb8f611f5ce4af98282df before implementation and final fresh fetch. Implementation is isolated on agent/v15-w4b-01-ocr-4svfycsv. No commit/push, original-tree write/reset/stash/clean or production database operation occurred. Original674dirty snapshot entries are byte/mode/name/symlink/diff/index unchanged. All validation uses exclusive v15-w4b-01-4svfycsv Docker resources with distinct test-owned PostgreSQL; retained containers remain unchanged.

Architecture decisions and exact API/rollback impact: ../../../v15/14-wave4b-01-ocr-foundation.md (repository path docs/v15/14-wave4b-01-ocr-foundation.md). Source snapshot and full patch accompany this packet. Production changes are only Auth registration, OCR worker/service/provider/controller/OpenAPI schema, three exact Pilot-route allowances and additive171974 migration. Tests and generated backend OpenAPI update are directly affected; no dependencies or clients change.

Sole legacy production worker write path removed; historical JSON not deleted or reclassified as confirmed. Labelled SQL view preserves legacy without copy/backfill/row rewrite. New jobs separate document status from OCR execution; idempotent Owner enqueue, concurrency claims,60sleases/token fencing, three lifetime attempts,30sprovider timeout, bounded backoff/recovery, atomic raw/candidate/success. Provider executes outside PostgreSQL transactions. Raw text-only extraction retains available metadata, execution timestamps, result/source identities and coded attempt history. Candidates remain UNCONFIRMED/PENDING_OWNER_REVIEW, never Pet medical truth.

## Actual verification

| Gate | Actual result | Evidence |
| --- | --- | --- |
| New service/authority/concurrency/provenance cases |24PASS retained from focused-attempt-02; failed HTTP case covered separately | focused-attempt-02/focused.json |
| Failed HTTP + populated legacy upgrade repair |2PASS/0FAIL;24previously passed cases selected out | repair.json/log |
| Affected Pilot route guard |19PASS/0FAIL | guard.json/log |
| New OCR sharing isolation |1PASS/0FAIL;75acceptedWave4A cases selected out | sharing.json/log |
| Unique covered total |46PASS,0unresolvedFAIL;27OCR-related +19guard | covered-test-identities.json, test-summary.json |
| Fresh latest chain |70migrationsPASS,checksumPASS;69historicfiles byte-identical | fresh-migrations.log, fresh-checksums.log, migration-source-hashes.json |
| Populated legacy upgrade |1PASS included above; full legacy rows unchanged, both raw values LEGACY_UNVERIFIED; historic checksum rows unchanged; no inventedjobs; DOWN refused | repair.json, owner-ocr-migration.e2e-spec.ts |
| Backend final build |PASS | backend-build-contract.log |
| OpenAPI assertions |5PASS (4affectedexisting +newOCR) | openapi-assert-1..5.log |
| Old OpenAPI contract preservation |All prior operations/othermetadata deeply identical; only2paths/3operations added | final-verification.json |
| DB/Data Authority review |PASS/NO VETO | review-db-data-authority.md |
| Security/Privacy review |NO VETO | review-security-privacy.md |
| Final protection/static checks |emptyindex,gitdiffcheckPASS,original674preserved,retainedresourcesunchanged | final-verification.json, retained-resources-verification.json |
| PostgreSQL final health |0deadlocks,0idle-in-transaction | postgres-final-state.txt |

Current Owner/Pet/Document scope, forged/missing/foreign references, non-Owner roles, concurrent enqueue/claim/retry, lease abandonment/stale completion,3-attempt exhaustion, bounded invalid extraction, unavailable provenance, transaction rollback, provider-outside-transaction and safe errors, source deletion/archive/owner/metadata mutation, legacy retention and no-direct-Pet-write are exercised. New real Nest sharing case proves Owner-only raw GET, retry/foreign/veterinarian denial, no extraction in shared Document metadata/list/context and original authorized bytes. No accepted old sharing tests were repeated.

Fresh results are assembled by exact case identity, not by calling a failed whole-suite run PASS.24cases passed before the isolated HTTP/migration repairs and remain valid: their service/migration dependencies did not change.24repair selector-pending cases are covered by those recorded passes.75oldsharing selector-pending cases remain accepted sticky. No mandatory case is disabled. Raw failed attempts remain visible.

## Failures, repairs and compatibility

- test-harness-attempt-01: foundation did not compile due readonly role fixture; migration1FAIL due checksum registry covering all source files including unapplied171974. Fixed mutable test-principal type and symmetric historical-file filtering.
- focused-attempt-02:24PASS/1FAIL; newHTTP returned404 because Pilot deliberately blocks legacy documents wildcard. Migration did not compile due test SQL quoting. Exact3-operation allowance added, legacy routes remain denied, SQLtest parameterized. Only failed gates rerun,2PASS; affectedguard19PASS.
- openapi-compile-attempt: typed Swagger properties union failed build and blocked newsharing suite with0tests. Closed builder now retains concreteproperties type; finalbuild and5assertionsPASS; newsharing1PASS. No businesslogic change.

Legacy OCR compatibility: PASS with explicit safety boundary. Old JSON exactly retained as LEGACY_UNVERIFIED, no automatic job/backfill/promotion. Existing document PROCESSED status unchanged and independent of new OCR state. Legacy PROCESSING documents require explicit enqueue; the old implicit scan/write is intentionally removed. Before deploying, old worker processes must be stopped; schema rollback retains data and worker stays disabled.

## Outstanding bounds and next recommendation

No unresolved technical veto. Provider remains SIMULATED_OCR, not real document extraction or clinical interpretation. Source digest binds stored document metadata, not bytes; real provider/content-digest provenance requires another bounded slice. At-least-once execution can occur after process crash; fencing/unique constraints provide one accepted persisted result. Source changed under same document id cannot reset job budget; upload a new immutable source. Arbitrary provider messages are intentionally not retained; coded errors/attempt timestamps are retained.

No confirmation API/UI, validated imports or medical promotion exists. Existing Wave4A grants remain untouched. W4B human acceptance, real-device/UAT and Pilot Go-Live are not claimed. Recommended W4B-02: explicit Owner correction/confirmation decision model, optimistic concurrency/idempotency, audit and validated-import authority, with medical sharing eligibility defined before exposure.

Efficiency INEFFICIENT: avoidable new fixture/quoting/Swagger typing errors. Two read-only specialists,0parallelwriters;2bounded service/integration repair phases plus1contract-only compile correction,0repeatedacceptedruntimegates. Exact files-read/search/tool-call totals were not instrumented. No broad repair/architecture loop, unrelated suite or threshold weakening. Source/evidence SHA256 values are in source-snapshot.json, MANIFEST.json and SHA256SUMS; index digest recorded outside packet to avoid self-reference.
