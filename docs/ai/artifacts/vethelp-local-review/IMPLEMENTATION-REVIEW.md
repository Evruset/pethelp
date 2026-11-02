# VetHelp Local Sync and Implementation Review

Audit date: 2026-09-22  
Mode: read-only repository audit; archive/report artifacts only  
Workspace: `/Users/evrusetskiy/work/pethelp-alpha`

## Git baseline

- Branch: `agent/owner-v50-r2h-v50-experience-restoration`
- HEAD: `ba98a52e11a74f69da31b934785b773afe17a8c9`
- Upstream: `origin/agent/owner-v50-r2h-v50-experience-restoration`
- Upstream HEAD: `065cf6d` (`Merge pull request #79 from Evruset/agent/owner-v50-r2j-recovery`)
- `origin/main`: `ba85f22` (`Merge PR #72: integration baseline`)
- Remote: `git@github.com:Evruset/pethelp.git`
- Fetch: `git fetch --prune origin` completed successfully. No pull, checkout,
  merge or rebase was performed.

Recent local commits:

1. `ba98a52 wip(owner): preserve booking detail and cancellation flow`
2. `d78ce15 chore(orchestrator): add sparse routing and telemetry benchmarks`
3. `065cf6d Merge pull request #79 from Evruset/agent/owner-v50-r2j-recovery`
4. `20367cb fix(owner): align Expo SDK 57 patches`
5. `daaaec9 test(owner): persist axe node diagnostics`

## GitHub divergence

| Comparison | Local-only | Remote-only | Meaning |
|---|---:|---:|---|
| HEAD vs current upstream branch | 2 | 0 | `ba98a52` and `d78ce15` are local commits not pushed to the integration branch |
| HEAD vs `origin/main` | 88 | 1 | feature stack is not integrated into main; main contains `ba85f22` absent from local HEAD |
| upstream branch vs `origin/main` | 86 | 1 | even the pushed integration branch has not been merged into current main |

Merge-base of HEAD and `origin/main` is
`e9b7b2fb8a9208fb76e0ba2003246a741f3a1c8b`. Read-only `git merge-tree`
reported no textual conflict markers. This is not proof of semantic
compatibility, and the dirty worktree makes any integration attempt unsafe
without preservation/reconciliation first.

## Dirty worktree

There are 25 modified tracked files and untracked source/contracts/scripts plus
generated visual evidence. The complete tracked patch is included as
`git/local-worktree.patch`; the archive contains selected untracked contract
files and actual dirty source versions, not only Git HEAD.

Modified tracked files:

- `apps/clinic-portal/next-env.d.ts` (unrelated; preserved)
- `apps/owner-app/package-lock.json`
- `apps/owner-app/package.json`
- `apps/owner-app/src/api/client.web.ts`
- `apps/owner-app/src/app/(app)/index.tsx`
- `apps/owner-app/src/bookings/OwnerBookingDetailScreen.tsx`
- `apps/owner-app/src/bookings/OwnerBookingsScreen.test.tsx`
- `apps/owner-app/src/bookings/OwnerBookingsScreen.tsx`
- `apps/owner-app/src/clinics/AvailabilityScreen.tsx`
- `apps/owner-app/src/clinics/ClinicCatalogScreen.test.tsx`
- `apps/owner-app/src/clinics/ClinicCatalogScreen.tsx`
- `apps/owner-app/src/clinics/ClinicServiceScreen.tsx`
- `apps/owner-app/src/clinics/clinic-catalog-api.test.ts`
- `apps/owner-app/src/clinics/clinic-catalog-api.ts`
- `apps/owner-app/src/home/OwnerHome.navigation.test.tsx`
- `apps/owner-app/src/server/owner-web-bridge.test.ts`
- `apps/owner-app/src/tests/owner-home-v50.test.tsx`
- `backend/artifacts/openapi/swagger.json`
- `backend/scripts/assert-openapi.cjs`
- `backend/src/public-catalog/owner-clinic-catalog.controller.spec.ts`
- `backend/src/public-catalog/owner-clinic-catalog.controller.ts`
- `backend/test/owner-clinic-catalog-http.e2e-spec.ts`
- `backend/test/owner-clinic-catalog.integration-spec.ts`
- `docs/ai/current-state.md`
- `docs/v50/V50-PARITY-REGISTER.md`

Relevant untracked files included in this review:

- `apps/owner-app/src/api/client.web.test.ts`
- `docs/v50/OWNER-V50-CATALOG-SEARCH-CONTRACT.md`
- `docs/v50/OWN-003-CLINIC-COMPARISON-CONTRACT.md`
- capture/verification scripts used by the recent Owner acceptance work

Generated screenshot directories are not copied into this review archive;
their paths and results remain referenced by `current-state.md`. This keeps the
archive bounded and analysis-specific.

## What is actually implemented

### Owner Catalog and search

- The committed upstream branch has the Owner-authenticated location catalog,
  closed DTO `{clinicId, locationId, name, address, phone}`, eligibility limited
  to active online-bookable locations, and deterministic bounded output.
- Upstream Owner UI filters only the already-loaded catalog client-side.
- Dirty local changes add optional server query `q`, normalized name/address
  matching before `LIMIT 50`, OpenAPI/tests and a submitted-search UI. These
  changes are not committed and are not present in GitHub upstream.
- The Owner endpoint still calls `listClinicLocations(... openNow: true)`.

### Clinic Detail and Service Selection

- Implemented and present in upstream: exact clinic/location revalidation,
  authoritative active services, informational price, selected service radio,
  refresh-before-handoff and exact `{clinicId, locationId, serviceId}` handoff.
- Current Owner service DTO exposes `serviceId`, `name` and informational
  `{amount,currency}`. It does not expose `serviceCode`, duration, service
  composition, included items or extra-charge rules.
- Public catalog internals contain a service `code` and a richer booking-option
  price shape, but those are not the current Owner Clinic Detail contract and
  are not wired into comparison.

### Availability

- Implemented and present in upstream: exact clinic/location/service endpoint,
  14-day authoritative PostgreSQL window, open/capacity eligibility, stable
  `(startsAt, slotId)` ordering, local date/time and expected slot version.
- Owner Availability does not currently expose freshness, source update time or
  confirmation mode, although richer public catalog read models contain those
  concepts.

### Booking

- Existing Owner flow preserves exact clinic/location/service/slot/version,
  revalidates before handoff and uses Booking Core as authority.
- Booking submission/detail/cancellation work exists in the feature stack and
  current dirty worktree. It is unrelated to OWN-003 and was not retested.

### Clinic Comparison

- No Owner comparison route, component, adapter, state model or backend
  comparison endpoint exists.
- `prototype-v50/index.html#decision-comparison` and
  `docs/v50/OWN-003-CLINIC-COMPARISON-CONTRACT.md` are design/contract material,
  not implementation.
- A sentence telling users to compare clinics is copy only and does not create
  comparison behavior.

## OWN-003 fixed requirements

| Requirement | Actual state | Evidence | Gap |
|---|---|---|---|
| 1. Two comparison entry routes | `NOT IMPLEMENTED` | No comparison route/component/symbol in Owner source | Define and implement both entry points and shared selection state only after contract approval |
| 2. One `serviceCode` for comparable composition | `NOT IMPLEMENTED` in Owner contract | Database/public service has code; Owner Clinic Detail DTO omits it | Add governed stable code plus explicit equivalence/composition rules; never match by display name |
| 3. “Price from” with composition and extras | `NOT IMPLEMENTED` | Owner exposes one informational amount/currency only | Contract included composition, base/from semantics and additional-cost disclosure before UI work |
| 4. “Show without slots” toggle | `NOT IMPLEMENTED` | Owner catalog hard-codes `openNow: true`; no query/input/UI toggle | Contract eligibility/privacy behavior for `openNow=false`, then additive Owner query and UI control |

The generic public catalog already supports `serviceCode`, `openNow`,
`priceFrom`, richer price warnings and availability metadata. Reusing those
internals may reduce backend work, but it does not make the four Owner
requirements implemented: current Owner DTOs/routes deliberately project a
narrower contract.

## Documentation-only material

- V50 decision-comparison UI, recommendation/trust score, reviews, distance,
  capabilities and queue estimates.
- Proposed OWN-003 A/B contract and read model.
- Server-side search contract is approved documentation and dirty local code,
  but not present in GitHub upstream at audit time.
- Current-state/parity PASS/PARTIAL evidence documents prior slices; it does not
  create a comparison feature.

## Audit limitations

- This audit did not run regression tests or mutate product data.
- No branch was switched and no integration was attempted.
- Conflict inspection was textual/read-only; semantic conflicts remain possible.
- Jira was not queried in this goal; the local contract audit uses repository
  state plus the recorded current-state/parity evidence.
