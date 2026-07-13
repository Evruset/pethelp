#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="${LOCAL_PROJECT:-vethelp-alpha}"
COMPOSE=(docker compose -p "$PROJECT" -f "$ROOT_DIR/docker-compose.local.yml")
STATE_DIR="$ROOT_DIR/.dev-local"
LOG_DIR="$STATE_DIR/logs"
PID_DIR="$STATE_DIR/pids"
NODE20_BIN="${NODE20_BIN:-$HOME/.nvm/versions/node/v20.20.2/bin}"
PATH="$NODE20_BIN:$PATH"
BACKEND_URL="${VETHELP_API_BASE_URL:-http://127.0.0.1:3000}"
PORTAL_PORT="${CLINIC_PORTAL_PORT:-3001}"
PORTAL_URL="${CLINIC_PORTAL_BASE_URL:-http://localhost:$PORTAL_PORT}"
OWNER_PORT="${OWNER_WEB_PORT:-3002}"
OWNER_URL="http://localhost:$OWNER_PORT"
OPEN_BROWSER="${OPEN:-1}"
START_OWNER="${START_OWNER:-1}"

if [[ -x "$HOME/develop/flutter-3.27.4/bin/flutter" ]]; then
  FLUTTER_BIN="${FLUTTER_BIN:-$HOME/develop/flutter-3.27.4/bin/flutter}"
else
  FLUTTER_BIN="${FLUTTER_BIN:-flutter}"
fi

mkdir -p "$LOG_DIR" "$PID_DIR"

info() {
  printf '\033[1;34m[local]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[local]\033[0m %s\n' "$*"
}

die() {
  printf '\033[1;31m[local]\033[0m %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

wait_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    warn "Docker daemon is not running. Opening Docker Desktop..."
    open -a Docker >/dev/null 2>&1 || true
  else
    warn "Docker daemon is not running."
  fi

  for _ in $(seq 1 90); do
    if docker info >/dev/null 2>&1; then
      info "Docker daemon is ready"
      return 0
    fi
    sleep 2
  done

  die "Docker daemon is still unavailable. Start Docker Desktop manually and rerun: make local-dev"
}

wait_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-90}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      info "$label is ready: $url"
      return 0
    fi
    sleep 1
  done
  die "$label did not become ready: $url"
}

open_url() {
  local url="$1"
  if [[ "$OPEN_BROWSER" != "1" ]]; then
    return 0
  fi
  if [[ "$(uname -s)" == "Darwin" ]]; then
    open "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  fi
}

stop_pid() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      info "Stopping previous $name process ($pid)"
      kill "$pid" >/dev/null 2>&1 || true
      sleep 1
    fi
    rm -f "$pid_file"
  fi
}

start_background() {
  local name="$1"
  local cwd="$2"
  shift 2
  stop_pid "$name"
  info "Starting $name; logs: $LOG_DIR/$name.log"
  nohup bash -c 'cd "$1" && shift && exec "$@"' bash "$cwd" "$@" \
    >"$LOG_DIR/$name.log" 2>&1 < /dev/null &
  echo "$!" >"$PID_DIR/$name.pid"
}

write_portal_env() {
  local env_file="$ROOT_DIR/apps/clinic-portal/.env.local"
  if [[ -f "$env_file" ]]; then
    info "Keeping existing apps/clinic-portal/.env.local"
    return 0
  fi
  cat >"$env_file" <<EOF
VETHELP_API_BASE_URL=$BACKEND_URL
VETHELP_CLINIC_JWT_SECRET=local-development-jwt-signing-key-not-for-shared-use
VETHELP_ALLOW_DEV_SESSION=true
EOF
  info "Created apps/clinic-portal/.env.local"
}

owner_token() {
  "${COMPOSE[@]}" exec -T backend node /workspace/dev/local/create-owner-token.mjs
}

main() {
  require_cmd docker
  require_cmd curl
  require_cmd node
  require_cmd npm
  wait_docker

  info "Starting local Docker stack"
  "${COMPOSE[@]}" up -d --build
  wait_url "$BACKEND_URL/v1/health" "Backend"

  info "Applying local seed data"
  (cd "$ROOT_DIR" && make local-seed)

  write_portal_env
  if [[ ! -d "$ROOT_DIR/apps/clinic-portal/node_modules" ]]; then
    info "Installing clinic portal dependencies"
    (cd "$ROOT_DIR/apps/clinic-portal" && npm install)
  fi
  start_background "clinic-portal" "$ROOT_DIR/apps/clinic-portal" \
    env \
      "VETHELP_API_BASE_URL=$BACKEND_URL" \
      "VETHELP_CLINIC_JWT_SECRET=local-development-jwt-signing-key-not-for-shared-use" \
      "VETHELP_ALLOW_DEV_SESSION=true" \
      npm run dev -- --hostname localhost --port "$PORTAL_PORT"
  wait_url "$PORTAL_URL" "Clinic Portal"

  info "Creating local clinic portal session"
  if [[ "$OPEN_BROWSER" == "1" ]]; then
    CLINIC_PORTAL_BASE_URL="$PORTAL_URL" OPEN="$OPEN_BROWSER" \
      node "$ROOT_DIR/dev/local/clinic-portal-session.mjs" --open \
      | tee "$LOG_DIR/clinic-portal-session.json"
  else
    CLINIC_PORTAL_BASE_URL="$PORTAL_URL" OPEN="$OPEN_BROWSER" \
      node "$ROOT_DIR/dev/local/clinic-portal-session.mjs" \
      | tee "$LOG_DIR/clinic-portal-session.json"
  fi

  if [[ "$START_OWNER" == "1" ]]; then
    if ! command -v "$FLUTTER_BIN" >/dev/null 2>&1; then
      die "Flutter was not found. Set FLUTTER_BIN=/path/to/flutter or run START_OWNER=0 make local-dev."
    fi
    if [[ ! -d "$ROOT_DIR/apps/owner_mobile/.dart_tool" ]]; then
      info "Running flutter pub get"
      (cd "$ROOT_DIR/apps/owner_mobile" && "$FLUTTER_BIN" pub get)
    fi
    local token
    token="$(owner_token)"
    start_background "owner-mobile-web" "$ROOT_DIR/apps/owner_mobile" \
      "$FLUTTER_BIN" run -d chrome \
        --web-hostname 127.0.0.1 \
        --web-port "$OWNER_PORT" \
        --no-web-resources-cdn \
        -t lib/owner_journey_main.dart \
        --dart-define="VETHELP_API_BASE_URL=$BACKEND_URL" \
        --dart-define="VETHELP_OWNER_JWT=$token"
    wait_url "$OWNER_URL" "Owner mobile web" 120
    open_url "$OWNER_URL"
  else
    warn "Owner mobile web was skipped because START_OWNER=$START_OWNER"
  fi

  cat <<EOF

VetHelp local stack is ready.

Backend:       $BACKEND_URL/v1/health
Swagger:       $BACKEND_URL/docs
Clinic Portal: $PORTAL_URL
Owner Web:     $OWNER_URL
Logs:          $LOG_DIR

Stop all local processes:
  make local-dev-down

EOF
}

main "$@"
