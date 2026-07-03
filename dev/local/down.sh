#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="${LOCAL_PROJECT:-vethelp-alpha}"
COMPOSE=(docker compose -p "$PROJECT" -f "$ROOT_DIR/docker-compose.local.yml")
PID_DIR="$ROOT_DIR/.dev-local/pids"

info() {
  printf '\033[1;34m[local]\033[0m %s\n' "$*"
}

stop_pid_file() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 0
  local pid
  pid="$(cat "$pid_file")"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    info "Stopping $(basename "$pid_file" .pid) ($pid)"
    kill "$pid" >/dev/null 2>&1 || true
  fi
  rm -f "$pid_file"
}

if [[ -d "$PID_DIR" ]]; then
  for pid_file in "$PID_DIR"/*.pid; do
    [[ -e "$pid_file" ]] || continue
    stop_pid_file "$pid_file"
  done
fi

info "Stopping Docker stack"
"${COMPOSE[@]}" down

info "Stopped. Persistent PostgreSQL data is kept. Use 'docker compose -p $PROJECT -f docker-compose.local.yml down -v' to reset data."
