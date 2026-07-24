# V50 program current state

Updated: 2026-07-22

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

`V50-CLINIC-03B / Clinic Patients Backend Read Model`: implement only the
default-off exact-location administrative registry GET over policy-valid
association revisions; do not implement Portal UI or patient detail.
