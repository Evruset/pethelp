# Alpha deployment and recovery drills

These drills are **Alpha-only**. They require protected GitHub environments and must never use mutable image tags.

## Rollback drill

Prerequisites:

- A known stable deployed digest and a pre-approved defective digest, both in `registry/name@sha256:<64 hex>` form.
- `VETHELP_ALPHA_DRILL_ENABLED=true` repository variable.
- `alpha-drill` environment approval and `VETHELP_ALPHA_KUBECONFIG` secret.
- Namespace name containing `alpha`.

Run the `Alpha Rollback Drill` workflow manually. It injects the defective digest, waits up to 60 seconds for its rollout to fail, explicitly re-applies the stable digest, and waits up to 60 seconds for recovery. The workflow uploads `ROLLBACK_DRILL_REPORT.md`.

Local equivalent:

```bash
export ROLLBACK_DRILL_EXECUTE=true
export KUBE_NAMESPACE=vethelp-alpha
export STABLE_IMAGE_DIGEST='registry.example/vethelp@sha256:<stable>'
export DEFECTIVE_IMAGE_DIGEST='registry.example/vethelp@sha256:<approved-defective>'
scripts/rollback-drill.sh
```

## Restore drill

Prerequisites:

- An isolated disposable restore database, distinct from the source database.
- `pg_dump` archive path supplied via `RESTORE_SNAPSHOT_PATH`.
- Database roles limited to the drill target.

```bash
export RESTORE_DRILL_EXECUTE=true
export RESTORE_DRILL_TARGET_LABEL=alpha-restore-drill
export RESTORE_DRILL_SOURCE_DATABASE_URL='postgres://readonly-source...'
export RESTORE_VERIFY_DATABASE_URL='postgres://restore-drill-target...'
export RESTORE_SNAPSHOT_PATH='/secure/snapshots/vethelp-alpha.dump'
scripts/restore-drill.sh
```

The wrapper captures the pre-restore immutable payment-ledger fingerprint, calls `pg_restore`, and runs `test/restore-verify.spec.ts` with the restored database. The verifier checks all repository migrations through `1719131000000_add_emergency_ops_reviews`, migration checksums, slot counters/capacity and the ledger fingerprint/immutability trigger.

## Evidence retention

Attach the rollback report, restore command log and Jest result to the release change. Any failed drill blocks promotion until investigated and repeated successfully.
