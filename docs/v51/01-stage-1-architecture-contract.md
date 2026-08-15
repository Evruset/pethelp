# VetHelp v51 — Этап 1: архитектурный контракт и migration plan

Дата: 12 июля 2026 года

Ветка: `agent/v51-stage-01-architecture`

Статус: реализовано, ожидает review

## Результат

Этап 1 фиксирует целевые границы до изменения stateful-доменов. UI не изменялся. Все будущие schema changes — additive и forward-only. Stage 0 остаётся историческим снимком; текущие статусы и порядок работ задаёт этот документ.

## Migration chain: P0 закрыт

Установленная история и git history подтверждают, что исходно применённая миграция называлась:

`1719380000000_harden_audit_compliance_metadata.js`

В checkout тот же byte-identical файл был переименован в `1719400000002_harden_audit_compliance_metadata.js`, из-за чего runner видел новую migration, а запись `171938…` — отсутствующим source. SHA-256 тела в обеих git-версиях:

`ac21455c6c89c22aa090b3301cbaca70a6cf1a32c1db30cffa6952d4c42f7821`

Исправление: восстановлено исходное имя `171938…`; новое имя `171940…0002` удалено. Тело и checksum не менялись, новая checksum не создавалась. Следующая уже существующая additive migration остаётся `1719400000003_add_insurance_consent_revoke.js`; будущие migrations получают новые монотонные имена и никогда не переписывают применённые файлы.

Проверено:

- текущая local DB: `migrate:up`, `migrate:verify`, backend startup и `/v1/health`;
- отдельная пустая DB `vethelp_v51_stage1_clean`: полный `migrate:up`, `migrate:verify`, backend startup и `/v1/health`;
- в обеих цепочках после восстановления порядок идёт `171938…`, `1719400000000…`, `1719400000001…`, `1719400000003…`.

## P0 authorization contract: закрыт

Capability `clinical.visit.complete` выдаётся только `CLINIC_VETERINARIAN`. Compatibility endpoint завершения приёма:

- controller больше не допускает `CLINIC_ADMIN`;
- service проверяет capability, JWT location scope и active DB membership внутри транзакции;
- admin denial выполняется до membership query;
- positive veterinarian, negative admin и inactive membership покрыты unit tests.

Это временный безопасный adapter: assignment check добавляется вместе с additive clinical visit schema. Целевой sign/amend contract определён ADR-0004; legacy free-text endpoint выводится после backfill и deprecation.

## Реестр решений

| ADR | Решение | Реализуется независимо как |
| --- | --- | --- |
| [ADR-0001](adr/0001-domain-source-of-truth.md) | booking/clinical/payment/telemed source of truth | domain schema + events/projections |
| [ADR-0002](adr/0002-capability-scope-model.md) | capability + clinic/location/assignment/data scope | evaluator family + negative tests |
| [ADR-0003](adr/0003-route-screen-ownership.md) | scoped route map и screen ownership | backend read model → route slice |
| [ADR-0004](adr/0004-clinical-visit-state-machine.md) | visit states, sections, sign/amend | clinical vertical slice |
| [ADR-0005](adr/0005-telemed-admin-doctor-split.md) | dispatcher и doctor workspace разделены | two projections/command families |
| [ADR-0006](adr/0006-realtime-replay-contract.md) | at-least-once + replay + snapshot/polling | domain-scoped replay slices |
| [ADR-0007](adr/0007-design-tokens-component-ownership.md) | shared semantic spec, native adapters | Stage 2 design system only |
| [ADR-0008](adr/0008-openapi-flags-rollout.md) | additive/OpenAPI-first/staged rollout | release contract per slice |

Зависимости ацикличны:

```text
domain boundaries
  -> capability scopes
      -> clinical visit
      -> telemed split -> clinical conclusion
      -> route ownership
  -> realtime envelope
route ownership -> design-system adapters
all contracts -> OpenAPI/flags/rollout
```

Проекции могут зависеть от domain events, но owning domain никогда не зависит от portal/mobile UI или от projection consumer. Clinical domain не вызывает telemed/payment/booking write APIs синхронно; междоменные результаты идут через outbox и reconciliation.

## Обновлённый backlog после Этапа 0

### P0 — выполнено в Этапе 1

- [x] восстановить исходное имя применённой migration `171938…` без новой checksum;
- [x] доказать existing/clean `migrate:verify` и startup;
- [x] удалить `CLINIC_ADMIN` из завершения приёма;
- [x] ввести doctor-only `clinical.visit.complete` и transactional membership check;
- [x] зафиксировать архитектурные решения до UI.

### Этап 2 — design system, без domain UI

- [ ] versioned semantic token schema;
- [ ] Next/Flutter adapters и shared primitive ownership;
- [ ] accessibility/responsive fixtures и visual baselines;
- [ ] v51 shell primitives за flag без mocked production data.

### Этап 3 — session, RBAC/ABAC

- [ ] centralized evaluator/resource descriptors/deny reasons;
- [ ] effective capabilities в session OpenAPI;
- [ ] clinic/location membership и revoked membership tests;
- [ ] assignment/data-category policies;
- [ ] cross-clinic, cross-location, unassigned visit/telemed negative matrix;
- [ ] мигрировать operational endpoints по capability families.

### Этапы 4–6 — backend vertical slices до UI

- [ ] clinic admin dashboard, appointment registry/detail и patient category-filtered reads;
- [ ] additive clinical visit schema/API/state machine/signature/amendments;
- [ ] backfill legacy summary с provenance и owner signed projection;
- [ ] telemed assignment/roster, admin dispatcher и clinic doctor commands;
- [ ] OpenAPI/client/contract/race/audit/outbox coverage для каждого slice.

### Этапы 7–9 — клиенты

- [ ] portal admin workspace и registries только после read models;
- [ ] portal assigned-doctor shift/visit/telemed workspaces;
- [ ] owner route parity, secure session/durable safe drafts и signed summaries;
- [ ] no production mocks; route и component flags имеют владельца/expiry.

### Этапы 10–13 — delivery/release

- [ ] domain replay/snapshot APIs, durable cursors, transport и polling fallback;
- [ ] end-to-end owner → admin → doctor → signed summary;
- [ ] security/a11y/performance/observability gates;
- [ ] staged cohorts, rollback drills, deprecation и финальная UAT.

## Contract gate для каждого следующего slice

Slice не начинает UI, пока не определены и не проверены:

1. authoritative aggregate/state transition;
2. endpoint/DTO/OpenAPI и unknown-enum behavior;
3. capability + clinic/location/assignment/data scope;
4. version/`If-Match`, idempotency и concurrency policy;
5. audit event, outbox envelope и replay/snapshot behavior;
6. additive migration, checksum и clean-DB verification;
7. feature flags, cohort, telemetry, rollback/forward-fix path.

## Verification evidence

Успешно:

- `npm run build`;
- targeted Jest: capability grant/deny и transactional location membership — 5/5;
- `npm run openapi:generate` и `node scripts/assert-openapi.cjs`;
- два последовательных OpenAPI export дали одинаковый SHA-256 `5bfb4a4de958194269252a122c9a0cff884418d9a7a6c9951cb83685d6dd4a93`;
- existing DB и отдельная clean DB: `migrate:up`, `migrate:verify`, startup, `/v1/health`;
- после isolated tests local backend восстановлен и healthy.

Полный isolated Jest: 54/62 tests, 19/24 suites. Вне scope Этапа 1 остаются восемь ранее выявленных failures: payment/MIS expectations конфликтуют с hardcoded `FEATURE_MIS_INTEGRATION=false` и `FEATURE_ONLINE_PAYMENTS=false`; один LiveKit test ожидает отсутствующий audit action `TELEMED_DOCTOR_JOINED_LIVEKIT`. Эти модули не изменялись. Их исправление должно идти отдельным backlog slice вместе с server-controlled flags/audit contract, а не маскироваться в архитектурном этапе.

## Definition of Done

- Все требуемые решения имеют alternatives, choice, consequences, backward compatibility, migration и rollback.
- Dependency graph ацикличен; UI не является prerequisite backend domain.
- Booking, clinical, payment и telemed можно развивать отдельными вертикальными срезами через versioned events/projections.
- Admin и doctor contracts разделены; clinical completion больше не разрешён администратору.
- Migration history восстановлена на исходное имя и проверена на существующей и чистой БД.
