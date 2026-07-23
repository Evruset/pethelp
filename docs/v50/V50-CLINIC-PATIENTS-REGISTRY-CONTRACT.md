# V50 Clinic Patients Registry Contract

Status: `CONTRACT_COMPLETE / IMPLEMENTATION_BLOCKED_BY_ASSOCIATION_SCHEMA`.

## Bounded outcome

`V50-CLINIC-03A / Clinic Patients Contract Discovery` defines one future
read-only administrative registry. It does not implement an API, Portal page,
patient detail, medical record, owner/client profile, mutations, capability,
feature flag, migration or index.

Canonical future routes:

- Portal:
  `/clinics/:clinicId/locations/:locationId/patients`;
- backend:
  `GET /v1/clinic/:clinicId/locations/:locationId/patients`;
- one future scoped BFF follows the same Portal path under `/api/clinic`.

No clinic-wide parallel route is contracted. A clinic employee selects an exact
location and sees only patients derived for that location.

## Product entities

- **Pet** is the owner-scoped global row in `pet_schema.pets`. It may contain
  administrative profile fields and highly sensitive clinical/insurance data.
- **Clinic patient** is a scoped administrative projection of a pet for which
  the clinic location has a proven durable relationship. It is not a new stored
  entity in the current schema.
- **Appointment participant** is a pet referenced by
  `booking_schema.appointments.pet_id`; the appointment and its
  `clinic_location_id` prove the current relationship.
- **Owner/client** is the owner of the pet. Owner identity/contact data is a
  separate projection and policy surface.
- **Medical record** contains clinical summaries, documents, OCR, allergies,
  diagnoses and other care data. It is not part of this registry.

All pets in VetHelp are therefore not clinic patients. Owner ownership, a
booking hold, a medical document, an imported external identifier, telemedicine
activity or another pet of the same owner does not independently establish the
registry relationship.

## Authoritative inclusion relation

`V50-CLINIC-03A1` selects a hybrid association model. Appointment confirmation
is the supported provenance, but the future registry reads a versioned,
location-scoped association with valid `PATIENT_ADMIN_REGISTRY` consent. An
appointment row alone no longer authorizes registry visibility.

An active registry row exists when all are true:

1. the association is `ACTIVE` for exact clinic, location and pet;
2. its provenance is a confirmed exact-location appointment;
3. its consent reference is valid, unexpired and not revoked for purpose
   `PATIENT_ADMIN_REGISTRY`;
4. the location belongs to `:clinicId` and is active;
5. `pets.archived_at IS NULL`;
6. the installation operational-visibility policy includes the association.

The appointment may be upcoming, completed, no-show or cancelled: once an
appointment was created, it is durable evidence of an administrative
relationship. Holds that never produced an appointment do not qualify. Multiple
appointments produce one row per pet. The same pet may appear independently in
two location registries only when each location has its own appointment
evidence.

The appointment relation is proven by current foreign keys. The association and
consent storage do not yet exist and require the bounded `03A2` schema contract.

### Inclusion matrix

| Case | Result |
| --- | --- |
| confirmed/upcoming appointment at exact location | include |
| completed, no-show or cancelled appointment at exact location | include |
| repeated/historical appointments at exact location | one deduplicated row |
| appointments at two locations | one row in each independently authorized location |
| booking hold only, including pending/expired/released | exclude |
| owner pet with no exact-location appointment | exclude |
| unrelated pet belonging to an owner who has another qualifying pet | exclude |
| medical record/document only | exclude |
| `external_patient_id` or imported pet without appointment evidence | exclude |
| archived pet | association becomes archived; exclude |
| deleted/anonymized owner | association becomes revoked; exclude; owner fallback forbidden |
| missing/expired/revoked consent | exclude immediately server-side |

## Authority and capability

The future capability is a new `patient.admin.read`. It is not
`appointment.registry.read` and grants no clinical category.

Every request requires:

- authenticated employee;
- server-derived `patient.admin.read`;
- exact JWT/effective clinic and location scope as early rejects;
- active, non-revoked membership at the exact location inside the read
  transaction;
- location ownership by the requested clinic;
- deny-by-default evaluation through the centralized capability evaluator.

The planned administrative role mapping is receptionist and clinic admin only,
subject to its implementation slice. Veterinarian access is not inferred from
clinical duties; a later administrative or assigned-clinical contract must
grant the relevant capability explicitly. `CLINIC_ASSISTANT` does not exist in
the current role/membership model and receives no implied access. Owners,
platform roles and unauthenticated actors are denied.

Malformed, absent, foreign-clinic, foreign-location, unrelated, archived and
unauthorized patient identifiers must use one normalized no-leak denial in any
future detail route. Registry denials expose no row, count or match hint.

## Administrative allowlist

The registry may return only:

```text
clinicId
locationId
serverNow
items[]
  patientId
  pet
    displayName
    speciesLabel
    breed              nullable
    sexCode            nullable: MALE | FEMALE | UNKNOWN
    birthDate          nullable ISO calendar date
  owner
    displayName        always nullable; currently null
  relationship
    firstSeenAt
    lastSeenAt
  appointments
    lastVisitAt        nullable
    nextAppointmentAt nullable
nextCursor             nullable
```

`patientId` is the existing pet UUID used only as an opaque resource key. It is
never a display value. No surrogate association ID is justified by current
schema evidence. Any future detail route must retain clinic/location path scope
and cannot perform a global pet lookup.

`firstSeenAt` and `lastSeenAt` are respectively `MIN` and `MAX` appointment
`created_at` within the exact location. `lastVisitAt` is the latest qualifying
slot start whose visit is historical; `nextAppointmentAt` is the earliest
future non-cancelled appointment. PostgreSQL owns `serverNow` and all boundary
classification.

Owner display has no verified administrative source. It is therefore `null`;
owner UUID, login, phone and email are forbidden fallbacks. Masked contacts are
not part of this registry and require a separate owner/client contract.

The projection excludes weight, sterilization, chip number, photo URL,
allergies, chronic conditions, vaccination notes, OCR/history documents,
clinical summaries, diagnoses, prescriptions, treatment, laboratory/imaging,
telemedicine transcripts, insurance links/payload, prices/payments, contacts,
addresses, identity documents, communication preferences, raw audit,
integration payloads and unrelated owner pets.

Unexpected properties are dropped by a future runtime parser. Missing required
properties, invalid UUIDs, non-finite/impossible timestamps, wrong scope,
malformed nullable objects or raw entity payloads fail closed. No partial row or
fake empty registry replaces the last validated snapshot.

## Search, ordering and pagination

Supported future query:

```text
q?       optional normalized pet-name prefix
limit?   integer 1..100, default 50
cursor?  opaque signed keyset cursor
```

`q` is Unicode NFKC-normalized, trimmed and case-folded, with length 2..80
Unicode code points. It searches the pet display-name prefix only after exact
scope/authority filtering. Empty, shorter, excessive or malformed values are
`400`; owner name/contact, UUID, chip, free-text clinical fields and unrelated
global pets are never searchable. The response does not reveal whether a
foreign match exists and returns no total count.

Search must be rate-limited before the query executes, keyed at minimum by the
authenticated employee plus exact clinic/location scope. Exceeding the policy
returns `429` with a bounded public code and `Retry-After`; it returns no match,
count or scope hint. No supported threshold is evidenced in the repository, so
product/platform operations must set and document the request/window threshold
before rollout. The backend suite must prove below-threshold success,
above-threshold `429`, scope-key isolation and recovery after the declared
window. This threshold decision is part of the rollout blocker, not an invented
value in `03A`.

Default ordering is `relationship.lastSeenAt DESC, patientId DESC`. Stable ties
use the opaque patient ID internally. The signed cursor binds version,
clinic/location, normalized query, limit, snapshot boundary, last-seen key and
patient ID. Insertions after the first PostgreSQL-owned snapshot do not enter
the traversal; cursor mismatch/tampering is `400`. Local Portal sorting or
client-side filtering is forbidden.

## Query and performance boundary

The future service performs one bounded query:

- authorize before patient lookup;
- join appointments to exact location/clinic and active pets;
- apply both appointment location and location clinic predicates;
- group by patient;
- compute relationship and appointment aggregates in PostgreSQL;
- apply normalized search and keyset predicate in SQL;
- order and fetch `limit + 1`;
- return no clinical blobs, owner contacts, N+1 reads or unbounded history.

The existing appointment indexes prove relationship correctness, not
production-scale grouped-search performance. The backend slice must capture
`EXPLAIN (ANALYZE, BUFFERS)` on representative cardinality. Any required
expression/grouping index is a separate measured migration; `03A` adds none.

## UX and rollout

The V50 screen is `CLN-005 clinic-patients` at the scoped Portal route above,
inside the existing Clinic workspace. It contains:

- one page heading and location context;
- bounded pet-name search;
- administrative patient table/cards with pet identity, safe owner placeholder,
  last visit and next appointment;
- loading, authoritative empty, no-results, technical error, degraded,
  access-denied and normalized no-leak states;
- preserved last valid snapshot on malformed/technical refresh;
- desktop/tablet/mobile layouts without horizontal loss;
- keyboard-operable search/pagination, textual status, semantic table or list,
  live regions without announcement spam, 200% text and reduced-motion support.

No medical chart, owner profile, patient detail, actions or hidden clinical
preview appears in the registry.

Patients are a separate release unit. The future default-off flag is
`VETHELP_CLINIC_PATIENTS_REGISTRY`; it gates navigation, page, BFF and backend
route together. It is not the appointments flag. `03A` adds no flag.

## Future executable matrix

| Area | Required evidence |
| --- | --- |
| Positive | receptionist/admin with exact capability, claims and active membership; safe owner null; empty registry |
| Inclusion | confirmed/completed/cancelled appointment relations; hold-only excluded; archived excluded; unrelated owner pet excluded |
| Deduplication | repeated appointments yield one patient; per-location relation remains independent |
| Denials | unauthenticated, role/capability denied, missing/revoked membership, missing/incompatible clinic/location claims, cross-clinic/location |
| No leak | absent/foreign/unrelated/archived identifiers normalized; no counts, match hints or private error bodies |
| Privacy | recursive absence of contacts, clinical/medical, financial, insurance, audit, integration and unrelated-pet fields |
| Owner | null display accepted; UUID/login/email/phone fallback rejected |
| Search | 2/80 boundaries, Unicode normalization, prefix matching, malformed/excessive query, no cross-scope enumeration; per-employee+scope rate threshold, `429`, `Retry-After`, key isolation and window recovery |
| Pagination | stable ties, fixed snapshot, tampered/cross-query/cross-scope cursor, no duplicates or local reorder |
| Failure | malformed payload and technical failure are not authoritative empty; last valid Portal snapshot preserved |
| Side effects | repeated reads create no audit, outbox, idempotency, appointment, pet or membership writes |
| Performance | bounded `limit + 1`, one grouped query, no N+1/clinical joins, measured plan before rollout |
| Rollback | default-off navigation/page/BFF/backend unavailable as one unit |

Administrative registry reads need no medical read audit because the allowlist
contains no medical categories. Any future clinical patient read requires a
separate capability, assignment/category policy and medical read audit.

## Archive, retention and consent decision

The canonical decision is
`V50-CLINIC-PATIENT-RETENTION-CONSENT-DECISION.md`. It selects a hybrid,
versioned association with `ACTIVE`, `ARCHIVED` and `REVOKED` lifecycle,
purpose-specific consent, immediate server-side revocation, exact-location
transfer semantics and deny-by-default installation policies.

Missing visibility policy makes the registry return bounded `503`; missing
search policy makes search return bounded `503`. No legal duration or rate
threshold is invented. Imported/manual/medical-only sources remain excluded.
The next prerequisite is the association schema contract, not the backend read
endpoint.

## Detail boundary and sequence

Patient detail is outside `03A`. It must not reuse owner pet profile or
veterinarian workspace DTOs. The safe sequence is:

1. patient registry contract;
2. retention/consent decision;
3. association schema contract and migration;
4. backend registry read model;
5. Portal registry integration;
6. patient detail contract;
7. medical record contract;
8. owner/client contract.
