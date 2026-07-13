# ADR-0008: OpenAPI-first, feature flags и staged rollout

- Статус: принято для v51
- Дата: 2026-07-12
- Зависимости: ADR-0001—ADR-0007

## Контекст

Отсутствующие admin/doctor read models нельзя компенсировать UI mocks. Stateful schema, API и два клиента должны изменяться в безопасном порядке. Текущие flags — compile-time object и недостаточны для location cohort, kill switch и audit.

## Альтернативы

1. UI-first с временными mocks. Быстро демонстрируется, но создаёт ложный contract.
2. Big-bang schema/API/clients. Меньше переходных веток, но большой blast radius.
3. Additive schema → OpenAPI/contract tests → generated clients → hidden UI → staged cohorts.

## Решение

Выбран вариант 3.

Порядок каждого вертикального среза:

1. additive forward-only migration и checksum verification;
2. server DTO/state/capability/audit/outbox contract;
3. deterministic OpenAPI export и semantic diff review;
4. generated/typed client update;
5. backend contract, negative, race и migration tests;
6. UI за server-controlled flag, без production mocks;
7. shadow reads/dual-read comparison при переносе source of truth;
8. cohorts: internal → test clinic/location → percentage → general availability;
9. удалить legacy path только после telemetry/deprecation window.

Flag descriptor: stable key, owner, purpose, default, allowed actor/location cohort, prerequisites, expiry date, kill-switch behavior и audit policy. Security enforcement не выключается client flag. Server flags разделяются минимум на read exposure, write acceptance и projection consumption, чтобы rollback не требовал down migration.

Начальный набор: `CAPABILITY_EVALUATOR_V1`, `CLINICAL_VISIT_WRITES_V1`, `CLINICAL_OWNER_READS_V1`, `CLINIC_ADMIN_READ_MODELS_V1`, `CLINIC_TELEMED_DISPATCH_V1`, `CLINIC_TELEMED_DOCTOR_V1`, `REALTIME_SUBSCRIPTION_V1`, `PORTAL_V51_SHELL`, `OWNER_V51_ROUTES`. Имена — contract; реализация flag service относится к Этапу 3/12.

Migration rule: применённый filename/checksum immutable. Исправления только новой additive migration; destructive cleanup — отдельная поздняя migration после доказанного отсутствия readers. Восстановление потерянного исходного имени `1719380000000_harden_audit_compliance_metadata.js` является ремонтом истории, а не новой миграцией.

## Последствия

- Положительные: клиенты компилируются против реального API; локальный rollback быстрый; migration history проверяема.
- Отрицательные: временно существуют dual paths и больше telemetry; flags требуют владельца и удаления.

## Обратная совместимость

Response fields добавляются optional; enum consumers имеют unknown fallback. Breaking removals требуют новой API version/deprecation. Старые клиенты продолжают legacy reads до минимально поддерживаемой версии.

## Миграция

Каждый slice ведёт release checklist с migration IDs, OpenAPI diff, client versions, flags, cohort, dashboards и exit criteria. Backlog в `01-stage-1-architecture-contract.md` является порядком реализации.

## Rollback

Сначала выключить writes, затем new reads/UI и вернуть projection consumer/legacy read. Additive schema остаётся. Уже принятые commands завершаются idempotently; для immutable clinical/audit/payment данных применяется forward-fix, не down migration.
