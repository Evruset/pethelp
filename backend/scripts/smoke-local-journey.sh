#!/usr/bin/env bash
set -Eeuo pipefail

printf '%s\n' \
  'LEGACY_ENTRYPOINT_DEPRECATED' \
  'Mutating journey smoke is not part of the canonical read-only operating loop.' \
  'Replacement: ./start-vethelp.sh smoke' >&2
exit 64
