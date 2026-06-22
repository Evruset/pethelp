# VetHelp MVP-1 — Booking Core

Backend-каркас для manual-clinic режима VetHelp.

## Реализовано

- слоты клиник и локальный `hold` в PostgreSQL;
- короткие интерактивные транзакции: `lock_timeout=50ms`, `statement_timeout=250ms`, затем `SELECT ... FOR UPDATE`;
- TTL по серверному времени PostgreSQL: `clock_timestamp()`;
- подтверждение клиникой, отмена владельцем и expiration worker;
- idempotency key, audit log и durable outbox relay;
- `SKIP LOCKED` только в background worker.

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
- `POST /internal/workers/expire-holds` — local/dev only, с `X-Worker-Key`.

В MVP передача `ownerId` в запросе допустима только для разработки. Перед public launch owner и clinic scope должны браться из authentication principal.
