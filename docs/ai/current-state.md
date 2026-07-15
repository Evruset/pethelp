# V50 program current state

Updated: 2026-07-15

## Program status

- `BASELINE-02`: `COMPLETE`, committed as `22da293`.
- `V50-SHELL-01`: `COMPLETE / INTEGRATED` at `1c58ad6`.
- `V50-OWNER-01`: `COMPLETE / INTEGRATED` at `2077b00`.
- `V50-OWNER-02`: `COMPLETE / INTEGRATED` at `78d9322`.
- `V50-OWNER-03`: bootstrap pending on an isolated branch/worktree.
- Integration status: `V50-OWNER-02_INTEGRATED / V50-OWNER-03_NOT_STARTED`.
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
- Business-content visual counter is `3/30 VISUALLY_VERIFIED` after the V50-OWNER-02 independent validator passed.
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

## Next slice

The next permitted slice is `V50-OWNER-03 / Clinic Catalog, Clinic Detail and Doctor Discovery`. Its isolated branch/worktree and bounded-context bootstrap must be created before runtime implementation.

The Owner Home backend reproduction gate is `PASS`: after canonical Compose recreated its dependency volume, Jest ran 4 focused suites and passed; the final combined Owner pets/Home run passed 23/23 tests. Resolution evidence is recorded in `docs/ai/tooling-debt/V50-OWNER-01-backend-spawn-einval.md`.
