# V50 Catalog and Doctor Discovery Contract

Status: `IMPLEMENTED / TESTED / VISUALLY_VERIFIED / R3 AUTHORIZATION REVIEWED`

Source: V50 anchors `#catalog`, `#clinic`, `#doctor-select`, `#doctor-detail`; manifest SHA-256 `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`.

## Decision

Extend the existing `PublicClinicController` and `PublicCatalogService`; do not create `/v50/**` APIs or a parallel catalog. Preserve guest discovery and add optional authentication only for a bounded selected-pet hint. Add public doctor list/detail projections from active veterinarian staff assigned to active public clinic locations. No migration is required.

## Public and optional-owner boundary

- No bearer token: guest request remains public and returns `200`.
- Valid bearer token: the optional principal may be used only when it contains `OWNER` and a valid `selectedPetId` hint.
- Present malformed/expired bearer token: `401`; an attempted authenticated request never silently downgrades to guest.
- Own active pet: `OwnerPetService` returns only `{id, species}` for catalog context.
- Foreign, unknown or archived pet: identical unpersonalized `200` representation; no pet existence or ownership oracle.
- Owner identity is JWT `sub`; no client owner ID is accepted.

## Read endpoints

- Existing: `GET /v1/clinics`, `GET /v1/clinics/:clinicId`, `GET /v1/clinics/:clinicId/locations`, `GET /v1/clinic-locations/:locationId/services`, `GET /v1/clinic-locations/:locationId/availability`.
- Additive: `GET /v1/clinics/:clinicId/doctors` and `GET /v1/doctors/:doctorId`.
- Clinic list accepts confirmed filters only and deterministic sorting. Pagination remains bounded and receives a stable ID tie-breaker; cursor semantics are added only if the existing repository can support them without a new contract family.

## Catalog projection

Clinic cards prioritize structured facts: public name/location, service count/fit, nearest availability, server-authored freshness, confirmation mode, price-from, distance when valid, verified emergency capability and doctor availability. “Почему подходит” is a closed list derived from service/species/availability/capability flags; it is never free-form clinical inference or commercial ranking.

Availability returns `sourceUpdatedAt`, `serverNow`, `CURRENT|AGING|STALE|UNAVAILABLE` and `INSTANT|CLINIC_CONFIRMATION|ALTERNATIVE_POSSIBLE`. Stale data is not represented as guaranteed availability. Existing booking hold authority remains unchanged.

## Public doctor projection

Publishability requires active clinic, active location, active staff and veterinarian role. Allowlisted fields are doctor ID, display name, normalized public title, clinic/location identity, public service/availability summary and verification wording supported by the source. Internal staff code/source/external ID/version, employee membership, JWT subject, private contact, HR data and provider/MIS identifiers are excluded.

The current schema has no biography, specialty taxonomy, credentials, photo, languages or rating contract. Those prototype fields remain documented omissions; the UI does not fabricate them. A future explicit public-profile/consent model would require a separate migration and review.

Integration is ready under the strict allowlist and default-off flag. Production Doctor rollout is blocked by `PUBLIC_DOCTOR_PROFILE_CONSENT_CONTRACT_MISSING`; `V50-DOCTOR-PUBLIC-PROFILE-CONSENT-DEBT.md` defines the required auditable consent source, owners and activation gate. Visual parity certification does not close that debt.

## Emergency semantics

Emergency UI is allowed only when a verified capability profile is still valid and accepting now. It is never inferred from 24/7 hours. Stale capability data removes the emergency claim but does not hide an otherwise public clinic.

## Navigation and booking handoff

Catalog state retains selected pet, filters, sorting, list/map mode and scroll context. Clinic → Doctor → Back retains location/service. Booking receives only typed IDs: `petId`, `clinicId`, `locationId`, `serviceCode`/service ID and optional `doctorId`. This slice does not create a hold or confirm a slot.

## Feature flags and rollback

- `OWNER_V50_CATALOG`
- `OWNER_V50_CLINIC_DETAIL`
- `OWNER_V50_DOCTOR_DISCOVERY`

All are exact-true, default-off and dependent on the canonical V50 Owner shell. Invalid combinations use legacy catalog or a safe unavailable state without mixing flows. Rollback disables the flags; no database downgrade or booking-state rollback is required.

## Certification

Runtime `dc762b4` and package `v50-owner-03-dc762b4` passed independent read-only validation with zero vetoes. The package contains 48 runtime and 16 authoritative prototype artifacts across four viewports; SHA-256 is `e07837d15af828090b6be02b50be06b9f1dde3d60fa37f913991a87cac60a67b`. Catalog freshness is server-authored and visibly distinguishes current/stale states. No booking hold, production rollout decision or public-profile consent is created by this certification.

## Rejected alternatives

- Requiring Owner auth for catalog: breaks guest discovery.
- Treating invalid bearer as guest: hides session failure.
- Direct pet-table queries in public catalog: duplicates ownership authority.
- Returning 403/404 for foreign pet hints: creates an oracle.
- Publishing employee/location memberships or creating profile tables in this slice: unsafe boundary or unnecessary migration.
- Inventing specialties, biographies, ratings, reviews or clinical fit from staff display names.
