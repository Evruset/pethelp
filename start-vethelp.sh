#!/usr/bin/env bash
set -Eeuo pipefail

# VetHelp local launcher
#
# Usage:
#   ./start-vethelp.sh all      # infra + seed + Clinic Portal + Owner App
#   ./start-vethelp.sh infra    # Docker Compose stack only
#   ./start-vethelp.sh seed     # local demo data
#   ./start-vethelp.sh portal   # Clinic Portal on http://127.0.0.1:3001
#   ./start-vethelp.sh owner    # Flutter Owner App in Chrome
#   ./start-vethelp.sh status   # service status
#   ./start-vethelp.sh logs     # backend logs
#   ./start-vethelp.sh stop     # stop portal and compose services, keep volumes
#
# Optional environment variables:
#   VETHELP_REPO=/path/to/pethelp-alpha
#   VETHELP_PROJECT=vethelp-alpha
#   VETHELP_NODE_BIN_DIR=$HOME/.nvm/versions/node/v22.22.2/bin
#   VETHELP_CLINIC_ID=<uuid>
#   VETHELP_LOCATION_ID=<uuid>
#   VETHELP_NO_OPEN=1

REPO="${VETHELP_REPO:-/Users/evrusetskiy/work/pethelp-alpha}"
PROJECT="${VETHELP_PROJECT:-vethelp-alpha}"
NODE_BIN_DIR="${VETHELP_NODE_BIN_DIR:-$HOME/.nvm/versions/node/v22.22.2/bin}"

COMPOSE_FILE="$REPO/docker-compose.local.yml"
PORTAL_DIR="$REPO/apps/clinic-portal"
OWNER_DIR="$REPO/apps/owner_mobile"
BACKEND_DIR="$REPO/backend"

RUNTIME_DIR="$REPO/.runtime/vethelp-local"
PORTAL_PID_FILE="$RUNTIME_DIR/clinic-portal.pid"
PORTAL_LOG="$RUNTIME_DIR/clinic-portal.log"
SEED_LOG="$RUNTIME_DIR/seed.log"

BACKEND_URL="${VETHELP_BACKEND_URL:-http://127.0.0.1:3000}"
PORTAL_URL="${VETHELP_PORTAL_URL:-http://127.0.0.1:3001}"

mkdir -p "$RUNTIME_DIR"

if [[ -d "$NODE_BIN_DIR" ]]; then
  export PATH="$NODE_BIN_DIR:$PATH"
fi

log()  { printf '\033[1;34m[vethelp]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Command not found: $1"
}

assert_layout() {
  [[ -d "$REPO" ]] || die "Repository not found: $REPO"
  [[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
  [[ -d "$PORTAL_DIR" ]] || die "Clinic Portal not found: $PORTAL_DIR"
  [[ -d "$OWNER_DIR" ]] || die "Owner App not found: $OWNER_DIR"
}

compose() {
  docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-60}"
  local sleep_seconds="${3:-2}"

  for ((i = 1; i <= attempts; i++)); do
    if curl --silent --show-error --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
  done
  return 1
}

port_is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

open_url() {
  local url="$1"
  [[ "${VETHELP_NO_OPEN:-0}" == "1" ]] && return 0

  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  fi
}

ensure_portal_env() {
  local env_file="$PORTAL_DIR/.env.local"

  if [[ -f "$env_file" ]]; then
    ok "Clinic Portal env exists: $env_file"
    return 0
  fi

  cat >"$env_file" <<'EOF'
VETHELP_API_BASE_URL=http://127.0.0.1:3000
VETHELP_CLINIC_JWT_SECRET=local-development-jwt-signing-key-not-for-shared-use
VETHELP_ALLOW_DEV_SESSION=true
EOF

  ok "Created $env_file"
}

start_infra() {
  assert_layout
  require_cmd docker
  require_cmd curl

  docker info >/dev/null 2>&1 || die "Docker Desktop is not running"

  log "Starting local stack: project=$PROJECT"
  compose up -d --build

  log "Waiting for backend health..."
  if ! wait_for_http "$BACKEND_URL/v1/health" 90 2; then
    compose ps || true
    compose logs --tail=200 backend || true
    die "Backend did not become healthy at $BACKEND_URL/v1/health"
  fi

  ok "Backend is healthy: $BACKEND_URL/v1/health"
}

run_seed_step() {
  local title="$1"
  shift

  log "$title"
  "$@" 2>&1 | tee -a "$SEED_LOG"
}

seed_data() {
  assert_layout
  require_cmd docker
  : >"$SEED_LOG"

  compose ps backend 2>/dev/null | grep -q "Up" || start_infra

  run_seed_step "Applying base local seed..." \
    compose --profile setup run --rm seed

  run_seed_step "Creating local owner and pet identities..." \
    compose exec -T backend \
      npx ts-node /workspace/backend/scripts/seed-local-identities.ts

  run_seed_step "Creating local clinic employee..." \
    compose exec -T backend \
      npx ts-node /workspace/backend/scripts/seed-local-clinic-employee.ts

  run_seed_step "Creating Clinic Portal queue fixture..." \
    compose exec -T backend \
      npx ts-node /workspace/backend/scripts/seed-local-clinic-queue.ts

  log "Creating rolling Owner Marketplace slots..."
  if compose exec -T backend npm run seed:local:owner-marketplace 2>&1 | tee -a "$SEED_LOG"; then
    :
  elif [[ -f "$BACKEND_DIR/package.json" ]]; then
    warn "Container seed command failed; trying host backend command"
    (
      cd "$BACKEND_DIR"
      npm run seed:local:owner-marketplace
    ) 2>&1 | tee -a "$SEED_LOG"
  else
    die "Owner Marketplace seed failed"
  fi

  ok "Seed completed. Output saved to $SEED_LOG"
  warn "Use clinicId/locationId printed by seed, or export VETHELP_CLINIC_ID and VETHELP_LOCATION_ID."
}

start_portal() {
  assert_layout
  require_cmd npm
  require_cmd curl
  require_cmd lsof

  ensure_portal_env

  if port_is_listening 3001; then
    ok "Clinic Portal is already listening on $PORTAL_URL"
  else
    if [[ ! -d "$PORTAL_DIR/node_modules" ]]; then
      log "Installing Clinic Portal dependencies..."
      (
        cd "$PORTAL_DIR"
        npm install --no-audit --no-fund
      )
    fi

    log "Starting Clinic Portal on port 3001..."
    (
      cd "$PORTAL_DIR"
      nohup npm run dev -- --port 3001 >"$PORTAL_LOG" 2>&1 &
      echo $! >"$PORTAL_PID_FILE"
    )

    if ! wait_for_http "$PORTAL_URL" 60 1; then
      tail -n 200 "$PORTAL_LOG" || true
      die "Clinic Portal did not start. Log: $PORTAL_LOG"
    fi

    ok "Clinic Portal started: $PORTAL_URL"
    ok "Portal log: $PORTAL_LOG"
  fi

  local queue_url="$PORTAL_URL"
  if [[ -n "${VETHELP_CLINIC_ID:-}" && -n "${VETHELP_LOCATION_ID:-}" ]]; then
    queue_url="$PORTAL_URL/clinics/$VETHELP_CLINIC_ID/locations/$VETHELP_LOCATION_ID/queue"
  else
    warn "Exact queue URL requires VETHELP_CLINIC_ID and VETHELP_LOCATION_ID."
    warn "See seed output: $SEED_LOG"
  fi

  printf '\nClinic Portal: %s\n\n' "$queue_url"
  open_url "$queue_url"
}

start_owner() {
  assert_layout
  require_cmd flutter

  log "Preparing Flutter Owner App..."
  (
    cd "$OWNER_DIR"
    flutter pub get

    log "Launching Owner App in Chrome..."
    exec flutter run \
      -d chrome \
      -t lib/owner_journey_main.dart \
      --dart-define="VETHELP_API_BASE_URL=$BACKEND_URL"
  )
}

show_status() {
  assert_layout
  require_cmd docker

  printf '\n=== Docker Compose ===\n'
  compose ps || true

  printf '\n=== Endpoints ===\n'
  if curl --silent --show-error --max-time 2 "$BACKEND_URL/v1/health" >/dev/null 2>&1; then
    printf 'Backend:       UP   %s/v1/health\n' "$BACKEND_URL"
  else
    printf 'Backend:       DOWN %s/v1/health\n' "$BACKEND_URL"
  fi

  if port_is_listening 3001; then
    printf 'Clinic Portal: UP   %s\n' "$PORTAL_URL"
  else
    printf 'Clinic Portal: DOWN %s\n' "$PORTAL_URL"
  fi

  printf 'Mock MIS:      http://127.0.0.1:4101\n'
  printf 'Mock acquiring:http://127.0.0.1:4102\n'
  printf 'Mock cloud:    http://127.0.0.1:4103\n'
  printf 'LiveKit:       ws://127.0.0.1:7880\n\n'
}

show_logs() {
  assert_layout
  require_cmd docker
  compose logs -f --tail=200 backend
}

kill_tree() {
  local pid="$1"
  local child

  while read -r child; do
    [[ -n "$child" ]] && kill_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)

  kill "$pid" 2>/dev/null || true
}

stop_all() {
  assert_layout

  if [[ -f "$PORTAL_PID_FILE" ]]; then
    local portal_pid
    portal_pid="$(cat "$PORTAL_PID_FILE" 2>/dev/null || true)"

    if [[ -n "$portal_pid" ]] && kill -0 "$portal_pid" 2>/dev/null; then
      log "Stopping Clinic Portal process tree: PID $portal_pid"
      kill_tree "$portal_pid"
    fi

    rm -f "$PORTAL_PID_FILE"
  fi

  if port_is_listening 3001; then
    warn "Port 3001 is still in use. The process may have been started outside this script."
    lsof -nP -iTCP:3001 -sTCP:LISTEN || true
  fi

  log "Stopping Compose services without deleting volumes..."
  compose stop
  ok "Stopped. PostgreSQL volumes were preserved."
}

show_help() {
  cat <<EOF
VetHelp local launcher

Usage:
  $0 all       Start infra, seed data, start Clinic Portal, launch Owner App
  $0 infra     Start Docker Compose stack
  $0 seed      Create/update local demo data
  $0 portal    Start Clinic Portal on port 3001
  $0 owner     Launch Flutter Owner App in Chrome
  $0 status    Show service status
  $0 logs      Follow backend logs
  $0 stop      Stop portal and Compose services; keep volumes
  $0 help      Show this help

Recommended first launch:
  chmod +x $0
  $0 all

Optional exact queue URL:
  export VETHELP_CLINIC_ID=<clinic-id-from-seed>
  export VETHELP_LOCATION_ID=<location-id-from-seed>
  $0 portal
EOF
}

main() {
  local command="${1:-all}"

  case "$command" in
    all)
      start_infra
      seed_data
      start_portal
      show_status
      start_owner
      ;;
    infra)
      start_infra
      ;;
    seed)
      seed_data
      ;;
    portal)
      start_portal
      ;;
    owner)
      start_owner
      ;;
    status)
      show_status
      ;;
    logs)
      show_logs
      ;;
    stop)
      stop_all
      ;;
    help|-h|--help)
      show_help
      ;;
    *)
      show_help
      die "Unknown command: $command"
      ;;
  esac
}

main "$@"
