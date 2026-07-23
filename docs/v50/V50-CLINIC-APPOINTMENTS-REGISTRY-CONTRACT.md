# V50 Clinic Appointments Registry Contract

Status: backend read model implemented; Portal integration absent.

## Bounded outcome

The clinic appointments registry is a location-scoped administrative read model.
It is not an extension of the manual-confirmation Queue and it does not own
booking or clinical state transitions.

Canonical future Portal route:

`/clinics/:clinicId/locations/:locationId/appointments`

Canonical future backend read:

`GET /v1/clinic/:clinicId/locations/:locationId/appointments`

This contract covers only the first cursor-paginated list. Appointment detail,
check-in, reschedule, cancellation, visit workbench, patient registry, mutations,
and navigation rollout are separate bounded slices.

## Authority

- Required capability: `appointment.registry.read`.
- Intended staff: clinic administrator and receptionist. A frontend role is only
  a navigation hint; the backend capability decision is authoritative.
- The URL clinic and location must match active, non-revoked employee membership
  and compatible JWT clinic/location scopes.
- Every database read must predicate the requested clinic location. A foreign
  clinic, foreign location, inactive/revoked membership, missing scope, or
  missing capability returns the existing normalized denial without registry
  rows or resource identifiers.
- Veterinarians do not gain the administrative registry implicitly. Their
  personal shift and assigned visits remain separate projections.

## Read contract

Query parameters for the first bounded list:

| Field | Contract |
| --- | --- |
| `bucket` | required enum: `upcoming` or `history` |
| `cursor` | optional opaque cursor owned and validated by the backend |
| `limit` | optional; default `50`, maximum `100` |

The response owns server time and pagination:

```text
clinicId
locationId
serverNow
items[]
nextCursor | null
```

On the first page the backend captures one PostgreSQL `snapshotAt`. It is the
authoritative bucket boundary for the complete traversal and is embedded in the
opaque cursor. `serverNow` reports the read time of each response; it does not
move the traversal boundary on later pages.

Each list item is a safe administrative projection:

```text
appointmentId
aggregateVersion
statusCode
statusLabel
slot { startsAt, endsAt }
pet { id, name, speciesLabel }
service { displayName } | null
```

The backend maps stored state to the bounded public `statusCode` and localized
`statusLabel`; raw database enums are not presentation. The list does not expose
owner contact data, clinical summaries, payment data, audit payloads, or
cross-location identifiers.

## Ordering and pagination

- `upcoming` contains non-terminal appointments whose slot ends at or after
  `snapshotAt`. An appointment already in progress is therefore upcoming. Its
  order is `slot.starts_at ASC`, then `appointment.id ASC`.
- `history` contains every terminal appointment, plus a non-terminal appointment
  whose slot ended before `snapshotAt`. Cancelled, completed, and no-show public
  mappings are terminal. Its order is `slot.starts_at DESC`, then
  `appointment.id DESC`.
- The two predicates are disjoint. The boundary is inclusive only in
  `upcoming`: `slot.ends_at = snapshotAt` is upcoming.
- The opaque keyset cursor contains `snapshotAt`, the full ordering tuple,
  bucket, limit, contract version, clinic ID, and location ID. All fields are
  integrity protected and validated by the backend.
- A cursor from another clinic, location, bucket, or query shape is invalid and
  must not broaden the read.
- `serverNow` and the returned array are authoritative. A Portal client must not
  reorder rows from a local clock.
- The read is side-effect free: no appointment, hold, capacity, audit, outbox,
  or idempotency record is written.

## Empty, error, and rollout behavior

- A valid zero-row result is HTTP 200 with `items: []` and `nextCursor: null`.
- Authorization failures use the normalized denial contract and disclose no
  registry data.
- Invalid query or cursor input is a controlled 400 response.
- A database or transport failure remains a technical failure; it is never
  normalized to a successful empty registry.
- Future Portal rollout is default-off and additive. With the rollout disabled,
  no appointments navigation or route is exposed; existing Queue, Schedule,
  Quality, and veterinarian routes are unchanged.

## Focused authority and read-model matrix

| Area | Required evidence |
| --- | --- |
| Success | admin and receptionist read only the requested active location |
| Capability | missing `appointment.registry.read` is denied |
| Membership | inactive and revoked membership are denied |
| Tenant scope | cross-clinic, cross-location, missing and incompatible JWT scopes are denied |
| Role separation | veterinarian does not receive the admin registry through role inference |
| Leakage | denials contain no appointment, pet, service, cursor, or location data |
| Buckets | ongoing and exact-boundary rows are upcoming; terminal and elapsed rows are history; predicates are disjoint |
| Pagination | stable tie-breaker, no duplicate/omitted rows, bounded default/max limit |
| Cursor binding | `snapshotAt` remains fixed across pages; foreign scope, bucket, contract version, and malformed cursors are rejected |
| Projection | public status labels are mapped; sensitive and raw internal fields are absent |
| Empty/error | valid empty is distinct from technical failure |
| Side effects | repeated reads create no state, capacity, audit, outbox, or idempotency changes |
| Rollback | default-off rollout leaves all existing Clinic Portal routes unchanged |

## Existing evidence and gaps

- `backend/src/booking-core/booking-security.service.ts` and
  `backend/src/booking-core/booking-hold-creation.service.ts` create
  `booking_schema.appointments`; `ClinicPortalService.completeAppointment` in
  `backend/src/booking-core/clinic-portal.service.ts` updates completion state.
  No clinic administrative list/detail controller method exists.
- `ClinicQueueService.listManualConfirmationQueue` in
  `backend/src/booking-core/clinic-queue.service.ts` is location-scoped but reads
  manual-confirmation holds only. It must not be repurposed as the registry.
- `OwnerAuthController` routes `GET /v1/owner/appointments` through
  `OwnerAppointmentsService` under `backend/src/auth/`; those reads are
  owner-scoped and must not be reused for clinic-staff authority.
- `docs/v50/adr/0003-route-screen-ownership.md` assigns `/appointments` to the
  admin registry with `appointment.registry.read` and a new cursor list/detail
  read model. `docs/v50/00-route-api-role-matrix.md` and
  `docs/v50/V50-PARITY-REGISTER.md` record that production implementation is
  absent.

No production defect is changed by this discovery slice. Implementation begins
at `GET /v1/clinic/:clinicId/locations/:locationId/appointments` with a signed
v1 cursor. The cursor preserves PostgreSQL timestamp precision, the DB-owned
snapshot boundary, scope, bucket, limit, and stable ordering tuple without
exposing signature details in errors.

The snapshot fixes time-bucket membership and excludes appointments created
after the first page. It is not a multi-request MVCC transaction: an appointment
whose stored status changes during traversal follows its current authoritative
status and may leave the selected bucket. Clients reconcile by starting a new
traversal; no serializable cross-request transaction is claimed.

Correctness is implemented without a migration. Focused `EXPLAIN` evidence shows
sequential scans and an explicit sort because the current schema has no registry
ordering index. The endpoint remains SQL-bounded by `limit + 1`; production-scale
indexing is the next migration slice and no applied migration is edited here.
