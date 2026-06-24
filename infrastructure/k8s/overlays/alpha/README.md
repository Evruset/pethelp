# Alpha deployment

Build this overlay only with the release renderer and deploy the resulting digest-pinned manifest.

Before the first deployment, create the namespace, install ingress-nginx, cert-manager and External Secrets Operator, provision alpha-vault-store, and create mis-client-ca-certs with ca.crt.

LiveKit is local to Alpha. Its runtime values stay in the initial cluster-local runtime Secret and are not sourced from the external store. LiveKit webhooks must enter through ingress-nginx.

Replace example DNS names, documentation CIDRs, ingress labels and PostgreSQL labels before applying the manifest. Do not allow unrestricted egress.
