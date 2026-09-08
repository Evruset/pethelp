#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${VETHELP_PROJECT:-vethelp-alpha}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
PORTAL_DIR="$ROOT_DIR/apps/clinic-portal"
OWNER_DIR="$ROOT_DIR/apps/owner_mobile"
BACKEND_URL="${VETHELP_BACKEND_URL:-http://127.0.0.1:3000}"
MOCK_MIS_URL="${VETHELP_MOCK_MIS_URL:-http://127.0.0.1:4101}"
MOCK_ACQUIRING_URL="${VETHELP_MOCK_ACQUIRING_URL:-http://127.0.0.1:4102}"
MOCK_CLOUD_URL="${VETHELP_MOCK_CLOUD_URL:-http://127.0.0.1:4103}"
PORTAL_PORT=3001
PORTAL_URL="http://127.0.0.1:$PORTAL_PORT"
OWNER_URL="http://127.0.0.1:3002"
PROTOTYPE_URL="http://127.0.0.1:8090"
MODE="${VETHELP_MODE:-interactive-user}"
DRY_RUN="${VETHELP_DRY_RUN:-0}"
ALLOW_EXISTING_MUTATION=0
STATE_ROOT="$ROOT_DIR/.runtime/vethelp-local"

while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --mode)
      [[ $# -ge 2 ]] || { echo 'Missing --mode value.' >&2; exit 2; }
      MODE="$2"
      shift 2
      ;;
    --allow-mutation)
      ALLOW_EXISTING_MUTATION=1
      shift
      ;;
    *) echo "Invalid option: $1" >&2; exit 2 ;;
  esac
done
case "$MODE" in
  interactive-user|existing-runtime-validation|bounded-test) ;;
  *) echo "Invalid mode: $MODE" >&2; exit 2 ;;
esac
if [[ "$MODE" == bounded-test && -n "${VETHELP_TEST_STATE_ROOT:-}" ]]; then
  STATE_ROOT="$VETHELP_TEST_STATE_ROOT"
fi

LOG_DIR="$STATE_ROOT/logs"
PID_DIR="$STATE_ROOT/pids"
SEED_DIR="$STATE_ROOT/seeds"
RICH_DIR="$STATE_ROOT/rich-demo"
CODE_DIR="$RICH_DIR/bootstrap-codes"
PORTAL_PID_FILE="$PID_DIR/clinic-portal.pid"
PORTAL_ID_FILE="$PID_DIR/clinic-portal.identity"
PORTAL_LOG="$LOG_DIR/clinic-portal.log"
RICH_SEED_JSON="$RICH_DIR/demo-seed.json"
RICH_SESSIONS_JSON="$RICH_DIR/demo-sessions.json"
RICH_SESSIONS_HTML="$RICH_DIR/demo-sessions.html"
EXECUTED_SOURCES='|'
SOURCE_MANIFESTS=()
BOUNDED_PORTAL_STARTED=0

log(){ printf '\033[1;34m[vethelp]\033[0m %s\n' "$*"; }
ok(){ printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die(){ printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }

ensure_state() {
  mkdir -p "$LOG_DIR" "$PID_DIR" "$SEED_DIR" "$CODE_DIR"
  chmod 700 "$STATE_ROOT" "$LOG_DIR" "$PID_DIR" "$SEED_DIR" "$RICH_DIR" "$CODE_DIR"
  find -P "$STATE_ROOT" -type f -exec chmod 600 {} + 2>/dev/null || true
}

require_existing_mutation_permission() {
  if [[ "$MODE" == existing-runtime-validation && "$ALLOW_EXISTING_MUTATION" != 1 ]]; then
    die 'existing-runtime-validation mutation requires explicit --allow-mutation.'
  fi
}

on_exit() {
  if [[ "$BOUNDED_PORTAL_STARTED" == 1 ]]; then
    stop_managed_portal >/dev/null 2>&1 || true
  fi
}
trap on_exit EXIT

compose() {
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '[dry-run] docker compose -p %q -f %q' "$PROJECT" "$COMPOSE_FILE"
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"
}

wait_http() {
  local url="$1" attempts="${2:-60}"
  if [[ "$DRY_RUN" == 1 ]]; then return 0; fi
  for ((attempt=1; attempt<=attempts; attempt++)); do
    if curl --max-time 2 --fail --silent "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

node22() {
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

process_identity() {
  ps -p "$1" -o lstart= -o command= 2>/dev/null | sed 's/^[[:space:]]*//'
}

managed_portal_alive() {
  [[ -s "$PORTAL_PID_FILE" && -s "$PORTAL_ID_FILE" ]] || return 1
  local pid expected actual
  pid="$(cat "$PORTAL_PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" >/dev/null 2>&1 || return 1
  expected="$(cat "$PORTAL_ID_FILE")"
  actual="$(process_identity "$pid")"
  [[ -n "$actual" && "$actual" == "$expected" ]]
}

listener_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$PORTAL_PORT" -sTCP:LISTEN 2>/dev/null || true
  fi
}

stop_managed_portal() {
  if ! managed_portal_alive; then
    rm -f "$PORTAL_PID_FILE" "$PORTAL_ID_FILE"
    return 0
  fi
  local pid
  pid="$(cat "$PORTAL_PID_FILE")"
  kill -TERM "$pid"
  for _ in $(seq 1 10); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$PORTAL_PID_FILE" "$PORTAL_ID_FILE"
      return 0
    fi
    sleep 1
  done
  die "Managed Clinic Portal PID $pid did not stop after TERM; refusing SIGKILL."
}

cleanup_sensitive() {
  find -P "$CODE_DIR" -type f -delete 2>/dev/null || true
  rm -f "$RICH_SESSIONS_JSON" "$RICH_SESSIONS_HTML" \
    "$RICH_DIR/session-check-body.txt" "$RICH_DIR/session-check-headers.txt"
}

write_source_manifest() {
  local source="$1" dependencies="$2" output="$3"
  local manifest="$SEED_DIR/source-${source}.json"
  SOURCE_ID="$source" SOURCE_DEPENDENCIES="$dependencies" SOURCE_OUTPUT="$output" \
    SOURCE_MANIFEST="$manifest" node - <<'NODE'
const fs = require('node:fs');
let payload = {};
try {
  const text = fs.readFileSync(process.env.SOURCE_OUTPUT, 'utf8').trim();
  try {
    payload = JSON.parse(text);
  } catch {
    const start = Math.max(text.lastIndexOf('\n{'), text.startsWith('{') ? 0 : -1);
    if (start >= 0) payload = JSON.parse(text.slice(start === 0 ? 0 : start + 1));
  }
} catch {}
const ownedIds = [];
const counts = { executions: 1 };
function collect(value, key = '') {
  if (Array.isArray(value)) {
    if (key) counts[key] = value.length;
    for (const item of value) {
      if (/ids$/i.test(key) && typeof item === 'string') ownedIds.push(item);
      collect(item);
    }
  } else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      if (/id$/i.test(childKey) && typeof child === 'string') ownedIds.push(child);
      collect(child, childKey);
    }
  }
}
collect(payload);
const report = {
  source: process.env.SOURCE_ID,
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  dependencies: (process.env.SOURCE_DEPENDENCIES || '').split(',').filter(Boolean),
  counts,
  ownedIds: [...new Set(ownedIds)].sort(),
  artifacts: [process.env.SOURCE_OUTPUT].filter(Boolean),
};
fs.writeFileSync(process.env.SOURCE_MANIFEST, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
NODE
  chmod 600 "$manifest"
  SOURCE_MANIFESTS+=("$manifest")
}

source_done() {
  [[ "$EXECUTED_SOURCES" == *"|$1|"* ]]
}

run_source() {
  local source="$1" dependencies="$2"
  shift 2
  if source_done "$source"; then return 0; fi
  local output="$SEED_DIR/source-${source}.log"
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '[dry-run] source=%s command=' "$source"
    printf '%q ' "$@"
    printf '\n'
    printf 'dry-run\n' >"$output"
  elif ! "$@" >"$output" 2>&1; then
    tail -n 80 "$output" >&2 || true
    die "Seed source failed: $source"
  fi
  chmod 600 "$output"
  write_source_manifest "$source" "$dependencies" "$output"
  EXECUTED_SOURCES="${EXECUTED_SOURCES}${source}|"
}

run_base() {
  run_source LOCAL_BASE_SEED '' compose --profile setup run --rm seed
}

run_identities() {
  run_source LOCAL_IDENTITIES_V1 'LOCAL_BASE_SEED' compose exec -T backend \
    npx ts-node /workspace/backend/scripts/seed-local-identities.ts
}

run_owner_marketplace() {
  run_source LOCAL_DEV_OWNER_MARKETPLACE 'LOCAL_BASE_SEED,LOCAL_IDENTITIES_V1' compose exec -T backend \
    npx ts-node /workspace/backend/scripts/seed-local-owner-marketplace.ts
}

run_clinic_employee() {
  run_source LOCAL_CLINIC_EMPLOYEE_V1 'LOCAL_BASE_SEED' compose exec -T backend \
    npx ts-node /workspace/backend/scripts/seed-local-clinic-employee.ts
}

run_clinic_queue() {
  run_source LOCAL_DEV_QUEUE_FIXTURE 'LOCAL_BASE_SEED,LOCAL_IDENTITIES_V1' compose exec -T backend \
    npx ts-node /workspace/backend/scripts/seed-local-clinic-queue.ts
}

run_rich_demo() {
  local source=LOCAL_RICH_DEMO_V1
  if source_done "$source"; then return 0; fi
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '[dry-run] source=%s command=docker compose exec backend seed-local-rich-demo.cjs\n' "$source"
    printf '{"source":"LOCAL_RICH_DEMO_V1","schemaVersion":1,"counts":{}}\n' >"$RICH_SEED_JSON"
  elif ! compose exec -T -e DEMO_RESET=1 backend \
      node /workspace/backend/scripts/seed-local-rich-demo.cjs >"$RICH_SEED_JSON"; then
    rm -f "$RICH_SEED_JSON"
    die 'Rich-demo seed failed.'
  fi
  chmod 600 "$RICH_SEED_JSON"
  write_source_manifest "$source" 'LOCAL_BASE_SEED' "$RICH_SEED_JSON"
  EXECUTED_SOURCES="${EXECUTED_SOURCES}${source}|"
}

write_profile_report() {
  local profile="$1" dependencies="$2"
  local report="$SEED_DIR/profile-${profile}.json"
  local sources="${EXECUTED_SOURCES#|}"
  sources="${sources%|}"
  PROFILE="$profile" PROFILE_DEPENDENCIES="$dependencies" PROFILE_SOURCES="$sources" \
    PROFILE_REPORT="$report" node - <<'NODE'
const fs = require('node:fs');
const sources = (process.env.PROFILE_SOURCES || '').split('|').filter(Boolean);
const report = {
  profile: process.env.PROFILE,
  sources,
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  dependencies: (process.env.PROFILE_DEPENDENCIES || '').split(',').filter(Boolean),
  counts: { sourcesExecuted: sources.length },
  artifacts: sources.map((source) => `source-${source}.json`),
};
fs.writeFileSync(process.env.PROFILE_REPORT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(report)}\n`);
NODE
}

cmd_seed() {
  require_existing_mutation_permission
  ensure_state
  local profile="${1:-}"
  case "$profile" in
    base)
      run_base
      write_profile_report base ''
      ;;
    owner)
      run_base
      run_identities
      run_owner_marketplace
      write_profile_report owner base
      ;;
    clinic)
      run_base
      run_identities
      run_clinic_employee
      run_clinic_queue
      write_profile_report clinic base
      ;;
    rich-demo)
      run_base
      run_rich_demo
      write_profile_report rich-demo base
      ;;
    all)
      run_base
      run_identities
      run_owner_marketplace
      run_clinic_employee
      run_clinic_queue
      write_profile_report all base,owner,clinic
      ;;
    *) die "Invalid seed profile: ${profile:-<missing>}" ;;
  esac
}

cmd_up() {
  [[ "$MODE" != existing-runtime-validation ]] ||
    die 'existing-runtime-validation cannot start or recreate Compose services.'
  ensure_state
  need docker
  [[ "$DRY_RUN" == 1 ]] || docker info >/dev/null 2>&1 || die 'Docker is unavailable.'
  compose up -d --build
  wait_http "$BACKEND_URL/v1/health" 90 || die 'Backend did not become healthy.'
  ok "Runtime ready: project=$PROJECT backend=$BACKEND_URL"
}

start_portal_process() {
  [[ "$MODE" != existing-runtime-validation ]] ||
    die 'existing-runtime-validation cannot own a Portal process.'
  if managed_portal_alive && wait_http "$PORTAL_URL" 2; then
    ok "Clinic Portal already managed: $PORTAL_URL"
    return 0
  fi
  local listeners
  listeners="$(listener_pids | tr '\n' ' ')"
  if [[ -n "$listeners" ]]; then
    warn "Port $PORTAL_PORT is owned by unmanaged PID(s): $listeners"
    ps -p "${listeners%% *}" -o pid= -o command= 2>/dev/null || true
    die 'Refusing to stop or replace an unrelated listener.'
  fi
  [[ -d "$PORTAL_DIR/node_modules" ]] || die 'Clinic Portal dependencies are missing; install them explicitly.'
  local node
  node="$(node22)" || die 'Node 22 is required.'
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '[dry-run] start Clinic Portal port=%s state=%s\n' "$PORTAL_PORT" "$STATE_ROOT"
    return 0
  fi
  (
    cd "$PORTAL_DIR"
    nohup env \
      NEXT_TELEMETRY_DISABLED=1 \
      VETHELP_API_BASE_URL="$BACKEND_URL" \
      VETHELP_CLINIC_JWT_SECRET="${VETHELP_CLINIC_JWT_SECRET:-local-development-jwt-signing-key-not-for-shared-use}" \
      VETHELP_ALLOW_DEV_SESSION=true \
      VETHELP_DEV_SESSION_SEED_JSON="$RICH_SEED_JSON" \
      VETHELP_DEV_SESSION_CODE_DIR="$CODE_DIR" \
      PORTAL_V50_SHELL=true \
      PORTAL_V51_SHELL=true \
      VETHELP_NEXT_DIST_DIR=".next-vethelp-canonical" \
      "$node" node_modules/next/dist/bin/next dev -H 127.0.0.1 -p "$PORTAL_PORT" \
      >"$PORTAL_LOG" 2>&1 < /dev/null &
    echo "$!" >"$PORTAL_PID_FILE"
  )
  local pid identity
  pid="$(cat "$PORTAL_PID_FILE")"
  identity="$(process_identity "$pid")"
  [[ -n "$identity" ]] || die 'Cannot record Clinic Portal process identity.'
  printf '%s\n' "$identity" >"$PORTAL_ID_FILE"
  chmod 600 "$PORTAL_PID_FILE" "$PORTAL_ID_FILE" "$PORTAL_LOG"
  if [[ "$MODE" == bounded-test ]]; then BOUNDED_PORTAL_STARTED=1; fi
  wait_http "$PORTAL_URL" 60 || die "Clinic Portal failed readiness; see $PORTAL_LOG"
  ok "Clinic Portal ready: $PORTAL_URL"
}

cmd_portal() {
  ensure_state
  start_portal_process
  if [[ "$MODE" == bounded-test ]]; then
    stop_managed_portal
    BOUNDED_PORTAL_STARTED=0
    ok 'Bounded-test Portal stopped after readiness.'
  fi
}

cmd_owner() {
  [[ "$MODE" == interactive-user ]] || die 'Owner UI launch requires interactive-user mode.'
  need flutter
  (
    cd "$OWNER_DIR"
    exec flutter run -d chrome -t lib/owner_journey_main.dart \
      --web-port 3002 --dart-define="VETHELP_API_BASE_URL=$BACKEND_URL"
  )
}

cmd_status() {
  need docker
  if [[ "$DRY_RUN" == 1 ]]; then
    compose ps
    printf 'Backend: %s\nClinic Portal: %s\nOwner Web: %s\nPrototype: %s\n' \
      "$BACKEND_URL" "$PORTAL_URL" "$OWNER_URL" "$PROTOTYPE_URL"
    return 0
  fi
  python3 - <<'PY'
import subprocess
result = subprocess.run(
    ["docker", "info", "--format", "{{.ServerVersion}}"],
    timeout=10, text=True, capture_output=True,
)
print(f"Docker: {result.stdout.strip() if result.returncode == 0 else 'DOWN'}")
PY
  compose ps
  printf 'Backend: %s\nClinic Portal: %s\nOwner Web: %s\nPrototype: %s\n' \
    "$BACKEND_URL" "$PORTAL_URL" "$OWNER_URL" "$PROTOTYPE_URL"
  if managed_portal_alive; then printf 'Portal PID: managed\n'; else printf 'Portal PID: not-managed\n'; fi
}

cmd_logs() {
  compose logs --tail=200 backend
}

cmd_smoke() {
  local node managed=0 listeners
  node="$(node22)" || die 'Node 22 is required.'
  if managed_portal_alive; then managed=1; fi
  listeners="$(listener_pids | paste -sd, -)"
  SMOKE_PROJECT="$PROJECT" \
  SMOKE_COMPOSE_FILE="$COMPOSE_FILE" \
  SMOKE_STATE_ROOT="$STATE_ROOT" \
  SMOKE_BACKEND_URL="$BACKEND_URL" \
  SMOKE_MIS_URL="$MOCK_MIS_URL" \
  SMOKE_ACQUIRING_URL="$MOCK_ACQUIRING_URL" \
  SMOKE_CLOUD_URL="$MOCK_CLOUD_URL" \
  SMOKE_PORTAL_MANAGED="$managed" \
  SMOKE_PORTAL_LISTENERS="$listeners" \
  "$node" - <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const project = process.env.SMOKE_PROJECT;
const composeFile = process.env.SMOKE_COMPOSE_FILE;
const stateRoot = process.env.SMOKE_STATE_ROOT;
const violations = [];
const services = {};
const endpoints = {};
const restartCounts = {};
const runtimeState = {
  root: '.runtime/vethelp-local',
  exists: fs.existsSync(stateRoot),
  directoryModeViolations: 0,
  fileModeViolations: 0,
  symlinkViolations: 0,
  sensitiveMatches: 0,
  bootstrapCodeFiles: 0,
};

function run(command, args, timeout = 10000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    env: process.env,
  });
  if (result.error?.code === 'ETIMEDOUT') {
    violations.push(`${command}:timeout`);
    return '';
  }
  if (result.status !== 0) {
    violations.push(`${command}:exit-${result.status ?? 'error'}`);
    return '';
  }
  return result.stdout.trim();
}

function parseComposeRows(text) {
  if (!text) return [];
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [value];
  } catch {
    try {
      return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      violations.push('compose:malformed-json');
      return [];
    }
  }
}

function walk(root) {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      runtimeState.symlinkViolations += 1;
      continue;
    }
    const mode = stat.mode & 0o777;
    if (stat.isDirectory()) {
      if (mode !== 0o700) runtimeState.directoryModeViolations += 1;
      walk(target);
      continue;
    }
    if (!stat.isFile()) continue;
    if (mode !== 0o600) runtimeState.fileModeViolations += 1;
    if (target.startsWith(path.join(stateRoot, 'rich-demo', 'bootstrap-codes'))) {
      runtimeState.bootstrapCodeFiles += 1;
    }
    const content = fs.readFileSync(target, 'utf8');
    const sensitive = [
      /\bBearer\s+[A-Za-z0-9._~-]+/i,
      /\b(?:access|refresh)[_-]?token\b/i,
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
      /sessionUrl[^"\n]*[?&](?:token|code)=/i,
      /\b(?:cookie|bootstrapCode)\b\s*[:=]\s*["'][^"']+/i,
    ];
    runtimeState.sensitiveMatches += sensitive.filter((pattern) => pattern.test(content)).length;
  }
}

async function endpoint(name, url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { violations.push(`${name}:malformed-json`); }
    const marker = json?.status ?? json?.service ?? json?.data?.status;
    endpoints[name] = { url, status: response.status, json: Boolean(json), marker: marker ?? null };
    if (response.status !== 200) violations.push(`${name}:http-${response.status}`);
    if (!json || marker == null) violations.push(`${name}:missing-service-marker`);
  } catch (error) {
    endpoints[name] = { url, status: null, json: false, marker: null };
    violations.push(`${name}:${error?.name === 'TimeoutError' ? 'timeout' : 'unreachable'}`);
  }
}

async function main() {
  if (project !== 'vethelp-alpha') violations.push(`project:unexpected-${project}`);
  const dockerVersion = run('docker', ['info', '--format', '{{.ServerVersion}}']);
  const rows = parseComposeRows(run('docker', [
    'compose', '-p', 'vethelp-alpha', '-f', composeFile, 'ps', '--format', 'json',
  ]));
  const required = ['postgres', 'backend', 'mock-mis', 'mock-acquiring', 'mock-cloud', 'livekit'];
  for (const name of required) {
    const row = rows.find((candidate) => candidate.Service === name);
    if (!row) {
      violations.push(`${name}:missing`);
      services[name] = { running: false, healthy: false };
      continue;
    }
    const running = String(row.State).toLowerCase() === 'running';
    const health = String(row.Health ?? '').toLowerCase();
    const healthy = name === 'livekit' ? running : health === 'healthy';
    services[name] = { running, healthy };
    if (!running) violations.push(`${name}:not-running`);
    if (!healthy) violations.push(`${name}:not-healthy`);
    const restart = Number(run('docker', ['inspect', row.ID, '--format', '{{.RestartCount}}']));
    restartCounts[name] = Number.isFinite(restart) ? restart : null;
    if (!Number.isFinite(restart)) violations.push(`${name}:restart-count-unavailable`);
    if (restart > 0) violations.push(`${name}:restart-count-${restart}`);
    if (name === 'livekit') {
      const publishers = Array.isArray(row.Publishers) ? row.Publishers : [];
      const canonicalPort = publishers.some((publisher) =>
        Number(publisher.TargetPort) === 7880 && Number(publisher.PublishedPort) === 7880);
      services[name].canonicalPort = canonicalPort;
      if (!canonicalPort) violations.push('livekit:wrong-port');
    }
  }

  await Promise.all([
    endpoint('backend', `${process.env.SMOKE_BACKEND_URL}/v1/health`),
    endpoint('mockMis', `${process.env.SMOKE_MIS_URL}/health`),
    endpoint('mockAcquiring', `${process.env.SMOKE_ACQUIRING_URL}/health`),
    endpoint('mockCloud', `${process.env.SMOKE_CLOUD_URL}/health`),
  ]);

  if (!runtimeState.exists) {
    violations.push('runtime-state:missing');
  } else {
    const rootStat = fs.lstatSync(stateRoot);
    if (rootStat.isSymbolicLink()) runtimeState.symlinkViolations += 1;
    if (!rootStat.isDirectory() || (rootStat.mode & 0o777) !== 0o700) {
      runtimeState.directoryModeViolations += 1;
    }
    if (rootStat.isDirectory() && !rootStat.isSymbolicLink()) walk(stateRoot);
  }
  for (const key of ['directoryModeViolations', 'fileModeViolations', 'symlinkViolations', 'sensitiveMatches', 'bootstrapCodeFiles']) {
    if (runtimeState[key] > 0) violations.push(`runtime-state:${key}-${runtimeState[key]}`);
  }

  const managed = process.env.SMOKE_PORTAL_MANAGED === '1';
  const listeners = (process.env.SMOKE_PORTAL_LISTENERS || '').split(',').filter(Boolean);
  runtimeState.portal = { managed, listenerCount: listeners.length };
  if (listeners.length > 1) violations.push(`portal:multiple-listeners-${listeners.length}`);
  if (listeners.length === 1 && !managed) violations.push('portal:unmanaged-canonical-listener');

  const report = {
    command: 'smoke',
    mode: 'read-only',
    project: 'vethelp-alpha',
    status: violations.length ? 'FAIL' : 'PASS',
    docker: { serverVersion: dockerVersion || null },
    services,
    endpoints,
    restartCounts,
    runtimeState,
    violations,
  };
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = violations.length ? 1 : 0;
}

main();
NODE
}

cmd_verify_rich_demo() {
  require_existing_mutation_permission
  ensure_state
  [[ -s "$RICH_SEED_JSON" ]] || die 'Run seed rich-demo first.'
  local bounded_portal=0
  if ! wait_http "$PORTAL_URL" 2; then
    if [[ "$MODE" == bounded-test ]]; then
      start_portal_process
      bounded_portal=1
    else
      die 'Canonical Clinic Portal must already be running on 3001.'
    fi
  fi
  local node backend_container
  node="$(node22)" || die 'Node 22 is required.'
  DEMO_SEED_JSON="$RICH_SEED_JSON" \
  DEMO_SESSIONS_JSON="$RICH_SESSIONS_JSON" \
  DEMO_SESSIONS_HTML="$RICH_SESSIONS_HTML" \
  DEMO_PORTAL_URL="$PORTAL_URL" \
    "$node" "$ROOT_DIR/dev/local/create-rich-demo-sessions.cjs"
  chmod 600 "$RICH_SESSIONS_JSON" "$RICH_SESSIONS_HTML"
  backend_container="$(compose ps -q backend)"
  [[ -n "$backend_container" ]] || die 'Backend container is unavailable.'
  if [[ "$DRY_RUN" != 1 ]]; then
    docker cp "$RICH_SEED_JSON" "$backend_container:/tmp/demo-seed.json"
  fi
  compose exec -T -e DEMO_SEED_JSON=/tmp/demo-seed.json backend \
    node /workspace/backend/scripts/verify-rich-demo-memberships.cjs
  DEMO_SESSIONS_JSON="$RICH_SESSIONS_JSON" \
    "$node" "$ROOT_DIR/dev/local/verify-rich-demo-sessions.cjs"
  DEMO_SESSIONS_JSON="$RICH_SESSIONS_JSON" \
    "$node" "$ROOT_DIR/dev/local/verify-rich-demo-security.cjs" --quick
  if [[ "$bounded_portal" == 1 ]]; then
    stop_managed_portal
    BOUNDED_PORTAL_STARTED=0
  fi
  ok 'Rich-demo focused verification passed.'
}

cmd_stop() {
  [[ "$MODE" != existing-runtime-validation ]] ||
    die 'existing-runtime-validation cannot stop runtime services.'
  ensure_state
  stop_managed_portal
  cleanup_sensitive
  compose stop
  ok 'Managed Portal and Compose services stopped; volumes preserved.'
}

help() {
  cat <<'EOF'
Usage: ./start-vethelp.sh [--mode interactive-user|existing-runtime-validation|bounded-test] [--allow-mutation] COMMAND

Commands:
  up | status | logs | portal | owner | smoke | stop | help
  seed base|owner|clinic|rich-demo|all
  verify rich-demo

Compatibility aliases:
  infra -> up
  all -> up, then seed all
  bare seed -> seed all
  portal, owner, status, logs and stop use the canonical command path.

existing-runtime-validation is read-only unless --allow-mutation is supplied
for an explicit seed or verify command. It never permits up, portal or stop.
EOF
}

command="${1:-help}"
shift || true
case "$command" in
  infra)
    warn 'DEPRECATED alias: infra; use up.'
    command=up
    ;;
  all)
    [[ $# == 0 ]] || die 'Legacy all alias accepts no arguments.'
    warn 'DEPRECATED alias: all; use up followed by seed all.'
    cmd_up
    cmd_seed all
    exit 0
    ;;
esac

case "$command" in
  up) [[ $# == 0 ]] || die 'up accepts no arguments.'; cmd_up ;;
  status) [[ $# == 0 ]] || die 'status accepts no arguments.'; cmd_status ;;
  logs) [[ $# == 0 ]] || die 'logs accepts no arguments.'; cmd_logs ;;
  portal) [[ $# == 0 ]] || die 'portal accepts no arguments.'; cmd_portal ;;
  owner) [[ $# == 0 ]] || die 'owner accepts no arguments.'; cmd_owner ;;
  smoke) [[ $# == 0 ]] || die 'smoke accepts no arguments.'; cmd_smoke ;;
  stop) [[ $# == 0 ]] || die 'stop accepts no arguments.'; cmd_stop ;;
  seed)
    if [[ $# == 0 ]]; then warn 'DEPRECATED alias: bare seed; use seed all.'; fi
    cmd_seed "${1:-all}"
    [[ $# -le 1 ]] || die 'seed accepts one profile.'
    ;;
  verify)
    [[ "${1:-}" == rich-demo && $# == 1 ]] || die 'verify supports only rich-demo.'
    cmd_verify_rich_demo
    ;;
  help|-h|--help) help ;;
  *) die "Invalid command: $command" ;;
esac
