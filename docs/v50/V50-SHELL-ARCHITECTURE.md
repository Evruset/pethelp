# V50-SHELL-01 architecture decision

Status: ACCEPTED
Date: 2026-07-14
Classification: C3 / R2

## Decision

Implement the shared V50 shell as two platform-native, independently flagged adapters over one semantic token contract. The verified V50 prototype is visual/semantic evidence only; neither Flutter nor Next imports prototype assets or markup at runtime.

Owner navigation remains in Flutter and preserves the selected pet, emergency entry, notifications, tab restoration and existing domain compositions. Clinic and veterinarian surfaces share the Portal frame but receive navigation only after effective capability and exact clinic/location-scope checks. Route handlers and the backend remain authoritative.

## Boundaries and ownership

- Canonical token contract: `docs/v50/design-tokens.json`; the V51 path is a checksum-bound compatibility descriptor.
- Owner: `owner_journey_main.dart`, Owner shell/presentation, theme adapter, focused tests.
- Portal: location layout, server-side flag resolver, V50 shell composition, shell-scoped CSS, focused tests.
- No new routes, APIs, dependencies, role grants, migrations, booking/clinical/telemedicine behavior, or production secrets.

## Flag contract

Each application has an independent canonical V50 flag and legacy V51 alias.

1. When the canonical value is defined, exact `true` enables V50; every other defined value disables it.
2. Only when the canonical value is absent may exact legacy `true` enable V50.
3. Therefore canonical `false` overrides stale legacy `true` and provides deterministic rollback.
4. When both are absent, V50 remains off and the legacy composition renders.

Portal evaluation remains server-side. Owner evaluation uses compile-time environment strings so absence can be distinguished from explicit false. Legacy exports remain for one compatibility window.

## Invariants

- Shell visibility is not authorization; all protected reads/actions remain backend and route guarded.
- Capability and location-scope checks fail closed during loading, error or missing-session states.
- Reception and veterinarian navigation do not broaden one another's authority.
- Existing routes and selected context survive shell rollout/rollback.
- Minimum target, focus, text scaling/reflow and reduced-motion behavior come from semantic tokens.
- Unknown domain statuses remain neutral.
- A prototype anchor is inventory, not permission to expose an unfinished route.

## Rollout and rollback

Ship default-off, verify the legacy alias, enable canonical V50 internally, then expand. Roll back either application independently by defining its canonical flag as false; no schema, API or data rollback is required. Remove V51 aliases only after deployment/CI audit and one compatibility release.

## Rejected alternatives

- Hard rename/removal of V51 flags and selectors: breaks deployed configuration and rollback.
- Boolean OR between V50 and V51 flags: stale legacy true defeats explicit rollback.
- Shared prototype DOM/CSS at runtime: violates platform and accessibility boundaries.
- Exposing all prototype navigation now: creates routes and business scope outside this slice.
- Client-side role authorization: duplicates and weakens backend authority.
- Two complete token JSON trees: creates an uncontrolled source of drift.

## Residual risks

- Global Portal shell CSS can regress unrelated route layouts; full Portal E2E remains required.
- Flutter has two launchers; web evidence and builds must target `lib/owner_journey_main.dart`.
- V51-named runtime selectors remain compatibility debt.
- Shell visual evidence does not certify business-screen content parity.
