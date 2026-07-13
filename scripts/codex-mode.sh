#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MODE_DIR="$ROOT/.codex/modes"; ACTIVE_CONFIG="$ROOT/.codex/config.toml"; ACTIVE_MARKER="$ROOT/.codex/ACTIVE_MODE"
mode="${1:-status}"
if [[ "$mode" == status ]]; then
 printf 'Active mode: '; [[ -f "$ACTIVE_MARKER" ]] && cat "$ACTIVE_MARKER" || echo unknown
 [[ -f "$ACTIVE_CONFIG" ]] && grep -E '^(model|model_reasoning_effort|sandbox_mode) =' "$ACTIVE_CONFIG" || true
 exit 0
fi
case "$mode" in orchestrator|fast|standard|deep|parallel|research|ui-debug|review);; *) echo 'Usage: codex-mode.sh <orchestrator|fast|standard|deep|parallel|research|ui-debug|review|status>'; exit 2;; esac
cp "$MODE_DIR/$mode.toml" "$ACTIVE_CONFIG"; printf '%s\n' "$mode" > "$ACTIVE_MARKER"
echo "Codex mode switched to: $mode"; echo 'Reload VS Code window or restart Codex extension, then verify model/reasoning.'
