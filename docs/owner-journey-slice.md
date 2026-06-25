# Owner journey slice: current implementation

Первый срез клиентского пути находится в `apps/owner_mobile`.

## Что уже добавлено

- `lib/owner_journey_main.dart` — отдельная запускаемая точка входа для единого пути гостя и владельца.
- `lib/features/owner_journey/owner_journey_page.dart` — оболочка кабинета владельца: главная, записи, питомец, телемедицина.
- `lib/features/owner_journey/phone_entry_page.dart` — телефонный boundary до создания учётной записи.

## Запуск UI-среза

```bash
cd apps/owner_mobile
flutter pub get
flutter run -t lib/owner_journey_main.dart \
  --dart-define=VETHELP_API_BASE_URL=http://10.0.2.2:3000
```

Для локальной проверки существующего защищённого booking-flow добавь значения из `seed-local-identities.ts`:

```bash
flutter run -t lib/owner_journey_main.dart \
  --dart-define=VETHELP_API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=VETHELP_OWNER_JWT='<local-owner-jwt>' \
  --dart-define=VETHELP_DEMO_LOCATION_ID='<location-id>' \
  --dart-define=VETHELP_DEMO_PET_ID='<pet-id>'
```

## Честные границы этого среза

Экран не подменяет отсутствующие серверные контракты:

- ввод телефона не создаёт аккаунт, не отправляет OTP и не хранит токен;
- у гостя ещё нет публичного backend-каталога клиник и доступности;
- телемедицинская карточка не создаёт обращение, оплату или видеосессию локально;
- существующий booking-flow открывается только при локальном owner JWT и location ID;
- статусы записи остаются authoritative на стороне backend.

## Следующий технический шаг

1. Backend: OTP request/verify + refresh-session + owner profile.
2. Backend: публичный каталог clinic location и read-only availability.
3. Flutter: заменить `VETHELP_DEMO_LOCATION_ID` выбором clinic location из каталога.
4. Flutter/API: создать telemed case и только после server-side payment state открыть waiting room.
