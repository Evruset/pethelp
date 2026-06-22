# Security Authorization Slice

## Breaking API changes

- `POST /v1/booking-holds` accepts only `slotId` and `petId`; the owner is derived from `Authorization: Bearer`.
- `POST /v1/booking-holds/:holdId/release` accepts no owner body field; ownership is derived from the JWT principal.
- `POST /v1/clinic/booking-holds/:holdId/confirm` no longer accepts `X-Clinic-Location-ID`; employee scope is verified from JWT claims and `clinic_schema.employee_location_memberships` inside the booking transaction.

## Worker authentication

`POST /internal/workers/expire-holds` accepts either a JWT principal with `SYSTEM_WORKER` role or `Authorization: ServiceBearer <WORKER_SERVICE_TOKEN>`.

Deployment must keep `/internal/*` outside public ingress. Application authentication is not a replacement for private network policy.
