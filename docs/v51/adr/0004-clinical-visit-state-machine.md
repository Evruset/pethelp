# ADR-0004: clinical visit state machine

- Статус: принято для v51
- Дата: 2026-07-12
- Зависимости: ADR-0001, ADR-0002

## Контекст

Свободный `clinical_summary` на booking hold не поддерживает назначение, versioned sections, обязательные поля, подпись и amendment. Администратор не должен создавать, подписывать или менять клиническое заключение.

## Альтернативы

1. Продолжать обновлять одно текстовое поле и завершать booking. Не даёт доказуемой истории.
2. Хранить mutable JSON document на appointment. Гибко, но подпись и конкурентные секции остаются неявными.
3. Отдельный visit aggregate, versioned sections и immutable signature/amendment chain.

## Решение

Выбран вариант 3.

Состояния агрегата:

```text
NOT_STARTED -> IN_PROGRESS -> READY_TO_SIGN -> SIGNED
                    ^             |
                    +-------------+  validation failure returns no transition
SIGNED -> AMENDED (append-only amendment; latest effective view changes)
NOT_STARTED/IN_PROGRESS -> CANCELLED (только допустимая operational причина)
```

Запрещены `NOT_STARTED -> SIGNED`, любые изменения подписанной версии, admin sign/complete и запись врачом без assignment. `AMENDED` не перезаписывает signature: создаётся новая amendment record с reason, author, timestamp, base version и собственной подписью/attestation.

Минимальные секции: complaints, anamnesis, vitals, examination, diagnoses, procedures, prescriptions, recommendations, follow-up, consent evidence и attachments metadata. Schema/validation version записывается вместе с visit. `READY_TO_SIGN` требует server-side validation; точные обязательные поля задаются versioned rules, а не UI.

Команды используют `If-Match`, idempotency key для sign/amend, actor capability, active location membership и assignment check в транзакции. События: `clinical.visit.started.v1`, `section.saved.v1`, `ready_to_sign.v1`, `signed.v1`, `amended.v1`, `cancelled.v1`. Audit отдельно фиксирует sensitive reads, writes, validation denial и signature.

Только `SIGNED`/`AMENDED` projection доступна owner. Booking logistics может стать `COMPLETED` независимо, но не публикует clinical content.

## Последствия

- Положительные: медицинская история воспроизводима; concurrent edits обнаруживаются; admin boundary формализована.
- Отрицательные: больше таблиц/команд и UX конфликтов; обязательны retention, access logging и reconciliation.

## Обратная совместимость

Legacy завершённые holds импортируются как `LEGACY_IMPORTED`, не как доказанно подписанные. Compatibility endpoint временно остаётся doctor-only и будет адаптером к новому sign flow только после backfill. Клиенты различают legacy summary и signed conclusion.

## Миграция

1. Additive schema: visits, assignments, section revisions, signatures, amendments, outbox indexes.
2. OpenAPI и contract/negative/race tests до portal UI.
3. Backfill legacy records с provenance; включить shadow projection.
4. Включить writes для пилотных locations, затем owner reads.
5. Удалить legacy completion после telemetry и deprecation window.

## Rollback

До подписей — отключить write flag и вернуть legacy read. После подписей — только forward-fix; immutable records сохраняются, UI может временно читать стабильную последнюю projection. Нельзя down-migration удалять clinical history.
