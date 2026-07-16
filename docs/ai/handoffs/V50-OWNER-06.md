# V50-OWNER-06 handoff

## Result

READY_FOR_INTEGRATION — runtime, PostgreSQL, Flutter, evidence, state/security,
product/visual and final integration gates pass with zero vetoes.

## Baseline

- OWNER-05 integrated through `c2bbcbf`; program base `8f65524`.
- OWNER-05 durable evidence reverified 48/48 runtime + 8/8 prototype, checksum
  `d7e36a6b7071b8e607b8beeabd6941ec9185128e50911b80c10c5cef9300339a`.
- Known debt: `docs/v50/V50-OWNER-BOOKING-DEBT.md`.

## Scope

- `OWN-007 #appointments` → `/owner/bookings`.
- Bounded `OWN-008 #appointment-detail` → `/owner/bookings/:bookingId`.
- Legacy reads remain unchanged. Canonical V50 contracts are
  `GET /v1/owner/bookings`, `GET /v1/owner/bookings/:holdId` and
  `POST /v1/owner/bookings/:holdId/cancel`.

## Result and user-visible behavior

- Backend authors `REQUIRES_ACTION`, `ACTIVE`, `HISTORY`, `serverNow`, public
  timeline, eligibility/policy and aggregate version.
- SQL applies owner/pet/bucket filters before uncapped `LIMIT + 1` keyset
  pagination over bucket rank, authoritative sort time and hold ID.
- Flutter renders responsive cards/detail, pet filter/load-more, offline stale,
  confirmation/submitting/pending/cancelled states and authoritative readback.
- Flags `OWNER_V50_MY_BOOKINGS`, `OWNER_V50_BOOKING_DETAIL` and
  `OWNER_V50_BOOKING_CANCELLATION` are default off and dependency ordered;
  disabling them restores legacy UI without data rollback.

## Cancellation invariants

- JWT `sub`, UUID idempotency/correlation headers and `If-Match` are required;
  fingerprint includes hold/version/reason and exact replay has one result.
- `MANUAL_CONFIRM_PENDING`/`ALTERNATIVE_PENDING` release locally and decrement
  held capacity once. Confirmed and all MIS/external states request cancellation
  and do not free booked capacity.
- State lock, version check, transition, guarded counter, audit, versioned
  outbox and idempotent response share one PostgreSQL transaction. No external
  HTTP is executed under the lock. No refund/payment result is claimed.

## Tests and concurrency

- Canonical Compose: Node `v22.23.1`, npm `10.9.8`, PostgreSQL `16.14`.
- Backend build PASS; real PostgreSQL focused suite PASS 5/5. Paging proof adds
  1,005 history rows and reads beyond 1,000. Twenty concurrent cancellations:
  one transition, one counter effect, one audit, one outbox, zero 5xx, pool
  restored. An injected outbox failure proves rollback of state, counters,
  audit, outbox and idempotency.
- Flutter analyze PASS; focused 8/8 PASS; full 255/255 PASS; flagged web build
  PASS.

## Evidence and parity

- Immutable external package: `v50-owner-06-fb24f18-bmp`; logical package ID
  `v50-owner-06-fb24f18`; runtime `fb24f18`.
- 48/48 runtime plus 8/8 prototype artifacts; package SHA-256
  `5a1e3a26d5a70f0b96a8fc2c271ca49dbc5ba74f32f77f79bdf6c6f528eaeaa2`.
- Representative 8/8 and full matrix PASS. State/security PASS; product/visual
  PASS; final integration PASS; vetoes zero.
- `OWN-007`: IMPLEMENTED / TESTED / VISUALLY_VERIFIED. Bounded `OWN-008`
  detail/cancellation remains PARTIAL overall because alternative/rebook/payment
  are out of scope. Program counter: 11/30.

## Debts, commits and integration

- Preserved debts: `BACKEND-ROLE-TSJEST-COMPILE` and
  `NULL-SUPPORTED-SPECIES-LEGACY-COMPATIBILITY`.
- Commits: `86a0f1b` backend, `72c0db1` Flutter, `8aeaf2e` evidence harness,
  `6444f11` validation-veto repairs, `fb24f18` safe ambiguity/rollback repair;
  certification commit follows final gate.
- Integrate the full ordered chain from base `8f65524`; do not cherry-pick only
  certification. Next slice must start in a fresh session after program merge.
