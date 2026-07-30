# V50 local entrypoint deprecation register

Status: `OPS-02C PASS / COMPLETE`.

`start-vethelp.sh` is the only supported local lifecycle API. Compatibility
wrappers must survive one documented release window and may be removed only by
the separate `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` slice.

| Entrypoint | Previous behavior | Target behavior | Mutation | Lifecycle ownership | Status | Replacement | Warning since | Removal condition | Removal slice |
|---|---|---|---|---|---|---|---|---|---|
| `start-vethelp.sh` | Canonical candidate | Canonical lifecycle, status, seed, verify and read-only smoke | explicit only | sole owner | `CANONICAL` | none | n/a | never through deprecation | n/a |
| `Makefile` local targets | Mixed direct Compose facade | Exact canonical command delegation | follows canonical command | none | `COMPATIBILITY_WRAPPER` | `./start-vethelp.sh <command>` | OPS-02B | one release window and documented direct-command adoption | `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` |
| `dev/local/up.sh` | Independent Compose/Portal launcher | Warn once and exec canonical `up` | yes | none | `COMPATIBILITY_WRAPPER` | `./start-vethelp.sh up` | OPS-02C | one release window | `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` |
| `dev/local/down.sh` | Broad PID termination and Compose down | Warn once and exec canonical `stop` | yes | none | `COMPATIBILITY_WRAPPER` | `./start-vethelp.sh stop` | OPS-02C | one release window | `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` |
| `dev/local/rich-demo-up.sh` | Independent rich runtime, Portal and cleanup | Warn once and dispatch exact canonical seed/verify/stop commands | explicit only | none | `COMPATIBILITY_WRAPPER` | `./start-vethelp.sh seed rich-demo` / `verify rich-demo` | OPS-02C | one release window | `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` |
| `backend/scripts/smoke-local-journey.sh` | Mutating API journey and mock scenario | Controlled exit 64 without mutation | none | none | `DEPRECATED_BLOCKED` | `./start-vethelp.sh smoke` | OPS-02C | blocked callers migrated | `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` |
| `dev/local/rich-demo-cleanup.test.sh` | Obsolete cleanup seam for the former rich owner | Controlled exit 64 without mutation | none | none | `DEPRECATED_BLOCKED` | `dev/local/start-vethelp.stop.test.sh` | OPS-02C | replacement stop proof retained | `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` |
| `dev/local/local-stack-e2e.mjs` | Independent Compose, SQL/API fixtures and transient servers | Controlled exit 64 without mutation | none | none | `DEPRECATED_BLOCKED` | canonical `status` / `smoke`; product E2E must receive a future bounded source contract | OPS-02C | safe replacement specified | `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` |
| `dev/local/owner-mobile-web-e2e.mjs` | Independent Compose, token and unscoped API fixture lifecycle | Controlled exit 64 without mutation | none | none | `DEPRECATED_BLOCKED` | canonical `status` / `smoke`; product E2E must receive a future bounded source contract | OPS-02C | safe replacement specified | `V50-LOCAL-RUNTIME-DEPRECATION-REMOVE-01` |

Untracked `.command`, recovery README files, `.dev-local` contents and other
user scripts are not release artifacts. They are never migrated, deleted or
used as process-ownership evidence by the canonical launcher.
