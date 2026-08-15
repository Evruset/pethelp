# ADR-0002: capability и resource-scope модель

- Статус: принято для v51
- Дата: 2026-07-12
- Зависимости: ADR-0001

## Контекст

Role guard удобен как coarse filter, но не выражает clinic/location membership, назначение на визит или telemed case и категорию данных. JWT scopes могут устареть до истечения токена. P0-конфликт позволял `CLINIC_ADMIN` завершать клинический приём.

## Альтернативы

1. Только RBAC по enum ролей. Недостаточно для assignment и cross-location защиты.
2. Все правила хранить как динамическую policy DSL. Гибко, но слишком сложно для аудита и первоначального rollout.
3. Стабильный каталог capability + кодовый evaluator + транзакционные DB attributes. Явно тестируется и допускает дальнейшую policy externalization.

## Решение

Выбран вариант 3, deny-by-default.

Authorization request содержит `actor`, `capability`, `resource` и `context`:

```text
actor: subjectId, roles
capability: clinical.visit.complete
resource: clinicId, locationId, aggregateType, aggregateId, dataCategory
context: assignmentRequired, currentState
```

Role только предоставляет кандидатный capability. Финальное разрешение требует:

1. capability в server-side role grant catalog;
2. совпадающий JWT clinic/location claim как ранний reject;
3. активную DB membership в той же транзакции, что защищённая команда;
4. assignment/relationship, когда capability это требует;
5. допустимую data category и state transition.

Ключевые семейства: `booking.*`, `appointment.*`, `patient.admin.*`, `patient.clinical.*`, `clinical.visit.*`, `telemed.dispatch.*`, `telemed.case.*`, `schedule.*`, `quality.*`. Capability атомарны; wildcard не выдаётся клиенту.

P0 capability `clinical.visit.complete` предоставляется только `CLINIC_VETERINARIAN`. `CLINIC_ADMIN` и `CLINIC_RECEPTIONIST` его не получают. Текущий compatibility endpoint дополнительно требует активную location membership. После ввода assignments он потребует назначение на visit; отсутствие assignment schema до additive migration явно остаётся временным ограничением.

Session response в Этапе 3 возвращает effective capabilities и доступные clinic/location scopes как UX hint. Backend никогда не доверяет этому списку как authorization proof. Denial наружу нормализуется без раскрытия существования чужого ресурса; внутренний audit хранит reason code.

## Последствия

- Положительные: отрицательная матрица тестируется единообразно; отозванная membership действует немедленно; UI и API говорят одним capability vocabulary.
- Отрицательные: дополнительные DB reads/locks; нужен кэш только для безопасных read decisions, но не для clinical writes.
- Все stateful commands получают capability, scope, version, idempotency и audit/outbox contract.

## Обратная совместимость

Существующие `@Roles` остаются coarse guards. Capability checks добавляются внутри services по вертикальным срезам. Старые токены без capability payload продолжают работать, потому что grants вычисляет сервер. P0 — намеренное ограничение: admin completion теперь получает 403.

## Миграция

1. Ввести типизированный capability catalog; P0 `clinical.visit.complete` уже подключён.
2. Добавить evaluator и resource descriptors, затем negative contract tests.
3. Additive migrations создают visit/telemed assignment и при необходимости capability overrides.
4. Переводить endpoints по одному, сохраняя `@Roles` как внешний фильтр.
5. Добавить effective capabilities в session API и сгенерированные clients.

## Rollback

Каждое семейство evaluator включается отдельным server flag. При rollback возвращается прежняя проверка для operational actions. Clinical completion не возвращается администратору: аварийный путь — временная выдача doctor role с активной membership и обязательным security audit, а не ослабление capability.
