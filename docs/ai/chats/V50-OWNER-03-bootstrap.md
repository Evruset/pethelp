# V50-OWNER-03 — V50 Clinic Catalog and Doctor Discovery

Status: `PARTIALLY_COMPLETED / NOT_READY_FOR_INTEGRATION`

## Task brief

- Goal: deliver a read-oriented Owner journey from clinic discovery through clinic and doctor detail to the existing typed booking entry.
- User-visible outcome: an owner or guest can find a suitable active clinic, understand server-backed fit and availability freshness, inspect public services/capabilities/doctors, and carry a typed selection into booking without creating a hold.
- Source of truth: `prototype-v50/index.html`, manifest SHA-256 `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`, and the four parity rows below.
- Environment: branch `agent/v50-owner-03`; worktree `/Users/evrusetskiy/work/pethelp-alpha-v50-owner-03`; Flutter Owner app plus NestJS/PostgreSQL public read models.
- Classification: program `C3/R3`; slice `C3/R3` because optional owner personalization touches a guest/public authorization boundary. No migration is planned.

## Selected V50 scope

| V50 ID | Anchor | Prototype route | Runtime route | Action | Role/read authority | Read API | Flag |
|---|---|---|---|---|---|---|---|
| `OWN-002` | `#catalog` | catalog | `/owner/catalog` | `REUSE` | guest/public; optional authenticated Owner context | `GET /v1/clinics` plus public locations/services/availability | `OWNER_V50_CATALOG` |
| `OWN-004` | `#clinic` | clinic | `/owner/clinics/:clinicId` | `MODIFY` | guest/public | `GET /v1/clinics/:clinicId`, locations, services, availability | `OWNER_V50_CLINIC_DETAIL` |
| `OWN-018` | `#doctor-select` | doctor-select | `/owner/doctors` | `ADD` | guest/public doctor allowlist | public doctor list by active clinic/location | `OWNER_V50_DOCTOR_DISCOVERY` |
| `OWN-019` | `#doctor-detail` | doctor-detail | `/owner/doctors/:doctorId` | `ADD` | guest/public doctor allowlist | public doctor detail scoped to active public assignment | `OWNER_V50_DOCTOR_DISCOVERY` |

`OWN-003` comparison is explicitly excluded; the Catalog prototype link remains a safe unavailable action rather than an invented comparison contract.

## Acceptance criteria

- Public clinic/location/service/availability and doctor DTOs expose allowlisted fields only and normalize inactive/private/unknown resources.
- Sorting is deterministic; availability freshness and confirmation mode are server-authored; fit reasons come only from structured facts.
- Guest discovery works without Owner data. An authenticated own-pet hint may personalize species/service fit; a foreign hint is ignored or normalized without disclosure.
- List mode is fully functional. Map mode uses the same projections and has deterministic fallback, denied and unavailable states without external network dependency.
- Catalog, Clinic Detail, Doctor Discovery/Profile, deep links, state restoration, feature-flag rollback and typed pending booking intent are tested.
- Six representative comparisons pass before the 48-artifact matrix is generated and independently validated.

## Constraints and non-goals

- No booking hold, slot confirmation, payment, MIS command, telemedicine mutation, insurance purchase, emergency triage, Portal, migration, dependency upgrade or parallel design system.
- No demo IDs, private staff fields, provider/MIS identifiers, storage keys or client-supplied owner identity.
- Existing booking state machine and legacy routes remain unchanged.

## Risks and decisions

- Optional authentication must preserve guest `200` behavior and must never turn a foreign pet hint into an existence oracle.
- Public doctor data must be derived from existing active public assignments; if no safe durable source exists, implementation stops rather than exposing employee records.
- Emergency badges require verified, fresh, accepting capability data and are never inferred from 24/7 hours.

## Verification

- Backend build and focused public catalog/doctor/security matrix: PASS 20/20.
- Flutter analyze, focused V50 tests, catalog regression, full 238/238 suite and flagged Owner/evidence web builds: PASS.
- Evidence integrity: PASS 48/48 runtime, 16/16 prototype, checksum `4011fde69d0b0a8e7102d344b96087e48b19521b567efa8da48b1aee33393e45`.
- Independent validator: FAIL with one visual-parity veto. Functional/security behavior passed; Catalog/Clinic prototype composition did not. Counter remains 3/30 and the only next work is bounded visual repair plus recapture/revalidation.
