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
- Node.js 20.20.2 available at `~/.nvm/versions/node/v20.20.2/bin` or on `PATH`.
- Flutter with Chrome support for the owner web app. By default the launcher uses `~/develop/flutter-3.27.4/bin/flutter` when present, otherwise `flutter` from `PATH`.
- At least 6 GB RAM assigned to Docker Desktop.

## Start everything with one command

From the repository root:

```bash
make local-dev
```

On macOS you can also double-click:

```text
VetHelp Local.command
```

The launcher starts:

- Docker local stack: PostgreSQL, backend, mock MIS, mock acquiring, mock cloud and LiveKit.
- Local seed data for owner, clinic, marketplace slots and clinic queue.
- Clinic Portal dev server on `http://localhost:3001`.
- Owner Flutter web app on `http://localhost:3002`.
- A local clinic employee session, opened automatically when `OPEN=1`.

Runtime logs and PID files are stored under `.dev-local/`.

Useful switches:

```bash
OPEN=0 make local-dev                 # do not open browser windows
START_OWNER=0 make local-dev          # skip Flutter owner web app
FLUTTER_BIN=/path/to/flutter make local-dev
```

Run browser-recorded owner mobile web scenarios:

```bash
make owner-web-e2e
```

The command builds Flutter web with the local owner token and E2E diagnostics
enabled, then drives the app in Chromium through visible UI clicks. It records
video, Playwright trace, per-step screenshots and a network summary under
`.dev-local/owner-mobile-web-e2e/`. The diagnostic
`window.vethelpOwnerE2E` object is enabled only for this E2E build; the command
also performs a production web build and fails if that object is present in the
production bundle.

Run the real local-stack cross-channel booking journey:

```bash
make local-up
make local-seed
make local-stack-e2e
```

This suite uses the real backend at `http://127.0.0.1:3000`, PostgreSQL, the
seeded local owner and clinic employee identities, Clinic Portal, and Flutter
Owner Web. It covers autonomous owner booking, clinic schedule completion,
Owner Pet Diary readback, and owner cancellation. Screenshots, videos, traces,
network summaries, JSON backend snapshots and backend failure logs are written
under `.dev-local/local-stack-e2e/`. External MIS/acquiring services remain the
local mock containers; autonomous booking asserts that no MIS reservation event
is emitted while `FEATURE_MIS_INTEGRATION=false` and
`FEATURE_ONLINE_PAYMENTS=false`.

The same suite is available in GitHub Actions as the manual/nightly
`Local Stack Cross-Channel E2E` workflow. It uploads the
`local-stack-e2e-evidence` artifact with a 14-day retention window.

Run Flutter integration tests for the owner booking and insurance flows:

```bash
make owner-integration-test
```

This is the canonical local command. For `OWNER_DEVICE=chrome`, the launcher
checks Chrome/Chromium, finds or starts a compatible ChromeDriver on port
`4444`, runs `flutter drive`, and cleans up the ChromeDriver process it started.
If ChromeDriver is not installed, the command fails before running Flutter with a
clear setup message. For a connected iOS/Android device, pass its device id:

```bash
OWNER_DEVICE=00008120-001A559911F3C01E make owner-integration-test
```

Optional overrides:

```bash
FLUTTER_BIN=/path/to/flutter make owner-integration-test
CHROMEDRIVER_BIN=/path/to/chromedriver make owner-integration-test
CHROME_EXECUTABLE=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome make owner-integration-test
```

Stop all local processes and containers:

```bash
make local-dev-down
```

## Manual start

From the repository root:

```bash
make local-up
```

The first start downloads images and installs backend dependencies inside a Docker volume. Watch backend startup:

```bash
make local-logs
```

When the health check is green, initialize sample clinic, service, slots, deterministic owner/pet identities, clinic employee access and the Level-C queue fixture:

```bash
make local-seed
```

Run the canonical owner journey smoke:

```bash
make local-smoke
```

Check all containers:

```bash
make local-status
```

## Open the Clinic Portal queue

Start the portal in a second shell:

```bash
cd apps/clinic-portal
cp .env.example .env.local
npm install
npm run dev -- --port 3001
```

For local development, `.env.local` must use the same signing secret as the backend container:

```dotenv
VETHELP_CLINIC_JWT_SECRET=local-development-jwt-signing-key-not-for-shared-use
VETHELP_API_BASE_URL=http://localhost:3000
VETHELP_ALLOW_DEV_SESSION=true
```

Then create or refresh the deterministic clinic employee session:

```bash
make clinic-portal-session
```

The command checks backend health, ensures the local employee has access to the seeded VetHelp Pilot location, generates a staff JWT inside the backend container, and prints:

- `sessionUrl` — open this first; it sets the HTTP-only `vethelp_clinic_session` cookie through the dev-only BFF endpoint and redirects to the queue.
- `queueUrl` — the exact clinic queue route for the current seed.

To open the session URL automatically on macOS/Linux:

```bash
OPEN=1 make clinic-portal-session
```

## Obtain a local owner token

The seed script uses owner UUID `11111111-1111-4111-8111-111111111111`. Generate a token valid for eight hours without exposing the signing value to the host shell:

```bash
docker compose -p vethelp-alpha -f docker-compose.local.yml exec backend \
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
make local-down
```

Delete all local stack data, including PostgreSQL volume:

```bash
docker compose -p vethelp-alpha -f docker-compose.local.yml down -v
```

## Boundaries

- This is a local development environment only.
- It must not be connected to a real MИС, real acquiring account, production database, cloud cluster, or production LiveKit project.
- The local LiveKit instance is a development video server, not a fake HTTP endpoint; the browser should connect to `ws://localhost:7880`.
