# V50-OWNER-07 — Alternative Slot Resolution

- Goal: owner-safe comparison and resolution of a clinic-proposed alternative
  slot with authoritative readback.
- Source row: `OWN-020`, `#alternative-slot` →
  `/owner/bookings/:holdId/alternative`. `OWN-008` remains the entry/detail
  surface; no artificial row is created.
- Scope: proposal read, accept, explicit decline, typed return-to-availability
  intent, version/idempotency/deadline/capacity/counter/audit/outbox proof,
  flagged Flutter UI and evidence.
- Risk: C3/R3 because accept/decline race over two reserved slot counters is a
  transactional invariant.
- Non-goals: Portal proposal UI, payment/refund, new MIS adapter, confirmed
  appointment rescheduling, negotiation/chat, telemedicine or insurance.
- Environment: `agent/v50-owner-07`, isolated worktree based on integrated
  OWNER-06 program commit `cce05a6`.

Persistent chat creation is unavailable; this file and the handoff are the
bounded continuation context.

## Completion evidence

- Runtime `670bc32`; backend build and PostgreSQL focused 12/12 + legacy 4/4
  PASS; Flutter analyze, focused, full 265/265 and flagged web build PASS.
- Immutable evidence `v50-owner-07-670bc32`: 48/48 runtime + 4/4 prototype,
  package checksum PASS.
