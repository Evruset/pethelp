# V50-OWNER-07 handoff

## Result

READY_FOR_INTEGRATION — runtime, PostgreSQL, Flutter and immutable evidence
gates pass. Independent validator results are recorded below.

## Baseline

- OWNER-06 integrated through merge `cd63a65`; program base `cce05a6`.
- Durable OWNER-06 package `v50-owner-06-fb24f18-bmp` reverified 48/48 runtime
  plus 8/8 prototype, checksum PASS.

## V50 scope

- `OWN-020`, `#alternative-slot` → `/owner/bookings/:holdId/alternative`.
- Entry from bounded `OWN-008` detail/requires-action; OWNER-07 does not invent
  another parity row.
- Existing domain model reserves both source and alternative slots for a
  15-minute server-authored TTL (capacity policy B).

## Proposal and commands

- Canonical read: `GET /v1/owner/bookings/:bookingId/alternative`.
- Canonical mutations:
  `POST /v1/owner/bookings/:bookingId/alternative/:proposalId/accept|decline`.
- JWT owner, booking and proposal association are validated together;
  foreign/unknown combinations normalize to 404.
- UUID idempotency/correlation keys and `If-Match` are mandatory. Accept and
  decline use distinct payload-bound namespaces.
- Global lock order is hold → sorted slots → proposal, shared with clinic
  supersede. Eligibility revalidates future/open/reserved capacity and complete
  location/service/doctor/resource compatibility.
- Accept releases the source counter and retains proposed capacity as
  `MIS_HELD`. Decline releases only proposed capacity, preserves the source
  request as `MANUAL_CONFIRM_PENDING`, and creates no replacement hold.
- State/counters/audit/versioned outbox/idempotency are atomic; external I/O is
  outside the transaction.

## Flutter and flags

- `OWNER_V50_ALTERNATIVE_RESOLUTION` is default off and depends on V50 shell,
  My Bookings and Booking Detail.
- Detail exposes the action only for backend-authored `REQUIRES_ACTION`.
- UI compares original/proposed slots, server deadline and safe price copy;
  accept/decline use persistent keys and authoritative proposal readback.
- Offline is visibly stale and mutation-disabled. Return to availability is a
  typed intent with excluded slot IDs and never auto-creates a hold.

## Tests, concurrency and evidence

- Backend build PASS. PostgreSQL focused 12/12 plus legacy alternative 4/4
  PASS: 20 accepts, 10 accept vs 10 decline, clinic supersede races,
  invalid/incompatible slot rejection, rollback, exact effects, zero 5xx and
  restored pool.
- Flutter analyze PASS; focused alternative 10/10 and combined affected 18/18;
  full 265/265 PASS; flagged web build PASS.
- Runtime `670bc32`; package `v50-owner-07-670bc32` contains 48/48 runtime and
  4/4 `#alternative-slot` prototype references. Package SHA-256:
  `a945970478939453d58d6014eb307e68d252f58fd7938545189f604f3414601a`.
- `OWN-020` is IMPLEMENTED / TESTED / VISUALLY_VERIFIED and is the one new
  independent row; counter is 12/30. `OWN-008` remains bounded partial.
- State/security, product/visual and final integration PASS; vetoes zero.

## Commits and integration

- Backend `03d5fc3`; canonical contract `bd25b0a`; Flutter `d48cc8d`;
  evidence harness `5bc5be4`; evidence stabilization `ee00624`; transactional
  veto repair `589d71c`; visual repair `caa9150`; typed-context/runtime
  `670bc32`; certification follows.
- Integrate the full chain from base `cce05a6`, not only certification.
