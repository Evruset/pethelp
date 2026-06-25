# VetHelp Owner Mobile

This folder contains owner-side mobile implementation slices for VetHelp.

## Local run

```bash
cd apps/owner_mobile
flutter pub get
flutter run \
  --dart-define=VETHELP_API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=VETHELP_OWNER_JWT=<local-owner-jwt>
```

`VETHELP_OWNER_JWT` is a local-development input only. Production access/refresh tokens must be held in Keychain or Android Keystore and never compiled into the app.

The launcher accepts one UUID at a time: a hold UUID opens the alternative-slot journey; a telemed session UUID opens the waiting room.

## Implemented slices

1. Runnable Flutter dev launcher with no hardcoded credentials.
2. Alternative slot proposal flow: owner backend snapshot, repository contract, BLoC and Material view.
3. Persistent correlation and idempotency keys for accepting an alternative.
4. Safe `SLOT_LOCKED_RETRY` handling and fenced terminal states.
5. Telemed waiting room state machine using backend `serverNow`, deadline and aggregate version.
6. Offline outbox policy, FIFO-per-aggregate queue, coalescing for editable entities and sync engine terminal states.

## Offline safety

The outbox accepts only non-financial, non-booking commands such as pet profile edits, triage drafts, message drafts, reminder acknowledgement, deferred attachment upload and notification preferences.

It never queues hold creation, alternative acceptance, appointment confirmation/cancellation, payment actions, telemed room joins, coverage checks or emergency decisions.

## Current integration gaps

- Secure production token storage and authentication lifecycle.
- Isar persistence and encrypted local payload storage.
- WebSocket replay with `sequence` and `aggregateVersion`.
- Owner LiveKit room-token issuance only after backend confirms doctor connection.
- Full video-call page and room-finished backend reconciliation UI.

PostgreSQL/backend state machines remain authoritative. Local timers and mobile state only visualize server state.
