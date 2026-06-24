#!/usr/bin/env sh
set -eu

require() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 2
  fi
}

require VETHELP_BACKEND_IMAGE
require PUBLIC_HOST
require ACQUIRING_WEBHOOK_CIDR

case "$VETHELP_BACKEND_IMAGE" in
  *@sha256:[0-9a-f][0-9a-f][0-9a-f][0-9a-f]*) ;;
  *) echo 'VETHELP_BACKEND_IMAGE must be an immutable image digest (name@sha256:...)' >&2; exit 2 ;;
esac

out_dir="${1:-./rendered-alpha}"
mkdir -p "$out_dir"
for template in deployment network-policy ingress webhook-ingress; do
  sed \
    -e "s|__VETHELP_BACKEND_IMAGE__|$VETHELP_BACKEND_IMAGE|g" \
    -e "s|__PUBLIC_HOST__|$PUBLIC_HOST|g" \
    -e "s|__ACQUIRING_WEBHOOK_CIDR__|$ACQUIRING_WEBHOOK_CIDR|g" \
    "backend/k8s/alpha/${template}.template.yaml" > "$out_dir/${template}.yaml"
done

echo "Rendered immutable Alpha manifests to $out_dir"
