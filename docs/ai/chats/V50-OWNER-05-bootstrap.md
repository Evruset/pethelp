# V50-OWNER-05 — V50 Hold Creation and Booking Status

## Task brief

- Goal: connect Booking Review to the canonical owner Create Hold command, authoritative readback, and server-owned booking status UI.
- Outcome: an authenticated owner receives either one durable hold/appointment result or a controlled conflict, then sees only server-authoritative pending, confirmed, failed, expired, or released state.
- Scope: focused Booking Core command/read repairs, PostgreSQL locking/idempotency/expiry/outbox proofs, Owner Flutter submit/status flow, flags, tests, evidence, and V50 documentation.
- Acceptance: the matrix in the V50-OWNER-05 request passes, including real PostgreSQL 100-request capacity-one concurrency, owner isolation, atomic outbox/audit, authoritative readback, focused/full Flutter checks, and visual evidence.
- Constraints: reuse canonical endpoints and state machine; preserve applied migrations and legacy routes; no payment, cancellation, alternative-slot, Portal, MIS-adapter, insurance, telemedicine, or unrelated refactor work.
- Source of truth: `docs/v50/V50-PARITY-REGISTER.md`, `prototype-v50/index.html`, `docs/v50/V50-BOOKING-SELECTION-CONTRACT.md`, and the existing Booking Core schema/state machine.
- Environment: isolated worktree `/Users/evrusetskiy/work/pethelp-alpha-v50-owner-05`, branch `agent/v50-owner-05`, base `e88f34a`.
- Risk: C3/R3 — concurrency, authorization, idempotency, transactional consistency, expiry, outbox, and server-authoritative UI.
- Non-goals: all exclusions listed in the slice request, especially new payment/MIS lifecycle and Clinic Portal confirmation UI.

## Required gates

1. Architecture review before runtime implementation.
2. Focused real-PostgreSQL transaction/concurrency/security validation.
3. Focused and full Flutter validation plus evidence integrity.
4. Independent transaction/security, product/visual, and final integration validators; any veto blocks integration.

Persistent chat creation is not available in this environment; this bootstrap and the bounded handoff are the continuation context.
