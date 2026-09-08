# V50-CLINIC-04H — Administrative Reference Backend

The existing clinic-patient local-profile row now owns nullable
`administrative_reference` and `administrative_reference_key`. An additive
reversible migration preserves all alias rows and versions, requires no
backfill, and enforces non-null key uniqueness only inside exact clinic/location.

The isolated generator consumes official Unicode 17.0.0 `CaseFolding.txt`.
Runtime normalization applies NFC, rejects raw control/format/line/tab input,
trims and collapses whitespace, validates 1–40 structured Unicode code points,
preserves display case and produces a locale-independent full-fold comparison
key. No dependency, PostgreSQL `lower()`, `citext`, collation or OS locale is
used.

`PATCH /v1/clinic/:clinicId/locations/:locationId/patients/:patientId/local-profile/reference`
accepts exactly nullable `administrativeReference`. It reuses
`patient.admin.local-profile.update`, the default-off mutation-family flag and
current exact-scope association/consent/privacy checks. Strong `If-Match`,
scoped UUID idempotency and one shared alias/reference aggregate version prevent
lost updates. Same-location collisions are normalized to
`ADMINISTRATIVE_REFERENCE_ALREADY_IN_USE`.

Display/key update, version/timestamp, idempotency result, safe audit and outbox
are one transaction. Audit/outbox record only operation, field, scope and
versions, never the raw reference or comparison key. Detail reads remain
side-effect free and return required nullable `administrativeReference` even
with writes disabled.

Focused tests map H-01..H-33 across read states, set/replace/clear, validation,
Unicode normalization, uniqueness/concurrency, authority/no-leak, version
cross-conflicts, replay/mismatch, lifecycle/policy, safe effects, rollback,
Registry non-change and Portal parser compatibility. Portal rendering/editor,
Registry search, integrations, Owner, Queue, booking and clinical scopes are
excluded.

Next only: `V50-CLINIC-04I / Clinic Patient Structured Administrative Reference
Portal Integration`. Do not add Registry search there.
