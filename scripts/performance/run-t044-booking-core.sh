#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
DB_NAME="vethelp_t044_$(date +%s)_$$"
BRANCH=$(git -C "$ROOT" branch --show-current)
HEAD=$(git -C "$ROOT" rev-parse HEAD)
SNAPSHOT=$(git -C "$ROOT" diff --binary --no-ext-diff HEAD -- backend/src/booking-core backend/src/workers/hold-expiration.service.ts backend/test/booking-core-performance.integration-spec.ts | shasum -a 256 | awk '{print $1}')

cleanup() {
  docker compose -f "$ROOT/docker-compose.local.yml" exec -T postgres psql -U vethelp -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid<>pg_backend_pid()" >/dev/null 2>&1 || true
  docker compose -f "$ROOT/docker-compose.local.yml" exec -T postgres dropdb -U vethelp --if-exists "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker compose -f "$ROOT/docker-compose.local.yml" exec -T postgres createdb -U vethelp "$DB_NAME"
docker compose -f "$ROOT/docker-compose.local.yml" run --rm --no-deps \
  -e NODE_ENV=test -e MVP_SCOPE_PROFILE=PILOT_V1 \
  -e DATABASE_URL="postgres://vethelp:vethelp@postgres:5432/$DB_NAME" \
  -e T044_BRANCH="$BRANCH" -e T044_HEAD="$HEAD" -e T044_DIRTY_SNAPSHOT_SHA256="$SNAPSHOT" \
  -e T044_EVIDENCE_DIR=/workspace/docs/testing/evidence/s13-booking-core-performance \
  backend sh -lc 'npm run migrate:up >/dev/null && npm run build >/dev/null && npm test -- test/booking-core-performance.integration-spec.ts --runInBand'
