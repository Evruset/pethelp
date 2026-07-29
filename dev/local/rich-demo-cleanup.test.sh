#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(git rev-parse --show-toplevel)"
LAUNCHER="$ROOT_DIR/dev/local/rich-demo-up.sh"
FIXTURE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/vethelp-rich-demo-cleanup.XXXXXX")"
MANAGED="$FIXTURE_ROOT/managed"
SENTINEL="$FIXTURE_ROOT/outside-sentinel.txt"

cleanup_fixture() {
  rm -rf "$FIXTURE_ROOT"
}
trap cleanup_fixture EXIT

fail() {
  printf '[cleanup-test] FAIL %s\n' "$*" >&2
  exit 1
}

assert_exists() {
  [[ -e "$1" ]] || fail "expected preserved path: $1"
}

assert_absent() {
  [[ ! -e "$1" ]] || fail "expected removed path: $1"
}

assert_mode() {
  local actual
  actual="$(stat -f '%Lp' "$1")"
  [[ "$actual" == "$2" ]] || fail "mode $actual for $1, expected $2"
}

mkdir -p "$MANAGED/bootstrap-codes" "$MANAGED/logs" "$MANAGED/pids"
printf 'outside\n' >"$SENTINEL"
printf 'keep\n' >"$MANAGED/unrelated.txt"
printf 'seed\n' >"$MANAGED/demo-seed.json"
printf 'code\n' >"$MANAGED/bootstrap-codes/stale.json"
printf 'body\n' >"$MANAGED/session-check-body.txt"
printf 'headers\n' >"$MANAGED/session-check-headers.txt"
ln -s "$FIXTURE_ROOT" "$MANAGED/bootstrap-codes/outside-link"
chmod 755 "$MANAGED" "$MANAGED/bootstrap-codes"
chmod 644 "$MANAGED/unrelated.txt" "$MANAGED/demo-seed.json"

"$LAUNCHER" --internal-cleanup-mode startup --internal-cleanup-dir "$MANAGED"
assert_absent "$MANAGED/bootstrap-codes/stale.json"
assert_absent "$MANAGED/session-check-body.txt"
assert_absent "$MANAGED/session-check-headers.txt"
assert_exists "$MANAGED/bootstrap-codes/outside-link"
assert_exists "$SENTINEL"
assert_exists "$MANAGED/unrelated.txt"
assert_exists "$MANAGED/demo-seed.json"
assert_mode "$MANAGED" 700
assert_mode "$MANAGED/bootstrap-codes" 700
assert_mode "$MANAGED/unrelated.txt" 600
assert_mode "$MANAGED/demo-seed.json" 600
printf '[cleanup-test] startup=PASS sentinel=preserved unrelated=preserved broadDeletion=0\n'

printf 'code\n' >"$MANAGED/bootstrap-codes/pending.json"
printf 'json\n' >"$MANAGED/demo-sessions.json"
printf 'html\n' >"$MANAGED/demo-sessions.html"
printf 'body\n' >"$MANAGED/session-check-body.txt"
printf 'headers\n' >"$MANAGED/session-check-headers.txt"
"$LAUNCHER" --internal-cleanup-mode shutdown --internal-cleanup-dir "$MANAGED"
for artifact in \
  "$MANAGED/bootstrap-codes/pending.json" \
  "$MANAGED/demo-sessions.json" \
  "$MANAGED/demo-sessions.html" \
  "$MANAGED/session-check-body.txt" \
  "$MANAGED/session-check-headers.txt"; do
  assert_absent "$artifact"
done
assert_exists "$MANAGED/demo-seed.json"
assert_exists "$MANAGED/logs"
assert_exists "$MANAGED/pids"
assert_exists "$MANAGED/unrelated.txt"
assert_exists "$SENTINEL"
printf '[cleanup-test] shutdown=PASS sentinel=preserved unrelated=preserved broadDeletion=0\n'

"$LAUNCHER" --internal-cleanup-mode shutdown --internal-cleanup-dir "$MANAGED"
assert_exists "$MANAGED/demo-seed.json"
assert_exists "$MANAGED/unrelated.txt"
assert_exists "$SENTINEL"
printf '[cleanup-test] idempotency=PASS exit=0\n'

printf 'code\n' >"$MANAGED/bootstrap-codes/partial.json"
printf 'json\n' >"$MANAGED/demo-sessions.json"
printf 'html\n' >"$MANAGED/demo-sessions.html"
printf 'body\n' >"$MANAGED/session-check-body.txt"
printf 'headers\n' >"$MANAGED/session-check-headers.txt"
set +e
"$LAUNCHER" --internal-cleanup-mode failure --internal-cleanup-dir "$MANAGED"
failure_code=$?
set -e
[[ "$failure_code" == 70 ]] || fail "controlled failure exit $failure_code"
for artifact in \
  "$MANAGED/bootstrap-codes/partial.json" \
  "$MANAGED/demo-sessions.json" \
  "$MANAGED/demo-sessions.html" \
  "$MANAGED/session-check-body.txt" \
  "$MANAGED/session-check-headers.txt"; do
  assert_absent "$artifact"
done
assert_exists "$MANAGED/demo-seed.json"
assert_exists "$MANAGED/unrelated.txt"
assert_exists "$SENTINEL"
printf '[cleanup-test] controlledFailure=PASS exit=70 sentinel=preserved unrelated=preserved broadDeletion=0\n'

set +e
"$LAUNCHER" --internal-cleanup-mode shutdown --internal-cleanup-dir / >/dev/null 2>&1
unsafe_code=$?
set -e
[[ "$unsafe_code" != 0 ]] || fail 'unsafe root cleanup target accepted'
printf '[cleanup-test] unsafeTarget=denied symlinkEscape=0\n'
