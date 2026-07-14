# V50 program current state

Updated: 2026-07-14

## Program status

- `BASELINE-02`: `COMPLETE`, committed as `22da293`.
- `V50-SHELL-01`: `COMPLETE`.
- Integration status: `COMMITTED`.
- Canonical target: `V50`; source: `prototype-v50/index.html`; manifest SHA-256: `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`.
- Branch/worktree: `agent/v50-shell-01` / `/Users/evrusetskiy/work/pethelp-alpha-v50-shell-01`.
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
- Visual scope: shell PASS only. Business-screen content remains not visually verified; parity remains `0/30 VISUALLY_VERIFIED`.
- Backend tests were not run because backend code did not change.
- Independent repair review: PASS; no remaining vetoes.

## Compatibility and rollback

- Owner: `VETHELP_OWNER_V50_SHELL` with `VETHELP_OWNER_V51_SHELL` fallback.
- Portal: `PORTAL_V50_SHELL` with `PORTAL_V51_SHELL` fallback.
- V51 Portal exports, skip-link selector and content locator remain compatibility aliases for one release window.
- Rollback is independent per application by defining its canonical V50 flag as false; no data/API rollback is needed.

## Exactly one next slice

`V50-OWNER-01 / Owner Home, Selected Pet Context and Next Safe Action`. Do not start it in this session.
