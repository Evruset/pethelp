# V15-W4B-03A — Product Owner architecture acceptance

Recorded2026-10-11 from the explicit Product Owner decision `/goal V15-W4B-03A-DESIGN-ACCEPT — Byte Integrity Architecture`. Accepted baseline `fe503ab83e0f927facaca69457d8e9684dee20d1` (W4B02). This is architecture-direction acceptance only, not implementation readiness evidence, deployment approval or validated import acceptance.

WAVE4B_03A_DESIGN_COMPLETE=YES
WAVE4B_03A_DESIGN_HUMAN_ACCEPTANCE=APPROVED
WAVE4B_03A_READY_FOR_IMPLEMENTATION=YES
OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT

READY_FOR_IMPLEMENTATION means the accepted design may guide a separately authorized implementation goal. No implementation starts in this publication action; operational prerequisites and execution gates below remain unresolved.

## Accepted architecture and explicit separation

Private original-byte snapshots, SHA256 and counted byte length, immutable source-version identity, proposed additive171976, explicit execution receipts, immutable result and exact Owner-confirmed revision linkage, no retrospective historical OCR proof are approved.

| Independent layer | Accepted design evidence/contract | Not inferred |
|---|---|---|
| Stored-source byte integrity | Protected create-only snapshot/version, trusted capture point, SHA256/count, coherent-source classification and re-verification | Adapter consumption or historical upload authenticity |
| Actual adapter consumption | Trusted full-input delivery/consumption receipt matching exact version/digest/count; no mere producer emission or provider-returned hash | Real extraction/accuracy from simulation |
| Immutable execution/result provenance | Context-checked append-only receipt/result binding, attempt+claim fencing and atomic result-side commit; source_binding_identity | Owner approval or clinical correctness |
| Exact Owner confirmation | Immutable CONFIRM candidate event, predecessor revision, textVersion/hash and exact linked result | Byte proof or clinical validation |
| Future clinical-validation authority | Separate explicit validation/import/product authority and sharing-eligibility contract | Automatic consequence of any previous layer; not implemented |

Current SIMULATED_OCR remains SIMULATED_METADATA_ONLY; it never proves real document extraction and cannot earn OCR_RESULT_SOURCE_BOUND. An instrumented test consumer could prove transport mechanics only, not clinical accuracy.

## Required design check — PASS (source/document review only)

Root reviewed the unchanged architecture,28-scenario proposed matrix, actual DB/Security NO VETO risk reviews, source-audit hashes and retained read-only schema catalog. Five layers above remain distinct. Protected snapshot root/ancestors, create-only namespace and rehash protect against replacement under the stated trusted-host model; privileged operators are explicitly trusted, not cryptographically constrained. Same verified private byte Buffer is delivered outside PG transactions; final fencing/scope checks and negative-version lock order handle source/authority races. Snapshot publication is durability-before-DB reference with private orphan reconciliation; published provenance is retained.

Legacy OBSERVED_SEQUENCE_ONLY cannot prove a coherent historical file; write exclusion/immutable generation or a fresh explicit upload is required. Old OCR jobs/results/Owner decisions are not rebound. Missing/deleted/replaced/unverifiable source remains ineligible. Rollback disables all old/new claimers; proposed deferred COMMIT receipt/binding guard prevents old metadata-only success for bound jobs. Medical originals remain private, without public URLs or generic medical-text logging. Retention/purge policy requires separate approval. No material architecture decision is missing for acceptance of this bounded direction.

## Publication scope and provenance

Exact11files are listed in MANIFEST.json:8 reviewed documentation/evidence files plus this ACCEPTANCE.md, publication MANIFEST.json and PUBLICATION-SHA256SUMS. The original design package had SHA256SUMS/source-audit/verification but no MANIFEST; this MANIFEST is a new publication supplement, not invented earlier evidence. Main design, matrix, reviews and original audit/evidence bytes are unchanged. Only current-state.md gains a PO acceptance entry; MANIFEST records its original/current hashes and exact removable prefix.

Original SHA256SUMS is preserved as the historical pre-acceptance checkpoint. Its current-state hash refers to the pre-acceptance snapshot, reproducible by removing the recorded acceptance entry. PUBLICATION-SHA256SUMS verifies all final published files except itself. Original DESIGN CANDIDATE/NOT_RECORDED/detached/no-commit statements describe the original audit checkpoint and are superseded only for human acceptance/publication by this decision. No historical machine provenance is rewritten.

Original674dirty entries/status/diff/index remain byte-for-byte preserved. Production/schema/migration changes0; runtime tests/build/migrations0; accepted gates REUSED_STICKY_PASS. Ordinary push only to isolated `agent/v15-w4b-03a-byte-integrity-design-nc811mrg`; no transition/main changes. Actual commit/freshremote SHA receipt is returned after publication; no future self-referential commit hash is fabricated here.

## Implementation prerequisites and restrictions

Before enabling implementation behavior: verify filesystem/root/ancestor UID/GID/modes/ACL/mount, protected publisher/read-only worker separation and durability; implement/test proposed171976 exact-context append-only/deferred guards and rollback exclusion; prove source/path/FD/TOCTOU/failure/concurrency mechanics and privacy against the proposed matrix; retain existing job/grant semantics. Pilot document acquisition/reupload remains a separate product decision. Actual byte-consuming adapter acceptance and clinical validation/import authority remain separate future gates. Metadata hashes, current-file recapture, simulation and Owner confirmation cannot satisfy them automatically.

No W4B03A implementation, W4B03B validated import, medical-history promotion, Owner UI, provider replacement, Wave5, deployment, main merge or Jira/Confluence changes occur here.

Efficiency EFFICIENT: root-only continuation;0subagents/parallel writers/new reviews/production repairs/runtime reruns. Eight reviewed documentation/evidence files and16 source digests verified; targeted reads, no new discovery pipeline. Original reviews remain reused design evidence, not fresh implementation PASS.
