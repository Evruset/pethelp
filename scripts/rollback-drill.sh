#!/usr/bin/env bash
set -euo pipefail

: "${ROLLBACK_DRILL_EXECUTE:?Set ROLLBACK_DRILL_EXECUTE=true to run this Alpha-only drill}"
: "${KUBE_NAMESPACE:=vethelp-alpha}"
: "${DEPLOYMENT_NAME:=vethelp-backend}"
: "${CONTAINER_NAME:=vethelp-backend}"
: "${STABLE_IMAGE_DIGEST:?STABLE_IMAGE_DIGEST must be registry/name@sha256:<digest>}"
: "${DEFECTIVE_IMAGE_DIGEST:?DEFECTIVE_IMAGE_DIGEST must be registry/name@sha256:<digest>}"
: "${KUBECTL:=kubectl}"
: "${DRILL_REPORT_PATH:=artifacts/alpha-drills/ROLLBACK_DRILL_REPORT.md}"

if [[ "$ROLLBACK_DRILL_EXECUTE" != "true" ]]; then
  echo "Refusing rollback drill: set ROLLBACK_DRILL_EXECUTE=true" >&2
  exit 2
fi
if [[ ! "$KUBE_NAMESPACE" =~ (^|[-_])alpha($|[-_]) ]]; then
  echo "Refusing rollback drill outside an Alpha namespace: $KUBE_NAMESPACE" >&2
  exit 2
fi
for image in "$STABLE_IMAGE_DIGEST" "$DEFECTIVE_IMAGE_DIGEST"; do
  if [[ ! "$image" =~ ^[^[:space:]]+@sha256:[a-f0-9]{64}$ ]]; then
    echo "Every drill image must be immutable registry/name@sha256:<64 lowercase hex>: $image" >&2
    exit 2
  fi
done
if [[ "$STABLE_IMAGE_DIGEST" == "$DEFECTIVE_IMAGE_DIGEST" ]]; then
  echo "Defective and stable image digests must differ" >&2
  exit 2
fi

mkdir -p "$(dirname "$DRILL_REPORT_PATH")"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
rolled_back=false

do_rollback() {
  if [[ "$rolled_back" == true ]]; then return; fi
  echo "Rolling back ${DEPLOYMENT_NAME}/${CONTAINER_NAME} to known stable digest"
  "$KUBECTL" -n "$KUBE_NAMESPACE" set image "deployment/${DEPLOYMENT_NAME}" "${CONTAINER_NAME}=${STABLE_IMAGE_DIGEST}"
  "$KUBECTL" -n "$KUBE_NAMESPACE" rollout status "deployment/${DEPLOYMENT_NAME}" --timeout=60s
  rolled_back=true
}

trap 'exit_code=$?; if [[ "$rolled_back" != true ]]; then do_rollback || true; fi; exit "$exit_code"' EXIT

current_image="$($KUBECTL -n "$KUBE_NAMESPACE" get deployment "$DEPLOYMENT_NAME" -o jsonpath="{.spec.template.spec.containers[?(@.name=='${CONTAINER_NAME}')].image}")"
if [[ "$current_image" != "$STABLE_IMAGE_DIGEST" ]]; then
  echo "Deployment image does not match supplied stable digest." >&2
  echo "Current: $current_image" >&2
  echo "Stable : $STABLE_IMAGE_DIGEST" >&2
  exit 2
fi

echo "Deploying intentionally defective digest for readiness/rollback exercise"
"$KUBECTL" -n "$KUBE_NAMESPACE" annotate deployment "$DEPLOYMENT_NAME" \
  vethelp.io/rollback-drill-started-at="$started_at" vethelp.io/rollback-drill-defective-digest="$DEFECTIVE_IMAGE_DIGEST" --overwrite
"$KUBECTL" -n "$KUBE_NAMESPACE" set image "deployment/${DEPLOYMENT_NAME}" "${CONTAINER_NAME}=${DEFECTIVE_IMAGE_DIGEST}"

set +e
"$KUBECTL" -n "$KUBE_NAMESPACE" rollout status "deployment/${DEPLOYMENT_NAME}" --timeout=60s
fault_rollout_exit=$?
set -e

if [[ "$fault_rollout_exit" -eq 0 ]]; then
  echo "Defective image unexpectedly became Ready; continuing with explicit stable rollback but marking drill failed." >&2
  defect_observed="NO"
else
  defect_observed="YES"
fi

do_rollback
final_image="$($KUBECTL -n "$KUBE_NAMESPACE" get deployment "$DEPLOYMENT_NAME" -o jsonpath="{.spec.template.spec.containers[?(@.name=='${CONTAINER_NAME}')].image}")"
if [[ "$final_image" != "$STABLE_IMAGE_DIGEST" ]]; then
  echo "Rollback completed but deployment image differs from required stable digest: $final_image" >&2
  exit 1
fi

status="PASS"
if [[ "$defect_observed" != "YES" ]]; then status="FAIL"; fi
cat > "$DRILL_REPORT_PATH" <<EOF
# VetHelp Alpha Rollback Drill

- Started: ${started_at}
- Namespace: ${KUBE_NAMESPACE}
- Deployment: ${DEPLOYMENT_NAME}
- Stable digest: \`${STABLE_IMAGE_DIGEST}\`
- Defective digest: \`${DEFECTIVE_IMAGE_DIGEST}\`
- Defective rollout failed within 60s: ${defect_observed}
- Final stable digest: \`${final_image}\`
- Result: **${status}**
EOF

if [[ "$status" != "PASS" ]]; then
  exit 1
fi
