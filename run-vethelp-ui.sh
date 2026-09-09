#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$HOME/work/pethelp-alpha"
OWNER_DIR="$ROOT/apps/owner-app"

RUNTIME="$ROOT/.dev-local/full-ui"
OWNER_PID="$RUNTIME/owner-web.pid"
OWNER_IDENTITY="$RUNTIME/owner-web.identity"
OWNER_LOG="$RUNTIME/owner-web.log"

BACKEND="http://127.0.0.1:3000"
BACKEND_HEALTH="$BACKEND/v1/health"
PORTAL="http://127.0.0.1:3001"
OWNER="http://127.0.0.1:8081"

mkdir -p "$RUNTIME"

blue()  { printf '\033[1;36m[vethelp]\033[0m %s\n' "$*"; }
green() { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
yellow(){ printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
red()   { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

process_identity() {
  ps -p "$1" -o lstart= -o command= 2>/dev/null | sed 's/^[[:space:]]*//'
}

wait_http() {
  local url="$1"
  local count="${2:-90}"

  for ((i=1; i<=count; i++)); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

stop_owner() {
  if [[ -f "$OWNER_PID" ]]; then
    pid="$(cat "$OWNER_PID" 2>/dev/null || true)"
    owner_cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 || true)"
    expected_identity="$(cat "$OWNER_IDENTITY" 2>/dev/null || true)"
    actual_identity="$(process_identity "$pid" || true)"

    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && [[ "$owner_cwd" == "$OWNER_DIR" ]] && [[ -n "$expected_identity" ]] && [[ "$actual_identity" == "$expected_identity" ]]; then
      blue "Останавливаю Owner App..."
      kill "$pid" 2>/dev/null || true

      for _ in {1..10}; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 1
      done

      [[ "$(process_identity "$pid" || true)" == "$expected_identity" ]] && kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    elif [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      yellow "PID $pid больше не принадлежит Owner App — не останавливаю его"
    fi

    rm -f "$OWNER_PID" "$OWNER_IDENTITY"
  fi
}

stop_all() {
  cd "$ROOT"

  stop_owner

  if [[ -x ./start-vethelp.sh ]]; then
    blue "Останавливаю VetHelp runtime..."
    ./start-vethelp.sh stop || true
  else
    blue "Останавливаю Docker Compose без удаления данных..."
    docker compose \
      -p vethelp-alpha \
      -f docker-compose.local.yml \
      stop || true
  fi

  green "Остановлено. PostgreSQL volume сохранён."
}

if [[ "${1:-}" == "stop" || "${1:-}" == "--stop" ]]; then
  stop_all
  exit 0
fi

echo
echo "============================================================"
echo " VetHelp — ALL-IN-ONE LOCAL UI"
echo "============================================================"
echo

[[ -d "$ROOT" ]] || red "Нет репозитория: $ROOT"
[[ -d "$OWNER_DIR" ]] || red "Нет Owner App: $OWNER_DIR"

command -v docker >/dev/null 2>&1 || red "Docker не установлен"
command -v curl   >/dev/null 2>&1 || red "curl не найден"
command -v node   >/dev/null 2>&1 || red "Node.js не найден"
command -v npm    >/dev/null 2>&1 || red "npm не найден"
command -v npx    >/dev/null 2>&1 || red "npx не найден"
command -v lsof   >/dev/null 2>&1 || red "lsof не найден"
command -v ps     >/dev/null 2>&1 || red "ps не найден"

# Если установлен nvm — автоматически переключаемся на Node 22.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

if [[ "$NODE_MAJOR" != "22" && -f "$HOME/.nvm/nvm.sh" ]]; then
  blue "Переключаю Node на 22..."
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
fi

[[ "$NODE_MAJOR" == "22" ]] || \
  red "Нужен Node 22. Сейчас: $(node --version)"

blue "Проверяю Docker Desktop..."
docker info >/dev/null 2>&1 || \
  red "Docker Desktop не запущен"

cd "$ROOT"

echo
blue "Git:"
echo "  branch: $(git branch --show-current)"
echo "  HEAD:   $(git rev-parse --short HEAD)"
echo

# КРИТИЧНО: текущий Owner MVP должен работать в PILOT_V1.
export MVP_SCOPE_PROFILE=PILOT_V1

# ============================================================
# 1. BACKEND + POSTGRES + LOCAL SERVICES
# ============================================================

blue "[1/6] Поднимаю PostgreSQL + Backend + local services..."

if [[ -x ./start-vethelp.sh ]]; then
  ./start-vethelp.sh up
else
  MVP_SCOPE_PROFILE=PILOT_V1 \
  docker compose \
    -p vethelp-alpha \
    -f docker-compose.local.yml \
    up -d --build
fi

blue "Жду Backend PILOT_V1..."

for _ in {1..90}; do
  HEALTH="$(curl -fsS "$BACKEND_HEALTH" 2>/dev/null || true)"

  if [[ -n "$HEALTH" ]]; then
    if echo "$HEALTH" | grep -q '"profile":"PILOT_V1"'; then
      break
    fi

  fi

  sleep 1
done

wait_http "$BACKEND_HEALTH" 30 || {
  docker compose \
    -p vethelp-alpha \
    -f docker-compose.local.yml \
    logs --tail=150 backend || true

  red "Backend не поднялся"
}

HEALTH="$(curl -fsS "$BACKEND_HEALTH")"

echo
echo "Backend health:"
echo "$HEALTH"
echo

echo "$HEALTH" | grep -q '"profile":"PILOT_V1"' || \
  red "Backend не подтвердил точный профиль PILOT_V1."

green "Backend готов"

# ============================================================
# 2. SEED
# ============================================================

blue "[2/6] Загружаю demo/rich-demo данные..."

if [[ -x ./start-vethelp.sh ]]; then
  if ./start-vethelp.sh seed rich-demo; then
    green "Rich demo seed готов"
  else
    yellow "rich-demo seed недоступен; пробую обычный seed"
    if ./start-vethelp.sh seed; then
      green "Обычный demo seed готов"
    else
      yellow "Demo seed конфликтует с сохранёнными данными; использую существующий локальный набор без удаления volume"
    fi
  fi
else
  docker compose \
    -p vethelp-alpha \
    -f docker-compose.local.yml \
    --profile setup run --rm seed

  docker compose \
    -p vethelp-alpha \
    -f docker-compose.local.yml \
    exec -T backend \
    npx ts-node /workspace/backend/scripts/seed-local-identities.ts

  if [[ -f backend/scripts/seed-local-clinic-employee.ts ]]; then
    docker compose \
      -p vethelp-alpha \
      -f docker-compose.local.yml \
      exec -T backend \
      npx ts-node /workspace/backend/scripts/seed-local-clinic-employee.ts
  fi
fi

green "Demo data готовы"

# ============================================================
# 3. CLINIC PORTAL
# ============================================================

blue "[3/6] Запускаю Clinic Portal..."

if wait_http "$PORTAL" 1; then
  PORTAL_PID="$(lsof -tiTCP:3001 -sTCP:LISTEN 2>/dev/null | head -1 || true)"
  PORTAL_CWD="$(lsof -a -p "$PORTAL_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  PORTAL_COMMAND="$(process_identity "$PORTAL_PID")"
  [[ "$PORTAL_CWD" == "$ROOT/apps/clinic-portal" && "$PORTAL_COMMAND" == *next-server* ]] || \
    red "Порт 3001 отвечает, но listener не подтверждён как VetHelp Clinic Portal"
  yellow "Clinic Portal уже отвечает на $PORTAL — identity подтверждена"
elif [[ -x ./start-vethelp.sh ]]; then
  ./start-vethelp.sh portal
else
  red "Canonical Portal launcher start-vethelp.sh отсутствует"
fi

wait_http "$PORTAL" 90 || \
  red "Clinic Portal не ответил на $PORTAL"

green "Clinic Portal готов"

# ============================================================
# 4. VERIFY RICH DEMO
# ============================================================

blue "[4/6] Проверяю local demo..."

if [[ -x ./start-vethelp.sh ]]; then
  ./start-vethelp.sh verify rich-demo || \
    yellow "Rich-demo verifier вернул ошибку; UI всё равно оставляю запущенным"
fi

# ============================================================
# 5. OWNER REACT NATIVE / WEB
# ============================================================

blue "[5/6] Собираю и запускаю Owner React Native в браузере..."

cd "$OWNER_DIR"

# The Owner Web browser talks only to its same-origin BFF. Keep the local BFF
# configuration explicit and pinned to the single canonical loopback origin.
export VETHELP_API_BASE_URL="$BACKEND"
export OWNER_WEB_ORIGIN="$OWNER"
export OWNER_WEB_BFF_IP_SIGNING_SECRET="${OWNER_WEB_BFF_IP_SIGNING_SECRET:-local-owner-web-ip-signing-secret-32-bytes}"

if [[ ! -d node_modules ]]; then
  blue "Устанавливаю Owner App dependencies..."
  npm ci
fi

stop_owner

# Убиваем только старый Expo на нашем порту, если PID потерялся.
if command -v lsof >/dev/null 2>&1; then
  EXISTING_PID="$(
    lsof -tiTCP:8081 -sTCP:LISTEN 2>/dev/null | head -1 || true
  )"

  if [[ -n "$EXISTING_PID" ]]; then
    EXISTING_CWD="$(lsof -a -p "$EXISTING_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
    [[ "$EXISTING_CWD" == "$OWNER_DIR" ]] || \
      red "Порт 8081 занят посторонним PID $EXISTING_PID ($EXISTING_CWD)"
    EXISTING_COMMAND="$(process_identity "$EXISTING_PID")"
    [[ "$EXISTING_COMMAND" == *expo* || "$EXISTING_COMMAND" == *metro* ]] || \
      red "Порт 8081 занят процессом из Owner App, но это не Expo/Metro"
    yellow "Owner App уже запущен из $OWNER_DIR — использую существующий процесс"
  else
    nohup npx expo start \
      --web \
      --port 8081 \
      >"$OWNER_LOG" 2>&1 < /dev/null &

    echo "$!" > "$OWNER_PID"
    sleep 1
    process_identity "$!" > "$OWNER_IDENTITY"
  fi
else
  nohup npx expo start \
    --web \
    --port 8081 \
    >"$OWNER_LOG" 2>&1 < /dev/null &

  echo "$!" > "$OWNER_PID"
  sleep 1
  process_identity "$!" > "$OWNER_IDENTITY"
fi

blue "Жду Owner App..."

if ! wait_http "$OWNER" 90; then
  echo
  echo "===== OWNER APP LOG ====="
  tail -n 120 "$OWNER_LOG" || true
  echo "========================="
  red "Owner App не поднялся"
fi

green "Owner App готов"

# ============================================================
# 6. OPEN
# ============================================================

blue "[6/6] Открываю интерфейсы..."

cd "$ROOT"

SESSION_HTML=""

for candidate in \
  "$ROOT/.runtime/vethelp-local/rich-demo/demo-sessions.html" \
  "$ROOT/.dev-local/rich-demo/demo-sessions.html"
do
  if [[ -f "$candidate" ]]; then
    SESSION_HTML="$candidate"
    break
  fi
done

if command -v open >/dev/null 2>&1; then
  open "$OWNER" >/dev/null 2>&1 || true
  open "$PORTAL" >/dev/null 2>&1 || true

  if [[ -n "$SESSION_HTML" ]]; then
    open "$SESSION_HTML" >/dev/null 2>&1 || true
  fi
fi

echo
echo "============================================================"
echo " VETHELP ГОТОВ"
echo "============================================================"
echo
echo " OWNER APP"
echo "   $OWNER"
echo
echo " CLINIC PORTAL"
echo "   $PORTAL"
echo
echo " BACKEND"
echo "   $BACKEND"
echo
echo " SWAGGER"
echo "   $BACKEND/docs"
echo

if [[ -n "$SESSION_HTML" ]]; then
  echo " CLINIC DEMO PROFILES"
  echo "   $SESSION_HTML"
  echo
fi

echo " STATUS"
echo "   cd ~/work/pethelp-alpha && ./start-vethelp.sh status"
echo
echo " BACKEND LOGS"
echo "   cd ~/work/pethelp-alpha && ./start-vethelp.sh logs"
echo
echo " OWNER LOGS"
echo "   tail -f $OWNER_LOG"
echo
echo " STOP ALL"
echo "   cd ~/work/pethelp-alpha && ./run-vethelp-ui.sh stop"
echo
echo "============================================================"
echo
