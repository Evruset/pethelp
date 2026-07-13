#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
[[ $# -ge 1 ]] || { echo 'Usage: rag-query.sh "query" [--top 5]'; exit 2; }
python3 "$ROOT/tools/rag/query.py" --db "$ROOT/.codex/rag/index.sqlite3" "$@"
