# W4B-03A-02 — Verified OCR execution and immutable result provenance

Implementation candidate; human acceptance NOT_RECORDED. Accepted base `5d1b40582a8e5ee22e2dc087fed47a462fec984a`; isolated branch `agent/v15-w4b-03a-02-execution-i61r043p`. Evidence: `docs/testing/evidence/wave4b-03a-02-20261011/`.

## Authority chain

A new Owner enqueue transaction may bind its newly inserted QUEUED attempt0 job to an UPLOAD_BUFFER source version. Accepted171976 creation-transaction witness, exact composite context, canonical key/count and VERIFIED_CAPTURE checks remain intact. ON CONFLICT returns the existing job without attaching any new source. Observed legacy captures and existing metadata jobs cannot receive retrospective binding.

The byte executor claims through a distinct database identity and locks job → current Pet → Document → immutable version. Attempt recovery remains serialized by the same-job exclusive lock. Three lifetime attempts,60-second leases, SKIP LOCKED and token fencing remain. Invalid current source fails SOURCE_CHANGED; provider failures retain bounded retry/backoff. The accepted legacy worker path remains available for unbound jobs.

After claim COMMIT, the executor rechecks context, reads the exact private UUID snapshot through accepted03A-01 primitives, verifies actual SHA-256/count and rechecks current authority before invocation. It supplies the bounded verified Buffer, IDs and document type; no private storage object/path is passed to the adapter. Filesystem reads and provider execution occur outside PostgreSQL transactions. A post-execution rehash precedes the final database scope/version/event recheck. Snapshot corruption yields a retained CORRUPT event and prevents ordinary provider retry.

## Proof classes and trusted boundary

| Class | Meaning in this candidate |
| --- | --- |
| SOURCE_BYTES_VERIFIED | Frozen private snapshot bytes rehashed and length checked at execution/proof access |
| ACTUAL_BYTE_INPUT / TEST_CONSUMER | Test-only consumer exhausts copied chunks, computes its own hash/count and verifies unchanged chunks and retained Buffer |
| OCR_RESULT_SOURCE_BOUND | Mechanically demonstrated for TEST_CONSUMER only, with exact immutable result binding; no production OCR claim |
| SIMULATED_METADATA_ONLY | Existing production abstraction ignores bytes and reports simulation; receipt records zero consumed bytes, no consumed digest and no actual binding |
| OWNER_CONFIRMED | Exact terminal Owner CONFIRM revision/textVersion/text digest linked to that candidate/result |
| CLINICALLY_VALIDATED | Separate future authority, absent |

The module-private WeakMap accepts opaque receipt objects minted by the adapter boundary, not reconstructed/provider-returned JSON. Full enumeration alone is insufficient: the trusted consuming callback reports its independently measured hash/count; partial/ignored/mutated input, mismatches and cancellation are rejected. Its transport mechanics do not demonstrate OCR accuracy or semantic extraction. TestOnlyByteOcrAdapter minting requires NODE_ENV=test and W4B03A02_ACCEPTANCE=true. No actual production OCR adapter is registered or implemented.

A runtime module with access to trusted adapter code or a compromised dedicated database writer remains inside the trust boundary. SQL role/protocol checks are authorization controls, not cryptographic attestation of consumption. The ordinary application identity must have no executor membership; a dedicated login must be separately provisioned and restricted. Database superusers/migrators remain trusted. No claim of production operational isolation is made.

## Atomic finish and immutable review linkage

After verifying the current lease/token, current Owner/Pet/Document metadata, immutable source tuple and negative events, one writer transaction records attempt completion, raw extraction, candidate, VERIFIED_USE event, trusted receipt, ACTUAL-only result binding, fixed-field audit and job success. Receipt ties invocation ID, job/attempt, expected/consumed digest/count, adapter identity/version, start/end time and extraction identity. Binding identity hashes the exact job/attempt/version/digest/count/result/invocation tuple. Simulation never creates an actual binding.

Additive171977 replaces the disabled171976 receipt/binding insert guards with trusted-writer/context guards and deferred completion checks. Missing receipt or ACTUAL missing binding fails at COMMIT. Failures roll back all completion rows and success audit; the separate failure transaction preserves bounded recovery. Provenance UPDATE/DELETE/TRUNCATE remains forbidden. Earlier migrations are byte-for-byte unchanged.

The internal read-only resolver joins binding → immutable raw result/candidate → latest terminal CONFIRM event by the current Owner. It recomputes original/corrected text identities and returns exact confirmed revision, expectedRevision, textVersion and digest with nonclinical authority. It rechecks source bytes outside a transaction and scope/events again afterward. PENDING, IN_REVIEW, REJECTED, foreign scope, simulation, changed bytes or negative events cannot produce this proof. Historical revisions are never changed. No resolver route is exposed. No Pet medical history, clinical facts, validated import or sharing grant is written.

## Enablement, compatibility and rollback

OCR_VERIFIED_BYTES_ENABLED defaults off. Enabling requires OCR_BYTE_DATABASE_URL on the same database endpoint with a distinct decoded login. The executor uses its own bounded two-connection pool, SET LOCAL ROLE vethelp_ocr_byte_executor and transaction-local VERIFIED_BYTES_V1 protocol. The additive migration creates only a guarded NOLOGIN group role, grants minimum required table/locking privileges, and grants no application login membership. The migration principal needs role-creation/grant authority; provisioning is not performed against production here. Row-lock UPDATE(id/version_id) privileges do not permit Pet medical-history updates; immutable version triggers remain in force.

With enablement off, new jobs remain metadata-only and the updated ordinary claimer skips bound jobs. An old binary attempting a bound claim fails the database trusted-writer gate even if it sets the protocol GUC. Bound success without exact provenance fails deferred guards. Rollback must stop ALL incompatible claimers before binary rollback; retain sources, jobs, receipts, results, review history and171977. Destructive DOWN explicitly refuses. Re-enable only after verifying identity membership, compatible workers and current storage integrity.

Production enablement remains blocked on independently verified private storage isolation, durability/restore/retention and cleanup ownership. No production rollout or actual OCR byte consumer is accepted by these tests. Private orphan inventory remains bounded and performs no deletion; this goal does not introduce lifecycle cleanup or new dependencies.

## Verification and future prerequisites

141 unique tests PASS:42 execution/configuration,2 populated upgrade,25 foundation,45 Owner review,27 storage. Fresh73 migrations/checksums, backend build and7 OpenAPI assertions PASS. Earlier compilation errors are recorded and superseded; accepted runtime assertions were not repeated. Both negative-event-first and finish-first source locks were exercised with real PostgreSQL blocking. Deferred audit COMMIT failure, missing receipt/binding, binding insert failure and stale worker all preserve atomicity. Populated upgrade retains legacy JSON, historical confirmed review, observed classification, source versions/capture event and queued binding exactly. All72 prior migration files remain unchanged.

Public API and Pilot routes are unchanged; Owner OCR/review endpoints retain their accepted contract. No Owner UI, real provider integration, clinical validation or Wave4A sharing changes. Unrelated accepted Wave1–4A gates and T044 remain sticky.

Before W4B-03B: separately accept production storage/restore/retention and writer isolation; implement and independently verify a real adapter consumption boundary and adapter identity/version policy; re-execute OCR from eligible verified original bytes without retrospective claims; separately authorize clinical validation/import and sharing eligibility. Owner confirmation alone is insufficient.

`OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT`
