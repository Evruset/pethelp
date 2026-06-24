# VetHelp local mock stack

This stack runs without a cloud account, provider sandbox account, production credentials, or external network allowlists.

## What starts

| Service | Local address | Purpose |
| --- | --- | --- |
| VetHelp backend | `http://localhost:3000` | API and Swagger UI |
| Swagger | `http://localhost:3000/docs` | Interactive API documentation |
| PostgreSQL | `localhost:5432` | Isolated local database |
| Mock MIS | `http://localhost:4101` | VetManager-compatible reservation API |
| Mock acquiring | `http://localhost:4102` | Payment intents, capture, void, refund and signed webhook simulator |
| Mock cloud | `http://localhost:4103` | Future cloud/storage/event integration stub; the current backend does not call a cloud API directly |
| Local LiveKit | `ws://localhost:7880` | Local video server in development mode |

## Prerequisites

- Docker Desktop with Compose v2.
- Git.
- At least 6 GB RAM assigned to Docker Desktop.

## Start

From the repository root:

```bash
docker compose -f docker-compose.local.yml up -d
```

The first start downloads images and installs backend dependencies inside a Docker volume. Watch backend startup:

```bash
docker compose -f docker-compose.local.yml logs -f backend
```

When the health check is green, initialize sample clinic, service and slots:

```bash
docker compose -f docker-compose.local.yml --profile setup run --rm seed
```

Check all containers:

```bash
docker compose -f docker-compose.local.yml ps
```

## Obtain a local owner token

The seed script uses owner UUID `11111111-1111-4111-8111-111111111111`. Generate a token valid for eight hours without exposing the signing value to the host shell:

```bash
docker compose -f docker-compose.local.yml exec backend \
  node /workspace/dev/local/create-owner-token.mjs | pbcopy
```

Paste it into Swagger `Authorize` as a Bearer token.

## Mock controls

### MIS reservation scenarios

The default scenario is a successful reservation. Configure the *next* reservation only:

```bash
curl -X POST http://localhost:4101/__mock/scenarios \
  -H 'Content-Type: application/json' \
  -d '{"mode":"reject"}'
```

Available modes:

- `success` — returns external hold id.
- `reject` — returns a provider business rejection.
- `timeout` — waits 4500 ms by default; this is longer than the backend 4000 ms MIS timeout.

For a custom timeout:

```bash
curl -X POST http://localhost:4101/__mock/scenarios \
  -H 'Content-Type: application/json' \
  -d '{"mode":"timeout","delayMs":6000}'
```

Inspect mock state:

```bash
curl http://localhost:4101/__mock/state
```

### Acquiring mock

The backend receives a real local checkout URL when it creates a payment intent. Open it in the browser, then use the displayed `curl` command to send a signed `authorized` webhook to the backend.

Inspect created payment intents:

```bash
curl http://localhost:4102/__mock/state
```

The mock uses the same local-only API and webhook values as the backend Compose service. Do not reuse them in shared or production environments.

### Cloud stub

The cloud stub is diagnostic-only until a real cloud client is added to the backend:

```bash
curl http://localhost:4103/v1/metadata
curl http://localhost:4103/__mock/state
```

## Stop or reset

Stop containers but keep database data:

```bash
docker compose -f docker-compose.local.yml down
```

Delete all local stack data, including PostgreSQL volume:

```bash
docker compose -f docker-compose.local.yml down -v
```

## Boundaries

- This is a local development environment only.
- It must not be connected to a real MИС, real acquiring account, production database, cloud cluster, or production LiveKit project.
- The local LiveKit instance is a development video server, not a fake HTTP endpoint; the browser should connect to `ws://localhost:7880`.
