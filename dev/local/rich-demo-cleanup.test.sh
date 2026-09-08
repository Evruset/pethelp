#!/usr/bin/env bash
set -Eeuo pipefail

printf '%s\n' \
  'LEGACY_ENTRYPOINT_DEPRECATED' \
  'The legacy rich-demo cleanup seam is no longer an active lifecycle API.' \
  'Replacement: dev/local/start-vethelp.stop.test.sh' >&2
exit 64
