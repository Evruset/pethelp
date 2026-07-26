# V50 Clinic Patient Administrative Mutations Contract

Status: `CONTRACT_COMPLETE / IMPLEMENTATION_MISSING`.

## 1. Purpose

`V50-CLINIC-04D` defines the administrative write boundary for a clinic's
patient projection. It separates clinic-owned operational metadata from
owner-owned pet master data, clinical records, and association/privacy
lifecycle commands. The result is a contract for one safe backend slice; this
document adds no endpoint, schema, capability, flag, OpenAPI entry or UI.

## 2. Scope

The bounded write resource is a clinic-location-local projection attached to a
currently visible clinic-patient association. It may contain only:

- a normalized clinic-local display alias;
- a bounded administrative reference;
- bounded, centrally defined non-clinical administrative labels.

Every command is exact clinic/location scoped, deny-by-default, version-fenced,
idempotent and audited. A prior Registry or Detail read never authorizes a
write.

## 3. Explicit non-goals

This contract does not authorize owner master-profile updates, owner contacts,
clinical content, documents, insurance/payment data, free-form notes,
association archive/reactivation, merge, ownership transfer, consent/privacy
transitions, imports, Portal edit controls or a combined administrative and
clinical patient record.

## 4. Data ownership model

| Class | Owner | Administrative mutation boundary |
| --- | --- | --- |
| Pet master identity: official name, species, breed, sex, birth date, avatar | owner-governed pet aggregate | clinic may submit a bounded correction request only; no direct update |
| Owner identity and contacts | owner/identity domain | never accepted or returned by clinic administrative mutations |
| Clinic-local alias/reference/labels | exact clinic-location association projection | direct update is allowed under the new mutation capability and command safeguards |
| Clinical observations and records | Clinical/Visit domain | separate clinical slice; never accepted here |
| Archive/reactivate/merge/transfer/consent/privacy | association or privacy lifecycle owner | separate policy and state-machine contracts |

Clinic-local metadata is not a new pet master. It cannot affect owner surfaces,
other clinics or other locations, and must be visibly identified as local when
presented. Free text is denied by default.

## 5. Mutation candidate matrix

| Candidate mutation | Data owner | Portal role | Capability | Direct update | Owner confirmation | Audit | If-Match | Idempotency-Key | Retention | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Update clinic-local alias | clinic-location projection | receptionist/admin with capability | `patient.admin.local-profile.update` | yes, bounded normalized value or clear | no | required | required | required | association-local policy; hidden immediately after revoke/archive | `ALLOW_DIRECT` |
| Update administrative reference | clinic-location projection | receptionist/admin with capability | `patient.admin.local-profile.update` | yes, bounded structured reference | no | required | required | required | association-local policy | `ALLOW_DIRECT` |
| Add/remove bounded administrative label | clinic-location projection | receptionist/admin with capability | `patient.admin.local-profile.update` | yes, allowlisted enum only | no | required | required | required | association-local policy | `ALLOW_DIRECT` |
| Request correction of pet name | owner pet master | receptionist/admin with capability | `patient.admin.correction.request` | no | yes | required | request version | required | correction workflow policy | `ALLOW_AS_CORRECTION_REQUEST` |
| Request correction of species | owner pet master | receptionist/admin with capability | `patient.admin.correction.request` | no | yes | required | request version | required | correction workflow policy | `ALLOW_AS_CORRECTION_REQUEST` |
| Request correction of breed | owner pet master | receptionist/admin with capability | `patient.admin.correction.request` | no | yes | required | request version | required | correction workflow policy | `ALLOW_AS_CORRECTION_REQUEST` |
| Request correction of sex | owner pet master | receptionist/admin with capability | `patient.admin.correction.request` | no | yes | required | request version | required | correction workflow policy | `ALLOW_AS_CORRECTION_REQUEST` |
| Request correction of birth date | owner pet master | receptionist/admin with capability | `patient.admin.correction.request` | no | yes | required | request version | required | correction workflow policy | `ALLOW_AS_CORRECTION_REQUEST` |
| Update pet avatar | owner pet/document aggregate | none in this contract | none | no | not sufficient without owner-governance contract | separate | separate | separate | owner/document policy | `OUT_OF_SCOPE` |
| Update owner display name | owner identity | none | none | no | owner-owned workflow | separate | separate | separate | identity policy | `OUT_OF_SCOPE` |
| Update owner phone/email | owner identity/contact | none | none | no | owner-owned workflow | separate | separate | separate | contact policy | `FORBIDDEN` |
| Archive clinic-patient association | association lifecycle | separately authorized operator | `patient.association.archive` candidate | no | policy-dependent | required | required | required | lifecycle/Legal policy | `SEPARATE_LIFECYCLE_SLICE` |
| Reactivate association | association/consent lifecycle | separately authorized operator | `patient.association.reactivate` candidate | no | new valid evidence/consent required | required | required | required | lifecycle/Legal policy | `SEPARATE_LIFECYCLE_SLICE` |
| Merge duplicate patient associations | association lifecycle | unresolved specialist authority | `patient.association.merge` candidate | no | policy-dependent | required | required | required | lifecycle/Legal policy | `SEPARATE_LIFECYCLE_SLICE` |
| Transfer patient to another owner | ownership/consent lifecycle | none in admin edit | none | no | explicit owner-governance required | required | required | required | ownership/legal policy | `SEPARATE_LIFECYCLE_SLICE` |
| Add free-form administrative note | unbounded/mixed | none | none | no | no | not applicable | no | no | unsafe/unresolved | `FORBIDDEN` |
| Add clinical note | Clinical/Visit domain | veterinarian under future clinical policy | future clinical capability | no | clinical policy | clinical audit | clinical contract | clinical contract | clinical/legal policy | `SEPARATE_CLINICAL_SLICE` |
| Upload document | document/clinical domain | none in this contract | none | no | separate consent/policy | separate | separate | separate | document/legal policy | `OUT_OF_SCOPE` |
| Update insurance/payment data | financial domain | none in this contract | none | no | separate financial authority | separate | separate | separate | financial/legal policy | `FORBIDDEN` |

## 6. Allowed clinic-local fields

The future projection allowlist is:

```text
localAlias              nullable string, trim + Unicode normalization, 1..80
administrativeReference nullable structured string, 1..64, no free text
administrativeLabels    set of centrally allowlisted enum codes, maximum 8
aggregateVersion        positive integer, server-owned
```

Empty strings are invalid; clearing uses `null` or an explicit remove command.
Aliases and references must reject control characters, line breaks, markup and
values resembling contact, clinical, document or payment payloads. Labels are
codes, not user-authored strings. None changes Registry inclusion, consent,
association status or the owner master profile.

## 7. Owner correction-request model

Owner master corrections use a future `ClinicCorrectionRequest`, never the
direct-update route:

```text
requestId, clinicId, locationId, patientId, field,
currentValueFingerprint, proposedValue, reasonCode, status,
createdBy, createdAt, expiresAt, aggregateVersion
```

Only name, species, breed, sex and birth date are candidates. The request
requires `patient.admin.correction.request`, exact current visibility and owner
confirmation/reconciliation. It must not carry contacts, clinical text or raw
identity documents. No correction workflow is implemented in `04D`.

## 8. Lifecycle boundary

Archive, reactivate, merge, duplicate resolution, ownership transfer, consent
renewal/revoke and privacy restriction are not profile edits. Each requires its
own capability, command/state-machine contract, reason taxonomy, concurrency,
idempotency, audit/outbox and no-leak HTTP matrix. Reactivation additionally
requires new current evidence and valid consent; it never clears a prior
revocation in place.

## 9. Clinical boundary

Complaints, diagnoses, prescriptions, treatment, allergies, anamnesis, weight,
measurements, laboratory/imaging, clinical notes/conclusions, telemedicine and
medical documents are rejected before persistence with
`CLINICAL_FIELD_NOT_ALLOWED`. Administrative labels cannot encode those values.

## 10. Roles and capabilities

`patient.admin.read` never grants a mutation. Direct updates require the new
`patient.admin.local-profile.update`; correction requests require the separate
future `patient.admin.correction.request`. Runtime mappings are deferred.

- receptionist/admin: allowed only when the effective capability is present;
- veterinarian-only: denied; clinical role does not imply admin mutation;
- multi-role employee: effective capabilities compose, never role strings;
- platform admin: no implicit clinic override;
- owner: clinic command denied; owner workflows remain separate;
- foreign clinic/location, missing/incompatible scope, inactive membership,
  revoked/archived association or unavailable policy: denied before mutation.

All allowed actions require active exact-location membership and a currently
visible association with valid purpose consent/policy.

## 11. Command contracts

The mutation family is reserved as:

```text
PATCH /v1/clinic/:clinicId/locations/:locationId/patients/:patientId/local-profile
```

The first implementation command is deliberately narrower:

```text
UpdateClinicPatientLocalAlias
headers: If-Match, Idempotency-Key, optional X-Correlation-ID
request: { localAlias: string | null }
response: {
  clinicId, locationId, patientId,
  localProfile: { localAlias },
  aggregateVersion, serverNow
}
```

Preconditions are authenticated session, exact active membership/scope, enabled
read and mutation flags, `patient.admin.local-profile.update`, current visible
association/consent/policy, unarchived pet, matching version, valid key and
allowlisted DTO. Postconditions are one clinic-local change, version increment,
audit and durable outbox in one PostgreSQL transaction. No owner master,
clinical, lifecycle or Registry-inclusion field changes.

Administrative reference and labels remain later commands in the same family,
not part of the first implementation slice.

## 12. If-Match semantics

Existing-resource mutations require:

```http
If-Match: "<aggregateVersion>"
```

Missing or malformed is `428 PRECONDITION_REQUIRED`. A stale version is `409
PATIENT_VERSION_STALE`. If association or visibility authority changed after
the client snapshot, return normalized `409 PATIENT_ASSOCIATION_CHANGED` or
`409 PATIENT_VISIBILITY_CHANGED` only after the resource is known to be
authorized; foreign/revoked/archived resources remain no-leak `404`. Last-write
wins is forbidden.

## 13. Idempotency semantics

Every command with a side effect requires UUID `Idempotency-Key`, scoped to
actor, exact route/resource and command. Store a normalized typed-payload
fingerprint. Same key and payload returns the original committed logical
result without a second version, audit or outbox event. Same key with a
different fingerprint returns `409 IDEMPOTENCY_KEY_REUSED`.

## 14. Privacy and no-leak behavior

At command time the backend rechecks session, membership, exact clinic and
location scope, capability, current visible association, consent/policy,
archive/revoke state and version. A previously rendered page is not authority.

- foreign clinic/location, unknown, revoked or archived resource:
  `404 PATIENT_RESOURCE_UNAVAILABLE`;
- authenticated same-scope actor who may know the resource but lacks the
  action capability: `403 ACTION_NOT_PERMITTED`;
- authorized resource whose mutable state changed: safe `409`;
- invalid field class: bounded `422`;
- policy dependency unavailable: `503 POLICY_TEMPORARILY_UNAVAILABLE`, never
  empty success.

Responses never include owner contacts, raw policy/membership details, clinical
data, database errors or existence hints.

## 15. Audit contract

Each committed mutation atomically writes an audit/outbox envelope:

```text
eventId, eventType, actorId, actorType, clinicId, locationId,
patientId or safeResourceReference, associationId, commandId,
idempotencyKey, correlationId, previousVersion, newVersion,
changedFields, reasonCode, occurredAt
```

`changedFields` contains field names and change markers only. Sensitive values
use a classification and fingerprint/hash only where justified. Owner
phone/email, clinical text, document contents, raw request bodies, tokens,
cookies and unnecessary before/after values are forbidden. Denied commands
produce no domain mutation/outbox effect; safe security telemetry remains
separate.

## 16. Error semantics

| HTTP | Code |
| --- | --- |
| 400 | `INVALID_REQUEST` |
| 401 | `AUTHENTICATION_REQUIRED` |
| 403 | `ACTION_NOT_PERMITTED` |
| 404 | `PATIENT_RESOURCE_UNAVAILABLE` |
| 409 | `PATIENT_VERSION_STALE`, `PATIENT_ASSOCIATION_CHANGED`, `PATIENT_VISIBILITY_CHANGED`, `IDEMPOTENCY_KEY_REUSED` |
| 422 | `MUTATION_NOT_ALLOWED`, `OWNER_CONFIRMATION_REQUIRED`, `CLINICAL_FIELD_NOT_ALLOWED`, `CONTACT_FIELD_NOT_ALLOWED`, `DOCUMENT_FIELD_NOT_ALLOWED`, `FINANCIAL_FIELD_NOT_ALLOWED` |
| 428 | `PRECONDITION_REQUIRED` |
| 503 | `POLICY_TEMPORARILY_UNAVAILABLE` |

Errors expose no database, policy, membership or foreign-resource detail.

## 17. Feature-flag strategy

Implementation requires both existing `VETHELP_CLINIC_PATIENTS_REGISTRY` and a
new default-off `VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS`. The latter is not
added in `04D`. It rolls back writes independently: Registry and read-only
Detail remain available, stored local metadata remains intact, and rollback
requires no database downgrade.

## 18. Future contract test matrix

| ID | Required proof |
| --- | --- |
| M-01 | authorized exact-scope direct mutation |
| M-02 | read-only capability cannot mutate |
| M-03 / M-04 | foreign clinic / foreign location no-leak denial |
| M-05 / M-06 | inactive membership / malformed UUID |
| M-07 / M-08 | stale / missing `If-Match` |
| M-09 / M-10 | idempotent replay / same-key payload mismatch |
| M-11 / M-12 | revoked / archived association |
| M-13 | consent revoked after page load |
| M-14 | policy unavailable is technical failure |
| M-15..M-18 | clinical/contact/document/financial fields rejected |
| M-19 | one safe audit and outbox record created |
| M-20 | denied command has no domain side effect |
| M-21 | mutation feature default-off |
| M-22 | read-only Detail unaffected by mutation rollback |

The backend suite must use real PostgreSQL and verify transaction, version and
idempotency invariants. Portal tests belong to a later UI slice.

## 19. Open questions and decisions

Decided: clinic-local alias is a safe direct field; master identity remains
owner-governed; free text is forbidden; lifecycle and clinical mutations are
separate; capability, version, idempotency, audit/outbox and independent
default-off rollout are mandatory.

Before implementing reference or labels, Product/Clinic Operations must define
their structured format/enum and retention purpose. Legal/privacy must approve
the local-projection retention configuration before production activation.
These gates do not expand the first alias-only backend slice.

## 20. Recommended next bounded slice

`V50-CLINIC-04E / Clinic Patient Local Administrative Profile Mutation Backend`.

Implement only `UpdateClinicPatientLocalAlias`: one clinic-local field, exact
scope, new capability, `If-Match`, UUID `Idempotency-Key`, transactional
audit/outbox, default-off mutation flag and focused PostgreSQL/HTTP matrix.
Do not add Portal UI, owner corrections, reference/labels, lifecycle commands
or clinical fields in the same slice.
