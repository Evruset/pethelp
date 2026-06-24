# VetHelp MVP-1 — Booking Core

Backend-каркас для manual-clinic режима VetHelp.

## Реализовано

- слоты клиник и локальный `hold` в PostgreSQL;
- короткие интерактивные транзакции: `lock_timeout=50ms`, `statement_timeout=250ms`, затем `SELECT ... FOR UPDATE`;
- TTL по серверному времени PostgreSQL: `clock_timestamp()`;
- подтверждение клиникой, отмена владельцем и expiration worker;
- idempotency key, audit log и durable outbox relay;
- `SKIP LOCKED` только в background worker;
- read API Level-C очереди ручного подтверждения: строгий FIFO, PostgreSQL `serverNow` для SLA countdown и DB-backed location scope check.

## Локальный запуск

```bash
cd backend
cp .env.example .env
npm install
docker compose up -d postgres
npm run migration:run
npm run seed
npm run start:dev
```

Проверка:

```bash
curl http://localhost:3000/health
```

## Основные маршруты

- `GET /v1/clinic-locations/:id/slots`
- `POST /v1/booking-holds`
- `GET /v1/booking-holds/:id`
- `POST /v1/booking-holds/:id/release`
- `POST /v1/clinic/booking-holds/:id/confirm`
- `GET /v1/clinic/locations/:locationId/booking-queue?limit=50` — только `CLINIC_RECEPTIONIST`/`CLINIC_ADMIN`, требуется scope локации и активная membership.
- `POST /internal/workers/expire-holds` — local/dev only, с `X-Worker-Key`.

### Контракт очереди Level-C

Endpoint возвращает только заявки в `MANUAL_CONFIRM_PENDING` для конкретной локации.

```json
{
  "locationId": "uuid",
  "serverNow": "2026-06-24T19:05:00.000Z",
  "items": [
    {
      "holdId": "uuid",
      "version": 7,
      "manualConfirmPendingAt": "2026-06-24T19:02:00.000Z",
      "confirmationSlaExpiresAt": "2026-06-24T19:17:00.000Z",
      "slot": {
        "id": "uuid",
        "startsAt": "2026-06-25T10:00:00.000Z",
        "endsAt": "2026-06-25T10:30:00.000Z"
      },
      "pet": { "id": "uuid", "name": "Барсик", "species": "cat" },
      "service": { "displayName": "Первичный приём" }
    }
  ]
}
```

Очередь сортируется в backend: `state_changed_at ASC, hold_id ASC`. Клиент не должен менять этот порядок локальной сортировкой. `serverNow` является базой для визуального SLA countdown; окончательное SLA-решение остаётся на backend.

В MVP передача `ownerId` в запросе допустима только для разработки. Перед public launch owner и clinic scope должны браться из authentication principal.
