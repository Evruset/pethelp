# W4B-03A-01 — Immutable document storage and DB authority

Implementation candidate, 2026-10-11. Base: `addbde9ec696a82cb983c6071c91aeadff7807cc`. Isolated branch: `agent/v15-w4b-03a-01-storage-b5appvjv`. Root was the sole writer; DB, Security and architecture reviewers were read-only. No commit or push. Human implementation acceptance is NOT_RECORDED.

WAVE4B_03A_01_MACHINE_COMPLETE=YES
WAVE4B_03A_01_READY_FOR_PO_REVIEW=YES
OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT

## Storage and upload

New medical uploads use a flat private namespace with server-generated version and storage-object UUIDs. Input must be a Buffer of 1–10 MiB with matching declared length. Validation precedes allocation; the input is copied before the first await. Publication uses exclusive creation at mode0600, file fsync, sealing to0400 with another fsync, directory fsync, and descriptor readback. SHA-256 and byte length describe the actual bytes.

The configured absolute storage root and every ancestor must satisfy ownership and permission checks. Final objects must be regular, owned by the publisher, without hardlink aliases. O_NOFOLLOW, descriptor checks and a verified rehash deny unsafe or changed files. There is no fallback or automatic root creation. Privileged publishers, OS root and DB administrators remain trusted: chmod alone does not prevent privileged mutation.

The existing upload service checks current Owner/Pet authority before filesystem I/O and again under a Pet lock. Document, version, capture event and generic audit metadata commit atomically after storage durability. Pilot routes and the public upload projection are unchanged. Verification rechecks Owner, archive/deletion state, allowed document type, and the current upload storage key/count before and after file I/O.

Internal legacy capture records `OBSERVED_EXISTING_AT_CAPTURE`, an observation interval and `OBSERVED_SEQUENCE_ONLY`. It proves the stored observed sequence, not a coherent historical original. Existing OCR jobs, results and Owner decisions receive no new binding. No Pet medical-history writes or automatic promotion are added.

Failures can leave private orphan objects. Internal reconciliation compares a bounded inventory against immutable published storage IDs and never deletes files. The inventory scans at most1000 entries and returns at most1000 matches; it can be partial and is not a public API or purge tool.

## Additive migration171976

The five tables are `document_byte_versions`, `document_byte_events`, `ocr_job_byte_sources`, `ocr_attempt_byte_receipts` and `ocr_result_byte_bindings`. Composite foreign keys preserve exact document/Owner/Pet/job/attempt/result and digest/count relationships. Provenance is append-only; capture/event/source timestamps are server-stamped. Negative events prevent subsequent positive verification events. Source binding requires current allowed scope, a capture event and the canonical current upload key/count.

The nullable, immutable `ocr_jobs.byte_source_creation_xid` records the insertion transaction for new jobs. Historical rows remain NULL without backfill. A sidecar can be inserted only for a newly inserted QUEUED/attempt0 job in that same transaction; an old job cannot be rebound even after UPDATE. Existing UNIQUE(document_id), retry/lifetime behavior, raw results and Owner decisions remain unchanged. An additive exact result/job/attempt unique constraint supports the reserved result-binding foreign key.

Production creates no job-source sidecars, receipts or result bindings in this checkpoint. Receipt and result-binding INSERTs are unconditionally denied. The database rejects bound jobs entering RUNNING, including claims from old binaries, and a deferred guard rejects bound SUCCEEDED commits. Byte-consuming execution remains disabled.

Destructive DOWN refuses and preserves provenance. Binary rollback must stop **all old and new OCR claimers and new publishers**, retain the schema/guards/files, and use old binaries for reads only. Manually creating bound queued jobs can obstruct existing polling. Resuming old claimers requires separately reviewed complete exclusion or quarantine of bound jobs; historic pre-W4B01 direct-writing workers must remain stopped.

## Executed verification

**59 unique PASS; 0 unresolved FAIL.**

| Gate | Unique PASS | Evidence |
|---|---:|---|
| Actual private filesystem |24|filesystem-results.json|
| PostgreSQL/Nest authority and rollback |30|accepted-slice-results.json + type-results.json|
| Populated71→72 upgrade |1|accepted-slice-results.json|
| New-upload Owner/Clinic byte delivery |1|sharing-results.json|
| Existing shared storage compatibility |3|storage-compat-results.json|

The accepted-slice run contains30 PASS and one invalid `PHOTO` fixture failure. The accepted database type is `PET_PHOTO`; correcting only that test fixture and running only the failed assertion produced1 PASS. `gate-ledger.json` combines the actual assertions and their supersessions. Earlier typing, Node spy, metadata fingerprint, retained-row count and audit parameter-cast fixture failures remain in raw attempts and `attempt-history.json`. No threshold was weakened.

Fresh72 migrations, checksum verification and backend build passed. All71 historical migration sources and checksum rows are preserved. Populated upgrade preserves legacy JSON, raw extraction, results, candidates and confirmed Owner history; no historical byte provenance is fabricated. Catalog evidence records zero receipts, result bindings, deadlocks and idle transactions. DOWN rejection retains populated provenance rows.

The accepted matrix is covered within this slice: actual digest/count and bounds; replacement/corruption; final symlink/hardlink/traversal and unsafe ancestors; exclusive collision and concurrent capture; write/fsync/COMMIT failures; Owner/archive/source races; old-job rebinding and old-worker claim denial; forged context and append-only rules; upgrade/rollback; private projection and bounded reconciliation. Provider-consumption portions of B04 and execution/finish cases remain deferred. Draft test labels do not replace the matrix's normative meanings.

The targeted HTTP test delivers actual newly uploaded bytes through existing Owner and Clinic paths, verifies selected isolation, and denies delivery after revoke.77 unrelated accepted HTTP tests were selected out. Other accepted Wave1–4A/W4B01/W4B02 gates are REUSED_STICKY_PASS. No T044 or broad regression rerun. Route/controller, provider, job/review, sharing and shared streaming implementations are unchanged; `contract-preservation.json` records their hashes. Accepted OpenAPI evidence is reused; no fresh export is claimed.

## Reviews and limits

Fresh DB/Data Authority, Security/Privacy and scoped architecture reviews report **NO VETO** on the final source revision. Their reports record actual reviewer messages, not human approval. The original674 dirty snapshot entries are preserved byte-for-byte; the implementation index is empty and HEAD remains at the accepted base. `git diff --check` passes.

The owned Docker filesystem satisfies the tested root/ancestor/UID/mode and fsync model. Production UID/GID/ACL/mount protection, read-only worker separation, restore and retention controls remain rollout prerequisites. No reboot/power-loss, restore, real OCR accuracy, UAT, Pilot or deployment evidence is inferred.

03A-02 requires separately authorized actual byte-input transport/consumption receipts, lease fencing and immutable result binding, source/negative-event/finish races, and exact fresh Owner revision linkage. The current simulation remains metadata-only. Storage integrity, adapter consumption, result provenance, Owner confirmation and clinical validation remain independent. No OCR_RESULT_SOURCE_BOUND, validated import eligibility or completed W4B03A claim is made. Pilot document acquisition and future clinical/import/sharing authority require separate decisions.

Efficiency verdict: INEFFICIENT. Avoidable fixture/compiler/spy/type repairs increased executions. Two bounded production-hardening cycles addressed reviewer findings; no accepted unaffected gate was repeated. There were three distinct read-only review domains, zero parallel writers and no child agents. Aggregate tool/read counts were not instrumented across continuations; no token usage or counts are invented.

This is local, uncommitted evidence. MANIFEST.json and SHA256SUMS bind the final scope.
