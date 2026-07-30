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
