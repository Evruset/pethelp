# MVP Core Architecture Verdict

Fresh baseline: `agent/v51-stage-01-architecture` at `e9b7b2fb8a9208fb76e0ba2003246a741f3a1c8b`, 2026-08-25. Evidence is in `MVP-CORE-IMPLEMENTATION-RECONCILIATION.md`.

| Question | Verdict | Justification |
|---|---|---|
| A. Can current modular architecture support the core? | YES_WITH_DELTA | PostgreSQL transactions, auth, audit and outbox are suitable; new change-request, reallocation, Result/Diary and OCR-confirmation ownership is needed. |
| B. Reuse Booking Core? | YES | Its locking, capacity, idempotency and atomic confirmed branch are the strongest reusable asset. Change Pilot selection/projection, not the primitive. |
| C. Keep manual confirmation? | YES / PILOT_DEFAULT | `MANUAL_CONFIRM` is the first-Pilot default with an authoritative 15-minute deadline and exact `CONFIRMED | REJECTED | EXPIRED` outcomes. |
| D. Separate BookingChangeRequest aggregate? | YES | Current cancel mutates capacity immediately and has no durable callback lifecycle preserving the booking. |
| E. Separate Reallocation domain/module? | YES | Cross-clinic search, policy, operator control, replacement transaction and lineage are absent. |
| F. Is current Pet model sufficient? | YES_WITH_DELTA | It stores most profile fields but Pilot exposure/taxonomy are incomplete; it must not become the Diary aggregate. |
| G. New DiaryEntry model? | YES | Current diary is a legacy SQL projection with no persistent provenance or target taxonomy. |
| H. Is schedule sufficient for DoctorShift? | NO | Generic periods/manual slots do not prove typed 3-hour shifts, variable-duration generation and publishing. |
| I. Is specialty/service sufficient for specialist-first? | NO | Shallow specialty ids do not implement target relations or cross-clinic ranked search. |
| J. Dedicated Operations/Call Center frontend? | YES | Callback ownership, SLA, outcomes and reallocation controls are distinct from Clinic Queue. |
| K. Which domains remain gated? | YES_WITH_DELTA | Payment/MIS/telemed/insurance/emergency/advanced legacy surfaces remain disabled; worker/secrets/health containment needs tightening. |
| L. Which implementation should not be touched? | YES | Preserve Booking transaction/locking, capabilities/tenant isolation, audit/outbox, catalog/schedule foundations and gated legacy compatibility. |

## Transformation invariants

1. Backend is the only booking authority; claim, booking, counters, audit and outbox are one transaction.
2. A published Pilot slot creates Owner-visible `PENDING_CONFIRMATION`; the Clinic Queue has 15 minutes of authoritative server/PostgreSQL time to confirm or reject, otherwise the request expires and releases capacity exactly once.
3. `MANUAL_CONFIRM` is the first-Pilot default. Published inventory may still require clinic confirmation; automatic approval is a future optional capability.
4. Cancel/reschedule creates BookingChangeRequest and leaves booking/capacity valid until resolution.
5. Reallocation creates Booking B and explicit lineage; it never mutates Booking A into another clinic.
6. Clinic Pet access derives from current booking/visit purpose and never grants global Diary access.
7. OCR extraction remains untrusted until explicit Owner confirmation; promotion is audited.
8. Pilot containment covers UI/nav, BFF, API/module, worker/provider, and secrets/health.

## Over-scope containment

| Capability | UI/nav | Route/BFF | Domain/API | Worker/provider | Secrets/health | Verdict |
|---|---|---|---|---|---|---|
| Payments/acquiring | Hidden | Pilot 404 | Module omitted | No-op | Alpha/local residue | REQUIRES_RUNTIME_CONTAINMENT |
| Mandatory MIS | Hidden | Pilot absent | Module omitted | No-op | Legacy config | KEEP_DISABLED |
| Telemedicine | Hidden | Representative 404 | Module omitted | No-op | Ops queries retain tables | KEEP_DISABLED |
| Insurance | Hidden | Representative 404 | Module omitted | No-op | Legacy config | KEEP_DISABLED |
| Emergency | Hidden | Representative 404 | Module omitted | None active | Legacy config | KEEP_DISABLED |
| Quality/replay/clinical legacy | Partly hidden | Portal filters | Compatibility APIs remain | N/A | N/A | REMOVE_FROM_PILOT_SURFACE; verify BFF |
| Legacy OCR | No Pilot upload | Pilot document routes absent | Worker still registered | Can process legacy rows | Only `WORKERS_ENABLED` | PARTIALLY_CONTAINED / TECHNICAL_CONTAINMENT_DEBT (P1 hardening); product delivery DEFERRED |

`MVP_SCOPE_PROFILE` defaults to `LEGACY_COMPAT` when absent. Deployment wrappers set Pilot explicitly, but the library default remains a fail-open configuration risk.

## Unresolved risks

- Later additive schema approval is required for specialty relations, BookingChangeRequest/tasks, lineage, Result/DiaryEntry and likely an active-booking-per-slot invariant.
- Production OTP/OCR, private storage and signed delivery require external provider decisions.
- Russian personal-data compliance needs focused legal/security review of region, retention, audit and processor contracts.
- Future implementation must reconcile the already-dirty booking/Owner worktree before editing overlapping files.
