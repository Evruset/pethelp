# ADR-0005: разделение telemed admin dispatcher и doctor workspace

- Статус: принято для v51
- Дата: 2026-07-12
- Зависимости: ADR-0001, ADR-0002, ADR-0004

## Контекст

Текущий `/telemed/vet` и API обслуживают global `TELEMED_VETERINARIAN`, включая self-assign. Clinic admin dispatcher отсутствует, а clinic route блокируется. Admin и doctor видят разные данные и выполняют несовместимые действия; объединение их на одном API повышает риск клинической записи администратором.

## Альтернативы

1. Оставить global self-assign для всех клиник. Меньше изменений, но нет clinic/location ownership и контролируемого dispatch.
2. Один endpoint/page с role switches. Переиспользует UI, но смешивает payload и authorization.
3. Общий telemed case aggregate, отдельные role-specific projections/commands и clinical conclusion в clinical domain.

## Решение

Выбран вариант 3.

Admin dispatcher, scoped clinic/location:

- читает unassigned/assigned/urgent operational projection без clinical draft;
- назначает/переназначает доступного clinic doctor;
- инициирует допустимый owner contact/fallback/onsite route;
- не стартует clinical session от лица врача и не пишет conclusion.

Doctor workspace:

- читает только назначенные ему или явно claimable cases;
- принимает назначение, стартует/connects session, сохраняет clinical draft;
- подписывает результат через clinical visit capability;
- не меняет финансовые состояния и не назначает других врачей.

Assignment — versioned relation с clinic, location, doctor, assignedBy, reason и timestamp. Race назначения решается optimistic version/row lock: один case не может иметь два active assignments. Все commands требуют idempotency key, `If-Match`, membership/availability check, audit и outbox.

Telemed владеет case/session/media lifecycle. Clinical domain владеет подписанным conclusion; payment владеет capture/void/refund. Завершение комнаты не равняется подписанию заключения. Owner summary появляется только из signed clinical projection.

Legacy platform queue остаётся отдельным pool и не получает clinic admin scope автоматически. Миграция identity между `TELEMED_VETERINARIAN` и clinic doctor задаётся explicit membership/roster, не совпадением email.

## Последствия

- Положительные: least privilege, ясный dispatch audit, независимое масштабирование projections.
- Отрицательные: два API/client surfaces; нужны availability и assignment reconciliation.

## Обратная совместимость

Существующий owner flow и `/v1/telemed/vet/*` сохраняются для platform pool. Новые `/v1/clinic/:clinicId/locations/:locationId/telemed/*` вводятся additive. Event consumers принимают schema version и игнорируют неизвестные поля.

## Миграция

1. Additive assignment/roster schema и admin projection.
2. OpenAPI contracts и negative/race tests.
3. Shadow projection из текущих cases; сверка счётчиков.
4. Пилот clinic dispatch, затем clinic doctor workspace и clinical conclusion.
5. Platform self-assign остаётся или выводится отдельно на основе telemetry.

## Rollback

Флаги отдельно отключают dispatcher и clinic doctor commands; platform queue продолжает работать. Созданные assignments сохраняются для audit и закрываются compensating command. Подписанные clinical records не откатываются.
