# Wave 5B2 — Operations BookingChangeRequest workspace

Status: `IMPLEMENTED / MACHINE-VERIFIED`

## Boundary

The existing Operations roles `SUPPORT_L1`, `SUPPORT_L2`, and `PLATFORM_ADMIN` receive the narrow platform capabilities `booking.change-request.read` and `booking.change-request.process`. `SECURITY_AUDITOR`, clinic roles, and Owner do not receive them. Location is an optional queue filter, not an authority claim for this platform queue.

The actionable queue contains only `OPEN` and `PROCESSING` by default, is bounded to 50 items, and is ordered by `created_at ASC, id ASC`. Detail exposes request, Booking/Appointment identifiers, clinic/location identifiers, server time, and current Booking/Appointment status. It excludes Owner contact and pet/clinical data.

## Commands

- `OPEN -> PROCESSING`
- `PROCESSING -> COMPLETED | REJECTED`
- `OPEN | PROCESSING -> CANCELLED`

Every command requires a UUID `Idempotency-Key` and positive `If-Match` version. Row locking plus version fencing prevents silent concurrent claims. Success returns the authoritative detail and records audit/outbox evidence.

The command changes only `booking_schema.booking_change_requests`. It never changes BookingHold, Appointment, slot counters, capacity, or DoctorShift inventory. Those Booking mutations remain Wave 5C.

## Portal

The production surface is the existing Next.js Clinic Portal at `/ops/change-requests`, using the existing HttpOnly session, effective-session capability gate, and BFF pattern. Clinic V50 Behavioral Dense is the design/interaction authority: compact full-width task table, action-first status, desktop split detail, smaller-screen full detail, and minimum 44 px action targets. Loading, empty, retry/error, forbidden/read-only, and stale/conflict refresh states are explicit.
