# V50 Booking Hold and Server-Authoritative Status Contract

## ADR decision

Extend the canonical Booking Core endpoints `POST /v1/booking-holds` and
`GET /v1/booking-holds/:holdId`. PostgreSQL remains the only hold authority.
There is one write model, one transaction owner, and the existing durable
Transactional Outbox relay remains the only delivery owner.

Rejected alternatives are a second V50 endpoint, Redis-only holds, client-owned
expiry/confirmation, external MIS/payment calls while a slot is locked,
interactive `SKIP LOCKED`, and a second relay/retry loop.

## V50 rows and anchors

| Experience | V50 ID | Prototype anchor/state | Prototype route | Runtime route | Target | Backend |
|---|---|---|---|---|---|---|
| Create Hold ready/submitting/retry/conflict | `OWN-006` | `#booking-review`; review CTA and `v33-review-confirmation` | `booking-review` | `/owner/booking/review` | flagged V50 Review submit state | `POST /v1/booking-holds` then authoritative GET |
| Pending/failed/expired/confirmed status | `OWN-008` | `#appointment-detail`; base pending plus prototype states `slot-taken`, `clinic-cancel`, `confirmed` | `appointment-detail` | `/owner/bookings/:holdId` | flagged V50 Booking Status | `GET /v1/booking-holds/:holdId` |

The prototype does not provide separate stable DOM pages for each transport
state. Runtime evidence therefore binds each named state to the exact applicable
anchor and records the prototype-state class where present. No new V50 ID is
invented.

## Command contract

Authenticated `OWNER`; identity is JWT `sub`. Required headers are UUID
`Idempotency-Key` and UUID `X-Correlation-ID`. The typed body identifies pet,
slot, expected slot version, service, and nullable doctor where the canonical
slot model can validate that association. Client values never author owner,
clinic, price, hold TTL, counts, integration identifiers, or confirmation.

One short PostgreSQL transaction uses the same session for:

1. `SET LOCAL lock_timeout = '50ms'` and `statement_timeout = '250ms'`;
2. owner/pet validation and idempotency acquisition;
3. `appointment_slots ... FOR UPDATE`;
4. version, service/doctor, freshness, time, state and capacity validation;
5. hold insert and slot count/version update;
6. audit and versioned outbox insert;
7. idempotency completion and commit.

No network I/O occurs inside this boundary. `SKIP LOCKED` is reserved for the
batch expiration worker.

The command response is commit-confirmed but Flutter still performs GET
readback before presenting status. It includes `holdId`, state, DB-authored
`expiresAt`/`serverNow`, aggregate version, confirmation mode and next action.

## Idempotency and contention

Scope is owner plus canonical endpoint plus operation UUID. A normalized typed
payload fingerprint is stored with the record. Exact replay returns the same
logical result; a different fingerprint returns a controlled idempotency
conflict. Replays cannot increment counts or duplicate audit/outbox effects.

Lock contention is safe `409 SLOT_LOCKED_RETRY` with `Retry-After: 1` and no
database detail. Stale version, unavailable capacity and validation failures use
stable safe codes.

## Authoritative read

Owner lookup makes foreign and unknown hold indistinguishable as normalized
404. The allowlisted projection contains only owner-safe pet, clinic/location,
service, public doctor, slot time/timezone, state presentation, DB server time,
expiry, confirmation mode, next action, aggregate version and last update.
Internal counts, other-owner data, MIS/provider IDs, notes, retries, outbox and
payment internals are excluded.

State presentation is server-derived. Flutter never displays raw state names,
declares success from the request, or declares expiry from its countdown.

## Expiration and consistency

The worker uses PostgreSQL clock eligibility, locks eligible active holds in a
batch, transitions each exactly once, decrements `held_count` with a nonnegative
guard, writes audit/outbox atomically, and ignores terminal/confirmed holds.
Repeated processing is a no-op.

## Rollout, rollback, and observability

`OWNER_V50_CREATE_HOLD` depends on V50 Shell and Booking Review;
`OWNER_V50_BOOKING_STATUS` depends on V50 Shell and the owner-safe GET contract.
Both are default off. Disabling them restores the legacy UI without deleting or
rewriting holds, outbox rows, or migrations.

Operational signals are safe error-code rates, lock/statement timeouts,
hold-to-slot count reconciliation, expiration lag, outbox backlog and dedup
conflicts. Correlation IDs contain no PII.

## Architecture gate

Pre-implementation verdict: `FAIL` for the unmodified baseline because request
fingerprinting, complete validation, authoritative read projection, normalized
owner lookup and expiration coverage were missing. Integration remains vetoed
until the implementation and real-PostgreSQL proofs close these gaps.
