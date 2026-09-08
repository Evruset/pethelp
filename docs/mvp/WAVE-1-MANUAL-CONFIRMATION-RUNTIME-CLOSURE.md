# Wave 1 — Manual Confirmation 15-Minute Runtime Closure

Status: `IMPLEMENTED / MACHINE_COMPLETE`  
Scope profile: explicit `PILOT_V1`  
Scope: Booking Core, Owner Mobile (`apps/owner-app`) and the existing Clinic Portal Queue only.

## Canonical contract

The persisted deadline is `booking_schema.booking_holds.confirmation_sla_expires_at`. Pilot creation writes it from PostgreSQL as `clock_timestamp() + interval '15 minutes'`. PostgreSQL time remains the mutation authority; Owner Mobile and Clinic Portal use server-calibrated clocks only for presentation. No duplicate deadline field or migration was introduced.

Public flow: `AVAILABLE → MANUAL_CONFIRM_PENDING / PENDING_CONFIRMATION → CONFIRMED | REJECTED | EXPIRED`.

`CANCELLED` remains unchanged and outside this Wave. Payment and MIS are absent from the Pilot create/decision path.

## Runtime paths and effects

| Path | Authoritative behavior | Capacity / appointment | Audit / outbox |
|---|---|---|---|
| Owner create | Atomic slot lock and payload-bound idempotency create a manual pending hold with version and 15-minute deadline | `held_count + 1`; no appointment | one create fact set |
| Clinic confirm | Exact clinic/location membership, `BOOKING_DECISION`, current `If-Match`, pending state and DB deadline are checked under transaction locks | held capacity converts once to booked; one appointment | one confirmed audit/event family |
| Clinic reject | Same authority/version/deadline fencing; bounded decline reason contract | held capacity releases once; no appointment | one declined/released fact family |
| Expiry | Worker claims overdue pending rows using PostgreSQL time and replica-safe locking | held capacity releases once; no appointment | one expired audit/event family |
| Owner readback | Maps only authoritative persisted state to public status | read-only | none |

Confirm and reject preserve `confirmation_sla_expires_at` after terminal transition so the public deadline retains one stable semantic. At/after the deadline both commands converge to controlled `422 HOLD_EXPIRED`; neither can resurrect a hold or create contradictory effects.

## Concurrency, retry and containment

Real PostgreSQL tests race confirm versus expiry and reject versus expiry. Allowed final states are respectively `CONFIRMED | EXPIRED` and `RELEASED/REJECTED | EXPIRED`; assertions require one terminal effect family, one audit family, exact counters, appointment cardinality and authoritative Owner readback. A rejected race participant must be a controlled `DomainException` with an allowlisted status/code; ordinary race losers may not surface an unexpected 5xx.

Same-key/same-payload confirm and reject replay one logical result. Changed payload under a reused key remains an idempotency conflict. Stale versions return the canonical booking-state conflict. Foreign clinic/location/Owner authority is denied before mutation. The Wave 1 PostgreSQL suite fails fast unless `MVP_SCOPE_PROFILE=PILOT_V1`, preventing accidental Legacy evidence.

## Owner Mobile

`BookingStatusScreen` renders backend-authoritative `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED` and `EXPIRED` states with Product copy. Pending shows the exact deadline and a server-calibrated countdown. Countdown zero requests an authoritative refresh and shows a bounded checking state; it never creates `EXPIRED` locally. Polling covers the entire 15-minute window. Network, malformed payload and session-loss states fail closed. The create receipt remains reopenable even when secure persistence fails. No payment CTA is present.

## Clinic Portal Queue

The existing `ClinicQueueClientV2` remains the single worklist. It displays authoritative deadline/server time, deterministic FIFO position and presentation-only SLA bands: normal `>5m`, warning `≤5m`, critical `≤3m`, urgent `≤1m`, expired `≤0`. Expired rows are non-actionable and do not block the next live FIFO row. Confirm/reject use version fencing and backend authority. Ambiguous failures fence the row; only a validated refreshed pending snapshot restores it. Missing or malformed deadlines render explicit non-actionable SLA semantics without crashing. The reject dialog revalidates row/version/FIFO/deadline/connection state and preserves keyboard focus containment.

## Visual and accessibility evidence

Owner evidence: `docs/testing/evidence/s14-owner-booking-decision/manifest.json`, explicitly labelled `RN_WEB_EVIDENCE_RENDERER`, contains pending, near-expiry, confirmed, rejected, expired, network and malformed/stale states at `390×844`, `430×932` and `768×1024`. The manifest binds current runtime, capture script and current V50 sources. It is not Owner Web or physical-device evidence.

Clinic evidence: `docs/testing/evidence/s14-clinic-booking-decision/` is regenerated from the production Portal build and controlled Queue API/session seams. Required Wave 1 cases cover normal, due-soon/critical/urgent, expired, confirm/readback, reject/readback and stale/degraded states at `390×844`, `768×1024`, `1024×768` and `1440×900`.

Focused accessibility assertions cover keyboard operation, visible focus, reject-dialog trap/restore, semantic SLA text independent of color, bounded live status, reduced-motion-safe urgency, 44px-class actions, 200% root text and 390px page containment.

Final machine evidence: real PostgreSQL Booking Core/Queue `17/17 PASS`; Wave-scoped HTTP authority `52 PASS / 10 explicitly skipped alternative-proposal cases`; expiry service `5/5 PASS`; Owner booking module `63/63 PASS`; Clinic Queue Chromium `31/31 PASS`; Owner visual package `7/7 VERIFIED`; Clinic visual package `8/8 VERIFIED`; backend and Clinic production builds, Owner typecheck/lint and `git diff --check` PASS. Independent Backend, Owner Mobile and Clinic Portal reviews are `PASS / NO RESIDUAL VETO`. No human approval is inferred.

## Active-slot database invariant decision

`ACTIVE_SLOT_DB_INVARIANT_NOT_NEEDED_NOW`.

For the current Pilot, the canonical slot row is locked and `held_count + booked_count < capacity` is checked and mutated in the same transaction. This sufficiently protects single-capacity and bounded multi-capacity slots. A unique active-booking-per-slot index would incorrectly prohibit legitimate `capacity > 1` and would not model future DoctorShift capacity units or reallocation lineage. A future design should introduce explicit capacity-unit identity (or an exclusion/partial uniqueness rule keyed by capacity unit), then assess online index creation, lock duration, dirty-data validation and rollback. No migration is justified or authorized in Wave 1.

## Rollback and residual boundaries

Code rollback is limited to the Wave 1 component/service/test changes: restore the previous Owner polling/status presentation, Queue SLA/fencing/dialog presentation and terminal deadline clearing behavior. No schema rollback exists because `MIGRATION_CHANGED=NO`. Do not roll back the pre-existing manual-confirmation transaction, idempotency store, audit/outbox or Queue route independently; those are shared mature contracts.

Not implemented: Owner Web, Operations, BookingChangeRequest, Smart Reallocation, DoctorShift, Diary/Result/OCR, payment, mandatory MIS or the 104-state Booking Journal.

## Next Wave

After machine and required human gates accept this package, the exact next bounded goal is `WAVE 2 — OWNER WEB FOUNDATION`: create a dedicated V50-derived Owner Web application for QR/deep-link landing, OTP/session, pet selection, discovery/service/availability, booking request and the same authoritative pending/terminal contracts. Do not count RN Web evidence as that application and do not start Wave 2 automatically.
