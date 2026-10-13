# W4B-03A-04 — Retention decision pack and real-adapter handoff

Decision material only. No retention periods, purge permissions, legal compliance, real-provider quality or production approval is inferred. No deletion implemented. RETENTION_POLICY=PENDING_PRODUCT_OWNER_DECISION. REAL_OCR_ADAPTER_ACCEPTANCE=NOT_ACCEPTED.

## Product Owner retention decisions

| Data class | Dependency / authority | Decision required | Required reviewers and execution dependencies |
|---|---|---|---|
| Original medical documents | Owner/Pet/document scope; source may be deleted/replaced independently of prior derived provenance | Purpose, retention trigger/duration, replacement/deletion semantics and notices | Product Owner, legal/privacy; storage/backup owners; exact source lineage inventory |
| Immutable byte snapshots and source versions | Exact version/digest/length used by attempts/results; append-only negative events | Retention as evidence vs deletion request handling; holds; eligibility of historical versions after revocation/deletion | Legal/privacy and DB/data authority; immutable storage/versioning capabilities; all dependent receipts/results/reviews indexed |
| OCR raw extraction/results/candidates | Sensitive unconfirmed medical text; candidate is not clinical truth | Retention of failed attempts, superseded extractions and corrected text; minimization and access after deletion | Product Owner, legal/privacy, security; provider-side retention commitments and internal access policy |
| Owner revisions/decisions and audit | Immutable exact-revision decision provenance; audit excludes medical text | Required evidence horizon, correction disputes, legal holds, deletion/anonymization design without false provenance | Legal/privacy and DB/data authority; append-only compatibility and independently approved migration/purge design |
| Backups and replicas | Recoverable DB/object generation including source/result/review lineage | Expiry, restore scope, deletion propagation, hold handling, restore access and breach containment | Operations, legal/privacy, security; verified restore, encryption/key lifecycle and backup inventory |
| Revocation/deletion/legal obligations | Grant revocation is access control, not physical purge; document deletion does not fabricate earlier provenance | Which event denies access immediately; which data must be erased/retained; how conflicting obligations and holds are resolved | Human legal/privacy decision using actual jurisdictions/contracts; Owner communication and auditable authorization |

Proposed decision worksheet (all unanswered): named processing purpose/controller/processors; applicable jurisdictions/legal basis; policy owner/approver; data-class-specific start event and duration; hold exceptions and release authority; Owner export/correction/deletion process; access revocation timing; backup/replica propagation; proof of completed erasure; independently reviewed exception procedure. Do not fill durations by engineering default.

Sequence before enforcement: inventory lineage and backups → legal/privacy and PO decision → reconcile immutable-storage constraints → approved bounded deletion/anonymization design → negative-event/access behavior and backup-restore compatibility tests → separate authorization for execution. Existing append-only guards prohibit destructive rollback; disabling them is not an accepted purge plan. Preserve historical LEGACY_UNVERIFIED/OBSERVED_SEQUENCE_ONLY and never invent replacement provenance.

## Exact future provider-integration checklist

All rows require evidence for the named actual provider/version. Current simulation and test consumer do not satisfy them.

| Requirement | Required acceptance evidence / owner | Current status |
|---|---|---|
| Input-byte boundary | Code and transport trace proving full verified immutable version, SHA-256 and actual length reached extraction consumer; reject partial/zero/wrong bytes, mutable second fetch and unrelated cache | NOT_ACCEPTED |
| Provider identity/version | Pinned adapter/provider/API/model versions where available, unknown provenance explicitly absent; deployment inventory and change policy | NOT_ACCEPTED |
| PDF support | Approved corpus: single/multi-page, scanned vs text PDFs, malformed/password-protected/unsupported documents; bounded pages/bytes/response behavior and deterministic rejection policy | NOT_ACCEPTED |
| Image support | Supported MIME/format/orientation/resolution limits; malformed/truncated/oversized payload tests; no claimed format based solely on extension | NOT_ACCEPTED |
| Russian-language extraction | Representative typed/Cyrillic/mixed-language and clinically relevant layout cases; handwritten text only if explicitly supported and evaluated | NOT_ACCEPTED |
| Error/timeout/cancellation | Actual provider timeout/cancel protocol, retries/idempotency, late callback denial, full stream/resource cleanup, partial response rejection and bounded shutdown; unchanged job fencing | NOT_ACCEPTED |
| Location and privacy | Approved processing regions/subprocessors, transit/at-rest encryption and credential separation, external retention/training usage, contract and deletion/export obligations; legal/privacy/security review | NOT_ACCEPTED |
| Accuracy evaluation | Approved representative consented or appropriately de-identified corpus, ground truth and labeling process; version-specific text errors/layout loss/unsupported-class metrics and failure examples; human-approved thresholds, no invented values | NOT_ACCEPTED |
| Immutable receipt/provenance | Independently reviewed real origin/trust registration; exact job/source/attempt/result/extraction identity and timestamps; full-consumption digest/count; rollback, COMMIT failure and stale-worker tests; current TEST_CONSUMER origin cannot be relabelled | NOT_ACCEPTED |
| Owner revision link | Resolve exact confirmed candidate revision/correction version to immutable result and byte source; confirmation remains text approval, not clinical validation | NOT_ACCEPTED for real adapter; backend mechanics accepted separately |

Use accepted docs/v15/22-wave4b-real-adapter-acceptance-contract.md as the normative handoff. Production adapter origin/protocol allowlist changes require a separate bounded design and approval; no provider integration occurs here. Clinical validation/import authority and separate sharing eligibility remain future contracts.

OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT
WAVE4B_03A_COMPLETE=NO
WAVE4B_03B_READY=NO
