# Kubernetes release manifests

Only this directory contains deployable Kubernetes manifests.

Run `scripts/verify-manifests.sh infrastructure/k8s` before every change.

CI builds `ghcr.io/<owner>/pethelp-backend:sha-<commit>`, resolves its `RepoDigest`, copies this Kustomize tree to a temporary directory, runs `kustomize edit set image`, and renders a digest-pinned manifest.

Legacy `backend/k8s/alpha/deployment*.yaml` files are removed. Do not restore tag-based images such as `:alpha` or `:latest`.
