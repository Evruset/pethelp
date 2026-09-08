#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(git rev-parse --show-toplevel)"
FIXTURE="$(mktemp -d "${TMPDIR:-/tmp}/vethelp-stop.XXXXXX")"
STATE="$FIXTURE/state"
FAKE_BIN="$FIXTURE/bin"
DOCKER_LOG="$FIXTURE/docker.log"
mkdir -p "$STATE/pids" "$STATE/rich-demo/bootstrap-codes" "$FAKE_BIN"

managed_pid=
unrelated_pid=
cleanup(){
  [[ -z "$managed_pid" ]] || kill -TERM "$managed_pid" 2>/dev/null || true
  [[ -z "$unrelated_pid" ]] || kill -TERM "$unrelated_pid" 2>/dev/null || true
  rm -rf "$FIXTURE"
}
trap cleanup EXIT
fail(){ printf '[stop-test] FAIL %s\n' "$*" >&2; exit 1; }

cat >"$FAKE_BIN/docker" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$VETHELP_FAKE_DOCKER_LOG"
exit 0
SH
chmod +x "$FAKE_BIN/docker"

sleep 300 &
managed_pid=$!
sleep 300 &
unrelated_pid=$!
printf '%s\n' "$managed_pid" >"$STATE/pids/clinic-portal.pid"
ps -p "$managed_pid" -o lstart= -o command= | sed 's/^[[:space:]]*//' \
  >"$STATE/pids/clinic-portal.identity"
printf 'ephemeral\n' >"$STATE/rich-demo/bootstrap-codes/code"
printf 'ephemeral\n' >"$STATE/rich-demo/demo-sessions.json"
printf 'persistent\n' >"$STATE/rich-demo/demo-seed.json"

PATH="$FAKE_BIN:$PATH" \
VETHELP_FAKE_DOCKER_LOG="$DOCKER_LOG" \
VETHELP_TEST_STATE_ROOT="$STATE" \
  "$ROOT_DIR/start-vethelp.sh" --mode bounded-test stop >/dev/null

if kill -0 "$managed_pid" 2>/dev/null; then fail 'managed process survived TERM'; fi
kill -0 "$unrelated_pid" 2>/dev/null || fail 'unrelated process was terminated'
[[ ! -e "$STATE/rich-demo/bootstrap-codes/code" ]] || fail 'bootstrap code survived'
[[ ! -e "$STATE/rich-demo/demo-sessions.json" ]] || fail 'session artifact survived'
[[ -s "$STATE/rich-demo/demo-seed.json" ]] || fail 'persistent seed was removed'

PATH="$FAKE_BIN:$PATH" \
VETHELP_FAKE_DOCKER_LOG="$DOCKER_LOG" \
VETHELP_TEST_STATE_ROOT="$STATE" \
  "$ROOT_DIR/start-vethelp.sh" --mode bounded-test stop >/dev/null

[[ "$(wc -l <"$DOCKER_LOG" | tr -d ' ')" == 2 ]] || fail 'unexpected Compose invocation count'
while IFS= read -r line; do
  [[ "$line" == "compose -p vethelp-alpha -f $ROOT_DIR/docker-compose.local.yml stop" ]] ||
    fail "unexpected Compose command: $line"
done <"$DOCKER_LOG"
if rg -n 'down| -v|volume|kill|pkill' "$DOCKER_LOG" >/dev/null; then
  fail 'forbidden stop operation recorded'
fi

printf '[stop-test] PASS managedTerm=1 unrelatedPreserved=1 composeStop=2 idempotent=1 forbidden=0\n'
