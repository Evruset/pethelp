# VetHelp Owner Mobile

This folder contains owner-side mobile implementation slices for VetHelp.

## Implemented slices

1. Alternative slot proposal flow: repository contract, BLoC and Material view.
2. Persistent correlation and idempotency keys for accepting an alternative.
3. Safe `SLOT_LOCKED_RETRY` handling and fenced terminal states.
4. Telemed waiting room state machine using backend `serverNow`, deadline and aggregate version.
5. Offline outbox policy, FIFO-per-aggregate queue, coalescing for editable entities and sync engine terminal states.

## Offline safety

The outbox accepts only non-financial, non-booking commands such as pet profile edits, triage drafts, message drafts, reminder acknowledgement, deferred attachment upload and notification preferences.

It never queues hold creation, alternative acceptance, appointment confirmation/cancellation, payment actions, telemed room joins, coverage checks or emergency decisions.

## Current integration gaps

- Flutter application shell, routing, secure token storage and concrete API clients.
- Backend alternative hold snapshot must include `alternativeSlot`, `alternativeExpiresAt`, `version` and `serverNow` for the mobile screen.
- Owner telemed waiting room read endpoint and room join contract.
- Isar persistence and encrypted local payload storage.
- WebSocket replay with `sequence` and `aggregateVersion`.

PostgreSQL/backend state machines remain authoritative. Local timers and mobile state only visualize server state.
