# VetHelp Clinic Portal

B2B-портал для клиник Level C: защищённая очередь `MANUAL_CONFIRM_PENDING` с backend FIFO, server-synchronised SLA countdown, подтверждением и предложением альтернативного времени.

## Локальный запуск

```bash
cd apps/clinic-portal
cp .env.example .env.local
npm install
npm run build
npm run dev -- --port 3001
```

`npm install` используется намеренно: отдельный lockfile портала пока не зафиксирован в репозитории.

Для локальной сессии браузер получает HTTP-only cookie `vethelp_clinic_session` от dev-only BFF endpoint. Cookie содержит подписанный JWT сотрудника с `roles`, `clinicIds` и `locationIds`. Frontend повторно проверяет claims на server-side; backend остаётся финальным ABAC enforcement.

## Локальный B2B smoke

После старта local stack, основного seed, `seed-local-identities.ts` и `seed-local-clinic-employee.ts` создай набор заявок для portal:

```bash
docker compose -p "$PROJECT" -f "$REPO/docker-compose.local.yml" exec -T backend \
  npx ts-node /workspace/backend/scripts/seed-local-clinic-queue.ts
```

Скрипт создаёт три новые Level-C заявки в `MANUAL_CONFIRM_PENDING` для demo owner/pet и печатает `clinicId`, `locationId`, `holdId` и SLA. Они отсортированы backend по `manualConfirmPendingAt`:

- первая строка уже находится в critical state: SLA истекает примерно через две минуты;
- последующие строки имеют запас примерно 10 и 14 минут;
- слоты помечаются `LOCKED_BY_HOLD`, поэтому fixture соответствует реальной read model, а не рисует UI-данные напрямую.

Открой маршрут из вывода скрипта и нажми **«Обновить»**. Для проверки state transitions:

- **«Подтвердить»** переводит заявку через backend workflow и она исчезает из списка `MANUAL_CONFIRM_PENDING`;
- **«Другое время»** открывает drawer, где предложение альтернативного слота переводит исходную заявку в `ALTERNATIVE_PENDING`; очередь также обновляется authoritative snapshot.

## Route

```text
/clinics/:clinicId/locations/:locationId/queue
```

UI получает snapshot через Next.js BFF и не хранит bearer token в browser JavaScript.

## SLA и безопасность

- `serverNow` приходит из PostgreSQL через backend и является базой countdown.
- За три минуты до истечения SLA строка получает critical state с текстовой меткой; цвет не является единственным сигналом.
- После истечения SLA действия блокируются в UI, а backend остаётся единственным источником финального SLA решения.
- FIFO задаёт SQL `ORDER BY`, не браузер.
- BFF, server-side page и backend повторно проверяют `clinicId`/`locationId`; URL tampering приводит к `403`.
- Polling каждые 15 секунд остаётся fallback до подключения WebSocket event replay.

## Следующие срезы

1. Playwright E2E сценарии 403, FIFO, SLA risk, confirm и conflict retry.
2. WebSocket replay с sequence/aggregate version.
3. Location selector только по разрешённым `locationIds`.
