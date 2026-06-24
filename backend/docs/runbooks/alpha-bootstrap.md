# Alpha environment bootstrap

## Scope

This runbook provisions the minimum control plane required before the immutable VetHelp Alpha manifest can be deployed. It intentionally does not contain credentials or provider access keys.

## 1. Cluster foundation

Provision a managed Kubernetes cluster in the selected Russian cloud with:

- a CNI that enforces Kubernetes `NetworkPolicy`;
- a fixed NAT egress address, supplied to MIS and acquiring for allowlisting;
- an `ingress-nginx` controller;
- cert-manager with an issuer appropriate for the approved Alpha DNS zone;
- External Secrets Operator and `ClusterSecretStore/alpha-vault-store`;
- Argo CD in a separate control-plane namespace.

## 2. GitOps boundary

Apply, in order:

1. `infrastructure/gitops/argocd/projects/vethelp-alpha-project.yaml`;
2. `infrastructure/gitops/argocd/applications/vethelp-alpha.yaml`.

Use a protected branch/ref after PR #22 is merged. The Application must not use the Argo CD `default` project.

## 3. Runtime values

Create an initial local runtime Secret named `alpha-vethelp-backend-secret`. It provides local-only media credentials and any platform-owned keys. External Secrets merges the structured `alpha/runtime/external` record into the same Secret. That structured record must contain the externally managed database and provider values required by the backend.

Create `mis-client-ca-certs` in `vethelp-alpha` with a `ca.crt` key containing the approved clinic client CA bundle.

## 4. Replace non-production placeholders

Before enabling sync, replace:

- public and MIS Alpha host names in `alpha-ingress-secure.yaml`;
- documentation CIDRs in `alpha-network-policy.yaml` with approved MIS/acquiring ranges;
- ingress controller and PostgreSQL labels with labels from the target cluster;
- certificate issuer name if the Alpha DNS zone is not managed by `letsencrypt-prod`.

Never use `0.0.0.0/0` to bypass the egress policy.

## 5. Deploy gate

The immutable manifest is rendered only by CI from an image digest. Enable `VETHELP_ALPHA_DEPLOY_ENABLED=true` only after protected environment `alpha` has reviewers and `VETHELP_ALPHA_KUBECONFIG` is configured.

Run `scripts/alpha-preflight.sh` after deployment. Then run the external sandbox certification workflow. Retain its generated certification report as release evidence.

## 6. Recovery evidence

After a successful external sandbox report, execute the digest rollback drill and the isolated PostgreSQL restore drill. Attach both generated reports to the release record before marking Alpha deployment readiness as complete.
