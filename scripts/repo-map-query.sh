#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
[[ $# -ge 1 ]] || { echo 'Usage: repo-map-query.sh "query" [--top 8]'; exit 2; }
DB="$ROOT/.codex/cache/repo-map.sqlite3"
if [[ ! -f "$DB" ]]; then
  "$ROOT/scripts/repo-map-index.sh" >/dev/null
fi
python3 "$ROOT/tools/repo_map/query.py" --db "$DB" "$@"
