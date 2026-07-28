# VetHelp Rich Demo

Локальный rich demo использует только Compose project `vethelp-alpha`,
существующий PostgreSQL volume и Clinic Portal на `http://127.0.0.1:3002`.
Механизм предназначен исключительно для локальной разработки и отключён при
`NODE_ENV=production`.

## Требования

- Docker Desktop с доступным Docker API;
- Node.js 22;
- `docker-compose.local.yml`;
- свободные порты 3000 и 3002.

## Canonical запуск

```bash
cd ~/work/pethelp-alpha
OPEN=0 ./dev/local/rich-demo-up.sh --no-open
```

Launcher поднимает PostgreSQL, mock MIS, mock cloud и backend, применяет
существующие migrations, выполняет один идемпотентный rich-demo seed, запускает
Clinic Portal и проверяет exact membership matrix, effective authority и
реальные queue/visits BFF JSON contracts. Повторный запуск безопасно обновляет
детерминированные demo fixtures без удаления volume.

Успешный запуск заканчивается строкой `VetHelp rich demo is ready.`:

- backend health: `http://127.0.0.1:3000/v1/health`;
- Clinic Portal: `http://127.0.0.1:3002`;
- selector профилей: `.dev-local/rich-demo/demo-sessions.html`.

Профили включают reception, admin, veterinarian и multi-location сценарии.
`revoked`, `inactive` и `no-membership` являются ожидаемыми controlled denial.
Авторитетным источником полномочий остаётся backend effective session, а не
роль из URL или browser state.

## Проверки

```bash
node --test dev/local/verify-rich-demo-sessions.test.cjs
DEMO_SESSIONS_JSON=.dev-local/rich-demo/demo-sessions.json \
  node dev/local/verify-rich-demo-sessions.cjs
DEMO_SESSIONS_JSON=.dev-local/rich-demo/demo-sessions.json \
  node dev/local/verify-rich-demo-security.cjs
```

Одноразовый login code живёт 45 секунд, атомарно потребляется сервером и не
сохраняется в URL. Session cookie — HttpOnly, SameSite=Strict, максимум 30
минут. Generated artifacts имеют private permissions и не должны добавляться
в Git.

## Остановка

```bash
./dev/local/rich-demo-up.sh --stop
```

Команда завершает Portal, очищает pending bootstrap codes и останавливает
canonical Compose project без удаления PostgreSQL volume.

## Диагностика

- Если Docker API не отвечает, launcher ограничивает каждый `docker info`
  десятью секундами и завершится с понятной ошибкой.
- Backend log: `.dev-local/rich-demo/logs/` и
  `docker compose -p vethelp-alpha -f docker-compose.local.yml logs --tail=300 backend`.
- Portal log: `.dev-local/rich-demo/logs/clinic-portal.log`.
- Не используйте старые `README-VetHelp-*` или отдельные `*.command` как
  canonical инструкции.
