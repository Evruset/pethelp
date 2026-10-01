# Wave 2 appointment lifecycle evidence

Status: `READY_FOR_HUMAN_REVIEW`

Date: 2026-10-01

Base: `66e0e52` (accepted Wave 1)

Implementation head before this evidence commit: `2cae4e8`

## Authority and compatibility

- After confirmation, Appointment is the business-agreement authority. Booking Hold remains the compatible correlation/public-status projection.
- Alternative proposals are separate resources. A clinic proposal cannot rewrite a confirmed Appointment; only authenticated Owner acceptance performs the atomic move.
- The five-value public `BookingStatus` remains unchanged. `appointmentLifecycle` and cancellation/proposal metadata are additive.
- Both `MVP_V1_MANUAL` and `V15_AUTO_CONFIRM` converge on the same confirmed Appointment lifecycle and Owner cancellation implementation.

## Implemented business rules

- BP-07: Owner cancellation stores database time, actor, reason and immutable `lateCancellation`; equality at `startAt - 2h` is late. No penalty, fee, counter or suspension exists.
- BP-08: clinic cancellation requires a bounded reason, exact clinic/location authority, audit and outbox; Owner readback exposes `CANCELLED_BY_CLINIC` and the command returns `SELECT_ALTERNATIVE`.
- BP-09: clinic proposes a compatible target while the original appointment remains authoritative. Owner accept atomically switches capacity and relationship; reject preserves the original.
- BP-10: the existing availability/catalog boundary supplies choices. No replacement is auto-confirmed and no recommendation engine was added.
- Minimum No_Show foundation: authorized clinic staff only, eligible server-time/state only, with actor/time, audit, outbox and idempotency.

## API, database and events

New clinic commands:

- `POST /v1/clinic/:clinicId/locations/:locationId/appointments/:appointmentId/cancel`
- `POST /v1/clinic/:clinicId/locations/:locationId/appointments/:appointmentId/reschedule-proposals`
- `POST /v1/clinic/:clinicId/locations/:locationId/appointments/:appointmentId/no-show`

Existing Owner cancellation and alternative accept/reject routes are reused. Owner appointment detail adds lifecycle readback. Generated OpenAPI is the machine contract.

Migrations `171966`, `171967` and `171968` add lifecycle metadata, the Appointment relation on proposals, lifecycle defaulting and a target-slot version fence. Historical values are populated only where truthful; unknown history remains null. Migration `171968` is an intentional down-migration barrier because removing the version fence would make active proposal acceptance unsafe.

Canonical event meanings are represented through the existing appointment-event, audit and outbox architecture: Owner/clinic cancellation, proposal created/accepted/rejected/expired, and no-show. Provider delivery is outside the transaction and outside Wave 2.

## Verification

- Minimal Wave 1 regression: PASS `10/10`.
- Focused lifecycle, legacy-alternative, Owner-cancellation, migration and real PostgreSQL matrix: PASS `38/38`.
- Post-review lifecycle and real Nest regression: PASS `17/17`.
- Final real Nest runtime including both contract-profile cancellation paths: PASS `6/6`.
- Fresh-database and upgraded-database migration acceptance: PASS `2/2`.
- Real PostgreSQL races cover final capacity, cancel-vs-accept, accept-vs-expiry and idempotent retry; exactly one authoritative outcome is retained.
- TypeScript build: PASS.
- OpenAPI export and assertion: PASS.
- Security review: PASS, no residual finding.
- Independent review after `2cae4e8`: PASS, no residual veto.

## Commit evidence

- `8cdcd4e` authority audit
- `7293b95` Owner cancellation classification
- `4a33aea` clinic lifecycle and consented reschedule
- `889d297` lifecycle readback/OpenAPI
- `8100a59`, `9096628`, `c034a8a` runtime, concurrency and migration acceptance
- `baa01eb`, `d5f64ff` review remediations
- `f21ef66` final-capacity proposal race
- `2cae4e8` manual/automatic profile runtime convergence

## Rollback and deferred scope

Application rollback is deployment rollback while retaining additive columns. Data rollback must not remove lifecycle facts or the proposal target-version fence. No applied migration is rewritten. Unknown late-cancellation consequences, VisitConfirmed, B2B billing, BP-20/BP-21 full clinic lifecycle, external notification providers and Wave 3 Clinical Result reconciliation remain deferred.

Jira and Confluence were not mutated. Wave 3 was not started.
