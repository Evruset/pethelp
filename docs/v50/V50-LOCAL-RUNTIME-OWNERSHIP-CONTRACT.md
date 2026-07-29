# V50 local runtime ownership contract

Status: `OPS-02A PASS / CONTRACT_COMPLETE`.

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

## Tracked entrypoint inventory

Nine tracked operational entrypoints or command facades exist. Package scripts
are subordinate commands, not independent lifecycle owners.

| Entrypoint | Current purpose and ownership | Compose actions | Ports/state/PID | Stop/cleanup | Classification |
|---|---|---|---|---|---|
| `start-vethelp.sh` | Full infra, seed, Clinic Portal and Owner launch for an interactive user | `up`, `ps`, `logs`, setup `run`, backend `exec`, `stop`; project defaults to `vethelp-alpha`, one Compose file | backend 3000, Portal 3001; `.runtime/vethelp-local`; `clinic-portal.pid` | recursive PID-child TERM, then exact project `compose stop`; volumes preserved | `CANONICAL_CANDIDATE` |
| `dev/local/up.sh` | Older full local stack, Portal and Owner launcher | independent `up`; invokes Make seed profile | backend 3000, Portal 3001, Owner 3002; `.dev-local/{logs,pids}` | pre-start exact PID TERM; paired `down.sh` uses `compose down` | `LEGACY` |
| `dev/local/down.sh` | Stop companion for `up.sh` | independent `down` | `.dev-local/pids/*.pid` | kills every PID file in directory, then removes Compose containers | `UNSAFE` |
| `dev/local/rich-demo-up.sh` | Rich role/security data plus its own Portal and verification | independent `up`, backend `stop`, seed `run`, backend `up`, `exec`, and `down` on stop | backend 3000, Portal default 3002; `.dev-local/rich-demo`, Portal/port/PID and Next lock | PID, process group, Next-lock and `.next` file-owner discovery; TERM then KILL; stop performs `down` | `SUBORDINATE_PROFILE` (currently unsafe as owner) |
| `Makefile` local targets | Compatibility command facade | independent `up`, `down`, `ps`, `logs`, setup `run`, `exec`, backend `restart` | inherits canonical Docker ports; delegates `.dev-local` lifecycle | `local-down` performs `down` | `COMPATIBILITY_WRAPPER` |
| `backend/scripts/smoke-local-journey.sh` | Mutating end-to-end diagnostic against an existing stack | none | backend 3000, MIS 4101, acquiring 4102; temporary directory only | trap removes its own temporary files | `DIAGNOSTIC_ONLY` |
| `dev/local/rich-demo-cleanup.test.sh` | Bounded cleanup seam verification | none | temporary `vethelp-rich-demo-cleanup.*` namespace | deletes only its own temporary fixture | `DIAGNOSTIC_ONLY` |
| `dev/local/local-stack-e2e.mjs` | Full Owner/Portal E2E harness with direct SQL/API fixture creation | independently runs `up -d --build` when backend is absent and uses `exec`/`logs` | backend 3000, temporary Portal 3411 and Owner 3412; test-results tree, no managed PID | closes owned child/server in-process but leaves DB fixtures and Compose running | `DIAGNOSTIC_ONLY` (currently unsafe as existing-runtime validation) |
| `dev/local/owner-mobile-web-e2e.mjs` | Owner web build/browser harness that creates booking/appointment/insurance state through APIs | unconditionally runs `up -d --build`, uses `exec`, and invokes Make seed | backend 3000, temporary Owner server 3313; test-results tree | closes owned HTTP server; leaves Compose and unmarked DB rows | `DIAGNOSTIC_ONLY` (currently duplicates lifecycle and leaks fixture state) |

Subordinate command surfaces:

- Compose `seed` service runs migrations and `backend/scripts/seed.ts`.
- `backend/package.json` exposes build/test/migration/base, queue and owner seed
  commands. It owns no Compose or web process.
- `apps/clinic-portal/package.json` exposes Next dev/build/test commands. It
  owns no canonical PID or port without a caller.
- No tracked repository-root `package.json` exists.

## Lifecycle findings

Three entrypoint families currently issue independent Compose lifecycle
commands: `start-vethelp.sh`, `dev/local/{up,down}.sh`/Make, and
`rich-demo-up.sh`. Two diagnostic harnesses additionally issue Compose `up`
against the same project. All default to `vethelp-alpha`, but independent
ownership allows one command to recreate resources used by another.

Portal ownership is also duplicated:

- canonical candidate: fixed 3001 and `.runtime/vethelp-local/clinic-portal.pid`;
- legacy up: configurable 3001 and `.dev-local/pids/clinic-portal.pid`;
- rich demo: dynamic from 3002, `.dev-local/rich-demo/pids/clinic-portal.pid`
  plus Next-lock, process-group and `.next` file-owner fallbacks.

The rich-demo discovery path can terminate an unrelated Next process and has a
normal SIGKILL fallback. `down.sh` trusts every PID file in a shared directory.
The E2E harnesses own unregistered servers on 3313/3411/3412 and may build or
recreate Compose during validation. These mechanisms are incompatible with
bounded agent execution.

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
- `dev/local/up.sh` and `down.sh` become compatibility wrappers;
- `rich-demo-up.sh` becomes a subordinate seed/validation profile and never
  owns Compose or a second Portal;
- `local-stack-e2e.mjs` and `owner-mobile-web-e2e.mjs` delegate lifecycle to
  the canonical owner. Their `existing-runtime` mode is inspection-only;
  booking/SQL scenarios require an explicit `mutating-diagnostic` mode with a
  permanent source ID, owned-ID report and bounded cleanup. Until that exists,
  they must refuse the canonical persistent database. Diagnostic servers
  remain process-local;
- `.dev-local` and `.dev-local/rich-demo` are read only for one transition,
  then generated outputs move to `.runtime/vethelp-local/profiles/rich-demo`;
  legacy PID files are never used to kill a process.

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

## OPS-02B implementation plan

Slice: `V50-LOCAL-RICH-DEMO-OPS-02B / Canonical Lifecycle Owner and Explicit
Seed Profiles`.

Planned files:

- `start-vethelp.sh`: canonical subcommands, profile graph, exact managed
  process identity, state/PID migration, read-only status and volume-safe stop;
- `Makefile`, `dev/local/up.sh`, `dev/local/down.sh`: compatibility delegation;
- `dev/local/rich-demo-up.sh`: subordinate seed/validate mode, no Compose or
  Portal ownership;
- `dev/local/local-stack-e2e.mjs`, `dev/local/owner-mobile-web-e2e.mjs`:
  existing-runtime mode, canonical lifecycle delegation and bounded diagnostic
  server ports;
- `backend/scripts/seed.ts`, local identity/employee/queue/marketplace/rich
  scripts: source reports and ownership guards;
- a shared local fixture manifest module and focused contract tests;
- local operations documentation and `docs/ai/current-state.md`.

No schema migration is required for the first repair: slots already have
`source`; rich-demo parent rows have reserved UUID namespaces; events have a
payload marker; shared specialties are explicit reference data. OPS-02B must
fail closed if a reserved UUID or natural key is already held by an
unrecognized row. If that guard cannot cover a newly added entity, a separate
migration prerequisite is required before extending reset.

Focused validation:

- shell syntax and CLI parsing;
- command delegation with a fake Compose/process harness;
- exact project/port/state/PID/stop assertions;
- seed report schema and dependency order;
- A→A idempotency and all pairwise cross-source preservation;
- reset-after-foreign-source preservation;
- reserved-ID collision rejection;
- no `down`, port-range kill, substring kill or normal SIGKILL;
- rollback: retain compatibility aliases and restore old commands as wrappers,
  never roll back database contents or volumes.

Commit structure: lifecycle/compatibility, fixture ownership/reporting, tests,
then documentation. Runtime mutation and migrations remain outside OPS-02A.
