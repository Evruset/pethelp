# DOCTORSHIFT_SCHEMA_PLAN

Status: `APPROVED_AND_IMPLEMENTED`  
Original migration: `backend/migrations/node-pg/1719540000000_add_doctor_shift_generated_inventory.js`  
Corrective migration: `backend/migrations/node-pg/1719550000000_tighten_doctor_shift_publication_timestamp_constraint.js`

Implemented schema identity (SHA-256): original
`29e7767741d9daa05d4ce0cf14d93cc2a5a27a38d9b1df86015969e20595995f`;
corrective
`c92bb0ca75964066640884f035de1432f81230a035fc73037b4db45b0f1045a8`.

The original applied migration is immutable. Final closure found that its
publication timestamp CHECK allowed mixed historical timestamp combinations
for `UNPUBLISHED`, `BLOCKED`, and `STALE_SOURCE`. Product approved the named
additive correction on 2026-08-28. The correction performs a fail-closed data
precheck, replaces only that CHECK, and has a reversible DOWN restoring the
previous constraint. No row is rewritten and no table, column, index, FK,
lifecycle, capacity, Booking, or DoctorService contract changes.

## Decision

Wave 3 requires one additive migration. Existing schedule foundations are
retained, but they cannot safely encode the new invariants:

- `schedule_periods` represents blackouts, vacations and emergency duty; it is
  not a doctor work interval and has no DoctorShift lifecycle.
- `clinic_staff` and `clinic_services` are both location-scoped, but no
  doctor×service eligibility authority exists.
- the clinic has a timezone while `clinic_locations` does not have an explicit
  overridable timezone authority.
- clinic scheduling identifies a veterinarian through `clinic_staff`, while
  Owner discovery/Booking uses `catalog_schema.doctors`; no authoritative bridge
  currently proves they are the same doctor.
- `appointment_slots` is the correct canonical Booking Core identity, but
  `source`/`external_slot_id` do not provide typed shift, eligibility,
  generation, publication and stale-source lineage.

Rejected alternatives: adding `DOCTOR_SHIFT` to `schedule_periods`; encoding
lineage in JSON or `external_slot_id`; inferring all doctors can perform all
services; creating a second generated-slot table used by Owner; or publishing
every generated row implicitly. Each loses a required invariant or creates a
competing Booking identity.

## Current schedule reuse map

| Current asset | Classification | Wave 3 use |
| --- | --- | --- |
| `clinic_schema.clinic_working_hours` | `REUSE_AS_IS` | location calendar context; not DoctorShift identity |
| `clinic_schema.schedule_periods` | `REUSE_AS_IS` | canonical blackout/vacation/emergency-duty foundation |
| `clinic_schema.appointment_slots` | `REUSE_WITH_DELTA` | one canonical generated/manual Booking slot identity; add typed lineage/publication |
| `clinic_schema.clinic_services.duration_minutes` | `REUSE_AS_IS` | authoritative positive duration; existing API bounds it to `5..480` minutes |
| `clinic_schema.clinic_staff` | `REUSE_WITH_DELTA` | doctor identity foundation; eligibility relation remains missing |
| `clinic_schema.clinic_resources` | `REUSE_AS_IS` | optional cabinet/resource constraint |
| slot `capacity`, `held_count`, `booked_count` check | `REUSE_AS_IS` | preserve multi-capacity invariant and existing Booking Core locking |
| slot `source` / `external_slot_id` | `REUSE_WITH_DELTA` | retain manual/MIS compatibility; insufficient alone for generated lineage |
| generic idempotency, audit and outbox tables | `REUSE_AS_IS` | command replay and aggregate-safe business facts |
| `ClinicScheduleController` / `ClinicScheduleService` | `REUSE_WITH_DELTA` | extend existing `/v1/clinic/.../schedule` family; no `/v2` fork |
| Portal `ClinicScheduleClient` and BFF family | `REUSE_WITH_DELTA` | V50-derived DoctorShift/preview/publish workflow |
| shared Owner availability client/screen | `REUSE_WITH_DELTA` | consume only published canonical slots across iOS/Android/Web |
| DoctorShift table/lifecycle | `MISSING` | additive persistence required |
| Doctor×Service×Location authority | `MISSING` | additive `doctor_services` required |
| generation run/slot lineage/publication | `MISSING` | additive run table and slot columns required |
| second generated/Owner slot table | `REPLACE / PROHIBITED` | never introduce; canonical appointment slot is retained |

## Additive UP schema

### Existing authority deltas

1. Add `clinic_schema.clinic_locations.timezone text`.
   Backfill from the owning `clinic_schema.clinics.timezone`, then make it
   `NOT NULL`. Runtime writes validate the value against PostgreSQL
   `pg_timezone_names`; the migration also applies a bounded non-empty length
   check. No fixed UTC offset is stored.
2. Add composite uniqueness needed by same-location foreign keys:
   `clinic_locations(id, clinic_id)`, `clinic_staff(id, clinic_location_id)` and
   `clinic_services(id, clinic_location_id)`, `clinic_resources(id,
   clinic_location_id)` and `catalog_schema.doctors(id, clinic_location_id)`.
3. Add nullable `clinic_staff.catalog_doctor_id uuid`, with a composite FK
   `(catalog_doctor_id, clinic_location_id)` to
   `catalog_schema.doctors(id, clinic_location_id)` and a partial unique index on
   `catalog_doctor_id`. Existing non-doctor and unmapped staff remain compatible;
   DoctorShift/DoctorService creation requires an active `VETERINARIAN` staff
   row with this bridge populated.
   Add `UNIQUE (id, catalog_doctor_id, clinic_location_id)` so DoctorShift and
   DoctorService can use one composite FK that proves the operational staff,
   public doctor and location mapping at the database boundary.

### `clinic_schema.doctor_services`

| Column | Contract |
| --- | --- |
| `id uuid` | PK, generated UUID |
| `clinic_location_id uuid` | required location authority |
| `staff_id uuid` | required operational `clinic_staff` veterinarian |
| `doctor_id uuid` | required public/catalog doctor joined through `clinic_staff.catalog_doctor_id` |
| `service_id uuid` | required active clinic service |
| `resource_id uuid` | optional existing clinic resource |
| `slot_capacity integer` | Pilot configuration, default and currently constrained to `1`; this does not alter global appointment-slot support for capacity greater than one |
| `active boolean` | eligibility lifecycle |
| `version integer` | positive aggregate version, default 1 |
| `created_by uuid` | initiating clinic employee |
| `created_at`, `updated_at` | PostgreSQL timestamps |

Composite foreign keys enforce staff, catalog doctor, service and optional
resource membership in the same location. In particular,
`(staff_id, doctor_id, clinic_location_id)` references the bridged
`clinic_staff` triple, so the mapping is not merely application validation. Use
`UNIQUE NULLS NOT DISTINCT
(clinic_location_id, doctor_id, service_id, resource_id)` so retry cannot create
duplicate eligibility rows.

Indexes: `(clinic_location_id, active, doctor_id, service_id)` and
`(doctor_id, active, service_id)`.

### `clinic_schema.doctor_shifts`

| Column | Contract |
| --- | --- |
| `id uuid` | PK |
| `clinic_id uuid` | exact tenant authority |
| `clinic_location_id uuid` | exact location authority |
| `staff_id uuid` | operational `clinic_staff` veterinarian identity |
| `doctor_id uuid` | bridged canonical `catalog_schema.doctors` identity used by Owner and generated slots |
| `starts_at`, `ends_at timestamptz` | half-open work interval, `ends_at > starts_at` |
| `timezone text` | validated IANA timezone snapshot from location authority |
| `status text` | `DRAFT`, `PUBLISHED`, `BLOCKED`, `CANCELLED` |
| `aggregate_version integer` | positive optimistic fence, default 1 |
| `generation_version integer` | non-negative completed-generation counter, default 0 |
| `created_by`, `updated_by uuid` | clinic employee trace |
| `created_at`, `updated_at` | PostgreSQL timestamps |

Composite FKs bind location to clinic and
`(staff_id, doctor_id, clinic_location_id)` to the explicit staff→catalog doctor
bridge. Add
`btree_gist` if absent and a GiST exclusion constraint preventing overlapping
non-cancelled shifts for the same doctor using half-open `tstzrange`. Midnight
crossing is permitted only when it is one unambiguous instant interval no
longer than the bounded product maximum; invalid/ambiguous local inputs must be
rejected before persistence and the API returns the normalized instants.

Indexes: `(clinic_location_id, starts_at, ends_at, status)`,
`(doctor_id, starts_at, ends_at)`, and `(clinic_id, clinic_location_id, status)`.

### `clinic_schema.inventory_generation_runs`

| Column | Contract |
| --- | --- |
| `id uuid` | PK |
| `doctor_shift_id uuid` | required shift lineage, delete restricted |
| `shift_version integer` | exact input aggregate version |
| `generation_version integer` | positive per-shift generation number |
| `rules_fingerprint char(64)` | SHA-256 of canonical sorted eligibility/duration/resource/blackout/timezone inputs |
| `input_snapshot jsonb` | bounded canonical generation inputs for audit/reproducibility; never slot rows or sensitive free text |
| `status text` | `GENERATING`, `GENERATED`, `PUBLISHED`, `SUPERSEDED`, `FAILED` |
| `slot_count integer` | non-negative completed result count |
| `attempt_count integer` | positive retry count |
| `error_code text` | allowlisted technical/domain code only, no raw exception text |
| `created_by uuid` | initiating employee |
| `created_at`, `completed_at` | PostgreSQL timestamps |

Unique constraints on `(doctor_shift_id, generation_version)` and
`(doctor_shift_id, shift_version, rules_fingerprint)` make same-intent retry and
concurrent generation one logical run. Under the shift lock, a `FAILED` same
intent may transition back to `GENERATING`, increment `attempt_count`, clear the
allowlisted error code and either reach `GENERATED` or fail again. Only
`GENERATED` may publish; publish transitions the run to `PUBLISHED` and the
previous published run to `SUPERSEDED`. Failed runs never expose inventory.

### Canonical `clinic_schema.appointment_slots` lineage

Add:

- `doctor_shift_id uuid REFERENCES doctor_shifts(id) ON DELETE RESTRICT`;
- `doctor_service_id uuid REFERENCES doctor_services(id) ON DELETE RESTRICT`;
- `generation_run_id uuid REFERENCES inventory_generation_runs(id) ON DELETE RESTRICT`;
- `generation_version integer`;
- `duration_minutes_snapshot integer` with the same bounded positive service-duration check;
- `publication_state text NOT NULL DEFAULT 'PUBLISHED'`, checked as one of
  `DRAFT`, `PUBLISHED`, `UNPUBLISHED`, `BLOCKED`, `STALE_SOURCE` (the default
  preserves existing manual/import visibility; generated inserts start
  `DRAFT`);
- `published_at timestamptz`;
- `unpublished_at timestamptz`;
- `blocked_at timestamptz`;
- `source_stale_at timestamptz`.

Add a validated check: `source = 'DOCTOR_SHIFT'` requires every lineage field
and a positive generation version; non-generated existing rows may keep null
lineage. Row checks require timestamps consistent with `publication_state` and
prevent simultaneous blocked/stale/published representations. Publication
requires `state = 'OPEN'` and a `GENERATED` run; Owner availability reads only
`publication_state='PUBLISHED'`, open and not-full rows and never projects
lineage.

Indexes:

- unique logical candidate `(generation_run_id, doctor_service_id, starts_at)`;
- `(doctor_shift_id, generation_version, starts_at)`;
- partial Owner read `(clinic_location_id, service_id, starts_at, id)` where
  `publication_state = 'PUBLISHED' AND state = 'OPEN'`;
- existing staff/resource/time and counter constraints remain unchanged.

Stable logical slot identity is enforced by the database unique key and
`INSERT ... ON CONFLICT` on `(generation_run_id, doctor_service_id, starts_at)`;
no uncontracted UUID namespace algorithm is required. Repeating the same intent
therefore returns the existing canonical slot rows. A changed source version
gets a new generation run; only still-free old generated rows may be
unpublished or removed. Held/booked rows retain their original IDs and lineage.

## Locking and race policy

After command idempotency and applicable Owner/pet authority, all Wave 3
schedule mutations and Owner creation for generated slots acquire a
transaction advisory lock keyed by the bridged canonical `doctor_id`; operations
touching multiple doctors acquire keys in UUID order. This lock is acquired
before any generated-slot row lock and is added to every generated-slot create,
alternative, blackout and regeneration path. Then:

1. lock DoctorShift rows by ID;
2. lock generation/eligibility rows by ID;
3. lock affected canonical slot rows by ID;
4. reuse the existing Booking Core slot→hold/appointment lock order.

Generation locks the shift, verifies its aggregate version and uses
`INSERT ... ON CONFLICT` for the generation run and batch slot insertion.
Publish, blackout, block, unpublish, shift edit/cancel and Owner create use the
same doctor lock, preventing ordinary generate/publish/blackout/create races
from becoming 5xx or double bookings. Booking creation additionally rejects an
overlapping active hold/appointment for the same doctor, so different service
alternatives over one doctor interval cannot book independently. Existing
`held_count + booked_count <= capacity` remains the canonical per-slot check.
Wave 3 generated doctor inventory is explicitly configured at capacity `1`;
capacity greater than one remains supported for existing/manual slots but is
unsupported for doctor-generated inventory until aggregate overlap semantics
receive a later Product/schema decision.

## Compatibility and data policy

- No backfill creates DoctorShift, DoctorService or generated inventory.
- Existing manual/import slots retain IDs, counters, state and visibility and
  have null lineage.
- Existing blackouts remain `schedule_periods`; no second blackout subsystem.
- Existing services retain authoritative bounded `duration_minutes`.
- Existing `clinic_staff`/catalog doctors are not guessed or name-matched; an
  explicit bridge is required before a doctor can receive eligibility/shifts.
- Pilot requires no MIS rows or credentials.
- Audit/outbox reuse existing generic tables. Emit one aggregate-safe fact per
  DoctorShift/eligibility/publication mutation and one generation summary fact,
  not one event per slot.

## Product/authorization decisions included in the approval request

- Generated DoctorShift inventory uses configured capacity `1` for Wave 3;
  existing/manual canonical slots retain capacity greater than one support.
- Add one narrow `schedule.manage` capability. Recommended Pilot mapping is
  Clinic Admin only; receptionist and veterinarian retain `schedule.read` and
  do not receive mutation authority unless the Product Owner explicitly chooses
  a broader mapping.

## DOWN / rollback

Application rollback is feature-flag first: stop create/generate/publish, keep
reads compatible with additive columns, and leave generated slot/booking
history intact. The migration `down` must fail closed if any DoctorShift,
DoctorService, generation run, or `source='DOCTOR_SHIFT'` slot exists. With no
Wave 3 data it drops new slot indexes/check/columns, generation runs, shifts,
doctor services, composite constraints and location timezone. It does not drop
`btree_gist`, which may be shared. No destructive automatic conversion of
generated booked history into manual slots is allowed.

## Executable migration order

The approved `up` must execute in this order:

1. `CREATE EXTENSION IF NOT EXISTS btree_gist`.
2. Add nullable location timezone, backfill from owning clinic, assert no nulls,
   then add the named nonblank/length check and `NOT NULL`.
3. Add the composite unique constraints to location, staff, service, resource
   and catalog doctor identities.
4. Add nullable `clinic_staff.catalog_doctor_id`, its same-location composite
   FK as `NOT VALID`, validate it, then add the partial one-to-one index and
   bridged-triple unique constraint. Do not infer or backfill mappings.
5. Create `doctor_services` with all checks/FKs/indexes.
6. Create `doctor_shifts`, indexes and the half-open overlap exclusion.
7. Create `inventory_generation_runs` with lifecycle and uniqueness checks.
8. Add nullable slot lineage/timestamp columns and
   `publication_state` initially nullable.
9. Backfill all existing slots to `publication_state='PUBLISHED'`, assert no
   nulls, then set the column default and `NOT NULL`.
10. Add generated-lineage/publication consistency checks as `NOT VALID`,
    validate them, then create lineage and partial Owner-read indexes.
11. Analyze the altered tables; do not create DoctorShift, eligibility,
    generation or slot data.
12. Migration verification checks existing slot IDs, counters, source and
    Owner visibility are unchanged.

The `down` first runs a `DO` guard that raises when any Wave 3 table has rows,
any staff mapping exists, or any slot has DoctorShift lineage/source. Only an
empty Wave 3 state may remove, in reverse dependency order: slot indexes/checks/
columns; generation runs; shifts; doctor services; staff mapping FK/index/
column; composite uniqueness added solely by this migration; and location
timezone. The extension is retained.

## Migration and operational implications

The new tables/indexes are additive. Adding nullable lineage columns is a short
catalog change; `publication_state DEFAULT 'PUBLISHED' NOT NULL` and location timezone backfill
must be staged in the migration to avoid a table rewrite/invalid null window.
Composite uniqueness and new slot indexes scan current tables and require a
bounded maintenance window assessment against real row counts. The exclusion
constraint locks the new empty shift table only. Migration validation must cover
empty DB, representative existing manual/import data, up/down before Wave 3
data, repeated-up safety, and down refusal after generated history.

`MIGRATION_REQUIRED=YES`. The original and corrective revisions are explicitly
approved and implemented. Machine closure evidence and remaining gates are
recorded in `docs/mvp/WAVE-3-DOCTORSHIFT-INVENTORY-CLOSURE.md`.
