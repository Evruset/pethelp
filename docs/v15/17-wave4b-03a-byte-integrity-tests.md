# W4B-03A proposed storage/provenance test matrix

DESIGN ONLY; none of these tests executed in this goal. Accepted W1–4A/W4B01/W4B02 runtime gates REUSED_STICKY_PASS. New implementation requires exclusive test-owned Docker/PostgreSQL/filesystem; never developer/retained DB reset. Base fe503ab; migration171976 is proposed only.

| ID | Scenario | Required assertion / failure boundary |
|---|---|---|
| B01 | New upload valid bytes, Unicode/binary/PDF bytes | Trusted SHA256 and counted length match persisted/readback bytes, server version/context; descriptive MIME/name not identity |
| B02 | Declared file.size differs from bytes,0bytes,10MiB+1/truncated stream | Reject before published DB binding; bounded memory; no provider |
| B03 | Same-size malicious replacement, in-place write, truncation/append | Digest/length mismatch denies verified use; original current-file vs frozen-version mismatch also denies; no metadata-only fallback |
| B04 | Hash then path rename/delete | Provider receives exact private verified Buffer; no second path open; missing durable version at finish denies current completion |
| B05 | Final symlink, intermediate-directory swap, hardlink/outside root/forged UUID/storagekey | Fail closed, no external source disclosure, no arbitrary fetch; unsafe root policy prevents startup |
| B06 | Concurrent version publication/O_EXCL collision | Never overwrite; unique server object ID; only one operation binding/idempotent reconciliation |
| B07 | Crash before/after file flush, directory flush, DB insert, deferred COMMIT failure | No DB reference to nondurable object; private orphans discoverable; no false verified-success/result/audit |
| B08 | Source deletion/archive/Owner change/metadata change during copy or enqueue | CurrentOwner/context rechecked, capture CAS loses; no foreign or stale binding; torn legacy read cannot be called coherent without write exclusion/immutable generation |
| B09 | Enqueue racing two captures/worker claim | One existing document job; source version bound only QUEUED attempt0 before first claim; no old job rebinding, including pre-rollout QUEUED attempt0/ON CONFLICT |
| B10 | Provider receives stream from same verified private snapshot | Full transport count/hash equal expected; no path/URL token; execution outside PG transaction |
| B11 | Consumer ignores bytes, partial reads, mutates chunks, abort/timeout/throw | No ACTUAL_BYTE_INPUT result binding; resources closed; fixed error codes; source private Buffer intact |
| B12 | Current SIMULATED_OCR on verified document | SOURCE_BYTES_VERIFIED can exist; OCR_RESULT_SOURCE_BOUND remains false; no OCR accuracy/import claim |
| B13 | Stale worker finish after expiry/new claim, same invocation replay | Token/lease fencing permits one accepted result/receipt; stale writer cannot overwrite |
| B14 | Forged version/job/attempt/result/Owner/Pet references or same digest foreign owner | CompositeFK/trigger denial; no cross-tenant dedup/read/existence oracle |
| B15 | Receipt hash/length mismatch, wrong attempt, simulated evidence forged as actual | No result binding; trusted server transport authority enforced, DB context cannot substitute for byte proof |
| B16 | Failure between raw/candidate/receipt/binding/job success, audit/deferred COMMIT failure | Atomic rollback of all result-side rows; lease recoverable; no success audit on denial |
| B17 | Negative version event races result finish | Version-only or context→version event locks prohibit inversion; adversarial deadlock test; linearizable finish-or-denial; later negative event invalidates future eligibility, preserves historical proof |
| B18 | Source bytes missing/replaced/corrupted after success/restore | Historical receipt preserved; future access/import rechecks and rejects; no silent re-eligibility |
| B19 | UPDATE/DELETE/TRUNCATE/forged timestamps/context in provenance | Append-only data and immutable keys; trusted insert identity/time rules; ordinary app role cannot fake administrative verification |
| B20 | Old legacy JSON/jobs/candidates/confirmed revisions populated upgrade | Exact bytes/rows/checksums unchanged; no new verification/result binding/backfilled Owner decision |
| B21 | Fresh upload following terminal legacy job | New document/job/result/candidate IDs; old grants/confirmations not copied; exact currentOwner and explicit new decision required |
| B22 | Corrected text confirmation | Binding joins immutable result→candidate→CONFIRM event expectedRevision/textVersion/textHash; original extraction unchanged; rejected/stale/PENDING/IN_REVIEW deny future eligibility |
| B23 | Owner/staff/foreign scope, replay after transfer/delete/archive | No source metadata/text/storage key leakage; no-store if projected; denied replay cannot bypass current scope |
| B24 | Existing Wave4A selected DOCUMENT bytes and grants | No grant eligibility/lock-order/API expansion; run only affected storage/stream targeted checks if shared primitive changes |
| B25 | Fresh migration72 and populated71→72; rollback attempt | Append-only new migration,71historical source/checksums unchanged, no destructive DOWN; no legacy provenance rewrite |
| B26 | Worker rollback/old-binary compatibility and legacy mutation regression | All old/new claimers disabled; bound queued/running jobs cannot be stolen by old binaries; deferred DB guard rejects metadata-only bound success; old read compatibility, no implicit Pet OCR write, sidecars retained |
| B27 | Private source/log/audit/diagnostics | No medical bytes/text/storage paths/hashes as public identifiers; generic audit contains IDs+fixed codes only; no public URL |
| B28 | Saturation: max file/concurrent claims/timeout/orphan bounded cleanup | Bounded Buffer/workers, descriptor release, no long PG transaction/provider call, no deletion of published objects |

No blanket full regression or performance rerun. Implementation selects affected existing lease/claim/retry/read tests and focused storage/upload gates; accepted thresholds stay intact. Actual test counts must be reported later from executed results, not this matrix.
