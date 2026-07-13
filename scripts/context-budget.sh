#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TIER="${1:-standard}"
python3 - "$ROOT/.codex/policies/context-budgets.toml" "$TIER" <<'PYCODE'
from pathlib import Path
import sys, tomllib
path = Path(sys.argv[1])
tier = sys.argv[2]
data = tomllib.loads(path.read_text())
if tier not in data:
    raise SystemExit(f"Unknown tier: {tier}. Use small|standard|complex")
print(f"Context budget: {tier}")
for key, value in data[tier].items():
    print(f"{key} = {value}")
PYCODE
