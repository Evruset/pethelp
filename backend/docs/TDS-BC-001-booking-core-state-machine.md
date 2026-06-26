# TDS-BC-001: Booking Core State Machine

Status: v2.0 target contract, partially implemented.

## Scope

Booking Core owns the local booking hold aggregate, appointment materialization, slot counters, idempotency records, durable outbox events, and audit log records. External MIS, acquiring, telemedicine, and clinic portal actions interact with Booking Core only through commands, workers, and outbox events.

The API owner id is always derived from the authenticated JWT. Clients cannot choose booking state, payment state, MIS state, TTL, clinic scope, or aggregate version.

## Aggregate States

`booking_schema.booking_holds.state` is the source of truth.

| State | Meaning | Terminal |
| --- | --- | --- |
| `MANUAL_CONFIRM_PENDING` | Level C clinic must confirm manually before payment. | No |
| `ALTERNATIVE_PENDING` | Clinic proposed another slot; owner must accept before continuing. | No |
| `MIS_RESERVATION_PENDING` | Level A/B reservation command is durably queued. | No |
| `MIS_RECONCILIATION_PENDING` | MIS reservation result is ambiguous and must be reconciled by worker. | No |
| `MIS_HELD` | External MIS slot is held and payment may be started. | No |
| `PAYMENT_PENDING` | Local payment intent can be created. | No |
| `PAYMENT_IN_PROGRESS` | Acquiring command is in flight. | No |
| `PAYMENT_RECONCILIATION_PENDING` | Payment provider result is ambiguous and must be reconciled. | No |
| `CONFIRMED` | Appointment is confirmed and slot booked. | Yes for create-hold duplicates |
| `EXPIRED` | Hold TTL or SLA expired. | Yes |
| `RELEASED` | Hold was released by owner/system. | Yes |
| `SLA_BREACHED` | Clinic manual confirmation SLA was missed. | Yes |
| `MIS_BOOKING_FAILED` | External MIS booking failed after reservation path. | Yes |

Active duplicate detection treats every non-terminal in-flight state plus `CONFIRMED` as active for the same owner and slot while the hold is not expired by database time.

## Commands

| Command | Actor | Preconditions | Success transition | Required headers |
| --- | --- | --- | --- | --- |
| `CreateLocalHold` | Owner | owner owns pet; slot exists; slot is open and future; clinic and location are `ACTIVE`; capacity remains; no active owner hold on same slot | `MANUAL_CONFIRM_PENDING` for Level C, `MIS_RESERVATION_PENDING` for Level A/B | `Idempotency-Key`, `X-Correlation-ID` |
| `ConfirmManualHold` | Clinic employee | employee has active location membership; hold is `MANUAL_CONFIRM_PENDING`; TTL valid; queue FIFO is respected | `CONFIRMED` and appointment row is created | `Idempotency-Key`, `If-Match` target, `X-Correlation-ID` |
| `ProposeAlternativeSlot` | Clinic employee | employee scoped to source location; hold is manual/alternative pending; new slot belongs to same location and is available | `ALTERNATIVE_PENDING` | `Idempotency-Key`, `If-Match` target, `X-Correlation-ID` |
| `AcceptAlternativeSlot` | Owner | owner owns hold; alternative is pending and not expired; source and alternative counters are valid | `MIS_HELD`/next payment-ready state | `Idempotency-Key`, `If-Match` target, `X-Correlation-ID` |
| `CreatePaymentIntent` | Owner | owner owns hold; hold is payment-ready; no stale payment intent fence | payment intent created, hold remains fenced | `Idempotency-Key`, `X-Correlation-ID` |
| `ReleaseHold` | Owner/system | actor owns hold or is system worker; hold can transition to released; TTL rules are checked using DB time | `RELEASED` | `Idempotency-Key`, `X-Correlation-ID` |
| Worker transitions | System worker | event lease is owned; aggregate version matches event fence; external result is authenticated or reconciled | command-specific next state | worker service token/correlation from event |

## CreateLocalHold Invariants

The command runs in one database transaction with the lock order `pet -> idempotency -> slot -> hold insert -> slot counter -> outbox/audit`. It uses `SET LOCAL lock_timeout = '50ms'` and `SET LOCAL statement_timeout = '250ms'`.

Required guards:

| Guard | Error |
| --- | --- |
| missing or invalid `Idempotency-Key` | `400 INVALID_REQUEST` |
| missing or invalid `X-Correlation-ID` | `400 INVALID_REQUEST` |
| pet missing or not owned by JWT owner | `422 PET_OWNERSHIP_MISMATCH` |
| slot missing | `404 SLOT_NOT_FOUND` |
| slot lock timeout or statement timeout | `409 SLOT_LOCKED_RETRY` with `Retry-After: 1` |
| duplicate active owner hold on same slot | `422 HOLD_ALREADY_ACTIVE` |
| slot is closed, cancelled, past, or clinic/location is not active/public | `422 SLOT_UNAVAILABLE` |
| slot was concurrently consumed or capacity is gone | `409 SLOT_ALREADY_TAKEN` |
| stale caller aggregate/slot version where version is accepted | `409 SLOT_VERSION_STALE` |
| unexpected storage failure | `503 BOOKING_TEMPORARILY_UNAVAILABLE` |

Hold TTL and SLA timestamps must be computed by database clock only (`clock_timestamp()`), never by client input or application wall clock.

## Idempotency

Every command has a stable idempotency scope:

- owner commands: `command-name:{ownerId}`;
- clinic commands: `command-name:{employeeId}` or stricter clinic/location scope where applicable;
- worker commands: event id or aggregate/event type fence.

`booking_schema.idempotency_records` stores `PROCESSING` and `COMPLETED` outcomes. A completed success is returned as originally persisted. A repeated in-flight command returns `425 IDEMPOTENCY_IN_PROGRESS`. Failed requests are not allowed to leak partial state; a transaction rollback removes incomplete idempotency rows.

## Event Contracts

Booking Core writes outbox events inside the same transaction as aggregate changes. External HTTP is never executed inside the booking transaction.

Current required booking events:

| Event | Aggregate | Payload requirements | Consumer |
| --- | --- | --- | --- |
| `booking.hold.created.v1` | `booking_hold` | hold id, slot id, owner id, pet id, state, integration mode, expiry, SLA expiry | audit/read models/workers |
| `mis.reservation.requested.v1` | `booking_hold` | hold id, slot id, clinic id, external patient id, correlation id | MIS command dispatcher |
| `telemed.session.start.requested.v1` | `booking_hold` | hold id/payment context/correlation id | telemedicine worker |
| payment events | `payment_intent` | provider id, amount, currency, fence version, correlation id | acquiring relay/reconciliation |

Every event has `correlation_id`, `aggregate_id`, `aggregate_version`, a deterministic `deduplication_key`, and relay-owned status/lease fields. Consumers must be idempotent.

## Fencing and Retry Ownership

Booking aggregate `version` is the optimistic fence for clinic/manual commands and worker commits. External systems are fenced with provider ids, internal hold ids, event ids, and idempotency keys.

Retry ownership:

| Failure class | Retried by | Client behavior |
| --- | --- | --- |
| `SLOT_LOCKED_RETRY` | client after `Retry-After` | retry same command and same idempotency key |
| `IDEMPOTENCY_IN_PROGRESS` | client polling/retry | retry same command and same idempotency key |
| MIS/network ambiguity | MIS reconciliation worker | do not retry external HTTP from request path |
| acquiring ambiguity | payment reconciliation worker | do not create a second payment intent |
| outbox publish failure | outbox relay | request path remains complete after durable event write |
| SLA/TTL expiry | workers using DB clock | client refreshes hold state |

## Concurrency Matrix

| Race | Required behavior |
| --- | --- |
| two owners create hold on same capacity-1 slot | one succeeds; the other returns `SLOT_LOCKED_RETRY` or `SLOT_ALREADY_TAKEN` |
| same owner creates hold twice on same slot with different idempotency keys | first succeeds; second returns `HOLD_ALREADY_ACTIVE` |
| same owner retries same idempotency key | returns original completed result |
| create hold while slot is being booked by payment commit | slot row lock serializes; losing command returns retry/taken |
| manual confirm while owner release runs | hold and slot locks serialize; stale transition returns `INVALID_STATE_TRANSITION` |
| alternative accept while original TTL worker expires hold | hold lock serializes; DB time decides expiry |
| MIS reservation result races with release/expiry | aggregate version fence decides; worker reconciles ambiguity |
| payment webhook races with reconciliation poll | provider event/idempotency fences dedupe; one commit wins |

## Feature Gates

Level C is manual-confirmation first. Level A/B require MIS patient mapping before hold creation and must enter the MIS saga through outbox. Payment, telemedicine, emergency, insurance, and other verticals may consume Booking Core state, but they do not mutate slot counters except through owned commands or fenced workers.
