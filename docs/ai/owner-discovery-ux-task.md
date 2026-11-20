# AI task — Owner discovery UX

## Reasoning

`medium` — bounded Owner App presentation and recovery behavior, C1/R1,
standard context budget; root implementation, no parallel writers.

## Goal

Make clinic discovery and the existing booking journey easier to understand.
User authorization: «запускаем изменения» following the UX analysis.

## Allowed scope

- `apps/owner-app/src/clinics/{ClinicCatalogScreen,ClinicServiceScreen,AvailabilityScreen}.tsx`
- A shared booking selection summary and the nearest journey tests.
- This brief and an additive entry in `docs/ai/current-state.md`.

## Acceptance criteria

- Catalog search stays limited to the supported clinic name/address contract.
- Cards expose actual clinic information and one outcome-oriented action;
  repeated explanations of missing catalog data are removed.
- Service and availability screens show the known pet, clinic and selection
  together; absent or invalid selection data is not presented as selected.
- An empty search offers a working reset; an empty schedule offers a return
  to services and a refresh, without claiming unprovided availability.
- Existing exact identity handoffs, selection restoration, server refresh,
  stale/version guards and submission semantics remain intact.

## Do not change

- Pre-existing conflicted bookings screens and their index state.
- Backend, routes, API contracts, authorization, database, dependencies,
  applied migrations, Home, design tokens and existing assets.
- Pilot scope: no payments, telemedicine, insurance or emergency routing.

## Verification

- Nearest catalog/service/availability tests, plus the existing booking review
  regression tests.
- Targeted ESLint, Owner App typecheck and scoped whitespace check.
- Record any pre-existing merge-conflict failure separately from scoped checks.
- Browser evidence only if the existing runtime can render this workspace;
  do not claim real booking, device or human visual acceptance.
