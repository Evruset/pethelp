# MVP Core Target Waves

This dependency sequence is not implementation authorization. Complexity reflects state machines, authorization, migration, concurrency, UI and external dependencies.

| Wave | User outcome | Exact scope | Reuse candidates | Backend delta | RN delta | Portal/Ops delta | DB delta | Tests | Dependencies | Risk | Complexity |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A — Contract Freeze | Unambiguous Pilot contract | `MANUAL_CONFIRM`, 15-minute authoritative deadline, specialty/change/OCR invariants, containment | Contract tests/scope resolver | DTO/event/flag design | Journey map | Role boundary | Designs only | Contract/compatibility | None | Historical conflicts | M |
| B — Booking Semantics | Published slot yields `PENDING_CONFIRMATION` | Pilot create/status/expiry, routine Queue decision, active-slot invariant design | Locks, counters, idempotency, pending/confirmed branches, audit/outbox | Preserve Pilot pending transaction | Status/history | Journal and SLA actions | Additive invariant if approved | PG contention, expiry, rollback, vertical | A | Capacity/compatibility | L |
| C — Shift Inventory | Clinics publish real doctor/service inventory | Specialty joins, doctors, 3-hour shifts, variable slots, block/publish, manual appointment | Schedule/slots/services/blackout/Portal | Generation/validation | Consume availability | Shift/publish/manual booking | Relations/shift metadata | Overlap/timezone/auth | A/B contract | Migration/inventory | XL |
| D — Discovery | Owner searches across clinics | Map, specialty/date/geo ranking, clinic detail, full Pet Profile | Catalog/geo/RN journeys/pet entity | Search projection | Map/specialist/profile | Catalog admin | Search indexes/relations | Ranking/isolation/routes | C | Relevance/geo privacy | XL |
| E — Changes/Ops | Callback request without losing booking | BookingChangeRequest, tasks/SLA, owner read, operator outcomes | Roles, audit/outbox, booking projection | New aggregate/state machine | Request/status/history | Operations workspace | Request/task tables | State/concurrency/privacy | B | Operational process | XL |
| F — Reallocation | Owner chooses safe replacement | Cross-clinic search/policy, offer, Booking B, cancel A, lineage | Catalog, alternative reservations/UI, Booking Core | Reallocation orchestration | Offer decisions | Operator controls | Offers/policy/lineage | Cross-clinic races/rollback | C/D/E | Cross-aggregate concurrency | XL |
| G — Visit/Diary | Result appears in longitudinal Diary | Visit/Result/no-show, files, DiaryEntry/provenance, bounded context, notification | Visit UI, document metadata, patient access, audit/outbox | Result/Diary domains | Diary/archive/files | Complete/no-show/result | Result/Diary/link tables | Auth/provenance/files | B/C | Sensitive medical data | XL |
| H — OCR (DEFERRED) | Post-MVP Owner confirmation | No active MVP delivery; contain legacy worker now, later design private upload/provider/quarantine/confirmation | Document metadata, leasing, audit/outbox | Containment only in MVP | None | None | No active OCR schema | Containment checks | Product reactivation after Pilot | Legacy worker exposure | XL |
| I — Attribution | QR/link acquisition measured | Attribution through session/booking; minimal analytics | Correlation/observability | Capture/projection | Deep links | Authorized reporting | Attribution rows | Tamper/dedup/privacy | B/D | Consent/fraud | M |
| J — Hardening | Safe 20-clinic Pilot | Five-layer containment, secrets, SLOs, restore/load/security/a11y, rollout | Profiles, metrics, authority/concurrency harnesses | Close ops gaps | Real-device candidate | End-to-end | Approved indexes/retention | Focused then release gates | A-G and I; OCR product excluded | Go-Live/personal data | XL |

## Recommended first implementation slice

After explicit acceptance, start **Wave A/B1 — Pilot Manual-Confirmation Contract Closure**:

- freeze public `PENDING_CONFIRMATION → CONFIRMED | REJECTED | EXPIRED` and 15-minute deadline contracts;
- reuse the existing atomic confirmed branch for published `PILOT_V1` inventory;
- retain hold as an internal concurrency/idempotency detail;
- preserve `MANUAL_CONFIRM` as the first-Pilot default and keep any automatic mode disabled unless a newer Product decision approves it;
- add transaction, contention, rollback, history and Owner/Clinic projection evidence;
- design, but do not silently apply, the active-booking-per-slot database invariant.

Exact next `/goal`:

`/goal VetHelp — Wave A/B1: Freeze the Pilot MANUAL_CONFIRM contract and authoritative 15-minute deadline; reconcile PILOT_V1 create, Queue confirm/reject, expiry, Owner readback, capacity release and idempotency/concurrency evidence onto the existing Booking Core; do not implement BookingChangeRequest, reallocation, schedule migrations, Diary/OCR, payments, MIS, or unrelated UI.`
