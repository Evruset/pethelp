# AI task — Owner bookings conflict repair and browser verification

## Reasoning

`medium` — C1/R1 integration repair of two known Owner App screens.
Standard context budget. Root owns production edits; one read-only browser
agent verifies the resulting components with explicit controlled fixtures.

## Goal

Resolve the existing Owner bookings conflicts and remove the validation blockers
reported after the discovery UX changes. User authorization: «исправь ситуацию»
on 2026-11-03, referring to both conflicts and missing browser verification.

## Allowed scope

- `apps/owner-app/src/bookings/OwnerBookingsScreen.tsx`
- `apps/owner-app/src/bookings/OwnerBookingDetailScreen.tsx`
- Their nearest regression tests, this brief and additive current-state evidence.
- Mark exactly the two resolved conflict files in Git's index; do not complete
  the pending cherry-pick, commit, push, reset or stage other user changes.

## Acceptance criteria

- Both screens parse without conflict markers and have no unmerged index entries.
- Active/history tabs, adaptive layout, server-owned buckets, pagination,
  refresh/retry and one detail action per card remain intact.
- Detail and cancellation preserve server authority, confirmation, version and
  idempotency semantics; no optimistic terminal success is introduced.
- Owner App typecheck, lint, narrow regression tests and Expo Web export pass.
- Browser checks cover the changed discovery journey and repaired bookings
  components at 390x844 and 1440x900, with bounded screenshots and runtime checks.
  Controlled fixtures must be distinguished from a live booking/backend run.

## Do not change

- Previous discovery UX edits and unrelated staged/unstaged user changes.
- Backend, API/schema/auth, migrations, dependencies, assets and Pilot scope.
- Git history or the state of the cherry-pick beyond marking resolved paths.

## Verification

- Existing bookings/list/detail/API tests and affected discovery/review tests.
- Owner App typecheck and lint; Expo Web export to a temporary directory.
- Scoped browser scenarios and `git diff --check`; record failures and limits.
