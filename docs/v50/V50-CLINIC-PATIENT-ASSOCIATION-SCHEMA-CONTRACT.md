# V50 Clinic Patient Association Schema Contract

Status: `SCHEMA_LIFECYCLE_PRODUCER_IMPLEMENTED / REGISTRY_READ_MODEL_MISSING`.

## Bounded outcome

`V50-CLINIC-03A2` defines the PostgreSQL contract for one
`ClinicPatientAssociation` aggregate. It is a documentation-only prerequisite
for a migration; it creates no SQL migration, entity, repository, endpoint,
role, flag or Portal surface.

The aggregate owns only the exact clinic/location/pet administrative
relationship, qualifying appointment provenance, registry lifecycle,
optimistic version, current consent reference, policy-evaluation inputs and
first/last qualifying evidence. It is not a Pet master, owner profile, medical
record, appointment, visit, consent document, insurance relation or CRM client.
Pet display data and owner contacts remain outside this aggregate.

## Authoritative tables

The migration must add these bounded structures under `clinic_schema`.
PostgreSQL names are normative; all timestamps are `timestamptz`, UUID primary
keys use `gen_random_uuid()`, and created/updated defaults use
`clock_timestamp()`.

### `clinic_patient_associations`

| Column | Contract |
| --- | --- |
| `id` | UUID primary key; stable for the natural relation |
| `clinic_id` | UUID, not null, FK to `clinic_schema.clinics(id)` |
| `clinic_location_id` | UUID, not null, FK to `clinic_schema.clinic_locations(id)` |
| `pet_id` | UUID, not null, FK to `pet_schema.pets(id)` |
| `status` | text, not null: `ACTIVE`, `ARCHIVED`, `REVOKED` |
| `source_type` | text, not null; MVP value only `APPOINTMENT` |
| `source_appointment_id` | UUID, not null, FK to `booking_schema.appointments(id)`; most recent qualifying evidence |
| `current_consent_id` | UUID, not null, FK to `clinic_schema.clinic_patient_consents(id)` |
| `visibility_policy_version` | non-empty text, not null |
| `visibility_expires_at` | `timestamptz`, not null; bounded operational visibility computed at activation/refresh |
| `first_qualified_at` | `timestamptz`, not null; immutable minimum qualifying appointment `created_at` |
| `last_qualified_at` | `timestamptz`, not null; maximum qualifying appointment `created_at`, registry primary sort key |
| `archived_at` | nullable `timestamptz` |
| `archive_reason` | nullable text from a bounded application allowlist |
| `revoked_at` | nullable `timestamptz` |
| `revoke_reason` | nullable text from a bounded application allowlist |
| `version` | integer, not null, default `1`; positive optimistic version |
| `created_at` | `timestamptz`, not null |
| `updated_at` | `timestamptz`, not null |

Natural uniqueness is exactly
`(clinic_id, clinic_location_id, pet_id)`. Although a location currently
determines its clinic, `clinic_id` is retained as the explicit tenant fence and
query key; the application must prove that the location belongs to that clinic.
There is one current row and one stable association ID across repeat visits,
archive, revoke and authorized reactivation. A different location always has
an independent row and independent consent.

### `clinic_patient_consents`

This bounded authoritative consent record is separate from the association:

| Column | Contract |
| --- | --- |
| `id` | UUID primary key; immutable grant identity |
| `clinic_id`, `clinic_location_id`, `pet_id` | UUID, not null; same exact scope FKs as the association |
| `subject_owner_id` | UUID, nullable, FK to `identity_schema.users(id)`; no contact snapshot |
| `purpose` | text, not null; MVP value only `PATIENT_ADMIN_REGISTRY` |
| `consent_version` | non-empty text, not null; product/legal text version identifier |
| `source` | non-empty text, not null, from a bounded application allowlist |
| `actor_type` | non-empty text, not null, from a bounded application allowlist |
| `actor_id` | nullable text, matching existing audit actor convention |
| `granted_at` | `timestamptz`, not null |
| `expires_at` | nullable `timestamptz`; null means the consent itself has no declared expiry, not indefinite operational visibility |
| `revoked_at` | nullable `timestamptz` |
| `revoked_by_actor_type`, `revoked_by_actor_id`, `revoke_reason` | nullable bounded revocation audit fields |
| `version` | integer, not null, default `1`; incremented only by the one permitted revocation mutation |
| `created_at`, `updated_at` | `timestamptz`, not null |

A grant row is immutable except for a single version-fenced revocation. A new
grant creates a new consent ID; it never clears an old `revoked_at`. The
association points only to its current authoritative grant. Exact consent
scope must equal association scope. Raw consent documents, signatures,
contacts, secrets, medical consent categories and broad all-purpose grants are
forbidden.

`visibility_expires_at` is always finite even when `expires_at` is null. It is
the server-computed minimum of the configured operational visibility boundary
and any consent expiry. This prevents an undated consent from creating
indefinite registry visibility.

### `clinic_patient_association_event_receipts`

Projection idempotency uses a narrow receipt, not raw event payload:

| Column | Contract |
| --- | --- |
| `source_event_id` | UUID primary key; authoritative booking/outbox event identity |
| `association_id` | UUID, not null, FK to the association |
| `source_aggregate_id` | UUID, not null; appointment ID |
| `source_aggregate_version` | integer, not null and positive |
| `event_type` | non-empty text, not null |
| `processed_at` | `timestamptz`, not null |

The additional unique key
`(source_aggregate_id, source_aggregate_version, event_type)` fences semantic
redelivery under a different transport ID. It stores no payload or PII.

### `clinic_patient_association_revisions`

Registry pagination needs an immutable read revision because
`last_qualified_at` can move while a cursor is in flight:

| Column | Contract |
| --- | --- |
| `revision_sequence` | bigint primary key from a dedicated monotonic sequence |
| `association_id` | UUID, not null, FK to the association |
| `association_version` | integer, not null and positive |
| scope, lifecycle, consent and policy columns | immutable copies of `clinic_id`, `clinic_location_id`, `pet_id`, `status`, `current_consent_id`, `visibility_expires_at`, `last_qualified_at` needed by the read predicate |
| `recorded_at` | `timestamptz`, not null |

`(association_id, association_version)` is unique. Every material aggregate
change appends exactly one revision in the same transaction. This is not a
second source of truth or a pet snapshot; it is the minimal temporal registry
projection used to reconstruct the latest association version at a cursor's
fixed `snapshotSequence`.

## Database constraints

The migration must express only immutable row-local facts:

- primary/FK/not-null constraints and the natural unique key;
- `version > 0`, receipt/revision versions greater than zero;
- allowed association status, purpose and MVP source type;
- `last_qualified_at >= first_qualified_at`;
- `updated_at >= created_at`;
- `expires_at IS NULL OR expires_at > granted_at`;
- `visibility_expires_at >= first_qualified_at`;
- `ACTIVE`: `archived_at`, `archive_reason`, `revoked_at`, `revoke_reason` null;
- `ARCHIVED`: `archived_at` and `archive_reason` non-null, revocation fields null;
- `REVOKED`: `revoked_at` and `revoke_reason` non-null, archive fields either
  both null or both non-null to preserve a prior archive;
- consent revocation actor/reason fields are all absent when `revoked_at` is
  null and all required when it is non-null;
- composite scope FKs, or equivalent unique referenced keys, must prevent a
  consent or appointment from silently crossing clinic/location/pet scope.

No `CHECK`, generated expression or partial-index predicate may use `now()`,
`clock_timestamp()` or another volatile time comparison. Expiry is dynamic and
is not a database constraint.

FK delete actions are `RESTRICT`/`NO ACTION`, never `CASCADE`. Owner deletion or
anonymization is handled by revocation and lawful identity processing; it must
not silently erase association, consent, receipt, revision or audit evidence.
If nullable `subject_owner_id` must be anonymized, the explicit privacy
workflow may set it null only after revoking visibility.

## Application invariants and lifecycle

All writers use one transaction and one realizable lock order:

1. acquire a transaction-scoped PostgreSQL advisory lock derived from the
   canonical `(clinic_id, clinic_location_id, pet_id)` UUID tuple;
2. lock and recheck the candidate consent row;
3. lock the existing association row, or insert it only after that consent
   recheck when the natural key is absent.

Hash collisions may only serialize unrelated scopes; they cannot weaken
correctness. Consent revoke, owner/privacy revoke, pet archive, refresh and
activation use the same scope lock before touching consent or association
rows. A multi-association operation acquires scope locks in lexicographic
clinic/location/pet UUID order. This removes absent-row races and deadlocks.

Existing-row updates use
`WHERE id = :id AND version = :expectedVersion`. Creation still has the natural
unique key as a final fence and uses `INSERT ... ON CONFLICT (clinic_id,
clinic_location_id, pet_id) DO NOTHING`; an unexpected conflict is then locked
and reevaluated, never blindly overwritten. A successful material transition
increments `version`, updates `updated_at`, appends one revision and writes one
deduplicated outbox event. A duplicate receipt returns the prior result without
writes.

The transition matrix is:

| From | To | Required evidence |
| --- | --- | --- |
| absent | `ACTIVE` | authoritative confirmed appointment at exact scope plus valid scoped consent and configured policy |
| `ACTIVE` | `ACTIVE` | later qualifying appointment or newer still-valid consent/policy; first is minimum, last is maximum |
| `ACTIVE` | `ARCHIVED` | pet archival or bounded location-retention reason |
| `ACTIVE` | `REVOKED` | consent revoke, owner deletion/anonymization or privacy withdrawal |
| `ARCHIVED` | `ACTIVE` | new qualifying appointment, currently valid consent and policy |
| `ARCHIVED` | `REVOKED` | consent/privacy revocation |
| `REVOKED` | `ACTIVE` | a new consent ID granted after revocation plus new qualifying appointment |

`REVOKED -> ARCHIVED`, clearing revocation, and reusing the revoked consent are
forbidden. Repeated appointments update the stable row. A destination location
creates/reactivates its own natural-key row and never transfers the source
location consent.

Revocation wins over stale activation or refresh: all contenders serialize on
the exact-scope advisory lock, and the activation/refresh writer rechecks the
locked current consent and its version immediately before the association
write. If revoke acquired the scope first, activation observes revocation and
denies. If activation committed first, revoke runs next and ends in
`REVOKED`; no terminal interleaving leaves an invalid `ACTIVE` row. A stale
expected version fails and cannot replace a newer consent, clear revoke fields
or append an `ACTIVE` revision. `first_qualified_at` never moves forward;
`last_qualified_at` only moves forward. Pending, declined, expired or released
holds and appointments from excluded sources create no receipt, association,
revision or outbox side effect.

## Runtime policy invariants

Each registry/search request uses PostgreSQL time once and requires:

- latest association revision at or before the cursor snapshot is `ACTIVE`;
- exact clinic/location scope and active location;
- referenced consent has the same scope and purpose, is granted, not revoked,
  and is not expired at database `serverNow`;
- `visibility_expires_at > serverNow`;
- current pet exists and `pets.archived_at IS NULL`;
- required visibility configuration and policy version are available.

Missing policy configuration returns bounded `503`; it is not an empty result.
Expiry/revocation is denied immediately even if an asynchronous lifecycle
projection has not yet changed the current association status. Search also
requires the separately configured employee+clinic+location limiter.

These time-, configuration- and cross-row facts belong to the application/read
policy, not database checks.

## Registry ordering, snapshot and indexes

The first page captures the maximum committed `revision_sequence` as
`snapshotSequence`. Each page selects the latest revision per association with
`revision_sequence <= snapshotSequence`, then applies the policy predicate and
orders by:

```text
last_qualified_at DESC, pet_id DESC
```

The signed cursor binds exact clinic/location, normalized query, page limit,
`snapshotSequence`, `last_qualified_at` and `pet_id`. Later visits,
reactivations, archives and revocations append revisions but cannot reorder or
duplicate rows inside that snapshot. Dynamic consent/policy revocation still
removes a row immediately; privacy denial takes precedence over snapshot
completeness. Refresh starts a new snapshot.

Required indexes, subject to measured plans in the backend slice, are:

- unique association `(clinic_id, clinic_location_id, pet_id)`;
- current lookup `(clinic_id, clinic_location_id, status,
  last_qualified_at DESC, pet_id DESC)`;
- consent scope/purpose lookup `(clinic_id, clinic_location_id, pet_id,
  purpose, granted_at DESC)`;
- consent revocation lookup for `current_consent_id`;
- receipt primary and semantic idempotency unique keys;
- revision unique `(association_id, association_version)`;
- revision snapshot reconstruction
  `(clinic_id, clinic_location_id, association_id, revision_sequence DESC)`;
- revision registry scan
  `(clinic_id, clinic_location_id, status, last_qualified_at DESC, pet_id DESC,
  revision_sequence)`.

No time-dependent partial index and no speculative `INCLUDE`/covering index is
contracted. Pet-name prefix search joins the existing `pet_schema.pets` row;
association/revision tables must not duplicate name or normalized name.
`EXPLAIN (ANALYZE, BUFFERS)` at representative cardinality decides whether a
separate measured pet-name expression index is needed.

## Event and outbox boundary

The appointment producer remains authoritative. MVP consumes only its
confirmed appointment lifecycle and explicit pet/owner privacy events; imported,
manual, medical, insurance and platform-telemedicine sources are excluded.
Association, consent mutation, receipt, revision, audit and
`booking_schema.outbox_events` write must commit atomically.

Bounded association events are:

- `clinic.patient-association.activated.v1`;
- `clinic.patient-association.refreshed.v1`;
- `clinic.patient-association.archived.v1`;
- `clinic.patient-association.revoked.v1`;
- `clinic.patient-association.reactivated.v1`.

They use aggregate type `ClinicPatientAssociation`, association ID/version and
the existing outbox `deduplication_key`. Payloads contain only association,
clinic, location, pet, consent reference, status, bounded reason/policy
version, occurrence/correlation/causation IDs. Pet names, owner identifiers or
contacts, consent text, medical facts, appointment notes and source payloads
are forbidden.

## Retention and deletion

Operational rows are never hard-deleted by normal lifecycle handling.
Pet archival produces `ARCHIVED`; consent withdrawal and owner
deletion/anonymization produce `REVOKED`. Registry/search deny first; later
retention or anonymization may operate only under an approved legal policy and
must not cascade from master rows. Historical medical/audit retention never
restores administrative visibility.

## Migration, backfill and rollback contract

`V50-CLINIC-03A3` must use this order:

1. create the dedicated revision sequence, consent, association, receipt and
   revision tables with checks and FKs;
2. add natural/idempotency unique keys and bounded lookup indexes;
3. validate clean-install schema and existing-data FKs/checks, using
   `NOT VALID` plus later `VALIDATE CONSTRAINT` only where lock measurement
   requires it;
4. run a read-only dry run reporting counts by clinic/location for qualifying
   appointments, missing consent and duplicates;
5. perform no historical association backfill: legacy appointments lack the
   required purpose-specific consent and remain invisible;
6. keep the patients flag absent/default-off; deploy producers only after
   consent capture exists, then activate registry in a later bounded slice.

Table/sequence creation and constraints are transactional. Ordinary indexes on
the initially empty tables may be transactional; if an existing-data rollout
requires `CREATE INDEX CONCURRENTLY`, it must be a separately resumable,
non-transactional migration step with invalid-index cleanup documented.
Migration lock and statement timeouts must be bounded and tested on a
production-like catalog.

The zero-data backfill is idempotent, emits no outbox/audit events and has no
rows to roll back. Before any producer is enabled, rollback may drop only the
new empty structures in reverse dependency order. After a producer writes
data, destructive down migration is forbidden: disable the future feature and
producer, retain the evidence, and use a forward corrective migration.

## Future acceptance matrix

- creation from a qualifying appointment plus exact valid consent;
- repeat delivery, changed transport ID and concurrent first events yield one
  association, one receipt per semantic event and monotonic versions;
- exact clinic/location/pet uniqueness and independent destination consent;
- revoke racing refresh always leaves visibility denied;
- archive, revoke and authorized new-consent reactivation transitions;
- consent expiry and operational expiry deny without dynamic DB constraints;
- fixed-snapshot pagination has stable ties and no duplicate/local reorder;
- archived pet, deleted owner, missing policy and excluded source behavior;
- no pet display, owner contact, clinical, financial, insurance, raw consent
  or source payload in association/outbox/revision storage;
- clean install, existing database, lock timeout, retry, forward rollback and
  deny-default zero-write backfill;
- FKs do not cascade privacy/audit evidence and all cross-scope references fail.

## Readiness verdict

The aggregate, consent boundary, uniqueness, lifecycle, concurrency,
idempotency, outbox, snapshot ordering, indexes, privacy, migration and
rollback contracts are closed.

The schema is implemented by
`1719460000000_add_clinic_patient_association_schema.js`.

The internal transactional lifecycle service is implemented in
`clinic-patient-association-lifecycle.service.ts`. The authoritative manual
clinic-confirmation path invokes it with the same PostgreSQL transaction and
uses the committed appointment-event ID as durable evidence identity.

`SCHEMA_LIFECYCLE_PRODUCER_IMPLEMENTED / REGISTRY_API_PORTAL_MISSING`: the one
next bounded slice is
`V50-CLINIC-03B / Clinic Patients Backend Read Model`.

Product/legal/security configuration remains a production-activation gate, not
a migration blocker. Missing configuration continues to fail closed.
