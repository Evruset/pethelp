# VetHelp Clinic Portal

Первый frontend-срез для клиник Level C: защищённая очередь `MANUAL_CONFIRM_PENDING` с backend FIFO, синхронизированным SLA countdown и подтверждением hold.

## Локальный запуск

```bash
cd apps/clinic-portal
cp .env.example .env.local
npm install
npm run dev
```

Для локальной сессии браузера должен получить HTTP-only cookie `vethelp_clinic_session` от auth/BFF слоя. Cookie содержит подписанный JWT сотрудника с `roles`, `clinicIds` и `locationIds`. Frontend повторно проверяет claims на server-side; backend остаётся финальным ABAC enforcement.

## Route

```text
/clinics/:clinicId/locations/:locationId/queue
```

UI получает snapshot через Next.js BFF, а не хранит bearer token в браузерном JavaScript.

### SLA semantics

- `serverNow` приходит из PostgreSQL через backend и служит базой countdown.
- За три минуты до истечения SLA строка получает critical state и доступную текстовую метку.
- После истечения SLA `Подтвердить` блокируется в UI; backend остаётся единственным источником финального SLA решения.
- Polling каждые 15 секунд является fallback до подключения WebSocket event replay.

### Дальнейшие срезы

1. WebSocket replay с sequence/aggregate version.
2. Action drawer для предложения альтернативного слота.
3. Location selector, работающий только по разрешённым `locationIds`.
4. Playwright E2E сценарии 403, FIFO, SLA risk и conflict retry.
