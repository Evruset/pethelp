#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
printf '%s\n' 'DEPRECATED: dev/local/up.sh; use ./start-vethelp.sh up' >&2
exec "$ROOT_DIR/start-vethelp.sh" up "$@"
