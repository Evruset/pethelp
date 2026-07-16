# V50 Booking Hold and Status Gap Matrix

Status before implementation. `REPAIR` means the canonical Booking Core is retained and narrowed changes close the V50 contract.

Closure: all `REPAIR`/`MISSING` items in the bounded slice are implemented and
validated. Doctor/service authority metadata and request fingerprinting use two
new additive migrations; applied migrations were not edited. Real PostgreSQL
PASS 4/4 and independent transaction/security validation PASS with zero vetoes.

| Concern | Status | Existing evidence / required closure |
|---|---|---|
| Create Hold endpoint | REUSE | `POST /v1/booking-holds` in `booking.controller.secure.ts`. |
| Request DTO | REPAIR | Typed `slotId`/`petId` exist; add expected slot version and service identity, with optional doctor only where the canonical slot model can validate it. |
| Response DTO | REPAIR | Existing result lacks `serverNow`, `aggregateVersion`, `confirmationMode`, and `nextAction`. |
| Idempotency-Key | REPAIR | Owner-scoped replay exists; compare replayed logical payload against the created hold to reject same-key/different-payload. |
| Correlation ID | REUSE | Required UUID header propagated to audit/outbox/result. |
| Slot locking | REUSE | Repository uses the transaction client and `SELECT ... FOR UPDATE`. |
| Lock timeout | REUSE | `SET LOCAL lock_timeout = '50ms'`; PostgreSQL errors normalize to `SLOT_LOCKED_RETRY`. |
| Statement timeout | REPAIR | Interactive limit is 50ms; document/align the bounded V50 policy and prove it is set after BEGIN on the same client. |
| Expected version | MISSING | Validate under slot lock and return `SLOT_VERSION_STALE`. |
| Pet ownership/active status | REPAIR | Ownership is normalized; archived status and service compatibility need explicit validation. |
| Slot/location/service validation | REPAIR | Active clinic/location and slot capacity exist; bind submitted service to the locked slot and freshness/confirmation policy. |
| Doctor compatibility | REPAIR | Apply only if canonical slot/doctor association exists; never trust an unvalidated client doctor. |
| Hold TTL | REUSE | PostgreSQL `clock_timestamp()` owns expiry. Extend response/read DTO with server clock. |
| held_count update | REUSE | Atomic slot update exists; certify capacity-one and expiration consistency. |
| Outbox event | REUSE | Versioned event is inserted in the same transaction; certify uniqueness and rollback. |
| Audit event | REUSE | Audit row is inserted in the same transaction; certify uniqueness and rollback. |
| External HTTP boundary | REUSE | Create Hold writes durable intent only; no external HTTP is called in the transaction. |
| Error semantics | REPAIR | Existing normalization covers locking/capacity; add stale version and payload conflict without database leakage. |
| Status read | REPAIR | Owner isolation exists, but foreign owner is 403 and DTO lacks safe summaries/server clock/version/status mapping. Normalize owner foreign/unknown to 404. |
| Expiration behavior | REUSE | Existing security/worker logic uses locked rows and PostgreSQL clock; add focused idempotent proof for this path. |
| Existing tests | REPAIR | Platform smoke covers basic concurrency/idempotency/read; add a focused real-PostgreSQL V50 matrix including 100 requests. |
| V50 UI | REPAIR | Legacy repository/status page exist; OWNER-04 Review currently stops before mutation and the legacy page can claim success locally. Add flagged submission/readback/status flow. |
| Payment/cancellation/alternative/MIS expansion | OUT_OF_SCOPE | Existing workflows remain unchanged and are displayed only through authoritative state. |
