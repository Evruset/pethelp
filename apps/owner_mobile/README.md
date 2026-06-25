# VetHelp Owner Mobile

Flutter-клиент владельца. Текущий local journey: owner home → выбор времени → создание hold → authoritative status readback.

## Local run

Перед запуском подними Docker Compose и выполни основной seed плюс `seed-local-identities.ts`. Затем передай owner JWT и `locationId` из JSON вывода `seed.ts`.

### Android emulator

```bash
cd apps/owner_mobile
flutter pub get
flutter run \
  --dart-define=VETHELP_API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=VETHELP_OWNER_JWT='<local-owner-jwt>' \
  --dart-define=VETHELP_DEMO_LOCATION_ID='<location-id>' \
  --dart-define=VETHELP_DEMO_PET_NAME='Демо-питомец'
```

### iOS simulator

Замените API base URL на `http://127.0.0.1:3000`:

```bash
flutter run \
  --dart-define=VETHELP_API_BASE_URL=http://127.0.0.1:3000 \
  --dart-define=VETHELP_OWNER_JWT='<local-owner-jwt>' \
  --dart-define=VETHELP_DEMO_LOCATION_ID='<location-id>'
```

`VETHELP_OWNER_JWT` — только local-development input. Production access/refresh tokens должны храниться в Keychain или Android Keystore и никогда не попадать в исходники, commit history или telemetry/crash logs.

## Implemented slices

1. Owner home с отдельными входами в телемедицину, запись и страховой контур.
2. Marketplace записи: выбор дня/окна, backend availability, create hold с `Idempotency-Key` и `X-Correlation-ID`.
3. Status screen выполняет защищённый readback hold и показывает только authoritative state.
4. Alternative slot proposal flow: owner backend snapshot, repository contract, BLoC и Material view.
5. Telemed waiting room state machine на основе backend `serverNow`, deadline и aggregate version.
6. Offline outbox policy, FIFO-per-aggregate queue, coalescing для editable entities и terminal sync states.

## Manual marketplace smoke

1. Открыть **«Записаться в клинику»**.
2. Выбрать день и свободный слот.
3. Нажать **«Отправить заявку»** один раз.
4. На status screen проверить `MANUAL_CONFIRM_PENDING` или `MIS_RESERVATION_PENDING`.
5. Нажать **«Обновить статус»** после действия со стороны клиники или mock МИС.

Idempotency key сохраняется в BLoC для выбранного slot на время текущей операции; correlation ID создаётся один раз на marketplace journey.

## Offline safety

Outbox принимает только не финансовые и не booking-команды: редактирование профиля питомца, triage drafts, message drafts, acknowledgement reminder, deferred attachment upload и notification preferences.

Он никогда не ставит в очередь create hold, accept alternative, appointment confirmation/cancellation, payment actions, telemed room joins, coverage checks или emergency decisions.

## Current integration gaps

- Public clinic catalog/search: `VETHELP_DEMO_LOCATION_ID` будет заменён выбором клиники из backend catalog.
- Secure production token storage and authentication lifecycle.
- Isar persistence and encrypted local payload storage.
- WebSocket replay with `sequence` and `aggregateVersion`.
- Owner LiveKit room-token issuance only after backend confirms doctor connection.
- Full video-call page and room-finished backend reconciliation UI.

PostgreSQL/backend state machines remain authoritative. Local timers and mobile state only visualize server state.
