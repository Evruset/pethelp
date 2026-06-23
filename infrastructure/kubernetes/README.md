# VetHelp Alpha network perimeter

Apply this bundle from the repository root:

```bash
kubectl apply -k infrastructure/kubernetes
```

## Required workload labels

The backend Deployment must expose the named container port `http: 3000` and carry:

```yaml
metadata:
  labels:
    app.kubernetes.io/name: vethelp-backend
```

Only pods explicitly labelled `vethelp.io/internal-caller: "true"` may reach the backend directly through the ClusterIP Service. Internal callers must use `http://vethelp-backend-service.internal` (or its full Kubernetes FQDN), not the public hostname.

The PostgreSQL StatefulSet must carry:

```yaml
metadata:
  labels:
    app.kubernetes.io/name: postgresql
    app.kubernetes.io/component: database
```

## Mandatory Alpha substitutions

- Replace `api.alpha.vethelp.example` and `vethelp-alpha-tls` with the assigned Alpha DNS name and TLS secret.
- Replace the webhook and egress TEST-NET CIDRs with the acquiring provider and MIS vendor published ranges.
- Configure the load balancer / ingress controller to preserve the real client source IP. Otherwise source allowlisting can see the load balancer address instead.
- Confirm that the installed CNI enforces `NetworkPolicy`.
- Verify that the ingress controller labels match `network-policy.yaml`. Use `kubectl -n ingress-nginx get pods --show-labels` before apply.

## Intentional boundary

`/internal/*` is never a usable public API path: the public ingress deny rule returns 403, while trusted in-cluster pods use the ClusterIP Service. The application must continue to authorize every internal operation; network boundaries are defense in depth, not a replacement for AuthZ.
