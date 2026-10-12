# W4B-03A-03 — Operational integrity candidate

Baseline: 06da28daf36ce51cd53cbe0a4f53c06c128cafa9. Isolated branch agent/v15-w4b-03a-03-operations-x14iu6e1. No production deployment, credentials provisioning, migration, public route, medical import or sharing change.

## Authority and storage controls

Verified-byte enablement remains OFF by default. Enabled execution now requires explicit ISOLATED_TEST_V1, NODE_ENV=test and acceptance marker. Production enablement fails closed. Publisher startup requires WORKERS_ENABLED=false, no byte-writer credentials, canonical private root and exact RW mount. Dedicated worker uses a Nest application context without HTTP controllers. Worker startup requires separate read-only ordinary database identity, dedicated NOINHERIT writer login and reviewed executor privileges. HTTP startup denies worker role.

Linux preflight requires nonroot, NoNewPrivs, zero effective/bounding capabilities, protected canonical ancestors, root mode0700/current UID and exact nosuid/nodev/noexec mount. Worker requires kernel RO and rejects same-filesystem writable mount aliases. Test publisher and worker share numeric UID1000 to preserve accepted snapshot-owner checks, in separate container/mount namespaces. This is NOT proof of distinct OS principals. Host ACLs, host mounts, orchestrator controls and malicious privileged hosts remain outside demonstrated guarantees.

Accepted publication uses exclusive creation, file mode0400, fsync and readback. A publisher owning a RW filesystem can chmod or replace files. The application create-only primitive therefore does NOT establish OS-enforced create-only storage. Production requires independently verified immutable/versioned storage or enforced create-only publisher capability, private durable volumes, approved ACLs and separately proven worker read-only isolation. Existing Dockerfile/compose and alpha Kubernetes manifests do not establish these requirements; no deployment manifests were modified.

## Database and restore startup gate

Static PostgreSQL16 catalog anchors cover accepted171974–171977 functions, triggers including enabled/deferred flags, constraints including validation, and migration checksums. They explicitly include171975 append-only review guards. No startup self-baselining is permitted. Future additive schema changes need reviewed anchor compatibility before enabling this profile. Reader identity cannot be executor member, elevated role or clinical-table writer. Writer login has no direct table privileges; SET LOCAL ROLE executor is transactional and privilege-allowlisted, with no schema CREATE or Pet medical-history write.

Read-only reconciliation is bounded at1000 source versions; exceeding this bound denies startup and requires a separately designed paginated inventory. It validates terminal job/attempt/result/candidate/receipt/binding and review text identities, then rehashes each eligible snapshot and actual length outside DB transactions. Explicit CORRUPT/UNAVAILABLE/REPLACED/RETIRED events quarantine that version without rewriting history. An unclassified missing/corrupt source fails the checked profile. Reconciliation is a checkpoint, not perpetual filesystem immutability: accepted claim/context/finish guards and byte verification remain necessary after startup. It never fabricates earlier byte consumption or retroactively upgrades legacy provenance.

## Isolated operational profile and results

Exclusive PostgreSQL16, Node22, private tmpfs snapshots, UID1000, cap-drop ALL, no-new-privileges, RO worker rootfs and separate RW publisher/RO worker mounts. PostgreSQL resources and backups are test-owned only. Temporary tmpfs holder containers keep objects mounted. tmpfs deliberately demonstrates logical backup/restore, NOT crash/power-loss durability. Backups contain synthetic medical payloads and remain outside evidence and Git; only aggregate hashes are recorded.

31 unique focused assertions PASS, 0 unresolved FAIL. Publisher11, worker19, confirmation1. Initial legacy-probe module resolution failure and dependent classification failure are retained in evidence and superseded by successful targeted reruns; a separate result-export harness failure occurred after publisher11PASS. Fourteen operational drills PASS: worker startup/idle SIGTERM shutdown; exact DB restore; six snapshot restore variants; explicit quarantine; destructive DOWN denial retaining provenance; four actual entrypoint denials. Final backend build PASS. Fresh chain73 migrations PASS; accepted checksum values unchanged. Prior populated upgrades,141 assertions, atomic COMMIT/crash/fencing and OpenAPI7 are REUSED_STICKY_PASS where unchanged, not claimed as fresh executions.

## Rollback and retention runbook

1. Stop all claimers and drain compatible workers before any binary rollback. Do not roll back accepted schema or delete byte objects.
2. Retain versions, negative events, attempts, receipts, result bindings, raw extraction, review revisions and Owner decisions together with original snapshots.
3. Pre-03A02 actual binary claim and finish against a bound job must remain denied by171977. Binary rollback may serve unrelated compatible behavior only; it cannot resume verified processing.
4. Restore DB and object generation together under stopped workers; compare inventory and provenance, verify schema anchors, rehash bytes and length under a reader identity. Unknown missing/corrupt/stale/mismatched objects block resumption. Record known negative events through accepted authority; do not rewrite history or clear quarantine automatically.
5. Resume only a compatible binary after preflight. Recovery must not overwrite accepted results. Destructive DOWN is intentionally rejected; no rollback purge is provided.

Actual old/new binary denial and guarded DOWN were exercised on owned resources; source and decisions retained. No production restart occurred. Retention duration, purge eligibility, legal/privacy policy and backup lifecycle require Product Owner decision. No published snapshot physically deleted and no automated retention implemented.

## Independent release gates

OPERATIONAL_TEST_PROFILE=PASS_ISOLATED_TEST_V1
PRODUCTION_STORAGE_ISOLATION=NOT_VERIFIED
WRITER_WORKER_SEPARATION=PASS_ISOLATED_PROFILE; PRODUCTION=NOT_VERIFIED
RESTORE_DURABILITY=PASS_LOGICAL_RESTORE; POWER_LOSS_AND_PRODUCTION=NOT_VERIFIED
RETENTION_POLICY=PENDING_PRODUCT_OWNER_DECISION
REAL_OCR_ADAPTER_ACCEPTANCE=NOT_ACCEPTED
ROLLBACK_COMPATIBILITY=PASS_ISOLATED_DRILL; PRODUCTION=NOT_VERIFIED

Fresh DB/Data Authority, Security/Privacy and Operations/Architecture reviews: NO VETO for isolated profile. SIGTERM runtime covered idle shutdown only; in-flight drain is source-reviewed and still needs a targeted rollout gate.

WAVE4B_03A_03_MACHINE_CANDIDATE=YES
WAVE4B_03A_03_READY_FOR_PO_REVIEW=YES
Human acceptance NOT_RECORDED. No WAVE4B_03A_COMPLETE claim. OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT.

Evidence: docs/testing/evidence/wave4b-03a-03-20261012/REPORT.md, gate-ledger.json, operational-drill-results.json, reviews and MANIFEST/SHA256SUMS. Next prerequisites: real-environment immutable storage/ACL/mount audit; durable restore and retention decision; actual adapter acceptance described in22; separate PO review. These prerequisites do not authorize implementation or rollout.
