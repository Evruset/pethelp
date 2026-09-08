# V50-OWNER-01 bootstrap

Work Chat ID: `V50-OWNER-01`

Title: `V50 Owner Home and Next Safe Action`

Status: `COMPLETE / READY_FOR_INTEGRATION`

Persistent user Work Chats are not exposed by this environment. This file is the durable, self-contained continuation context; no separate chat is claimed.

## Task Brief

- Goal: implement `OWN-001` (`#home` → `/owner/home`) as a V50 Care Journey Hub on the integrated V50 shell.
- User-visible outcome: after sign-in the owner sees the authoritative selected pet, one server-prioritized safe next action, at most one active-care summary, working entries to existing planned-care routes, and an always-visible emergency entry.
- Scope: selected-pet loading/validation/local preference; `GET /v1/owner/home`; V50 Home loading, ready, no-pet, empty-care, retryable/final error, offline/stale and unknown-action states; responsive/accessibility evidence.
- Acceptance: default-off `OWNER_V50_HOME`; V50 Home requires V50 shell; no demo pet; no client status prioritization; no arbitrary backend route; invalid preference clears/falls back safely; legacy rollback remains intact; required backend/Flutter checks and four-viewport evidence pass.
- Source of truth: `prototype-v50/index.html#home`, manifest SHA-256 `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`, `docs/v50/V50-PARITY-REGISTER.md` row `OWN-001`, and existing owner-scoped runtime contracts.
- Environment: branch `agent/v50-owner-01`, worktree `/Users/evrusetskiy/work/pethelp-alpha-v50-owner-01`, base `1c58ad6`.
- Classification/budget: `C3 / R2`, complex budget. The endpoint is additive/read-only but joins pet, booking and telemed presentation authority.
- Risks: cross-owner leakage, divergent client prioritization, stale selected-pet preference, unknown action codes, snapshot freshness, route gaps and over-claiming visual parity.
- Non-goals: full Pets/Diary/Catalog/Booking/Appointments/Telemed/Insurance/Emergency flows; notifications/profile; Clinic Portal; migrations; mutations; payment; MIS; V51 cleanup.

## Contract decision

- Authenticated owner comes only from JWT `sub`; no owner ID is accepted from the client.
- Optional `selectedPetId` is a preference hint, validated against the authoritative owner pet list. Foreign, removed or stale values do not leak existence and fall back deterministically.
- Backend returns a closed `actionCode`, `sourceType` and `sourceId`; Flutter maps only known codes to existing callbacks.
- Unknown action/state is non-executable and uses the safe appointments fallback copy without PII telemetry.
- Local selected-pet persistence is keyed by authenticated owner identity and is never treated as authority.

## Ownership

- Backend: focused `owner-home` read module/controller/service/tests and root module registration only.
- Flutter: `features/owner_journey`, owner entrypoint/wiring, focused tests and the required local-preference dependency.
- Root: current state, registry, parity/program docs, evidence manifest, handoff and integration/validation.
- Forbidden: Portal, migrations, booking/telemed mutations, payment, MIS and unrelated refactors.

## Completed result

The bounded Care Journey Home, owner-home read projection, focused/full checks, durable evidence manifest, independent validator and atomic local commit `feat(v50-owner): add care journey home` are complete. No push was performed. Hand off exactly `V50-OWNER-02 / Pets, Pet Profile and Pet Diary` without starting it.
