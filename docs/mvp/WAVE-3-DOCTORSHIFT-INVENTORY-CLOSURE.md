# Wave 3 DoctorShift inventory closure

Status: `WAVE3_MACHINE_COMPLETE`
Baseline: `agent/v51-stage-01-architecture` at `e9b7b2fb8a9208fb76e0ba2003246a741f3a1c8b`
Date: 2026-08-28

## Migration correction

`MIGRATION_CONSTRAINT_DEFECT_FOUND_AND_CORRECTED_BY_ADDITIVE_MIGRATION`.
The already applied `1719540000000_add_doctor_shift_generated_inventory.js`
was not edited. Product explicitly approved
`1719550000000_tighten_doctor_shift_publication_timestamp_constraint.js`.
Its UP rejects existing invalid rows, then replaces only
`appointment_slots_publication_timestamps_check`; DOWN restores the prior
constraint. It performs no data repair or schema expansion.

The final truth table is:

| publication state | required | forbidden |
| --- | --- | --- |
| generated `PUBLISHED` | `state=OPEN`, `published_at` | `unpublished_at`, `blocked_at`, `source_stale_at` |
| legacy `PUBLISHED` | `state=OPEN` | all four lifecycle timestamps may be null for compatibility; mixed timestamps are forbidden |
| `DRAFT` | none | all four lifecycle timestamps |
| `UNPUBLISHED` | `unpublished_at` | `published_at`, `blocked_at`, `source_stale_at` |
| `BLOCKED` | `blocked_at` | `published_at`, `unpublished_at`, `source_stale_at` |
| `STALE_SOURCE` | `source_stale_at` | `published_at`, `unpublished_at`, `blocked_at` |

Working-database precheck found `INVALID_ROWS=0`. The original rollback guard
blocker contained zero staff bridges, DoctorServices, DoctorShifts, generation
runs, DoctorShift slots, generated-slot holds, and generated-slot appointments;
therefore no cleanup was performed. Corrective DOWN, original DOWN, original
UP, and corrective UP succeeded. Both migrations remain applied. Two existing
manual slots and two expired holds retained exact IDs, times, counters, state,
version, and null Wave 3 lineage; no appointments or schedule periods changed.

Focused PostgreSQL migration tests prove fail-closed UP, valid state acceptance,
invalid mixed timestamp rejection, row/column/index preservation, corrective
DOWN→UP, original empty DOWN→UP, populated rollback refusal, legacy capacity
preservation, ordering, and checksums.

## Runtime evidence

- Final affected backend repair matrix: `21/21 PASS` across the corrective
  migration, DoctorShift runtime, schedule authority, capability mapping, and
  exact tenant/range controls. The preceding combined Wave 3 migration/runtime/
  authority/catalog matrix passed `16/16`.
- DoctorShift generation proves preview invisibility, publish/unpublish,
  protected holds/appointments, stale Owner selection, deterministic replay,
  concurrent generation, regeneration, blackout, tenant isolation, capacity
  one, and a 576-slot generation under two seconds.
- Booking manual-confirmation and Queue regression: applicable focused suites
  pass. `v50-booking-hold-status` and `clinic-queue` pass `18/18`; Booking
  performance passes `9/9`. The combined legacy HTTP suite has ten
  non-applicable alternative-slot expectations that conflict with the
  authoritative `PILOT_V1` route guard; the Scope Freeze was preserved.
- Backend build, OpenAPI export/assertion, and migration checksum verification
  pass.
- Clinic Portal Node 22 typecheck/build and focused schedule Playwright pass
  `16/16`, including DoctorShift preview/publish, degraded states, responsive
  viewports, axe scan, stale conflicts, and protected actions.
- Shared Owner Node 22 typecheck/lint and focused availability, booking,
  session bridge, deep-link, and status tests pass `72/72`. Expo Web production
  export passes. The completed Jest assertions leave known open handles and
  required process termination after the verdict.
- Final review found and the repair cycle closed three additional correctness
  defects: schedule reads now bind the exact clinic/location membership and are
  bounded to a positive maximum 31-day window with capped collections;
  veterinarians receive `schedule.read` but never `schedule.manage`; and the
  Portal now selects a newly mapped doctor, keeps preview scoped to one run,
  preserves the published run action, and allows edit/generate/publish only in
  `DRAFT`. Mapping → DoctorService → shift creation is exercised in Playwright.
- Fresh Migration/Data and Booking/Security re-reviews are `PASS / NO VETO`.
  Clinic/Owner review drove a final repair cycle for read-only role controls,
  protected held/booked affordances, localized stale copy, run-scoped preview,
  and evidence provenance. All identified source defects are repaired.
- Final independent Product/UX re-review on the repaired current build is
  `PASS / NO VETO`: the reviewer verified the current build ID, `60/60`
  source-bound screenshots and V50 hashes, protected/read-only affordances,
  localized stale recovery, and Queue-UI confirmation in the real-stack spec.

## Final cross-application and visual evidence

The final-source non-mocked Playwright vertical passes against `PILOT_V1`:
Clinic Portal production build creates, generates and publishes a DoctorShift;
Owner Expo Web receives and selects that exact generated canonical slot;
PostgreSQL creates `PENDING_CONFIRMATION`; Clinic Queue UI confirms it; Owner
reads `CONFIRMED`. Separate generated slots prove Clinic reject and worker
expiry. The database readback records generated holds in `CONFIRMED`,
`RELEASED`, and `EXPIRED` states.

`docs/testing/evidence/wave3-doctor-shift-inventory/` contains exactly 60 PNGs:
VIS-01 through VIS-12 at 390×844, 430×932, 768×1024, 1024×768 and 1440×900.
The hashed capture run binds the actual Chromium version, production build ID,
runtime sources, real `prototype-v50` sources, capture source, 60 overflow
assertions, 12 serious/critical axe scans, 12 semantic state assertions and all
artifact hashes/dimensions. The fail-closed verifier passes with no missing or
orphan screenshot. Explicit Playwright also proves Receptionist and
Veterinarian views contain no DoctorShift mutation controls and that a
published shift preview never mixes another generation run.

Consequently `WAVE3_COMPLETE=YES` for machine delivery. Affected master rows
are reconciled. This does not infer human Product acceptance, physical-device
evidence, UAT, deployment, Pilot Candidate or Go-Live, and Wave 4 must not
start without separate explicit authority.

## Flags

```text
WAVE3_COMPLETE=YES
DOCKER_RUNTIME_HEALTHY=YES
ORIGINAL_DOCTORSHIFT_MIGRATION_EDITED=NO
CORRECTIVE_MIGRATION_ADDED=YES
CORRECTIVE_MIGRATION_APPROVED=YES
DOCTORSHIFT_DB_CONSTRAINT_MATCHES_PLAN=YES
MIGRATION_CHANGED=YES
DOCTORSHIFT_IMPLEMENTED=YES
DOCTORSERVICE_AUTHORITY_IMPLEMENTED=YES
GENERATED_INVENTORY_IMPLEMENTED=YES
PUBLISHED_INVENTORY_IMPLEMENTED=YES
GENERATED_SLOT_CAPACITY=1
GLOBAL_SLOT_CAPACITY_FORCED_TO_ONE=NO
SCHEDULE_MANAGE_AUTHORITY=CLINIC_ADMIN_ONLY
OWNER_APP_TARGETS_IOS=YES
OWNER_APP_TARGETS_ANDROID=YES
OWNER_APP_TARGETS_WEB=YES
SEPARATE_OWNER_WEB_APP=NO
BOOKING_CORE_REWRITTEN=NO
BOOKING_CORE_SEMANTICS_CHANGED=NO
MANUAL_CONFIRM_DEFAULT_CHANGED=NO
AUTO_APPROVE_ENABLED=NO
MAP_IMPLEMENTED=NO
SPECIALIST_FIRST_IMPLEMENTED=NO
OPERATIONS_IMPLEMENTED=NO
SMART_REALLOCATION_IMPLEMENTED=NO
DIARY_IMPLEMENTED=NO
OCR_PRODUCT_IMPLEMENTED=NO
PAYMENT_ADDED=NO
MIS_DEPENDENCY_ADDED=NO
```
