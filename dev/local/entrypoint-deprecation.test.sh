#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
FIXTURE="$(mktemp -d "${TMPDIR:-/tmp}/vethelp-entrypoints.XXXXXX")"
trap 'rm -rf "$FIXTURE"' EXIT

fail(){ printf '[entrypoint-test] FAIL %s\n' "$*" >&2; exit 1; }
expect_deprecated(){
  local expected="$1"
  shift
  set +e
  "$@" >"$FIXTURE/stdout" 2>"$FIXTURE/stderr"
  local code=$?
  set -e
  [[ "$code" == 64 ]] || fail "$expected exit=$code"
  rg -F 'LEGACY_ENTRYPOINT_DEPRECATED' "$FIXTURE/stderr" >/dev/null ||
    fail "$expected missing deprecation code"
  rg -F 'Replacement:' "$FIXTURE/stderr" >/dev/null ||
    fail "$expected missing replacement"
}

VETHELP_DRY_RUN=1 VETHELP_MODE=bounded-test VETHELP_TEST_STATE_ROOT="$FIXTURE/up" \
  "$ROOT_DIR/dev/local/up.sh" >"$FIXTURE/up.out" 2>"$FIXTURE/up.err"
rg -F 'DEPRECATED:' "$FIXTURE/up.err" >/dev/null
rg -F 'docker compose -p vethelp-alpha' "$FIXTURE/up.out" >/dev/null

VETHELP_DRY_RUN=1 VETHELP_MODE=bounded-test VETHELP_TEST_STATE_ROOT="$FIXTURE/down" \
  "$ROOT_DIR/dev/local/down.sh" >"$FIXTURE/down.out" 2>"$FIXTURE/down.err"
rg -F 'DEPRECATED:' "$FIXTURE/down.err" >/dev/null
rg -F ' stop' "$FIXTURE/down.out" >/dev/null

VETHELP_DRY_RUN=1 VETHELP_MODE=bounded-test VETHELP_TEST_STATE_ROOT="$FIXTURE/rich" \
  "$ROOT_DIR/dev/local/rich-demo-up.sh" --no-open >"$FIXTURE/rich.out" 2>"$FIXTURE/rich.err"
rg -F 'DEPRECATED:' "$FIXTURE/rich.err" >/dev/null
rg -F '"profile":"rich-demo"' "$FIXTURE/rich.out" >/dev/null

expect_deprecated journey "$ROOT_DIR/backend/scripts/smoke-local-journey.sh"
expect_deprecated cleanup "$ROOT_DIR/dev/local/rich-demo-cleanup.test.sh"
expect_deprecated local-stack node "$ROOT_DIR/dev/local/local-stack-e2e.mjs"
expect_deprecated owner-web node "$ROOT_DIR/dev/local/owner-mobile-web-e2e.mjs"

if rg -n 'docker compose|COMPOSE=|composeArgs|compose (up|down|stop|run|exec)' \
  "$ROOT_DIR/dev/local/up.sh" \
  "$ROOT_DIR/dev/local/down.sh" \
  "$ROOT_DIR/dev/local/rich-demo-up.sh" \
  "$ROOT_DIR/backend/scripts/smoke-local-journey.sh" \
  "$ROOT_DIR/dev/local/rich-demo-cleanup.test.sh" \
  "$ROOT_DIR/dev/local/local-stack-e2e.mjs" \
  "$ROOT_DIR/dev/local/owner-mobile-web-e2e.mjs" >/dev/null; then
  fail 'lifecycle implementation exists outside canonical launcher'
fi

rg -F '$(CANONICAL_LOCAL) up' "$ROOT_DIR/Makefile" >/dev/null
rg -F '$(CANONICAL_LOCAL) stop' "$ROOT_DIR/Makefile" >/dev/null
if rg -n 'docker compose|COMPOSE=' "$ROOT_DIR/Makefile" >/dev/null; then
  fail 'Makefile owns lifecycle'
fi

REGISTER="$ROOT_DIR/docs/v50/V50-LOCAL-ENTRYPOINT-DEPRECATION-REGISTER.md"
for entrypoint in \
  start-vethelp.sh \
  Makefile \
  dev/local/up.sh \
  dev/local/down.sh \
  dev/local/rich-demo-up.sh \
  backend/scripts/smoke-local-journey.sh \
  dev/local/rich-demo-cleanup.test.sh \
  dev/local/local-stack-e2e.mjs \
  dev/local/owner-mobile-web-e2e.mjs; do
  rg -F "\`$entrypoint\`" "$REGISTER" >/dev/null || fail "unclassified entrypoint: $entrypoint"
done
rg -F 'V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01' "$REGISTER" >/dev/null ||
  fail 'removal slice is not fixed'

printf '[entrypoint-test] PASS wrappers=3 blocked=4 lifecycleOwners=1 removalWindow=fixed\n'
