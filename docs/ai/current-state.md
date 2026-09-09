# V50 program current state

Updated: 2026-09-09

## Program status

- `BASELINE-02`: `COMPLETE`, committed as `22da293`.
- `V50-SHELL-01`: `COMPLETE / INTEGRATED` at `1c58ad6`.
- `V50-OWNER-01`: `COMPLETE / INTEGRATED` at `2077b00`.
- `V50-OWNER-02`: `COMPLETE / INTEGRATED` at `78d9322`.
- `V50-OWNER-03`: `COMPLETE / INTEGRATED` through merge `e747f61`; runtime `dc762b4`.
- `V50-OWNER-04`: `COMPLETE / INTEGRATED` through merge `9e165a3`; runtime `985dd5b`; evidence certification `d3edf71`.
- `V50-OWNER-05`: `COMPLETE / INTEGRATED` through merge `c2bbcbf`; runtime `cc6ba06`; certification `ade242e`.
- Integration status: `V50-OWNER-07_INTEGRATED / V50-CLINIC-01_NOT_STARTED`.
- Canonical target: `V50`; source: `prototype-v50/index.html`; manifest SHA-256: `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`.
- Program branch/worktree: `agent/v51-stage-01-architecture` / `/Users/evrusetskiy/work/pethelp-alpha`.
- Root worktree still contains protected user changes in `.codex/ACTIVE_MODE` and `.codex/config.toml`; this worktree does not modify them.

## Completed slice

`V50-SHELL-01 / Shared Design Tokens and Application Shells`, classified `C3 / R2`.

- One canonical semantic token contract: `docs/v50/design-tokens.json`; V51 path is a checksum-bound compatibility descriptor.
- Owner: independently flagged V50 adaptive shell with mobile bottom navigation, tablet rail, desktop frame, selected destination, lazy first-visit domain mounting with retained page state, selected-pet context, notifications, emergency entry, restoration/deep-link mapping and loading/error/session-expired surfaces. Legacy composition remains the default-off rollback.
- Portal: independently flagged V50 reception/veterinarian shell with server-side flag selection, capability-filtered navigation union for multi-role staff, exact clinic/location-scope visibility, selected navigation, context header, skip link, desktop/tablet/mobile layouts, and fail-closed session states. Backend/routes remain authoritative.
- Canonical flags override legacy aliases even when explicitly false; legacy exact-true is consulted only when the canonical value is absent.
- No backend, API, migration, production data, secret, dependency, or business-flow change.

## Validation state

- Token contract: PASS 4/4.
- Flutter analyze: PASS; focused affected Owner tests: PASS 27/27; full Flutter tests: PASS 145/145; V50 Owner web entrypoint build: PASS.
- Portal typecheck/build: PASS; focused Playwright: PASS 14/14; final full Portal E2E: PASS 95/95.
- Visual shell evidence: PASS for Owner `375x812`, `412x915`, `768x1024`, `1440x900`; Portal `375x812`, `768x1024`, `1440x900`, `1920x1080`, plus loading, error/retry, session-missing/forbidden, reduced-motion and 200% text-scale evidence.
- Evidence location outside Git: `/tmp/v50-shell-evidence/`.
- Business-content visual counter is `7/30 VISUALLY_VERIFIED` after the V50-OWNER-03 independent validator passed.
- Backend tests were not run because backend code did not change.
- Independent repair review: PASS; no remaining vetoes.

## Compatibility and rollback

- Owner: `VETHELP_OWNER_V50_SHELL` with `VETHELP_OWNER_V51_SHELL` fallback.
- Portal: `PORTAL_V50_SHELL` with `PORTAL_V51_SHELL` fallback.
- V51 Portal exports, skip-link selector and content locator remain compatibility aliases for one release window.
- Rollback is independent per application by defining its canonical V50 flag as false; no data/API rollback is needed.

## Completed Owner slice

`V50-OWNER-01 / Owner Home, Selected Pet Context and Next Safe Action`, classified `C3 / R2` because it adds a cross-domain, owner-scoped read model without changing mutation authority.

- V50 scope: `OWN-001`, source anchor `#home` → runtime `/owner/home`; existing emergency entry reuses `OWN-017`, `#emergency` → `/emergency`.
- Backend contract gate: existing pets, appointments and telemed APIs expose owner-safe data but do not provide one server-authoritative next-action priority. The slice therefore adds a minimal read-only `GET /v1/owner/home` projection.
- Selected pet: an owner-scoped local preference is only a hint; backend and Flutter validate it against the authenticated owner's authoritative pet list before use.
- Feature flag: `OWNER_V50_HOME`, default off, effective only when the canonical V50 shell is enabled.
- Non-goals remain catalog/booking/telemed/insurance/emergency flow implementation, notifications/profile, Portal, mutations, migrations, payment and MIS.

## V50-OWNER-01 delivery state

- Runtime: default-off `OWNER_V50_HOME` composes the Care Journey Home only inside the canonical V50 shell; disabling either flag returns the legacy Home.
- Authority: `GET /v1/owner/home` derives owner identity only from JWT `sub`, validates the selected-pet hint against owned pets, and returns one closed server-prioritized action plus at most one active-care projection.
- Safety: stale/foreign pet hints fall back without disclosure; history telemed safety flags cannot outrank active care; unknown action codes use a non-crashing appointments fallback; offline snapshots suppress authoritative actions; Home-level 401 clears retained owner state and moves the shell to session-expired.
- Validation: backend focused specs PASS 9/9 before repair and PASS 9/9 after repair; Flutter affected Home/shell PASS 16/16; analyze PASS; full Flutter PASS 164/164; flagged Owner web build PASS; independent post-repair validator PASS with no vetoes.
- Durable evidence: 10 checksum-bound artifacts at `/Users/evrusetskiy/docs/ai/evidence/V50-OWNER-01/` cover `375x812`, `412x915`, `768x1024`, `1440x900`, ready/attention, no active care, no pets, loading, retryable error, offline/stale, 200% text and reduced motion.
- Parity boundary: the bounded care-hub behavior, responsive layout and required states are implemented/tested. The complete prototype Home still includes content outside this slice, and the evidence is not a side-by-side prototype acceptance; `OWN-001` remains partial. At V50-OWNER-01 closure the program counter was `0/30`; the current counter is recorded in the V50-OWNER-02 closure below.
- Environment note: after a pre-repair Docker backend PASS, a later independent Docker rerun was blocked before Jest by npm `spawn EINVAL`; the post-repair service spec nevertheless passed 9/9 in the implementer harness, and the independent validator accepted the repaired logic with this residual reproducibility note.

## Completed Owner pets slice

`V50-OWNER-02 / Pets, Pet Profile and Pet Diary` is complete and integrated through `78d9322`. Runtime repair `c27e21f` corrects the shared visual frame, responsive Pets/Profile/Diary hierarchy, explicit exceptional states, owner-scoped deep links, session fencing, secure document retry and keyboard focus behavior. Default-off feature flags remain the rollback boundary.

Fresh package `v50-owner-02-c27e21f` contains 48/48 runtime screenshots, 12/12 authoritative prototype references and 8/8 supplemental acceptance-state browser screenshots. Package SHA-256 is `bdf429f2e95a8da51bcd2ee2030eda23bf5c7b43456e7fc72df763ac375a9e8f`. Comparisons and independent validation are PASS, so `OWN-009..OWN-011` are `IMPLEMENTED / TESTED / VISUALLY_VERIFIED` and the program counter is `3/30 VISUALLY_VERIFIED`.

Acceptance closure passes field-specific Profile validation/draft preservation, archived/not-found/session/offline Profile states, owned/archived/foreign/unknown deep links, account-switch no-leak fencing, archived/network/foreign document states and automated keyboard focus. Browser/CDP traversal reaches 11/12/15 unique Pets/Profile/Diary targets without a consecutive trap. PostgreSQL 16 migration fixtures pass empty, active-data, already-archived, rollback-retention and repeated-run cases. Focused backend is 34/34, Flutter focused is 71/71, full Flutter is 235/235, analyze/builds pass. Independent read-only validation is PASS with zero vetoes.

## Completed Owner catalog and doctor slice

`V50-OWNER-03 / Clinic Catalog, Clinic Detail and Doctor Discovery` is complete and integrated through merge `e747f61`; final runtime commit is `dc762b4`. Scope remains limited to `OWN-002`, `OWN-004`, `OWN-018` and `OWN-019`; booking holds and V50-OWNER-04 were not started.

The repair aligns Catalog filtering, clinic-card fact priority, list/map synchronization, Clinic hero/availability/pricing/doctor-preview composition and responsive behavior with the authoritative anchors. Catalog freshness is visible and semantic, including an explicit stale state. The black top band was classified as `CAPTURE_HARNESS_DEFECT`; stable-frame, cache-disabled, service-worker-bypassed capture now rejects black bands and stale bundles.

Backend focused catalog/auth/pet tests PASS 20/20. Post-runtime Flutter analyze PASS, affected tests PASS 48/48, full suite PASS 241/241, and both evidence and production Owner web builds PASS. Package `v50-owner-03-dc762b4` contains 48/48 runtime artifacts and 16/16 prototype references across 375/412/768/1440, with SHA-256 `e07837d15af828090b6be02b50be06b9f1dde3d60fa37f913991a87cac60a67b`; representative gate is 8/8 and black-band count is zero.

Independent read-only validation is PASS with zero vetoes. `OWN-002`, `OWN-004`, `OWN-018` and `OWN-019` are `IMPLEMENTED / TESTED / VISUALLY_VERIFIED`; the counter is `7/30`. Integration readiness is PASS. Doctor production rollout remains BLOCKED by `PUBLIC_DOCTOR_PROFILE_CONSENT_CONTRACT_MISSING`; the strict allowlist/default-off mitigation and required future consent source are recorded in `docs/v50/V50-DOCTOR-PUBLIC-PROFILE-CONSENT-DEBT.md`.

## V50-OWNER-04 delivery state

`V50-OWNER-04` is integrated through merge `9e165a3`; runtime commit is
`985dd5b`. The safe read supplies server-authored booking selection semantics;
flagged `/owner/booking` and `/owner/booking/review` retain typed guest intent
and stop before hold/mutation. Backend focused PASS 4/4 and build PASS; Flutter
analyze PASS, focused PASS 4/4, full PASS 245/245, both web builds PASS. Package
`v50-owner-04-985dd5b` verifies 48/48 runtime artifacts, 4/4 prototype-reference
artifacts, the aggregate package checksum, and 8/8 representative comparisons.
Independent validation PASS with zero vetoes. `OWN-005` and `OWN-006` are
IMPLEMENTED / TESTED / VISUALLY_VERIFIED; program counter is 9/30. Integration
readiness and integration are PASS.

## Next slice

`V50-OWNER-05 / Hold Creation and Booking Status` is complete on
`agent/v50-owner-05`; runtime is `cc6ba06`. Canonical Booking Core now provides
payload-bound idempotency, authoritative slot/pet/service/doctor/freshness
validation, owner-safe status read, atomic outbox/audit/count handling and
drift-safe expiration. Real PostgreSQL PASS 4/4 includes 100 contenders with
exactly one success. Flutter focused/full/analyze and flagged web build pass.
Package `v50-owner-05-cc6ba06` contains 48/48 runtime and 8/8 prototype
artifacts with checksum `d7e36a6b7071b8e607b8beeabd6941ec9185128e50911b80c10c5cef9300339a`;
representative 8/8 and full visual validation PASS. Transaction/security and
product/visual and final integration validators PASS with zero vetoes.

The Owner Home backend reproduction gate is `PASS`: after canonical Compose recreated its dependency volume, Jest ran 4 focused suites and passed; the final combined Owner pets/Home run passed 23/23 tests. Resolution evidence is recorded in `docs/ai/tooling-debt/V50-OWNER-01-backend-spawn-einval.md`.

## V50-OWNER-06 delivery state

`V50-OWNER-06` is complete and integrated through merge `cd63a65`; runtime and
runtime repair commit is `fb24f18`. `OWN-007 #appointments` now uses an owner-scoped
server-classified list with `serverNow`, pet/bucket filters and uncapped stable
keyset pagination. Bounded `OWN-008 #appointment-detail` has a safe timeline,
shared backend cancellation policy, version fencing and payload-bound
idempotency. Local holds release capacity once; confirmed/MIS bookings become
`CANCELLATION_REQUESTED` and retain booked capacity.

Canonical Compose uses Node `v22.23.1`, npm `10.9.8` and PostgreSQL `16.14`.
Backend build PASS; focused real-PostgreSQL PASS 5/5, including 1,005-row paging
proof and 20 concurrent cancellations with one transition/counter/audit/outbox
effect and restored pool, plus injected outbox rollback. Flutter
analyze/focused/full and flagged web build PASS. Immutable package
`v50-owner-06-fb24f18` contains 48/48 runtime and 8/8
prototype artifacts with checksum
`5a1e3a26d5a70f0b96a8fc2c271ca49dbc5ba74f32f77f79bdf6c6f528eaeaa2`.
Representative and full visual gates PASS. State/security and product/visual
validators and final integration validator PASS with zero vetoes. The next
bounded context is `V50-CLINIC-01 / Clinic Queue and Booking Confirmation`.

## V50-OWNER-07 delivery state

`V50-OWNER-07` is complete and integrated through merge `71c90b3` from `agent/v50-owner-07`; runtime is
`670bc32`. `OWN-020 #alternative-slot` reuses the clinic-created Capacity-B
reservation and adds canonical owner-scoped proposal read/accept/decline with
booking+proposal identity, payload-bound idempotency, aggregate version fencing,
global hold/slot/proposal lock order, authoritative deadline/readback and atomic
counter/audit/outbox effects. Flutter is default-off, responsive, offline-safe
and returns only a typed availability intent.

Backend build PASS; PostgreSQL focused 12/12 and legacy 4/4 PASS, including
20-way accept, 10-vs-10 resolution and clinic-supersede races with zero 5xx and
restored pool. Flutter analyze/focused/full 265/265 and flagged web build PASS.
Package `v50-owner-07-670bc32` verifies 48/48 runtime plus 4/4 prototype with
SHA-256 `a945970478939453d58d6014eb307e68d252f58fd7938545189f604f3414601a`.
State/security, product/visual and final integration validators PASS with zero
vetoes. `OWN-020` is IMPLEMENTED / TESTED / VISUALLY_VERIFIED; program counter
is 12/30. `OWN-008` remains bounded partial.

## Active slice

`V50-CLINIC-01A / Manual Confirmation → Authoritative Owner Status` is
`COMPLETE`. The owner hold projection derives `confirmationMode` from the
pending manual-confirmation SLA marker or the persisted clinic-employee
confirmation event, so a Level-C hold confirmed by clinic staff remains
`MANUAL` instead of being misreported as `AUTOMATIC` after entering
`CONFIRMED`.

The real-PostgreSQL queue harness covers the bounded B2C → Clinic Queue →
confirmation → owner-status readback and asserts `CONFIRMED`,
`VIEW_APPOINTMENT`, aggregate version `2`, and `MANUAL` semantics. No route,
DTO shape, mutation, migration, dependency, role, or scope changed.

Validation: canonical Compose focused PostgreSQL suites PASS `10/10`; backend
build PASS; `git diff --check` PASS. The prior `DOCKER_DAEMON_UNAVAILABLE`
integration veto is resolved. No open veto remains for this bounded slice.

## Next single action

`V50-CLINIC-01B / Clinic Queue HTTP Authority Matrix` is `COMPLETE`.

- A focused real NestJS/PostgreSQL HTTP matrix covers the existing queue read
  and manual-confirmation routes: allowed receptionist, role denial, revoked
  and missing membership, claims without membership, missing/incompatible
  clinic and location scopes, cross-clinic/location isolation, normalized
  no-leak denials, and idempotent success with authoritative owner readback.
- The matrix exposed and closed an authorization gap in the existing mutation
  path: a matching `locationIds` claim and membership previously allowed confirm
  with a missing or incompatible `clinicIds` claim. `assertLocationAccess` now
  matches the JWT clinic scope against the clinic resolved server-side through
  the active, non-revoked location membership inside the transaction.
- Denied confirmations prove unchanged state/version and zero appointment,
  `booking.confirmed.v1` outbox, and `booking.confirmed` audit side effects.
- Validation: HTTP authority matrix PASS `17/17`; Clinic Queue regression PASS
  `6/6`; backend build PASS; `git diff --check` PASS. Independent Tier B
  validator PASS with no vetoes.

## Next single action

`V50-CLINIC-01C / Decline and Request-Notes HTTP Authority Matrix` is
`COMPLETE` as a test/evidence closure with no production-code change.

- The existing HTTP harness now proves positive, idempotent decline and
  request-notes behavior through the real NestJS/PostgreSQL stack.
- Decline preserves the existing contract: `RELEASED`, version `2`, released
  slot capacity, `booking.hold.released.v1`, `booking.declined`, persisted
  decline reason, and authoritative owner readback.
- Request-notes preserves `MANUAL_CONFIRM_PENDING`, increments to version `2`,
  retains held capacity, and persists the exact request in
  `booking.notes.requested.v1` plus `booking.notes.requested` audit evidence.
- Both commands deny role, missing/revoked membership, missing/incompatible
  clinic and location scopes without changing state/version or creating
  appointment, success outbox, or success audit effects. `CONFIRMED` terminal
  state returns the existing `INVALID_STATE_TRANSITION` contract with no
  effects.
- Validation: HTTP authority suite PASS `23/23`; Clinic Queue regression PASS
  `6/6`; backend build PASS; `git diff --check` PASS. Tier A root review found
  no production defect and no open veto.

## Next single action

`V50-CLINIC-01D / Alternative-Slot HTTP Authority and Atomicity Matrix` is
`COMPLETE`.

- Covered existing HTTP only: clinic proposal
  `POST /v1/clinic/booking-holds/:holdId/alternative-slot`, owner snapshot
  `GET /v1/booking-holds/:holdId/alternative`, and legacy owner accept
  `POST /v1/booking-holds/:holdId/alternative-slot/accept`. No owner decline
  HTTP route exists, so none was invented.
- Clinic proposal proves role, active/non-revoked membership, exact clinic and
  location scopes, idempotency, no-leak denial, zero denied effects, one swap
  record, and simultaneous source/proposed capacity reservation.
- Owner evidence proves owner-only read/accept, foreign-owner and staff denial,
  same-key replay, different-key terminal rejection, stale version, DB-driven
  expiry, slot conflict rollback, authoritative snapshot, and zero duplicate
  appointment/outbox/audit effects.
- A production defect was found and fixed: loss of the reserved alternative
  slot returned `503 BOOKING_TEMPORARILY_UNAVAILABLE`; the legacy accept path
  now returns the existing controlled `409 SLOT_ALREADY_TAKEN` contract without
  state, capacity, audit, or outbox mutation.
- Existing alternative regression fixtures now include the mandatory clinic
  scope introduced by `01B`. Its 20-way accept and 10x10 accept/decline race
  prove one successful transition, one effect set, no unexpected 5xx, and
  bounded non-negative capacity.
- Validation: HTTP authority suite PASS `29/29`; Clinic Queue regression PASS
  `6/6`; alternative atomicity/concurrency regression PASS `12/12`; backend
  build PASS; `git diff --check` PASS. Tier B diff-first validator PASS with no
  vetoes; its separate environment could not reproduce runtime checks because
  required auth/Web Crypto/PostgreSQL role setup was absent.

## Next single action

`V50-CLINIC-01E / Queue Command Version-Fence and Replay Matrix` is `COMPLETE`
as a test/evidence closure with no production-code change.

- The existing real NestJS/PostgreSQL HTTP harness now proves that queue reads
  expose aggregate `version`, all four clinic commands require `If-Match`, and
  stale or impossible future versions return controlled
  `409 SLOT_VERSION_STALE` without state, version, capacity, appointment,
  swap, outbox, or audit mutation.
- Same-key replay returns the first authoritative result and creates one effect
  set. For request-notes, a changed payload under the same key replays the first
  note and cannot overwrite it. A different key after terminal confirm or
  decline returns `INVALID_STATE_TRANSITION` without duplicate effects.
- Concurrent duplicate confirm delivery produces one transition. The
  confirm-vs-decline and request-notes-vs-alternative races produce exactly one
  winner, a controlled `409` loser, version `2`, one success event/audit, and
  winner-correlated final state, capacity, appointment, and swap counts.
- Validation: focused HTTP authority suite PASS `44/44`; Clinic Queue plus
  owner alternative regressions PASS `18/18`; backend build PASS;
  `git diff --check` PASS. Independent Tier B validator PASS with no vetoes.

## Next single action

`V50-CLINIC-01F / Outbox Worker Replay Reliability` is `COMPLETE`.

- The actual shared contract is `booking_schema.outbox_events`, UUID primary
  key/event ID, aggregate/event metadata and JSON payload, unique optional
  `deduplication_key`, and statuses `PENDING`, `LEASED`, `PUBLISHED`, plus the
  bounded terminal `FAILED`. Claims are ordered by event ID, batch size is 20,
  the lease is 30 seconds, retry delay is the existing fixed 5 seconds, and the
  terminal limit is five claimed delivery attempts. There is no separate DLQ
  or per-aggregate ordering guarantee.
- Booking state, audit and outbox insertion remain in the command's PostgreSQL
  transaction. Existing Queue HTTP evidence proves one authoritative command
  transition/event; the focused outbox harness proves transaction rollback
  leaves no record.
- Two reliability defects were repaired in the common primitive without a
  migration: poison events previously retried forever, and an abandoned
  `LEASED` row could never be reclaimed. Failed events now become observable as
  `FAILED` after attempt five, and an expired lease is reclaimable.
- Reclaimed leases are fenced by the full-precision PostgreSQL `lease_until`
  token. A stale claimant cannot publish-complete or release the newer claim;
  only the current token can mutate it. Two-worker claim overlap and the stale
  claimant race are covered.
- Retry state, attempt count, safe generic `last_error`, next availability,
  terminal structured logging with event/correlation IDs, poison isolation,
  completed-row non-selection and restart persistence are covered. Error
  evidence does not include event payload or provider error text.
- Canonical Compose restart evidence proves pending delivery survives backend
  restart, persisted failed-attempt metadata survives restart and recovers on
  attempt two, and restart after success preserves the same attempt count and
  `published_at` without replay.
- Changed files: `backend/src/outbox/outbox.service.ts`,
  `backend/src/outbox/outbox-relay.service.ts`,
  `backend/test/booking-outbox-replay.integration-spec.ts`, and this handoff.
  No route, DTO, role, booking state, dependency, migration, or UI changed.
- Validation: focused PostgreSQL outbox suite PASS `5/5`; Clinic Queue and HTTP
  version/replay regressions PASS `50/50`; backend build PASS;
  `git diff --check` PASS. Independent Tier B validator PASS after the
  lease-fencing veto was repaired.

## Next single action

`V50-CLINIC-01G / Queue Read-Model Reconnect and Recovery` is `COMPLETE` as an
evidence closure; production behavior is unchanged.

- The existing read contract is
  `GET /v1/clinic/:clinicId/locations/:locationId/booking-queue`, authorized by
  active clinic/location membership and matching JWT scopes. PostgreSQL is the
  authoritative source; there is no cache, cursor, SSE, or WebSocket. Recovery
  is a repeated polling read independent of client or backend memory.
- The response is a bounded current snapshot, not traversable pagination:
  `limit` defaults to 50 and clamps at 100. It contains only
  `MANUAL_CONFIRM_PENDING` rows with a confirmation SLA, ordered FIFO by
  `state_changed_at ASC` with UUID `id ASC` as the stable tie-breaker. Each item
  exposes the authoritative aggregate version.
- Multi-item initial and repeated reads prove stable ordering, one row per
  booking, default/max limits, no duplicates, no foreign-location rows, and no
  outbox/audit side effects. A technical transaction failure remains HTTP 500
  without an `items` field and the next poll recovers; it is not normalized to
  a successful empty queue.
- Read-after-write and missed-poll evidence covers confirm, request-notes,
  decline, and request-notes followed by alternative proposal. Non-terminal
  version/audit data converges; terminal or moved-out-of-queue states disappear
  without stale duplicates; owner readback remains consistent.
- Concurrent reads with confirm or request-notes return only a valid pre-commit
  or post-commit snapshot. A returned notes version 2 is coupled to its latest
  audit action; a visible concurrent confirm row can only be pre-commit version
  1.
- Canonical Compose restart preserves the exact queue items and ordering from
  PostgreSQL. The same post-restart token remains location-scoped; a different
  location returns 403 without queue payload disclosure.
- Changed files: `backend/test/clinic-queue-http-authority.e2e-spec.ts` and this
  handoff. No route, DTO, query, mutation, state machine, role, migration,
  dependency, cache, realtime transport, or UI changed.
- Validation: focused HTTP recovery/authority suite PASS `51/51`; Queue
  integration regression PASS `6/6`; backend restart evidence PASS; backend
  build PASS; `git diff --check` PASS. Tier B validator PASS after limit-boundary
  and concurrent snapshot assertions cleared its initial test-strategy veto.

## Next single action

`V50-CLINIC-01H / Clinic Portal Queue Integration` is `COMPLETE`.

- The production Portal is `apps/clinic-portal`; the existing route
  `/clinics/:clinicId/locations/:locationId/queue` continues to render
  `components/queue/ClinicQueueClientV2.tsx`. No workspace, screen, design
  shell, backend route, DTO, role, or state-machine branch was added.
- The screen consumes the authoritative Queue BFF/API with clinic/location
  scope, validates returned scope, versions, required item fields and unique
  hold IDs, and retains the last successful snapshot only with an explicit
  degraded timestamp. Technical errors never become a business-empty state;
  stale/degraded rows cannot execute commands.
- Existing 15-second polling now has one in-flight request per screen, skips
  background polling while hidden, refreshes immediately when visible, aborts
  and fences old-scope requests on cleanup, and coalesces overlapping manual
  polls. A command readback encountered behind an in-flight stale poll is
  queued and completes only after a mandatory second authoritative fetch.
- Confirm, decline, request-notes and clinic alternative proposal remain wired
  through the existing BFF routes with authoritative item `If-Match` and one
  idempotency key per logical attempt. Transport/server retry reuses the key;
  a completed denial/conflict followed by a new explicit action gets a new
  key. Success is never optimistic: every command performs Queue readback.
- Decline now collects the required 3–1000 character reason instead of sending
  fixed demo text. Input remains in the dialog after transport failure and is
  cleared only after authoritative success. Request-notes and alternative
  selection retain their existing validation/conflict behavior.
- Role/capability and URL-scope fail-closed behavior remains intact. Unknown
  audit actions use a safe label instead of exposing a raw backend enum.
  Desktop and 768px tablet evidence preserve the existing V50 hierarchy;
  critical actions remain keyboard operable, and loading/error/degraded/
  decline/conflict states are captured under
  `/tmp/v50-clinic-01h-evidence/`.
- Changed files: `apps/clinic-portal/components/queue/ClinicQueueClientV2.tsx`,
  `apps/clinic-portal/tests/e2e/clinic-queue.spec.ts`, and this handoff. Backend
  behavior and public contracts are unchanged.
- Validation: Portal typecheck PASS; Node 22 production build PASS; focused
  Chromium Queue suite PASS `19/19`; backend Queue authority/integration gate
  PASS `57/57`; visual representative review PASS; `git diff --check` PASS.
  Tier B validator PASS after the stale in-flight poll/readback veto was fixed.

## Completed slice

`V50-CLINIC-01I / Clinic Queue SLA Ordering and Visibility` is `COMPLETE`.

- The existing `ClinicQueueClientV2` now validates canonical timestamp shape,
  numeric parseability, field ranges, and real calendar dates for `serverNow`
  and every Queue timestamp before a polling snapshot can replace the last
  valid snapshot. A malformed or technically failed read keeps the previous
  queue visible in the explicit degraded state; it is never rendered as an
  authoritative empty queue.
- SLA presentation distinguishes `normal`, `due-soon`, `overdue`,
  `not-applicable`, and `unknown` with explicit text in addition to color. One
  shared one-second UI clock drives all rows; the separate authoritative poll
  remains every 15 seconds. Poll responses recalibrate the server-time offset,
  and visibility restore immediately recomputes local SLA before polling.
- Row order is never derived from local countdowns. The backend array remains
  authoritative, and an expired-but-not-transitioned head
  `MANUAL_CONFIRM_PENDING` fixture stays in position while blocking later FIFO
  actions until a valid authoritative snapshot moves or removes it.
- Changed files: `apps/clinic-portal/components/queue/ClinicQueueClientV2.tsx`,
  `apps/clinic-portal/tests/e2e/clinic-queue.spec.ts`, and this handoff. No new
  screen, backend route, realtime transport, role, state-machine branch,
  dependency, or migration was added.
- Validation: Node 22 Portal typecheck PASS; Node 22 production build PASS;
  focused Chromium Queue suite PASS `23/23`; backend Queue authority/integration
  gate PASS `57/57`; `git diff --check` PASS.

## Completed slice

`V50-CLINIC-02A / Clinic Appointments Registry Contract Discovery` is
`COMPLETE` as an evidence-only contract closure; production behavior is
unchanged.

- The existing Queue is confirmed as a manual-confirmation worklist, not an
  appointments registry. Owner appointment reads are owner-scoped and are not
  reusable as clinic-staff authority.
- `docs/v50/V50-CLINIC-APPOINTMENTS-REGISTRY-CONTRACT.md` now defines one future
  location-scoped, cursor-paginated, read-only list: admin/reception capability
  authority, active membership and exact scope, safe projection, upcoming and
  history ordering, cursor binding, empty-versus-technical-failure behavior,
  side-effect freedom, rollout boundary, and the focused authority/read-model
  test matrix.
- Route and parity matrices record `CONTRACT_COMPLETE / IMPLEMENTATION_MISSING`.
  No Portal route/component, backend endpoint/DTO, capability, feature flag,
  dependency, role, mutation, state machine, migration, or Queue behavior was
  changed.
- Validation: Tier B contract validator PASS after bucket-boundary, cursor
  snapshot, and evidence-traceability vetoes were resolved; `git diff --check`
  PASS. No runtime suite is applicable because this slice changes no executable
  code or public contract.

## Completed slice

`V50-CLINIC-02B / Clinic Appointments Registry Backend Read Model` is
`COMPLETE` for correctness and authority; Portal integration remains absent.

- `GET /v1/clinic/:clinicId/locations/:locationId/appointments` exposes only
  the contracted `upcoming` or `history` administrative projection. It requires
  server-derived `appointment.registry.read`, exact JWT clinic/location scopes,
  active non-revoked membership, and an active location belonging to the URL
  clinic. Receptionist/admin are granted; veterinarian and all incompatible
  authority shapes are denied without projection leakage.
- PostgreSQL owns `serverNow` and the first-page snapshot. The signed v1 cursor
  binds clinic, location, bucket, limit, snapshot, exact PostgreSQL sort
  timestamp, and appointment UUID. Keyset ordering is
  `slot.starts_at + appointment.id`; new appointments after the snapshot are
  excluded. Status changes between requests remain current-state/best-effort,
  not a cross-request MVCC snapshot.
- The projection contains appointment ID/version, mapped status code/label,
  slot times, pet display data, and optional service name. Owner contacts,
  clinical summary, payment/insurance/provider data, hold IDs, audit payloads,
  and internal timestamps are absent. Reads create no business side effects;
  technical failures remain non-200 without `items`.
- Changed production areas: capability/resource vocabulary, centralized clinic
  access method, bounded controller/service, module registration, OpenAPI
  artifact, and focused registry harness. No Queue, Portal, mutation, role enum,
  state machine, dependency, or migration changed.
- Validation: registry HTTP/PostgreSQL PASS `27/27`; capability derivation and
  evaluator PASS `26/26`; backend build PASS; OpenAPI 3.0 export/schema check
  PASS; migration checksum verify PASS. Tier B validator PASS after capability,
  OpenAPI, cursor-scope, snapshot/tie, privacy, side-effect, and strict-limit
  findings were resolved; `git diff --check` PASS.
- Performance evidence: the current schema produces sequential scans plus sort
  for the registry query. Correctness is bounded by SQL `limit + 1`, but the
  missing production-scale ordering index requires a separate migration slice.

## Next single action

`V50-CLINIC-02B1 / Clinic Appointments Registry Query Index Migration` is
`COMPLETE` as a schema/performance-only closure.

- New migration `1719450000000_add_clinic_appointments_registry_indexes.js`
  adds the minimum two-sided join path: ordered covering slots by
  `clinic_location_id + starts_at + id`, and covering appointment lookup by
  `slot_id + id`. No applied migration was edited.
- The registry SQL now repeats the requested location predicate on the joined
  slot. Valid data semantics, response projection, bucket membership, exact
  timestamp cursor and public API are unchanged; the explicit predicate enables
  the ordered access path and hardens tenant isolation at both join relations.
- A deterministic 15,000-row fixture covers timestamp ties, terminal and
  non-terminal rows, keyset page two, reverse history order, and unrelated
  location noise. Baseline used sequential scans plus a top-N sort. Post-index
  plans use both new indexes, no target-table sequential scan and no full sort;
  only bounded incremental UUID sorting within equal slot timestamps remains.
- Migration down/up preserves rows and definitions, and a post-index appointment
  write succeeds. Because the canonical runner uses one transaction,
  `CONCURRENTLY` is unavailable; the migration documents the normal
  write-blocking index-build lock and maintenance-window requirement.
- Validation: focused migration/index/query-plan suite PASS `6/6`; registry
  HTTP/PostgreSQL regression PASS `27/27`; backend build PASS; canonical
  migration down/up, data-preservation check and checksum verification PASS;
  OpenAPI no-diff; `git diff --check` PASS. Tier B validator PASS after migration
  export/history, multi-clinic isolation, bounded-plan, write-regression and
  operator-runbook vetoes were resolved.

## Next single action

`V50-CLINIC-02C / Clinic Appointments Registry Portal Integration` is
`COMPLETE` for the bounded read-only list.

- Default-off route
  `/clinics/:clinicId/locations/:locationId/appointments` uses the existing
  Clinic Portal session/effective-capability pattern. It requires
  `appointment.registry.read` and exact clinic/location scope before rendering;
  disabled rollout returns not-found and Queue remains independent.
- The scoped BFF and runtime parser preserve backend order and the exact opaque
  cursor. Upcoming/history changes, scope changes, and manual refresh abort and
  fence stale requests, clear cursor/items and start a new traversal. Load-more
  coalesces requests and appends only unique validated IDs.
- Initial loading, distinct upcoming/history empty, technical error, and
  degraded next-page states are separate. Malformed, duplicate, wrong-scope,
  cursor-error and denial payloads never become empty or replace the last valid
  snapshot. No polling or client-side bucket filtering was added.
- Responsive read-only cards show only date/time, safe administrative status,
  pet/species and optional service. Unknown status is localized safely; raw
  enums, UUIDs, cursors and unexpected sensitive fields are not rendered.
- Validation: Node 22 typecheck PASS; Node 22 production build PASS; focused
  Chromium enabled matrix PASS `24/24`; default-off page/BFF rollback PASS
  `1/1`; desktop/mobile screenshots, axe, roving-tab keyboard and 200% text
  PASS. Backend registry HTTP/PostgreSQL PASS `27/27`; OpenAPI and migrations
  unchanged; `git diff --check` PASS. Tier B validator PASS after same-scope
  refresh preservation, BFF rollback, authority, keyboard/live-region, focus,
  and validated-empty degraded-state vetoes were resolved.

## Next single action

`V50-CLINIC-02D / Clinic Appointment Detail Contract Discovery` is
`COMPLETE` as a documentation/evidence-only closure.

- `docs/v50/V50-CLINIC-APPOINTMENT-DETAIL-CONTRACT.md` defines one future
  read-only route by registry `appointmentId`, reusing
  `appointment.registry.read` with exact clinic/location capability authority,
  active non-revoked membership and normalized no-leak denial.
- The purpose-built DTO is administrative only: authoritative status/version,
  schedule/timezone/source, pet, nullable safe owner/service/veterinarian/
  resource display projections, and an empty server-authored action set.
  Clinical, financial, raw audit, contacts, integration and internal payloads
  are explicitly excluded.
- Existing Queue mutations apply to pending holds before appointment creation;
  clinical completion belongs to the veterinarian capability. Confirmed
  appointment reschedule, clinic cancellation, check-in and no-show commands do
  not exist. The contract therefore exposes no administrative action and does
  not extend the state machine.
- Administrative history is excluded until a bounded allowlisted projection is
  separately contracted. The future query is one exact-scope PK/index lookup
  with both appointment and slot location predicates and no N+1, clinical blobs
  or unbounded audit.
- Registry-to-detail refresh, strict RFC3339/impossible-date validation,
  nullable-versus-malformed rules, empty/failure behavior, focused authority,
  privacy, consistency, performance, responsive/accessibility and rollback
  matrices are fixed. The detail is a nested `CLN-004 clinic-appointments`
  state and reuses the existing default-off registry flag.
- Production code, public API/OpenAPI, migrations, flags and runtime behavior
  are unchanged. Runtime tests/build are `ABSTAIN` for this evidence-only slice;
  `git diff --check` PASS. Tier B validator PASS after exact existing mutation
  paths and shared-flag rollback semantics were clarified.

## Completed slice

`V50-CLINIC-02E / Clinic Appointment Detail Backend Read Model` is `COMPLETE`
for the backend read model; Portal integration remains absent.

- Canonical `GET /v1/clinic/:clinicId/locations/:locationId/appointments/:appointmentId`
  is the only detail route. It is protected by the shared default-off
  `VETHELP_CLINIC_APPOINTMENTS_REGISTRY` rollout flag.
- Server authority reuses `appointment.registry.read`, exact clinic/location
  JWT claims, active non-revoked membership and exact appointment/slot/location
  SQL predicates. Malformed, missing and foreign identifiers have normalized
  no-leak denial; database failures remain technical failures.
- The allowlisted administrative DTO contains authoritative status/version,
  schedule/timezone/safe source label, pet, nullable service/veterinarian/
  resource, `owner: null` (no verified display source), and
  `availableActions: []`. It excludes contacts, UUID owner fallback, clinical,
  financial, integration, audit and history payloads.
- One bounded query performs all projection joins; repeated reads are stable,
  mutations are reflected on the next read, and reads create no outbox, audit,
  idempotency, hold, slot or appointment side effects.
- Validation: focused Node 22 detail HTTP suite PASS `13/13`; existing registry
  regression PASS `27/27`; Node 22 backend build PASS; OpenAPI generation and
  assertion PASS; migration checksum verification PASS with no migration diff;
  `git diff --check` PASS. Tier B validator PASS with no veto.

## Completed slice

`V50-CLINIC-02F / Clinic Appointment Detail Portal Integration` is `COMPLETE`
for the bounded read-only administrative detail.

- The existing registry opens the single scoped route
  `/clinics/:clinicId/locations/:locationId/appointments/:appointmentId`.
  The matching scoped BFF proxies only the canonical backend detail endpoint.
- Page and BFF reuse `VETHELP_CLINIC_APPOINTMENTS_REGISTRY`, authenticated
  Clinic session, effective `appointment.registry.read`, and exact
  clinic/location scope. Disabled page and BFF are both unavailable.
- The typed parser validates exact clinic/location/appointment IDs, strict
  RFC3339 timestamps including calendar validity, nested nullable projections,
  and `availableActions: []`. Unexpected sensitive fields are dropped and
  unexpected status becomes safe `UNKNOWN`.
- The card shows authoritative status and administrative schedule/pet/service
  facts. Version remains internal; owner null becomes `Владелец не указан`.
  UUIDs, raw enums/version/actions, clinical, financial and audit data are not
  rendered.
- Manual refresh aborts the current request, preserves the last validated card
  on malformed or technical failure, and generation-fences route/scope changes.
  Loading, normalized no-leak, technical and degraded states remain distinct;
  polling was not added.
- Validation: Node 22 typecheck and production build PASS; focused Chromium
  enabled matrix PASS `23/23`; default-off page+BFF rollback PASS `1/1`;
  desktop/mobile screenshots, keyboard, axe and 200% text PASS. Backend detail
  PASS `13/13`; registry PASS `27/27`; OpenAPI, migrations/indexes, backend
  production code and Queue unchanged; `git diff --check` PASS. Tier B
  validator PASS with no veto.

## Next single action

`V50-CLINIC-03A / Clinic Patients Contract Discovery` is `COMPLETE` as a
documentation/evidence-only slice; implementation is blocked by an explicit
retention/consent decision.

- A clinic patient is not every owner pet. The only proven durable relation is
  an existing `booking_schema.appointments` row whose pet and exact active
  clinic location match. Holds, documents/import identifiers, medical records
  and unrelated pets of the same owner do not qualify.
- The registry is exact-location scoped and deduplicates one row per active pet.
  A pet may appear at multiple locations only with independent appointment
  evidence. Appointment history/status does not create duplicate rows.
- The future route is
  `GET /v1/clinic/:clinicId/locations/:locationId/patients`, protected by a new
  future `patient.admin.read`, exact claims, active non-revoked membership and
  centralized deny-by-default evaluation. It does not reuse appointment or
  clinical capabilities.
- The administrative allowlist contains pet identity/profile basics, nullable
  owner display, relationship dates and nullable last/next appointment dates.
  Safe owner display remains `null`; UUID/contact fallback is forbidden.
  Clinical, medical-document/OCR, insurance, financial, contacts, audit,
  integration payloads and unrelated owner pets are recursively excluded.
- Search is bounded pet-name prefix only after authority filtering; cursor,
  fixed snapshot, server ordering and database deduplication are contracted.
  A per-employee plus exact-scope limiter must return bounded `429` with
  `Retry-After`; its unsupported threshold is a rollout prerequisite.
  Patient detail, medical record, owner/client data and mutations remain
  separate future slices.
- A separate future default-off patients flag is required, but no production
  flag was added.
- Current schema has no clinic–pet association lifecycle, consent/revocation
  record, legal retention duration, owner-deletion policy or imported-patient
  authority. These are an explicit production/rollout blocker; no duration or
  deletion behavior was invented.
- Runtime tests/build: `ABSTAIN` because production code, public API, OpenAPI,
  migrations, roles and flags are unchanged. Documentation consistency and
  `git diff --check` PASS. Tier B contract validator PASS with no veto.

## Next single action

`V50-CLINIC-03A1 / Clinic Patient Retention and Consent Decision` is `COMPLETE`
as a documentation/decision-only slice.

- The MVP storage decision is hybrid: a confirmed exact-location appointment is
  provenance, while registry visibility is served from a versioned association
  carrying lifecycle and purpose-specific consent. Pure appointment derivation
  and manually maintained association options were rejected.
- Lifecycle is `ACTIVE`, `ARCHIVED` or `REVOKED`. Pending/declined/expired holds
  create nothing. Completion/no-show refresh relationship evidence;
  cancellation remains visible only inside the configured window; owner
  deletion or consent revocation removes operational visibility immediately.
- Consent purpose is `PATIENT_ADMIN_REGISTRY`, exact clinic/location/pet scoped
  and separate from appointment performance, clinical records, communications
  and cross-location sharing. Missing/expired/revoked evidence denies
  association activation and search server-side.
- Pet archival archives the relation. Owner deletion/anonymization revokes it
  and owner display remains null. New ownership/consent is required for
  reactivation; historical medical/audit retention does not authorize registry
  visibility.
- Location associations are independent. A move creates/activates B only with
  B-scoped consent and archives A when no other qualifying evidence remains.
  Multi-location admins still request one exact location.
- Imported-only, manual, medical-only, insurance, owner-share and platform
  telemedicine sources remain excluded. Future import/manual support requires
  its own provenance/write/revocation contract.
- Operational visibility duration and search threshold/window are installation
  policies with named owners. Missing visibility config closes the registry
  with bounded `503`; missing search config closes search with bounded `503`.
  Search limiting is employee+clinic+location keyed, returns bounded `429` and
  `Retry-After`, logs no query/PII and has no production bypass.
- Backend readiness verdict: `BLOCKED` by exactly one prerequisite,
  `V50-CLINIC-03A2 / Clinic Patient Association Schema Contract`, owned by
  CTO/Architecture. Product/legal numeric policies block activation but do not
  block the schema contract.
- Runtime tests/build: `ABSTAIN`; production/API/OpenAPI/migrations/roles/flags
  are unchanged. Documentation consistency and `git diff --check` PASS. Tier B
  decision validator PASS with no veto.

## V50-CLINIC-03A2 completed slice

`V50-CLINIC-03A2 / Clinic Patient Association Schema Contract` is `COMPLETE`
as a documentation/schema-contract-only slice.

- `ClinicPatientAssociation` is an exact clinic/location/pet administrative
  relation, not Pet master, owner, medical, appointment or CRM storage.
- The canonical contract defines `clinic_patient_associations`, a separate
  bounded consent record, projection event receipts and immutable registry
  revisions. Stable association identity and natural uniqueness are
  `(clinic_id, clinic_location_id, pet_id)`.
- Lifecycle is `ACTIVE`, `ARCHIVED`, `REVOKED`; version-fenced writers,
  deterministic lock order and semantic event receipts make creation and
  refresh idempotent. Revocation wins over stale refresh, and reactivation
  requires a new consent plus new qualifying appointment.
- Database checks cover immutable row-local facts only. Consent/policy expiry
  uses PostgreSQL `serverNow` at runtime; no `now()`/volatile partial index or
  check is permitted. Missing configuration remains bounded `503`.
- Finite `visibility_expires_at` prevents indefinite operational visibility.
  FK actions are non-cascading; storage and outbox exclude pet display data,
  owner contacts, raw consent and medical/financial/integration facts.
- Registry ordering remains `last_qualified_at DESC, pet_id DESC`. Immutable
  association revisions and `snapshotSequence` preserve authoritative
  cross-page ordering while live revoke/expiry still denies immediately.
- Migration ordering, lock boundaries, transactional versus concurrent index
  handling, forward-only post-write rollback and a deny-default zero-write
  historical backfill are fixed.
- Backend readiness is `READY_FOR_MIGRATION`. Product/legal/security policy
  values remain activation gates, not migration blockers.
- Runtime tests/build: `ABSTAIN`; no production code, migration, API, OpenAPI,
  role or flag changed.

## V50-CLINIC-03A3 completed slice

`V50-CLINIC-03A3 / Clinic Patient Association Schema Migration` is `COMPLETE`.

- Migration `1719460000000_add_clinic_patient_association_schema.js` creates
  four empty bounded structures: purpose-specific consent, current
  association, semantic event receipt and immutable registry revision, plus
  the owned monotonic revision sequence.
- Exact `(clinic_id, clinic_location_id, pet_id)` uniqueness, lifecycle/source,
  positive versions, consent purpose/date/revocation consistency and
  non-cascading FK behavior are database-enforced. Association/revision consent
  references use a composite exact-scope FK.
- Appointment pet/location and location clinic equality remain explicit future
  write-path invariants because applied master tables have no matching
  composite candidate keys; no applied migration or master table was changed.
- Registry, consent, idempotency and revision indexes match the canonical
  query families. No volatile-time check/partial index, speculative covering
  index, JSON payload or PII/medical/contact/financial storage was added.
- Migration is transactional over initially empty tables, performs no
  historical activation or consent synthesis, emits no outbox events, and
  leaves API/producer/Portal/roles/flags absent.
- Focused schema integration: 7/7 PASS, including concurrent natural-key
  insertion, receipt/revision uniqueness, catalog/privacy inspection,
  existing-row preservation and explicit down/reapply.
- Migration checksum verification, backend Node 22 build, appointments registry
  index compatibility and appointment detail regression PASS.
- Readiness is `SCHEMA_IMPLEMENTED / API_PRODUCER_PORTAL_MISSING`. Production
  activation remains blocked by product/legal/security configuration.

## V50-CLINIC-03A4 completed slice

`V50-CLINIC-03A4 / Clinic Patient Association Lifecycle Write Path` is
`COMPLETE`.

- Internal `ClinicPatientAssociationLifecycleService` implements appointment
  activation/refresh, pet archive, consent/privacy revoke and new-evidence
  reactivation without a controller or public route.
- Every operation uses the same transaction-scoped advisory key derived from
  canonical tenant/clinic/location/pet UUIDs. Appointment, pet, location and
  clinic equality is proven by exact SQL predicates before any write.
- `PATIENT_ADMIN_REGISTRY` consent is exact-scope, DB-time valid and locked.
  Missing/invalid visibility policy fails closed; operational visibility is
  finite and derived from authoritative appointment `created_at`.
- Stable association identity, optimistic versions, semantic receipts,
  immutable revisions and the existing shared outbox commit atomically.
  Replays and expected unique races are controlled no-ops.
- Privacy revoke accepts a stale lower expected version intentionally: after a
  racing refresh it applies to the newer row, while refresh after revoke sees a
  version/consent failure. Delayed old evidence cannot reactivate; a new consent
  and newer appointment are mandatory.
- Focused PostgreSQL lifecycle suite: 11/11 PASS, covering durable replay,
  scope isolation,
  qualifying evidence, policy/consent denial, replay, same/different-scope
  concurrency, refresh, archive, revoke race, reactivation and forced rollback.
- Schema suite remains 7/7 PASS; migration checksum and backend build PASS.
- No producer wiring, Patients Registry API, Portal, OpenAPI, capability, role,
  feature flag, migration or Queue behavior changed.
- Status is `SCHEMA_AND_LIFECYCLE_IMPLEMENTED / REGISTRY_API_PORTAL_MISSING`.
  Product/legal/security configuration still blocks production activation.

## V50-CLINIC-03A5 completed slice

`V50-CLINIC-03A5 / Clinic Patient Association Appointment Producer Wiring` is
`COMPLETE`.

- The authoritative Level-C manual clinic-confirmation transaction now passes
  its newly created appointment and committed appointment-event identity to
  `ClinicPatientAssociationLifecycleService` through the same `PoolClient`.
- Producer scope is derived from locked hold/slot/location and current database
  rows, never from a new public payload. The lifecycle service repeats exact
  appointment/pet/location/clinic/tenant validation.
- The durable semantic source ID is `appointment_events.id`; appointment ID and
  version are authoritative. HTTP idempotency replay and concurrent confirm
  cannot create a second appointment or lifecycle effect.
- Producer selects only an exact-scope, DB-time-valid
  `PATIENT_ADMIN_REGISTRY` consent. Missing/expired/revoked consent is expected
  non-activation: appointment confirmation and booking outbox commit, while no
  association/receipt/revision/association-outbox row is written.
- Lifecycle success commits appointment, appointment event, booking outbox,
  association, receipt, revision and association outbox atomically. A technical
  lifecycle failure rolls the complete confirmation transaction back.
- Focused producer wiring suite: 4/4 PASS. Lifecycle plus affected Queue
  regression: 17/17 PASS. Migration checksum and backend Node 22 build PASS.
- Completion, no-show, cancellation, reschedule, location move, pet archive,
  owner deletion, consent revoke and consent-later reconciliation remain
  intentionally unwired. No historical backfill is introduced.
- No Patients Registry API, Portal, OpenAPI, capability, role, feature flag,
  migration or Queue response/UX contract changed.
- Status is `SCHEMA_LIFECYCLE_PRODUCER_IMPLEMENTED /
  REGISTRY_API_PORTAL_MISSING`. Product/legal/security configuration still
  blocks production activation.

## Next single action

`V50-CLINIC-03B / Clinic Patients Backend Read Model` is `COMPLETE`.

- Added the single canonical
  `GET /v1/clinic/:clinicId/locations/:locationId/patients` route under the
  default-off `VETHELP_CLINIC_PATIENTS_REGISTRY` backend flag.
- Added `patient.admin.read` for receptionist and clinic admin only. The
  centralized evaluator still requires exact clinic/location claims and active,
  non-revoked location membership; veterinarian access is not inferred.
- Inclusion is driven by versioned association revisions with current
  association, purpose-specific consent, pet archival and configured visibility
  policy checked at DB time. Appointments provide only administrative
  first/last/next aggregates and never determine inclusion.
- The response is restricted to the documented administrative allowlist;
  owner display remains `null`, and owner identifiers/contacts, clinical,
  financial, consent and lifecycle internals are absent.
- Unicode NFKC pet-name prefix search is bounded to 2..80 code points and uses
  an employee+clinic+location rate bucket before the patient query. Missing
  search policy fails closed; `429` includes `Retry-After`. Because the
  repository has no shared limiter primitive and this slice forbids a Redis or
  schema addition, the bounded process-local limiter is explicitly disabled in
  `NODE_ENV=production`; production search remains fail-closed until an
  approved shared platform limiter is configured.
- Signed keyset cursors bind scope, normalized search, limit, revision snapshot,
  last-seen key and patient ID. PostgreSQL owns ordering and time boundaries;
  current revocation overrides an older snapshot.
- Focused Patients HTTP/PostgreSQL suite is 8/8 PASS, including a mirrored full
  registry-query `EXPLAIN (ANALYZE, BUFFERS)` over 120 additional associations.
  Producer/lifecycle/capability regressions are 44/44 PASS. Node 22.23.1 build,
  OpenAPI export/schema assertion, migration checksum/order verification and
  `git diff --check` PASS.
- `V50-CLINIC-03C / Clinic Patients Portal Integration` is `COMPLETE`.
  The single scoped page and BFF use the same default-off Patients flag,
  authenticated Clinic session, `patient.admin.read` and exact effective
  clinic/location scope before forwarding to the backend.
- The Portal runtime parser validates exact scope, UUIDs, nullable projection,
  strict timestamps/calendar dates, enums and duplicate IDs. It renders only
  the administrative allowlist and never creates patient-detail navigation.
- Prefix search uses NFKC preparation, 350 ms debounce, abort and generation
  fencing. Production-search `503` and `429` preserve the last valid snapshot;
  cursor pagination and manual refresh preserve backend ordering and never
  decode the opaque cursor.
- Focused Chromium is 9/9 enabled PASS plus 1/1 default-off rollback PASS,
  including axe, keyboard, 200% text and desktop/mobile screenshot attachments.
  Node 22.23.1 Portal typecheck/build and backend Patients 8/8 regression PASS.
  Backend production/OpenAPI/migrations/Queue/Appointments Portal are unchanged.
- Status is `PATIENTS REGISTRY END_TO_END READ IMPLEMENTED; PATIENT DETAIL /
  MUTATIONS / OTHER PRODUCERS MISSING; PRODUCTION ACTIVATION BLOCKED BY LIMITER
  AND POLICY APPROVALS`.

## Next single action

`V50-CLINIC-04A / Clinic Patient Detail Contract Discovery` is `COMPLETE`.

- Canonical contract:
  `docs/v50/V50-CLINIC-PATIENT-DETAIL-CONTRACT.md`.
- Readiness is `READY_FOR_ADMIN_DETAIL_BACKEND`.
- Public resource identity remains the Registry `patientId` (existing pet UUID);
  every lookup must also prove a current visible exact clinic/location
  association. No association ID, new opaque ID or migration is justified.
- Recommended backend route is
  `GET /v1/clinic/:clinicId/locations/:locationId/patients/:patientId`.
- Administrative detail reuses `patient.admin.read` for receptionist/admin and
  multi-role employees with the effective capability; veterinarian-only,
  platform and owner actors are denied.
- The allowlist contains safe pet identity, nullable owner display, relationship
  timestamps and bounded last/next/ten recent administrative appointment
  summaries. Owner contacts/IDs, clinical, document, financial and internal
  lifecycle fields are recursively excluded.
- Current revoke/expiry/archive overrides stale Registry links. Registry
  traversal snapshots do not authorize detail; detail is a no-store
  current-state read.
- Existing visit workspace remains visit-specific. Longitudinal clinical
  history, assignment, break-glass, documents, per-view audit and legal
  retention require a separate clinical policy decision and do not block the
  separable administrative detail.
- No production code, Portal, OpenAPI, migration, flag, role/capability or Queue
  change is part of `04A`.
- Status is `PATIENT ADMINISTRATIVE DETAIL CONTRACT READY; BACKEND / PORTAL NOT
  IMPLEMENTED; CLINICAL PATIENT RECORD REMAINS SEPARATE; PRODUCTION ACTIVATION
  STILL BLOCKED BY POLICY APPROVALS`.

## Next single action

`V50-CLINIC-04B / Clinic Patient Administrative Detail Backend` is `COMPLETE`.

- Implemented canonical default-off
  `GET /v1/clinic/:clinicId/locations/:locationId/patients/:patientId`.
- The backend reuses `VETHELP_CLINIC_PATIENTS_REGISTRY` and
  `patient.admin.read`; active exact clinic/location membership remains
  authoritative. No capability, role or flag mapping changed.
- Pet UUID resolves only through the current active exact-scope association,
  valid `PATIENT_ADMIN_REGISTRY` consent, current visibility policy and
  unarchived pet. Malformed, absent, foreign, revoked, expired, archived and
  stale resources use bounded no-leak outcomes.
- Response is `no-store, private` and contains only safe pet identity, nullable
  owner display, relationship timestamps and last/next/at most ten recent
  deterministic exact-location administrative appointment summaries.
- Runtime mapping validates UUIDs, enums, nullable display fields, RFC3339
  timestamps, calendar dates, duplicate/bounded appointments and required pet
  fields. Malformed rows and database failures never become partial success.
- Patient Detail PostgreSQL/HTTP is 8/8 PASS; Patients Registry is 8/8 PASS.
  Node 22 backend build, OpenAPI export/route-schema assertion, migration
  checksum and `git diff --check` PASS. Actual-query EXPLAIN is bounded with no
  spill. Portal, migrations, Queue, appointment Portal and clinical surfaces
  are unchanged.
- Status is `PATIENT ADMINISTRATIVE DETAIL BACKEND IMPLEMENTED; PORTAL DETAIL
  NOT IMPLEMENTED; CLINICAL PATIENT RECORD REMAINS SEPARATE; PRODUCTION
  ACTIVATION BLOCKED BY POLICY APPROVALS`.

### `V50-CLINIC-04C / Clinic Patient Administrative Detail Portal Integration`

`COMPLETE`.

- One scoped Portal page, cookie-session BFF and strict runtime parser expose
  only the administrative detail allowlist. Registry rows/cards navigate to
  the exact clinic/location patient path under the existing default-off
  Patients flag.
- Deep links and refreshes remain backend-authoritative. Malformed or technical
  refresh failure preserves the last valid snapshot; policy denial and current
  association/consent revocation do not leak stale patient data.
- Focused Patient Detail Chromium is 7/7 PASS; Patients Registry navigation is
  9/9 PASS; default-off rollback is 1/1 PASS. Keyboard, axe, reduced motion,
  200% text and desktop/mobile evidence pass.
- Node 22.22.2 Portal typecheck and production build PASS.
- Docker Desktop was safely restarted after its stale server socket prevented
  the closure regressions. The canonical `vethelp-alpha` backend was restarted
  once with workers disabled for the bounded test process; no volume or project
  data was deleted. Patient Detail PostgreSQL/HTTP is 8/8 PASS and Patients
  Registry PostgreSQL/HTTP is 8/8 PASS.
- Tier B diff-first validation is PASS. Backend production code, OpenAPI,
  migrations, capabilities, roles, flags, Queue, association lifecycle and
  clinical surfaces have no implementation diff.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04D / Clinic Patient Administrative Mutations Contract Discovery`

`COMPLETE / CONTRACT_ONLY`.

- `V50-CLINIC-PATIENT-ADMIN-MUTATIONS-CONTRACT.md` divides patient data into
  owner-owned master data, clinic-location-local administrative projection,
  Clinical domain data and separate association/privacy lifecycle commands.
- Direct clinic mutation is limited to normalized local alias, structured
  administrative reference and bounded enum labels. The first backend slice is
  alias-only. Free-form notes and clinical/contact/document/financial fields
  are forbidden.
- Pet name/species/breed/sex/birth-date changes are correction requests with
  owner confirmation, never direct master-profile updates. Avatar and owner
  identity/contact changes remain outside this administrative contract.
- Archive/reactivate/merge/transfer, consent and privacy actions require
  separate capability and state-machine contracts.
- `patient.admin.read` never grants writes. Future direct writes require new
  exact-scope `patient.admin.local-profile.update`; correction requests require
  a separate future capability. Runtime mappings are unchanged.
- Direct commands require `If-Match`, UUID `Idempotency-Key`, current
  association/consent/policy revalidation, normalized no-leak errors and
  transactional safe audit/outbox.
- Recommended rollout combines the existing Patients Registry flag with a new
  independent default-off `VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS`; no runtime
  flag is added here and read-only Registry/Detail remain available on rollback.
- This is documentation-only: product suites ABSTAIN; no backend, OpenAPI,
  migration, capability/role runtime, feature-flag runtime or Portal change.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04E / Clinic Patient Local Administrative Profile Mutation Backend`

`COMPLETE / BACKEND_IMPLEMENTED`.

- Implemented exact-scope `PATCH
  /v1/clinic/:clinicId/locations/:locationId/patients/:patientId/local-profile`
  for alias set, replace and clear only.
- Strict request accepts only `alias: string | null`; non-null values are
  NFC-normalized, trimmed, 1..80 Unicode code points and reject newline/control
  characters. Response is limited to exact scope, alias, version and timestamp.
- Added the minimal `clinic_patient_local_profiles` table with exact
  clinic/location/patient uniqueness, nullable alias, association FK,
  monotonic aggregate version and reversible down migration. No JSON metadata,
  reference, labels, notes or owner/clinical columns were added.
- Added `patient.admin.local-profile.update` for receptionist/admin role
  mappings through the existing capability evaluator. `patient.admin.read`
  alone remains insufficient; veterinarian-only, foreign/inactive and
  invisible scopes are denied.
- Every command rechecks current membership, exact scope, association,
  consent/privacy policy and feature flag. `If-Match` and UUID
  `Idempotency-Key` are mandatory; replay is stable and payload mismatch is
  `IDEMPOTENCY_KEY_REUSED`.
- Alias/version, idempotency result, safe audit and outbox are one PostgreSQL
  transaction. Audit/outbox contain only field marker and SET/CLEAR, never the
  alias value.
- Added independent default-off
  `VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS`; Registry/Detail reads remain
  available when it is off. Portal production is unchanged.
- Focused alias HTTP/PostgreSQL is 12/12 PASS covering E-01..E-28 plus
  same-value versioning, concurrent stale-writer exclusion, forced
  transactional rollback and exact-scope uniqueness. Capability
  tests are 35/35 PASS; Patient Detail and Registry regressions are 8/8 PASS
  each. Migration verification, backend build and generated OpenAPI export
  PASS.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04E1 / Clinic Patient Local Alias Read Projection Repair`

`COMPLETE`.

- Patient Detail now always returns exact-scope `patient.localProfile` with
  required `alias`, `aggregateVersion` and `updatedAt`.
- No local-profile row is authoritative `alias=null`, version `0`,
  `updatedAt=null`; a cleared row is null alias with positive version and
  non-null timestamp. Portal never guesses the initial version.
- The Detail query joins the existing local profile only by clinic, location
  and patient after current membership, association, consent and privacy
  authority. Reads do not create rows, audit, outbox or idempotency effects.
- Read projection remains available when
  `VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS=false`; write rollout does not control
  read authority.
- Create `0→1`, replace `N→N+1`, clear and stale-conflict refresh compatibility
  are proven against the existing mutation endpoint. Mutation semantics,
  storage, capability and flags are unchanged.
- Generated OpenAPI requires a strict three-field projection with version
  minimum zero and nullable alias/timestamp. Portal typed parser requires the
  field, distinguishes absent/cleared states and rejects missing, negative,
  fractional, malformed and extra data without fallback synthesis.
- Patient Detail backend is 11/11 PASS; Registry is 8/8 PASS; Portal parser
  contract is 3/3 PASS covering E1-P01..P11. Backend build/OpenAPI export and
  Node 22.22.2 Portal typecheck PASS.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04F / Clinic Patient Local Alias Portal Integration`

`COMPLETE / PORTAL_IMPLEMENTED`.

- The existing Patient Detail page keeps the official pet name as its heading
  and renders a separate `Имя в клинике` block with `Не задано` for null and
  an explicit internal-only explanation.
- Read presentation remains available with mutations disabled. Editing requires
  `VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS`, effective
  `patient.admin.local-profile.update`, exact clinic/location scope and an
  authoritative Detail aggregate version.
- The compact accessible dialog supports set, replace and explicit clear.
  Client validation applies NFC, trim, 1..80 Unicode code points and rejects
  blank, newline and control/format input; null is sent only by clear.
- The bounded cookie-session BFF forwards a strong quoted `If-Match` and UUID
  `Idempotency-Key`. Technical retry reuses the key only for the same normalized
  scoped intent; payload/operation/scope changes and success start a new intent.
- Strict success parsing prevents malformed payloads from replacing the last
  valid snapshot. Stale/association conflict refreshes Detail without automatic
  resubmit; 403 removes write control; no-leak 404 clears the snapshot; policy,
  network and 5xx failures preserve confirmed read data.
- Focused grouped Playwright evidence maps F-01..F-30, with existing Patient
  Detail/Registry, mutation rollback, parser contract, Node 22 typecheck/build,
  diff audits and Tier B validation recorded in the slice handoff.
- Backend, migrations, OpenAPI, roles, state machines, Registry mutation,
  Owner Mobile, Queue, booking, clinical surfaces and new screens are unchanged.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04G / Clinic Patient Structured Administrative Reference Contract Refinement`

`COMPLETE / DOCUMENTATION_ONLY`.

- Defined one nullable `Clinic Patient Administrative Reference` owned by the
  exact clinic/location local administrative profile, never owner/clinical or
  global identity.
- MVP source is implicit `CLINIC_MANUAL`; format is NFC, trimmed, collapsed
  spaces, 1..40 structured Unicode code points. Display case is retained while
  a pinned Unicode Default Case Folding comparison key owns uniqueness.
- The normalized key is unique only within exact clinic/location; cross-location
  and cross-clinic reuse is allowed. Collision is bounded
  `ADMINISTRATIVE_REFERENCE_ALREADY_IN_USE` without patient disclosure.
- Patient Detail will carry required nullable `administrativeReference`;
  Registry remains unchanged. Alias and reference share one local-profile
  aggregate version.
- The future bounded route is
  `PATCH .../patients/:patientId/local-profile/reference`, reusing
  `patient.admin.local-profile.update`,
  `VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS`, strong `If-Match`, UUID
  idempotency and existing exact-scope privacy authority.
- Audit/outbox never store raw reference values. Archive/revoke hides the
  reference immediately; clear releases uniqueness while audit remains.
  Search is future exact normalized match only after authority and visibility.
- The G-01..G-30 future backend matrix is fixed. No runtime code, migrations,
  OpenAPI, Portal, Registry, capability/flag runtime or product tests changed.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04K / Clinic Patient Administrative Reference Registry Search Backend`

`COMPLETE / BACKEND_IMPLEMENTED`.

- The existing exact-location Registry endpoint accepts an exclusive
  `administrativeReference` query behind the independent default-off
  `VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH` flag. Ordinary Registry
  behavior and ordering remain unchanged.
- Strict whole-query validation reuses the pinned Unicode 17 administrative
  reference normalizer. Malformed values and incompatible filters fail before
  lookup; exact mode retains the canonical envelope with 0..1 items and no
  cursor.
- Existing `patient.admin.read`, active membership, exact clinic/location and
  current association/consent/privacy qualification constrain the same bounded
  SQL query before reference matching. Foreign and ineligible matches are
  indistinguishable empty results.
- Registry/OpenAPI items require nullable display `administrativeReference`;
  the comparison key and local-profile internals are never projected. Corrupt
  duplicate results fail closed with `SEARCH_INVARIANT_VIOLATION`.
- The existing scoped unique B-tree is reused with representative-volume
  indexed EXPLAIN proof; there is no migration, N+1, mutation audit/outbox,
  idempotency or other read side effect.
- Focused Registry PostgreSQL/HTTP PASS `14/14`; Detail, reference mutation,
  alias mutation and capability/evaluator regressions PASS `72/72` after the
  intentional nullable Registry projection update; backend build/OpenAPI
  export PASS; strict Portal parser PASS `2/2`; Node 22.22.2 typecheck PASS.
  Portal search UI remains excluded.

Execution verdict: `PASS / COMPLETE`.

## Next single action

### `V50-CLINIC-04H / Clinic Patient Structured Administrative Reference Backend`

`COMPLETE / BACKEND_IMPLEMENTED`.

- Added nullable reference display/key columns and exact clinic/location partial
  uniqueness to the existing local-profile row; migration is additive,
  reversible and requires no backfill/version change.
- Normalization is dependency-free and pinned to official Unicode 17.0.0 full
  default Case Folding: NFC, trim/space collapse, structured 1..40 code points,
  display-case preservation and locale-independent comparison key.
- Implemented strict `PATCH .../local-profile/reference` with set/replace/clear,
  existing capability/flag/current visibility authority, strong `If-Match`,
  scoped UUID idempotency and normalized collision error.
- Alias/reference share one aggregate version. Mutation, safe audit/outbox and
  idempotency result are transactional; raw display/key never enters audit or
  outbox.
- Patient Detail/OpenAPI require nullable `administrativeReference`; reads stay
  side-effect free and flag-independent. Portal parser/types/fixtures accept
  the field without display/editor changes. Registry remains unchanged.
- Focused reference matrix H-01..H-33, alias/Detail/Registry/capability
  regressions, migration verification, backend build/OpenAPI, parser contract,
  Node 22 typecheck and Tier B validation are the release gates.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04I / Clinic Patient Structured Administrative Reference Portal Integration`

`COMPLETE / PORTAL_IMPLEMENTED`.

- Existing Patient Detail renders the location-scoped **Внутренний номер**
  separately from official name and clinic-local alias, with explicit
  non-medical/non-global helper text and a read-only absent state.
- The existing capability/flag-gated workflow supports set, replace and
  explicit clear through a bounded cookie-session BFF. Client normalization is
  display-only; the backend remains authoritative for comparison/uniqueness.
- Alias and reference share one aggregate version and one pending UI lock.
  Strong `If-Match`, scoped UUID idempotency, strict success parsing and
  no-optimistic-update preserve concurrency and retry invariants.
- Collision is field-local and no-leak. Stale refreshes Detail without
  resubmit; 403 removes both controls; 404 clears the snapshot; policy,
  transport, 5xx and malformed success retain the last valid snapshot.
- Focused Portal coverage maps I-01..I-34 including keyboard/focus, axe and
  1440/1024/390 responsive proofs. Backend and Registry production surfaces are
  unchanged.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04J / Clinic Patient Administrative Reference Registry Search Contract Discovery`

`COMPLETE / DOCUMENTATION_ONLY`.

- Selected one exclusive exact-normalized `administrativeReference` query on
  the existing clinic/location Registry route; no lookup endpoint, prefix,
  contains, fuzzy, global or cross-location search.
- Existing authentication, active membership, exact scope,
  `patient.admin.read` and current association/consent/privacy qualification
  precede matching. Unknown, foreign and inaccessible references are identical
  `200` empty envelopes.
- Future Registry items add required nullable display reference only. Exact
  search retains the canonical envelope, returns 0..1 item, never creates a
  cursor and rejects cursor/other semantic filter combinations.
- Search reuses the Unicode 17 mutation normalizer and existing scoped partial
  unique B-tree. Representative-volume EXPLAIN, no scan/N+1/raw-query logging,
  safe invariant failure and a dedicated default-off read/search flag are
  mandatory implementation gates.
- J-01..J-32 define the future PostgreSQL/HTTP/parser/rollback matrix. No
  runtime, migration, OpenAPI, Portal, tests, packages or flags changed.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04L / Clinic Patient Administrative Reference Registry Search Portal Integration`

`COMPLETE / PORTAL_IMPLEMENTED`.

- Existing Patients Registry exposes a distinct **Внутренний номер** mode only
  under `VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH`; ordinary name-prefix
  search remains the default and works when the flag is off.
- Input is NFC-normalized, trimmed, ASCII-space collapsed, validated as 1..40
  structured Unicode code points and explicitly submitted. The typed BFF sends
  exact `administrativeReference` with current scope and canonical limit, never
  `q` or cursor.
- One result uses the canonical card with nullable display reference. Empty
  results are neutral. Authority failures clear result data; policy, invariant,
  network and malformed failures preserve the last valid snapshot and allow
  explicit retry.
- Abort/generation fencing covers double submit, clear and scope changes.
  Rollback removes the mode without affecting ordinary Registry, Patient
  Detail or local-profile mutations.
- Focused Chromium coverage maps L-01..L-34: enabled Registry cases PASS,
  affected validation/authority proofs PASS, and independent flag-off rollback
  PASS. Patient Detail/alias/reference regression PASS `20/20`; Registry parser
  PASS `2/2`; Node 22.22.2 typecheck and enabled/disabled builds PASS. Axe and
  1440/1024/390 responsive proofs pass.
- Portal-only: backend, migrations, OpenAPI, backend DTO/service and unrelated
  product areas are unchanged.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04M / Clinic Patient Administrative Reference Registry Search Operational Hardening`

`COMPLETE / DOCUMENTATION_ONLY`.

- Added
  `docs/v50/V50-CLINIC-PATIENT-ADMIN-REFERENCE-SEARCH-OPERATIONS-CONTRACT.md`
  with the complete privacy/threat/rate-limit/abuse/telemetry/performance/
  rollout/incident/support contract and no unresolved decisions.
- Current production gaps are proven: the existing limiter is process-local,
  single-window and shared with ordinary search; there is no approved
  search-safe telemetry/redaction contract or durable representative-volume
  semantic EXPLAIN cadence.
- Chosen production limiter is exact-search-only and replica-safe, keyed by
  safe actor + clinic + location + search type after authority and before the
  reference query. Initial configurable evidence values are 20/minute and
  200/hour; aggregate location protection is alert-first.
- Fixed 11-value no-leak outcome taxonomy, low-cardinality metrics/tracing and
  access-log query redaction. Raw/normalized reference, comparison key and
  patient data are forbidden. No fingerprint is stored in MVP because no
  approved separate HMAC key lifecycle exists.
- Controlled pre-production thresholds are p95 <=150 ms and observed p99
  <=300 ms, not production SLA. Relevant PRs use 10k rows; nightly uses 100k+
  with semantic `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, scoped index,
  no-local-profile-Seq-Scan and no-N+1 assertions.
- Five rollout stages, flag-only rollback, bounded alerts, invariant response,
  safe support diagnostics, ownership/runbook and M-01..M-32 future proofs are
  complete. A separate broad security slice is unnecessary; 04N receives
  bounded security validation.
- Documentation-only: runtime, backend, Portal, OpenAPI, migrations, flags,
  tests, packages and observability implementation are unchanged.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04M-R1 / Shared Rate Limiter Retention Contract Repair`

`COMPLETE / DOCUMENTATION_ONLY`.

- The earlier 04N-A attempt correctly stopped because application workers
  cannot prove hard physical deletion within 65 minutes while every backend
  replica is down and no database-resident scheduler exists.
- The corrected contract separates strict database-time logical expiry from
  physical deletion. Effective limiter state expires within 3,900 seconds and
  cannot affect consume or Retry-After afterward, independently of cleanup.
- Expired rows target physical deletion within 86,400 seconds while the
  existing application maintenance loop is healthy. Cleanup runs at startup
  and every 900 seconds by default in indexed, idempotent batches of at most
  1,000 rows. A total backend outage may temporarily exceed the physical
  target; expired counters never reactivate after recovery.
- Typed configuration, safe backlog/cleanup alerts and R-01..R-14 future
  proofs are fixed. Limiter identity dimensions and all
  reference/patient/query data are forbidden from alert payloads.
- Runtime, backend, Portal, migrations, packages, flags and tests are
  unchanged.

Execution verdict: `PASS / COMPLETE`.

### `V50-CLINIC-04N-A / Shared Replica-Safe PostgreSQL Rate Limiter Foundation`

`COMPLETE / TESTED`.

- Added one reversible additive migration for bounded fixed-window state with
  a unique scope/window identity and indexed expiry cleanup.
- The shared platform service uses one database timestamp and a transactional,
  set-based atomic upsert for all sorted policies. Blocked attempts commit;
  allowed/denied and Retry-After derive from one returned database snapshot.
- Logical expiry is at most 3,900 seconds and independent of deletion.
  Startup/periodic application cleanup uses PostgreSQL time, `SKIP LOCKED` and
  batches of at most 1,000, with at most ten transactions per catch-up run,
  toward the healthy-worker 24-hour physical target.
- Database failures fail closed through a typed internal error. Aggregate
  telemetry and logs exclude actor/scope keys, reference/query and row data.
- A dedicated bounded limiter pool isolates expected hot-row contention from
  the ordinary application database pool and its 700 ms acquisition policy.
- The Registry endpoint and its legacy process-local limiter remain unchanged.
- Validation: PostgreSQL 16.14 foundation suite PASS `16/16`, including
  100-call multi-instance concurrency, migration UP/DOWN/DOWN-UP,
  representative 5,000-row unique/cleanup plan evidence, bounded cleanup and
  lifecycle shutdown. Existing Registry/reference suites PASS `28/28`; Node
  22.23.1 backend build and migration checksum verification PASS.
- Independent security/concurrency and business-continuity reviewers PASS
  after fixes for next-admissible multi-policy Retry-After, bounded catch-up
  saturation/startup proofs and dedicated limiter-pool isolation. No veto
  remains.

Execution verdict: `PASS / COMPLETE`.

### `V50-LOCAL-RICH-DEMO-SEC-01 / Rich Demo Verification, Authority Matrix and Session Security Repair`

`PASS / COMPLETE`.

- Removed bearer JWT creation and token-bearing query URLs from local demo
  artifacts. Login now uses a same-origin POST issue/exchange protocol with a
  45-second cryptographically random one-time code, hash-at-rest storage and
  atomic consume.
- The server owns the bounded return route and validates exact backend
  effective subject, roles and clinic/location scopes before setting a
  30-minute HttpOnly, SameSite=Strict cookie.
- The membership verifier now proves exact fixture-set equality including
  inactive/revoked rows. The session verifier uses effective authority and
  actual queue/visits BFF JSON contracts rather than HTML markers.
- The canonical launcher enforces private permissions, lifecycle cleanup,
  authority/membership verification and bearer-artifact scanning.
- Security rules and verification invariants are fixed in
  `docs/v50/V50-LOCAL-RICH-DEMO-SESSION-SECURITY-CONTRACT.md`.

- Canonical Docker-backed validation passed after one graceful Docker Desktop
  recovery with all PostgreSQL volumes preserved. Exact memberships passed
  12/12 and all 12 effective-session profiles passed real queue/visits BFF
  verification.
- Live security validation passed four invalid origins, four unsafe return
  paths, three negative authorities, one-success/nine-denial concurrent
  consume, replay denial and real 45-second expiry with zero 5xx.
- Generated artifacts contain no persistent bearer/JWT/code/session URL
  material. Managed directory and file modes are `0700` and `0600`.
- Focused cleanup validation covers startup, shutdown, controlled failure and
  idempotency without stopping Docker or Portal. It preserves seed, logs,
  PIDs, unrelated managed files and an outside sentinel, rejects unsafe cleanup
  targets and has zero symlink escape or broad deletion.
- The final managed-runtime scan found zero bearer, access/refresh token,
  JWT, token-bearing session URL, login-code query or cookie matches after one
  bounded cleanup repair of three historical diagnostic logs. All four managed
  directories are `0700`; all 13 persistent files are `0600`, with zero
  group/world-readable files.
- Focused `vet-therapist` validation returned six strict visits and denied
  sequential replay. Cross-clinic queue, cross-location queue, veterinarian
  against queue and reception against visits each returned controlled 403 with
  zero DTO/resource/existence/redirect/5xx leakage.
- Docker 27.3.1 on HyperKit, PostgreSQL and backend remained healthy with zero
  backend restarts. The earlier Portal termination was
  `AGENT_EXECUTION_PROCESS_TREE_CLEANUP`, not a Docker, Next.js, BFF or
  launcher-security defect; the independently owned Portal remained HTTP 200.

Execution verdict: `PASS / COMPLETE`.

### `LOCAL-DOCKER-RUNTIME-01 / Docker Desktop Runtime Stability Diagnosis`

`PASS / DOCKER_RUNTIME_STABLE`.

- The initial Docker Desktop API proxy accepted socket connections but did not
  complete `/_ping`; host memory, disk and inode pressure were not present,
  and Docker VM logs contained no OOM, ENOSPC, panic or VM-exit evidence.
- One graceful Docker Desktop restart restored Docker 27.3.1. Existing
  containers, four local volumes and both PostgreSQL data volumes were
  preserved.
- The canonical `vethelp-alpha` rich-demo launcher completed. Backend,
  PostgreSQL and both required mocks stayed healthy; all containers reported
  restart count zero and `OOMKilled=false`.
- Six consecutive runtime checks over ten minutes, spaced 120 seconds apart,
  passed for Docker `/_ping`, `docker info`, backend health and PostgreSQL
  health. Backend RSS stabilized near 363 MiB and PostgreSQL near 61 MiB.
- Primary classification: transient `DOCKER_API_PROXY_FAILURE`, confidence
  medium. No repository or Docker data repair was justified.

Execution verdict: `PASS / DOCKER_RUNTIME_STABLE`.

Follow-up regression evidence: during `V50-LOCAL-RICH-DEMO-SEC-01V-R2`,
the Docker API again stopped completing `/_ping` while the only permitted
canonical stack recovery was starting. The five-case false-positive verifier
suite passed and new focused expiry/concurrency/origin/return-path coverage was
prepared, but live execution could not continue. Do not claim security closure
or restart Docker again inside R2.

### `V50-LOCAL-RUNTIME-02-R1 / Resume HoldExpirationService Startup Crash Repair After Manual Docker Recovery`

`PASS / COMPLETE`.

- Reproduced the startup crash in the canonical `vethelp-alpha` stack:
  an expired inconsistent hold caused `BookingService.expireHolds()` to raise
  `BOOKING_TEMPORARILY_UNAVAILABLE`, and the fire-and-forget interval left that
  rejection unhandled, terminating Node with exit 1.
- `HoldExpirationService` now catches and logs errors only at the scheduled
  boundary so later intervals retry. Direct `runOnce()` callers still receive
  the authoritative domain failure and the booking transaction continues to
  roll back without changing the state machine or invariants.
- The worker has one shared interval, suppresses overlapping cycles, stops
  accepting work during teardown and waits for the active cycle before
  completing module shutdown.
- Focused lifecycle tests pass `4/4`, including synchronous adapter failure.
  The real PostgreSQL booking-hold
  regression passes with the canonical backend worker disabled during the
  fixture-sensitive Jest run; backend build and `git diff --check` pass.
- With workers enabled, the canonical backend passed ten consecutive
  30-second checks over five minutes: health 200, running, exit 0, restart
  count zero and no HoldExpirationService crash. Compose SIGTERM produced no
  lifecycle exception or unhandled rejection; the npm development wrapper
  records the externally stopped container as exit 1.

Execution verdict: `PASS / COMPLETE`.

## Next single action

### `V50-LOCAL-RICH-DEMO-OPS-02C / Legacy Entrypoint Deprecation and Canonical Smoke Closure`

`PASS / COMPLETE`.

- All nine tracked operational entrypoints are classified. `start-vethelp.sh`
  is the sole lifecycle implementation; Make and three shell entrypoints are
  compatibility delegates with a documented warning/removal window.
- Four unsafe mutating diagnostics now return controlled exit 64 with a
  canonical replacement before any Docker, database, process or artifact
  action.
- Canonical read-only `smoke` emits one machine JSON report covering the exact
  project, six service states/restart counts, four JSON health markers,
  LiveKit 7880, Portal ownership, runtime modes, symlinks, bootstrap codes and
  persistent secret patterns.
- Focused launcher/deprecation tests PASS, synthetic stop PASS, and smoke
  matrix PASS `9/9`, including unhealthy, timeout, malformed JSON, wrong
  project, restart, second Portal, state-root mode and secret regression cases.
- Real read-only status/smoke PASS on Docker 27.3.1/HyperKit. PostgreSQL,
  backend, three mocks and LiveKit are running; healthchecks pass where
  applicable; restart counts are zero; permission, symlink, bootstrap-code and
  secret violations are zero. No real stop or second Portal was executed.
- `V50-LOCAL-RICH-DEMO-OPS-02` and the Wave 0 local operating loop are
  `PASS / COMPLETE`. Seed/source/security contracts remain unchanged.

Execution verdict: `PASS / COMPLETE`.

## Next single action

### `V50-CLINIC-04N-B / Registry Shared Rate Limiter Integration`

`PASS / COMPLETE`.

- The exact administrative-reference Registry path now performs capability,
  active membership, exact clinic/location scope, feature and request
  validation before one shared PostgreSQL limiter consume. Visibility and
  reference lookup occur only after an allowed consume.
- The limiter identity contains only safe actor, clinic, location and the
  fixed exact-search namespace. It never receives raw/display/normalized
  reference, comparison key or patient data.
- Typed defaults are short 20/60 seconds and sustained 200/3,600 seconds,
  with positive, ordered and retention-bounded startup validation.
- Denial preserves the safe
  `PATIENTS_REGISTRY_SEARCH_RATE_LIMITED` 429 contract and database-derived
  `Retry-After`. Infrastructure failure fails closed as
  `PATIENTS_REGISTRY_POLICY_UNAVAILABLE` 503 without lookup or local fallback.
- Exact search invokes shared enforcement once and the process-local limiter
  zero times. Ordinary `q` Registry search remains its only legacy consumer.
- Focused real PostgreSQL evidence covers authority-first zero rows,
  short/sustained thresholds, durable blocked attempts, database-time expiry,
  actor/location isolation, two service instances, concurrent zero
  over-admission, fail-closed behavior, privacy and zero domain side effects.
  Registry, Patient Detail and shared-foundation regressions, Node 22 build,
  migration checksums and diff hygiene pass.
- Docker 27.3.1 on HyperKit, backend and PostgreSQL remained running and
  healthy with restart counts zero. No stack, volume or Portal lifecycle
  operation was performed.
- 04N remains open: access-log redaction deployment, safe telemetry/alerts,
  representative 10k/100k semantic EXPLAIN cadence, rollout evidence and
  runbook operational validation are not part of 04N-B.

Execution verdict: `PASS / COMPLETE`.

## Next single action

`V50-CLINIC-04N-C / Registry Reference Search Operational Evidence Closure`.

## V50-CLINIC-04N-C — Registry reference operational evidence closure

`PASS / COMPLETE`.

- Exact-reference access-log redaction, bounded telemetry taxonomy, alert
  definitions, runbook actions and PR/nightly semantic-plan workflow are
  implemented and covered by focused tests.
- The 100k baseline spilled in the `snapshot_rows` external-merge `Sort`:
  50,000 revision rows used 4,408 kB on disk with 551 temporary blocks read
  and 552 written. The later CTE scan then removed 49,999 rows.
- The query now resolves the scoped administrative-reference candidate through
  `clinic_patient_local_profiles_reference_location_key` before the snapshot
  sort. Visibility, consent, snapshot and appointment inclusion semantics are
  unchanged; no migration or PostgreSQL memory override was required.
- PostgreSQL 16.14 final evidence at canonical `work_mem=4MB`: 10k p95
  20.578 ms / p99 22.571 ms; 100k p95 14.971 ms / p99 15.898 ms. Both tiers
  return cardinality 1, use the scoped index, perform zero local-profile
  sequential scans and report zero temp reads, temp writes or spill nodes
  across three JSON EXPLAIN measurements.
- Transaction-scoped fixtures roll back on success or failure. Measured 10k
  build/cleanup is 6,980.776/6.731 ms; 100k is
  70,764.024/40.045 ms; reserved cleanup is `0|0|0|0`.
- Focused operational unit tests, Registry HTTP/PostgreSQL matrix, Node 22
  build, workflow syntax and diff hygiene pass. Production rollout remains
  `NOT_STARTED`.

Execution verdict: `PASS / COMPLETE`.

## Next single action

### `V50-CLINIC-05A / Clinic Workspace Home Authority Contract`

`CONTRACT_READY`.

- The canonical composition model is one read-only backend projection at
  `GET /v1/clinic/:clinicId/locations/:locationId/workspace-home`, consumed by
  one same-origin Portal BFF and one scoped Portal page. Portal composition and
  independent widgets are rejected because they duplicate authority checks and
  create fan-out, count-leak and inconsistent-snapshot risk.
- One common backend gate requires authenticated identity, matching JWT
  clinic/location claims, active non-revoked exact-location membership and
  database-backed capability evaluation. Roles only contribute capabilities;
  unavailable sections contain no facts, counts or action links.
- The response is a fixed discriminated tuple of Queue, Schedule,
  Appointments, Veterinarian and Quality sections. It excludes patient/owner,
  hold/appointment/doctor identifiers, clinical fields, documents, financial
  data, audit rows and arbitrary errors/URLs.
- PostgreSQL time owns snapshot/freshness semantics. The contract uses a
  30-second max age, `private, no-store`, no ETag, explicit stale marking and
  immediate protected-data removal on the next authoritative read after
  membership revocation.
- The first 05B attempt stopped before edits after an independent semantic veto:
  Schedule runtime synthesizes fallback working hours without an authoritative
  operational-state/configuration-warning mapping, while Quality exposes raw
  metrics without approved alert thresholds or a Workspace freshness source.
- 05A-R1 resolves the veto as `PASS / SAFE_MINIMUM_CONTRACT`: only Queue and
  Appointments can be `AVAILABLE` in 05B. Capability-present Schedule,
  Veterinarian and Quality are `NOT_CONFIGURED` without facts, action, source
  timestamp or operational SQL; capability absence remains `NOT_AUTHORIZED`.
- Partial degradation is allowed only after the common authority gate for an
  authorized Queue or Appointments summary. Normal `NOT_CONFIGURED` is not a
  technical error. Authentication, scope, membership or policy failures fail
  the whole response without protected data.
- The repaired 05B performance gate permits one authority query plus at most
  two bounded summaries, requires Queue/Appointments cardinality one and an
  8 KiB response, and at 10k requires endpoint p95 < 150 ms, p99 < 300 ms,
  zero disk/temp spill and zero sequential scans on large Queue/Appointment
  tables. No Schedule/Quality fixture or plan is fabricated.
- `CLINIC_V50_WORKSPACE_HOME` is specified default-off and depends on
  `PORTAL_V50_SHELL`; no runtime flag was added. `CLN-001` is
  `CONTRACT_READY`, not implemented, tested or visually verified.
- Production rollout and main integration remain `NOT_STARTED`.

Runtime remains unchanged. Backend, Portal, migrations, feature flags and
visual-fidelity counter were not modified. Production rollout and main
integration remain `NOT_STARTED`.

Execution verdict: `PASS / SAFE_MINIMUM_CONTRACT`.

## Next single action

### `V50-CLINIC-05B / Clinic Workspace Home Backend Foundation Projection`

`PASS / BACKEND_FOUNDATION_IMPLEMENTED / TESTED`.

- Added the canonical authenticated Workspace Home endpoint with one exact
  active-membership clinic/location authority query inside a read-only,
  repeatable-read transaction.
- Queue and Appointments each use one bounded aggregate and an isolated
  savepoint. Schedule, Veterinarian and Quality use no operational SQL and
  remain no-facts `NOT_CONFIGURED` or `NOT_AUTHORIZED`.
- PostgreSQL-derived time, fixed tuple order, saturated counts, narrow partial
  degradation, no-store/no-ETag delivery and privacy-safe bounded telemetry are
  implemented and covered by HTTP/PostgreSQL tests.
- Deterministic 10k exact-scope evidence: 30 warm HTTP reads, p50 67.482 ms,
  p95 72.589 ms, p99 82.934 ms, 1,048 bytes, one measured authority query
  plus two measured operational statements, cardinality one,
  zero large-table sequential scans, zero spill/temp blocks, zero cross-scope
  leakage and fixture cleanup `0|0|0|0`.
- OpenAPI and the PR performance workflow enforce the contract. No migration,
  dependency, Portal, prototype or feature-flag change was made.
- `CLN-001` is `BACKEND_FOUNDATION_IMPLEMENTED / TESTED`,
  `PORTAL_NOT_STARTED`, `VISUAL_NOT_VERIFIED`. Production rollout and main
  integration remain `NOT_STARTED`.

Execution verdict: `PASS / BACKEND_FOUNDATION_IMPLEMENTED / TESTED`.

## Next single action

### `V50-CLINIC-05C / Clinic Workspace Home Portal BFF and Page`

`PASS / PORTAL_FOUNDATION_IMPLEMENTED / TESTED`.

- Added the exact-true, server-side, default-off `CLINIC_V50_WORKSPACE_HOME`
  flag with `PORTAL_V50_SHELL` dependency. Disabled behavior preserves the
  previously absent scoped root route, removes Home navigation and sends no
  Workspace Home browser request.
- The enabled root page stays inside the existing shell. Its same-origin BFF
  uses only the server-retrieved HttpOnly session token, rejects browser
  bearer substitution/redirects/query forwarding, bounds timeout/body size,
  strict-parses the fixed 05B tuple and exposes only normalized no-store
  responses.
- The client strict-parses again, uses generation and AbortController fencing,
  has no polling or persistence, refreshes manually or after a >30-second
  hidden-tab interval, retains only technical stale snapshots and
  synchronously purges protected facts on authority, subject, scope or route
  loss.
- Queue/Appointments render bounded authoritative facts and closed links.
  `NOT_AUTHORIZED` is hidden; Schedule/Veterinarian/Quality remain no-facts
  `NOT_CONFIGURED` or unavailable presentations without synthetic authority.
- Responsive/accessible evidence covers reception, veterinarian, multi-role,
  empty, degraded, stale and forbidden states at 375/412/768/1440, plus
  keyboard, full-page axe, 200% text, reduced motion, forced colors and the
  authoritative prototype reference. The visual-fidelity counter is
  unchanged; full product parity remains partial.
- Node 22 typecheck/build, parser/BFF/flag contracts, focused/default-off/full
  Chromium, real Portal-BFF/backend/PostgreSQL smoke and independent
  security/parser/product reviews pass. Backend, OpenAPI, migrations,
  dependencies, Flutter and prototype are unchanged.
- `CLN-001` is `BACKEND_FOUNDATION_IMPLEMENTED / TESTED`,
  `PORTAL_FOUNDATION_IMPLEMENTED / TESTED`,
  `BOUNDED_VISUAL_EVIDENCE_PASS`, `FULL_PRODUCT_PARITY_PARTIAL` and
  `ROLLOUT_NOT_STARTED`.

Execution verdict: `PASS / PORTAL_FOUNDATION_IMPLEMENTED / TESTED`.

## Product reset — `V50-CLINIC-MVP1-01 / Booking Journal Product, UX and Architecture Contract`

`PASS / CONTRACT_READY / RUNTIME_NOT_STARTED` (2026-08-01).

- Program lineage: `V50-CLINIC-05A` is `CONTRACT_READY / PR_OPEN`; `V50-CLINIC-05B` is `BACKEND_FOUNDATION_IMPLEMENTED / TESTED / PR_OPEN`; `V50-CLINIC-05C` is `PORTAL_FOUNDATION_IMPLEMENTED / TESTED / PR_OPEN / CI_BLOCKED`.
- Product-owner review rejects Workspace Home as the clinic MVP's primary daily workflow. Its implementation and evidence remain valid as `RETAINED_FOUNDATION / NOT_PRIMARY_MVP_HOME`; no runtime route was moved.
- `V50-CLINIC-05D` is `SUPERSEDED_BY_PRODUCT_RESET` and must not be resumed.
- The canonical MVP home is contracted as a capability-filtered Booking Journal at the scoped root, behind future exact-true default-off `CLINIC_MVP1_BOOKING_JOURNAL`. Flag-off preserves exact 05C behavior; `/journal` is a redirect alias only while enabled.
- Architecture decision is Variant A: one future backend journal projection with a common active-membership/exact-location gate, bounded fields, closed status mapping, stable server ordering and capability-filtered sections/actions. Existing Queue, Registry and Schedule remain domain authorities but cannot be composed client-side as one authoritative snapshot.
- Primary MVP navigation is `Журнал записи`, `Заявки`, `Клиенты`, `Сотрудники`, with optional `Настройки`. Staff/settings, manual appointment creation, and clinic cancellation/rescheduling remain explicit contract gaps and are not promised by existing role guards or owner commands.
- The supplied master specification is registered unchanged; contract, reuse/gap matrix and screen map are recorded. This slice changes documentation only: no endpoint, Portal page, role, state machine, migration, dependency, feature flag or production rollout.
- PR #68's Linux optional `lightningcss` failure remains a separate CI slice and is not a product blocker.

Final slice verdict: `V50-CLINIC-MVP1-01: PASS / BOOKING_JOURNAL_CONTRACT_READY`.

## Completed lineage

`V50-CLINIC-MVP1-02 / Booking Journal Interactive UX Prototype` was implemented and then entered the bounded R1 owner-review repair below. The current `#clinic-workspace` runtime remains unchanged.

## `V50-CLINIC-MVP1-02-R3 / Booking Journal Mobile CRM UX Reset`

`PASS / MOBILE_CRM_R3_READY / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED / RUNTIME_NOT_STARTED` (2026-08-02).

- Product-owner review of the initial MVP1-02 prototype was `CHANGES_REQUESTED`; the R1 repair preserves its product model while correcting readability, vertical space, drawer clipping, forms, alternative selection, mobile semantics and Week view.
- Day view fills the useful viewport and internally scrolls through 08:00–20:00. Larger type, duration-correct cards, afternoon fixtures, distinct state treatments, explicit SLA metrics and visible drawer action footer remove the rejected empty/clipped presentation.
- Week view is now a single-employee seven-day time×day journal with 30-minute axis, proportional appointments, break/closed treatments, calm free intervals and a calendar-based alternative mode. Default Week state has no unrelated drawer.
- Manual booking uses a large two-column/full-screen composition, bounded available slots, derived price and disabled submit until time selection. Alternative review keeps original/new time, employee and price visible.
- Mobile is selected only by viewport CSS; 375/412 replace desktop navigation/grid with urgent card, grouped agenda, bottom navigation and full-screen detail/forms. Thirty deterministic URL states include five dedicated R1 scenarios.
- Confirm, conflict-to-alternative, reject, manual booking, client lookup/quick create, search and filtering are repeatable simulated interactions. They make no backend, state-machine, authority or command-success claim.
- Synthetic fixtures contain no real PII or clinical/payment/insurance/telemedicine/Quality data. Future journal projection remains the sole authority for snapshot ordering, capability-filtered fields/actions and server time.
- Archived R1 evidence retained its then-current Node 22 inventory `6/6`, prototype SHA-256 `3fce953a319b8d7c0a90432ca0f07a6a4dd3ddd5446a3d40c442911595f91728`, 38 screenshots and six contact sheets at `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R1/`, checksum `3a6da81c127858a477e184063e3bf3756dcc40b31ad53c667a83bd72ac339380`.
- Independent Product/UX repair review passes. Runtime suites remain `ABSTAIN / PROTOTYPE_ONLY`; Portal/backend/BFF/migration/dependency/lockfile/global prototype are unchanged.
- Owner verdict after R1 was `CHANGES_REQUESTED_R2`. R2 cache-busts prototype assets and directly proves `week-alternative-selection` instead of allowing a stale state inventory to render `Неизвестное состояние`.
- Week is an operational seven-day 08:00–20:00 calendar with 11 duration blocks and load summary. Alternative mode keeps compact original/selected context above the full-width grid, exposes only three bounded candidate intervals and opens an explicit review dialog; the default Week drawer remains closed.
- Compact Day cards use duration-safe content and report zero clipping; the document remains viewport-height with internal workday scrolling. Manual select affordances, form columns, close-button focus, date controls and labelled Search/Refresh actions are normalized.
- R2 Chromium: 30/30 states and reloads; seven viewports; console/page/request, axe serious/critical and overflow all zero. Nine focused screenshots are stored at `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R2/`, checksum `36df4beb669da83a37d7d89cb1d441a05309cf39becfb2da6135e0628d940f17`. Prototype SHA-256 is `420b8a41097d8c2a056eef3cba8af028793b922335ab90d5eacc3cab1cd14880`.
- R2 owner review remained `CHANGES_REQUESTED`: the phone experience did not meet the product-quality bar. R3 is a separate mobile CRM composition below 600px, not a resized desktop DOM.
- Mobile IA is `Сегодня / Заявки / Клиенты / Ещё`; contextual create is outside navigation. Today uses a seven-day strip, one summary, one urgent card and a chronological agenda. Page-level detail uses Back-only navigation and sticky confirm/alternative/overflow actions above safe-area.
- Alternative is date → recommended slots → review with no Week grid. Booking is a three-step full-screen flow with retained draft and a separate quick-client subflow. Clients and More are bounded task screens; legacy mobile states normalize to the new composition.
- The manifest now contains 53 reloadable states and 8 viewports. Chromium reports console/page/request `0/0/0`, axe serious/critical `0`, page overflow `0` and touch targets below 44px `0`; keyboard-reduced viewport, orientation, browser back, 200% text, reduced motion and forced colors pass.
- R3 evidence at `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R3/` contains 42 screenshots, 3 MOV recordings and 7 contact sheets. Screenshot checksum is `8445e8f00d0a0c218674b0126729342080d60696d3b3f6ed1f6395c09224485f`; recording checksum is `125e199a0d5a9e18a73a108d00796df7e1539dd84481ff4acfda8f37b356a957`. Prototype SHA-256 is `e4472d98538a2994450ec8f00cb33888c15ab66b8a76b3becaa721ce015dd50e`.
- Independent Product/CRM, Mobile UX and Accessibility reviews pass with no remaining vetoes. Accessibility repair adds forward/back heading focus, one main landmark per task/system screen, announced and associated invalid-slot feedback, and checksum-consistent 200% browser-zoom evidence.
- R3 is intentionally local and uncommitted. PR #70 remains open at published R1 head `eab04f95fe981785800ec3f97c621f97961dbef5`; no commit, push or PR edit occurred.

Execution verdict: `PASS / MOBILE_CRM_R3_READY / PRODUCT_OWNER_REVIEW_PENDING`. Product-owner acceptance is not inferred.

## `V50-CLINIC-MVP1-02-R4 / Responsive CRM Design System Unification`

`PASS / RESPONSIVE_CRM_R4_READY / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED / RUNTIME_NOT_STARTED` (2026-08-02).

- R3 owner review is `CHANGES_REQUESTED`: desktop/tablet/mobile appeared as different products, mobile calendar search/filter was incomplete, and the tablet filter rail compressed into unreadable content.
- R4 makes the existing desktop CRM the canonical visual language. Shared `--vh-*` tokens cover navy shell, blue primary, neutral surfaces/borders, status semantics, focus, radii, control heights and spacing; one local outline SVG set replaces breakpoint-specific glyphs. Green is success/status only.
- Breakpoints are wide desktop `>=1280`, compact desktop/tablet landscape `960–1279`, tablet portrait `600–959`, and mobile `<600`. Only wide desktop retains the 232px filter rail. Compact/tablet use a 72px navy navigation rail with overlay filters/detail; mobile keeps the R3 agenda/task architecture with the same shell, typography, icons, status and command hierarchy.
- `Поиск по расписанию` is visible on every breakpoint and searches bounded synthetic pet, owner, service, employee, time, status and masked-phone fields. Debounce, clear, results, empty state, result-to-detail and query-preserving return are deterministic. Filters use the same Employees, Services, Statuses and action-only entities with staged apply, count and removable active chips.
- The manifest contains 70 reloadable states and ten viewports. Chromium passes 70/70 states and reloads; console/page/request `0/0/0`, axe serious/critical `0`, overflow `0`, touch targets below 44px `0`. Mobile Back and tablet Escape return focus to the invoking Search/Filters control.
- R4 evidence at `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R4/` contains 40 screenshots and six required consistency contact sheets. Screenshot checksum is `25988dff944ed71bc9ab6e0fe475dcc31bf1a075d8059ca1272df75e8566d501`; prototype SHA-256 is `f0276f25fcc9bb47bfbac12c21de5e7b72e086d78b1d867a378990c1221f961e`.
- Independent Design-System, CRM UX and Responsive reviews pass with no remaining vetoes. Runtime/backend/BFF, roles, state machines, migrations, dependencies and lockfiles remain unchanged.
- R4 remains local and uncommitted. PR #70 remains open at published R1 head `eab04f95fe981785800ec3f97c621f97961dbef5`; no commit, push or PR edit occurred.

Execution verdict: `PASS / RESPONSIVE_CRM_R4_READY / PRODUCT_OWNER_REVIEW_PENDING`. Product-owner acceptance is not inferred.

## `V50-CLINIC-MVP1-02-R4-VISUAL / Responsive Screenshot Regression Harness`

`PASS / RESPONSIVE_SCREENSHOT_HARNESS_READY / EVIDENCE_SAVED_IN_REPOSITORY / LOCAL_UNCOMMITTED` (2026-08-03).

- The bounded Node/Playwright harness starts a loopback-only static server, reads the prototype manifest, fixes locale/time/browser motion and captures all ten allowed viewports without a new dependency.
- The bounded matrix contains 158 viewport/state/role cases and four canonical breakpoint interaction flows. Search/detail/Back restoration, empty search, staged filters and removable chips are exercised automatically.
- Browser console/page/request errors, page-wide overflow, responsive composition, visible main/heading, accessible control naming, mobile input font, mobile/tablet 44px targets, screenshot dimensions, missing/orphan files and checksum mismatches are all zero.
- Repository evidence is stored at `docs/v50/evidence/V50-CLINIC-MVP1-02-R4-RESPONSIVE/`: 220 screenshots, machine-readable manifest/results/checksums and a standalone comparison gallery. Automated capture and offline verification pass within the 120 MiB / 6 MiB-per-PNG guards.
- R4 remains local and uncommitted. PR #70 remains open at published R1 head `eab04f95fe981785800ec3f97c621f97961dbef5`; no commit, push or PR edit occurred. Product-owner review remains pending.

## `V50-CLINIC-MVP1-02-R5-A / Role and Shell Foundation`

`PASS / R5_A_ROLE_SHELL_READY / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED / RUNTIME_NOT_STARTED` (2026-08-03).

- A single prototype-only role presentation map owns semantic capabilities and active workspace. Reception exposes Journal/Requests/Clients and request decisions; Admin additionally exposes Staff/Settings and Management context; Veterinarian exposes My Day/My Visits and read-only assigned visits without administrative CTAs; Multi-role exposes `Режим: Ресепшен` instead of silently mixing controls.
- Desktop/tablet Day, Week and List states share one navy CRM shell, page/location header, date navigation, explicit view switch, commands and optional detail surface. CSS breakpoints change composition while preserving landmark meaning.
- Hidden role controls are removed from the DOM and accessibility order. The capture harness asserts veterinarian decision/admin controls are absent, admin navigation is present, multi-role context is explicit and reception does not inherit admin navigation.
- Evidence `docs/v50/evidence/V50-CLINIC-MVP1-02-R5-A-RESPONSIVE/` passes 158 matrix cases plus four canonical interaction flows: 162/162 results, 220 screenshots, 42 full-page screenshots, browser/composition/overflow failures `0`. Prototype SHA-256 is `fc73b765c216a813a211efc45b1fc81e1da84f2257b7ae5eb79b87939e847f28`.
- This is presentation behavior, not security enforcement. Backend, Portal runtime, APIs, roles, migrations, dependencies and production feature flags are unchanged. No commit, push or PR edit occurred.

The only next bounded slice is `V50-CLINIC-MVP1-02-R5-B / Action priority and request detail`; it is `NOT_STARTED`. R5-C, R5-D, R5-E and `V50-CLINIC-MVP1-03` remain `NOT_STARTED`.

## Next gate

`V50-CLINIC-MVP1-02-R5-B / Action priority and request detail` is the only next bounded slice and remains `NOT_STARTED`. Product-owner review of the complete UX correction remains pending.

R5-C, R5-D, R5-E and `V50-CLINIC-MVP1-03 / Clinic Booking Journal Backend Read Projection` remain `NOT_STARTED`. Production rollout and main integration remain `NOT_STARTED`. PR #66, #67, #68 and #69 remain unmerged; the PR #68 Linux optional `lightningcss` blocker remains a separate CI slice.

## `V50-CLINIC-MVP1-02-R5-B / Action Priority and Request Detail`

`PASS / R5_B_ACTION_DETAIL_READY / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED / RUNTIME_NOT_STARTED` (2026-08-03).

- Action-first SLA has explicit critical, pending and clear states. Each actionable queue item exposes priority, status, next action, SLA/deadline and responsible role without technical enums.
- Detail leads with decision context. Confirm locks submission and ends in authoritative readback presentation; alternative waits for owner; conflict/stale/technical-error retain request context. Timeline remains secondary.
- Mobile detail has no global search/filter/create/view controls and one safe-area-aware sticky action area. Veterinarian is read-only; Admin and multi-role retain explicit workspace markers.
- Inventory covers 84 states, 4 roles and 10 viewports. Unit/inventory tests pass 21/21. Evidence `docs/v50/evidence/V50-CLINIC-MVP1-02-R5-B-RESPONSIVE/` passes 212 matrix cases plus FLOW-01..FLOW-04: 216/216 results, 259 screenshots, 42 full-page screenshots, failures `0`.
- Prototype SHA-256 is `9f912c12fcda2e5aef9ef522b92c169616ff2aa2cfabd615e1972e9f8511cd00`; source-diff SHA-256 is `825b9f1817639bc4a1e9a327ef488dbb7c334e72d418b4d024f5015544168359`; evidence manifest SHA-256 is `38fcf2b1d1df1d761b9eed15f257f6a43073f72037cced7a324c10c00bc388c8`.
- Backend, Portal runtime, API, migrations, production roles/capabilities and feature flags are unchanged. No commit, push or PR edit occurred.

The only next bounded slice is `V50-CLINIC-MVP1-02-R5-C / Booking productivity`; it is `NOT_STARTED`. R5-D, R5-E and `V50-CLINIC-MVP1-03` remain `NOT_STARTED`.

## `V50-CLINIC-MVP1-02-R5-C / Booking Productivity`

`PASS / BOOKING_PRODUCTIVITY_READY / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED / RUNTIME_NOT_STARTED` (2026-08-08).

- One presentation-only draft model now supports global, free-slot, client and owner-request entry. Known safe context is prefilled, explicit controls can change it, back navigation preserves it, conflict/terminal failure retain it, and a new context starts from an isolated draft.
- Desktop/tablet use the shared dialog composition; mobile uses labelled `Шаг 1 из 3` through `Шаг 3 из 3` client, schedule and review tasks. Deterministic states cover idle, prefilled, partial/validation, submitting, authoritative-readback presentation, retryable conflict, terminal error and role-denied presentation.
- Calendar records and free slots expose contextual accessible names. Free-slot entry retains location/date/time/veterinarian; client and request details expose create actions only when the presentation capability includes `booking.create`. Veterinarian remains read-only and cannot open or submit creation.
- Keyboard productivity supports `/`, `N`, `Esc`, `Enter` and `Ctrl/⌘+Enter`, with typing guards, focus trapping/restoration and reduced-motion behavior. `FLOW-05` through `FLOW-10` prove contextual creation, draft preservation, conflict retention, keyboard-only completion and shortcuts.
- Inventory covers 104 deterministic states, 4 roles and 10 viewports. Unit/inventory tests pass 24/24. Evidence `docs/v50/evidence/V50-CLINIC-MVP1-02-R5-C-RESPONSIVE/` passes 293 matrix cases plus six flows: 299/299 results, 341 screenshots, 42 full-page screenshots, failures `0`.
- Prototype SHA-256 is `9fdf10b5f692d5d4e1af8ece2df4f354f57a181a2c269d1ddee9f8fa765c9c62`; source-diff SHA-256 is `4921f6c038a0470cf837a49d0af01055e84b2f1b23aa091f777fe6301559f918`; evidence manifest SHA-256 is `35ed58e1f3f8f321901b9d790a35b72d32a38296fbc3dcdd0ff5ec9899516424`.
- This is prototype presentation only: no backend command/read projection, appointment authority, runtime route, role/state-machine/migration/dependency/feature-flag or production rollout changed. PR #70 remains open at its published R1 head; no commit, push or PR edit occurred.
- Efficiency verdict: `INEFFICIENT`. Focused gates were run first, but multiple full capture attempts exposed composition, observer and harness-selector defects before the final clean PASS; the evidence itself was not manually replaced or weakened.

The only next bounded slice is `V50-CLINIC-MVP1-02-R5-D / Views, filters and communication`; it is `NOT_STARTED`.

## `MVP-SCOPE-01 / Effective Pilot Scope + External Runtime Containment`

`PASS / PILOT_SCOPE_CONTAINMENT_IMPLEMENTED / TESTED / LOCAL_UNCOMMITTED` (2026-08-08).

- Added one boot-immutable typed `MVP_SCOPE_PROFILE` with `LEGACY_COMPAT` as the temporary absent-profile compatibility default and explicit `PILOT_V1`. Unknown values fail startup; stale raw MIS/payment/emergency flags cannot re-enable pilot capabilities.
- `PILOT_V1` excludes MIS, Payments, Telemedicine, Insurance and Emergency modules from Nest root composition. Their controllers, cron providers and external clients are therefore not registered. `LEGACY_COMPAT` preserves the historical composition.
- Core Owner Home remains registered. Its Telemedicine dependency is conditional and optional, preventing the former `OwnerHome → Telemed → Payments` transitive re-entry while preserving non-telemedicine owner behavior.
- Every MIS, payment, telemedicine and insurance worker also fails before claim/lease/database/provider access when its effective capability is disabled. Historical rows are neither claimed nor acknowledged. Required core workers remain independently enabled.
- Booking hold creation uses the effective MIS capability, so `PILOT_V1` cannot enter MIS reservation states even when the legacy raw flag is stale true. Booking locking, PostgreSQL time, idempotency, state validation, audit and outbox foundations are unchanged.
- `/health` and `/v1/health` retain database authority and add the selected profile plus bounded `ENABLED`/`DISABLED` optional-capability presentation. Disabled provider credentials are not read or required and do not affect readiness.
- Focused pilot parser/composition/worker/credential-free boot/route-negative and Owner Home tests pass `33/33`; Node 22 backend build passes. Explicit `LEGACY_COMPAT` Owner Home/Telemedicine regression tests pass `22/22`.
- No migration, dependency, schema, feature-code deletion, provider-event acknowledgement, Portal, RN, Flutter or Booking Journal runtime change was made. Rollback is `MVP_SCOPE_PROFILE=LEGACY_COMPAT` plus restart; no database rollback.

The selected continuation slice was `MVP-SCOPE-02 / Product Route and Navigation Containment`.

## `MVP-SCOPE-02 / Product Route and Navigation Containment`

`PASS / PILOT_PRODUCT_SURFACE_CONTAINED / TESTED / LOCAL_UNCOMMITTED` (2026-08-08).

- `PILOT_V1` now composes the Owner shell without Telemedicine, Insurance or Emergency entry points and without the advanced alternative-time action. Core Home, pets, clinic catalogue, booking entry, appointments/history and notifications remain reachable. This is presentation containment only; backend authority does not trust the Flutter build profile.
- Clinic Portal uses one typed server-side presentation profile matching the backend `LEGACY_COMPAT | PILOT_V1` contract. Pilot always selects the existing V50 shell, keeps Queue, Schedule and the rollout-controlled minimal Patients Registry, and removes Quality and full Clinical workspace navigation without leaving disabled entries or empty sections.
- A server-side Next proxy returns bounded `404 Not Found` for excluded Clinic pages and BFF routes, including Telemedicine, Quality, Clinical workspace/completion, advanced alternative-time and product replay/audit entry points. Query/header/cookie state cannot select the profile and technical configuration is not exposed.
- A global backend guard closes the excluded routes that remain registered in shared Booking Core before their handlers execute. External Telemedicine, Insurance, Payment and Emergency routes remain physically absent through `MVP-SCOPE-01` composition. No provider initialization, external call or business mutation is added.
- `LEGACY_COMPAT` retains historical navigation/routes and existing capability/rollout authority. No Booking state-machine, create semantics, Queue, Schedule, Registry implementation, schema, migration, dependency, worker or historical record changed.
- Evidence: backend scope/guard/boot/composition tests `29/29` and Node 22 build pass; Owner focused widget tests `17/17` and focused Flutter analyze pass; Portal typecheck and Node 22 build pass; focused Chromium Pilot route matrix `9/9`, retained session-boundary regression `1/1`, and Legacy Quality/Clinical regression `10/10` pass; `git diff --check` passes.
- Rollback is `MVP_SCOPE_PROFILE=LEGACY_COMPAT` plus backend/Portal restart or redeploy and the matching Owner build profile. Database rollback is `NONE`.

The selected continuation slice was `MVP-BOOKING-01 / Owner Booking Request → Existing Manual Confirmation Branch`.

## `MVP-BOOKING-01 / Owner Booking Request → Existing Manual Confirmation Branch`

`PASS / POSTGRESQL_EVIDENCE_COMPLETE / TESTED / LOCAL_UNCOMMITTED` (2026-08-08).

- `PILOT_V1` Owner create now reuses the existing transactional `MANUAL_CONFIRM_PENDING` branch instead of creating an immediate appointment. The slot remains `LOCKED_BY_HOLD`, manual confirmation SLA fields are populated, the existing Queue reads the persisted hold, and the additive create projection is `PENDING_CONFIRMATION`.
- `LEGACY_COMPAT` retains its existing automatic/MIS decision. The profile is boot-authoritative; payload, query, header, cookie and Owner build state cannot select internal booking semantics.
- Existing clinic confirm/decline commands, FIFO, If-Match version fencing, idempotency, slot counters, audit and outbox remain authoritative. Confirm creates one appointment and Owner readback becomes `CONFIRMED`; clinic decline keeps internal `RELEASED` and is projected as `REJECTED`, distinct from cancellation and expiry. Every `PILOT_V1` readback preserves `confirmationMode=MANUAL` across pending, confirmed and terminal states; `LEGACY_COMPAT` retains its prior state and mode projection.
- Owner Flutter consumes the authoritative `statusCode`; pending and rejected states no longer rely on local success inference, and rejected readback cannot render confirmed copy.
- Docker `27.3.1` and PostgreSQL runtime pass. PILOT create/idempotency/100-way concurrency/foreign-pet/Queue/external-isolation and Level-A confirm/decline Owner-readback harness passes `5/5` with one successful active path, one protected hold, zero duplicate appointments, zero MIS reservation effects and no pool leak. Queue service/FIFO/confirm/readback/stale/location regression passes `6/6`. Focused HTTP positive confirm/decline/readback/stale/concurrent delivery passes `7/7`; clinic authority and no-side-effect matrix passes `15/15`. Explicit `LEGACY_COMPAT` + MIS regression passes `4/4`.
- Focused semantic/config tests pass `12/12` and Node 22 backend build passes. Focused Owner parser/presentation tests pass `12` unique cases and focused Flutter analyze passes. `git diff --check` passes.
- No migration, schema, dependency, new state, new queue or external provider call was added. Rollback is `MVP_SCOPE_PROFILE=LEGACY_COMPAT` plus restart/redeploy; database rollback is `NONE`.

The selected continuation slice was `MVP-BOOKING-02 / Owner/Clinic Cancellation and Terminal Status Reconciliation`.

## `MVP-BOOKING-02 / Owner/Clinic Cancellation and Terminal Status Reconciliation`

`PASS / POSTGRESQL_EVIDENCE_COMPLETE / SECURITY_VALIDATED / LOCAL_UNCOMMITTED` (2026-08-09).

- Pending Owner cancellation reuses the existing fenced, payload-bound `releaseHold` transaction: the hold becomes internal `RELEASED`, held capacity is released once, no appointment is created, the active Clinic Queue excludes it, and PILOT Owner readback is authoritative `CANCELLED` with `confirmationMode=MANUAL`.
- Confirmed PILOT cancellation now completes the existing `CONFIRMED → CANCELLATION_REQUESTED → RELEASED` lifecycle atomically inside the same locked transaction: the linked appointment becomes `CANCELLED`, booked capacity is decremented once, appointment event/audit/outbox/idempotency are persisted together, Clinic registry projections see cancellation, and Owner readback is `CANCELLED + MANUAL`. No separate post-confirm Clinic cancel command existed, so no new public command was introduced.
- Clinic decline remains `RELEASED` with decline causation and projects `REJECTED`; expiration remains `EXPIRED`; confirmation remains `CONFIRMED`. Terminal causes are not collapsed. Duplicate cancellation replays one logical result, stale versions fail closed, and injected outbox failure rolls back hold/counter/audit/idempotency together.
- Real PostgreSQL cancel-vs-confirm and cancel-vs-decline races each produce exactly one successful version-1 transition. Final state is respectively coherent `CANCELLED|CONFIRMED` or `CANCELLED|REJECTED`, with no contradictory active appointment or double side effect. Foreign Owner access remains normalized `HOLD_NOT_FOUND` with zero mutation.
- PILOT exposes only canonical `POST /v1/owner/bookings/:bookingId/cancel`, which requires JWT Owner authority, `Idempotency-Key`, `If-Match`, and correlation ID. The legacy `/release` and `/cancellation-requests` mutations return 404 before authentication/handler execution in PILOT, while remaining available unchanged in `LEGACY_COMPAT`.
- Evidence: PILOT PostgreSQL cancellation/terminal/race harness `6/6`; explicit LEGACY regression `6/6`; PILOT route-containment plus real HTTP zero-side-effect matrix `17/17`; focused Owner Flutter cancellation/authoritative-refresh/stale/offline suite `8/8`; Node 22 backend build and `git diff --check` pass. Independent security validation is `PASS / NO VETO` after one repaired legacy-route containment veto.
- Existing Flutter cancellation UI already honors backend `canCancel`, sends the authoritative aggregate version, preserves the idempotency key across ambiguous retry, refreshes after stale/failure, and never fabricates local terminal success; no Flutter production change was required.
- External providers remain absent in PILOT. Migrations, schema changes and dependencies are `NONE`. `LEGACY_COMPAT` retains confirmation-required cancellation behavior and booked capacity until its existing downstream confirmation.

The selected continuation slice was `MVP-NOTIFY-01 / Booking In-App + Email Notifications`.

## `MVP-NOTIFY-01 / Booking In-App + Email Notifications`

`BLOCKED_ARCHITECTURE / MIGRATION_APPROVAL_REQUIRED / NO_IMPLEMENTATION` (2026-08-09).

- Targeted continuation discovery confirmed that Booking already writes authoritative committed lifecycle events to `booking_schema.outbox_events`, and the generic `OutboxService` supplies leasing, five-attempt bounded retry, delayed availability and terminal failure state. This is the correct upstream source and must not be duplicated.
- No durable in-app notification schema/table/model, Owner list/read API, read/unread persistence, notification-specific delivery ledger, or email provider abstraction exists in the current repository. The Owner shell contains only a supplied badge count; it is not a notification data surface.
- Therefore the required effective deduplication, per-owner authorization, read/unread behavior, restart safety and bounded email delivery cannot be implemented truthfully without a schema migration. The slice brief explicitly forbids creating that migration automatically and requires `BLOCKED_ARCHITECTURE` at this gate.
- The minimum separately approved persistence contract is: an Owner-scoped notification record keyed uniquely by authoritative outbox event (including hold/booking reference, product type, aggregate version, safe title/body, created/read timestamps), plus an email-delivery ledger keyed to that notification with bounded attempt/lease/next-attempt/terminal/delivered state. Recipient identity and email must be resolved from backend-authoritative Owner data, never request payload.
- Notification consumption must claim only the five approved Booking lifecycle event families and must leave historical MIS/payment/telemed/insurance events untouched. Booking transactions remain independent of notification/email delivery; no provider call may occur before Booking commit.
- No production, Flutter, migration, schema, dependency, event, worker, route, or Booking Core change was made. Existing dirty work and `.codex/config.toml` remain preserved.

The selected continuation slice was `MVP-NOTIFY-01A / Durable Notification Persistence and Email Delivery Contract`.

## `MVP-NOTIFY-01A / Durable Notification Persistence and Email Delivery Contract`

`PASS / APPROVED_MIGRATION_APPLIED / POSTGRESQL_EVIDENCE_COMPLETE / LOCAL_UNCOMMITTED` (2026-08-09).

- Explicit migration approval was used for exactly one forward-only notification foundation migration: `1719500000000_add_owner_notification_foundation.js`. It creates `booking_schema.owner_notifications` and `booking_schema.owner_notification_email_deliveries`; no existing table, Booking state or outbox is rewritten.
- Notification identity is derived only from `booking_schema.outbox_events → booking_schema.booking_holds.owner_id`. The projection repository accepts a source outbox event ID, enforces the closed Booking event allowlist, and does not accept Owner identity, email address or copy from a client boundary.
- `owner_notifications` durably stores source event, Owner, hold/optional appointment, product type, aggregate version, bounded safe copy and nullable `read_at`. Database uniqueness on source event + Owner + type is the concurrency safety net. Owner list and idempotent mark-read operations are recipient-scoped; dedicated chronological and partial unread indexes cover the bounded access paths.
- One email-delivery row is unique per notification and carries the same Owner through a composite `NO ACTION` FK. Lifecycle states are `PENDING`, `LEASED`, `RETRY_WAIT`, `DELIVERED` and `TERMINAL_FAILED`; attempts are constrained to `0..5`. PostgreSQL time, `SKIP LOCKED`, expiring 30-second leases and lease-token fencing provide one claimant and restart recovery.
- A crash during the fifth lease is atomically terminalized on the next claim pass. Failure persistence uses only closed safe codes (`TRANSIENT_PROVIDER_FAILURE`, `INVALID_RECIPIENT`, `PERMANENT_PROVIDER_REJECTION`, `UNKNOWN_SAFE`, plus internal lease-expiry code); raw provider exceptions, addresses, tokens and payloads are never stored. Permanent recipient/provider failures terminate immediately; transient failures wait five seconds and stop at five attempts.
- All source/Owner/hold/appointment/delivery FKs use `ON DELETE NO ACTION`; outbox cleanup cannot cascade-delete notification history. The repository reads only allowlisted Booking events and neither claims nor changes historical MIS/payment/telemed/insurance rows.
- A minimal `EmailSender` application port exists without provider implementation, credentials, SDK or dependency. No HTTP API, worker, Flutter UI or external email call is wired in this foundation slice. Booking transactions remain independent.
- Existing-database migration up, checksum verification, and full clean temporary-database migration from the first migration through `1719500000000` pass; the temporary database was removed. Focused PostgreSQL schema/dedup/Owner-scope/read/lease/retry/privacy/FK suite passes `10/10`; Node 22 backend build and `git diff --check` pass. Independent validation is `PASS / NO VETO` after repair of fifth-lease crash recovery and raw failure persistence.
- The `down` migration drops the email-delivery child before notifications. Once real notification data exists, rollback is destructive data loss and requires explicit operational authorization; it was not run against the working database. Retention/cleanup remains a future operational decision.

The selected continuation slice was `MVP-NOTIFY-01B / Booking Event Projection → In-App + Email Delivery`.

## `MVP-NOTIFY-01B / Booking Event Projection → In-App + Email Delivery`

`BLOCKED / MIGRATION_APPROVAL_REQUIRED / NO_IMPLEMENTATION` (2026-08-09).

- The 01A notification and delivery foundation is sufficient for durable projection, Owner-scoped read state, leasing and bounded retry, but it intentionally stores only authoritative `recipient_owner_id`. `EmailSender` requires a concrete `to` address.
- Targeted identity inspection proved that `identity_schema.users` stores only `id`/`created_at`, while `identity_schema.owner_identities` and Owner auth/profile flows store and expose only `phone_e164`. No verified email, contact-email, mailbox, authoritative email provider, or configuration-backed Owner contact source exists anywhere in the current backend schema/runtime.
- Consequently 01B cannot satisfy its hard recipient invariant (`notification Owner → authoritative Owner email`) without either a new identity/contact migration with verification/provenance semantics or a separately approved authoritative contact system. Accepting an address from HTTP/Flutter, deriving a synthetic address, or using an unverified config mapping would violate the security/privacy contract.
- The 01B brief requires `New migration: NONE` and explicitly mandates `STOP / MIGRATION_APPROVAL_REQUIRED` if another migration is necessary. No projector, API, worker, Flutter surface, schema, dependency, provider, Booking code, or runtime composition was changed. Existing 01A persistence and all protected dirty work remain intact.
- Independent architecture validation confirmed the blocker and found no missed authoritative Owner email source. Deterministic implementation/build tests were not run because the required email recipient contract cannot be implemented within the authorized boundary.

The previously proposed non-Jira slice `MVP-IDENTITY-EMAIL-01 / Owner Verified Email Contact Persistence and Verification Contract` is not authorized for execution and is superseded by the Jira-owned `SCRUM-755 / T131` contract: optional current-Owner email persistence/API/UI, without a separate verification auth-flow. No implementation of the superseded slice was started.

The selected Jira continuation slice was `SCRUM-635 / T011 — [RN] Создать структуру приложения и API-клиент` under parent `SCRUM-594 / S05`.

## `SCRUM-635 / T011 — React Native application structure and API client`

`COMPLETE / LOCAL_UNCOMMITTED` (2026-08-09).

- The delivery target is the new isolated npm package `apps/owner-app`: React Native `0.86.2`, Expo SDK `57.0.11`, Expo Router `57.0.11`, strict TypeScript and Expo Prebuild/CNG-compatible configuration. Archived Flutter remains read-only legacy and `apps/owner_mobile/**` is unchanged.
- The minimal router consists of the root layout and one placeholder route only. The root owns one TanStack Query `QueryClient` and provider. No authenticated shell, fake session, token persistence, product feature, Redux/Zustand or other global state was introduced.
- `src/api/client.ts` is the single typed fetch transport. It provides typed request/response bodies, bounded timeout and abort handling, JSON serialization and safe parsing, normalized HTTP/network/timeout errors, and correlation/request ID extraction. UI and route code do not call `fetch` directly or receive raw backend error payloads.
- `src/config/env.ts` is the single API base URL boundary. It accepts only absolute HTTP(S) URLs, contains no identity, token, credential or production endpoint, and keeps environment reads out of screens. `expo-secure-store` is installed only as the approved S04 foundation dependency; T012 owns session behavior and no storage adapter or token behavior was implemented here.
- Real scripts exist for start, Android, iOS, typecheck, lint and focused Jest tests. Foundation tests cover the initial placeholder, application provider/QueryClient, typed JSON transport, safe error normalization and configuration validation.
- Node 22 npm install, Expo Doctor `20/20`, Expo prebuild config evaluation, strict typecheck, lint and Jest `15/15` pass. iOS and Android evidence is static bundle/config validation only; simulator/device runtime was not claimed. `git diff --check` passes.
- Backend, schema, migrations, Clinic Portal, `.codex/config.toml`, and `apps/owner_mobile/**` received no T011 changes. Existing protected dirty state remains preserved.
- Independent architecture/security validation is `PASS / NO VETO` after repairing HTTP error-body normalization, pre-aborted request handling, direct root-layout coverage and unused template dependencies.

The next dependency-order candidate is `SCRUM-636 / T012 — [RN] Реализовать сессию и navigation shell`; it was not started and its Jira Definition of Ready must be confirmed before implementation.

The selected governance gate was `SCRUM-625 / T001 — [PO] Утвердить IN/OUT scope` under `SCRUM-590 / S01`.

## `SCRUM-625 / T001 — MVP IN/OUT scope readiness`

`READY_FOR_HUMAN_SIGNOFF / HUMAN_SIGNOFF_NOT_PERFORMED` (2026-08-09).

- The current normative Confluence page `01. Product — MVP Scope Freeze` (page `131074`, version 1, 2026-08-07) exists and is internally coherent. It fixes React Native as the Owner target; phone/OTP, pets, catalogue, server availability, request/manual clinic decision, authoritative status, cancellation/history, in-app plus optional email, Clinic Queue/Schedule and one-clinic manual-first pilot as IN. It fixes payment infrastructure, mandatory MIS, telemedicine, insurance, emergency routing, push/product SMS/Telegram, full clinical record and advanced BI as OUT. Alternative time is MVP Late and non-blocking.
- Jira `SCRUM-625` is still `К выполнению`; its description says content is ready and formal Product Owner + Technical Lead sign-off remains. Jira `SCRUM-626 / T002` and `SCRUM-759 / T135` are also `К выполнению` and linked downstream from T001. No human decision or decision date was inferred or written by Codex.
- Targeted downstream Jira review found no payment, mandatory-MIS, telemedicine, insurance, push/SMS/Telegram or alternative-time critical-path contradiction. `SCRUM-759 / T135` preserves the payment exclusion. `SCRUM-755 / T131` permits an optional Owner profile email only, states that booking works without email, and explicitly makes `email confirmation as a separate auth-flow` OUT OF SCOPE.
- Repository Pilot containment is coherent: `PILOT_V1` disables MIS/payment/telemedicine/insurance/emergency capabilities and module composition; Owner booking uses the manual-confirmation branch; alternative-time routes are blocked; the RN target is `apps/owner-app`; Flutter remains archived legacy. Existing legacy modules under `LEGACY_COMPAT` are not a Pilot contradiction.
- The stale non-Jira `MVP-IDENTITY-EMAIL-01` next-slice label was planning debt, not a downstream Jira/Confluence or implemented Pilot contradiction. It has been retired in this operational state record; all email work remains governed by `SCRUM-755 / T131`. Normative Jira and Confluence content was not altered.
- Downstream Jira contradictions: `NONE`. Repository Pilot contradictions: `NONE`. Production code, RN, Flutter, backend, schema, migrations and dependencies were unchanged by T001. Only readiness evidence and the stale planning label were corrected.
- Human PO+TL sign-off remains required. It must record the decision date and acceptance of the Scope Change Rule; Codex did not perform or impersonate that decision.

The human sign-off statement can be: “Подтверждаем Scope Freeze первого MVP в редакции от 2026-08-07. IN/OUT scope согласован; React Native является целевой Owner App; payments исключены; MIS не является обязательным для Pilot; email — необязательный канал без отдельного verification auth-flow; любое расширение требует отдельного решения Product Owner и Technical Lead.”

No subsequent Jira item was started. After human T001 sign-off, dependency order points to `SCRUM-626 / T002`; `SCRUM-759 / T135` follows according to its actual Jira link/dependency state.

The selected dependency gate was `SCRUM-626 / T002 — [SA] Зафиксировать продуктовые правила MVP` under `SCRUM-590 / S01`.

## `SCRUM-626 / T002 — Product rules reconciliation dependency gate`

`NOT_READY / DEPENDENCY_T001_SIGNOFF_REQUIRED / NO_SUBSTANTIVE_REVIEW` (2026-08-09).

- T002 explicitly depends on factual completion of `SCRUM-625 / T001`: Product Owner sign-off, Technical Lead sign-off and a recorded decision date. Machine readiness evidence from the preceding slice cannot substitute for those human approvals.
- Fresh Jira evidence shows `SCRUM-625` remains `К выполнению`, has no resolution and no comments/sign-off record, and was last updated on 2026-08-07. The current Confluence `MVP Scope Freeze` page still says it is content-ready but requires formal Product Owner + Technical Lead sign-off and a decision date.
- The hard precondition therefore failed. No T002 product-rule matrix, downstream Jira reconciliation, repository contract reconciliation, T140 delta analysis or next-task selection was performed. No rule, open decision or completion status was invented.
- Production code, RN, Flutter, backend, Portal, schema, migrations, dependencies, Jira and Confluence were unchanged. Only this local dependency-gate evidence was added.
- Required next action: Product Owner and Technical Lead must sign the Scope Freeze and record the decision date in the authoritative governance record. After that evidence exists, rerun T002 from its precondition gate.

The T002 content reconciliation was resumed under the user-authorized stable T001 content baseline; no claim was made that the Jira workflow or human sign-off had changed.

## `SCRUM-626 / T002 — MVP product-rule baseline reconciliation`

`BLOCKED_BY_PRODUCT_RULE_GAP / READY_FOR_RULE_CORRECTION / HUMAN_REVIEW_NOT_PERFORMED` (2026-08-09).

Normative sources were the approved 2026-08-07 content of Confluence `01. Product — MVP Scope Freeze` and targeted Jira contracts `SCRUM-679/T055`, `SCRUM-683/T059`, `SCRUM-684/T060`, `SCRUM-708/T084`, `SCRUM-710/T086`, `SCRUM-753/T129`, `SCRUM-754/T130`, `SCRUM-755/T131`, `SCRUM-756/T132`, `SCRUM-759/T135` and `SCRUM-764/T140`. Human T001/T002 workflow approval remains outside this machine reconciliation.

### Product-rule matrix

| Rule | Verdict | Reconciled evidence / remaining gap |
| --- | --- | --- |
| Owner auth | GAP | Phone/OTP is normative and backend identity exists; RN session delivery is not part of the current foundation. Email remains optional, is not login identity and has no verification auth-flow. |
| Owner authority | GAP | Backend ownership is authoritative for pets/bookings and notification persistence is Owner-scoped; Owner notification/profile HTTP delivery is still absent. Client-supplied Owner identity is never authority. |
| Pet rules | GAP | Own-pet/foreign-pet fail-closed booking rules exist; the RN create/select journey is not delivered. Full clinical/insurance profile remains OUT. |
| Clinic/service selection | GAP | Server-validated active clinic/location/service selection is normative; RN catalogue journey is not delivered. MIS/payment/telemed/insurance are not catalogue prerequisites. |
| Availability | GAP | PostgreSQL/server time, protected capacity and controlled stale conflict are authoritative; RN availability journey is not delivered. |
| Booking submit | GAP | PILOT backend produces protected `PENDING_CONFIRMATION`; RN booking submit is not delivered. Submit never implies confirmation. |
| Manual confirmation | PASS | PILOT uses manual confirmation without MIS; Clinic confirm produces authoritative `CONFIRMED` and preserves `confirmationMode=MANUAL`. |
| Clinic decline | PASS | Clinic decline projects `REJECTED`, distinct from cancellation and expiry. |
| Cancellation | GAP | Backend implements own-booking, pending/confirmed cancellation, capacity release, repeat safety and stale fencing; RN cancellation delivery is not implemented. No financial behavior exists. |
| Expiry | GAP | Backend expires pending protected capacity and preserves terminal state; RN authoritative presentation is not implemented. |
| Product statuses | GAP | Repository projection is `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `EXPIRED`, with internal states hidden. T059 texts/transitions and T140 machine baseline remain unfinished. |
| Queue semantics | PASS | Only actionable manual-pending requests remain in the active Queue; terminal results are not actionable pending work. |
| History | GAP | Immutable events/current authoritative state exist in parts, but T059/T060 user-safe history schema, visibility and delivery remain unfinished. |
| Idempotency | PASS | Create/confirm/decline/cancel retries are defined as one logical business effect and existing Booking evidence proves the critical paths. |
| Concurrency | PASS | One capacity unit cannot double-book; conflicting terminal commands yield one coherent authoritative result; stale writes are controlled conflicts. |
| Owner notifications | CONTRADICTION | T084 permits Owner confirmation/rejection/cancellation and alternative-time after S15. The current repository foundation also permits `booking.hold.created → PENDING_CONFIRMATION` and `booking.hold.expired → EXPIRED`; these extra Owner notification types are not authorized by the current T084 matrix. No worker/API/provider is wired yet. |
| Clinic notifications | GAP | T129 defines Queue + Portal bell and one configured clinic email. T132 includes new booking requests for the clinic recipient, plus confirmation/rejection/cancellation according to channel policy; delivery is not implemented. |
| Owner email | GAP | T131 owns optional current-Owner add/edit/remove with format validation and ownership protection. Persistence/API/RN UI are missing; separate verification auth-flow remains OUT. |
| Payment exclusion | PASS | T135 and Pilot containment allow informational price only; no payment state, CTA, dependency or cancellation financial effect enters PILOT. |
| MIS optional | PASS | PILOT is manual-first and starts without MIS modules/credentials; LEGACY_COMPAT does not redefine MVP. |
| Telemedicine exclusion | PASS | Disabled in PILOT composition/routes/capabilities; legacy code is contained. |
| Insurance exclusion | PASS | Disabled in PILOT composition/routes/capabilities; legacy code is contained. |
| Emergency exclusion | PASS | Disabled in PILOT composition/routes/capabilities; legacy code is contained. |
| Alternative-time non-blocking | PASS | It remains MVP Late and blocked from the current PILOT critical route; confirm/reject/cancel/status do not depend on it. |
| Error principles | GAP | No-leak authorization, validation, stale/conflict and safe technical failure principles exist; T140 must stabilize machine enums/schemas/examples. |

### Stable business rules

- Backend/PostgreSQL is business authority. Client clocks, optimistic UI, query/body Owner IDs and local success inference cannot establish identity, availability or terminal status.
- PILOT submit creates a protected manual request and Owner product status `PENDING_CONFIRMATION`. Clinic confirm, Clinic decline, cancellation and expiry produce distinct `CONFIRMED`, `REJECTED`, `CANCELLED` and `EXPIRED` outcomes. Terminal bookings are not active Queue work.
- Cancellation is Owner-scoped, applies to current pending and confirmed bookings under the existing fenced contract, releases capacity exactly once, is safe on logical retry, and has no penalty/refund/payment semantics.
- Owner channels are in-app first and optional email; Clinic channels are Queue/Portal bell first and one configured pilot-clinic email. Missing/failed email never changes Booking. Push, product SMS, Telegram and omnichannel delivery are OUT.

### Jira and repository consistency

- Jira gaps: T055, T059, T060, T084, T086, T129, T130, T131, T132, T135 and T140 remain `К выполнению`; their owned analysis, delivery and review gates must not be reported complete. T084 and T132 are reconcilable by recipient: `new booking request` is a Clinic signal under T132, not an additional Owner event under T084.
- Jira contradictions: `NONE` after applying that recipient distinction.
- Repository gaps are the RN product journeys, Owner/Clinic notification APIs and UI, optional Owner email profile, history delivery, provider wiring and generated OpenAPI baseline.
- Repository contradiction: the Owner notification foundation allowlist/copy includes `PENDING_CONFIRMATION` and `EXPIRED` beyond T084. This is the blocking rule gap; it must be resolved by T084 product ownership and reflected in T140 before notification projection/delivery proceeds.
- Open decisions: `NONE` without an owner. The notification event decision already belongs to T084; machine representation belongs to T140. No duplicate Jira item was created.

### T140 delta register

| Rule | Affected operation | Required machine contract | Current state / delta |
| --- | --- | --- | --- |
| Product status/readback | Owner create/read/cancel; Clinic confirm/decline | Closed five-value product enum, transition/error examples, `confirmationMode` semantics | Runtime projection exists; generated baseline/review remains T059/T140 work. |
| Cancellation | Owner cancel | Allowed-source states, `If-Match`, idempotency, normalized ownership/stale/terminal errors | Runtime is implemented; public schema/examples must be reconciled with T055. |
| History | Owner/Clinic status-history reads | Event schema, server ordering, display-safe visibility, no-leak errors | T059/T060 contract and delivery are incomplete. |
| Notification recipient/event matrix | Owner and Clinic notification projection/list/read/email | Explicit event × recipient × channel enum/table; dedup key; read state; safe copy | T084 Owner list excludes the foundation's pending/expired types; T132 new-request event is Clinic-directed. Resolve before wiring. |
| Owner email | Current-Owner profile read/update | Optional nullable email schema, validation error and Owner-only authorization; no verification flow | T131 delivery is missing. |
| Error principles | All first-MVP operations | Stable machine error codes/schemas/examples for auth, no-leak not-found, validation, stale/conflict and server failure | Principles exist; generated OpenAPI baseline remains incomplete. |

No production code, backend, RN, Flutter, Portal, migration, schema, dependency, Jira or Confluence content was changed by T002. Human DEV/QA/Technical Lead review was not simulated. Exactly one next Jira action is `SCRUM-708 / T084`: resolve and approve the Owner notification event matrix (specifically whether pending/expired are included); T140 and downstream notification delivery remain blocked on that decision. No next item was implemented.

## `SCRUM-708 / T084 — Owner notification normative matrix correction`

`PRODUCT_RULE_CORRECTED / READY_FOR_HUMAN_REVIEW / JIRA_DESCRIPTION_UPDATED` (2026-08-09).

- The Jira description for `SCRUM-708 / T084` now defines the closed Owner event/channel matrix: `PENDING_CONFIRMATION` creates neither an Owner in-app notification nor Owner email; `CONFIRMED`, `REJECTED`, `CANCELLED` and `EXPIRED` create an Owner in-app notification and optional email when an address is configured; `ALTERNATIVE_TIME_PROPOSED` follows the same channels only after S15 in MVP Late.
- Owner submit/readback itself presents `PENDING_CONFIRMATION`; a duplicate bell/email is not created. `new booking request` in T132 is explicitly a Clinic-side Queue/Portal/email signal, not an Owner notification.
- Safe exact copy is specified for every allowed Owner event. `REJECTED`, `CANCELLED` and `EXPIRED` remain distinct; expiry says that confirmation did not arrive in time and invites the Owner to choose another available time. Notifications start unread, support read state and link to the authoritative booking.
- T140 input now explicitly requires the closed event × recipient × channel matrix, event enum, notification schema, deduplication key, read state, booking link and safe copy. Optional email remains a notification contact, not a login identifier, and email failure cannot change Booking.
- Before/after verification preserved Jira identity and workflow metadata: summary `T084 [SA] Зафиксировать события и тексты владельца`, parent `SCRUM-612`, status `К выполнению`, null assignee, null priority and labels `ANALYSIS`, `M4`, `MVP`, `SUBTASK`, `gap-refined`, `vethelp-gap-202608`. Only the description was edited; no status, resolution, ownership or other Jira/Confluence item changed.
- Targeted repository reconciliation found no schema or migration conflict. The existing notification foundation already supports the retained terminal types and read/unread/booking linkage. `FOLLOW_UP_IMPLEMENTATION_DELTA`: remove the Owner projection `booking.hold.created.v1 → PENDING_CONFIRMATION`, retain `booking.hold.expired.v1 → EXPIRED`, and update focused projection tests when notification implementation resumes. No persistence enum/schema migration is required.
- The T002 Owner-notification contradiction is resolved at the product-contract level. The single next action is to rerun only the targeted `SCRUM-626 / T002` reconciliation against this corrected T084 baseline; it was not started here. Human Product Owner/Technical Lead review was not simulated.

No runtime, backend, RN, Flutter, Portal, schema, migration, dependency or test code changed in this bounded correction.

## `SCRUM-626 / T002 — Targeted reconciliation after T084 correction`

`READY_FOR_HUMAN_REVIEW / PRODUCT_CONTRADICTIONS_NONE / CONTRACT_ONLY` (2026-08-09).

- Only the previously blocking Owner-notification rule and its direct contracts were rechecked; the completed T002 baseline and its downstream implementation gaps were not reopened.
- `SCRUM-708 / T084` is now unambiguous. Owner notification result is `PASS`: `PENDING_CONFIRMATION` is authoritative submit/readback only and creates no Owner bell/email; `CONFIRMED`, `REJECTED`, `CANCELLED` and `EXPIRED` create Owner in-app notifications plus optional email when configured; `ALTERNATIVE_TIME_PROPOSED` remains MVP Late after S15 only.
- `SCRUM-753 / T129` remains consistent: Owner in-app is primary, email is optional, missing/failed email cannot affect Booking, and Push/SMS/Telegram are outside MVP. `SCRUM-755 / T131` consistently treats Owner email as optional notification contact, not login identity, and adds no separate verification auth-flow.
- `SCRUM-756 / T132` no longer conflicts with Owner events: its `new booking request` is the Clinic-side signal under the event × recipient × channel distinction. Confirmation, rejection and cancellation follow the corrected T084 Owner matrix.
- T140 input is stable: product statuses remain `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `EXPIRED`; Owner notification triggers are the four terminal product outcomes; alternative-time is separately gated after S15. T140 still owns the machine enum/schema/examples, deduplication, read state, booking link and safe-copy contract; OpenAPI was not implemented here.
- The repository foundation is compatible at the persistence boundary and already supplies authoritative source linkage, Owner scope, deduplication, read/unread and booking linkage. Its current `booking.hold.created.v1 → PENDING_CONFIRMATION` Owner projection is now an `IMPLEMENTATION_GAP`, not a product contradiction. Follow-up runtime work must remove that projection and its focused expectations while preserving `booking.hold.expired.v1 → EXPIRED`; no migration is expected.
- Remaining previously recorded `GAP` entries belong to existing downstream Jira tasks and do not block product-rule coherence. No product-rule question remains without an owner; no new Jira item was created.
- T002 therefore transitions from `BLOCKED_BY_PRODUCT_RULE_GAP` to `READY_FOR_HUMAN_REVIEW`. Its required DEV, QA and Technical Lead review was not simulated, so T002 is not classified `COMPLETE` and no Jira workflow field was changed.
- The single next Jira action is the human DEV/QA/Technical Lead review of `SCRUM-626 / T002`. No next implementation item was started.

No runtime, backend, RN, Flutter, Portal, schema, migration, dependency, Jira or Confluence content changed in this targeted rerun.

## `CODEX AUTONOMOUS DELIVERY — Bootstrap`

`CONFIGURED / RESTART_REQUIRED / NO_PRODUCT_IMPLEMENTATION` (2026-08-09).

- Project goals are enabled with `features.goals=true`. Project agents are enabled with a maximum of three concurrent threads; existing model, reasoning, sandbox, approval, MCP and unrelated configuration settings were preserved. Codex 0.145 treats legacy `agents.max_threads` and required `agents.max_concurrent_threads_per_session` as aliases and rejects both together as a duplicate field, so the value `3` was preserved under the required canonical key.
- Root `AGENTS.md` now records Jira/Confluence authority order, React Native Owner target and read-only Flutter boundary, autonomous checkpoint discipline, human gates, deterministic external-write limits and git safety.
- The detailed autonomous contract is `docs/ai/codex-autonomous-delivery.md`. It defines dependency-safe selection, machine versus Jira workflow state, DoR/task/review loop, discovery/test budgets, migration/dependency/product gates, external-write boundaries and nine batch stop conditions.
- Read-only project agents `jira-scout` and `reviewer` are configured. Project exec-policy rules forbid push, hard reset/clean, destructive checkout/switch, PR creation/editing and destructive Docker system/volume prune while leaving ordinary tests, status/diff and Compose operations available.
- Codex CLI `0.145.0` loads the merged configuration without startup warnings; `goals` and `multi_agent` are enabled. Built-in exec-policy checks confirm every destructive prefix is forbidden and ordinary `git status` / `docker compose up` are unmatched. Atlassian tooling is available through the existing connection; no second integration or credentials were added.
- Before/after config backups are stored outside the repository in `/tmp/vethelp-codex-bootstrap/`. `git diff --check` passes. Existing dirty product work is preserved; this bootstrap introduced no production source, schema, migration or dependency change.
- A fresh Codex session is required for the new project instructions, agent definitions and safety rules to become the effective runtime contract. The completed autonomous batch checkpoint remains targeted `SCRUM-626 / T002 = READY_FOR_HUMAN_REVIEW`; after restart, select another independent dependency-safe Ready Jira item rather than rerunning T002.

Immediate next action: restart Codex in this repository and resume the active VetHelp autonomous goal.

## `SCRUM-631 / T007 — MVP architecture invariants reconciliation`

`READY_FOR_HUMAN_REVIEW / ARCHITECTURE_CONTRACT_STABLE / CONTRACT_ONLY` (2026-08-09).

- DoR is satisfied for machine reconciliation: T007 depends only on S01 Scope Freeze; its content is stable at `SCRUM-626 / T002 = READY_FOR_HUMAN_REVIEW`, with no remaining product contradiction. Missing human workflow approval was not treated as a new architecture decision.
- The current normative source is Confluence `04. Architecture — MVP baseline` (page `229414`, current, modified 2026-08-07). Its component ownership is unambiguous: React Native Owner App owns presentation only; NestJS/Booking Core and PostgreSQL own identity/session rules, availability, booking state/events, concurrency, TTL and notification projection; Clinic Portal is a capability-aware client; IdP/provider identity never replaces VetHelp membership authority.
- Target/runtime classification is coherent: `apps/owner-app` is `NEW` React Native + Expo; `apps/clinic-portal` is `REUSE + MODIFY`; NestJS Booking Core and PostgreSQL are `REUSE + MODIFY`; `apps/owner_mobile` is `LEGACY / READ-ONLY`. Existing payment, telemedicine, insurance and emergency code remains isolated from `PILOT_V1` composition and does not expand MVP.
- Targeted repository evidence matches the baseline: Owner App uses Expo Router, TanStack Query and SecureStore; Clinic Portal is Next.js with Playwright; backend retains NestJS, PostgreSQL/node-pg-migrate and generated Swagger/OpenAPI; effective-scope composition omits payment/telemedicine/insurance/emergency modules under Pilot, including OwnerHome's transitive Telemed import.
- Architecture invariants are stable: backend/PostgreSQL authority, server-time decisions, backend Owner/clinic/location isolation, retry-safe state changes, no payment domain or mandatory MIS in the Pilot critical path, and alternative-time as an additive later extension. The feature refinement checklist remains mandatory: component/module, `NEW/MODIFY/REUSE`, operationId or `N/A`, persistence/migration, events/integrations, authority boundary, concurrency/idempotency and compatibility/deploy order.
- Remaining items are downstream implementation or review gates, not architecture contradictions: actual pilot-clinic configuration, Clinic IdP integration completion, optional email adapter/provider decision, RN feature delivery, generated OpenAPI reconciliation and telemetry/privacy refinement. Provider selection or external credentials were not invented.
- No Jira/Confluence, production code, schema, migration, dependency or runtime behavior changed. Required Tech Lead/SA/BE review was not simulated, so T007 is not `COMPLETE` and Jira workflow remains unchanged.
- Next dependency-safe candidate is `SCRUM-629 / T005`, subject to targeted validation that its S02 business baseline is stable; the full product audit must not be repeated.

## `SCRUM-629 / T005 — Booking business/state/API baseline reconciliation`

`READY_FOR_HUMAN_REVIEW / CONTRACT_RECONCILED / CONFLUENCE_UPDATED` (2026-08-09).

- Targeted DoR passed for contract work. S01 product semantics are stable at T002 machine readiness. S02 remains externally blocked on naming a real pilot clinic and contacts, but its applicable core envelope is already stable and explicit: one-clinic manual-first processing, no mandatory MIS/payment, authoritative backend state, real availability, Queue confirm/reject, safe readback and optional email. Clinic identity, timezone, contacts, volume and onboarding data are configuration inputs and do not determine the generic Booking state/API baseline.
- The authoritative T005 source is Confluence `03. Business & System Analysis — Booking MVP` (page `786453`). Targeted comparison against T059/T084/T002 found and deterministically corrected two stale contract statements: `EXPIRED` is now a public terminal BookingStatus reached by SYSTEM after the authoritative confirmation deadline, with immutable `BOOKING_EXPIRED`; the later proposal event is named `ALTERNATIVE_TIME_PROPOSED`, while accept/reject commands/events remain owned by S15.
- The closed core product status set is now consistent across the baseline: `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `EXPIRED`. Expiry is distinct from Clinic rejection and Owner cancellation. The existing actor, ownership, server-time, conflict, idempotency, no-false-success, correlation and immutable-event rules remain unchanged.
- T084 notification semantics remain intact: PENDING is submit/readback and not an Owner notification; the four terminal outcomes trigger Owner in-app plus optional email; alternative-time is MVP Late. T140 input is therefore stable for product enum, transition/error examples and event names, but generated OpenAPI remains downstream work and was not implemented here.
- Confluence page versions 2 and 3 contain only the two deterministic reconciliations above; after-read confirms the old EXPIRED exclusion and old alternative event name are absent. No Jira workflow field, other Confluence page, production code, schema, migration or dependency changed.
- Remaining T005 DoD gates are human SA/BE/QA/Architecture review and downstream synchronization through T059/T140. They were not simulated, so T005 is not `COMPLETE`.
- Next dependency-safe candidate is `SCRUM-633 / T009`, subject to checking T007 machine-stable architecture content as its effective S03 prerequisite; no Expo/Bare comparison should be repeated if the linked ADR is already decisive.

## `SCRUM-633 / T009 — Expo + Prebuild Owner App ADR reconciliation`

`READY_FOR_HUMAN_REVIEW / ADR_DECISION_STABLE / CONTRACT_ONLY` (2026-08-09).

- DoR passed for machine work: T009 depends on S03; the applicable product/business and architecture content is stable at T005 and T007 machine readiness. Their remaining gates are formal human review and downstream delivery, not an unresolved choice capable of changing the mobile runtime decision.
- The current normative source is Confluence `08. Mobile Architecture — Expo + React Native` (page `884738`, current, modified 2026-08-07). It decisively selects React Native on Expo SDK 57 with Prebuild/CNG; Bare RN is not the first-MVP starting runtime. Reconsideration requires a demonstrated native SDK, reproducibility, Expo blocking defect, store or security constraint; none is currently evidenced.
- Targeted repository compatibility matches the ADR: `apps/owner-app` pins Expo `~57.0.11`, React Native `0.86.2`, Expo Router, SecureStore and TanStack Query; TypeScript is strict; npm and the lockfile are present. Expo public config resolves the Router, splash and SecureStore plugins under Node 22, demonstrating a valid CNG/config-plugin foundation. `apps/owner_mobile` remains legacy read-only reference.
- Node 22 focused TypeScript validation passes. Expo public-config resolution passes and exposes no backend/provider credentials in the inspected public structure. The first shell attempt used unsupported Node 18 and produced non-JSON CLI output; it did not identify a product defect. The required Node 22 retry passed, and the final config invocation used the CLI's JSON mode.
- Remaining mobile-platform work is downstream implementation, not an ADR blocker: replace the current static `app.json` with the normative environment-aware `app.config.ts`, add development/test/pilot EAS profiles, encode iOS 16+/Android API 29+ build settings, and establish signed-build/CI evidence when the owning Jira items execute. No provider credentials or release action was introduced.
- No Confluence/Jira workflow, production code, package, lockfile, dependency, native project, schema or migration changed. Required Tech Lead sign-off was not simulated; T009 is not `COMPLETE`.
- This autonomous batch has reached five completed checkpoints. Stop condition 1 applies. The next recommended dependency-safe candidate for a future batch is `SCRUM-634 / T010`, using this stable ADR without reopening Expo-versus-Bare selection.

Correction to checkpoint accounting: the autonomous-delivery bootstrap is infrastructure, not a Jira checkpoint. T010 was therefore executed as the fifth Jira checkpoint before applying the batch stop.

## `SCRUM-634 / T010 — Owner App navigation, state and security baseline reconciliation`

`READY_FOR_HUMAN_REVIEW / MOBILE_CONTRACT_STABLE / CONTRACT_ONLY` (2026-08-09).

- DoR passed for machine reconciliation: T010 depends on T009, whose Expo SDK 57 + Prebuild/CNG ADR is stable and has no demonstrated runtime blocker. The remaining Tech Lead sign-off is a human gate, not an unresolved stack decision.
- The linked Confluence mobile architecture page `884738` gives one coherent baseline: Expo Router as the only navigation layer; TanStack Query for server state; React state/context only for bounded client state; SecureStore only for session-sensitive material; one typed fetch client; centralized environment/error/timeout/correlation behavior; route identifiers followed by authoritative reads; no UI authority or secrets in the binary.
- The existing T011 foundation is compatible: one root Router stack is mounted inside one QueryClient provider; the API client is the only production `fetch` site, centralizes base URL, timeout/abort, JSON transport, correlation IDs and safe status normalization; strict environment parsing accepts only absolute HTTP(S) base URLs; no Redux/Zustand/MobX or second navigation/API layer exists.
- Focused Node 22 tests pass `14/14` across root Router/provider composition, API client normalization/abort/network behavior and environment validation. The preceding Node 22 TypeScript check also passes. No production code was changed in this contract checkpoint.
- T010 does not falsely claim downstream session delivery. SecureStore session adapter, bootstrap-before-protected-render, public/authenticated route groups, invalid/expired handling, logout cleanup, owner Query-cache cleanup and safe re-auth remain the bounded implementation scope of `SCRUM-636 / T012`. Machine error coverage for not-found/rate-limit and feature-specific authoritative readback also remains downstream contract/feature work.
- No Jira/Confluence, package, lockfile, dependency, native project, runtime, schema or migration changed. Required Tech Lead review was not simulated, so T010 is not `COMPLETE`.
- Five Jira checkpoints are now complete: T002, T007, T005, T009 and T010. Autonomous-delivery stop condition 1 applies. The next recommended dependency-safe Jira item is `SCRUM-636 / T012`: T010 is machine-stable and T011 foundation is already delivered; T012 was not started in this batch.

## `SCRUM-636 / T012 — Owner App secure session and navigation shell`

`IMPLEMENTED / SECURITY_VALIDATED / READY_FOR_HUMAN_REVIEW / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR passed: T010 navigation/state/security rules are machine-stable and the T011 Expo/Router/Query/API foundation exists. The implementation stays inside `apps/owner-app`; Flutter legacy, backend, schema and migrations are untouched.
- Added a minimal opaque session abstraction without inventing JWT claims, Owner identity or a backend endpoint. Session material contains only an opaque credential, opaque cache scope and expiry epoch; it is persisted exclusively through Expo SecureStore and never logged. Client session state gates presentation only and does not replace backend authority for protected API operations.
- Root navigation now has one centralized Expo Router boundary. During bootstrap and security transitions neither route group is mounted; missing/invalid/expired material routes public, and valid unexpired material routes authenticated. Public and authenticated groups are physically separate; logout removes the protected group, so stale navigation state cannot preserve access.
- Invalid/malformed and expired material is removed fail-closed. Active expiry is enforced by a timer and rechecked when the app returns active. Expiry removes only the exact owner/session cache scope and routes public even when SecureStore deletion reports a technical failure.
- Logout is serialized with session establishment: it shows a protected-neutral transition, publishes public only after SecureStore deletion succeeds, and removes only `['owner', cacheScope, ...]` queries. Public/catalog and other owner scopes remain intact; `queryClient.clear()` is not used. A deletion failure restores the authenticated shell, preserves its cache and exposes only a generic retryable error. Re-authentication uses the same establishment/bootstrap boundary and cannot race an earlier delete.
- OTP provider/business flow and production auth-header/backend validation remain downstream S07/OpenAPI integration gaps. No AsyncStorage, hardcoded user/Owner identity, second navigator/store/client, token/cookie logging or fake success was introduced.
- Focused evidence: initial T012 matrix `25/25` PASS; final security-focused Router/store/session matrix `14/14` PASS with no open handles; post-review session regression `10/10` PASS; Node 22 TypeScript and Expo lint PASS. Independent security review found three vetoes (logout false success, live expiry, logout/reauth race); one bounded repair closed all three, and final verdict is `PASS / NO VETO` including bootstrap-expiry cleanup failure.
- Required human code review was not simulated; Jira workflow remains `К выполнению`. No commit, push, PR or deploy occurred.
- Dependency selection: T013 is `NOT_READY` because T143 depends on unfinished T142/Figma. T016 is `NOT_READY` until T014 plus T095. T014 and T015 are start-ready from the existing S05 foundation; checkpoint 2 selects `SCRUM-638 / T014` because it establishes CI/build artifacts required by later QA/diagnostics. T092 is required for final environment-isolation synchronization, not for starting mobile CI.

## `SCRUM-638 / T014 — Owner App CI and native build foundation`

`IMPLEMENTED_FOUNDATION / EXTERNAL_BUILD_EVIDENCE_PENDING / READY_FOR_HUMAN_REVIEW / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR passed for bounded implementation: the S05 Expo SDK 57 / Prebuild foundation exists. T092 remains the owner of final cross-system environment isolation, but does not block establishing the mobile CI/build boundary.
- Added a path-scoped GitHub Actions workflow using Node 22, npm lockfile install, Expo Doctor, lint, strict TypeScript, Jest, fail-closed test/pilot public-config evaluation and CNG prebuild. Signed EAS builds are manual dispatch only, have read-only repository permission, use a choice-bounded platform/profile input and consume `EXPO_TOKEN` only from GitHub secrets. No publish, submit or deployment action exists.
- Replaced the static Expo config with an environment-aware CNG config for local/test/pilot. Test and pilot have distinct names, schemes, bundle/package identifiers and require explicit HTTPS API URLs; embedded URL credentials and unknown environments fail closed. Public build metadata is limited to source SHA/EAS build ID. iOS deployment target is `16.4` (the Expo SDK 57-supported member of the approved iOS 16+ baseline) and Android minimum SDK is 29.
- Added development/test/pilot EAS profiles. EAS CLI is pinned to `21.7.0`; test and pilot use authoritative remote app-version state with auto-incremented native build versions and internal distribution. API endpoints, signing material and provider credentials are not committed.
- Added a delivery runbook covering environment separation, external EAS/GitHub setup, gates, build evidence, promotion and rollback. T014 does not claim signed Android/iOS artifacts: EAS project linkage, `EXPO_TOKEN`, signing credentials and actual remote build records are external required evidence.
- Added only the required Expo build-properties config-plugin dependency. Node 22 evidence: Expo Doctor `20/20`, Expo lint PASS, strict TypeScript PASS, Jest `35/35` PASS, config isolation/fail-closed matrix `7/7` PASS, test/pilot public-config assertions PASS, scratch Expo prebuild PASS with Android min SDK 29 and iOS target 16.4. EAS CLI `21.7.0` resolves successfully. `npm ci` reports the existing dependency-tree audit state of 23 advisories (8 moderate, 15 high); no unreviewed audit rewrite was applied.
- Independent review initially vetoed credential-bearing URLs, mutable EAS CLI selection and unreliable native version identity. Minimal repairs added URL credential rejection, pinned the CLI, moved signed build versions to EAS remote auto-increment and removed misleading local build-number metadata. Final verdict: `PASS / NO VETO`.
- Human DevOps/mobile review and real signed-build evidence remain pending; Jira workflow remains `К выполнению`. No commit, push, PR, Jira transition or deploy occurred.
- Checkpoint 3 selects `SCRUM-639 / T015`: its S05 dependency is machine-stable and real T012 session/navigation integration scenarios already exist. Black-box Maestro execution will remain explicitly gated by a T014 test artifact and external device/simulator availability.

## `SCRUM-639 / T015 — Owner App mobile test foundation`

`IMPLEMENTED_FOUNDATION / EXTERNAL_SMOKE_EVIDENCE_BLOCKED / READY_FOR_HUMAN_REVIEW / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR passed for foundation work: the S05 application skeleton exists and T012 supplies real session/navigation behavior and expected states. Jira remains `К выполнению`; no workflow transition was made.
- The executable Node/Jest foundation now covers typed client success and safe 401/403/409/422/5xx/network/abort behavior, environment/config validation, SecureStore serialization, bootstrap pending/absent/valid/invalid/expired states, live expiry, public/authenticated navigation, logout, exact Owner cache cleanup, cleanup failure and serialized re-auth. No fake auth screen, hardcoded identity or production test backdoor was added.
- Added a bounded Maestro black-box smoke for the actual `ru.vethelp.owner.test` artifact: clear application state, launch and assert the real public no-session screen. Authenticated/invalid/expired storage injection is not exposed through production UI; those paths remain proven at the real adapter/provider integration boundary until an approved test-artifact mechanism exists.
- Added the QA matrix and evidence contract, including near-minimum iOS 16.4 / Android API 29 and current supported iOS/Android configurations. Each execution must record artifact build ID, source SHA, OS/device and result. Backend concurrency/idempotency remains backend-test authority.
- Local evidence: final Owner App Node 22 lint/typecheck and Jest matrix PASS; Maestro YAML and workflow YAML parse PASS; tracked and explicitly enumerated untracked `git diff --check` PASS. Maestro itself is not installed locally and no signed test artifact/device matrix is available, so smoke/device execution is explicitly unclaimed.
- Independent reviewer verdict: `PASS / NO VETO`; it confirmed executable foundation coverage, real T012 scenarios, bounded Maestro reproducibility, device matrix and honest external-evidence status. A vacuous negative Maestro assertion was removed after the review observation.
- T015 Done remains blocked by external inputs: a signed T014 test artifact, EAS/GitHub credentials and actual near-min/current device or simulator capacity. This satisfies the autonomous stop condition for external credentials/real-world input; proceeding to T016 is also prohibited until T095 is stable. T013 remains blocked by T143→T142/Figma. No additional Jira checkpoint is started in this batch.

## `SCRUM-719 / T095 — MVP telemetry and privacy contract`

`READY_FOR_HUMAN_REVIEW / CONTRACT_STABLE / CONFLUENCE_UPDATED / RUNTIME_UNCHANGED` (2026-08-09).

- DoR passed: S03 has a stable critical booking path and explicit RN/Web/backend/PostgreSQL boundaries. Normative result is Confluence `11. Observability — Telemetry & Privacy Contract` (page `1835010`, version 2).
- Canonical correlation is `X-Correlation-ID` over HTTP and `correlation_id` in telemetry. RN/Web creates a bounded opaque UUID; backend accepts only valid single UUID input, replaces missing/malformed/duplicated input, returns the effective ID and propagates it through events/workers. Correlation is never identity, authority or a metric label; mobile release/build metadata uses separate fields.
- The contract defines bounded producers/consumers, structured-log allowlists, low-cardinality request/latency/booking/dependency metrics, closed technical error classes, dashboard inputs and alert candidates. Individual expected validation/auth/not-found/conflict outcomes are diagnostics, not alerts unless an aggregate anomaly threshold is separately configured.
- Denylist covers OTP, session/access/refresh tokens, Authorization/Cookie, full phone/email, secrets/credentials, raw bodies/headers/query/URLs, and Owner/pet free text across logs, metrics, traces and client diagnostics. Redaction is allowlist-first and fail closed; secrets are dropped, never masked/hashed. No analytics identity or session replay is authorized.
- Concrete retention duration was not invented. T096/DevOps owns the least-privilege retention/access configuration with Tech Lead and privacy/security approval before pilot traffic; test and pilot telemetry stores/credentials remain separate.
- Repository comparison found valid UUID generation/response propagation and event context reuse, plus explicit gaps: generic logger accepts arbitrary fields/raw errors, duplicate headers currently accept the first value, and RN accepts unvalidated response IDs. New Backend subtask `SCRUM-768` owns fail-closed safe-field/redaction hardening and tests. T097 owns RN/Web request/response correlation validation.
- Independent security review initially vetoed the missing enforcement owner/gate and overstated compatibility. Version 2 assigns `SCRUM-768` and blocks production/pilot ingestion, alert forwarding, dashboards and client diagnostics until the applicable hardening gates pass. Re-review: `PASS / NO VETO`.
- Jira `SCRUM-719` received a deterministic evidence comment linking the page/review; its workflow status remains `К выполнению`. Tech Lead + QA agreement is still required. No runtime, schema, migration, dependency or provider integration changed.
- T095 makes T096/T016/T097 estimable, not activation-ready. T016 additionally retains T014 signed-build evidence and SCRUM-768/client-safety gates. `NEXT_READY_JIRA_ITEM`: verify `SCRUM-641 / T017` and only its direct dependencies/normative OTP source.

## `SCRUM-641 / T017 — Owner OTP semantics and errors`

`DECISION_REQUIRED / CONTRACT_SKELETON_COMPLETE / CONFLUENCE_UPDATED / RUNTIME_UNCHANGED` (2026-08-09).

- Direct dependency check: T017 depends on S05, whose Owner App/session foundation is machine-stable. Normative sources are the Jira refinement, S03 UX OTP states and API operations, plus new Confluence `12. Owner Auth — OTP Semantics & Errors` (page `1867791`, version 2).
- The contract separates challenge creation, send/resend, verify, success, invalid, expired, rate-limited, temporarily blocked, provider unavailable and ambiguous timeout. Server time/state is authoritative; resend supersedes earlier OTP material; verification is one-time, replay-safe and has one atomic winner. Provider failure/timeout never creates a session or UI success.
- Machine error codes, safe Russian user messages and client actions are explicit without exposing account existence, provider details, raw messages or full phone. HTTP status/envelope and session token schemas remain T140/T018 work; no JWT/refresh-token contract was invented.
- Security boundaries require high-entropy unguessable challenge IDs; challenge-bound offline-guess-resistant OTP verifier material using a separately managed key/pepper or approved equivalent; constant-time comparison; no raw/reversible OTP persistence; replica-safe counters; and client IP derived only from normalized trusted-ingress/direct-connection evidence with spoofed forwarding headers ignored.
- Authoritative quantitative values do not exist. OTP TTL, resend interval, maximum verify attempts, phone/IP limit windows, phone/IP block durations, provider timeout and bounded retry remain explicit `TBD` decisions for Product + Security/Technical Lead. Values must be server-configurable and record approvers/date. Therefore T018/T126 are not machine-ready.
- T124 remains independently actionable because provider-neutral inputs/results/error taxonomy and no-double-send timeout semantics do not require choosing these numbers or a commercial provider.
- Independent security review vetoed weak low-entropy OTP hashing language and the missing trusted-proxy IP boundary. Version 2 repaired both and expanded the required test matrix; re-review: `PASS / NO VETO`.
- Jira `SCRUM-641` received a deterministic evidence/decision-gap comment. Jira status remains `К выполнению`; no human agreement was simulated. No runtime, schema, migration, provider, dependency or mobile session change occurred.
- `NEXT_READY_JIRA_ITEM`: verify `SCRUM-748 / T124` and its direct Jira dependencies. `SCRUM-747 / T123` provider selection remains explicitly outside this batch.

## `SCRUM-748 / T124 — SMS-provider adapter contract`

`READY_FOR_HUMAN_REVIEW / CONTRACT_STABLE / CONFLUENCE_UPDATED / RUNTIME_UNCHANGED` (2026-08-09).

- Jira dependency direction was verified after an independent-review veto corrected the initial interpretation: T124 `blocks` T123; T123 is `blocked by` T124. Therefore the provider-neutral contract is Ready without selecting a commercial SMS provider. T123 was not executed.
- Normative result is Confluence `13. Owner Auth — SMS Provider Adapter Contract` (page `1769475`, version 3). It defines one semantic `sendOtp` port with high-entropy delivery attempt/challenge references, normalized E.164 destination, ephemeral OTP, closed template key, authoritative expiry, validated correlation and trusted timeout configuration.
- Results distinguish provider `ACCEPTED` handoff from handset delivery/verification and normalize rejected, rate-limited, auth/config, unavailable, timeout, unexpected, cancelled and internal outcomes with explicit `ACCEPTED / NOT_SUBMITTED / UNKNOWN` submission certainty. Raw provider errors/status/body/headers never cross the adapter or reach RN.
- The adapter performs zero internal automatic retries. Durable `PREPARED → CLAIMED → POSSIBLY_DISPATCHED → terminal` fencing prevents replica races: only proven pre-I/O claims may be reclaimed; crash/lease loss after possible I/O becomes `UNKNOWN` and the same attempt is never redispatched. Exactly-once is not claimed without provider-native idempotency.
- Provider configuration is fail-closed to HTTPS and a fixed allowlisted host/port/path. URL credentials, unsafe schemes/paths, loopback/private/link-local/multicast/unspecified/metadata destinations, DNS rebinding and unsafe redirects are rejected; every permitted connection/redirect is revalidated and TLS hostname/SNI verification cannot be disabled.
- T095 privacy rules apply: OTP/full phone/credentials/provider payloads are forbidden in telemetry; metrics use closed low-cardinality fields; SCRUM-768 remains the alert/ingestion activation gate. T127 owns environment secrets/sandbox and T092 owns test/pilot isolation.
- Independent review first vetoed missing crash-window semantics and SSRF endpoint controls. Version 2 fixed durable fencing; version 3 published the endpoint/DNS/redirect controls and matching crash/stale-worker/two-replica/SSRF tests. Final verdict: `PASS / NO VETO`.
- Jira `SCRUM-748` received a deterministic evidence comment. Jira status remains `К выполнению`; Tech Lead + Backend + Security agreement remains pending. No runtime interface, SDK, dependency, schema, migration, provider selection or credentials were added.
- T123 is now the next dependency-order item but remains an external/commercial human task requiring real provider, price, sender-registration, sandbox/account and delivery evidence. T125 remains blocked by T123, T127 and the T018 seam.
- T018 remains `NOT_READY` despite stable T124: T017 still has unresolved quantitative Product/Security decisions for TTL, resend, attempts, phone/IP limits and temporary blocks, and T140 must finalize the session/OpenAPI shape. T016 readiness is unchanged: T014 signed-build evidence, SCRUM-768 and client diagnostics safety remain gates.
- This batch reached its explicit limit of exactly three completed Jira checkpoints: T095, T017 and T124. `NEXT_READY_JIRA_ITEM`: `SCRUM-747 / T123` for human/external provider selection; no fourth checkpoint is started.

## `SCRUM-665 / T041 — Booking Core invariants`

`CONTRACT_STABLE / INDEPENDENT_REVIEW_PASS / IMPLEMENTATION_DELTAS_EXPLICIT / READY_FOR_HUMAN_REVIEW` (2026-08-09).

- Direct DoR was reconciled with T005 and T033. Normative result is Confluence `14. Booking Core — Transaction, Concurrency & Lifecycle Contract` (page `1835030`, version 3).
- The contract chooses one multi-capacity slot model: every active hold/appointment consumes exactly one counter unit and `0 <= held_count + booked_count <= capacity`. Counters are the authoritative capacity ledger; guarded one-row updates, drift detection and audited recovery are explicit.
- Global Pilot lock order is idempotency → prerequisite ownership row → hold → sorted slots. Creation is idempotency → pet → slot because the hold does not yet exist. Bounded lock timeout rolls back and returns `SLOT_LOCKED_RETRY`/readback semantics; `SKIP LOCKED` remains background-only.
- Pilot idempotency records are retained indefinitely with cleanup disabled. Same key/fingerprint replays; changed fingerprint conflicts. Finite cleanup, distributed/advisory locks, client/Redis TTL authority, optimistic-only locking, synchronous publication and capacity-1 uniqueness were explicitly rejected.
- Public status is exhaustively limited to `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `EXPIRED`; raw internal fallback is forbidden. Canonical expiry business fact is `BOOKING_EXPIRED`, with SLA breach allowed only as additional operational evidence.
- Existing slot→hold/joint-lock paths, confirm/decline idempotency ordering, optional create fencing, raw-state fallback and missing canonical expiry event are recorded as runtime deltas; T041 did not change runtime/schema/migrations.
- Independent architecture/concurrency review initially vetoed lock order, capacity, retention, state/event, fencing, conservation and rollout overclaims. Version 3 closed the contract decisions and final verdict is `PASS / NO RESIDUAL VETO`. Jira received evidence comment `10004`; workflow/human approval was not simulated.

## `SCRUM-683 / T059 — Booking status, history and user copy`

`CONTRACT_STABLE / SECURITY_REVIEW_PASS / IMPLEMENTATION_DELTAS_EXPLICIT / READY_FOR_HUMAN_REVIEW` (2026-08-09).

- Normative result is Confluence `15. Booking Status, History & User Copy Contract` (page `2195465`, version 3), reconciled with S14, S16, T005 and T041.
- Exactly five public statuses, actors/transitions, distinct Owner/Clinic labels and next actions, server-time authority, stale/technical/empty semantics and same-key replay versus fresh-command conflict are explicit. S15 alternative time remains a later additive event and does not expand the base enum.
- Public history is a separate allowlist-only projection. Owner and Clinic rows exclude raw outbox payload, trace/causation, integration mode, internal state, free text and raw staff IDs. `aggregateVersion` and `correlationId` remain internal/technical-evidence fields rather than general timeline fields.
- The current Owner-accessible raw event replay is classified internal-only and noncompliant for S17. T060/T140 must add projected history with normalized hidden `404`, stable `(occurredAt,eventId)` cursor and populated create/decline no-leak tests. Current raw state fallback and legacy 422/stale codes are also explicit blocking deltas.
- Independent review initially vetoed non-exhaustive state leakage, raw replay visibility and ambiguous replay/conflict outcomes; the final version closed all semantic contradictions. Final verdict: `PASS / NO RESIDUAL VETO`. Jira received evidence comment `10005`; human SA/DEV/QA approval was not simulated.

## `SCRUM-764 / T140 — Generated OpenAPI baseline`

`BLOCKED_IMPLEMENTATION_GAPS / GENERATED_ARTIFACT_IMPROVED / DEPENDENT_CLIENTS_NOT_READY / LOCAL_UNCOMMITTED` (2026-08-09).

- Existing NestJS Swagger generation remains the sole machine pipeline; no parallel generator or fake endpoint was introduced. Confluence `05. API — MVP baseline v0.1` (page `655395`, version 5) now reconciles the five-value `BookingStatus`, actual reused paths and explicit missing operations/schemas.
- The generator now preserves every previously unique operationId and controller-qualifies only method names that collide. It also removes case-insensitive duplicate inferred/decorated operation parameters while retaining the explicit documented header. The validator fails on missing/duplicate operationIds, duplicate parameters, an expanded BookingStatus or missing common error fields.
- Generated `BookingStatus` is exactly `PENDING_CONFIRMATION|CONFIRMED|REJECTED|CANCELLED|EXPIRED`; `ApiErrorDto` documents machine code/message plus optional UUID correlation and bounded details. Node 22 build/export/assert passes with `110/110` unique operationIds and no duplicate headers.
- T140 is deliberately not Done. The generated public `HoldDto` still requires raw internal `state`, makes canonical status optional and lacks `lastUpdatedAt`; GET hold lacks a 200 DTO. Critical create/read/cancel/confirm/decline operations also lack the complete applicable error-schema matrix. Owner/Clinic notification and projected-history routes remain real implementation gaps rather than fabricated operations.
- These gaps block affected RN/Web/QA consumers and T018 session-shape completion. Independent API review initially returned VETO; the bounded repair removed operationId/header regressions and changed the checkpoint to an explicit deterministic blocker. Final review verdict: `PASS` for the honest blocked outcome, with no residual factual overclaim. No new route, business capability, dependency, migration, provider or OTP threshold was added. Jira received evidence comment `10006`.
- This batch has processed exactly three dependency-safe checkpoints: T041, T059 and T140. Stop after T140. `NEXT_READY_JIRA_ITEM`: `SCRUM-768` telemetry redaction hardening; it is recorded only and was not started.

## `SCRUM-768 — Backend telemetry redaction hardening`

`IMPLEMENTED / SECURITY_VALIDATED / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR was rechecked against the stable T095 telemetry/privacy contract. A central fail-closed sanitizer now admits only closed field/value registries, UUID identifiers, bounded primitives and the exact redacted Registry route template. Reserved framework fields, unknown/nested values, raw errors, credentials, OTP, tokens, cookies, full phone/email and arbitrary free text are dropped.
- Context, message and correlation are separately validated. Accessor/inherited fields are never invoked; sanitizer failures drop caller fields. Duplicate, combined or malformed correlation input is replaced by the existing server authority. Alert forwarding independently re-sanitizes both direct payloads and JSONL input.
- Node 22 Docker evidence: focused telemetry/correlation/alert matrix `33/33` PASS, backend build PASS and `git diff --check` PASS. Independent security review found and then verified repairs for code-shaped secrets, getter/proxy bypass, direct-forward bypass and Registry access-log compatibility; final verdict `PASS / NO VETO`.
- No Sentry/mobile diagnostics/dashboard/provider/schema/migration work was added. Human Jira acceptance was not simulated.

## `SCRUM-684 / T060 — Authoritative booking read model and public history`

`IMPLEMENTED / CONTRACT_VALIDATED / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR passed against machine-stable T059. Pilot current readback now exposes a required closed five-status projection and no raw internal `state`; `lastUpdatedAt` uses the authoritative hold update timestamp. Legacy readback remains profile-compatible.
- Added `/v1/booking-holds/:holdId/history`: current canonical status plus allowlist-only append-only audit history with safe event type, server occurrence time, normalized Owner/Clinic/System source and booking linkage. Raw outbox replay is now SYSTEM_WORKER-only. Public history excludes payloads, actor IDs, internal state, trace/causation and correlation technical evidence, following T059 as the explicit normative authority where Jira summary wording was broader.
- Owner and Clinic authority derives from JWT and existing membership scope. Foreign Owner and Clinic scope denial normalize to the same hidden `404`. Ordering and continuation use stable database keyset `(occurredAt,eventId)`; same-timestamp rows and pages beyond the limit remain reachable.
- Generated OpenAPI contains the actual history route, typed response/cursor and applicable 400/401/404 responses. Node 22 evidence: focused unit + real PostgreSQL matrix `11/11` PASS, build/export/OpenAPI assertion and diff-check PASS. Independent reviewer final verdict: `PASS / NO RESIDUAL VETO`.
- No migration or event-sourcing rewrite was introduced. Existing unrelated PostgreSQL suites that truncate outbox/audit without the pre-existing notification child tables remain test-harness incompatible and were not claimed as passing.

## `SCRUM-709 / T085 — Owner in-app booking notifications`

`IMPLEMENTED / CONTRACT_VALIDATED / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR passed after T084 and T060 became machine-stable. The invalid `booking.hold.created.v1 → PENDING_CONFIRMATION` Owner projection is removed. Only committed CONFIRMED, REJECTED, CANCELLED and EXPIRED booking events are projectable; durable database uniqueness preserves retry/concurrency deduplication and expiry remains enabled.
- Added Owner-JWT-scoped list and mark-read HTTP operations. Recipient identity is never accepted from query/body; foreign notification mutation returns hidden `404`. Public DTOs contain only notification ID/type, safe copy, booking/optional appointment linkage, read timestamp and creation timestamp; source outbox ID, recipient ID, aggregate version, delivery leases/retries/provider state and raw payload are not serialized.
- Projection reuses the existing durable notification/email-delivery foundation and production `booking_hold` aggregate vocabulary. No Push/SMS/Telegram, preferences, mark-all-read, device registration, WebSocket or external email provider behavior was added.
- A bounded background projector consumes committed authoritative outbox rows independently of Owner reads. Exact released-event reasons fail closed: only `CLINIC_DECLINED` and `OWNER_CANCELLED` project; system/unknown releases are skipped without starving the batch. Replica overlap is fenced by the existing durable uniqueness/upsert boundary.
- Node 22 evidence: repository/controller matrix `14/14` PASS; build/OpenAPI generation/assertion and diff-check PASS. Independent authorization/event/dedup/privacy review final verdict: `PASS / NO RESIDUAL VETO`. No human Jira acceptance is claimed.
- Batch limit reached at exactly three checkpoints. No fourth checkpoint was started. `NEXT_READY_JIRA_CANDIDATE`: verify Jira DoR for the Owner-app notification consumer (`T086`) in a fresh batch.

## `SCRUM-709 / T085 — PostgreSQL harness compatibility continuation`

`IMPLEMENTED / COMPATIBILITY_VALIDATED / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR passed as a continuation of the machine-stable T085/T060 notification and history work. The regression was reproduced against old PostgreSQL harnesses: standalone parent-table truncation failed after the durable notification foreign keys became active; this was test cleanup incompatibility, not a production FK defect.
- Added the test-only `resetBookingPersistence` helper. It is guarded by `NODE_ENV=test` and atomically truncates notification deliveries, notifications, outbox, idempotency and audit tables in the correct dependency graph. All directly affected booking/Queue/Registry harnesses now reuse it; the final missed outbox replay harness was repaired. Production constraints were not weakened and applied migrations were not edited.
- Focused Node 22 PostgreSQL evidence: booking outbox replay, booking status, Queue service, booking history and notification foundation passed (`5/5` suites in the compatibility matrix excluding the known S15 HTTP cases); targeted PILOT HTTP cancellation/confirm/decline passed `3/3`. The broad Clinic Queue HTTP file still contains legacy alternative-time cases that correctly return `404` in `PILOT_V1`; those unrelated S15 cases were not rewritten in this checkpoint.
- Independent compatibility review: `PASS / NO RESIDUAL VETO`. Remaining human Jira acceptance was not simulated.
- T140 gap delta: history and Owner notification routes/schemas are now real generated-contract inputs rather than missing-operation blockers.

## `SCRUM-764 / T140 — Targeted generated OpenAPI reconciliation`

`OPENAPI_BASELINE_STABLE / CONTRACT_VALIDATED / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR passed against machine-stable T005/T041/T060/T085. The existing NestJS Swagger export remains the only generator; no fake route, second generator, migration or dependency was introduced.
- `CLOSED_GAPS`: public create/read/command DTOs use required canonical five-state `status` and omit raw `state`/fallback; create and read expose authoritative `lastUpdatedAt`; GET hold has a typed 200 schema; create/read/cancel/confirm/decline have applicable typed `ApiErrorDto` matrices; client correlation headers are optional while server correlation authority remains mandatory; real projected history and Owner notification operations/schemas are present; nullable notification fields have concrete string/date-time schemas.
- `REMAINING_GAPS`: none within the bounded T140 first-MVP Booking/history/notification contract. Optional client correlation was deliberately not changed to required. Excluded PILOT telemedicine is not advertised.
- The assertion script now rejects raw booking state, expanded status enums, missing required timestamps/fencing, incomplete command/history/notification matrices, missing error refs, duplicate parameters/operationIds and malformed cursor/notification schemas. Generated artifact and Node 22 build/export/assert pass; operationIds remain unique.
- Independent OpenAPI review initially vetoed missing create `lastUpdatedAt`; it was populated from `booking_holds.state_changed_at`, made compile-time required and covered by integration/assertion evidence. Final verdict: `PASS / NO RESIDUAL VETO`. SA/BE/RN/Web/QA human review remains outstanding; Jira workflow was not changed.
- T140 gap delta: all eight previously recorded gaps are closed. Applicable write contract is machine-stable for T042.

## `SCRUM-666 / T042 — Booking locking, constraints and TTL reconciliation`

`IMPLEMENTED / CONCURRENCY_VALIDATED / LOCAL_UNCOMMITTED` (2026-08-09).

- DoR passed: T041 is machine-stable, T140 applicable write contract is stable, and the persistence plan is reuse of the already-applied Booking Core schema. Jira remains `К выполнению` with no assignee; this does not invalidate machine evidence.
- Classification: atomic capacity protection, PostgreSQL/server time, TTL persistence, DB constraints/indexes, transaction boundary, idempotency, conflict mapping, concurrent execution and focused coverage are `ALREADY_SATISFIED`. One `PARTIAL` item was repaired: create fencing is now mandatory rather than optional in DTO, service and generated OpenAPI; omission fails closed as `INVALID_REQUEST` and stale versions remain `SLOT_VERSION_STALE`.
- PostgreSQL confirms non-negative counters and `booked_count + held_count <= capacity`, plus the bounded expiry index. Creation uses the documented idempotency → pet → slot lock order, guarded capacity update, 50 ms lock timeout, database `clock_timestamp()`, payload-bound idempotency and transactional outbox/audit. Existing expiry recovery uses `FOR UPDATE SKIP LOCKED`, is repeat-safe and rolls back counter drift; complete worker/restart behavior remains T043 ownership.
- Real PostgreSQL proof covers 100 same-slot concurrent attempts with exactly one success, 99 controlled conflicts, one active hold/capacity unit, one outbox/audit effect and restored pool; it also covers idempotent replay, stale/omitted fencing, authoritative expiry exactly once, confirmed non-expiry and drift rollback. No migration was required or created.
- Independent concurrency review initially vetoed optional create fencing; after the bounded repair, final verdict is `PASS / IMPLEMENTED_EXISTING / VALIDATED / NO RESIDUAL VETO`. Human BE/QA/Tech Lead acceptance was not simulated. `NEXT_READY_JIRA_ITEM`: `SCRUM-667 / T043`, subject to a fresh Jira DoR check; it was not started.

Batch stop: exactly three checkpoints were processed (T085 continuation, T140, T042). `SCRUM-710 / T086` remains `NOT_READY` and was not started: `T086 → S22/T082 → T080 → T061 → T039 → (T037 + T013) → T143 → T142/Figma`; T080 also has no Jira assignee/decision deadline. T018 remains blocked by unresolved T017 numeric Product/Security decisions, not by T123. T016 still requires T014 signed-build evidence, external Sentry configuration and client diagnostics safety evidence. No commit, push, PR, Jira transition or production action was performed.

## `SCRUM-642 / T018 — Core OTP lifecycle and authoritative Owner session`

`IMPLEMENTED / CORE_AUTH_VALIDATED / LOCAL_UNCOMMITTED / READY_FOR_HUMAN_REVIEW` (2026-08-11).

- Fresh Jira and Confluence reconciliation supersedes the older T017 blocker recorded above: T017 page `1867791` version 3 fixes OTP TTL at 5 minutes, resend cooldown at 60 seconds, maximum verification attempts at 5, phone limits at 5/hour and 10/day, IP limit at 20/hour, initial temporary block at 15 minutes and sustained block up to 60 minutes. T018 is therefore machine-ready without T123/T125; global phone/IP enforcement remains T126 ownership.
- Classification: existing Owner identity, challenge/session tables, Nest auth boundary and audit store are `REUSE`; OTP lifecycle, controllers, DTOs, guard and OpenAPI are `MODIFY`; provider-neutral delivery port/stub plus additive challenge/session hardening are `NEW`; JWT refresh issuance is `LEGACY_REFERENCE_ONLY` and is not part of the new public Owner contract.
- Request/resend/verify now use normalized phone authority, database time, 5-minute expiry, 60-second resend cooldown, five bounded attempts, latest-code supersession, challenge-bound keyed HMAC verifier material with separately versioned pepper and constant-time comparison. Raw OTP, phone, verifier and session token are not persisted in audit or returned from request/resend.
- The provider-neutral port exposes closed accepted/rejected/unavailable/retryable/final/timeout/unknown outcomes. The deterministic stub is usable only in local/test and fails closed in production. Provider I/O occurs outside database transactions; any non-accepted or ambiguous outcome cannot verify or create a session. No provider SDK, credentials, internal retry or delivery-success claim was introduced.
- Successful verification atomically consumes the challenge, finds/creates the Owner identity, writes the audit event and creates exactly one opaque server session. Only a domain-separated SHA-256 token hash is stored. Concurrent verification has one winner; replay, expiry and exhausted attempts fail closed. `GET /v1/auth/session` reads authoritative expiry/revocation; logout is repeat-safe and immediately revokes the opaque session. Existing staff JWT validation remains compatibility-only.
- Additive migrations `1719510000000` and `1719520000000` add resend/supersession/generation/delivery evidence, opaque-session hashes and verifier-key versioning without editing applied migrations. Deploy order is migrations first, then a coordinated non-rolling auth cutover: old/new binaries do not share OTP verifier material or opaque-session validation. Rollback after issuing new challenges/sessions requires invalidating those credentials and re-authentication; additive columns/indexes remain. No production rollout was attempted.
- Generated OpenAPI includes request, resend, verify, effective-session and logout operations with typed success/error schemas, authoritative timestamps, closed error codes and opaque-token format. The public refresh route and access/refresh-token response fields are absent. T140 OTP/auth delta is `CLOSED` for this bounded contract.
- Node 22 Docker evidence: backend build PASS; OpenAPI generation/assertion PASS; migration checksum verification PASS; focused unit + real PostgreSQL + HTTP + guard matrix `24/24` PASS. PostgreSQL evidence covers cooldown/resend supersession, delayed-delivery fencing, expiry/not-found/exhaustion, twelve-way concurrent verification, all provider failure/unknown outcomes, active/expired/revoked sessions and audit privacy. Independent security/correctness review final verdict: `PASS / NO RESIDUAL VETO`.
- T126 global replica-safe phone/IP limiting and blocking, T125 real provider implementation, provider credentials, RN screen/session integration and production rollout remain explicitly out of scope. Human BE/Security/QA acceptance and Jira transition were not simulated.
- `NEXT_READY_JIRA_CANDIDATE`: `SCRUM-750 / T126 — OTP rate limiting and temporary blocking`, subject to a fresh exact DoR/dependency check; it was not started.

## `SCRUM-783 / T154 + SCRUM-784 / T155 — Governance sync and first reconciliation package`

`T154: GOVERNANCE_SYNC_COMPLETE / READY_FOR_DONE_AFTER_PACKAGE_APPROVAL`
`T155: RECONCILIATION_COMPLETE / READY_FOR_HUMAN_PACKAGE_APPROVAL` (2026-08-12).

- Fresh authority was read from Jira `SCRUM-783`, `SCRUM-784`, `SCRUM-625`, `SCRUM-626`, `SCRUM-590` and Confluence governance page `2686977` version 1 plus Scope Freeze page `131074` version 2. No Jira/Confluence product contradiction was found.
- Repository governance classification was `NEEDS_DOC_SYNC`: agent profiles and destructive-command rules were aligned; root `AGENTS.md` and this autonomous-delivery contract still had the older unconditional Jira-transition/human-role wording. They now record PO=Acting TL authority, the complete machine-state vocabulary, machine-only QA, scoped package approval, the seven-condition Done rule and parent closure by mandatory AC/DoD/gates rather than completion percentage. `.codex/config.toml` was not changed by this package.
- Reconciliation used the current contracts, repository implementation and focused evidence without artificial production changes. Proposed rows:

| Jira | Machine state | Proposal | Key evidence/risk |
| --- | --- | --- | --- |
| SCRUM-629 / T005 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Booking state/API baseline reconciled to T059/T084. |
| SCRUM-631 / T007 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Pilot architecture ownership/isolation contract is stable. |
| SCRUM-633 / T009 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Expo SDK 57 + Prebuild/CNG ADR is stable; no signed-build claim. |
| SCRUM-634 / T010 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Navigation/state/security baseline is stable; runtime delivery is downstream. |
| SCRUM-641 / T017 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Quantitative OTP policy and provider-neutral semantics are current. |
| SCRUM-665 / T041 | IMPLEMENTED_EXISTING / CONTRACT_VALIDATED | APPROVE_FOR_DONE | Transaction/concurrency/lifecycle contract page 1835030 v3 is complete. |
| SCRUM-683 / T059 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Five-state read/history/copy contract page 2195465 v3 is stable. |
| SCRUM-708 / T084 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Closed Owner terminal-event notification matrix; pending excluded, expiry included. |
| SCRUM-719 / T095 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Telemetry/privacy contract page 1835010 and independent review are stable. |
| SCRUM-748 / T124 | CONTRACT_VALIDATED | APPROVE_FOR_DONE | Provider-neutral adapter contract page 1769475 v3; real provider not required. |
| SCRUM-635 / T011 | IMPLEMENTED_EXISTING / VALIDATED | APPROVE_FOR_DONE | Expo/RN foundation, strict TS, single API client and root wiring pass. |
| SCRUM-636 / T012 | PARTIAL | KEEP_OPEN | Local SecureStore/navigation shell does not call authoritative `GET /v1/auth/session` or backend logout/revoke; it can authenticate locally supplied material. |
| SCRUM-642 / T018 | IMPLEMENTED / SECURITY_VALIDATED | APPROVE_FOR_DONE | OTP/session PostgreSQL+HTTP evidence passes; coordinated non-rolling cutover is an operations risk, not implementation DoD. |
| SCRUM-666 / T042 | IMPLEMENTED_EXISTING / VALIDATED | APPROVE_FOR_DONE | Mandatory slot-version fence, DB capacity, idempotency, DB TTL and concurrency evidence are stable against T041. |
| SCRUM-684 / T060 | IMPLEMENTED / VALIDATED | APPROVE_FOR_DONE | Five-state readback and scoped keyset history pass real PostgreSQL evidence. |
| SCRUM-709 / T085 | IMPLEMENTED / VALIDATED | APPROVE_FOR_DONE | Durable terminal-event projection, dedup, Owner scoping/list/read and no pending projection are covered. |
| SCRUM-768 | IMPLEMENTED / SECURITY_VALIDATED | APPROVE_FOR_DONE | Closed allowlist/denylist, correlation replacement, reserved-field protection and alert re-sanitization pass. |
| SCRUM-764 / T140 | PARTIAL | KEEP_OPEN | Current artifact still contains Owner operations referencing undefined security scheme `bearer` while only `bearerAuth` is declared; RN/Web/QA review gate also remains. |

- Validation: Node 22 backend build, PILOT OpenAPI export/assertion and migration checksum verify PASS; focused backend unit/HTTP/real-PostgreSQL/security matrix `85/85` PASS plus Owner notification controller matrix PASS; Owner App typecheck/lint and `36/36` tests PASS (local Node 18 emitted the expected unsupported-version warning, so this is not Node 22 mobile evidence); `git diff --check` PASS.
- Jira currently contains 100 items and 0 formal Done items. Approval of the 16 `APPROVE_FOR_DONE` candidate rows plus T154 would project 17/100 Done. Once that same explicit approval satisfies T155's own package-approval gate, the subsequent transition phase would project 18/100; no transitions occurred in this run.
- No parent Story/Epic is yet closure-ready: S01 still needs T001/T002/T154/T155 transition reconciliation; S03 retains T140; S07 retains RN/provider/anti-fraud/QA children; S13 retains T043; S23 retains downstream notification consumer/QA work. Parent completion percentage was not used as authority.
- Exact human approval request: `Принимаю reconciliation package 2026-08-12 для SCRUM-783, SCRUM-629, SCRUM-631, SCRUM-633, SCRUM-634, SCRUM-641, SCRUM-665, SCRUM-683, SCRUM-708, SCRUM-719, SCRUM-748, SCRUM-635, SCRUM-642, SCRUM-666, SCRUM-684, SCRUM-709, SCRUM-768. SCRUM-636 и SCRUM-764 оставить открытыми.` This approval has not yet been given and was not simulated.
- Fresh next-candidate DoR: `SCRUM-750 / T126` depends on T017 and T018; both are machine-stable. `NEXT: SCRUM-750 / T126` for replica-safe phone/IP limiting (5/hour, 10/day, 20/hour), temporary blocking, concurrent safety, provider neutrality and no OTP/full-phone logging. T126 was not started.

## `2026-08-12 reconciliation package — human approval and Jira closure`

`RECONCILIATION_PACKAGE_CLOSED / 18 OF 100 DONE / NEXT_T126_READY` (2026-08-12).

- Product Owner / Acting Technical Lead approval was received verbatim: “Принимаю reconciliation package 2026-08-12 для SCRUM-783, SCRUM-629, SCRUM-631, SCRUM-633, SCRUM-634, SCRUM-641, SCRUM-665, SCRUM-683, SCRUM-708, SCRUM-719, SCRUM-748, SCRUM-635, SCRUM-642, SCRUM-666, SCRUM-684, SCRUM-709, SCRUM-768. SCRUM-636 и SCRUM-764 оставить открытыми.” Approval applies only to those 17 accepted rows and not to T012, T140, T155, Stories, Epics or other items.
- Fresh pre-transition Jira reads found no material AC/DoD/revision change: `APPROVAL_APPLICABLE`. The actual available global Done transition was `41 / Готово`. Each accepted item was transitioned separately and immediately reread with status and resolution `Готово`.
- Closed accepted rows: `SCRUM-783`, `SCRUM-629`, `SCRUM-631`, `SCRUM-633`, `SCRUM-634`, `SCRUM-641`, `SCRUM-665`, `SCRUM-683`, `SCRUM-708`, `SCRUM-719`, `SCRUM-748`, `SCRUM-635`, `SCRUM-642`, `SCRUM-666`, `SCRUM-684`, `SCRUM-709`, `SCRUM-768`. Independent aggregate reread confirmed `17/17` Done.
- `SCRUM-636 / T012` remains `К выполнению / PARTIAL`: the RN shell does not call authoritative `GET /v1/auth/session` or backend logout/revoke. `SCRUM-764 / T140` remains `К выполнению / PARTIAL`: 22 generated operations reference undefined `bearer` instead of declared `bearerAuth`; this remains a separate bounded contract-integrity repair.
- After 17/17 verification, T155 DoD was reread. Human approval was recorded, accepted rows were Done, exclusions stayed open and no parent was closed. `SCRUM-784 / T155` was then transitioned through `41 / Готово` and reread with status/resolution `Готово`.
- Canonical Jira query remains 100 total items. Before closure: `0/100`; accepted package: `+17`; T155: `+1`; final fresh result: `18/100 Done = 18%`.
- `PARENT_CLOSURE_CANDIDATES: NONE`. S01 still has T001/T002 and other mandatory open children; S03 has T140 and other baseline children; S07 has RN/provider/T126/QA children; S13 has T043/T044; S23 has T086/QA/communication children. Parent AC/DoD and cross-component/real-world gates were not inferred from percentages, and no Story/Epic was transitioned.
- T018 remains Done with a documented deployment risk: coordinated non-rolling auth cutover is required because old/new binaries are incompatible by OTP verifier/session model; rollback may require reauthentication. This is operations follow-up, not a T018 implementation-DoD reopening.
- No real provider/SMS, signed build, real-device test, UAT, pilot-clinic acceptance, Go-Live, real bookings, production activation, commit, push, PR or deploy was claimed or performed. Mixed dirty repository state was preserved.
- Fresh T126 DoR is satisfied: `SCRUM-750 / T126` remains `К выполнению`; its direct dependencies T017 and T018 are now Done and their contracts are machine-stable. `NEXT: SCRUM-750 / T126 — Добавить anti-fraud защиту OTP`. T126 was not implemented in this run.
- T126 handoff boundary: reuse a PostgreSQL replica-safe limiter pattern if present; atomically enforce phone 5/hour and 10/24h plus IP 20/hour, database-time windows, a 15-minute initial block and contract-bounded escalation up to 60 minutes. Enforcement precedes provider delivery, preserves T017/T018 lifecycle and enumeration resistance, uses a separately domain-separated non-reversible phone identity, bounds IP retention, emits existing stable rate-limit/block codes, and never logs OTP/full phone/session bearer/raw HMAC/pepper. Required evidence includes real PostgreSQL concurrency/window/block-expiry tests, no-provider-call-on-block, privacy checks, T018 regressions, OpenAPI/runtime parity and migration checksum verification.

## `SCRUM-750 / T126 — OTP anti-fraud replica-safe enforcement`

`IMPLEMENTED / REPLICA_SAFE_VALIDATED / READY_FOR_HUMAN_PACKAGE_APPROVAL` (2026-08-12).

- Fresh Jira `SCRUM-750` remained `К выполнению`, revision `2026-08-07T20:13:35.569+0300`; T017 and T018 are Done and the fresh AC/DoR introduced no delta. The bounded implementation did not change Jira workflow state.
- Reuse verdict: `REUSE_AND_EXTEND`. The existing shared PostgreSQL limiter supplied the accepted short-transaction, DB-clock, bounded-lock and SKIP-LOCKED cleanup pattern, but its fixed one-hour windows cannot satisfy T126 rolling hour/24-hour semantics. T126 therefore adds one auth-owned rolling attempt ledger plus one block/escalation table, without changing or duplicating the global limiter API.
- Every syntactically valid request/resend is normalized and consumed before challenge mutation or provider I/O. One transaction takes deterministic phone/IP advisory locks, inserts the pseudonymous attempt, evaluates phone 5/rolling-hour + 10/rolling-24h and IP 20/rolling-hour, and creates a block atomically. The threshold-crossing request returns `OTP_RATE_LIMITED`; requests during the active block return `OTP_TEMPORARILY_BLOCKED`, both with authoritative `retryAt` and no blocking dimension or identity.
- Initial breach blocks for 15 minutes. A new threshold breach after an expired prior block whose last violation is within the 24-hour abuse horizon deterministically escalates to 60 minutes; outside that horizon the violation level resets to the initial block. All time comes from PostgreSQL `clock_timestamp()`.
- Phone and effective direct-connection IP are persisted only as domain-separated HMAC-SHA256 pseudonyms under a new versioned `AUTH_OTP_ANTI_FRAUD_PEPPER`, required to be >=32 characters and distinct from JWT/OTP peppers. Express trust proxy is not enabled, so arbitrary `X-Forwarded-For` is ignored and `request.ip` remains the conservative direct-peer boundary. No OTP, full phone, raw IP, bearer, HMAC or pepper is logged or returned.
- Anti-fraud identity-key rotation is an explicit coordinated/non-rolling operation: all replicas switch together and the previous key/version remains configured for at least the 25-hour state horizon. Mixed old/new binaries are not claimed safe; the previous identity is read for counts, active blocks and escalation continuity during the bounded transition.
- Additive migration `1719530000000_add_owner_otp_anti_fraud.js` creates bounded attempt/block state and lookup/expiry indexes. Logical decisions ignore attempts older than 24 hours. Physical retention is 25 hours; the auth-owned worker runs every minute and deletes expired attempts and blocks in bounded SKIP-LOCKED catch-up batches. Cleanup failure is caught/sanitized and cannot make enforcement fail open.
- Low-cardinality process telemetry records allowed, rate-limited, active-block and database-failure totals without identity labels. Limiter DB/lock failure returns a safe 503 `INTERNAL_ERROR` and never reaches challenge/provider execution.
- Evidence: Node 22 backend build PASS; config matrix `10/10` PASS; real PostgreSQL rolling/concurrency/privacy/index matrix `6/6` PASS including 20 parallel calls across two service instances with exactly 5 allowed and zero 5xx; T018 core+HTTP regression `15/15` PASS; provider suppression proves the sixth request leaves provider calls at one and challenge rows at one; spoofed forwarding headers cannot evade the direct-peer IP limit; PILOT OpenAPI export/assertion PASS; migration checksum verify PASS; `git diff --check` PASS.
- No real SMS/provider, production load, multi-node deployment, RN work, T140 global bearer repair, commit, push, PR, deploy or Jira transition was performed or claimed. The pre-existing mixed dirty tree was preserved.
- Exactly one fresh next candidate, not started: `SCRUM-752 / T128 — QA OTP and anti-fraud scenarios`. Its core/stub QA package explicitly does not require a real provider; provider-specific sandbox cases remain subsequent to T125.

## `SCRUM-752 / T128 — Owner OTP and anti-fraud QA certification`

`QA_COMPLETE / SECURITY_VALIDATED / READY_FOR_HUMAN_PACKAGE_APPROVAL` (2026-08-12).

- Fresh Jira revision `2026-08-09T23:16:30.364+0300` remains `К выполнению`. T017 and T018 are Done; T126 remains implemented but `READY_FOR_HUMAN_PACKAGE_APPROVAL`. T128 explicitly permits the core/stub QA package before a real provider, so T125/T127 are not blockers for this bounded certification; provider-specific sandbox evidence remains a later extension.
- Reused T018 core and HTTP harnesses certify request → provider-neutral delivery → challenge → verify → opaque session → authoritative session validation → idempotent logout/revoke, plus 5-minute DB expiry, 60-second resend cooldown/supersession, five attempts, OTP non-reuse, concurrent verify single winner and every deterministic provider failure/unknown outcome without false session success.
- Extended T126 PostgreSQL evidence now covers exact rolling-hour and rolling-24h inside/after boundaries, cross-dimensional phone/IP independence, 20 parallel calls across two service instances with exactly 5 allowed, 15 controlled denials and no overshoot/5xx, 15→60-minute escalation, block expiry, identity-scoped `Index Cond`, additive constraints/indexes, 1500-attempt/1200-block cleanup catch-up while retaining active state, and pseudonymous persistence.
- The HTTP composition proves allowed provider flow; threshold and active-block provider suppression; no extra challenge; direct-peer IP enforcement despite changing client-controlled `X-Forwarded-For`; and identical safe 429 schema/code/message for known versus unknown phone identities. Raw limiter DB failure and request/resend composition tests prove safe 503, bounded database-failure telemetry, no challenge mutation and no provider call.
- Rotation certification uses an explicit env-qualified Node 22/PostgreSQL run with a distinct previous pepper/version. It proves previous-key attempts count against the current threshold, a previous-key block remains active, and a current breach after a recent previous-key violation escalates to 60 minutes. Config tests reject incomplete pairs in either direction, invalid/same versions, weak/reused secrets and equality with the worker credential. The operational rollout remains coordinated/non-rolling with previous material retained at least 25 hours.
- Validation: Node 22 build PASS; focused auth/config/fail-closed unit matrix `29/29` PASS; PostgreSQL base matrix `10/10` PASS plus rotation matrix `1/1` PASS; T018 core+HTTP matrix `15/15` PASS and final HTTP-specific matrix `5/5` PASS; PILOT OpenAPI export/assertion PASS; migration checksum verify PASS; `git diff --check` PASS. No real SMS, production abuse load, production multi-node deployment, RN/device QA, UAT, commit, push, PR, deploy or Jira transition was claimed.
- Exactly one next bounded Jira candidate, not started: `SCRUM-636 / T012 — RN session and navigation shell authoritative integration repair`. Fresh dependency inspection shows T019 depends on T012 and T020 depends on T019; T012 remains the first unresolved dependency and must close its known `/v1/auth/session` plus backend logout/revoke gap before those downstream items.

## `SCRUM-636 / T012 — Authoritative Owner session integration and navigation shell`

`IMPLEMENTED / SESSION_AUTHORITY_VALIDATED / NAVIGATION_VALIDATED / SECURITY_VALIDATED / READY_FOR_HUMAN_PACKAGE_APPROVAL` (2026-08-12).

- Fresh Jira remained `К выполнению`; T011 and T018 are Done/machine-stable. The bounded delta was the previously recorded authoritative-session gap: the existing Expo Router/SecureStore/TanStack shell did not call `GET /v1/auth/session` during cold bootstrap and logout did not call `POST /v1/auth/logout`. T019 still depends on T012, and T020 still depends on T019; neither downstream item was started.
- A single `SessionAuthority` reuses the canonical typed API client and Bearer transport. SecureStore remains opaque local persistence only. A stored credential does not enable protected routes until `GET /v1/auth/session` returns an OWNER snapshot with a valid authoritative subject UUID; that subject becomes the owner Query-cache scope.
- Missing local material goes directly to the public shell. Locally expired/malformed material and authoritative 401 clear SecureStore and only the prior owner-scoped cache before rendering public routes. Network, timeout and 5xx validation failures preserve recoverable credential material but render no route group; a bounded explicit retry repeats authority validation.
- Logout attempts authoritative revoke first. Successful and already-revoked responses then clear local material, the exact active-owner cache scope and protected navigation. If revoke is temporarily unconfirmed, local authorization still ends fail-closed and the UI records only a closed generic state; no background retry subsystem or false server-revoked claim was added. SecureStore deletion failure also cannot retain an authenticated shell.
- Generation fencing prevents stale bootstrap/session-A validation from overwriting a newer established session, and session mutations serialize logout versus reauthentication. Active local expiry and foreground expiry checks remain bounded defense-in-depth; backend resource authorization remains final authority.
- Node `v22.22.2` evidence: owner-app typecheck PASS, Expo lint PASS, complete Jest matrix `52/52` PASS with no open handles, Expo doctor `20/20` PASS, and static web export PASS with five routes. Focused backend auth HTTP evidence `5/5` PASS proves issue → effective-session read → idempotent revoke plus safe failures/limiting. `git diff --check` PASS.
- Expo doctor initially exposed patch-level SDK drift in the T011 foundation. Package and lockfile were aligned to the installed Expo 57 patch set without adding dependencies; a clean install then produced the recorded doctor/export results.
- No backend auth semantics, OTP, T126/T128 anti-fraud, T019/T020, booking, Clinic Portal, migration, production data, commit, push, PR, deploy or Jira workflow state was changed by this slice. The pre-existing mixed dirty tree remains preserved.
- Independent security/correctness review initially vetoed stale validation persistence and delayed-401 cleanup races. The bounded repair removed bootstrap persistence, fenced/serialized invalid-session cleanup and added exact deferred regressions; final verdict is `PASS / NO RESIDUAL VETO`. Human package approval was not simulated. Exactly one next candidate is `SCRUM-637 / T019`; T020 remains dependency-blocked by T019.

## `SCRUM-643 / T019 — Owner login and started-journey restoration`

`IMPLEMENTED / AUTH_FLOW_VALIDATED / JOURNEY_RESTORATION_VALIDATED / SESSION_HANDOFF_VALIDATED / SECURITY_VALIDATED / READY_FOR_HUMAN_PACKAGE_APPROVAL` (2026-08-12).

- Fresh Jira revision `2026-08-07T15:37:45.775+0300` remains `К выполнению`. Direct dependencies are T017 (Done) and T012 (machine-complete/security-validated); no fresh scope delta was found. T020 remains `К выполнению` and depends on T018 plus T019. Neither T020 nor parent S07 was started or transitioned.
- The RN public shell now offers guest-first entry and direct login. A bounded resume intent has exactly one allowed shape, `{ kind: 'START_BOOKING' }`; it contains no URL, resource identifier, phone, OTP, bearer, backend payload or authoritative booking data. Successful consumption is one-shot and only presents the safe post-auth continuation point; it never creates a booking or assumes slot availability.
- One `AuthJourneyProvider` owns phone/challenge/OTP feature state until handoff. It reuses the canonical API client for `POST /v1/auth/otp/request`, `/resend` and `/verify`; response validators fail closed on malformed UUID/date/session-token/owner shapes. T012 remains the sole session owner: only a validated verify response is passed to `establishSession`, which persists the opaque credential and changes protected navigation.
- UI covers E.164 phone UX validation, request/verify/resend loading, six-digit OTP entry, authoritative expiry/resend timestamps, attempts remaining, retry time, delivery-unavailable, rate-limit/block, temporary network/server failure and stale/used challenge conflict. Copy is enumeration-neutral and never renders raw backend messages or provider details.
- Commands use a synchronous single-flight gate, AbortController and generation fence. Real provider-level regressions prove rapid duplicate request/verify yields one API call and one session write; late request or successful verify completion after cancel cannot change phase, authenticate or restore the intent; resend replaces the challenge used by verification.
- Node `v22.22.2`: typecheck PASS, Expo lint PASS, complete owner-app Jest `65/65` PASS with open-handle detection, focused auth journey `11/11` PASS, Expo Doctor `20/20` PASS and static web export PASS with five routes. Real PostgreSQL/backend T017/T018 auth matrix `16/16` PASS. `git diff --check` PASS.
- Independent review initially vetoed helper-only race evidence and then the missing deferred-verify case. Provider-level duplicate, stale-request and late-successful-verify regressions closed both findings; final verdict `PASS / NO RESIDUAL VETO`.
- Backend auth, OTP policy, T126/T128 anti-fraud, migrations, booking, T020 QA certification, Story acceptance, real provider/device/UAT, commit, push, PR, deploy and Jira workflow state were not changed or claimed. Human package approval remains required.
- Dependency impact: `SCRUM-644 / T020` is now machine-ready because T018 is Done and T019 is machine-complete. `SCRUM-596 / S07` stays open through T020 and its own Story acceptance. Exactly one next bounded item, not started: `SCRUM-644 / T020`.

## `SCRUM-644 / T020 — Owner login, journey restoration and session-isolation QA`

`QA_COMPLETE / AUTH_FLOW_CERTIFIED / SESSION_ISOLATION_CERTIFIED / ACCESS_CONTROL_CERTIFIED / NO_BLOCKING_DEFECTS / READY_FOR_HUMAN_PACKAGE_APPROVAL` (2026-08-12).

- Fresh Jira revision `2026-08-07T15:37:47.723+0300` remains `К выполнению`; the QA contract still depends on T018 (Done) and T019 (machine-complete). No fresh scope delta, provider/device requirement or automatic workflow authority was found.
- Independent Story-level evidence is recorded in `docs/testing/T020-OWNER-AUTH-CERTIFICATION.md`. It connects guest booking intent → phone → OTP request/verify → T012 session → one-shot continuation and separately covers direct login, invalid/expired/stale OTP, safe error/retry metadata, session bootstrap/invalidation, logout, cache isolation, protected-route containment and critical races.
- Added explicit RN negative cases for authoritative `OTP_INVALID` with bounded attempts and `OTP_EXPIRED` with safe restart; neither can persist a session or render raw backend detail. The canonical API client retains only closed safe code, valid retry timestamp and bounded attempts while discarding raw messages from presentation.
- Owner isolation is executable, not inferred: distinct Owner A session/cache → authoritative logout → distinct Owner B credential/cache scope proves A queries absent, B queries retained and B material persisted. A real `expo-router/testing-library` harness enters `/(app)` directly with no authority; actual RootLayout/SessionNavigation/Stack.Protected renders public content, never mounts the protected sentinel and contains the pathname.
- Node `v22.22.2`: typecheck PASS, Expo lint PASS, complete Owner App Jest `70/70` PASS with open-handle detection, Expo Doctor `20/20` PASS and static web export PASS with five routes. Docker backend and PostgreSQL were healthy; real auth core+HTTP matrix `16/16` PASS. `git diff --check` PASS.
- Independent QA/security review initially vetoed overclaimed A→B and route-tampering evidence. The distinct-session/cache test and real Router deep-link test closed both; final verdict `PASS / NO RESIDUAL VETO`. No blocking product defect or Jira Bug was warranted.
- Story S07 machine AC verdicts: OTP received/entered PASS; valid OTP creates safe authoritative session PASS; wrong/expired OTP denied PASS; started scenario restored once PASS. S07 remains open because its Jira DoD requires all subtasks/workflow completion and named human acceptance; machine verdict is `READY_FOR_HUMAN_ACCEPTANCE`, not Done.
- No real SMS provider sandbox, physical device, signed build, production load, global analytics audit, T019/T126/T128 transition, S07 closure, commit, push, PR or deploy was performed or claimed. Exactly one fresh dependency-order item, not started: `SCRUM-645 / T021 — Зафиксировать поля питомца и сценарий выбора`; it depends on S07 and remains gated by S07 human acceptance/workflow completion.

## `SCRUM-596 / S07 — Owner Authentication package closure reconciliation`

`CORE_AUTH_MACHINE_COMPLETE / READY_FOR_HUMAN_ACCEPTANCE / STOP_S07_CLOSURE` (2026-08-12).

- Fresh Jira revision `2026-08-07T18:31:32.544+0300` remains `К выполнению` with no resolution. Its four Story acceptance criteria remain: OTP receive/entry; safe session on valid OTP; no access for invalid/expired OTP; restoration of the started journey. All four have machine evidence and independently remain `PASS`; blocking defects are zero.
- Fresh normative authority is `01. Product — MVP Scope Freeze` page `131074` (current v2/product update 2026-08-09, governance update 2026-08-10) plus `17. Delivery Governance — Decision & Acceptance Model` page `2686977` (decision 2026-08-10). Scope Freeze makes OTP lifecycle/session provider-neutral, permits deterministic local/test stubs before provider integration and says all communication adapters are not one atomic Pilot gate. Governance permits parent closure when mandatory current-scope children are Done or explicitly excluded by current normative scope, while human approval and real external events may not be inferred.
- Current S07 child classification: T017, T018 and T124 are `DONE`; T019, T020, T126 and T128 are `MANDATORY_CURRENT_SCOPE / MACHINE_COMPLETE / READY_FOR_HUMAN_PACKAGE_APPROVAL`; T123, T125 and T127 are `DEFERRED_EXTERNAL / MANDATORY_BLOCKER_FOR_S07` and remain open. Provider-neutral evidence makes this branch non-blocking for the four core authentication AC, but the tasks remain direct S07 subtasks and the Story DoD literally requires all subtasks complete. Current Scope Freeze says adapters are phased/not one atomic Pilot gate, but does not explicitly exclude or reparent these three S07 children. T123 owns real provider selection, T125 provider integration and T127 secrets/sandbox/limits; none is claimed complete, selected, configured or tested against a real provider.
- Supporting T012 is outside the S07 parent but is an applicable T019 dependency. It is `IMPLEMENTED / SESSION_AUTHORITY_VALIDATED / NAVIGATION_VALIDATED / SECURITY_VALIDATED / READY_FOR_HUMAN_PACKAGE_APPROVAL`; the earlier authoritative session/logout gap is closed. S05/S06 remain open Stories, but their applicable foundation/test contracts are stable enough for this completed S07 contour: T011 is Done, and fresh Node 22 typecheck/lint/Jest, Expo Doctor/export and backend/PostgreSQL auth evidence exist. This does not close or broadly reconcile S05/S06.
- Fresh approval package revisions: T019 `2026-08-07T15:37:45.775+0300`; T020 `2026-08-07T15:37:47.723+0300`; T126 `2026-08-07T20:13:35.569+0300`; T128 `2026-08-09T23:16:30.364+0300`; S07 `2026-08-07T18:31:32.544+0300`. No material revision delta was found. Proposed transition for each is `Готово`, but only after explicit Product Owner/Acting Technical Lead package approval; this run is `PROPOSAL_ONLY`.
- Human gates are `NOT_RECORDED` for T019, T020, T126, T128 and S07 in the current input. The candidate wording in the closure brief is an approval request, not an approval. Therefore no Jira comment, transition or resolution was written. T012 also remains open and was not implicitly approved.
- Exact bounded human decisions required: (1) core package acceptance: `Принимаю Owner Authentication package для SCRUM-643 / T019, SCRUM-644 / T020, SCRUM-750 / T126, SCRUM-752 / T128. Подтверждаю acceptance criteria SCRUM-596 / S07 для provider-neutral MVP authentication contour.`; and (2) a separate authoritative Product scope decision that explicitly excludes/reparents T123/T125/T127 from the current S07 DoD while keeping them open, or completion of their real-provider gates. The closure brief's candidate wording is not itself approval and does not alter Jira hierarchy/normative scope.
- Fresh Jira progress is unchanged at `18/100 Done = 18%`; no workflow transition occurred. Fresh T021 revision `2026-08-07T15:37:49.748+0300` remains `К выполнению`, explicitly depends on S07, and is `BLOCKED_PENDING_S07_ACCEPTANCE`. T021 implementation was not started.
- Independent governance review returned `VETO`: machine AC PASS must remain separate from closure eligibility; no human approval exists, mandatory machine-complete children remain To Do, and T123/T125/T127 have not been authoritatively excluded from the all-subtasks Story DoD. The closure boundary is `STOP_S07_CLOSURE / BLOCKED_PROVIDER_SCOPE_DECISION_AND_HUMAN_ACCEPTANCE`. `NEXT: explicit Product scope decision for T123/T125/T127 plus bounded human acceptance of T019/T020/T126/T128 and S07`; only after those gates, fresh transitions and verified S07 closure may `SCRUM-645 / T021` become `READY`.

## `SCRUM-596 / S07 — scope correction, package acceptance and closure`

`SCOPE_CORRECTED / AUTH_PACKAGE_ACCEPTED / S07_DONE / 23 OF 100 DONE` (2026-08-12).

- Product Owner / Acting Technical Lead explicitly fixed current S07 as the provider-neutral Owner Authentication capability and classified T123/T125/T127 as `DEFERRED_EXTERNAL_PROVIDER_WORK / NON_BLOCKING_FOR_CURRENT_S07`. The decision explicitly accepted unchanged T019/T020/T126/T128 machine evidence and S07 user outcome, without accepting any real provider, sandbox, credentials or delivery claim.
- Fresh backlog found the exact existing owner `SCRUM-771 / S37 — Подключать внешние OTP delivery adapters` under E12. T123, T125 and T127 were reparented in place from S07 to S37; keys, history, descriptions, statuses and dependency links were preserved. Fresh reread confirms all three remain `К выполнению` with no resolution. T123 remains deferred provider selection; T125 remains Not Ready until selection and must reuse T124/T018/T126 contracts; T127 remains provider environment/secrets/sandbox work after T123/T125.
- Approval revision gate passed without material delta: T019 original revision `2026-08-07T15:37:45.775+0300`; T020 `2026-08-07T15:37:47.723+0300`; T126 `2026-08-07T20:13:35.569+0300`; T128 `2026-08-09T23:16:30.364+0300`; S07 `2026-08-07T18:31:32.544+0300`. Acceptance/evidence comments were recorded as Jira comments `10039`, `10040`, `10041`, `10042`; each issue was transitioned through the fresh available `41 / Готово` workflow and immediately reread `Готово / Готово`.
- After correction, the S07 child set is exactly T017/T018/T019/T020/T124/T126/T128; fresh Jira shows all seven `Готово`. Provider-neutral Story AC remain: OTP receive/entry PASS; valid OTP creates authoritative safe session PASS; invalid/expired OTP denial PASS; one-shot started-journey restoration PASS. Blocking defects remain zero.
- Independent governance review returned `PASS / S07 ELIGIBLE FOR DONE`: scoped Product decision applied exactly, external issues remain visible/open under S37, accepted revisions did not change, all current children are Done, AC PASS and no real-provider evidence was invented. S07 human acceptance was recorded in Jira comment `10043`, then the fresh available `41 / Готово` transition was applied. Fresh reread confirms `SCRUM-596 / S07 = Готово / Готово`, updated `2026-08-12T18:46:24.476+0300`, with the same seven Done children.
- Fresh canonical Jira progress is `23/100 Done = 23%`, a verified `+5` from the prior `18/100`: T019, T020, T126, T128 and S07.
- Fresh T021/S08 dependency read: S07 is now Done, so `SCRUM-645 / T021` is `DEPENDENCY_READY`. T021 itself remains `К выполнению`, revision `2026-08-07T15:37:49.748+0300`, and was not started. Its own DoR also requires an assigned decision owner and agreement deadline; fresh Jira has `assignee: null` and no deadline evidence. Therefore the strict execution verdict is `BLOCKED_OWNER_AND_DEADLINE_ASSIGNMENT`, not full implementation-ready, despite the S07 dependency being cleared. S08 remains open and was read only for this boundary.
- No production code, migration, Owner App, OpenAPI, provider purchase/account, sender registration, sandbox, secret, real delivery, commit, push, PR or deploy was performed. `NEXT: assign T021 decision owner and agreement deadline, then execute SCRUM-645 / T021 as a separate bounded slice`.

## `SCRUM-645 / T021 — Owner Pet MVP contract`

`PET_MVP_CONTRACT_COMPLETE / OWNERSHIP_AND_SELECTION_COMPLETE / REVIEWS_PASS / T021_DONE` (2026-08-12).

- Fresh T021 dependency S07 is Done. The DoR blocker was removed in Jira: decision owner/assignee `Evgenii Rusetskii` (Product Owner / Acting Technical Lead) and agreement due date `2026-08-13`. Fresh post-transition reread is `Готово / Готово`, updated `2026-08-12T19:21:47.167+0300`.
- Canonical source of truth is Confluence `18. Owner Pet — MVP Contract`, page `3670017`, version `6`; links are recorded in T021 comment `10044` and S08 comment `10045`. Completion/review evidence is T021 comment `10046`.
- Contract fixes the public Pet projection to `petId,name,species,createdAt,updatedAt`; create input is only `name,species`; owner derives solely from authoritative session. Name is trimmed 1–120 Unicode code points; species is `DOG|CAT|OTHER`. ownerId and all mature medical/profile fields are excluded from public MVP responses.
- 0 pets shows create CTA; one pet auto-selects visibly; multiple pets require explicit selection; successful create auto-selects. Selection is same-journey RN state, survives back/forward only, is not restored after process restart, and clears for fresh START_BOOKING/logout/authority change/cancel/masked absence. Exactly one petId is required at booking handoff.
- Pet list/read/select mask absent/foreign as identical `OWNER_PET_NOT_FOUND/404`. Booking preserves its established identical absent/foreign/archived `PET_OWNERSHIP_MISMATCH/422`; command-time pet `FOR SHARE`, owner/active/species checks close TOCTOU. UI filtering is never authority.
- T022 must reuse the existing PostgreSQL idempotency ledger as protected Owner/Pet metadata scoped by operation+authoritative owner. It stores only opaque petId/status/keyed-HMAC fingerprint; insert/audit/completion are atomic; replay rereads by petId+ownerId; cross-owner keys are isolated; cleanup cannot remove the tombstone while the Pet exists. Same-name/species pets remain allowed.
- Existing `pet_schema.pets` identity/owner/name/species/timestamps, owner-scoped queries and booking ownership checks are `REUSE_AND_RESTRICT`. The broad create/profile DTO, include-archived escape, edit/archive/documents/diary/photo/medical fields are `LEGACY_COMPAT/EVOLUTION`, not S08 Product scope. T022 must audit/fail closed on active legacy species outside the MVP code set.
- `BLOCKING_T022: 0`; `BLOCKING_T023: 0`. Deferred: edit/delete/archive/medical profile, expanded taxonomy, richer clinic projection and deletion/retention workflow. Backend/Architecture final review PASS; RN/UX final review PASS; QA/Security final review PASS after all vetoes were repaired.
- Fresh downstream: T022 is `READY` because T021 is Done and its only direct dependency is satisfied. T023 remains `BLOCKED_BY_T013`; T013 is still `К выполнению` and depends on unfinished T143. T024 remains `BLOCKED_BY_T022_AND_T023`. S08 remains open with T022/T023/T024 mandatory children unfinished; no S08 acceptance is claimed.
- No backend/RN/OpenAPI/migration production implementation, tests, commit, push, PR or deploy occurred in this contract-only slice. Exactly one next bounded item, not started: `SCRUM-646 / T022 — Реализовать API питомцев и ownership`.
## 2026-08-12 — S08 Owner Pet MVP implementation and certification package

- Scope: `SCRUM-597 / S08`, bounded prerequisites `SCRUM-637 / T013`, and children `SCRUM-646 / T022`, `SCRUM-647 / T023`, `SCRUM-648 / T024`; no next Story was started.
- Authority: Confluence `18. Owner Pet — MVP Contract`, page `3670017`, version 6; T021 is Done.
- T013 machine state: `IMPLEMENTED / MACHINE_VALIDATED / READY_FOR_HUMAN_REVIEW`. Added only the shared RN primitives/states and semantic tokens used by real Owner screens: Button, Field, Card/ListRow, StatusBadge, Modal, Screen/Header, NotificationBadge, loading/empty/error/submitting/conflict/forbidden and accessibility roles/states. T143 remains a separate human visual-system task; no final design values are claimed.
- T022 machine state: `IMPLEMENTED / CONTRACT_VALIDATED / READY_FOR_HUMAN_REVIEW`. PILOT uses a dedicated minimal controller/DTO. Create/list/read expose exactly `petId,name,species,createdAt,updatedAt`; authority derives from the Owner session; absent/foreign/archived reads use masked 404. Active unsupported legacy species fails closed as safe technical failure, never empty success.
- T022 idempotency: owner+operation scoped UUID key, domain-separated keyed HMAC fingerprint, one PostgreSQL transaction for Pet/audit/ledger, opaque `{petId}` ledger response only, owner-scoped replay, stable conflict and unavailable-original outcomes. Real PostgreSQL evidence covers 20-way concurrency, cross-owner isolation, conflicting reuse, archived replay, unsupported species and audit-failure rollback.
- Booking boundary: existing command-time locked ownership/species validation remains authoritative and its established identical `PET_OWNERSHIP_MISMATCH / 422` mapping was not changed.
- PILOT containment: mature profile/update/archive/restore/diary/care-summary/document/photo handlers are not registered; LEGACY registers the unchanged mature controller. Generated PILOT OpenAPI and assertions require only the minimal Pet surface and exact projection.
- T023 machine state: `IMPLEMENTED / MACHINE_VALIDATED / READY_FOR_HUMAN_REVIEW`. Authenticated `START_BOOKING` loads pets after session authority; 0/1/N, create auto-select, explicit one-of-N selection, safe technical/empty separation, stale-selection alert, bounded journey lifetime, same-key ambiguous retry and typed selected-pet continuation are implemented. Selection is not persisted across process restart and is scope/fresh-journey/cancel bounded.
- T024 machine state: `MACHINE_CERTIFIED / READY_FOR_HUMAN_REVIEW`, subject to final independent Backend, RN/UX and QA/security veto review. No real production rollout or next-Story evidence is claimed.
- Verification: Node 22 backend build; focused PostgreSQL and scope guards; PILOT OpenAPI export/assertion; Node 22 Owner App typecheck/lint/Jest; Expo Doctor 20/20; web export; `git diff --check`.
- Jira governance: no transition is authorized by machine evidence alone. T013/T022/T023/T024 and S08 remain open until required human package acceptance. S08 target state is `READY_FOR_HUMAN_ACCEPTANCE`, not Done.
- Next bounded slice: none selected. Stop at S08 human acceptance boundary; do not enter the next Story.

## 2026-08-12 — S08 closure and S09 Owner Clinic Catalog package

- Fresh Jira descriptions/AC/DoD and Confluence `18. Owner Pet — MVP Contract` page `3670017` v6 had no material delta. The explicit Product Owner / Acting Technical Lead acceptance in the controlling goal was recorded in T013/T022/T023/T024/S08 comments `10054/10052/10053/10055/10056`. Fresh workflow transition `41 / Готово` was applied to all four children and, only after their verified Done resolutions, to `SCRUM-597 / S08`; S08 is `DONE`.
- Fresh canonical first-MVP Jira progress is `29/100 Done = 29%`: T021 had already raised the prior 23 to 24, and the four accepted S08 children plus S08 add five. The wider SCRUM project contains 206 issues and is not the canonical 100-item denominator.
- `SCRUM-649 / T025` has decision owner Evgenii Rusetskii and deadline `2026-08-13`. Canonical contract is Confluence `19. Owner Clinic Catalog — MVP Contract`, page `3702794` v1. The catalog unit is a clinic location because address, public phone and booking eligibility are location-scoped.
- T026 machine state: `IMPLEMENTED / CONTRACT_VALIDATED / READY_FOR_HUMAN_REVIEW`. `GET /v1/owner/clinic-catalog` requires authenticated OWNER and exposes only `clinicId,locationId,name,address,phone`. One parameterized SQL query authoritatively requires active clinic/location/service plus a future OPEN slot with remaining capacity, orders by public name/address/locationId and bounds the pilot response to 50. Valid empty is distinct from technical failure; no migration or N+1 was introduced.
- T027 machine state: `IMPLEMENTED / MACHINE_VALIDATED / READY_FOR_HUMAN_REVIEW`. Expo Router Owner home opens a TanStack Query catalog using the canonical API client/session credential. Loading, content, valid empty and retryable technical error are distinct; malformed or extra-field payloads fail closed. The next-step handoff stores exactly opaque `{clinicId,locationId}` and no copied display fields, services, slots or booking authority.
- T028 machine state: `QA_COMPLETE / NO_BLOCKING_DEFECTS / READY_FOR_HUMAN_REVIEW`. Real PostgreSQL coverage proves the eligibility/exclusion and deterministic-order matrix; real HTTP coverage proves Owner 200, unauthenticated 401 and non-Owner 403 with bounded response keys. PILOT OpenAPI requires the typed closed response, bearer authority and 200/401/403/500 matrix. RN tests cover content, state separation, retry, exact handoff and malformed/extra payload rejection.
- Validation: Node 22 backend focused unit/PostgreSQL/HTTP `7/7` PASS across the catalog suites; backend build PASS; PILOT OpenAPI export/assertion PASS; Owner App focused `10/10` PASS, complete Jest `93/93` PASS, typecheck/lint PASS, Expo Doctor `20/20` PASS and static web export PASS; `git diff --check` PASS. Independent Backend/architecture, RN/UX and QA/security final verdicts are `PASS / NO RESIDUAL VETO` after the closed-schema, stale-error, strict-parser and expanded PostgreSQL/HTTP evidence repairs.
- S09 remains `READY_FOR_HUMAN_ACCEPTANCE`, not Done: the controlling goal supplies no human acceptance for S09. T025/T026/T027/T028 and S09 remain open in Jira pending that separate acceptance; no workflow completion is inferred from machine evidence.
- No S10 service/detail implementation, migration, commit, push, PR, deploy or production/pilot evidence was performed. Exactly one next bounded slice, not started: `SCRUM-599 / S10 — Открыть клинику и выбрать услугу`.

## 2026-08-13 — S09 closure and S10 Clinic & Service Selection MVP

- Goal: close the already accepted `SCRUM-598 / S09` package and deliver the bounded `SCRUM-599 / S10` clinic detail/service-selection chain without starting S11.
- Fresh Jira reconciliation: `SCRUM-649/T025`, `SCRUM-650/T026`, `SCRUM-651/T027`, `SCRUM-652/T028` and parent `SCRUM-598/S09` were reread, accepted with scoped evidence comments, transitioned to Done, and reread as Done/Done. `SCRUM-759/T135` was likewise reread, accepted only for the explicit first-MVP payment exclusion, transitioned, and reread Done/Done. No S11 item was started.
- `SCRUM-653/T029` was assigned to Evgenii Rusetskii with due date 2026-08-13. Confluence page `4227073`, `20. Owner Clinic & Service Selection — MVP Contract`, records the normative S10 contract. Clarification: an active clinic/location may return `services: []`; inactive or mismatched clinic/location is masked 404. S09 availability was a discovery snapshot, not a reservation, and S10 neither reads slots nor implements availability.
- Backend (`SCRUM-654/T030`): added Owner-authenticated `GET /v1/owner/clinic-catalog/{clinicId}/locations/{locationId}`. The single bounded query revalidates the exact active clinic/location relationship, left-joins only active services, orders by service display name then opaque ID, supports a valid zero-service result, and returns only `observedAt, clinicId, locationId, name, address, phone, services`. Each service contains only `serviceId, name, price`; price is closed to `INFORMATIONAL`, decimal-string amount and ISO currency. Missing/inactive/mismatched resources share `OWNER_CLINIC_LOCATION_NOT_FOUND/404`.
- RN (`SCRUM-655/T031`): S09 hands off exactly `{clinicId,locationId}`. The S10 screen has distinct loading, content, valid-empty, technical-error, selected, unavailable/stale and refresh-check states; exposes one accessible radio selection; stores only opaque IDs; and hands off exactly `{clinicId,locationId,serviceId}`. Continue is disabled without a choice and performs an authoritative refresh; refresh failure is fail-closed even if stale cached data exists, while disappearance clears the selection. The complete clinic journey subtree is keyed by Owner cache scope plus opaque session credential, so logout, same-Owner reauthentication and Owner A→B reset all clinic state. Changing clinic unmounts the prior selection.
- Payment exclusion (`SCRUM-760/T136`): no payment/prepayment/deposit/acquiring/status/billing/settlement route, state, event, dependency or CTA was introduced. The only price semantics are `kind=INFORMATIONAL`; booking may proceed independently of payment. OpenAPI assertion rejects Pilot Owner payment paths and validates the closed informational schema. This is a scoped S10/Pilot claim, not a repository-wide deletion of isolated legacy modules.
- Machine checks: Node 22 backend focused controller 2/2 PASS; PostgreSQL projection 2/2 PASS; HTTP authority/privacy 3/3 PASS; backend build PASS; explicit PILOT_V1 OpenAPI export/assert PASS; Node 22 Owner App typecheck PASS; lint PASS; final full RN Jest 18 suites / 103 tests PASS; final focused RN parser/screen 10/10 PASS; `git diff --check` PASS. Expected React test-harness `act()` diagnostics remain non-failing and do not represent production errors.
- Independent evidence: RN/UX review initially vetoed authority-generation persistence and stale-data continuation; both were repaired and final verdict is PASS / NO VETO. Architecture review initially found a v1 contract contradiction and incomplete OpenAPI guards; Confluence `4227073` v2 and exact schema/UUID guards resolved both, final PASS. QA/security review initially found the stale-refetch and evidence gaps; all were repaired, and its independent RN 10/10 plus PILOT_V1 assertion yielded final PASS / NO VETO.
- Machine state: `T029=CONTRACT_VALIDATED / READY_FOR_HUMAN_REVIEW`; `T030=IMPLEMENTED / VALIDATED`; `T031=IMPLEMENTED / VALIDATED`; `T032=QA_COMPLETE / VALIDATED`; `T136=IMPLEMENTED_EXISTING / CONTRACT_VALIDATED`. Jira workflow remains separate; no unapproved S10 child or parent transition is inferred from machine evidence.
- Canonical progress must count only fresh verified Done transitions. The previously recorded 29/100 plus the five S09 transitions and T135 yields 35/100, subject to the next fresh canonical JQL recount; S10 items are not counted as Done here.
- Exactly one next bounded item after S10 governance readiness: `SCRUM-657 / T033 — [SA] Зафиксировать контракт выбора даты и времени (S11)`. Status: `NOT_STARTED`; this run does not execute or transition it.

## 2026-08-13 — S10 reconciliation and S11 Owner Availability MVP

- Fresh S10 reconciliation preserved the machine-complete states for T029/T030/T031/T032/T136. Jira workflow remains open because the controlling goal contains no applicable named human package acceptance; S10 and its children were not transitioned.
- `SCRUM-657 / T033` contract is Confluence page `4456449` v3. It binds availability to the shared `clinic_schema.appointment_slots` model, database time, exact active clinic/location/service authority, `[observedAt, observedAt + 14 days)`, live `capacity - booked_count - held_count > 0`, 50-row bound and `(starts_at, slotId)` order. The exact public envelope includes bounded `clinicName`/`serviceName` display context plus authoritative timezone and closed slot objects.
- Backend T034 adds one OWNER-authenticated read-only availability GET under the selected S10 identity. It performs no hold, booking, event or payment mutation and returns masked 404 for inactive/mismatched context, safe invalid-request errors and valid `slots: []` separately from technical failure.
- RN T035 displays clinic-local date/time, exposes a single accessible radio group, refreshes authoritatively before handoff, clears stale selection and passes exactly `{clinicId,locationId,serviceId,slotId,expectedSlotVersion}` toward the unimplemented S12 boundary. Request, selection and session-generation fences prevent double Continue, late-context completion and selection changes during refresh; disabled state is visible and accessible.
- Parser/OpenAPI hardening rejects impossible calendar dates and malformed/extra fields, accepts valid multi-segment IANA zones, requires strict `YYYY-MM-DD`/`HH:mm`, UUID identities and integer slot version >=1. PILOT OpenAPI excludes payment routes and documents the closed 200/400/401/403/404/500 contract.
- Evidence: Node 22 Owner App focused availability `14/14` PASS, full RN `20 suites / 117 tests` PASS, typecheck/lint PASS. Backend PostgreSQL `3/3` PASS covers partial multi-capacity visibility, exhausted occupancy exclusion, restoration/version refresh, read-only counters, inactive context masking, exact keys and real 51→50 tie order. Focused controller/HTTP, PILOT OpenAPI export/assertion and backend build PASS; `git diff --check` PASS. Known non-fatal React test-harness `act()` diagnostics and an open-handle warning remain.
- Reproducible web/static visual evidence is stored in `docs/testing/evidence/s11-owner-availability`: actual production `AvailabilityScreen` bundle at compact 375×812 content, standard 390×844 selected and wide 1024×768 empty states. Manifest pins source and PNG SHA-256 hashes; verifier reports `3/3` PASS. The captures verify hierarchy, clinic/service context, date groups, selected/disabled states, 48px actions and primary/secondary/ghost CTA hierarchy. They are not simulator/physical-device evidence or human UAT.
- Independent architecture, RN/UX and QA/security final verdicts are PASS / NO VETO. Physical-device visual acceptance remains a separate human boundary and is not claimed.
- Machine state: `T033=CONTRACT_VALIDATED / READY_FOR_HUMAN_REVIEW`; `T034=IMPLEMENTED / VALIDATED`; `T035=IMPLEMENTED / MACHINE_VALIDATED`; `T036=QA_COMPLETE / AUTOMATED_AND_STATIC_VISUAL_EVIDENCE_PASS`. S11 remains open at its human acceptance gate and no Jira transition is inferred.
- Jira synchronization: concise evidence comments were added to S10 (`SCRUM-599`) and S11/T033–T036 (`SCRUM-600`, `SCRUM-657`–`SCRUM-660`). Fresh reread confirms all six remain `К выполнению / unresolved`, matching the documented human-acceptance boundary; no workflow status, assignee, priority, parent or sprint was changed.
- No S12/T037–T040 implementation, booking submission, payment, migration, commit, push, PR or deploy was performed. Exactly one next bounded slice after S11 acceptance remains `SCRUM-661 / T037 — [SA] Зафиксировать контракт создания заявки на запись`; status `NOT_STARTED`.
## 2026-08-13 — S12 Owner Booking Request capability (machine implementation; contract reconciliation blocked)

- Active scope: `SCRUM-601 / S12`, `SCRUM-661..664 / T037..T040`, with Booking Core readiness repair for `T043` and generated contract alignment for `T140`.
- Machine implementation completed for the bounded Pilot path:
  - RN journey now carries only authoritative pet/clinic/location/service/slot/version identity, uses a stable idempotency key, single-flights submit, fences late session/unmount results, validates strict timestamps and binds success to the submitted slot;
  - `POST /v1/booking-holds` has an exact closed six-field Pilot body, rejects hidden legacy `doctorId`, derives Owner authority from the session, revalidates full context/counters/version transactionally, and returns a closed ten-field `PENDING_CONFIRMATION / MANUAL` projection;
  - one canonical database-clock Pilot expiry path claims hold then slot, releases capacity once and writes canonical expired outbox/audit effects; the legacy SLA terminalizer is disabled in Pilot;
  - no payment, mandatory MIS, clinic-decision UI, migration, S13 hardening or downstream capability was added.
- Confluence page `4456477`, `16. Owner Booking Request — MVP Contract`, published as v2. V2 explicitly distinguishes controlled internal `500` from fail-closed `BOOKING_TEMPORARILY_UNAVAILABLE / 503`.
- Reproducible evidence on the current snapshot:
  - Node `22.23.1` backend build — PASS;
  - Pilot OpenAPI export + `backend/scripts/assert-openapi.cjs` — PASS;
  - focused real-PostgreSQL/backend HTTP matrix — `17/17 PASS`;
  - focused RN booking API/provider/screen matrix — `15/15` across the selected suites after repair; final deferred BookingReview rerun `4/4 PASS`;
  - Owner booking visual evidence verifier — `3/3 PASS` (production-component web/static captures only; no physical-device claim);
  - Owner App Node 22 typecheck/lint and Expo web export — PASS;
  - `git diff --check` — PASS.
- Independent RN/UX review — `PASS / NO VETO`.
- Independent architecture review — T043 `PASS / NO VETO`; package remains `BLOCKED_PRODUCT_DECISION` because T037/current compatibility contract uses `IDEMPOTENCY_PAYLOAD_CONFLICT` and `SLOT_VERSION_STALE`, while normative T041 v3 requires `IDEMPOTENCY_CONFLICT` and `BOOKING_STATE_CONFLICT`. Project authority forbids choosing or silently renaming either side; the normative pages require an explicit Product/SA reconciliation.
- T043 repair evidence added after the initial review:
  - injected mid-transaction counter-drift failure proves full rollback, then a fresh worker instance reclaims the same overdue hold and emits/releases exactly once;
  - real PostgreSQL create/confirm/decline/cancel versus expiry races complete inside a bounded deadline, converge on a terminal/reclaimable state and preserve counter/effect invariants;
  - bounded worker health exposes only running, last success, processed/failure totals, pending/overdue counts and oldest overdue age—no IDs or payloads;
  - public health reads an O(1) cached snapshot; backlog SQL runs only on the 15-second worker cycle with a 250 ms transaction-local statement timeout, and refresh failure preserves cached health without leaking raw errors;
  - final affected Node 22 build plus PostgreSQL/worker/HTTP matrix — `19/19 PASS`; architecture final verdict — `PASS / NO RESIDUAL T043 VETO`.
- Independent security re-review initially vetoed probe-path SQL amplification. Health was repaired to serve only the cached snapshot, with the aggregate restricted to the bounded worker cycle and `250ms` timeout; final security verdict — `PASS / NO RESIDUAL SECURITY OR CORRECTNESS VETO`.
- Governance synchronization: evidence comments were added without transitions to `SCRUM-667/T043` (`10144`), `SCRUM-661/T037` (`10145`) and `SCRUM-601/S12` (`10146`).
- Jira workflow: no comments or transitions performed after the veto; no human agreement or parent acceptance was inferred.
- Machine state: `T043=IMPLEMENTED / VALIDATED`; S12 package `PARTIAL / BLOCKED_PRODUCT_DECISION` solely on the unresolved T037↔T041 public error-name contradiction and separate human acceptance.
- Exactly one next bounded slice after explicit contract reconciliation: `SCRUM-602 / S13 — Harden concurrent booking creation and expiration` (not started).

## 2026-08-13 — S12 canonical conflict reconciliation and completion package

- Explicit Product/SA authority resolved the sole machine blocker. The canonical `PILOT_V1` booking-create conflicts are now:
  - changed payload under the same authoritative Owner/operation/idempotency key: `409 IDEMPOTENCY_CONFLICT`;
  - stale `expectedSlotVersion` or incompatible authoritative booking state: `409 BOOKING_STATE_CONFLICT`.
- Confluence `16. Owner Booking Request — MVP Contract` page `4456477` is v3 and the API baseline page `655395` is v6. Both record those exact names. `IDEMPOTENCY_PAYLOAD_CONFLICT` and `SLOT_VERSION_STALE` are not public aliases for the Pilot create operation; unrelated Legacy/other command compatibility was not rewritten.
- Backend create behavior is aligned end to end: the service branches by effective profile, controller/OpenAPI documents both canonical codes, and the generated assertion rejects either superseded alias on the create operation. Fingerprint conflict and stale-version tests each prove no extra hold, counter, outbox or audit effect.
- RN branches on machine code rather than message: `BOOKING_STATE_CONFLICT` returns to authoritative availability; `IDEMPOTENCY_CONFLICT` disables resubmit and returns to a fresh selection/command context. Neither path can render waiting/success. Uncertain timeout/network retry keeps the same command and idempotency key.
- Updated production-component visual evidence is `4/4 PASS`: compact review, standard waiting, wide stale conflict and compact idempotency conflict. Manifest/source/PNG hashes pass. This remains deterministic web/static component evidence, not simulator/physical-device acceptance.
- Machine checks on the final snapshot:
  - Node `22.23.1` backend build, focused PostgreSQL/worker/HTTP matrix `21/21`, explicit `PILOT_V1` OpenAPI export/assertion — PASS;
  - `LEGACY_COMPAT` regression: omitted `expectedSlotVersion` still creates through the prior contract, while generated Legacy OpenAPI keeps that property optional — PASS; Pilot continues to require a positive integer version;
  - Node `22.23.1` Owner App focused booking `13/13`, full RN `22 suites / 130 tests`, typecheck, lint and Expo web export — PASS; known React test-harness `act()` diagnostics/open-handle behavior required `--forceExit` for the full Jest process and is recorded, not hidden;
  - visual capture/verifier `4/4` — PASS;
  - `git diff --check` — PASS.
- Independent security/QA review: `PASS / NO RESIDUAL VETO`. It confirms canonical create-boundary codes, no-side-effect conflict/stale evidence, 100-way concurrency, expiry rollback/reclaim, OWNER authority/privacy and RN fail-closed behavior.
- Machine classification: `T037=CONTRACT_RECONCILED / READY_FOR_HUMAN_ACCEPTANCE`; `T038=IMPLEMENTED / VALIDATED`; `T039=IMPLEMENTED / MACHINE_AND_STATIC_VISUAL_VALIDATED / READY_FOR_HUMAN_ACCEPTANCE`; `T040=QA_COMPLETE / VALIDATED`; `T043=IMPLEMENTED / VALIDATED`; bounded T140 booking-create slice `CONTRACT_VALIDATED`; S12 `MACHINE_COMPLETE / READY_FOR_HUMAN_ACCEPTANCE`.
- Governance boundary: only T038, T040 and T043 are candidates for deterministic Done reconciliation after a final fresh Jira reread. T037, T039 and parent S12 remain open because their SA/RN/product acceptance gates are human; machine reviewers do not simulate that acceptance. Broad T140 remains open by its unrelated API baseline DoD.
- Final Jira reconciliation: fresh DoD/dependency reread plus three independent PASS verdicts allowed deterministic transition of `SCRUM-662/T038`, `SCRUM-664/T040` and `SCRUM-667/T043`; each was immediately reread as `Готово / Готово`. `SCRUM-661/T037`, `SCRUM-663/T039`, `SCRUM-601/S12` and broad `SCRUM-764/T140` remain `К выполнению / unresolved`. Fresh canonical project count is `38/100 Done = 38%`; no parent closure is inferred from that percentage.
- No S13 work beyond the already-required T043 dependency was started. No clinic decision, notification, cancellation, history, payment, migration, provider, deploy, commit, push or PR was performed.
- Exactly one next bounded slice after explicit human acceptance and S12 closure: `SCRUM-602 / S13 — Harden concurrent booking creation and expiration`; `NOT_STARTED` in this run.

## 2026-08-13 — S13 Booking Core concurrency and performance hardening

- Active bounded scope: `SCRUM-602 / S13` and its only unfinished implementation child `SCRUM-668 / T044`. Fresh Jira reconciliation confirmed `SCRUM-665/T041`, `SCRUM-666/T042` and `SCRUM-667/T043` are already `Готово / Done`; they were not reopened or reimplemented.
- Added a reusable real-PostgreSQL T044 harness and canonical disposable-database runner. Profiles cover repeated final-unit contention at 50/100, multi-capacity 5-of-30, distributed concurrency 1/5/10/20/40, 100-way same-key idempotency, 50 stale-version callers, mixed confirm/decline/owner-cancel with deterministic expiry convergence, and a 50-hold expiry backlog.
- Fixed local engineering gates are explicitly `ENGINEERING BASELINE / NOT PRODUCTION SLA`: invariant violations, duplicate mutations, unexpected failures, deadlocks and pool leaks must all be zero; final-unit completion <=2000ms; multi-capacity p95 <=2000ms; distributed p95 <=1500ms; 50-hold expiry cycle <=2000ms; each recorded profile must return pool in-use/waiting counts to zero.
- Baseline evidence exposed one bounded query defect: the Pilot expiry claim retained a Legacy multi-state `CASE` shape and did not use the scoped manual-confirmation SLA index. Pilot now uses its exact selective `MANUAL_CONFIRM_PENDING / confirmation_sla_expires_at` claim; Legacy keeps its prior multi-state/expires-at branch. The final exact runtime `EXPLAIN (ANALYZE, BUFFERS)` uses `booking_holds_manual_confirmation_sla_idx`; slot and idempotency lookups use their scoped indexes.
- Machine-readable and human evidence is stored in `docs/testing/evidence/s13-booking-core-performance/results.json` and `REPORT.md`. It binds branch, HEAD, dirty snapshot and relevant source hashes, records per-profile latency/throughput/outcomes/invariants and per-profile pool state, and documents the 20-connection pool on a one-CPU container as the local limiting resource. Maximum validated hot-row concurrency is 100, distributed concurrency is 40, pool capacity is reached near 20, and concurrency 10 is the conservative local safety-margin point; none of these values is production sizing guidance.
- Correctness result: overbooking `0`, counter drift `0`, duplicate business mutations/facts `0`, unexpected failures `0`, PostgreSQL deadlocks `0`, idle-in-transaction/pool leaks `0`, and post-convergence zombie holds `0`. The same-key storm produces one hold/event/audit and 100 stable responses; mixed command races converge to one current terminal fact per hold; expiry drains all 50 overdue holds and restores capacity exactly once.
- Reproducibility: `scripts/performance/run-t044-booking-core.sh` creates, migrates and trap-drops a uniquely named disposable database and runs the harness in an isolated Node 22 container without development workers. Seed work is outside measured request latency and no shared database-wide reset is performed.
- Verification on the final snapshot: T044 performance harness `9/9 PASS`; Node 22 backend migration verification/build, focused Booking Core/PostgreSQL/HTTP/expiry/observability regression and Pilot OpenAPI export/assertion — PASS; bounded Owner App S12 regression — PASS; `git diff --check` — PASS. Independent architecture and security/QA reviews report `PASS / NO RESIDUAL VETO`; final governance validation is required after this overlay update.
- Machine classification and final reconciliation: after a fresh Jira DoD/dependency reread, evidence comment `10219` and Confluence evidence page `5111809`, `SCRUM-668/T044` was transitioned and immediately reread as `Готово / Готово`. `S13=MACHINE_COMPLETE / READY_FOR_HUMAN_ACCEPTANCE`; `SCRUM-602/S13` remains `К выполнению / unresolved` because `result accepted` is a human gate and machine evidence does not simulate it. S12/T037/T039 human acceptance is likewise unchanged. Canonical first-MVP progress is now `39/100 Done = 39%`.
- No S14 implementation, clinic confirm/reject work, alternative time, cancellation, history, notifications, payments, telemedicine, production deployment, commit, push or PR was performed.
- Exactly one next bounded slice after the remaining human acceptance/closure gate: `SCRUM-603 / S14 — Подтвердить или отклонить заявку`; `NOT_STARTED`.
## 2026-08-31 — W7-A clinical Visit, Result, Amendment and Pet Diary foundation closure

- Additive migration `1719610000000_add_clinical_visit_result_foundation.js`
  creates the clinical Visit, Result, Amendment and immutable derived Diary
  projection with exact Appointment/Hold, Owner/Pet, clinic/location and slot
  lineage. A populated DOWN fails closed with
  `W7A_DOWN_DATA_REMEDIATION_APPROVAL_REQUIRED` before removing any schema or
  rewriting clinical history.
- Visit completion is idempotent and retains its previously proven exactly-once
  append-only audit/outbox evidence. Result supports editable `DRAFT` followed
  by immutable `PUBLISHED`; every persisted column of a published Result is
  protected. Amendments target only published Results, preserve the original
  unchanged, retain exact provenance and are themselves immutable.
- Diary is a unique, immutable Result-or-Amendment projection with deterministic
  chronology. `DRAFT` Results are excluded. The Pilot Owner route is enabled
  through the bounded MVP controller and product-scope guard; owning Owners see
  published Results and Amendments, foreign Owners receive `404`, and unrelated
  Pet clinical data is excluded.
- Result publication and Amendment publication append exactly one audit and one
  outbox business event per transition/creation; idempotent replay does not
  duplicate rows, projections or evidence. Existing valid event names were
  retained.
- Focused real-PostgreSQL migration evidence passes `1/1`, covering schema,
  Visit coherence/idempotency, DRAFT edit/exclusion, complete published-row and
  Amendment immutability, lineage, unique Diary projection, chronology and
  populated-DOWN preservation. Focused lifecycle/no-leak HTTP evidence passes
  `1/1`; Pilot diary controller/scope regressions pass `24/24`.
- The single independent clinical-data/security review completed one remediation
  cycle and returned `CLINICAL_DATA_SECURITY_REVIEW=NO_VETO`.
- Final flags: `POSTGRESQL_CONSTRAINTS=PASS`, `HTTP_LIFECYCLE=PASS`,
  `OWNER_NO_LEAK=PASS`, `DRAFT_EXCLUSION=PASS`,
  `PUBLISHED_IMMUTABILITY=PASS`, `AMENDMENT_LINEAGE=PASS`,
  `POPULATED_DOWN_FAIL_CLOSED=PASS`, `AUDIT_OUTBOX=PASS`,
  `CLINICAL_DATA_SECURITY_REVIEW=NO_VETO`, `CURRENT_STATE_UPDATED=YES`.
  `GIT_DIFF_CHECK=PASS`.
  Retained sticky evidence: `W7A_VISIT_COMPLETION_EVIDENCE=PASS`,
  `AUDIT_OUTBOX_REPAIR=PASS`, `AMENDMENT_IDEMPOTENT_REPLAY=PASS`,
  `AMENDMENT_IMMUTABILITY=PASS`, `HTTP_LIFECYCLE_REPAIR=PASS`.
  `W7A_SCHEMA_COMPLETE=YES`, `VISIT_COMPLETION_FOUNDATION=PASS`,
  `RESULT_FOUNDATION=PASS`, `AMENDMENT_FOUNDATION=PASS`,
  `PET_DIARY_READ_MODEL_FOUNDATION=PASS`,
  `W7A_STATUS=IMPLEMENTED/MACHINE_COMPLETE`, `W7A_COMPLETE=YES`.
  Recommended next slice is only W7-B — Clinic Visit Completion + Result UI.

## 2026-09-01 — W7-B2 one-Result-per-Visit decision and clinical readback repair

- Approved Pilot cardinality is now explicit: one Visit has zero or one primary
  Result; post-publication corrections remain append-only Amendments. The
  configured PostgreSQL precheck found no Visit with more than one Result, so
  no business-row remediation or rewrite was performed.
- Additive corrective migration
  `1719620000000_enforce_one_clinical_result_per_visit.js` adds only
  `UNIQUE (visit_id)` and has an ordinary reversible DOWN that removes the
  invariant without changing Result rows. The migration itself also fails
  before the ALTER when incompatible duplicate cardinality exists.
- Result creation now relies on database uniqueness for races. The first create
  persists one DRAFT and its evidence; same-key replay returns that canonical
  Result without duplicate audit/outbox evidence; a different key receives
  `CLINICAL_RESULT_ALREADY_EXISTS` with bounded current-Result readback.
- Authorized `GET /v1/clinic/visits/:visitId/results` returns the durable
  `visitId`, the exact unique DRAFT or PUBLISHED Result (or `null`), and only
  that published Result's immutable Amendments ordered by `created_at ASC,
  id ASC`. Reads preserve existing veterinarian clinic/location authority and
  perform no clinical, Diary, audit or outbox mutation.
- Focused real-PostgreSQL migration evidence passes `1/1`, including first/
  second creation, DOWN → UP, row preservation and unchanged W7-A migration
  bytes. Focused HTTP/concurrency/readback evidence passes `1/1`, covering all
  four reload states, single-winner concurrency, replay/conflict behavior,
  deterministic Amendment history, no-leak and insufficient capability.
  Backend build and OpenAPI export/assertion pass. The shared local database's
  checksum registry still contains a pre-existing older `171961` checksum;
  this repair did not rewrite that registry or the closed W7-A migration.
- Final flags: `W7B_RESULT_SELECTION_DECISION_REQUIRED=NO`,
  `W7B_RESULT_CARDINALITY=ONE_PER_VISIT`,
  `W7B_RESULT_CARDINALITY_SCHEMA=PASS`, `W7B_CLINICAL_READBACK=PASS`,
  `W7B_BACKEND_CONTRACT_GAP=NO`. Recommended next slice is only W7-B — Resume
  Clinic Visit Completion + Result UI.

## 2026-09-01 — W7-B4 veterinarian Visit identity readback repair

- The existing exact-scope veterinarian Visit detail now returns the bounded
  identity projection `appointmentId`, `petId`, and `visitId`. Appointment and
  Pet are joined through the exact Hold/slot/location lineage; Visit is joined
  only through that Appointment plus Hold, Pet, clinic, location, and slot.
  Before durable Visit creation `visitId` is `null`; no Pet/latest/timestamp
  inference is used and the read path contains no mutation.
- Clinic Portal detail parsing retains the three identities. A veterinarian-only
  exact BFF forwards canonical Result readback, and the reload client calls it
  only for a non-null durable `visitId`; null remains the truthful pre-Visit
  state without a premature Result request.
- Backend focused unit evidence passes `2/2`; backend and Clinic Portal builds
  and Clinic typecheck pass. Focused Portal veterinarian visit/completion
  coverage passes `15/15`, including identity survival across reload, canonical
  published Result plus Amendment readback, and the null-Visit no-call guard.
  `git diff --check` passes.
- The focused backend HTTP/PostgreSQL matrix is implemented but could not run in
  this workstation because the configured local PostgreSQL role/database
  `vethelp` does not exist. OpenAPI export succeeds, while the repository-wide
  assertion stops on the pre-existing unrelated create-Hold closure assertion
  (`Create hold request must be closed`). Clinic Portal has no ESLint script or
  ESLint dependency, so no targeted ESLint command exists.
- Repair outcome: `W7B_VISIT_IDENTITY_READBACK=PASS`,
  `W7B_BACKEND_CONTRACT_GAP=NO`. Remaining verification-tooling limitations do
  not indicate an identity schema gap. Recommended next slice is only W7-B3 —
  Resume Clinic Visit Completion + Result UI.

## 2026-09-01 — W7-B3R Clinic Visit completion and Result UI closure

- The veterinarian Visit workspace now follows only the authoritative reload
  chain Hold → Appointment/Pet → durable Visit → unique Result → ordered
  Amendments. Completion and controlled replay reload Visit detail to obtain
  `visitId`; no client identity is synthesized and no mutation is used for
  discovery.
- A completed Visit with no Result exposes bounded draft creation. A competing
  create conflict converges by canonical reload. DRAFT shows localized
  visibility status, bounded editing, versioned save, validation/network states,
  and explicit publish confirmation describing Owner visibility, main-text
  immutability, and Amendment-only correction.
- PUBLISHED renders the original Result read-only with publication facts and no
  ordinary editor. Immutable Amendments remain in backend order. Amendment
  creation uses a stable idempotency key across retry and reloads canonical
  history, preventing a duplicate presentation row after response loss/replay.
  Authorized read-only users retain clinical readback while mutation controls
  are removed.
- Exact veterinarian-only Portal BFF mutations now forward Result create,
  versioned draft update, publish, and Amendment create to the already-approved
  backend contract with bounded content, UUID validation, no-store responses,
  correlation IDs, and forwarded stable idempotency keys.
- Focused workflow tests pass `4/4`, explicitly covering all five reload states,
  identity/no-discovery-mutation behavior, competing creation, save/publish/
  Amendment convergence, immutable published UX, backend ordering, and
  read-only capability. Existing focused veterinarian Visit/completion suites
  pass `15/15`. Clinic Portal typecheck and production build pass;
  `git diff --check` passes. No backend file or contract was changed.
- Final flags: `CLINIC_VISIT_COMPLETION_UI=PASS`,
  `CLINIC_RESULT_DRAFT_UI=PASS`, `CLINIC_RESULT_RELOAD_SAFETY=PASS`,
  `CLINIC_RESULT_PUBLICATION_UI=PASS`,
  `CLINIC_RESULT_IMMUTABILITY_UX=PASS`, `CLINIC_AMENDMENT_UI=PASS`,
  `W7B_COMPLETE=YES`. The previously recorded local PostgreSQL, unrelated
  OpenAPI assertion, and absent Portal ESLint-command debts remain non-blocking
  and unchanged. Recommended next slice is only W7-C — Owner Pet Diary UI.

## 2026-09-01 — W7-C1 grouped Owner clinical Diary readback repair

- The existing owner-scoped Pet Diary endpoint retains its legacy flattened
  `entries` array and adds a bounded Result-centric `clinicalEntries` projection.
  Each entry carries the exact completed Visit date, display-safe clinic and
  optional location/service context, the immutable published Result, and only
  its exact FK-linked Amendments. Doctor remains explicitly `null` because no
  already-approved display name exists in this lineage.
- Grouping is server-authoritative through Result → Visit and Amendment → Result
  context keys plus the immutable Diary source rows. DRAFT Results and orphan
  Amendment projections are excluded. Top-level entries remain deterministic
  newest-Visit-first; nested Amendments are emitted in `created_at ASC, id ASC`
  order. The read performs SELECTs only and does not emit audit/outbox events or
  mutate clinical/Diary state.
- Expo Owner Web now allowlists the exact bounded Pet Diary GET. A separate
  Owner Diary client/parser validates Pet identity, grouped Visit/Result IDs,
  timestamps, nullable display facts, content, and Amendment order as returned;
  the existing injected Pet API contract remains unchanged. No Owner UI was
  started in this repair.
- Focused backend projection tests pass `16/16`; focused Owner parser/BFF tests
  pass `14/14`; backend and Owner typechecks/build pass; targeted Owner ESLint,
  OpenAPI export, and `git diff --check` pass. The focused real-PostgreSQL HTTP
  assertion is updated for the grouped contract but its bounded execution stops
  at the existing disposable-database guard because no `vethelp_w7a5r_*`
  database is configured; no local database setup or repair was attempted.
- Final flags: `W7C_GROUPED_DIARY_READBACK=PASS`,
  `W7C_VISIT_CONTEXT_READBACK=PASS`,
  `W7C_AMENDMENT_PARENT_LINKAGE=PASS`, `W7C_BACKEND_CONTRACT_GAP=NO`.
  Recommended next slice is only W7-C — Resume Owner Pet Diary UI using the
  grouped authoritative projection.

## 2026-09-01 — W7-C2 Owner Pet Diary UI closure

- The shared Expo Owner app now opens the selected Pet's Diary from the existing
  Pet selection journey. Diary queries are scoped by Owner authority and exact
  `petId`; a Pet change clears any open Result detail and foreign-Pet response
  data fails closed without flashing clinical content.
- The Diary list consumes only authoritative `clinicalEntries` in backend order,
  with one item per published Result. Each item uses the exact Visit date and
  clinic context, includes available service/veterinarian/location facts, a
  bounded Result preview, and an Amendment count without exposing identifiers or
  enums. Empty, loading, retryable error, and missing optional-fact states are
  Owner-safe; legacy flattened Diary entries are not used for clinical grouping.
- Result detail is read-only and presents exact Visit context, the immutable
  original Result, then Amendments in backend oldest-first order. Owner copy
  explicitly preserves the original in history and identifies Amendments as
  later clarifications rather than separate Visits.
- Focused Diary and navigation tests pass `11/11`; Owner typecheck and targeted
  ESLint pass. Expo Web static export passes under the repository-required Node
  22 runtime; `git diff --check` passes. No backend, schema, authorization, or
  clinical mutation contract changed.
- Final flags: `OWNER_PET_DIARY_LIST_UI=PASS`,
  `OWNER_PET_DIARY_RESULT_DETAIL=PASS`,
  `OWNER_PET_DIARY_AMENDMENTS=PASS`,
  `OWNER_PET_DIARY_DRAFT_EXCLUSION=PASS`,
  `OWNER_PET_DIARY_VISIT_CONTEXT=PASS`,
  `OWNER_PET_SWITCH_ISOLATION=PASS`, `W7C_COMPLETE=YES`. Recommended next slice
  is only W7-D — Visit → Published Result → Owner Pet Diary Real E2E + Bounded
  Visual Closure.

## 2026-09-02 — W7-D-R1 Owner Web entry and auth/BFF repair

- Real Chromium reproduction confirmed that the canonical local Owner launcher
  omitted all three required BFF settings. Guest `GET /api/owner/v1/auth/session`
  therefore returned `503 UNAVAILABLE`, while OTP mutation returned
  `403 ORIGIN_REJECTED` before reaching the backend. Direct backend OTP remained
  healthy. `localhost:8081` and `127.0.0.1:8081` were also distinct under the
  exact Host/Origin gate.
- The local launcher now supplies the backend URL, one canonical
  `http://127.0.0.1:8081` Owner origin, and the existing local IP-signing secret.
  An early exact-only loopback normalization redirects `localhost:8081` to that
  canonical origin while preserving path/query/hash. It does not relax
  production Origin/Host matching, trust forwarded Host, or permit wildcards.
  The BFF now resolves a missing protected-session cookie as normal `401` guest
  bootstrap before requiring upstream configuration.
- A bounded real-browser smoke against backend/PostgreSQL passed: canonical
  redirect; guest bootstrap; OTP request and verify; HttpOnly, Secure,
  SameSite=Lax session establishment; authenticated reload; real owned-Pet
  readback; exact Pet Diary entry; and a second reload/readback. No credential or
  development OTP was exposed to browser storage or URL.
- Focused Owner auth/BFF/origin/navigation regression coverage passes. The
  ordinary backend Compose restart encountered the known stale `171961`
  checksum-registration debt after applying `171962`; no checksum was rewritten.
  The smoke used the same Compose backend environment with current source while
  skipping only the blocked migration wrapper. OTP rate rows created solely by
  repeated reproduction were removed; one real local smoke Pet remains.
- Final flags: `OWNER_WEB_GUEST_BOOTSTRAP=PASS`,
  `OWNER_WEB_CANONICAL_LOCAL_ORIGIN=PASS`, `OWNER_WEB_OTP_REQUEST=PASS`,
  `OWNER_WEB_OTP_VERIFY=PASS`, `OWNER_WEB_SESSION_ESTABLISHMENT=PASS`,
  `OWNER_WEB_SESSION_RELOAD=PASS`, `OWNER_WEB_PETS_READBACK=PASS`,
  `OWNER_WEB_PET_DIARY_ENTRY=PASS`,
  `PRODUCTION_ORIGIN_SECURITY_REGRESSION=PASS`,
  `W7D_OWNER_WEB_AUTH_REPAIR=PASS`, `OWNER_WEB_REAL_UI_REACHABLE=PASS`,
  `W7D_FIRST_DEFECT_REPAIRED=YES`. Recommended next slice is only W7-D-R —
  resume remaining real E2E + bounded visual closure.

## 2026-09-02 — W7-D-R real journey stopped by Pilot Clinic route exclusion

- Reused the exact Owner/Pet fixture (`W7D Рекс`) and a real available slot,
  established an Owner session through the backend/PostgreSQL path, created one
  `MANUAL_CONFIRM_PENDING` hold, and confirmed it through the live Clinic Portal
  queue/BFF/backend path. PostgreSQL readback proves the same hold and appointment
  are `CONFIRMED`.
- The next mandatory step cannot enter the current-source veterinarian Visit
  workspace. Live Chromium receives literal `404 Not Found` for
  `/clinics/{clinicId}/locations/{locationId}/vet/visits/{holdId}`. A current-source
  Portal restart reproduced the same result, while the page file exists and the
  confirmed rows remain authoritative.
- Root cause is deterministic: under `MVP_SCOPE_PROFILE=PILOT_V1`,
  `apps/clinic-portal/lib/config/mvp-product-scope.ts:isPilotProductPath` explicitly
  blocks both `vet/visits` Clinic pages and their `/api/clinic/.../vet/visits` BFF
  routes. This contradicts the mandatory W7 Clinic Visit completion path and is a
  new independent production defect after the already-consumed W7-D defect budget.
- Per W7-D-R instructions, no repair was attempted and closure stopped immediately.
  No final screenshots, accessibility verdict, or Product/UX review were produced.
- Current flags: `REAL_VISIT_COMPLETION_E2E=BLOCKED`,
  `REAL_DRAFT_EXCLUSION_E2E=NOT_RUN`, `REAL_RESULT_PUBLICATION_E2E=NOT_RUN`,
  `REAL_OWNER_DIARY_READBACK_E2E=NOT_RUN`, `REAL_AMENDMENT_E2E=NOT_RUN`,
  `AMENDMENT_ORIGINAL_PRESERVED=NOT_RUN`, `DIARY_PROVENANCE=NOT_RUN`,
  `CLINIC_RELOAD_READBACK=NOT_RUN`, `OWNER_RELOAD_READBACK=NOT_RUN`,
  `CLINIC_VISUAL_EVIDENCE=NOT_RUN`, `OWNER_VISUAL_EVIDENCE=NOT_RUN`,
  `ACCESSIBILITY=NOT_RUN`, `PRODUCT_UX_REVIEW=NOT_RUN`,
  `W7_D_R=BLOCKED_SCOPE_EXPANSION`.

## 2026-09-02 — W7-D-R2 Pilot Visit/Result route repair

- Repaired only the Pilot route-containment guards in Clinic Portal and Backend.
  Exact canonical Visit list/detail, Visit completion, Result create/read/update,
  publish, and Amendment routes are admitted. Broader descendants and the
  existing telemedicine, quality, alternative-slot and other non-Pilot routes
  remain explicitly blocked. Existing capability and clinic/location ABAC code
  was not changed.
- Focused Portal containment passed 10/10, including all required W7 page/BFF
  shapes, retained 404s for unrelated descendants, and missing/invalid-session
  denial. Existing veterinarian denied-session and wrong-scope checks passed
  2/2. Backend Pilot guard tests passed 24/24.
- The current-source real smoke reused confirmed hold
  `edddb377-80e9-448e-94ac-b9d0269bdb4b`: Clinic queue shell loaded, the exact
  `W7D Рекс` veterinarian Visit workspace returned 200, and its appointment
  context plus completion form rendered. No Visit or Result mutation was made.
- Clinic typecheck/build and Backend build passed. Final flags:
  `PILOT_VISIT_PAGE_ROUTE=PASS`, `PILOT_VISIT_BFF_ROUTES=PASS`,
  `PILOT_SCOPE_FAIL_CLOSED=PASS`, `CLINIC_AUTHORIZATION_UNCHANGED=PASS`,
  `REAL_VET_VISIT_ROUTE_SMOKE=PASS`,
  `W7D_PILOT_VISIT_ROUTE_REPAIR=PASS`,
  `REAL_VET_VISIT_ROUTE_REACHABLE=PASS`,
  `W7D_SECOND_DEFECT_REPAIRED=YES`. Recommended next slice is only W7-D-R3 —
  resume remaining Visit → Result → Diary real E2E plus bounded visual closure.

## 2026-09-02 — W7-D-R3 real clinical journey green; accessibility stop gate

- The existing confirmed `W7D Рекс` appointment completed through the live
  Clinic Portal/BFF/backend/PostgreSQL path. The same browser journey created
  one DRAFT, proved its exact text absent from the live Owner Expo Web Diary,
  published it, opened the Owner Result detail with Visit context, published
  one Amendment, and restored Result plus Amendment after both Clinic and Owner
  reloads.
- Exact PostgreSQL proof for hold `edddb377-80e9-448e-94ac-b9d0269bdb4b`
  shows one durable Visit `d3843d8b-8a65-45c7-a5e0-ff607ec0bd96`, one
  `PUBLISHED` Result `466a35c2-d2c8-4ab3-93a6-98b281a68997`, one Result Diary
  projection, one Amendment `f54860e4-0e18-46db-9301-75357304df5c`, one
  Amendment Diary projection, exact Owner/Pet provenance, and unchanged
  original Result text.
- The pre-screenshot accessibility gate found a new independent production
  defect. In Chromium at `430×932`, publish-dialog focus entry works, but Tab
  after the second dialog button escapes to `BODY`; Shift+Tab from the first
  button escapes to the background publish trigger; after leakage, Escape does
  not close the dialog. Horizontal overflow remains zero. The current
  `ConfirmPublish` implementation has initial focus and Escape handling but no
  focus containment.
- Per the R3 defect rule, closure stopped immediately. No final screenshots or
  Product/UX review were produced and no repair was attempted. Current flags:
  `REAL_VISIT_COMPLETION_E2E=PASS`, `REAL_DRAFT_EXCLUSION_E2E=PASS`,
  `REAL_RESULT_PUBLICATION_E2E=PASS`, `REAL_OWNER_DIARY_READBACK_E2E=PASS`,
  `REAL_AMENDMENT_E2E=PASS`, `CLINIC_RELOAD_READBACK=PASS`,
  `OWNER_RELOAD_READBACK=PASS`, `PUBLISHED_RESULT_IMMUTABILITY_UX=PASS`,
  `AMENDMENT_ORIGINAL_PRESERVED=PASS`, `DIARY_PROVENANCE=PASS`,
  `ACCESSIBILITY=FAIL`, `CLINIC_VISUAL_EVIDENCE=NOT_RUN`,
  `OWNER_VISUAL_EVIDENCE=NOT_RUN`, `PRODUCT_UX_REVIEW=NOT_RUN`,
  `W7_COMPLETE=NO`, `W7D_TARGETED_REPAIR_REQUIRED=YES`.
## 2026-09-02 — W7-D-R4 publish-dialog focus containment repair

- The Clinic Result publish confirmation dialog now traps keyboard focus across
  its existing two controls: Tab from the final control returns to the first,
  and Shift+Tab from the first returns to the final control. Keyboard handling
  remains scoped to the open dialog; its role, accessible name, wording,
  action structure, pointer behavior, and initial focus are unchanged.
- Escape after repeated keyboard cycling and explicit Cancel both close the
  dialog and restore focus to the exact publish trigger. Successful publication
  moves focus off the soon-to-be-removed dialog before canonical reload, so it
  does not leave focus on detached DOM.
- Focused Chromium coverage at `430×932` passes `5/5`, including repeated Tab
  and Shift+Tab containment, Escape and Cancel focus restoration, and the
  confirm path. Clinic Portal typecheck and production build pass;
  `git diff --check` passes.
- Final flags: `PUBLISH_DIALOG_INITIAL_FOCUS=PASS`,
  `PUBLISH_DIALOG_TAB_CONTAINMENT=PASS`,
  `PUBLISH_DIALOG_SHIFT_TAB_CONTAINMENT=PASS`,
  `PUBLISH_DIALOG_ESCAPE=PASS`,
  `PUBLISH_DIALOG_TRIGGER_FOCUS_RETURN=PASS`,
  `PUBLISH_DIALOG_CONFIRM_PATH=PASS`,
  `W7D_PUBLISH_DIALOG_FOCUS_REPAIR=PASS`,
  `ACCESSIBILITY_BLOCKER_REPAIRED=YES`. Recommended next slice is only
  W7-D-R5 — final bounded visual/accessibility/Product-UX closure.
## 2026-09-02 — W7-D-R6 Owner Web document-title repair

- The canonical Expo Web root now supplies the deterministic title `VetHelp`
  through both the server HTML shell and existing Expo Router head integration.
  It is present synchronously, does not depend on Owner or Diary API data, and
  does not affect native iOS or Android behavior.
- The focused metadata regression passes `1/1`. Real Chromium on the canonical
  authenticated Pet Diary reports `page.title() === "VetHelp"` and zero axe
  `document-title` violations. Owner typecheck, targeted ESLint, Node 22 Expo
  Web export, and `git diff --check` pass.
- Final flags: `OWNER_WEB_DOCUMENT_TITLE_PRESENT=PASS`,
  `OWNER_WEB_DOCUMENT_TITLE_NONEMPTY=PASS`,
  `OWNER_WEB_DOCUMENT_TITLE_AXE=PASS`,
  `W7D_OWNER_DOCUMENT_TITLE_REPAIR=PASS`,
  `ACCESSIBILITY_DOCUMENT_TITLE_BLOCKER_REPAIRED=YES`. Recommended next slice
  is only W7-D-R5R — resume remaining final visual/accessibility/Product-UX
  closure.

## W7 clinical visit/result repair — 2026-09-09

- Veterinarian LIST remains the bounded eight-field projection. DETAIL adds
  only nullable `visitId`, which is required to address the durable clinical
  Visit and Result readback after completion. `appointmentId` and `petId` are
  intentionally not part of the public veterinarian detail DTO.
- `PILOT_V1` permits the veterinarian visit workspace and its Result/completion
  routes. Capability-scoped veterinarian navigation now remains visible in
  PILOT while the Quality surface remains excluded.
- Concurrent appointment completion no longer leaks PostgreSQL lock/deadlock
  failures as HTTP 500; retryable database contention is translated to the
  existing conflict contract.
- Clinical migration foundation and one-result-per-Visit cardinality tests
  PASS 2/2. Veterinarian HTTP read matrix PASS 21/21. Focused backend unit
  gates PASS 33/33.
- Real PostgreSQL HTTP gates for Owner Diary, Result readback, completion
  evidence/concurrency and immutable Amendment replay PASS.
- Clinic Portal clean production build and TypeScript PASS. Focused W7
  Chromium regression suite PASS 23/23, including PILOT navigation,
  veterinarian list/detail, completion, Result lifecycle, immutable Amendment
  workflow and publish-dialog keyboard containment.
