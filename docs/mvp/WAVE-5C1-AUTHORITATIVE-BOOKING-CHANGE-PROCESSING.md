# Wave 5C1 — Authoritative Booking change processing

Status: `IMPLEMENTED / MACHINE-VERIFIED`

## Corrective migration

Migration `1719570000000_make_booking_change_request_context_fks_deferrable` replaces only `booking_change_requests_hold_owner_slot_fkey` and `booking_change_requests_appointment_context_fkey`. Their columns, referenced relations and columns, match behavior, and update/delete semantics remain unchanged; both become `DEFERRABLE INITIALLY IMMEDIATE`. DOWN restores the exact non-deferrable relationships. No business row is rewritten.

RESCHEDULE explicitly defers only these two schema-qualified constraints. All other constraints remain immediate.

## Authoritative processing

`COMPLETE` is no longer a request-only status change:

- CANCEL locks the request, BookingHold, Appointment, and source slot; cancels the Appointment, releases booked capacity once, releases the BookingHold, then completes the request.
- RESCHEDULE requires a server-projected replacement slot identity and version. The backend revalidates same location, service, staff/resource identity, publication, future time, availability, and version under row locks. It releases old booked capacity, consumes new booked capacity, moves BookingHold and Appointment, updates the request context, then completes the request in one transaction.

Failures roll back idempotency, capacity, identities, request status, audit, and outbox together. Successful commands append Booking and BookingChangeRequest audit/outbox evidence. No external HTTP call occurs inside the transaction.

## Operations integration

The existing V50 Operations detail exposes at most 25 authoritative eligible replacement slots for a PROCESSING RESCHEDULE request. The operator must select one before applying the change. The backend remains authoritative and rejects stale, unpublished, consumed, expired, cross-location, service-incompatible, or resource-incompatible selections.
