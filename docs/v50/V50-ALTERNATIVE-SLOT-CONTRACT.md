# V50 Alternative Slot Contract

## Decision

The canonical source row is `OWN-020 #alternative-slot`; `OWN-008` supplies the
booking-detail entry point. The existing alternative swap group is retained.

Capacity policy is B: the clinic proposal transaction holds both the original
and proposed slot for a server-authored 15-minute TTL. Accept releases the
original counter and keeps the proposed counter attached to the booking.
Decline/expiry release both exactly once. The UI may describe the proposed time
as temporarily reserved only while the authoritative proposal is pending.

Accept and decline are distinct, owner-scoped, version-fenced, payload-bound
idempotent commands. Their transaction locks the hold/swap/slots in stable
order, validates the DB deadline and state, changes one outcome, writes one
audit and versioned outbox effect, and commits before any external dispatch.

Flutter never claims acceptance from the POST response alone: it rereads the
authoritative booking/proposal. Returning to availability is a typed navigation
intent and creates no hold or backend transition by itself.

## Canonical API and rollout

- `GET /v1/owner/bookings/:bookingId/alternative`
- `POST /v1/owner/bookings/:bookingId/alternative/:proposalId/accept`
- `POST /v1/owner/bookings/:bookingId/alternative/:proposalId/decline`

Commands require UUID `Idempotency-Key`, UUID `X-Correlation-ID` and aggregate
`If-Match`. The default-off `OWNER_V50_ALTERNATIVE_RESOLUTION` flag depends on
the V50 shell, My Bookings and Detail flags. Disabling it restores the legacy
route without data or migration rollback.
