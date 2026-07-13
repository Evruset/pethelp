#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
QUERY="${*:-}"
[[ -n "$QUERY" ]] || { echo 'Usage: codex-scout.sh "symbol, route, error, or business term"'; exit 2; }
cd "$ROOT"
FILTER='^(\.agents/|\.codex/|docs/ai/|\.vscode/tasks\.json$|AGENTS\.md$|\.gitignore$|scripts/(codex-mode|rag-index|rag-query|repo-map-index|repo-map-query|affected-tests|codex-scout|context-budget)\.sh$|tools/(rag/|repo_map/|affected_tests\.py$))'
echo '## Git status (agent-stack files filtered)'
git status --short | sed -E 's/^.. //' | grep -Ev "$FILTER" | head -n 60 || true
echo
echo '## Changed paths (agent-stack files filtered)'
{ git diff --name-only; git diff --cached --name-only; } | awk 'NF && !seen[$0]++' | grep -Ev "$FILTER" | head -n 60 || true
echo
echo '## Repository map'
./scripts/repo-map-query.sh "$QUERY" --top 8 --max-chars 3500 || true
echo
echo '## Targeted ripgrep'
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!.next/**' --glob '!dist/**' --glob '!build/**' --glob '!coverage/**' --glob '!.agents/**' --glob '!.codex/**' --glob '!docs/ai/**' --glob '!tools/rag/**' --glob '!tools/repo_map/**' --glob '!*.lock' --glob '!*.min.*' --max-count 5 "$QUERY" . 2>/dev/null | head -n 80 || true
