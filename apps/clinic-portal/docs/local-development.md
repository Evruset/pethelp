# Local clinic portal session

This helper is available only when `NODE_ENV` is not `production` and `VETHELP_ALLOW_DEV_SESSION=true`.

From the repository root, after `make local-up` and `make local-seed`, use the one-command helper:

```bash
make clinic-portal-session
```

Open the printed `sessionUrl`. It validates the local staff JWT, sets the HTTP-only cookie and redirects to the exact queue route. With the portal already running on `3001`, this can open the browser directly:

```bash
OPEN=1 make clinic-portal-session
```

The lower-level manual flow is:

1. Seed a deterministic clinic employee:

```bash
docker compose -f docker-compose.local.yml exec -T backend \
  npx ts-node /workspace/backend/scripts/seed-local-clinic-employee.ts
```

2. Use the returned `clinicId` and `locationId` to generate the local staff token:

```bash
export LOCAL_CLINIC_ID=<clinicId>
export LOCAL_CLINIC_LOCATION_ID=<locationId>
docker compose -f docker-compose.local.yml exec -e LOCAL_CLINIC_ID -e LOCAL_CLINIC_LOCATION_ID backend \
  node /workspace/dev/local/create-clinic-token.mjs
```

3. Send the token to the local portal session endpoint. It validates the signature before setting an HTTP-only cookie:

```bash
curl -i -X POST http://localhost:3001/api/dev/local-session \
  -H 'Content-Type: application/json' \
  --data '{"token":"<local-clinic-jwt>"}'
```

The route is intentionally absent in production and must not be exposed through public deployment configuration.
