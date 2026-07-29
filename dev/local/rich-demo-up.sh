#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="${ROOT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[[ -n "$ROOT_DIR" ]] || { echo 'Run from inside the pethelp repository.' >&2; exit 1; }

PROJECT="${LOCAL_PROJECT:-vethelp-alpha}"
REQUESTED_PORT="${CLINIC_PORTAL_PORT:-3002}"
BACKEND_URL="${VETHELP_API_BASE_URL:-http://127.0.0.1:3000}"
OPEN_BROWSER="${OPEN:-1}"
RESET="${RESET_DEMO:-0}"
ACTION=up
INTERNAL_CLEANUP_MODE=
INTERNAL_CLEANUP_DIR=

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset) RESET=1 ;;
    --no-open) OPEN_BROWSER=0 ;;
    --stop) ACTION=stop ;;
    --internal-cleanup-mode)
      [[ $# -ge 2 ]] || { echo 'Missing internal cleanup mode.' >&2; exit 2; }
      INTERNAL_CLEANUP_MODE="$2"
      shift
      ;;
    --internal-cleanup-dir)
      [[ $# -ge 2 ]] || { echo 'Missing internal cleanup directory.' >&2; exit 2; }
      INTERNAL_CLEANUP_DIR="$2"
      shift
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

REAL_STATE="$ROOT_DIR/.dev-local/rich-demo"
STATE="${INTERNAL_CLEANUP_DIR:-$REAL_STATE}"
CODE_DIR="$STATE/bootstrap-codes"
LOGS="$STATE/logs"
PIDS="$STATE/pids"
OVERRIDE="$STATE/docker-compose.rich-demo.yml"
SEED_JSON="$STATE/demo-seed.json"
SESSIONS_JSON="$STATE/demo-sessions.json"
SESSIONS_HTML="$STATE/demo-sessions.html"
PID_FILE="$PIDS/clinic-portal.pid"
PORT_FILE="$STATE/clinic-portal.port"
PORTAL_LOG="$LOGS/clinic-portal.log"
APP_DIR="$ROOT_DIR/apps/clinic-portal"
NEXT_LOCK="$APP_DIR/.next/dev/lock"
PORTAL_STARTED=0

info(){ printf '\033[1;34m[vethelp-demo]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[vethelp-demo]\033[0m %s\n' "$*"; }
die(){ printf '\033[1;31m[vethelp-demo]\033[0m %s\n' "$*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }

validate_cleanup_target() {
  [[ -n "$INTERNAL_CLEANUP_DIR" && "$INTERNAL_CLEANUP_DIR" == /* ]] ||
    die 'Internal cleanup requires an absolute managed directory.'
  [[ "$INTERNAL_CLEANUP_MODE" =~ ^(startup|shutdown|failure)$ ]] ||
    die 'Invalid internal cleanup mode.'
  [[ "$INTERNAL_CLEANUP_DIR" != "/" &&
     "$INTERNAL_CLEANUP_DIR" != "$HOME" &&
     "$INTERNAL_CLEANUP_DIR" != "$ROOT_DIR" ]] ||
    die 'Unsafe internal cleanup target.'
  [[ ! -L "$INTERNAL_CLEANUP_DIR" ]] || die 'Managed cleanup target must not be a symlink.'

  local resolved parent
  resolved="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$INTERNAL_CLEANUP_DIR")"
  if [[ "$resolved" != "$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$REAL_STATE")" ]]; then
    parent="$(basename "$(dirname "$resolved")")"
    [[ "$(basename "$resolved")" == managed && "$parent" == vethelp-rich-demo-cleanup.* ]] ||
      die 'Focused cleanup target is outside the bounded test namespace.'
  fi
}

normalize_managed_state() {
  mkdir -p "$STATE" "$LOGS" "$PIDS" "$CODE_DIR"
  chmod 700 "$STATE" "$LOGS" "$PIDS" "$CODE_DIR"
  find -P "$STATE" -type f -exec chmod 600 {} +
}

cleanup_sensitive_artifacts() {
  find -P "$CODE_DIR" -type f -delete 2>/dev/null || true
  rm -f \
    "$SESSIONS_JSON" \
    "$SESSIONS_HTML" \
    "$STATE/session-check-body.txt" \
    "$STATE/session-check-headers.txt"
}

if [[ -n "$INTERNAL_CLEANUP_MODE" || -n "$INTERNAL_CLEANUP_DIR" ]]; then
  validate_cleanup_target
  normalize_managed_state
  cleanup_sensitive_artifacts
  if [[ "$INTERNAL_CLEANUP_MODE" == failure ]]; then
    warn 'Focused controlled failure requested.'
    exit 70
  fi
  exit 0
fi

normalize_managed_state
cleanup_sensitive_artifacts

docker_ready() {
  python3 - <<'PY'
import subprocess
try:
    result = subprocess.run(
        ["docker", "info"],
        timeout=10,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
except subprocess.TimeoutExpired:
    raise SystemExit(124)
raise SystemExit(result.returncode)
PY
}

on_error() {
  local code=$?
  cleanup_sensitive_artifacts
  warn "Launcher stopped with exit code $code."
  if [[ "$PORTAL_STARTED" == 1 && -f "$PORTAL_LOG" ]]; then
    printf '\n--- Current Clinic Portal log (last 160 lines) ---\n' >&2
    tail -n 160 "$PORTAL_LOG" >&2 || true
    printf '%s\n' '--- end log ---' >&2
  fi
  exit "$code"
}
on_exit() {
  local code=$?
  if [[ "$code" != 0 ]]; then
    cleanup_sensitive_artifacts
  fi
}
trap on_error ERR
trap on_exit EXIT

cat >"$OVERRIDE" <<'YAML'
services:
  backend:
    environment:
      VETHELP_CLINIC_PATIENTS_REGISTRY: "true"
      VETHELP_CLINIC_APPOINTMENTS_REGISTRY: "true"
      FEATURE_EMERGENCY_OPS: "true"
YAML

COMPOSE=(
  docker compose
  -p "$PROJECT"
  -f "$ROOT_DIR/docker-compose.local.yml"
  -f "$OVERRIDE"
)

resolve_node22() {
  local candidate
  for candidate in \
    "${NODE22_BIN:-}" \
    "$HOME/.nvm/versions/node/v22.22.2/bin/node" \
    "$HOME/.nvm/versions/node/v22/bin/node" \
    "$(command -v node 2>/dev/null || true)"; do
    [[ -n "$candidate" && -x "$candidate" ]] || continue
    if "$candidate" -e 'process.exit(Number(process.versions.node.split(".")[0]) === 22 ? 0 : 1)' >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

port_listener_pids() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  fi
}

kill_pids() {
  local pids=("$@") pid
  ((${#pids[@]})) || return 0

  for pid in "${pids[@]}"; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    [[ "$pid" != "$$" ]] || continue
    kill -TERM "$pid" >/dev/null 2>&1 || true
  done

  for _ in $(seq 1 30); do
    local alive=0
    for pid in "${pids[@]}"; do
      [[ "$pid" =~ ^[0-9]+$ ]] || continue
      if kill -0 "$pid" >/dev/null 2>&1; then alive=1; fi
    done
    [[ "$alive" == 0 ]] && return 0
    sleep 0.2
  done

  for pid in "${pids[@]}"; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    [[ "$pid" != "$$" ]] || continue
    kill -KILL "$pid" >/dev/null 2>&1 || true
  done
  sleep 0.5
}

stop_portal() {
  local found=() pid command port

  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    [[ "$pid" =~ ^[0-9]+$ ]] && found+=("$pid")
    rm -f "$PID_FILE"
  fi

  # This is the reliable source of truth for Next's project-wide dev lock.
  if [[ -f "$NEXT_LOCK" ]] && command -v lsof >/dev/null 2>&1; then
    while read -r pid; do
      [[ "$pid" =~ ^[0-9]+$ ]] && found+=("$pid")
    done < <(lsof -t "$NEXT_LOCK" 2>/dev/null || true)
  fi

  # Catch old listeners and their npm/Next process groups.
  for port in $(seq 3001 3025); do
    while read -r pid; do
      [[ "$pid" =~ ^[0-9]+$ ]] || continue
      command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if [[ "$command" == *next* || "$command" == *clinic-portal* || "$command" == *pethelp-alpha* ]]; then
        found+=("$pid")
        local pgid
        pgid="$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ' || true)"
        if [[ "$pgid" =~ ^[0-9]+$ && "$pgid" != "$(ps -p $$ -o pgid= | tr -d ' ')" ]]; then
          kill -TERM -- "-$pgid" >/dev/null 2>&1 || true
        fi
      fi
    done < <(port_listener_pids "$port")
  done

  if ((${#found[@]})); then
    info "Stopping previous Clinic Portal process(es): ${found[*]}"
    kill_pids "${found[@]}"
  fi

  # Last fallback: processes with files open under this app's .next directory.
  if [[ -d "$APP_DIR/.next" ]] && command -v lsof >/dev/null 2>&1; then
    local next_pids=()
    while read -r pid; do
      [[ "$pid" =~ ^[0-9]+$ ]] && next_pids+=("$pid")
    done < <(lsof -t +D "$APP_DIR/.next" 2>/dev/null | sort -u || true)
    if ((${#next_pids[@]})); then
      info "Stopping Next.js process(es) holding .next: ${next_pids[*]}"
      kill_pids "${next_pids[@]}"
    fi
  fi

  rm -f "$NEXT_LOCK" 2>/dev/null || true

  if [[ -f "$NEXT_LOCK" ]] && command -v lsof >/dev/null 2>&1; then
    local lock_pid
    lock_pid="$(lsof -t "$NEXT_LOCK" 2>/dev/null | head -n 1 || true)"
    [[ -z "$lock_pid" ]] || die "Next.js lock is still held by PID $lock_pid"
  fi
}

choose_port() {
  local start="$1" port
  for port in $(seq "$start" $((start + 20))); do
    if [[ -z "$(port_listener_pids "$port" | head -n 1)" ]]; then
      printf '%s\n' "$port"
      return 0
    fi
  done
  return 1
}

wait_docker() {
  docker_ready && return 0
  if [[ "$(uname -s)" == Darwin ]]; then
    warn 'Docker Desktop is not running. Opening it...'
    open -a Docker >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 90); do
    docker_ready && return 0
    sleep 2
  done
  die 'Docker daemon is unavailable.'
}

wait_backend() {
  for _ in $(seq 1 180); do
    if curl -fsS "$BACKEND_URL/v1/health" >/dev/null 2>&1; then
      info "Backend ready: $BACKEND_URL/v1/health"
      return 0
    fi
    sleep 1
  done
  "${COMPOSE[@]}" ps -a >&2 || true
  "${COMPOSE[@]}" logs --tail=160 backend >&2 || true
  die "Backend did not become ready: $BACKEND_URL/v1/health"
}

portal_http_ready() {
  local url="$1" code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null || true)"
  [[ "$code" =~ ^[234][0-9][0-9]$ ]]
}

wait_portal() {
  local pid="$1" url="$2"
  for _ in $(seq 1 180); do
    if portal_http_ready "$url"; then
      info "Clinic Portal ready: $url"
      return 0
    fi
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      warn 'Clinic Portal process exited before readiness.'
      tail -n 160 "$PORTAL_LOG" >&2 || true
      return 1
    fi
    sleep 1
  done
  tail -n 160 "$PORTAL_LOG" >&2 || true
  return 1
}

if [[ "$ACTION" == stop ]]; then
  stop_portal
  cleanup_sensitive_artifacts
  if docker_ready; then
    "${COMPOSE[@]}" down || true
  fi
  info 'Rich demo stopped.'
  exit 0
fi

for cmd in git docker curl node npm lsof ps python3; do need "$cmd"; done
[[ -f "$ROOT_DIR/docker-compose.local.yml" ]] || die 'docker-compose.local.yml not found.'
[[ -f "$ROOT_DIR/backend/scripts/seed-local-rich-demo.cjs" ]] || die 'backend/scripts/seed-local-rich-demo.cjs not found.'
[[ -f "$ROOT_DIR/dev/local/create-rich-demo-sessions.cjs" ]] || die 'dev/local/create-rich-demo-sessions.cjs not found.'
[[ -f "$ROOT_DIR/dev/local/verify-rich-demo-security.cjs" ]] || die 'dev/local/verify-rich-demo-security.cjs not found.'
[[ -d "$APP_DIR" ]] || die 'apps/clinic-portal not found.'

NODE22="$(resolve_node22)" || die 'Node 22 was not found. Install Node 22 or set NODE22_BIN=/path/to/node.'
stop_portal
PORT="$(choose_port "$REQUESTED_PORT")" || die "No free Clinic Portal port starting from $REQUESTED_PORT."
PORTAL_URL="http://127.0.0.1:$PORT"
printf '%s\n' "$PORT" >"$PORT_FILE"
info "Clinic Portal will use $($NODE22 --version) on $PORTAL_URL"

wait_docker
info 'Starting PostgreSQL, mocks and backend so migrations/dependencies are ready'
"${COMPOSE[@]}" up -d --build postgres mock-mis mock-cloud backend
wait_backend

# Do not run four ts-node seeds while Nest watch mode is active: on Docker
# Desktop this caused exit 137. Rich seed is self-contained and idempotent.
info 'Stopping backend briefly before the rich seed to keep memory bounded'
"${COMPOSE[@]}" stop backend >/dev/null

info 'Applying one bounded rich idempotent demo seed'
"${COMPOSE[@]}" run --rm --no-deps \
  -e "DEMO_RESET=$RESET" \
  backend \
  node /workspace/backend/scripts/seed-local-rich-demo.cjs >"$SEED_JSON"

"$NODE22" -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$SEED_JSON"

info 'Starting backend after seed'
"${COMPOSE[@]}" up -d backend
wait_backend

info 'Generating fresh role sessions'
DEMO_SEED_JSON="$SEED_JSON" \
DEMO_SESSIONS_JSON="$SESSIONS_JSON" \
DEMO_SESSIONS_HTML="$SESSIONS_HTML" \
DEMO_PORTAL_URL="$PORTAL_URL" \
"$NODE22" "$ROOT_DIR/dev/local/create-rich-demo-sessions.cjs"
chmod 600 "$SEED_JSON" "$SESSIONS_JSON" "$SESSIONS_HTML"

if [[ ! -d "$APP_DIR/node_modules" ]]; then
  info 'Installing Clinic Portal dependencies'
  (cd "$APP_DIR" && "$NODE22" "$(command -v npm)" install)
fi

stop_portal
PORT="$(choose_port "$REQUESTED_PORT")" || die "No free Clinic Portal port starting from $REQUESTED_PORT."
PORTAL_URL="http://127.0.0.1:$PORT"
printf '%s\n' "$PORT" >"$PORT_FILE"

DEMO_SEED_JSON="$SEED_JSON" \
DEMO_SESSIONS_JSON="$SESSIONS_JSON" \
DEMO_SESSIONS_HTML="$SESSIONS_HTML" \
DEMO_PORTAL_URL="$PORTAL_URL" \
"$NODE22" "$ROOT_DIR/dev/local/create-rich-demo-sessions.cjs"

info "Starting Clinic Portal: $PORTAL_URL"
: >"$PORTAL_LOG"
PORTAL_STARTED=1
(
  cd "$APP_DIR"
  nohup env \
    NEXT_TELEMETRY_DISABLED=1 \
    VETHELP_API_BASE_URL="$BACKEND_URL" \
    VETHELP_CLINIC_JWT_SECRET='local-development-jwt-signing-key-not-for-shared-use' \
    VETHELP_ALLOW_DEV_SESSION=true \
    VETHELP_DEV_SESSION_SEED_JSON="$SEED_JSON" \
    VETHELP_DEV_SESSION_CODE_DIR="$CODE_DIR" \
    PORTAL_V50_SHELL=true \
    PORTAL_V51_SHELL=true \
    VETHELP_CLINIC_APPOINTMENTS_REGISTRY=true \
    VETHELP_CLINIC_PATIENTS_REGISTRY=true \
    "$NODE22" node_modules/next/dist/bin/next dev \
      -H 127.0.0.1 \
      -p "$PORT" \
      >"$PORTAL_LOG" 2>&1 < /dev/null &
  echo $! >"$PID_FILE"
)
PORTAL_PID="$(cat "$PID_FILE")"
wait_portal "$PORTAL_PID" "$PORTAL_URL" || die 'Clinic Portal failed to start.'

info 'Verifying exact demo membership matrix'
docker cp "$SEED_JSON" "$("${COMPOSE[@]}" ps -q backend):/tmp/demo-seed.json"
"${COMPOSE[@]}" exec -T -e DEMO_SEED_JSON=/tmp/demo-seed.json backend \
  node /workspace/backend/scripts/verify-rich-demo-memberships.cjs

info 'Verifying effective authority and BFF JSON contracts'
DEMO_SESSIONS_JSON="$SESSIONS_JSON" "$NODE22" "$ROOT_DIR/dev/local/verify-rich-demo-sessions.cjs"

info 'Verifying one-time exchange, origin and return-path security'
DEMO_SESSIONS_JSON="$SESSIONS_JSON" "$NODE22" "$ROOT_DIR/dev/local/verify-rich-demo-security.cjs"

if rg -n --glob 'demo-*' --glob '*.headers' 'eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+' "$STATE"; then
  die 'Bearer-shaped material was found in local demo artifacts.'
fi

if [[ "$OPEN_BROWSER" == 1 ]]; then
  if [[ "$(uname -s)" == Darwin ]]; then
    open "$SESSIONS_HTML" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$SESSIONS_HTML" >/dev/null 2>&1 || true
  fi
fi

cat <<TXT

VetHelp rich demo is ready.

Backend:       $BACKEND_URL/v1/health
Swagger:       $BACKEND_URL/docs
Clinic Portal: $PORTAL_URL
Role sessions: $SESSIONS_HTML
Seed report:   $SEED_JSON
Session JSON:  $SESSIONS_JSON
Portal log:    $PORTAL_LOG

Open role selector:
  open "$SESSIONS_HTML"

Important:
  1. Open Role sessions.
  2. Click “Войти под профилем”.
  3. Then use Queue / Schedule / Appointments / Patients links.

Stop:
  ./"VetHelp Demo Portal.command" --stop

TXT
