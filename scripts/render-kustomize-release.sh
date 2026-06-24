#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE_DIGEST:?IMAGE_DIGEST must be registry/name@sha256:<digest>}"
: "${KUSTOMIZE_BIN:=kustomize}"

if [[ ! "$IMAGE_DIGEST" =~ ^[^[:space:]]+@sha256:[a-f0-9]{64}$ ]]; then
  echo "IMAGE_DIGEST must be registry/name@sha256:<64 lowercase hex chars>" >&2
  exit 2
fi

output_dir="${1:-artifacts/release}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

cp -R infrastructure/k8s/. "$work_dir/"
cd "$work_dir/overlays/alpha"
"$KUSTOMIZE_BIN" edit set image "ghcr.io/evruset/pethelp-backend=${IMAGE_DIGEST}"

mkdir -p "$OLDPWD/$output_dir"
"$KUSTOMIZE_BIN" build . > "$OLDPWD/$output_dir/vethelp-alpha.yaml"

"$OLDPWD/scripts/verify-manifests.sh" "$OLDPWD/$output_dir"
echo "Rendered immutable release manifest: $OLDPWD/$output_dir/vethelp-alpha.yaml"
