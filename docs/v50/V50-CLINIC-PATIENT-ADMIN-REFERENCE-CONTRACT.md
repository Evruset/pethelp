# V50 Clinic Patient Administrative Reference Contract

Decision: `V50-CLINIC-04G / Clinic Patient Structured Administrative Reference Contract Refinement`.

Status: `BACKEND_IMPLEMENTED / PORTAL_NOT_IMPLEMENTED`.

## 1. Purpose

`Clinic Patient Administrative Reference` is a short structured operational
identifier for a clinic's exact-location relationship with a patient. It
supports quick administrative identification, receptionist reconciliation,
manual lookup, Patient Detail display and a future bounded mapping to a clinic
system. This document makes the next backend slice implementable without
reopening ownership, scope, concurrency or privacy decisions.

## 2. Scope

The MVP adds at most one active `administrativeReference` to the existing
clinic-patient local-profile aggregate identified by:

```text
clinicId + locationId + patientId
```

The data owner is the clinic/location local administrative domain. Authorized
staff may read it only through the already-authorized exact-scope Patient
Detail; knowing a reference is never authority.

## 3. Explicit non-goals

No endpoint, migration, storage, OpenAPI, Portal field, Registry column/search,
filter, bulk import, PMS/1C integration, external synchronization, QR/barcode,
owner-visible/global identifier, medical-record/history number, visit/document
number, insurance/payment account, label, note, correction workflow or
association lifecycle command is implemented by `04G`.

## 4. Terminology

- **Clinic Patient Administrative Reference**: clinic-location-local structured
  operational value, for example `PET-004281`.
- **Patient ID**: opaque VetHelp pet UUID used only inside an already-authorized
  exact-scope route; it is not the display reference.
- **Medical-record number**: clinical-domain identifier governed by clinical
  record policy; it is not this reference.
- **Source**: controlled provenance code describing how the local value arose.

The reference is not a pet name, owner ID, visit ID, document number, VetHelp
global ID or access token and cannot grant or expand authority.

## 5. Alias vs administrative reference

| Property | Alias | Administrative reference |
| --- | --- | --- |
| Purpose | visual human recognition | operational lookup/reconciliation |
| Shape | natural internal name | short structured value |
| Example | `Барсик Петровых` | `PET-004281` |
| Uniqueness | not required | unique by normalized key in exact location |
| Search intent | display only in current scope | future exact normalized match |

The fields remain separate and neither replaces the official pet name.

## 6. Data ownership

The value belongs to the exact clinic/location association projection, not the
owner pet master or Clinical/Visit domains. It has no effect on owner surfaces,
clinical records, Registry inclusion, consent, association lifecycle or other
clinic/location projections. Owner confirmation is not required.

## 7. MVP source model

The only MVP source is `CLINIC_MANUAL`. The first implementation treats it as
implicit and does not accept or persist a client-provided source field.
`PMS_IMPORT`, `LEGACY_IMPORT` and `SYSTEM_ASSIGNED` are reserved names only;
they require separate provenance/integration contracts. Arbitrary source text
is forbidden.

## 8. Field and DTO model

The aggregate read shape becomes:

```json
{
  "localProfile": {
    "alias": null,
    "administrativeReference": null,
    "aggregateVersion": 0,
    "updatedAt": null
  }
}
```

`administrativeReference` is `string | null`. Missing local-profile storage is
authoritatively projected as both nullable values `null`, version `0` and
timestamp `null`; clients never guess it. The bounded command DTO accepts
exactly one property:

```json
{ "administrativeReference": "PET-004281" }
```

Explicit clear is `{ "administrativeReference": null }`. Empty string and
unknown properties are invalid. MVP has no list or multiple active references.

## 9. Format and normalization

A non-null value is processed in this order:

1. Unicode NFC;
2. trim Unicode White_Space at both ends;
3. collapse every internal White_Space run to one ASCII space;
4. require 1–40 Unicode code points;
5. accept only Unicode letters, Unicode decimal digits, ASCII `-`, `_`, `/`,
   `.`, and a single ASCII space;
6. reject newlines, line/paragraph separators, tabs, controls, format
   characters, emoji, quotes, backslash, markup and every other character.

The stored/display value preserves user-entered letter case after normalization.
Case and punctuation are not otherwise converted or removed. The comparison
key is produced from that value using Unicode Default Case Folding followed by
NFC. The backend implementation must pin and test the Unicode/case-folding
implementation used by application and uniqueness enforcement; locale-sensitive
lowercasing is forbidden. The value is plain text and is never interpreted as
HTML, URL, email or phone.

## 10. Uniqueness

Every non-null comparison key is unique within exact `clinicId + locationId`.
The same key is allowed in another location, including another location of the
same clinic, and in another clinic. Collision with another patient in the
current location returns:

```text
409 ADMINISTRATIVE_REFERENCE_ALREADY_IN_USE
```

No other patient's identity is returned. Setting the current patient's same
normalized reference is a normal mutation: it passes version/idempotency
checks and increments the aggregate version; there is no implicit no-op.
Successful clear releases the unique key for reuse while immutable audit
evidence remains.

## 11. Authority and capability

MVP reuses `patient.admin.local-profile.update` because alias and reference have
the same clinic-local ownership, roles, exact scope and privacy policy.
`patient.admin.read` permits only the authorized read projection. Mutation
always uses the centralized capability evaluator plus current exact
clinic/location membership, active association, valid
`PATIENT_ADMIN_REGISTRY` consent, unarchived pet and visibility policy. Role
strings alone never authorize it.

A narrower capability becomes mandatory before any integration/import source
or narrower role population is introduced.

## 12. Read projection

The first backend slice extends authoritative Patient Detail
`localProfile` with required `administrativeReference: string | null`.
It does not extend Patients Registry, Registry ordering, rows, search or
filters. Read remains available when the write flag is off and remains governed
by `patient.admin.read` and exact current visibility.

Alias and reference share the same local-profile aggregate and version.

## 13. Mutation route

The chosen command is:

```http
PATCH /v1/clinic/:clinicId/locations/:locationId/patients/:patientId/local-profile/reference
```

It accepts only `{ administrativeReference: string | null }`. A separate route
preserves the deployed alias-only strict DTO and makes field-presence semantics
unambiguous; alias can never be cleared incidentally. A generic patient or
generic multi-field PATCH is rejected.

The safe success response contains only:

```text
clinicId, locationId, patientId, administrativeReference,
aggregateVersion, updatedAt
```

## 14. Concurrency

The command requires strong:

```http
If-Match: "<aggregateVersion>"
```

Alias and reference mutations increment one shared local-profile
`aggregateVersion`. Any successful set, same-value set, replace or clear changes
`N → N+1`, preventing lost updates between fields.

- missing/malformed version: `428 PRECONDITION_REQUIRED`;
- stale or future version: `409 PATIENT_VERSION_STALE`;
- association/visibility change after authorized snapshot:
  `409 PATIENT_ASSOCIATION_CHANGED`;
- foreign, revoked, archived or otherwise unavailable: no-leak `404`.

## 15. Idempotency

Every set/replace/clear requires UUID `Idempotency-Key`. Its semantic scope is:

```text
command type + clinicId + locationId + patientId
+ normalized reference + SET/CLEAR
```

Same key, scope and normalized payload replays the original committed logical
result without a second version/audit/outbox event. Same key with a different
payload returns `409 IDEMPOTENCY_KEY_REUSED`. A key from another
clinic/location/patient cannot retrieve or collide with another resource's
result.

## 16. Audit

Reference mutation, shared version, idempotency result, safe audit and durable
outbox commit in one PostgreSQL transaction. Audit records:

```text
eventId, eventType, actorId, clinicId, locationId,
approved patient/association resource reference, associationId,
SET/REPLACE/CLEAR, previousVersion, newVersion,
changedFields=["administrativeReference"], reasonCode when required,
correlationId, idempotencyKey, occurredAt
```

Raw before/after reference values are forbidden in audit, outbox, application
logs, metrics and traces. If investigation evidence is later required, only a
security-approved keyed HMAC fingerprint may be added; an unkeyed reversible or
enumerable hash is not sufficient. HTTP bodies/headers follow masking policy.

## 17. Retention and lifecycle

The reference follows the clinic-local profile and never independently makes a
patient visible. Archive or consent revoke immediately hides it from active
read/write workflows even if storage remains. Reactivation may expose the
retained value only through the existing approved retention contract after a
new authoritative active association/consent transition; it does not recreate
or import a value.

Clear sets the current value/key to null, increments the shared version,
updates `updatedAt`, leaves immutable audit, and releases uniqueness. Physical
purge of the local profile removes the current reference under the separately
approved retention/deletion process. Audit follows general audit retention.
Transfer/merge never copies the reference automatically; it requires a separate
lifecycle decision and must not silently resolve collisions.

## 18. Search semantics

Search is not implemented in `04G` or the first backend slice. A future bounded
slice may add exact match on the normalized comparison key after exact
clinic/location authority and current association/privacy predicates. Prefix
search requires a separate performance/privacy decision. Contains and global
cross-clinic/location search are forbidden.

A match returns only patients already visible through current Registry policy;
it never returns owner contacts or confirms a foreign/invisible patient.
Knowing the reference does not authorize a Detail read.

## 19. Privacy/no-leak

Authentication, effective capability, exact membership/scope and current
association/consent/policy are rechecked before a resource result. Denials do
not reveal whether a reference or patient exists, who uses a colliding value,
foreign scope, database constraint, membership or policy internals. Collision
wording may say only: `Такой внутренний номер уже используется в этой клинике.`

## 20. Error model

```text
400 INVALID_REQUEST
401 AUTHENTICATION_REQUIRED
403 ACTION_NOT_PERMITTED
404 PATIENT_RESOURCE_UNAVAILABLE
409 PATIENT_VERSION_STALE
409 PATIENT_ASSOCIATION_CHANGED
409 ADMINISTRATIVE_REFERENCE_ALREADY_IN_USE
409 IDEMPOTENCY_KEY_REUSED
422 INVALID_ADMINISTRATIVE_REFERENCE
428 PRECONDITION_REQUIRED
503 POLICY_TEMPORARILY_UNAVAILABLE
```

Validation and collision responses never include raw backend/database messages
or another patient/scope. No-leak precedence applies to unauthorized resources.

## 21. Feature flag

The backend slice reuses default-off
`VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS`. Alias and reference are one bounded
mutation family with the same capability and rollback policy; another runtime
flag would add configuration without a distinct risk boundary. Turning it off
disables writes only. Patient Detail nullable read projection remains
authoritative and available.

## 22. Decision matrix

| Decision | Chosen option | Rejected alternatives | Reason | Implementation consequence |
| --- | --- | --- | --- | --- |
| Data owner | clinic/location local admin domain | owner or clinical domain | operational value only | exact association key |
| Field name | `administrativeReference` | generic/external/record number | unambiguous boundary | nullable strict field |
| Source | implicit `CLINIC_MANUAL` | arbitrary/import source | no integration in MVP | no source in request |
| Scope | clinic + location + patient | clinic-wide/global | locations are isolated | exact predicates |
| Format | 1–40 bounded structured Unicode | free text/ASCII-only | safe multilingual operations | strict validator |
| Normalization | NFC, trim, space collapse | raw/remove punctuation | deterministic display | normalized stored value |
| Uniqueness | normalized key per clinic/location | global/per patient only | local reconciliation | partial unique constraint/index |
| Case comparison | Unicode Default Case Folding + NFC | locale lowercase/case-sensitive | deterministic collision/search | pinned comparison key |
| Read projection | required nullable Detail field | absent guessed state/Registry now | authoritative concurrency first | extend Detail only |
| Mutation route | `/local-profile/reference` | generic or expanded alias DTO | field-presence safety | bounded controller command |
| Capability | reuse `patient.admin.local-profile.update` | role strings/new capability now | identical authority class | evaluator reuse |
| Aggregate version | shared local-profile version | per-field/LWW | prevents cross-field loss | every alias/reference write increments |
| Idempotency | UUID, normalized scoped fingerprint | per-attempt/global key | safe replay | transactionally stored result |
| Audit values | operation/field, no raw value | raw before/after | minimize operational identifier leakage | safe audit/outbox |
| Retention | local-profile policy | perpetual/global copy | ownership follows association | hide on revoke/archive |
| Archive/revoke | immediately invisible | stale display | privacy precedence | policy predicate on every read/write |
| Search mode | future exact normalized match | contains/global | enumeration/no-leak | separate bounded slice |
| Feature flag | reuse admin-mutations flag | new flag/unflagged | same rollout family | writes default off |
| Collision error | bounded location-local 409 | reveal patient/database error | safe actionable response | normalize constraint failure |
| Owner visibility | never | owner-facing number | clinic-owned metadata | exclude owner APIs/UI |
| Clinical boundary | never a medical-record number | dual-purpose identifier | separate governance | exclude Clinical schemas/search |

## 23. Future test matrix

```text
G-01 absent reference read
G-02 existing reference read
G-03 authorized set
G-04 authorized replace
G-05 authorized clear
G-06 invalid characters
G-07 over maximum length
G-08 NFC/space normalization
G-09 same-location normalized collision
G-10 same value in another location allowed
G-11 same value in another clinic allowed
G-12 read-only capability denied
G-13 foreign clinic no-leak
G-14 foreign location no-leak
G-15 stale If-Match
G-16 missing If-Match
G-17 idempotent replay
G-18 idempotency payload mismatch
G-19 alias concurrent update conflicts through shared version
G-20 reference concurrent update conflicts
G-21 revoked association
G-22 archived association
G-23 policy unavailable
G-24 audit produced without raw value
G-25 denied mutation has no side effect
G-26 feature default-off
G-27 clear releases uniqueness
G-28 Registry remains unchanged
G-29 search does not bypass authority
G-30 migration rollback preserves existing alias profile behavior
```

These are future backend proofs; `04G` adds no runtime tests.

## 24. Recommended next slice

`V50-CLINIC-04H` implements the approved backend contract with an additive
reversible migration, Unicode 17.0.0 full default case-fold mapping, exact
location partial unique index, Detail projection, bounded reference command,
shared aggregate version, idempotency and safe audit/outbox. The strict Portal
parser accepts the required nullable projection without rendering it.

## 25. 04I Portal integration

Patient Detail renders **Внутренний номер** separately from the official name
and **Имя в клинике**, with **Не задан** for `null`. The bounded editor is
available only with the existing mutation flag, effective local-profile update
capability, exact scope and a loaded authoritative aggregate version.

The client performs display normalization only (NFC, trim, ASCII-space
collapse, allowed characters and Unicode code-point length). It never computes
the comparison key. Alias/reference editors share one pending lock and the same
authoritative version. Technical retry reuses the scoped intent key; payload,
operation, scope, stale refresh and success start a new intent.

Collision remains field-local and reveals no patient data. Stale conflict
refreshes Detail without resubmit; 403 removes both write controls; 404 clears
the snapshot; policy/network/malformed success preserve the last valid
snapshot. Registry projection/search remains unchanged.

The documentation-only `V50-CLINIC-04J / Clinic Patient Administrative
Reference Registry Search Contract Discovery` is complete.

## 26. 04J Registry search decision

The completed search contract is
`V50-CLINIC-PATIENT-ADMIN-REFERENCE-REGISTRY-SEARCH-CONTRACT.md`. It selects an
exclusive exact-normalized `administrativeReference` filter on the existing
exact-location Registry route. Authority/current visibility precede matching;
unknown, foreign and inaccessible values all return the same empty Registry
envelope. Registry items will gain only the nullable display reference.

The existing scoped partial unique comparison-key index is the intended lookup
index. Search has its own default-off flag, emits no mutation audit/outbox and
never exposes raw query/key. Prefix/contains/global search and Portal UI remain
excluded. The next slice is backend-only `V50-CLINIC-04K`.

## 28. 04L Registry search Portal

The existing Patients Registry implements a distinct flag-gated
**Внутренний номер** mode. Frontend normalization is display-only (NFC, trim,
ASCII-space collapse, preserved case); the backend comparison key remains
authoritative. Search occurs only on explicit submit and sends no ordinary
query or cursor.

Validation is field-local. Empty results disclose no foreign, archived,
consent or authority state. Clear, exact-scope changes, rollout rollback and
generation fencing prevent stale results. Technical failures retain the last
valid snapshot and permit explicit same-query retry. The next single slice is
documentation-first `V50-CLINIC-04M`.

## 27. 04K Registry search backend

The existing exact-location Registry route now supports the exclusive exact
`administrativeReference` filter behind its own default-off search flag.
Canonical Unicode 17 normalization, current Registry qualification and exact
clinic/location scope feed one bounded indexed query. Unknown or inaccessible
matches are indistinguishable empty envelopes; a corrupt duplicate fails
closed. Registry projection exposes only the nullable display value.

OpenAPI and the strict Portal Registry parser are updated without adding a
search control. The next single slice is
`V50-CLINIC-04L / Clinic Patient Administrative Reference Registry Search
Portal Integration`.
