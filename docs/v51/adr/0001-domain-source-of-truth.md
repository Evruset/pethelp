# ADR-0001: источники истины и границы stateful-доменов

- Статус: принято для v51
- Дата: 2026-07-12
- Зависимости: нет

## Контекст

Сейчас `booking_holds` и `appointments` одновременно несут operational-состояние записи и часть клинического результата через `clinical_summary`. Payment и telemed уже имеют собственные агрегаты. Расширение этой модели клиническими секциями, подписью и amendments сделало бы booking владельцем медицинской записи и связало бы независимые rollout.

## Альтернативы

1. Расширять `booking_holds` до единого агрегата записи, оплаты и визита. Проще первый релиз, но невозможно независимо версионировать и защищать клинические данные.
2. Общая таблица workflow со всеми статусами. Унифицирует инфраструктуру, но создаёт неявные переходы и общий blast radius.
3. Раздельные bounded contexts с идентификаторами-ссылками и событиями. Требует явной eventual consistency, зато сохраняет ownership и независимый rollout.

## Решение

Выбран вариант 3.

| Домен | Источник истины | Что ему не принадлежит |
| --- | --- | --- |
| Booking | hold, slot reservation, appointment logistics, arrival/reschedule/cancel | clinical draft/signature, payment ledger, media session |
| Clinical visit | visit, assigned clinician, versioned sections, consent evidence, signature, amendment chain | slot capacity, capture/refund, call transport |
| Payment | intent, authorization/capture/void/refund/reconciliation | booking transition policy, visit completion |
| Telemed | case dispatch, session lifecycle, participants, transport evidence | signed clinical conclusion и payment ledger |

`appointment_id` связывает booking с onsite visit; `telemed_case_id` связывает telemed с telemed visit. Ссылки не дают вызывающему домену права менять чужую таблицу. Команды изменяют один authoritative aggregate в транзакции и публикуют versioned outbox event. Проекции других доменов обновляются идемпотентным consumer.

Booking `COMPLETED` означает завершённую логистику приёма, а `visit.signed` — доступность подписанного клинического результата. Owner API не выводит заключение, пока visit не `SIGNED`/`AMENDED` и его projection не опубликован.

## Последствия

- Положительные: независимые state machines, capability и retention; изолированные миграции; повтор событий не меняет медицинскую историю.
- Отрицательные: появляются корреляция, lag и reconciliation jobs; UI должен показывать временное состояние «визит завершён, заключение готовится».
- Запрещены cross-schema updates из booking в clinical и наоборот после ввода clinical aggregate.

## Обратная совместимость

Существующие booking/payment/telemed API сохраняются. Legacy `POST /v1/clinic/booking-holds/:holdId/complete` временно остаётся doctor-only compatibility command, но не считается целевым visit API. `clinical_summary` читается только как legacy fallback до backfill и выключения флага.

## Миграция

1. Additive migration создаёт `clinical_schema`, visit aggregate, sections, assignments и immutable signatures/amendments.
2. Новый API пишет только clinical aggregate и outbox.
3. Backfill создаёт legacy visits из завершённых holds с происхождением `LEGACY_IMPORT`, не подделывая подпись врача.
4. Dual-read сравнивает проекцию с legacy summary; затем owner reads переключаются на clinical projection.
5. Legacy completion endpoint удаляется отдельной breaking API-версией после нулевого трафика.

## Rollback

До переключения reads флаг отключает новый write path. После начала dual-write rollback останавливает consumer и возвращает reads к legacy полю; созданные clinical rows не удаляются. После подписанных visits допускается только forward-fix: историю подписи и amendments откатывать/удалять нельзя.
