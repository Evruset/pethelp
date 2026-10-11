# W4B-03A DB/Data Authority and Security/Privacy risk reviews

Design-only independent source/risk reviews,2026-10-11. Root is sole documentation writer; reviewers read current accepted production source, proposed contract and available catalog audit. No implementation, provider/storage execution or runtime PASS is claimed. Source base fe503ab83e0f927facaca69457d8e9684dee20d1. Reviewed design:16-wave4b-03a-byte-integrity-design.md and17matrix. Reports below summarize actual reviewer messages, not simulated approvals.

## DB/Data Authority — /root/w4b02_db_review

Final NO VETO for corrected design; not human acceptance or implementation/runtime PASS.

Evidence-backed initial design veto: stopping new producers/bound workers alone permits accepted old claim() to take already-bound QUEUED/RUNNING jobs and finish immutable metadata-only success without receipt. Resolved: stop all old/new claimers during rollback; old binaries read-only unless reviewed drain/quarantine/exclusion covers every bound job; add deferred COMMIT success invariant tying bound job/result to exact receipt, and actual binding when ACTUAL_BYTE_INPUT. B26 covers it.

Other clarified invariants: preserve one-job-per-document and171974/171975; sidecar only new INSERT...RETURNING job in same enqueue transaction, never ON CONFLICT old QUEUED/attempt0; exact composite version/job/attempt/result context; append-only provenance; job→Pet→Document→version→attempt lock order, version-only negative event writes never acquire upstream locks. Catalog79columns/57constraints/11triggers confirms baseline table relationships.

Implementation prerequisites: prove deferred guard, old queued rebinding denial, event/finish adversarial races and rollback exclusion (B09/B17/B26); verify trusted storage and transport boundaries. DB can enforce relationships and transitions but cannot attest honestly hashed bytes from a compromised trusted writer.

## Security/Privacy — /root/w4b02_security_review

Final NO VETO for corrected design; not implementation/runtime PASS.

Evidence-backed initial wording gap: copy digest/readback cannot prove absence of torn read from mutable legacy inode. Resolved: observed interval and capture_coherence; coherent original-source capture requires write exclusion/immutable source generation. An observed byte sequence alone is not a coherent historical version. New upload bytes have stronger explicit capture semantics. Historical OCR is never retrospectively source-bound; simulation cannot qualify as actual extraction.

Implementation prerequisites: verify fixed root/ancestor ownership, UID/GID/modes/ACL/mount and filesystem durability; protected publisher with read-only worker, not assumed from current singleton process; trusted adapter full-input delivery/consumption receipts, not producer emission/provider hash; actual race/rollback/privacy runtime tests. Publisher/DB-admin/OS-root are trusted principals; mode-only immutability and hashes do not defeat privileged tampering.

## Risk register and disposition

| Risk | Current finding / proposed mitigation | Gate |
|---|---|---|
| Mutable filesystem, same-size/in-place mutation | Versioned private byte snapshot, counted hash, same verified Buffer to adapter, rehash before use/final/current import | Implementation and storage deployment proof required |
| Path/hardlink/directory swap | Flat server namespace/protected hierarchy/no-follow/descriptor checks, worker read-only; fail closed unsafe deployment | Security rollout prerequisite |
| Legacy torn read or retroactive hash claim | Capture interval/coherence and no old result rebinding; prefer fresh explicit upload/job/Owner decision | OBSERVED_SEQUENCE_ONLY import-ineligible |
| Cross-Owner forged source/decision links | Exact context FKs/locking trigger and current-scope checks before every operation/replay | Focused DB/authority tests required |
| Provider ignores/substitutes/partially consumes input | Trusted full transport receipt/tuple, actual vs simulation classes; no byte binding on timeout/partial/metadata-only | Real adapter acceptance separate |
| Old binary consumes bound job after rollback | Stop all claimers; deferred success guard and reviewed complete exclusion before resuming | Blocking rollback gate |
| FS/DB split commit and orphan objects | Durability-before-reference, atomic ledger publication, private unattached-object reconciliation; published objects retained | Failure injection/durability proof |
| Source deleted/replaced after prior receipt | Sticky negative events, current availability/digest/scope recheck; historical receipt not eligibility | Missing/unverifiable source always ineligible |
| Pilot cannot upload/reupload via frozen routes | Preserve route block; explicit future document-acquisition/reupload decision | W4B03B product prerequisite; no silent unblocking |
| Medical bytes/logs/public URLs/retention | Private storage and IDs, fixed-code generic audit, no public URL; retention/purge separately approved | Privacy/operations prerequisite |

`OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT`. Feasible design under stated preconditions, without any assertion that those preconditions are already deployed/proven. Accepted W1–4A/W4B01/W4B02 machine gates remain REUSED_STICKY_PASS; these findings refine a new design rather than invalidate accepted authority tests.
