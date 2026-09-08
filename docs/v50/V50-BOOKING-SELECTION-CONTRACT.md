# V50 booking selection contract

Status: implemented behind default-off flags for `OWN-005` and `OWN-006`.

## Boundary

`GET /v1/clinic-locations/:locationId/booking-options` is a public, optionally
personalized read. It returns active clinic/location services and currently
selectable slots. It never creates a hold, locks capacity, books, pays, calls
MIS, or returns capacity/booked/held counts.

Optional filters are `serviceId`, `doctorId`, `selectedPetId`, `from`, `to`, and
`limit`. UUIDs, active public location/service, active veterinarian and time
range are validated server-side. A pet hint is applied only for an authenticated
owner whose active pet can be read through the owner-pet authority; otherwise
the response is the same non-personalized public projection. Species/service
compatibility is explicitly `NOT_EVALUATED` until an authoritative taxonomy
exists.

## Authority and allowlist

The clinic timezone, server clock, local date/time, slot version, source update,
freshness, confirmation mode and price reference are server-authored. Public
slot fields are ID, service ID, UTC interval, local date/time, timezone,
availability state, expected version, freshness, confirmation mode, source
update and price reference. Public service fields are ID/code/name/duration and
base-price disclosure. Internal provider/MIS fields and private counters are
excluded.

The client passes only `BookingSelectionContext`: pet, clinic, location,
service and optional doctor IDs; selected local date; slot ID/version;
confirmation mode; price snapshot/reference; and freshness. Authentication
restores this intent, then performs a fresh read with the selected owned pet.
No response DTO is retained as command authority.

## UX and rollback

Runtime routes are `/owner/booking` and `/owner/booking/review`. Back from Review
retains service/date/slot selection. Offline progression is disabled. Price copy
states “from”, possible additional costs, clinic agreement and payment at the
clinic. The effective rollout requires the V50 shell, Clinic Detail and all
three exact-true flags: `OWNER_V50_SERVICE_SELECTION`,
`OWNER_V50_SLOT_SELECTION`, `OWNER_V50_BOOKING_REVIEW`. Any false dependency
returns the unchanged legacy flow.
