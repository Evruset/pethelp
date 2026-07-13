#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
OPEN=1 ./dev/local/up.sh

echo
echo "VetHelp local stack finished startup. You can close this window after checking the URLs above."
read -r -p "Press Enter to close..."
