# V15-W4B-01 — OCR Authority Foundation

## Product Owner decision — 2026-10-11

Technical foundation accepted: `WAVE4B_01_HUMAN_ACCEPTANCE=APPROVED`; see `docs/testing/evidence/wave4b-01-20261011/ACCEPTANCE.md`. This supersedes the historical pre-decision human-acceptance statement below. Simulation is accepted for foundation only.

`OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT`: before any validated medical import, provide a content digest or independently proven immutable original document version. Metadata identity is not proof of byte integrity. No Owner review, validated import, real OCR accuracy or Pilot acceptance is implied. W4B-02 is a next bounded goal only; no implementation here.


Base: 16888e1a191bf410a6aeb8f611f5ce4af98282df. Wave4A accepted under docs/testing/evidence/wave4a-final-20261011/ACCEPTANCE.md. This is an uncommitted bounded backend implementation; W4B human acceptance is not given.

## Authority decisions

Legacy worker's sole production direct-write path into pets.medical_history_ocr and pet_documents.ocr_result is removed. Historical values remain exactly in place and are exposed only through a SQL sidecar view labelled LEGACY_UNVERIFIED; existing Pet/Diary/sharing projections expose neither old OCR nor new candidates as medical truth. The view is not an API. No applied migration changes.

A new additive171974 migration creates per-document jobs, attempt history, immutable raw results and extracted-text candidates. Source identity binds document id/Owner/Pet/type/storage metadata/creation time; it is a metadata digest, not a content-byte digest. Current supported provider is the existing simulation (text and available provider metadata); no external calls, document parsing, NLP, diagnoses or measurements are introduced. Future real provider work must bind original immutable bytes and record its real provenance.

## Lifecycle and storage

Explicit Owner enqueue is idempotent by document id, regardless of document PROCESSED status. No automatic upload/legacy queueing or new upload API is added. Jobs have QUEUED/RUNNING/SUCCEEDED/FAILED states, 60-second leases, random claim fencing, three lifetime attempts,5/10-second failure backoff and bounded abandoned-lease recovery. Multiple workers use FOR UPDATE SKIP LOCKED; provider invocation occurs after claim COMMIT with30-second abort timeout. A provider may execute again after a crash (at-least-once); unique/fenced persistence admits one accepted result.

Attempt completion, raw extraction, candidate and success commit atomically. Lost/failed persistence leaves the lease recoverable. Current source scope/identity is rechecked before persistence. Source deletion/archive/ownership/metadata changes deny completion. Results/candidates and source provenance cannot be edited/deleted/truncated by normal application operations; destructive DOWN is refused. Rollback means disabling workers and retaining provenance. Before deployment, stop old worker binaries so no previous process can continue its legacy direct writes; this task performs no deployment.

Text is bounded to32768 UTF-8 bytes; serialized result to65000 bytes, DB ceiling65536. Only text/provider/providerVersion are supported; unavailable provenance remains null/absent. Errors are fixed codes, never arbitrary provider messages. Candidates are schema1 EXTRACTED_TEXT/PENDING_OWNER_REVIEW, not validated facts. Later correction/confirmation needs a separate Owner-decision layer; original extraction remains immutable.

## API impact

- POST /v1/owner/pets/:petId/documents/:documentId/ocr — enqueue or return same job.
- GET same path — Owner-private state, attempts, unconfirmed result and candidate.
- POST same path/retry — retry a failed current-scope job without resetting lifetime attempts.

Both POSTs accept only an optional empty object. UUID pipes/JWT/Owner guard plus current Pet ownership/active status and exact document Owner/Pet/type/nondeleted scope apply. Foreign/missing scope is404, non-Owner403, invalid path/body400, unavailable/exhausted retry409. Responses use no-store and exclude storage paths, URLs, claim tokens and lease fields. Only these exact methods bypass the existing Pilot legacy-document block. Existing sharing source, grants and old OpenAPI operations remain unchanged; generated OpenAPI adds only these three operations.

## Validation and next slice

Evidence: docs/testing/evidence/wave4b-01-20261011/REPORT.md and SHA256SUMS.46 distinct passing automated cases:27OCR/upgrade/sharing cases +19affected route-guard cases; no unresolved failures. Fresh70migrations/checksums, populated69→70upgrade, build and5OpenAPIassertionsPASS. DB and Security reviews NO VETO. Prior Wave1–4A gates sticky; accepted75HTTPcases selected out of the new sharing test. No client/dependency change.

Recommended W4B-02: bounded backend Owner review/correction/confirmation decision model, optimistic version/idempotency, append-only audit and explicit validated-import authority. Define its validation/medical-sharing eligibility before exposing confirmed imports. No UI or that confirmation implementation is included here.
