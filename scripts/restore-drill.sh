#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DRILL_EXECUTE:?Set RESTORE_DRILL_EXECUTE=true to run this drill}"
: "${RESTORE_DRILL_SOURCE_DATABASE_URL:?Source database URL is required to capture fingerprint}"
: "${RESTORE_VERIFY_DATABASE_URL:?Restored drill database URL is required}"
: "${RESTORE_SNAPSHOT_PATH:?Path to pg_dump archive is required}"
: "${RESTORE_DRILL_TARGET_LABEL:?Set RESTORE_DRILL_TARGET_LABEL=alpha-restore-drill}"

if [[ "$RESTORE_DRILL_EXECUTE" != "true" ]]; then
  echo "Refusing restore drill: set RESTORE_DRILL_EXECUTE=true" >&2
  exit 2
fi
if [[ "$RESTORE_DRILL_TARGET_LABEL" != "alpha-restore-drill" ]]; then
  echo "Refusing restore drill outside the dedicated alpha restore target" >&2
  exit 2
fi
if [[ ! -f "$RESTORE_SNAPSHOT_PATH" ]]; then
  echo "Snapshot is missing: $RESTORE_SNAPSHOT_PATH" >&2
  exit 2
fi
if [[ "$RESTORE_DRILL_SOURCE_DATABASE_URL" == "$RESTORE_VERIFY_DATABASE_URL" ]]; then
  echo "Source and restore target database URLs must differ" >&2
  exit 2
fi

source_fingerprint="$(DATABASE_URL="$RESTORE_DRILL_SOURCE_DATABASE_URL" npm --prefix backend run -s restore:fingerprint)"
test -n "$source_fingerprint"

pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$RESTORE_VERIFY_DATABASE_URL" \
  "$RESTORE_SNAPSHOT_PATH"

NODE_ENV=restore-verify \
RESTORE_VERIFY_ENABLED=true \
RESTORE_VERIFY_DATABASE_URL="$RESTORE_VERIFY_DATABASE_URL" \
RESTORE_VERIFY_LEDGER_FINGERPRINT="$source_fingerprint" \
npm --prefix backend test -- test/restore-verify.spec.ts

echo "Restore drill passed with ledger fingerprint $source_fingerprint"
