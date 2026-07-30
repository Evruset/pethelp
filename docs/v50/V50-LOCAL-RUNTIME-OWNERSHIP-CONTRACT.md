# V50 local runtime ownership contract

Status: `OPS-02C PASS / COMPLETE`; parent `OPS-02 PASS / COMPLETE`.

## Decision

`start-vethelp.sh` is the sole target lifecycle owner. It owns the normalized
Compose project `vethelp-alpha`, readiness, seed profile selection, foreground
and background web processes, status, logs and stop. Other tracked commands
must either delegate to it, implement a bounded validation action against an
existing runtime, or be classified as diagnostics.

The proven Portal loss classification remains
`AGENT_EXECUTION_PROCESS_TREE_CLEANUP`. Interactive user launch may own
long-lived web processes; bounded agent validation must never do so.
Existing-runtime inspection is read-only and uses managed endpoint/PID files.
Any diagnostic that creates SQL/API state is a separate mutating action and
must have bounded fixture ownership and cleanup before it may target the
canonical persistent database.

`existing-runtime-validation` therefore defaults to read-only. An explicit
seed or verify action additionally requires `--allow-mutation`; `up`, Portal
start and `stop` remain forbidden in that mode.

## Tracked entrypoint inventory

Nine tracked operational entrypoints or command facades exist. Package scripts
are subordinate commands, not independent lifecycle owners.

| Entrypoint | Current purpose and ownership | Compose actions | Ports/state/PID | Stop/cleanup | Classification |
|---|---|---|---|---|---|
| `start-vethelp.sh` | Canonical infra, seed, web launch, status and smoke | `up`, `ps`, `logs`, setup `run`, backend `exec`, `stop`; exact project `vethelp-alpha` | backend 3000, Portal 3001; `.runtime/vethelp-local`; exact PID identity | managed PID TERM, then exact `compose stop`; volumes preserved | `CANONICAL` |
| `dev/local/up.sh` | Legacy name retained as a thin delegate | none; execs canonical `up` | none | none | `COMPATIBILITY_WRAPPER` |
| `dev/local/down.sh` | Legacy name retained as a thin delegate | none; execs canonical `stop` | none | none | `COMPATIBILITY_WRAPPER` |
| `dev/local/rich-demo-up.sh` | Warning plus rich-demo compatibility delegate | none; execs canonical seed/verify/stop command | canonical 3001 and state root only | none of its own | `COMPATIBILITY_WRAPPER` |
| `Makefile` local targets | Compatibility command facade | none directly; delegates to canonical launcher | canonical endpoints/state | canonical `stop` | `COMPATIBILITY_WRAPPER` |
| `backend/scripts/smoke-local-journey.sh` | Former mutating journey | none; controlled exit 64 | none | none | `DEPRECATED_BLOCKED` |
| `dev/local/rich-demo-cleanup.test.sh` | Obsolete cleanup seam | none; controlled exit 64 | none | none | `DEPRECATED_BLOCKED` |
| `dev/local/local-stack-e2e.mjs` | Former independent Compose/fixture E2E | none; controlled exit 64 | none | none | `DEPRECATED_BLOCKED` |
| `dev/local/owner-mobile-web-e2e.mjs` | Former independent Compose/fixture E2E | none; controlled exit 64 | none | none | `DEPRECATED_BLOCKED` |

Subordinate command surfaces:

- Compose `seed` service runs migrations and `backend/scripts/seed.ts`.
- `backend/package.json` exposes build/test/migration/base, queue and owner seed
  commands. It owns no Compose or web process.
- `apps/clinic-portal/package.json` exposes Next dev/build/test commands. It
  owns no canonical PID or port without a caller.
- No tracked repository-root `package.json` exists.

## Lifecycle findings

Only `start-vethelp.sh` contains lifecycle implementation. The up/down/rich
wrappers and Make delegate to it. Unsafe journey, cleanup and E2E entrypoints
are controlled-blocked before any Docker, process, database or artifact action.
The fixed removal policy is recorded in
`V50-LOCAL-ENTRYPOINT-DEPRECATION-REGISTER.md`.

Portal ownership is canonical at fixed port 3001 with
`.runtime/vethelp-local/pids/clinic-portal.{pid,identity}`. Legacy PID and Next
lock files are ignored and never used to terminate a process. Diagnostic E2E
servers on 3313/3411/3412 remain process-local and outside canonical runtime
ownership.

Target stop semantics are:

1. verify the exact managed PID and executable identity;
2. signal only that PID or a process group recorded at creation;
3. use exact project `docker compose stop`, never normal-path `down`;
4. preserve volumes unconditionally;
5. never scan a port range, match a command substring, or traverse `.next`;
6. reserve SIGKILL for an explicit emergency command, not `stop`.

## Canonical endpoint and resource map

| Resource | Target |
|---|---|
| Backend | `http://127.0.0.1:3000` |
| Clinic Portal | `http://127.0.0.1:3001` |
| Owner Web | `http://127.0.0.1:3002` |
| Prototype V50 | `http://127.0.0.1:8090` |
| Mock MIS | `http://127.0.0.1:4101` |
| Mock Acquiring | `http://127.0.0.1:4102` |
| Mock Cloud | `http://127.0.0.1:4103` |
| LiveKit | `ws://127.0.0.1:7880` |
| Compose project/file | `vethelp-alpha` / `docker-compose.local.yml` |
| State root | `.runtime/vethelp-local` |
| Logs/PIDs | `.runtime/vethelp-local/{logs,pids}` |
| Diagnostic-only temporary ports | Owner 3313; Portal 3411; Owner 3412 |

The tracked rich-demo default Portal 3002 conflicts with target Owner Web.
OPS-02B must move rich demo to Portal 3001 as a profile of the canonical owner.
No tracked runtime launcher currently owns prototype port 8090; it is reserved
until an explicit canonical command is implemented.

## Canonical command model

The target CLI is:

```text
./start-vethelp.sh up
./start-vethelp.sh status
./start-vethelp.sh logs
./start-vethelp.sh portal
./start-vethelp.sh owner
./start-vethelp.sh seed base
./start-vethelp.sh seed owner
./start-vethelp.sh seed clinic
./start-vethelp.sh seed rich-demo
./start-vethelp.sh seed all
./start-vethelp.sh smoke
./start-vethelp.sh stop
```

`status` is read-only. `stop` preserves volumes. Seed and validation are
explicit actions: rich-demo verification is not a hidden startup side effect.
No profile uses ad-hoc `docker run`.

Compatibility policy:

- `all`, `infra` and the old single-word `seed` remain temporary aliases with
  deprecation messages;
- Make local targets delegate to `start-vethelp.sh`;
- `dev/local/up.sh` and `down.sh` are warning compatibility wrappers;
- `rich-demo-up.sh` is a warning seed/validation delegate and never
  owns Compose or a second Portal;
- `local-stack-e2e.mjs` and `owner-mobile-web-e2e.mjs` are controlled-blocked;
  their old booking/SQL scenarios cannot execute. Any future product
  E2E requires a new bounded source/cleanup contract and cannot reuse the
  deprecated lifecycle;
- `.dev-local` and `.dev-local/rich-demo` remain user-owned legacy state and
  are never migrated or deleted automatically; active artifacts live under
  `.runtime/vethelp-local/rich-demo`, and legacy PID files never authorize a
  process signal.

## Seed profile graph

```text
base
 ├─ owner  (base + identities + owner marketplace)
 ├─ clinic (base + identities + clinic employee + queue)
 └─ rich-demo (base dependency contract + isolated rich namespace)

all = base → owner → clinic
```

`rich-demo` is intentionally excluded from `all`. It may be requested after
base but must not rewrite owner/clinic rows. Profile execution emits one
machine-readable report with source ID, schema version, generation time,
counts, dependencies and a bounded owned-ID manifest.

## Mandatory source rules

Every runtime source has a permanent source ID and documented non-overlapping
namespace. Re-run is idempotent. Reset uses only source or reserved-namespace
predicates, preserves user and foreign-source rows, and rejects natural-key
capture unless an explicit shared-foundation policy authorizes it. Broad
deletes require an isolated-test database assertion.

PostgreSQL remains the source of truth. Console text and fixture metadata are
not authorization evidence, and no fixture source changes production behavior.

## OPS-02B implementation closure

`start-vethelp.sh` now implements the canonical command model, explicit
`interactive-user`, `existing-runtime-validation` and `bounded-test` modes,
one `.runtime/vethelp-local` state tree, exact managed-PID identity checks and
volume-preserving `compose stop`. `up` owns only Compose readiness; seed and
verification remain explicit. `infra`, `all` and bare `seed` are documented
compatibility aliases routed through the same dispatcher.

`dev/local/rich-demo-up.sh` is a thin delegate and no longer owns Compose,
backend restart, Portal selection or a second state root. Make local lifecycle
targets delegate to the canonical launcher. The active seed graph is:
`base`; `owner = base + identities + owner marketplace`;
`clinic = base + identities + clinic employee + queue`;
`rich-demo = base + LOCAL_RICH_DEMO_V1`; and
`all = base + owner + clinic`, with rich demo intentionally opt-in.

Next.js 16 uses one dev lock per `distDir`, so a bounded canonical Portal on
3001 could not coexist with an already running user Portal on 3002. The
minimal technical prerequisite is an environment-selectable `distDir`;
canonical bounded launch uses `.next-vethelp-canonical`, while ordinary Portal
development retains `.next`. This avoids killing, replacing or adopting the
unrelated 3002 process.

Runtime evidence: base rerun PASS; owner and clinic reports expose exact
dependency/source order; rich demo rerun retained 111 deterministic owned IDs
observations and exact membership cardinality 12; read-only smoke PASS; quick
security verification PASS for 12 sessions, four origins, four return paths
and three negative authorities. Portal 3001 was removed after the bounded
check. The pre-existing 3002 launcher parent remained owned by the user.
Backend and PostgreSQL remained healthy with zero restart count. Because the
Compose stack predated this controlled cycle, canonical `stop` was
intentionally not executed.

Remaining debt is removal-only after the documented compatibility window; it
is not a competing lifecycle and requires the separately authorized
`V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` slice.

## OPS-02C operating-loop closure

Canonical `smoke` is strictly read-only and emits one JSON report. It verifies
the exact project, Docker responsiveness, PostgreSQL/backend/mocks/LiveKit
state and restart counts, four HTTP health JSON markers, LiveKit 7880
publication, canonical Portal ownership, state modes, symlinks, bootstrap-code
absence and persistent secret patterns. It never seeds, restarts, generates a
session, stops a process or changes mock state.

Focused synthetic stop evidence proves one exact managed PID receives TERM,
an unrelated process survives, only
`docker compose -p vethelp-alpha -f docker-compose.local.yml stop` is recorded,
the second invocation is idempotent, persistent seed/state remains, and
forbidden down/volume/broad-kill operations are zero. No real runtime was
stopped.

Read-only runtime evidence on Docker 27.3.1/HyperKit passed: all six required
services were running and healthy where healthchecks apply, every restart
count was zero, all four HTTP markers returned 200/JSON, LiveKit used 7880,
Portal 3001 had no listener, and permission, symlink, bootstrap-code and
secret-match violations were zero.

`V50-LOCAL-RICH-DEMO-OPS-02C`, parent `OPS-02`, and the Wave 0 local operating
loop are `PASS / COMPLETE`. Compatibility removal is a later,
separately-authorized commit after one documented release window.
