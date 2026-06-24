#!/usr/bin/env bash
set -euo pipefail

: "${KUBE_NAMESPACE:=vethelp-alpha}"
: "${KUBECTL:=kubectl}"
: "${DEPLOYMENT_NAME:=alpha-vethelp-backend}"
: "${EXTERNAL_SECRET_NAME:=alpha-vethelp-backend-runtime}"
: "${RUNTIME_SECRET_NAME:=alpha-vethelp-backend-secret}"
: "${MIS_CA_SECRET_NAME:=mis-client-ca-certs}"
: "${PUBLIC_INGRESS_NAME:=alpha-vethelp-public}"
: "${MIS_INGRESS_NAME:=alpha-vethelp-mis-mtls}"
: "${NETWORK_POLICY_NAME:=alpha-vethelp-backend-restricted}"

fail() { echo "ALPHA PREFLIGHT FAILED: $*" >&2; exit 2; }
need() { "$KUBECTL" "$@" >/dev/null 2>&1 || fail "kubectl $*"; }

need get namespace "$KUBE_NAMESPACE"
need get clustersecretstore alpha-vault-store
need -n "$KUBE_NAMESPACE" get externalsecret "$EXTERNAL_SECRET_NAME"
need -n "$KUBE_NAMESPACE" wait --for=condition=Ready "externalsecret/$EXTERNAL_SECRET_NAME" --timeout=60s
need -n "$KUBE_NAMESPACE" get secret "$RUNTIME_SECRET_NAME"
need -n "$KUBE_NAMESPACE" get secret "$MIS_CA_SECRET_NAME"

ca_data="$($KUBECTL -n "$KUBE_NAMESPACE" get secret "$MIS_CA_SECRET_NAME" -o jsonpath='{.data.ca\.crt}')"
test -n "$ca_data" || fail "mTLS CA secret $MIS_CA_SECRET_NAME has no ca.crt"

need -n "$KUBE_NAMESPACE" get ingress "$PUBLIC_INGRESS_NAME"
need -n "$KUBE_NAMESPACE" get ingress "$MIS_INGRESS_NAME"
need -n "$KUBE_NAMESPACE" get networkpolicy "$NETWORK_POLICY_NAME"
need -n "$KUBE_NAMESPACE" rollout status "deployment/$DEPLOYMENT_NAME" --timeout=120s

printf 'ALPHA PREFLIGHT PASSED: namespace=%s deployment=%s\n' "$KUBE_NAMESPACE" "$DEPLOYMENT_NAME"
