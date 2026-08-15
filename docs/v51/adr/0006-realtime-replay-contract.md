# ADR-0006: realtime delivery и replay contract

- Статус: принято для v51
- Дата: 2026-07-12
- Зависимости: ADR-0001, ADR-0002

## Контекст

Booking уже имеет outbox sequence/version replay, но общего transport subscription и durable client cursor нет. WebSocket/SSE доставка не может быть источником истины: соединения рвутся, сообщения дублируются и приходят не по порядку.

## Альтернативы

1. Polling только snapshot endpoints. Надёжно, но медленно и дорого для queue/telemed.
2. WebSocket state messages без replay. Низкая задержка, но reconnect создаёт пропуски.
3. At-least-once notifications + authoritative cursor replay + snapshot fallback.

## Решение

Выбран вариант 3. Source of truth — domain state и transactional outbox; realtime transport лишь сигнализирует о новых versioned events.

Единый envelope:

```json
{
  "eventId": "uuid",
  "sequence": "global-monotonic-string",
  "eventType": "clinical.visit.signed.v1",
  "schemaVersion": 1,
  "aggregateType": "clinical_visit",
  "aggregateId": "uuid",
  "aggregateVersion": 4,
  "occurredAt": "RFC3339",
  "correlationId": "uuid|null",
  "causationId": "uuid|null",
  "payload": {}
}
```

Алгоритм клиента:

1. сохранять последний подтверждённый `sequence` durable по user/scope;
2. на reconnect вызывать replay `afterSequence`; применять только событие с более новой aggregate version;
3. deduplicate по `eventId`; gap/version regression запускает scoped snapshot refresh;
4. подтверждать cursor только после локального применения;
5. при transport failure использовать bounded polling с jitter/backoff;
6. при cursor expiry/retention response сбрасывать только affected scope через snapshot.

Replay authorization повторяет обычный read capability, membership, assignment и data-category filtering. Payload не содержит данных, недоступных текущему actor; нельзя фильтровать sensitive fields только на клиенте. Ordering гарантируется по `sequence` в пределах replay stream; cross-domain business ordering достигается correlation/causation и reconciliation, не общей транзакцией.

Existing booking replay считается первым совместимым slice; его `eventSequence` alias сохраняется до client migration.

## Последствия

- Положительные: reconnect без потери, идемпотентные consumers, polling fallback.
- Отрицательные: durable cursor/retention и snapshot endpoints обязательны; «ровно один раз» не обещается.

## Обратная совместимость

Существующий `GET /v1/booking-holds/:holdId/events` сохраняется. Новые поля additive; неизвестные event types игнорируются с telemetry. Клиенты без subscription продолжают polling.

## Миграция

1. Зафиксировать envelope в OpenAPI и contract tests.
2. Ввести domain-scoped replay endpoints и retention error.
3. Добавить durable cursor в Flutter/portal, затем transport subscription.
4. Запустить shadow gap metrics перед снижением polling frequency.

## Rollback

Отключить transport и вернуть polling/replay. Cursor остаётся пригодным. При дефектном event producer consumer останавливается на последней корректной версии, читает snapshot и ждёт forward-fix; outbox history не переписывается.
