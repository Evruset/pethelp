# V50-OWNER-06 — My Bookings and Cancellation

## Task brief

- Goal: deliver server-classified My Bookings, owner-safe detail/timeline and
  idempotent version-fenced cancellation with authoritative readback.
- User outcome: owners see requires-action, active and history bookings, open
  detail, understand the server status, and safely submit cancellation when the
  backend allows it.
- Scope: focused owner booking list/detail/cancellation backend and Flutter,
  real PostgreSQL tests, default-off flags, visual evidence and V50 docs.
- Acceptance: all OWNER-06 definition-of-done gates from the attached request,
  including 20-way cancellation concurrency and three independent validators.
- Constraints: preserve distinct hold release vs confirmed cancellation request;
  no refund/payment/MIS adapter, alternative/reschedule, Portal, telemed or
  insurance changes. Preserve null supported-species semantics and protected
  `.codex` files.
- Source: `OWN-007 #appointments` and bounded `OWN-008 #appointment-detail` in
  the parity register and verified V50 prototype.
- Environment: branch `agent/v50-owner-06`, isolated worktree
  `/Users/evrusetskiy/work/pethelp-alpha-v50-owner-06`, integrated base `8f65524`.
- Risk: `C3/R3` for owner isolation, classification, locking, versioning,
  idempotency, counters and external compensation semantics.
- Non-goals: every exclusion in the OWNER-06 request.

Persistent chat creation is unavailable here; this bootstrap and handoff are
the bounded continuation context.

## Completion evidence

- Runtime/veto-repair commit: `fb24f18`.
- Backend build and real PostgreSQL focused suite: PASS 5/5, including uncapped
  paging proof and 20-way cancellation concurrency.
- Flutter analyze, focused 8/8, full 255/255 and flagged web build: PASS.
- Evidence `v50-owner-06-fb24f18`: 48/48 runtime + 8/8 prototype PASS.
- Independent state/security and product/visual validators: PASS, zero vetoes.
- Final integration validator: PASS, zero vetoes.
- Known unrelated full-smoke abstention is linked only through
  `BACKEND-ROLE-TSJEST-COMPILE` in the booking debt register.
