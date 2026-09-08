# V50 Owner Bookings and Cancellation Gap Matrix

Pre-implementation classification with final closure. `REPAIR` retained the
canonical Booking Core and closed only the V50 contract gap; all required rows
below are closed at runtime `fb24f18`.

| Concern | Status | Existing evidence / required closure |
|---|---|---|
| Owner bookings list endpoint | REPAIR | `GET /v1/owner/appointments` is owner-scoped but returns a bare list limited to 100. |
| Bucket classification | REPAIR | Backend has ACTIVE/HISTORY; add REQUIRES_ACTION and keep all classification server-owned. |
| serverNow | MISSING | Detail has it; list envelope does not. |
| Pagination | MISSING | Add deterministic cursor/limit without duplicates or gaps. |
| Stable sorting | REPAIR | Current active/history order is not the required per-bucket stable order with ID tie-break. |
| Pet filter | MISSING | Add owner-scoped server filter. |
| Detail endpoint | REUSE | `GET /v1/owner/appointments/:holdId` predicates owner+hold and normalizes to 404. |
| Timeline source | REPAIR | Backend timeline exists; replace raw fallback audit action with a strict public allowlist/current marker. |
| Cancel eligibility | REPAIR | Backend authors `canCancel`; add policy code/reason/version and distinguish release from cancellation request. |
| Cancel endpoint | REPAIR | Canonical hold release and cancellation-request endpoints exist; add one owner-booking façade only if it dispatches to distinct domain operations. |
| Idempotency-Key | REPAIR | Release supports key; cancellation request lacks payload-bound idempotency. |
| If-Match/version | MISSING | Cancellation does not enforce aggregate version. |
| Owner authorization | REUSE | JWT `sub`; owner detail is normalized. Mutation paths need the same normalized rule. |
| Hold cancellation | REUSE | `BookingSecurityService.releaseHold` atomically releases held capacity. Certify drift/replay. |
| Confirmed appointment cancellation | REUSE | Existing transition is `CANCELLATION_REQUESTED`, not local cancellation. Preserve pending semantics. |
| External cancellation state | REUSE | Existing outbox/support workflow is post-commit delivery owner; do not add an adapter. |
| Payment implications | OUT_OF_SCOPE | Show neutral server wording only; no refund/void claims. |
| Outbox/audit | REPAIR | Existing writes are transactional; add dedup/version/rollback proofs for cancellation. |
| Authoritative readback | REPAIR | Flutter refreshes detail after request; list refresh and state-machine semantics need proof. |
| Error semantics | REPAIR | Add stale version/payload conflict and normalized safe denial. |
| Existing tests | REPAIR | Current repository/page and smoke coverage lacks full V50 PostgreSQL/cancellation matrix. |
| V50 UI | REPAIR | Existing page/detail/cancel UI is rich but unflagged, client buckets ACTIVE/HISTORY only, and operation keys are regenerated. |

## Final closure

- List/detail/cancel use additive `/v1/owner/bookings` contracts; legacy reads
  keep their old shape.
- Filtering and uncapped `(bucket rank, sort time, hold id)` keyset pagination
  execute in PostgreSQL before `LIMIT + 1`; the focused test proves access past
  1,000 rows and filter correctness.
- One backend policy classifier separates local release from confirmed/MIS
  cancellation request and drives both eligibility projections.
- Real PostgreSQL 4/4, backend build, state/security validation and
  product/visual validation are `PASS`; vetoes are zero.
