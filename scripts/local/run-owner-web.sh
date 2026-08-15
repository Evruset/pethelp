#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="$ROOT/docker-compose.local.yml"
OWNER_APP="$ROOT/apps/owner-app"

echo
echo "========================================"
echo " VetHelp — Owner App Local Launcher"
echo "========================================"
echo

cd "$ROOT"

export MVP_SCOPE_PROFILE="${MVP_SCOPE_PROFILE:-PILOT_V1}"

echo "MVP scope profile: $MVP_SCOPE_PROFILE"
echo

echo "[1/5] Starting backend dependencies..."

docker compose -f "$COMPOSE" up -d backend

echo
echo "[2/5] Waiting for backend health..."

MAX_ATTEMPTS=60
ATTEMPT=1

until curl -fsS http://127.0.0.1:3000/v1/health >/dev/null 2>&1; do
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo
    echo "ERROR: backend did not become healthy."
    echo
    docker compose -f "$COMPOSE" ps
    echo
    docker compose -f "$COMPOSE" logs backend --tail=100
    exit 1
  fi

  printf "."
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

echo
echo "Backend: HEALTHY"

echo
echo "[3/5] Checking local OTP configuration..."

OTP_ENV="$(
  docker compose -f "$COMPOSE" exec -T backend \
    sh -lc 'printf "%s|%s" "${NODE_ENV:-}" "${AUTH_DEV_OTP_CODE:-}"'
)"

NODE_ENV_VALUE="${OTP_ENV%%|*}"
OTP_CODE="${OTP_ENV#*|}"

echo "NODE_ENV=$NODE_ENV_VALUE"

if [ "$NODE_ENV_VALUE" = "development" ] && [ -n "$OTP_CODE" ]; then
  echo "Development OTP: $OTP_CODE"
else
  echo "WARNING: deterministic development OTP is not configured."
  echo "Current value: AUTH_DEV_OTP_CODE=${OTP_CODE:-<empty>}"
fi

echo
echo "[4/5] Finding free Expo web port..."

PORT=8082

while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))

  if [ "$PORT" -gt 8090 ]; then
    echo "ERROR: no free port found in 8082-8090."
    exit 1
  fi
done

echo "Expo port: $PORT"

echo
echo "[5/5] Starting Owner App..."
echo
echo "----------------------------------------"
echo "Backend:"
echo "  http://127.0.0.1:3000"
echo
echo "Owner App:"
echo "  http://localhost:$PORT"

if [ -n "$OTP_CODE" ]; then
  echo
  echo "Local OTP:"
  echo "  $OTP_CODE"
fi

echo
echo "Press Ctrl+C to stop Expo."
echo "Docker backend will remain running."
echo "----------------------------------------"
echo

cd "$OWNER_APP"

export EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:3000"

exec npx expo start --web --port "$PORT"
