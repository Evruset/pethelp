#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python3 "$ROOT/tools/affected_tests.py" --root "$ROOT" "$@"
