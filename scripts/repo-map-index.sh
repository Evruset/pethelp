#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python3 "$ROOT/tools/repo_map/index.py" --root "$ROOT" --db "$ROOT/.codex/cache/repo-map.sqlite3" "$@"
