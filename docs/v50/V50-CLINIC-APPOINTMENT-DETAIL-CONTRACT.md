# V50 Clinic Appointment Detail Contract

Status: `DETAIL_BACKEND_IMPLEMENTED / PORTAL_MISSING`.

## Bounded outcome

This contract defines one read-only administrative detail for an appointment
already visible in the Clinic Appointments Registry. It is not a booking-hold
Queue drawer, veterinarian clinical workspace, patient chart, financial view,
or mutation surface.

Canonical future routes:

```text
Portal  /clinics/:clinicId/locations/:locationId/appointments/:appointmentId
Backend GET /v1/clinic/:clinicId/locations/:locationId/appointments/:appointmentId
```

The registry `appointmentId` is the only detail identity. A client must not
derive detail identity from a hold ID or decode a registry cursor. A registry
row may provide a short optimistic shell, but the detail response is always
authoritative and replaces stale status/version data.

## Authority and no-leak behavior

The detail reuses `appointment.registry.read`; its data category and intended
admin/reception audience are the same as the bounded registry projection. A new
capability is not justified by current evidence.

Every read requires:

- an authenticated clinic employee;
- effective `appointment.registry.read`;
- compatible JWT clinic and location claims;
- active, non-revoked membership for the exact location;
- an active URL location belonging to the URL clinic;
- predicates for the appointment location and joined slot location;
- deny-by-default evaluation from server-derived resource scope.

Role or URL visibility is not authority. `CLINIC_VETERINARIAN` does not inherit
this administrative detail through the separate
`clinical.visit.workspace.read` capability.

Expected outcomes follow the existing registry no-leak convention:

| Condition | Outcome |
| --- | --- |
| valid exact-scope detail | `200` with the administrative DTO |
| missing/invalid authentication | normalized `401` |
| malformed UUID, missing appointment, foreign clinic/location, missing capability or incompatible membership/scope | normalized `403 CLINIC_SCOPE_MISMATCH`, with no resource identifiers or detail fields |
| database/linked-data failure | normalized non-2xx technical failure without SQL, stack, evaluator detail, or fake detail |

A syntactically valid absent ID and a foreign ID are deliberately
indistinguishable to the caller. The implementation must use one scoped query;
it must not first probe global appointment existence.

## Administrative response DTO

The first implementation should return a purpose-built DTO, never an ORM row:

```text
clinicId
locationId
serverNow
appointment {
  appointmentId
  aggregateVersion
  statusCode
  statusLabel
  createdAt
}
schedule {
  startsAt
  endsAt
  timezone
  sourceLabel
}
owner { displayName } | null
pet {
  id
  displayName
  speciesLabel
}
service { displayName } | null
veterinarian { displayName } | null
resource { displayName } | null
availableActions []
```

Contract rules:

- `clinicId`, `locationId`, appointment/pet IDs and version are required machine
  fields. UUIDs are not user-facing content.
- `owner` is nullable because no safe owner display-name projection is currently
  evidenced. The implementation may populate only a proven administrative
  display name; it must not fabricate one or fall back to owner UUID.
- Service, veterinarian and resource are genuinely nullable. `null` means
  authoritative absence; a missing property, wrong type, invalid identifier, or
  malformed linked record is a malformed/technical response.
- Pet name and species are evidenced by the registry. Breed, birth date, age,
  warnings and contacts are omitted until their policy/source is separately
  proven.
- `statusCode` uses the closed administrative mapping `SCHEDULED`, `COMPLETED`,
  `NO_SHOW`, `CANCELLED`, plus safe detail-only `UNKNOWN`. Stored raw states are
  never returned as labels; unknown states use `Статус уточняется`.
- `aggregateVersion` and current status are database-authoritative. A stale
  registry version has no effect on the read.
- `availableActions` is an empty array in this bounded contract. It is
  server-authored and advisory only; it is never authorization. Adding an action
  identifier requires an implemented, separately authorized appointment command
  contract.
- `nextExpectedActor` is omitted: the appointment aggregate has no evidenced
  server-owned administrative actor classifier.

## Privacy boundary

Only the administrative projection above is in scope.

| Projection | Detail contract |
| --- | --- |
| Administrative | appointment identity/version/status; schedule/timezone/source; safe pet/service/staff/resource display data; nullable safe owner display name |
| Clinical | excluded: diagnosis, conclusion, complaints, anamnesis, vitals, treatment plan, prescriptions, raw veterinarian notes, clinical summary, telemedicine transcript and assigned-workspace data |
| Financial | excluded: prices unless separately contracted, invoices, payment state/details/credentials, refunds, insurance medical payload and provider data/secrets |

Also excluded are full phone/email/address, private support notes, hold audit
payload, raw audit JSON, correlation/trace IDs, idempotency records, outbox data,
integration payloads and internal timestamps. Unexpected sensitive fields must
not enter JSON, logs, telemetry, or Portal rendering.

The existing veterinarian route
`GET /v1/clinic/:clinicId/locations/:locationId/vet/visits/:holdId` has a
different identity, audience and clinical capability. It must not be reused or
merged with this DTO.

## Temporal and consistency semantics

- PostgreSQL owns `serverNow`, status, version and stored timestamps.
- `startsAt`, `endsAt`, `createdAt` and `serverNow` are strict RFC3339 instants
  with offsets. `endsAt` must be later than `startsAt`.
- Runtime validation must reject non-existent calendar dates, overflow
  normalization, non-finite dates, missing offsets and `Invalid Date`. Parsing
  must round-trip the calendar components rather than relying only on permissive
  `Date.parse`.
- `timezone` is the clinic IANA timezone used for display; timestamps remain
  absolute instants. The Portal formats them without rewriting authority.
- Rescheduled/cancelled/completed timestamps are not included until an
  authoritative source and semantics are evidenced. `null` must not be used to
  imply a transition that was never recorded.
- Repeated reads are side-effect free: no audit, outbox, capacity, hold,
  appointment, idempotency or clinical record writes.
- If the record changes after registry navigation or while detail is open, a
  refresh returns the current version/status. There is no cursor or cross-request
  MVCC snapshot for a single detail.

## Administrative history boundary

The first detail response has no history collection. The available hold
audit-trail endpoint is hold-scoped and may contain events/payloads outside this
appointment projection. Raw audit tables and clinical completion events must not
be joined into the detail.

A future history slice must define an explicit allowlist of administrative event
types, safe actor labels and public/admin reasons, descending or ascending
ordering, a bounded limit/cursor, and exclusion of raw payloads. It is not part
of the backend read-model slice that follows this contract.

## Existing action evidence

No current mutation is exposed as an appointment-detail action.

| Existing or proposed action | Actual applicability | Capability/authority | Version fence | Idempotency | Detail result |
| --- | --- | --- | --- | --- | --- |
| confirm pending request — `POST /v1/clinic/booking-holds/:holdId/confirm` | `MANUAL_CONFIRM_PENDING` hold before appointment creation | existing Queue command; admin/reception policy | required `If-Match` | required key | excluded: not an appointment action |
| decline pending request — `POST /v1/clinic/booking-holds/:holdId/decline` | `MANUAL_CONFIRM_PENDING` hold before appointment creation | existing Queue command; admin/reception policy | required `If-Match` | required key | excluded |
| request notes — `POST /v1/clinic/booking-holds/:holdId/request-notes` | pending hold; appointment not yet created | existing Queue command; admin/reception policy | required `If-Match` | required key | excluded |
| propose alternative — `POST /v1/clinic/booking-holds/:holdId/alternative-slot` | pending hold and compatible slot | existing hold alternative command; admin/reception policy | required `If-Match` | required key | excluded |
| complete visit — `POST /v1/clinic/booking-holds/:holdId/complete` | confirmed hold/appointment | `clinical.visit.complete`, veterinarian clinical surface | current command has no appointment `If-Match` contract | correlation/audit contract, not detail idempotency | excluded from administrative detail |
| reschedule confirmed appointment | no route | none | none | none | unavailable |
| cancel confirmed appointment by clinic | no administrative route | none | none | none | unavailable |
| check in | no route | none | none | none | unavailable |
| mark no-show | no route | none | none | none | unavailable |

The Portal must not infer buttons from status. Mutation links/hints may be added
only after their own capability, state, version, idempotency and result contracts
exist. This contract does not expand the state machine.

## Query and performance boundary

The future read is one bounded query keyed by appointment primary key and exact
scope. It may join:

- `booking_schema.appointments`;
- its slot plus the slot's location and clinic;
- pet;
- optional clinic service;
- optional clinic staff and resource display rows.

The query must predicate both
`appointments.clinic_location_id = :locationId` and
`appointment_slots.clinic_location_id = :locationId`, and verify the location's
`clinic_id = :clinicId`. It must use primary-key lookups, avoid N+1 reads,
clinical/financial blobs and unbounded history. Existing appointment/slot
indexes are sufficient by current evidence; a new index requires a measured
plan regression and a separate performance slice.

## Focused executable matrix for the backend slice

| Area | Required evidence |
| --- | --- |
| Positive | receptionist and admin with exact capability, active membership and exact scope receive one current DTO |
| Scope denial | unauthenticated; veterinarian/role denial; missing capability; missing/revoked membership; cross-clinic/location; missing/incompatible JWT scopes |
| No leak | absent, foreign and unauthorized syntactically valid IDs share the normalized denial and expose no appointment/pet/service/location identifiers |
| DTO | required identifiers/version/status; nullable owner/service/vet/resource; strict RFC3339 including impossible dates; safe unknown status |
| Privacy | no contacts, clinical conclusion/notes/prescriptions, payments, insurance/provider, audit/outbox/idempotency/integration payload |
| Consistency | stale registry row is replaced by authoritative detail status/version; exact joined scope; repeated reads stable and side-effect free |
| Failure | malformed ID; malformed linked data; technical database failure; no fake empty/success or internal error detail |
| Performance | one bounded query, no N+1 or unbounded history; exact-scope plan uses PK/index lookups |
| Rollback | default-off page and BFF remain absent; registry list behavior is unchanged |

There is no business-empty detail. A successful detail is `200`; every other
outcome is denial, invalid input, or technical failure.

## V50 Portal contract

The detail is a nested state of prototype screen `clinic-appointments`
(`CLN-004`); the prototype has no separate populated administrative detail
screen. It must not copy `clinic-visit`.

The future page uses the existing Clinic Portal shell and contains:

- back link preserving registry scope/bucket where safe;
- header with date/time and textual administrative status;
- pet and nullable owner administrative identity;
- service, veterinarian/resource and location context;
- read-only administrative facts;
- no actions until a command contract exists;
- initial loading, technical error, forbidden/no-leak, stale-refreshed and
  unknown-status states.

Desktop may use grouped panels; tablet/mobile stack the same facts without
horizontal loss. At 200% text no identifier or status is clipped. Status is not
communicated by color alone. Heading hierarchy, landmarks, focus restoration,
keyboard navigation and targeted live announcements follow the existing V50
shell. UUIDs and raw enums are never visible.

## Rollout

Detail belongs to the same release unit and reuses the default-off
`VETHELP_CLINIC_APPOINTMENTS_REGISTRY` flag. No new flag is justified.

Disabled rollout hides appointments navigation and makes the registry list,
future detail pages, and their BFF routes unavailable as one release unit.
There is no independent detail rollback while the shared flag is used. Enabling
detail in a future slice must be additive to the enabled registry; disabling the
shared flag rolls back both list and detail while leaving Queue unchanged. The
backend detail route is protected by this same flag and returns `404` while it
is disabled; the Portal page and BFF remain absent.

## Backend implementation evidence

`ClinicAppointmentsRegistryController` exposes only the canonical
`GET /v1/clinic/:clinicId/locations/:locationId/appointments/:appointmentId`
route. `ClinicAppointmentsRegistryService.detail` performs one bounded,
exact-scope projection with predicates on both appointment and slot location
and the owning clinic. `ClinicAppointmentDetailDto` is the OpenAPI allowlist.

The server reuses `appointment.registry.read`, exact JWT clinic/location claims,
and active non-revoked membership. Malformed, absent and foreign identifiers
use the same no-leak `CLINIC_SCOPE_MISMATCH`; technical failures remain `500`.
Owner display is `null` because no verified administrative display source
exists, and UUID fallback is forbidden. Status/version are authoritative,
actions remain empty, reads are side-effect free, and clinical, financial,
contact, audit and integration data are excluded.

Focused Node 22 evidence: detail HTTP suite `13/13`, registry regression
`27/27`, backend build, OpenAPI export/assertion, migration checksum verification
and `git diff --check` pass. No migration was added. Portal implementation and
end-to-end detail parity remain missing.
