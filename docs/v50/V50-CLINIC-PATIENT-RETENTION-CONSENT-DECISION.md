# V50 Clinic Patient Retention and Consent Decision

Decision: `V50-CLINIC-03A1 / Clinic Patient Retention and Consent Decision`.

Status: `DECISION_COMPLETE / ASSOCIATION_SCHEMA_CONTRACT_REQUIRED`.

## Context

The existing schema proves appointment participation at an exact clinic
location, but it has no clinic–pet association lifecycle, general patient
registry consent, revocation record, imported-patient provenance, owner
deletion policy or approved operational retention duration. Owner pet archival
and medical/audit retention are different concerns and cannot authorize an
administrative registry.

The registry must remain exact-location scoped, administrative-only and
deny-by-default. This decision does not create production code, schema,
migrations, API, roles, flags or UI.

## Options considered

### A. Derived from appointments

Rejected as the final MVP storage model. It is simple and provides provenance,
but cannot represent consent scope, immediate revocation, archival reason,
manual/import provenance or versioned lifecycle without increasingly complex
negative predicates.

### B. Manually maintained association

Rejected. A standalone relation with ad-hoc writes could drift from booking
truth and would introduce a new manual/import patient path before its ownership,
provenance and revocation contract exists.

### C. Hybrid event-derived association — chosen

Appointment confirmation remains the supported provenance event. The booking
transaction/outbox produces an idempotent association upsert only when valid
administrative-registry consent evidence exists. Registry reads use the
versioned association, not a broad appointment scan. Lifecycle changes are
driven by authoritative appointment, consent, owner and pet events. No Kafka is
required; the existing PostgreSQL transaction/outbox pattern is sufficient for
First Installation volume.

This model costs one bounded schema/migration and event-projection path, but it
provides explicit location isolation, provenance, revocation, archival and
future import extensibility without exposing medical data.

## Chosen association lifecycle

The minimal states are:

- `ACTIVE`: eligible for registry/search/detail under exact authority and
  configured operational visibility;
- `ARCHIVED`: operational window or pet archival ended; invisible but
  reactivation is possible from a new qualifying appointment and consent;
- `REVOKED`: consent or owner authority was revoked; immediately invisible;
  reactivation requires new consent evidence and a versioned transition.

There is no `PENDING` registry state. Missing association/consent is unavailable.
Physical deletion is not an operational state; retention/deletion jobs are
separate governance processes.

| Event | Association effect | Registry/search/detail | Other retained data |
| --- | --- | --- | --- |
| booking confirmed at location | create/upsert `ACTIVE` only with valid registry consent | visible within configured operational window | appointment remains authoritative |
| manual confirmation pending | this hold creates or refreshes nothing | invisible when no independent active association exists; any other valid association is unchanged | Queue/hold only |
| booking declined or expires | this hold creates or refreshes nothing | invisible when no independent active association exists; any other valid association is unchanged | hold retention is separate |
| booking cancelled before visit | existing association remains only until configured operational expiry and while consent is valid | visibility follows association, never cancellation alone | appointment retained separately |
| appointment completed | refresh `last_seen_at`; association remains `ACTIVE` until configured expiry/revocation | visible | medical retention remains separate |
| no-show | refresh relationship evidence; same bounded visibility rule | visible while active | appointment retained separately |
| reschedule within location | idempotent update of appointment provenance/last seen | unchanged | appointment lifecycle owns reschedule |
| move before visit from A to B | B association requires B-scoped consent; A archives if it has no other completed/qualifying evidence inside its window | exact-location visibility only | old appointment history is separate |
| completed visit in A and active booking in B | independent active associations when both have valid scoped consent/window | each authorized location sees only its row | no clinic-wide implicit sharing |
| owner account deletion/anonymization | transition all operational associations to `REVOKED`; owner display becomes/remains null | immediately invisible | legal medical/audit retention handled separately |
| pet archived | transition operational associations to `ARCHIVED` | invisible | no automatic medical deletion |
| consent revoked | transition exact consent scope to `REVOKED`, invalidate cache/read model | immediately invisible and no search match | active appointment is not cancelled; its purpose-specific surface remains |
| new consent after revoke/archive | versioned `ACTIVE` transition only with a new qualifying appointment or still-valid relationship rule | visible after authoritative transition | prior audit remains immutable |

Clinic admins with multiple location scopes still request one exact location.
A location never receives a patient solely because another location in the same
clinic has an association.

## Inclusion sources

Supported for First Installation:

- confirmed in-person appointment at the exact clinic location;
- its later completed, no-show, cancelled or rescheduled lifecycle;
- telemedicine only when it is backed by the same exact clinic-location
  appointment and consent evidence.

Excluded:

- pending/declined/expired/released hold without appointment;
- imported-only or `external_patient_id`-only pet;
- manually created clinic patient;
- medical record/document/OCR only;
- insurance/payment relation;
- owner-shared access without the defined registry consent;
- platform telemedicine without an exact clinic-location appointment;
- unrelated pets of the same owner.

Import/manual association is a future provenance/write-path slice and does not
block appointment-derived First Installation.

## Consent decision

Booking acceptance is sufficient only for the purpose of performing that
appointment. It is not perpetual consent for registry, clinical records,
communications or cross-location sharing.

Before an association becomes `ACTIVE`, a future consent record must provide:

- immutable consent reference and version;
- owner/authorized actor and capture source;
- granted timestamp;
- exact clinic and location scope;
- purpose `PATIENT_ADMIN_REGISTRY`;
- related pet;
- optional expiry governed by installation policy;
- revoked timestamp, actor/source and reason category;
- audit correlation.

Missing, malformed, expired or revoked consent means no registry association
and no search match. Revocation is enforced server-side before patient lookup,
emits an audit/outbox lifecycle event, invalidates cached/read-model visibility,
and does not delete historical clinical or audit records. Appointment-purpose,
clinical-record, communications and cross-location consent remain separate.

## Operational visibility and retention

Operational registry visibility is the intersection of:

```text
ACTIVE association
AND valid PATIENT_ADMIN_REGISTRY consent
AND exact location authority
AND pet not archived
AND installation operational-visibility policy
```

The visibility duration is a configurable installation policy, not a claimed
legal retention period. Data Protection/Legal must approve its allowed range;
Product Owner selects the pilot value within that range. If configuration is
missing or invalid, the registry fails closed with bounded `503
PATIENT_VISIBILITY_POLICY_UNAVAILABLE`; it must not fall back to indefinite
visibility.

Association rows may remain archived for reconciliation subject to a separately
approved retention schedule. Medical records, audit, backups and analytics each
retain their own policy and never independently make a patient operationally
visible. No numerical legal duration is asserted here.

## Owner deletion and pet archival

Owner deletion/anonymization revokes administrative associations and removes
the pet from registry/search/detail. Owner display is always nullable and no
UUID, email, phone, audit payload or appointment payload may be used as a
fallback.

Pet ownership transfer does not copy the old owner's unrelated pets or consent.
A new owner must supply new consent evidence before reactivation. Archived pets
remain absent until explicit owner reactivation plus valid association consent;
medical/audit history is not automatically deleted.

## Search limiter decision

- key: authenticated employee ID + clinic ID + location ID;
- scope: patient registry search before normalization/query execution;
- model: fixed installation-configured request window and threshold;
- configuration owner: Platform/SRE, constrained by Security policy and Product
  usability approval;
- missing/invalid configuration: search fails closed with bounded `503
  PATIENT_SEARCH_POLICY_UNAVAILABLE`; unfiltered authorized pagination may
  remain available;
- exceeded threshold: bounded `429 PATIENT_SEARCH_RATE_LIMITED` and
  `Retry-After`, with no count, match or existence hint;
- logging: actor hash/ID, exact tenant scope, policy version and outcome only;
  no query text, pet/owner PII or response payload;
- metrics: allowed/limited/config-missing counters and latency by route/policy,
  without patient labels;
- alerts: Platform/SRE owns sustained limiter/configuration alerts; Security
  reviews enumeration anomalies;
- bypass: none in production, including admins; test clocks/configuration are
  dependency-injected and cannot be enabled by request headers.

Security must approve a hard maximum and Platform/SRE must configure the pilot
threshold/window before search rollout. No unsupported number is invented.

## Conceptual future schema boundary

The next schema contract must define a versioned association containing:

- opaque association ID;
- clinic ID, location ID and pet ID;
- source/provenance and source aggregate ID;
- lifecycle status;
- consent reference/version;
- first/last seen timestamps;
- visibility-policy version and optional computed expiry;
- revoked/archived timestamps and bounded reason category;
- aggregate version and created/updated timestamps;
- uniqueness for one association per location/pet;
- exact tenant/location status/search indexes.

It must also define idempotent appointment event projection, consent/revocation
events, outbox ownership, backfill policy and rollback. Existing appointments
without valid consent are not backfilled as `ACTIVE`; they remain invisible
until compliant evidence is captured.

No SQL, migration or production entity is created in `03A1`.

## Product/legal ownership and gates

| Decision | Single accountable owner | Required artifact/gate | Safe fallback | Blocks |
| --- | --- | --- | --- | --- |
| allowed operational-visibility range and association retention schedule | Data Protection/Legal | approved policy referenced by installation configuration before data rollout | registry `503`, no visibility | production activation, not schema contract |
| pilot visibility value and registry product purpose | Product Owner | installation release decision inside approved range | registry disabled/default-off | activation |
| consent text, capture actor/source and withdrawal UX | Product Owner | versioned consent product specification reviewed by Legal | no association activation | consent implementation |
| consent lawfulness and deletion/anonymization obligations | Data Protection/Legal | approved processing/deletion decision | revoke/hide operational association; preserve only separately lawful records | activation |
| association/event/outbox consistency and backfill design | CTO/Architecture | `03A2` schema contract | no association table or backend endpoint | `03B` |
| search hard maximum and enumeration policy | Security | approved limiter policy | search `503` | search activation |
| search threshold/window configuration, metrics and alerts | Platform/SRE | installation configuration and runbook | search `503`; registry pagination only | search activation |
| location transfer/cancellation operating procedure | Clinic Operations | pilot runbook consistent with lifecycle table | exact-location deny; no manual sharing | operations rollout |

No person names or artificial calendar deadlines are assigned. The stated gate
is the deadline: schema design, consent implementation, or production
activation cannot pass its corresponding gate without the artifact.

## Backend readiness verdict

`03B backend read model is BLOCKED by one prerequisite:
V50-CLINIC-03A2 / Clinic Patient Association Schema Contract.`

Owner: `CTO/Architecture`.

Required artifact: a bounded schema/event/backfill/rollback contract for the
hybrid association above. Deny-by-default predicates over appointments are not
sufficient because they cannot store consent provenance, immediate revocation,
association version or lifecycle. Product/legal numeric policies do not block
`03A2`; their missing configuration fails closed and blocks activation.

## Future privacy acceptance matrix

- missing/expired/revoked consent never creates or exposes a row;
- revocation removes registry, search and detail visibility server-side;
- archived association/pet is absent until authorized reactivation;
- deleted/anonymized owner exposes no owner data or UUID fallback;
- unrelated owner pets never appear;
- exact-location transfer and multi-location isolation hold;
- imported/manual/medical-only sources remain absent;
- no clinical, contact, insurance, financial, audit or integration projection;
- technical failure/config missing is not authoritative empty;
- repeated reads are side-effect free;
- association event projection is idempotent and version-fenced;
- search limiting precedes the expensive query and cannot be bypassed;
- denials reveal no counts, match hints or existence.
