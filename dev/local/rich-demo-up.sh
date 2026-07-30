#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CANONICAL="$ROOT_DIR/start-vethelp.sh"

case "${1:-}" in
  --stop)
    shift
    exec "$CANONICAL" stop "$@"
    ;;
  --verify)
    shift
    exec "$CANONICAL" verify rich-demo "$@"
    ;;
  --no-open|'')
    [[ "${1:-}" != --no-open ]] || shift
    exec "$CANONICAL" seed rich-demo "$@"
    ;;
  *)
    printf 'Usage: %s [--no-open|--verify|--stop]\n' "$0" >&2
    exit 2
    ;;
esac
