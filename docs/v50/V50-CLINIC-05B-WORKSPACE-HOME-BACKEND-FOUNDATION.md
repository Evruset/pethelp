# V50-CLINIC-05B — Clinic Workspace Home Backend Foundation

Status: `BACKEND_FOUNDATION_IMPLEMENTED / TESTED`. Production rollout: `NOT_STARTED`.

The backend exposes `GET /v1/clinic/:clinicId/locations/:locationId/workspace-home` as one live, read-only, repeatable-read snapshot. One database statement validates the authenticated employee's active, non-revoked exact clinic/location membership and returns PostgreSQL time and clinic timezone. Capabilities then control section visibility without repeated membership evaluation.

The fixed response order is Queue, Schedule, Appointments, Veterinarian and Quality. Queue and Appointments use one aggregate statement each and saturate counts at 999. Schedule, Veterinarian and Quality execute no operational SQL and return `NOT_CONFIGURED` when authorized; all missing capabilities return no-facts `NOT_AUTHORIZED`. Only statement timeout and lock-not-available errors inside the two operational savepoints degrade that section to `TEMPORARILY_UNAVAILABLE`; authority and unknown failures fail the request.

The DTO excludes patient, owner, hold, appointment, doctor, employee, clinical, document, payment and audit identifiers/data. Telemetry has bounded outcome, role-class, section-state and duration fields only. Responses use `Cache-Control: private, no-store`, omit ETag, and remain below 8 KiB.

Deterministic PostgreSQL 16 evidence at 10k exact-scope rows used 30 warm HTTP reads and three JSON EXPLAIN runs per operational query: p50 67.482 ms, p95 72.589 ms, p99 82.934 ms, response 1,048 bytes, one measured authority query plus two measured operational queries, cardinality one, zero large-table sequential scans, zero spill/temp blocks, zero cross-scope leakage and cleanup `0|0|0|0`. Existing scoped indexes were sufficient; no migration or planner override was added.

Portal/BFF/UI, feature flags and visual verification are not part of 05B. The only next slice is `V50-CLINIC-05C / Clinic Workspace Home Portal BFF and Page`; Schedule/Quality authority debts remain separate.
