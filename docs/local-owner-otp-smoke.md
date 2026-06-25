# Local owner OTP smoke

Этот сценарий предназначен только для local/development окружения. В development backend возвращает `developmentCode`; это не SMS-провайдер и не должно включаться в production.

## Подготовка

1. Обновить checkout до `main`.
2. Убедиться, что `docker compose -f docker-compose.local.yml ps` не показывает старый backend на порту `3000` и старый PostgreSQL на порту `5432`.
3. Запустить local stack и миграции:

```bash
cd backend
npm run migrate:up
npm run start:dev
```

Или использовать `docker-compose.local.yml`, если порты свободны.

## API smoke

Запросить код:

```bash
curl -fsS -X POST http://127.0.0.1:3000/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+79991234567"}' | python3 -m json.tool
```

В development ответ содержит `challengeId` и `developmentCode`. Использовать их в следующем запросе:

```bash
curl -fsS -X POST http://127.0.0.1:3000/v1/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+79991234567","challengeId":"<challengeId>","code":"<developmentCode>","deviceName":"local-smoke"}' | python3 -m json.tool
```

Ответ содержит access token и refresh token. Проверка профиля:

```bash
curl -fsS http://127.0.0.1:3000/v1/owner/me \
  -H 'Authorization: Bearer <accessToken>' | python3 -m json.tool
```

## Flutter smoke

```bash
cd apps/owner_mobile
flutter run -d chrome -t lib/owner_journey_main.dart \
  --dart-define=VETHELP_API_BASE_URL=http://127.0.0.1:3000
```

1. Нажать «Войти».
2. Ввести номер в E.164, например `+79991234567`.
3. Нажать «Получить код».
4. В local development экране виден `developmentCode`.
5. Ввести код и подтвердить.
6. Открывается кабинет владельца.
7. Открыть каталог, выбрать локацию и убедиться, что marketplace получает bearer token из runtime session.

## Production boundary

В production без SMS delivery provider `POST /v1/auth/otp/request` возвращает `OTP_DELIVERY_UNAVAILABLE`. Не включать development code в production и не передавать медицинские детали через SMS.
