#!/usr/bin/env sh
set -eu

root="${1:-infrastructure/k8s}"

if [ ! -d "$root" ]; then
  echo "Manifest root does not exist: $root" >&2
  exit 2
fi

failed=0
files=$(find "$root" -type f \( -name '*.yaml' -o -name '*.yml' \) -print | sort)

if [ -z "$files" ]; then
  echo "No Kubernetes manifests found under $root" >&2
  exit 2
fi

for file in $files; do
  while IFS= read -r match; do
    [ -z "$match" ] && continue
    line_number=${match%%:*}
    value=${match#*:}
    value=$(printf '%s' "$value" | sed -E 's/^[[:space:]]*image:[[:space:]]*//; s/[[:space:]]+#.*$//; s/^"//; s/"$//')

    if ! printf '%s' "$value" | grep -Eq '^[^[:space:]]+@sha256:[a-f0-9]{64}$'; then
      echo "Immutable-image policy violation: ${file}:${line_number}: ${value}" >&2
      echo "Every Kubernetes image must be pinned exactly as registry/name@sha256:<64 hex chars>." >&2
      failed=1
    fi
  done <<EOF
$(grep -nE '^[[:space:]]*image:[[:space:]]*[^[:space:]]+' "$file" || true)
EOF
done

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "Immutable-image policy passed for $root"
