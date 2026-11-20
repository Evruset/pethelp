# Предметные контракты Vetora/PetDoc для Codex

**Status:** `PROPOSED_FOR_PO_APPROVAL` · продуктовые тексты v0.1.0 · integration pack v0.2.0.

Это не runtime source of truth и не альтернатива Jira, нормативному Confluence, действующим API/DTO/ADR или `$adaptive-orchestrator`. Использовать только вместе с проверкой актуального кода и конкретной задачи. До явного PO approval утверждения из этих файлов — гипотезы/аналитические ограничения, а не разрешение расширять продукт.

| Вид задачи | Читать |
|---|---|
| Любая задача со scope/approve | `00-authority-scope.md` |
| Данные, storage, fixtures, API payload | `02-data-governance.md`, `contracts/dataset-registry.yaml` |
| Booking, Appointment, Visit, Clinical Result | `03-state-machines.md`, `contracts/booking-machine.yaml` |
| Auth, роли, права, private views, статусы | `04-role-status-model.md`, `contracts/role-matrix.yaml` |
| Доказательства, неизвестные факты, feasibility | `07-evidence-and-feasibility.md` |
| Новая задача / handoff | `templates/task-brief.yaml` |
| Read-only субагент | `templates/subagent-brief.yaml` |
| Доказательство проверки | `templates/evidence-record.json`, `schemas/evidence-record.schema.json` |
| Синтетический датасет | `schemas/synthetic-dataset.schema.json`, `fixtures/synthetic-dataset.json` |

Не читать все файлы на каждом запуске. Не генерировать runtime schema/enum из YAML. Существующая state machine в backend имеет приоритет для утверждений «что сейчас исполняется», а Jira/Confluence — для «что утверждено продуктом».

Папка намеренно **не содержит** дублирующих разделов `01`, `05`, `06`, `08` из исходного пакета v0.1.0. Task DoR, тестовые бюджеты, orchestration и релизные ограничения должны жить в одном действующем процессе Codex.

## Сверка на этой ветке

База проверки кода: `a864e2da500018403e238b748e737217e439e365`. Jira, нормативный Confluence (включая Scope Freeze `131074` и правила approval `2686977`) и PO approval: `NOT_VERIFIED`. Подключение Atlassian требует повторной авторизации.

- Booking Hold: состояния, переходы и Owner status projection сверены с кодом. Ссылки пакета на отсутствующие документы Wave 2/3 заменены актуальными точками входа. Термины Wave 2, полный Appointment lifecycle, граница late cancellation и сквозные гарантии транзакций требуют отдельной сверки. Clinical Result `DRAFT`/`PUBLISHED` и отдельные amendments видны в сервисе. Целевая [v50 visit state machine](../v50/adr/0004-clinical-visit-state-machine.md) описывает другой уровень.
- Роли: текущая таблица capabilities врача содержит `clinical.visit.complete` и `clinical.visit.workspace.read`. В пакете была указана дополнительная `medical.shared-data.read`, отсутствующая в статическом mapping. Проверенный ветеринарный read service выбирает записи по филиалу. Персональную фильтрацию и отдельную роль руководителя требуется подтвердить у PO и security.
- Данные: [Owner Catalog/Availability DTO](../../backend/src/public-catalog/owner-clinic-catalog.dto.ts) содержит информационную цену и `observedAt`. Дополнительные поля цен из реестра остаются предложением. Схемы описывают локальную фикстуру и структуру доказательства. Публикация реальных данных, retention и коммерческие правила CPA требуют отдельного решения.

Для снятия `PROPOSED_FOR_PO_APPROVAL` нужна явная привязка каждого согласованного утверждения к задаче, нормативному источнику и точной ревизии, с отдельным указанием исключений.
