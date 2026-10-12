# W4B-03A-03 machine candidate

Base06da28daf36ce51cd53cbe0a4f53c06c128cafa9; branch agent/v15-w4b-03a-03-operations-x14iu6e1. No commit/push. Original674 dirty entries preserved, exact digest recorded in original-dirty-preservation.json.

31 unique focused assertions PASS;0 unresolved FAIL. Publisher11PASS in publisher-tests-v2.log; worker19 unique latestPASS across initial/final/privilege JSON; confirmation1PASS. Initial worker failures were legacy probe module resolution and its dependent expected-binding count, superseded by targeted PASS. Publisher JSON export failed after11PASS; authoritative Jest log retained. gate-ledger.json preserves observations and deduplication rather than summing overlapping reruns. Final backend-build-release.log PASS. Fresh73 migrations PASS; all migration sources byte-identical to baseline, no new migration. Accepted populated upgrades,141 tests, atomic rollback/fencing and OpenAPI7 reused where unchanged; not rerun or counted as fresh.

14 operational drills PASS/0FAIL. Exact13-table database backup/restore hashes preserved, including73 checksums, three results/receipts and two bindings/review revisions. Restored source hashes/lengths verified; missing/stale/corrupt/mismatched/wrong-length copies denied. Explicit negative event quarantines one version while two healthy remain verifiable. Destructive DOWN rejected with history preserved. Actual dedicated worker starts and exits on SIGTERM; four unsafe actual entrypoint profiles denied. Clarification: SIGTERM exercised an IDLE worker (jobs already terminal). Active drain is source-reviewed, not independently runtime-demonstrated. Original drill gate label mentioning drain must not be interpreted as in-flight drain evidence.

Snapshots/backups synthetic and stored outside evidence. Private tmpfs demonstrates logical restore only, never power-loss/durable production storage. No published source object physically deleted; restore fault injection targets test-owned copies. Source DB unchanged by restore drills. No production credentials, service restart, rollout, provider, medical import or sharing change.

OPERATIONAL_TEST_PROFILE=PASS_ISOLATED_TEST_V1
PRODUCTION_STORAGE_ISOLATION=NOT_VERIFIED
WRITER_WORKER_SEPARATION=PASS_ISOLATED_PROFILE; PRODUCTION=NOT_VERIFIED
RESTORE_DURABILITY=PASS_LOGICAL_RESTORE; POWER_LOSS_AND_PRODUCTION=NOT_VERIFIED
RETENTION_POLICY=PENDING_PRODUCT_OWNER_DECISION
REAL_OCR_ADAPTER_ACCEPTANCE=NOT_ACCEPTED
ROLLBACK_COMPATIBILITY=PASS_ISOLATED_DRILL; PRODUCTION=NOT_VERIFIED

Fresh independent DB and Security reviews NO VETO; Operations verdict in review-operations.md. Human acceptance NOT_RECORDED. WAVE4B_03A_03_MACHINE_CANDIDATE=YES
WAVE4B_03A_03_READY_FOR_PO_REVIEW=YES
All three fresh reviews NO VETO for this isolated profile. WAVE4B_03A_COMPLETE is not declared.
OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT

Next actions require separately authorized real-environment immutable/create-only storage, ACL/mount/identity acceptance, durable restore/power-loss checks, active-drain runtime test before rollout, retention decision and real adapter contract acceptance (docs/v15/22). No permission to execute them is inferred.

Efficiency: INEFFICIENT. Root sole writer, three distinct read-only review domains, no parallel writers, two bounded source-hardening batches. Targeted environment retries and affected privilege reruns recorded; a regex-selected rerun overlapped two prior assertions. Initial declared45-tool discovery ceiling was exceeded by repair/evidence handling; exact global counts unavailable after compaction, so no fabricated tool/token count. No broad/sticky141 suite repeated. Discovery frozen; finishing existing bounded scope.
