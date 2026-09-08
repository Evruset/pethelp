# Wave 5-A — BookingChangeRequest foundation contract

## Scope

Wave 5-A introduces one canonical `BookingChangeRequest` aggregate for Owner
`CANCEL` and `RESCHEDULE` requests. It is a request record only: creating or
reading it does not update the bound Booking hold, Appointment, slot counters,
DoctorShift inventory, or capacity.

## Persisted invariant

- Status is exactly `OPEN`, `PROCESSING`, `COMPLETED`, `REJECTED`, or
  `CANCELLED`.
- `OPEN` and `PROCESSING` have no `terminal_at`; terminal statuses require a
  PostgreSQL timestamp at or after creation.
- Composite foreign keys bind every request to the exact hold/owner/slot,
  slot/location, location/clinic, and optional Appointment context.
- A partial unique index permits at most one `OPEN` or `PROCESSING` request per
  booking hold. A new request is allowed after the prior request is terminal.
- Owner/type/idempotency identity is durable and the shared idempotency ledger
  provides exact replay or conflict behavior. A processing command returns the
  project-standard `425 IDEMPOTENCY_IN_PROGRESS`. If an exceptional rollback
  removed the aggregate but retained its completed ledger row, replay fails
  closed with `IDEMPOTENCY_REPLAY_ORPHANED` instead of returning a phantom 201.
- PostgreSQL `clock_timestamp()` is authoritative for persisted and observed
  timestamps.

## HTTP boundary

- `POST /v1/owner/bookings/{holdId}/change-requests` creates either request
  type for the owning user and requires `Idempotency-Key`.
- `GET /v1/owner/bookings/{holdId}/change-requests/current` returns the active
  request first, otherwise the latest request, without cross-owner disclosure.
- `GET /v1/operations/booking-change-requests` is restricted to Support L1,
  Support L2, and Platform Admin, defaults to active work, and is bounded to 50
  items. Its projection excludes owner, pet, contact, financial, correlation,
  and audit payload data.

Creation is allowed only for a confirmed hold with its confirmed Appointment.
The existing direct cancellation endpoint remains unchanged and separate.

## Evidence and rollback

Opening a request appends `booking_change_request.opened` audit evidence and a
`booking.change-request.opened.v1` outbox event. Those historical records have
no foreign key to the aggregate and survive migration rollback.

Migration `1719560000000_add_booking_change_requests.js` is additive. `DOWN`
drops only the new table and the composite uniqueness constraints introduced to
support its exact-context foreign keys; it does not delete audit or outbox
history. Automated evidence covers populated upgrade, `UP → DOWN → UP`, check
constraints, foreign keys, active uniqueness, replay/conflict, role isolation,
processing/orphaned replay behavior, safe projections, and no booking/inventory
mutation.
