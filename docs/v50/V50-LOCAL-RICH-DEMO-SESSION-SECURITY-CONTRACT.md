# V50 local rich-demo session security contract

Status: `PASS / COMPLETE`, validated by `V50-LOCAL-RICH-DEMO-SEC-01V`.

## Boundary and authority

The local session endpoint exists only when `NODE_ENV != production` and
`VETHELP_ALLOW_DEV_SESSION=true`. It accepts same-origin localhost requests
only. A profile key is not authority: before a cookie is set, the server signs
a bounded JWT, asks backend `/v1/auth/session` for effective authority, and
requires exact subject, roles and clinic/location scope equality.

The server owns the only accepted return path. It is derived from the
authoritative profile role and scope; arbitrary or external paths are ignored.
The browser receives no bearer token.

## One-time exchange

Codes contain 256 bits of cryptographic randomness, expire after 45 seconds
using the server clock, and are stored only by their SHA-256 digest. Records
bind employee/profile data, exact origin and return path. Exchange claims a
record with an atomic rename before validation, so concurrent or replayed
requests cannot both succeed. Malformed, expired, wrong-origin, denied-profile
and replayed codes return the same bounded denial without a cookie.

The session cookie is HttpOnly, SameSite=Strict, path `/`, and has a 30-minute
maximum age. `Secure` is configurable for local HTTPS. Production returns 404.

## Artifact and lifecycle rules

The canonical launcher sets `umask 077`, creates its state and code directories
with mode `0700`, normalizes all managed files to `0600`, writes generated
seed/session/HTML artifacts atomically, removes pending codes at startup and
shutdown, and never persists a JWT or one-time code in a URL, HTML or JSON
artifact. Consumed records are removed immediately; expired records become
unusable from server-clock expiry. Docker readiness calls are bounded so an
unresponsive Desktop API cannot hang the launcher indefinitely.

Lifecycle cleanup also removes generated session JSON/HTML and transient
session-check body/header artifacts on startup, shutdown and controlled
failure. Its focused internal seam accepts only the exact managed runtime
directory or a bounded temporary-test namespace, rejects broad targets and
does not start or stop Docker, Portal, seed or sessions.

## Verification contract

The membership verifier compares complete sets of employee, role, clinic,
location, active and revoked state and rejects missing, unexpected, duplicate
or mismatched rows. The session verifier checks effective subject, exact roles,
exact scopes, non-empty backend-derived capabilities, one-time replay denial,
and the actual queue or veterinarian-visits BFF JSON response. It rejects
non-JSON responses, wrong top-level shapes, secret-like fields, excessive
lists/nesting, invalid UUID fields and strict RFC3339 timestamps including
impossible calendar dates. HTML text is never an authority signal.

The canonical launcher treats membership, authority, BFF contract, one-time
exchange, origin/return-path protection, permission and bearer-artifact checks
as hard failures.

## Validation evidence

- Exact membership matrix: expected 12, actual 12, missing 0, unexpected 0,
  duplicates 0.
- Effective authority and real queue/visits BFF checks: 12 profiles, 0
  failures, including reception, admin, veterinarian and controlled denial.
- Focused malformed-payload verifier: 5/5, including impossible dates,
  duplicate `holdId`, secret-like fields and repeated UUIDs of different
  resource types.
- Security runtime: four invalid origins denied; four unsafe return paths
  canonicalized; ten concurrent exchanges produced one success, nine denials
  and zero 5xx; replay and real 45-second expiry were denied.
- Focused veterinarian closure returned six strictly validated visits. Four
  remaining authority probes (cross-clinic queue, cross-location queue,
  veterinarian against queue and reception against visits) returned controlled
  403 denials with no DTO, resource, existence, redirect or 5xx leakage.
- Startup, shutdown and controlled-failure cleanup passed with idempotency,
  preserved sentinel/seed/log/PID/unrelated files and no broad deletion or
  symlink escape.
- Persistent artifact scan: zero bearer/JWT/code/session URL matches;
  managed directory mode `0700`, managed file modes `0600`, and zero
  group/world-readable managed files.
- Docker 27.3.1 on HyperKit preserved the healthy backend and PostgreSQL with
  zero restarts. The earlier Portal loss was classified as
  `AGENT_EXECUTION_PROCESS_TREE_CLEANUP`; an independently owned Portal
  remained HTTP 200 and alive through final cleanup.
