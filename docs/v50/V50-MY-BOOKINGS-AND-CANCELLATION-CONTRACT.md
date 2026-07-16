# V50 My Bookings and Cancellation Contract

## ADR decision

Retain legacy owner reads `GET /v1/owner/appointments` and
`GET /v1/owner/appointments/:holdId`; additive canonical V50 reads are
`GET /v1/owner/bookings` and `GET /v1/owner/bookings/:holdId`; runtime aliases remain
`/owner/bookings` and `/owner/bookings/:bookingId`. Extend the read contract
without creating a competing Booking Core.

Cancellation is one UI intent but two domain commands:

- eligible, unconfirmed active hold → atomic `ReleaseHold` and `RELEASED`;
- confirmed/external appointment → `RequestCancellation` and
  `CANCELLATION_REQUESTED` pending authoritative external/manual completion.

Confirmed appointments must never use hold release or decrement `held_count`.
Rejected alternatives: client bucket/timeline/eligibility inference, one command
that always releases, external MIS/payment HTTP under lock, a new adapter/relay,
refund claims, or flag rollback via data deletion/migration downgrade.

## V50 rows and anchors

| Experience | V50 ID | Prototype anchor/route | Runtime route | Read/command | Flags |
|---|---|---|---|---|---|
| My Bookings, requires action, active, history | `OWN-007` | `#appointments` / `appointments` | `/owner/bookings` | `GET /v1/owner/bookings` | `OWNER_V50_MY_BOOKINGS` |
| Detail, timeline and cancellation | bounded `OWN-008` | `#appointment-detail` / `appointment-detail`; cancellation prototype action/state | `/owner/bookings/:bookingId` | `GET /v1/owner/bookings/:holdId`; `POST /v1/owner/bookings/:holdId/cancel` | `OWNER_V50_BOOKING_DETAIL`, `OWNER_V50_BOOKING_CANCELLATION` |

No new V50 ID is invented for confirmation/result/terminal states; those are
state evidence for bounded `OWN-008`.

## List contract

The backend returns `serverNow`, a stable cursor and owner-safe cards. Each card
contains a server-authored bucket: `REQUIRES_ACTION`, `ACTIVE`, or `HISTORY`.
The client may filter already classified cards but never derives business
buckets. Sorting is deterministic with aggregate ID as final tie-break. Cursor
state includes the sort key and ID; owner/pet filter is re-applied server-side.

Legacy bare-array consumers remain supported through explicit V50 negotiation
or a compatible response mode rather than silently changing the old shape.

## Detail and timeline

Owner and hold identity are predicates of the same query; foreign and unknown
return the same 404. Detail contains safe summaries, current state/bucket,
confirmation mode, server time, version, server-authored eligibility/policy,
next action and a strict public timeline.

Timeline event codes/titles/descriptions are allowlisted. Raw audit actions,
payloads, internal actors, comments, correlation data, retry/MIS/payment fields
are never returned.

## Cancellation command

Required authority inputs are JWT `sub`, UUID `Idempotency-Key`, UUID
`X-Correlation-ID` and `If-Match` aggregate version. Client body contains only a
supported reason code if the existing product contract permits it. Owner,
state, financial result and external result are never client-authored.

One short PostgreSQL transaction uses the same client for local limits,
idempotency fingerprint acquisition, `FOR UPDATE`, normalized owner/state/
version validation, the correct distinct transition, guarded slot count change
when releasing a hold, audit, versioned outbox and stored response. Exact replay
returns the same result; a changed hold/version/payload conflicts. External HTTP
is strictly post-commit and owned by an existing dispatcher/relay.

`CANCELLATION_REQUESTED` is pending, never presented as cancelled. Flutter
performs authoritative detail readback and list refresh before showing the
result or moving buckets.

## Eligibility and payments

Backend returns `canCancel`, command kind, policy code, safe reason, optional
deadline only when an existing policy supplies it, and aggregate version.
Terminal/completed/expired/released/already-cancelled states are denied safely.
No refund/void/capture claim is added. Undefined financial implications use
neutral server-authored wording.

## Rollout and observability

All three flags are default off and dependency ordered: shell → My Bookings →
Detail → authenticated cancellation with `canCancel=true`. Invalid combinations
fall back safely without PII diagnostics or local cancellation.

Observe outcome/error/latency counts, stale-version/idempotency/lock contention,
bucket counts, pagination duplicate/gap alarms, slot reconciliation and outbox
lag/failures. Correlation data contains no PII.

## Architecture gate

Pre-implementation result was `FAIL` because current reads had two
buckets/no cursor and raw timeline fallback, while commands lack versioned,
payload-bound idempotency and allowed unsafe confirmed release. Runtime
`fb24f18` closes those gaps with SQL keyset pagination, a shared cancellation
policy classifier and focused real-PostgreSQL proof. State/security revalidation:
`PASS`, zero vetoes.
