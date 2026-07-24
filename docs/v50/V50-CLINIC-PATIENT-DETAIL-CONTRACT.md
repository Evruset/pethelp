# V50 Clinic Patient Detail Contract

Status: `READY_FOR_ADMIN_DETAIL_BACKEND`.

## Bounded outcome

`V50-CLINIC-04A / Clinic Patient Detail Contract Discovery` defines one
read-only administrative patient detail. It does not implement an API, DTO,
OpenAPI entry, Portal page, BFF, navigation, capability, migration or clinical
record.

The V50 prototype contains the `clinic-patient` anchor, but visually combining
administrative and medical blocks does not authorize a combined runtime
surface. VetHelp separates:

- administrative patient detail for authorized clinic operations;
- visit-specific veterinarian workspace;
- a future clinical patient record governed by a separate policy;
- owner profile, pet master profile and appointment detail.

## Resource identity decision

The administrative resource identity is the existing `pet_schema.pets.id`
published by the authorized Registry as opaque `patientId`.

| Candidate | Decision | Evidence and trade-off |
| --- | --- | --- |
| pet ID | selected | Already returned by the Registry; stable across association refresh/reactivation; no migration; clear OpenAPI. It never authorizes a global pet lookup: current visible association and exact clinic/location remain mandatory. |
| association ID | rejected | Location-bound but exposes a lifecycle identifier, changes URL semantics across storage choices and is absent from the public Registry contract. It adds no authority beyond the required association predicate. |
| new opaque patient ID | rejected | No demonstrated enumeration or stability problem justifies another identifier, mapping table or migration. |

Pet IDs are high-entropy UUIDs, never display values. Location movement creates
or changes location-specific associations, not the pet identity. A bookmark is
stable only while a current visible association exists at its exact path.

Recommended routes:

```text
GET /v1/clinic/:clinicId/locations/:locationId/patients/:patientId
/clinics/:clinicId/locations/:locationId/patients/:patientId
```

The backend operation belongs to the existing `Clinic Patients` OpenAPI tag.
It must not be grouped under a clinical-record or appointment tag.

An appointment ID is not a patient ID. A Registry row may become navigable only
after both real routes exist.

## Authority model

Administrative detail contains the same data category as the Registry and uses
the existing `patient.admin.read`; a new `patient.admin.detail.read` would add
configuration without narrowing any field in this contract.

Every read requires, before patient lookup:

1. enabled `VETHELP_CLINIC_PATIENTS_REGISTRY`;
2. authenticated clinic employee;
3. server-derived `patient.admin.read`;
4. exact clinic and location claims/effective scope;
5. active, non-revoked membership at the exact location;
6. location ownership by the requested clinic;
7. a current visible association, valid `PATIENT_ADMIN_REGISTRY` consent,
   unarchived pet and valid runtime visibility policy.

| Actor | Administrative detail | Clinical patient record | Notes |
| --- | --- | --- | --- |
| receptionist | allowed with `patient.admin.read` and exact active membership | denied | No clinical fields or documents. |
| clinic administrator | allowed with the same conditions | denied by this contract | Administrative authority does not imply clinical completion/read. |
| veterinarian | denied when veterinarian-only | not defined here | Existing visit workspace is visit-specific, not patient-history authority. |
| multi-role employee | allowed only when effective `patient.admin.read` is present | not inferred | Capabilities compose; role strings do not. |
| platform operator | denied | denied | Clinic/location claims are not platform override. |
| owner | denied | owner surfaces remain separate | Owner JWT is not clinic employee authority. |

Administrative reads do not create a new read-audit stream because no such
allowlist audit primitive exists. Clinical history/documents require a separate
decision on assignment, cross-location/clinic scope, break-glass, per-view
audit and legal retention before any capability such as
`patient.clinical.read` or `patient.documents.read` is introduced.

## Administrative response allowlist

```text
clinicId
locationId
serverNow
patient
  patientId
  pet
    displayName
    speciesLabel
    breed              nullable
    sexCode            nullable: MALE | FEMALE | UNKNOWN
    birthDate          nullable ISO calendar date
  owner
    displayName        nullable; currently null
  relationship
    firstSeenAt
    lastSeenAt
  appointments
    last               nullable AppointmentSummary
    next               nullable AppointmentSummary
    recent[]           maximum 10 historical summaries, newest first

AppointmentSummary
  appointmentId
  startsAt
  endsAt
  statusCode           SCHEDULED | COMPLETED | NO_SHOW | CANCELLED | UNKNOWN
  statusLabel
  service
    displayName        nullable
  veterinarian
    displayName        nullable
```

`serverNow` and timestamp classification are PostgreSQL-owned. `recent` is
historical and bounded to ten; it is not an unbounded patient history.
`appointmentId` is included only to use the already authorized administrative
appointment-detail route. Internal hold, MIS, payment, receipt and event IDs
are forbidden.

No verified clinic-safe owner display source exists, so
`owner.displayName = null`. Owner UUID, login, phone, email, address or identity
document are forbidden fallbacks. Photo/avatar, visit count, relationship
lifecycle code and inferred action are omitted because no safe source or
stable user-facing semantics is evidenced.

The administrative DTO recursively excludes weight, sterilization, chip,
allergies, warnings, chronic conditions, vaccination notes, complaints,
clinical summaries/notes, diagnoses, conclusions, prescriptions, treatment,
laboratory/imaging, documents/OCR, telemedicine transcripts, insurance,
payments, consent evidence, association/revision data, audit and integration
payloads. These fields must not reach the DTO/BFF, rather than being hidden by
CSS.

## Data-source and privacy matrix

| Projection/source | Source, scope and freshness | Join/inclusion | Materialization | Privacy and retention | Deletion/revocation behavior |
| --- | --- | --- | --- | --- | --- |
| inclusion/relationship | current clinic-patient association; exact clinic/location/pet at DB time | required authorization join; first/last only | no new copy | operational-sensitive; retain under existing association policy | revoke/archive immediately makes detail `404` |
| visibility purpose | current purpose-specific consent and runtime policy at DB time | required predicate; never returned | no | privacy-sensitive; existing consent retention only | missing/expired/revoked consent immediately makes detail `404` |
| pet identity | `pet_schema.pets`, by pet PK only after association predicate; current row | required; allowlisted identity fields only | no new copy | mixed admin/clinical master; existing pet retention | archived/deleted pet makes detail `404`; no tombstone fields |
| owner display | no verified administrative display projection | no join; return nullable `null` | no | identity/contact-sensitive; retain nothing in detail | owner deletion/anonymization creates no fallback; revoked association is `404` |
| appointments | appointments plus exact-location slots/display joins at DB time | optional enrichment after authorization; bounded last/next/10 recent | no new detail read model | administrative; existing appointment retention | deleted/hidden rows disappear; they never preserve access after association revoke |
| appointment events | booking event stream | forbidden | forbidden | internal audit/integration retention remains source-owned | source deletion/retention has no detail effect |
| visits / legacy clinical summary | visit workspace/legacy hold field | forbidden | forbidden | clinical retention remains source-owned and unresolved for longitudinal access | source changes have no detail effect |
| clinical conclusions | future clinical domain | forbidden | forbidden | highly sensitive; legal retention unresolved | future clinical policy owns deletion; never affects admin inclusion |
| pet documents/OCR | pet documents/profile OCR | forbidden | forbidden | highly sensitive; existing owner/document retention only | deletion/revocation remains source-owned; no admin projection |
| telemedicine | telemed case/session | forbidden | forbidden | clinical/communications retention remains source-owned | deletion/revocation remains source-owned; no admin projection |
| insurance | insurance aggregate | forbidden | forbidden | financial/health retention remains source-owned | deletion/revocation remains source-owned; no admin projection |
| payments | payment ledger | forbidden | forbidden | financial/legal retention remains source-owned | deletion/revocation remains source-owned; no admin projection |

Association is the only inclusion source. Appointments enrich the projection
but never independently authorize it. Clinical/document/payment sources may
not be joined or materialized into administrative detail.

## Lifecycle, retention and deletion

| Current state | Detail outcome |
| --- | --- |
| active association + valid consent/policy + active pet | `200` allowlisted detail |
| association archived or revoked | normalized no-leak `404` |
| consent expired/revoked/missing | normalized no-leak `404` |
| pet archived | normalized no-leak `404` |
| owner deleted/anonymized | association must be revoked; `404`; no owner fallback |
| reactivated association with new valid evidence/consent | accessible again at the same pet-ID path after current checks |
| location move | old exact-location path `404`; new path requires an independently visible association |
| appointment cancellation | relationship remains if association remains active; summaries reflect current public status |
| no upcoming appointment | `appointments.next = null` |
| stale Registry link/bookmark | current visibility is re-evaluated; never authorized by the old traversal snapshot |

Association/consent operational retention follows the existing ADR. Appointment
history remains in its owning aggregate. Administrative consent does not
authorize or alter clinical legal retention. Unknown clinical retention and
per-view audit requirements block only a future clinical surface, not this
separable administrative detail.

## Snapshot, caching and errors

Registry snapshot consistency applies only to traversal. Detail is a
current-state read and rechecks authority, association, consent, policy and pet
on every request. The response includes `serverNow`, uses `Cache-Control:
no-store, private`, and has no side effects.

No ETag is required initially: exposing association/pet versions would leak
internals and the current DTO is small. A future opaque ETag may be added only
with explicit current-privacy revalidation before returning `304`.

| Outcome | HTTP semantics |
| --- | --- |
| flag disabled | bounded `404` |
| unauthenticated | `401` |
| capability/scope/membership denied before lookup | normalized `403`, no patient hint |
| malformed, absent, foreign, unrelated, archived, revoked, inconsistent or missing pet resource | one bounded no-leak `404` |
| policy configuration unavailable | bounded `503` |
| technical database failure | controlled `500`; never `200` with an empty/partial card |
| malformed internal projection | controlled failure; no partial success or raw payload |

Direct UUID lookup must not become an oracle. It has no owner search,
autocomplete, bulk endpoint or `include`/`expand` parameters. UUID entropy,
authority-first evaluation, exact visible-association lookup and identical
no-leak errors are sufficient for the first implementation; no separate detail
limiter is justified without abuse evidence. Existing Registry search
protection is not reused as a detail counter.

## Query and performance boundary

The backend should execute one bounded query/transaction:

- authorize employee and exact location first;
- use the association scope key `(clinic_id, clinic_location_id, pet_id)`;
- join current referenced consent and apply DB-time expiry/revocation/policy;
- join one unarchived pet row and select only allowlisted columns;
- derive last, next and at most ten recent appointment summaries for the exact
  location/pet in PostgreSQL;
- use bounded display joins for service/veterinarian;
- perform no full Registry scan, N+1, owner-contact or clinical/document join.

The association scope key, consent indexes, pet primary key and appointment
foreign keys support correctness. The implementation slice must run
production-like `EXPLAIN (ANALYZE, BUFFERS)` for the exact summary query.
If a measured exact-location/pet/time appointment index is missing, preserve
correctness and create a separate measured migration slice; no speculative
migration is part of this contract.

## Future Portal contract

The future protected page may show patient summary, administrative
relationship, next appointment, at most ten recent administrative appointments
and safe notices. Desktop uses structured detail; mobile uses task-readable
cards, not a compressed table. Actions may link only to routes that already
exist and pass their own authority checks.

Receptionist/admin UI has no clinical tabs or placeholder promises for
“Медкарта”, diagnoses, prescriptions or documents. Registry rows become links
only when detail backend, BFF and page are deployed under the same default-off
flag. Deep links recheck current authority. Back navigation may preserve local
Registry search position only as non-authoritative UX state and must refetch
when stale.

## Future implementation test matrix

Backend coverage must include:

- flag off; receptionist/admin success; capability denial; inactive/revoked
  membership; cross-clinic/location; direct UUID enumeration;
- active, archived, revoked, expired/revoked consent, archived pet, owner
  deletion, stale link and reactivation;
- nullable owner, no UUID fallback, no upcoming appointment, bounded multiple
  appointments, safe labels, invalid dates/rows;
- recursive absence of contacts, clinical, document and financial data;
- policy `503`, database `500`, inconsistent rows, read-only side effects and
  production-like query plan.

Portal coverage must include protected page/BFF, direct path tampering,
loading/ready/nullable states, revoke-after-navigation, technical error versus
empty, malformed payload, responsive cards, keyboard, axe and recursive
no-contact/no-clinical rendering.

## Clinical surface decision

The current veterinarian visit workspace is the correct bounded surface for a
specific visit. No current ADR/runtime proves authority to browse longitudinal
patient history outside a visit, cross-location/clinic access, assignment
semantics, break-glass, document categories, per-view audit, conclusion
publication/amendment or legal retention.

Therefore clinical patient record remains a separate decision contract. This
does not block the administrative detail because its DTO and query exclude all
clinical sources.

## Decision checklist and readiness

1. Resource ID: existing opaque pet UUID from authorized Registry.
2. Route: exact clinic/location patient path shown above.
3. Access: receptionist/admin or multi-role employee with effective
   `patient.admin.read` and exact active membership.
4. New capability: no; same administrative category reuses
   `patient.admin.read`.
5. DTO: exact allowlist in this contract.
6. Exclusions: all owner contacts, clinical/documents/financial/internal data.
7. Revoke/expiry/archive: normalized current-state `404`.
8. Owner display: nullable and currently `null`; never UUID/contact fallback.
9. Appointment summaries: last, next and at most ten recent administrative
   summaries.
10. Clinical history: separate surface.
11. Clinical assignment: unresolved and mandatory before that surface.
12. Audit: no new admin read audit; clinical per-view audit unresolved.
13. Migration: none for correctness; exact-query EXPLAIN remains required.
14. Limiter: no new detail limiter without abuse evidence.
15. Next slice: `V50-CLINIC-04B / Clinic Patient Administrative Detail Backend`.

Readiness verdict: `READY_FOR_ADMIN_DETAIL_BACKEND`.
