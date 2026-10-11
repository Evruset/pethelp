# V15-W4B-02 — Owner OCR review and decision authority

Base: `57f0a54d82df34322542c874f309bc687c66fb7b`, accepted W4B-01. Isolated branch `agent/v15-w4b-02-review-2ajw4xh6`. Backend only; no commit/push, Owner UI, provider integration, validated import or medical-history promotion.

## Decision model

Raw extraction, metadata provenance and schema-v1 EXTRACTED_TEXT intake candidates remain immutable under171974. New additive171975 stores an append-only Owner decision/revision ledger. Existing candidates have virtual revision0/PENDING_OWNER_REVIEW; migration creates no Owner decisions or historical classifications. START and CORRECT enter IN_REVIEW; CONFIRM and REJECT are terminal. Direct explicit confirmation/rejection of original revision0 is permitted. Historically permitted empty raw extraction can be started/rejected unchanged; corrections must contain nonblank valid UTF-8 text within32768bytes.

Each mutation appends revision=expectedRevision+1. Each correction creates a new textVersion equal to its event revision; START/CONFIRM/REJECT preserve the latest textVersion (0 means original extraction). The decision records its exact predecessor, actor, original text digest, corrected text/version/digest, candidate/job/result/document/Owner/Pet links, source/result identities, database timestamp, idempotency key and keyed request identity. UPDATE/DELETE/TRUNCATE are denied; destructive DOWN is refused. Apply171975 before starting the new binaries; deployment is outside this goal. Disabling the routes is the rollback; history is retained.

The current active Pet Owner alone may read or decide. Job SHARE → Pet SHARE → Document SHARE → candidate UPDATE (SHARE for reads) locks establish current scope and serialize candidate decisions. Service and trigger verify exact context, current Owner, succeeded job, nondeleted original document, predecessor, terminal state, original/current text identities and transition. Ledger insertion commits atomically. No raw/job lifecycle or provider execution is performed by review operations.

## Owner API

Base: `/v1/owner/pets/:petId/documents/:documentId/ocr/candidates/:candidateId/review`.

- GET retrieves original/current text, provenance identities, head and bounded history (limit1–20, default10; offset0–1000000).
- POST `/start`, `/confirm`, `/reject` accept only an optional empty object.
- POST `/corrections` accepts only `{text:string}`.

All commands require strong numeric `If-Match: "N"` and UUID `Idempotency-Key`; responses provide strong revision ETag and no-store. Invalid shape/path/header is400; authenticated non-Owner403; unavailable or foreign exact context404; stale/terminal/idempotency conflict409. Missing/failed jobs without a candidate are404. A candidate attached to a nonsucceeded job is unavailable409. No client supplies an actor, source/job identity or authority. Closed projections exclude storage paths/URLs, lease/claim tokens, HMAC/request identities and database column names.

Identical replay returns the exact original command response and revision, even after a subsequent decision. Reauthorization precedes replay, so current ownership/removal still denies access. Changed payload/action/target/predecessor with the same Owner key conflicts409. Clients GET again for current head after a replay. A fresh-key double confirmation conflicts; it is distinct from identical idempotent replay.

The existing W4B-01 job GET still exposes immutable **original** candidate.text and UNCONFIRMED raw authority; its reviewState now projects current decision state. It does not return corrected text as raw extraction. Only the new review endpoint pairs corrected text with its exact revision/textVersion/decision. CONFIRMED denotes Owner-confirmed text, not medical validation. No job enqueue/retry/claim/finish behavior changes. Pilot allowances are anchored to exactly five new operations; legacy/download/import routes remain blocked.

## Future validated-import authority contract — not implemented

`OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT`.

Metadata identity cannot prove original bytes. Before any validated import, require a content digest verified against the original immutable bytes, or an independently proven immutable document version; preserve its provenance and exact binding to result and confirmed textVersion. A provider result identity or Owner decision alone cannot satisfy this prerequisite. No unavailable byte provenance may be invented or backfilled as verified.

A future separately authorized import must target one exact confirmed candidate revision/textVersion, recheck the current Owner/Pet/Document/result scope and source-byte proof, define trusted clinical structure/validation and an explicit import action with its own idempotency/audit boundary. Owner-confirmed free text must not be treated as diagnoses, drugs, dates or measurements. Corrections and decisions remain immutable provenance; an import cannot rewrite them or legacy LEGACY_UNVERIFIED values.

Imported resources, if later implemented and accepted, require a separate explicit medical-authority classification and sharing-eligibility decision. Confirmation itself creates neither an eligible Wave4A RESULT/AMENDMENT/DOCUMENT nor a grant, and existing grants must never include OCR candidates or Owner decisions automatically. Rejection prevents import of that candidate. No import endpoint, Pet write, clinical resource or sharing-rule change exists in this slice.

## Verification and limits

Evidence: `docs/testing/evidence/wave4b-02-20261011/REPORT.md`, source hashes and SHA256SUMS. Automated authority checks do not imply human approval, real OCR accuracy, source-byte integrity, UI/UAT or Pilot acceptance. Follow-up W4B-03 must keep byte integrity blocking validated import; its product scope and authority must be separately agreed.
