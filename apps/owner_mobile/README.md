# VetHelp Owner Mobile

Flutter-клиент владельца для VetHelp. Первый реализованный journey — предложение альтернативного слота Level-C.

## Local development

```bash
cd apps/owner_mobile
flutter pub get
flutter run \
  --dart-define=VETHELP_API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=VETHELP_DEV_ACCESS_TOKEN=<short-lived-owner-jwt>
```

Для iOS simulator API обычно доступен как `http://127.0.0.1:3000`; для Android emulator используется `http://10.0.2.2:3000`.

`VETHELP_DEV_ACCESS_TOKEN` разрешён только для local development. Production credential выдаёт auth flow и хранит в platform secure storage.

## Implemented invariants

- `X-Correlation-ID` создаётся на journey и добавляется единым API client.
- `Idempotency-Key` сохраняется перед accept/decline и повторно используется при retry.
- `If-Match` передаёт версию hold; stale version приводит к authoritative refresh.
- UI таймер вычисляется из `serverNow` snapshot и служит только визуализацией. Backend/PostgreSQL решает TTL и финальный state.
- Booking, payment, alternative-slot, telemed и insurance actions не попадают в offline queue.
- Offline outbox предназначен только для safe editable commands: pet profile, drafts, reminder/read and preferences.

## Current screen

`AlternativeSlotPage` displays source/proposed slots, protected 15 minute decision state, native decline confirmation, soft retry for retryable `409`, and fenced states for terminal conflict/expiry.
