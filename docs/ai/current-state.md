# V50 program current state

Updated: 2026-07-16

## Program status

- `BASELINE-02`: `COMPLETE`, committed as `22da293`.
- `V50-SHELL-01`: `COMPLETE / INTEGRATED` at `1c58ad6`.
- `V50-OWNER-01`: `COMPLETE / INTEGRATED` at `2077b00`.
- `V50-OWNER-02`: `COMPLETE / INTEGRATED` at `78d9322`.
- `V50-OWNER-03`: `COMPLETE / INTEGRATED` through merge `e747f61`; runtime `dc762b4`.
- `V50-OWNER-04`: `COMPLETE / INTEGRATED` through merge `9e165a3`; runtime `985dd5b`; evidence certification `d3edf71`.
- `V50-OWNER-05`: `COMPLETE / INTEGRATED` through merge `c2bbcbf`; runtime `cc6ba06`; certification `ade242e`.
- Integration status: `V50-OWNER-06_INTEGRATED / V50-OWNER-07_ACTIVE`.
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
bounded context is `V50-OWNER-07 / Alternative Slot Resolution`.

## V50-OWNER-07 delivery state

`V50-OWNER-07` is ready for integration on `agent/v50-owner-07`; runtime is
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
