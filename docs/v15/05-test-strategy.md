# PetHelp v1.5 Wave 1 test strategy

Mocks may support unit tests but cannot close database, concurrency, migration or runtime acceptance.

## Static and contract

- TypeScript build and targeted lint/type checks.
- Migration checksum/framework validation.
- Generated OpenAPI assertion for headers, request/response schema, exact `409` codes and error envelope. Before an approved compatibility decision, PILOT create must retain `BOOKING_STATE_CONFLICT` for stale version and must not expose `SLOT_VERSION_STALE` as its alias.
- `git diff --check`.

## Unit

- `MVP_V1_MANUAL` resolves to `MANUAL_REQUEST`.
- `V15_AUTO_CONFIRM` resolves to `AUTO_CONFIRM_PUBLISHED_SLOT`.
- Missing/unknown/inactive clinic policy fails closed.
- Runtime capability profile does not select confirmation mode.
- API projection maps authoritative internal state consistently.

## Real PostgreSQL integration

- Manual clinic: booking creates `MANUAL_CONFIRM_PENDING`; clinic confirm creates one appointment.
- v1.5 clinic: booking finishes `CONFIRMED` with one appointment, audit and outbox record.
- Capacity 1, two owners concurrently: exactly one confirmed booking and one controlled conflict.
- Same idempotency key and payload: one logical booking and stable replay.
- Same key, different payload: deterministic conflict.
- Stale expected slot version: controlled conflict with no effects.
- Route/error compatibility: assert the approved create route and exact profile-specific code; never treat a generic `409` as sufficient evidence.
- Injected failure after intermediate mutation: no appointment, orphan hold, counter drift or false-success outbox.
- Policy rollback affects new attempts only; existing confirmed appointment remains confirmed.
- Foreign owner and cross-clinic/location access produce normalized no-leak denial.
- Inactive and every currently represented suspended/terminated clinic state rejects booking after availability read and produces no booking effects. If the schema has no authoritative representation, Wave 1 records an unresolved dependency instead of simulating the state.

## Migration

- Fresh database: all migrations including contract profile apply successfully.
- Upgrade fixture: current schema/data upgrades with every existing clinic defaulted to manual behavior.
- Down/recovery strategy restores code compatibility without rewriting existing booking history.

## Runtime acceptance

- Start the real Nest application against PostgreSQL.
- Execute both contract profiles in one runtime.
- Read back authoritative owner status and clinic queue behavior.
- Confirm v1.5 bookings do not require or appear in manual confirmation queue.
- Confirm correlation ID, safe telemetry, audit and outbox evidence.

## Review gates

- QA: acceptance matrix and regression evidence.
- DB/concurrency: locks, counters, rollback and migration review.
- Security: actor/scope/policy authority and no-leak review.
- Independent review: attempt to veto compatibility, race safety or sufficiency of evidence.
