# 02 — Данные: формат, владение, хранение, использование

**Contract:** `VETORA-DATA-001` · `v0.1.0` · `PROPOSED_FOR_PO_APPROVAL`. [Аналитический реестр](contracts/dataset-registry.yaml). Предложенные поля нужно сверять с актуальным [DTO каталога и доступности](../../backend/src/public-catalog/owner-clinic-catalog.dto.ts).

## Правило источника

Для каждого dataset нужен один authoritative writer, immutable provenance (`sourceType`, `sourceRef`, observed/updated at, actor, revision), определённые потребители и границы доступности. Если отсутствует источник или проверенная дата обновления: не показывать значимую бизнес-цифру как факт.

| Набор | Каноническое владение | Доступ/хранение | Особые запреты |
|---|---|---|---|
| Клиника/филиал | Clinic onboarding/registry, сервер | PostgreSQL, public projection с проверкой | Не подменять реальную клинику синтетической; непроверенный адрес не геокодировать |
| Врач/сотрудник/назначение | Clinic staffing + identity membership | PostgreSQL, private assignment и public consented doctor fields | `doctorId` ≠ `employeeId`; личные назначения не выводить по совпадению имён |
| Услуга/цена/состав | Клиника владеет предложением, catalog публикует | PostgreSQL, версия/валюта/дата | `serviceCode` сопоставим только при одинаковом составе; «от» + состав/исключения |
| Смена/ресурс/слот | Schedule/Booking Core | PostgreSQL, authoritative server time & version | Ни browser generation, ни Redis, ни кэш не подтверждают доступность |
| Hold/Appointment | Booking Core + Appointment lifecycle | PostgreSQL, audit/outbox в транзакции | Не дублировать writer, не вычислять confirmed/expired по локальному времени |
| Owner/Pet | Auth/Pet service | PostgreSQL; owner scope | Не копировать PII/медицинские данные в demo fixtures или telemetry |
| Visit/Clinical Result | Vet-only clinical domain | PostgreSQL, scoped sensitive read; files in approved private object store | Draft не публиковать, PUBLISHED не менять, amendment append-only |
| Source/visitation/CPA evidence | Booking + будущая commercial ledger policy | PostgreSQL audit/event registry; billing **not implemented** | Не начислять за pending, повтор, no-show; новое billing API только по approval |
| Binary attachments | Одобренный storage adapter | Private object storage, metadata/version/hash в PostgreSQL | Никаких base64 медицинских вложений в localStorage или public assets |

## Формат и сериализация

- Доменный transport-формат — существующий **generated OpenAPI/DTO**, не новый JSON из этих инструкций. Изменения API: additive, versioned, backward compatible или отдельное migration approval.
- ID — существующие backend identifiers; не конвертировать самостоятельно `doctorId` в `staffId`. Слоты и команды — с существующими `Idempotency-Key`, `X-Correlation-ID`, version/`If-Match` там, где требует API.
- Время — server-authoritative UTC timestamps + IANA timezone для UI; клиентские часы только presentation. День/время без timezone неоднозначны.
- Деньги — точное десятичное значение/minor units по существующей модели, `RUB`, без JS float для финансового расчёта; любой новый формат требует contract decision.
- Даты/версии/цены/статусы, не доказанные источником, нельзя достраивать по правдоподобию. Пустое значение остаётся `unknown`/`null` по канонической схеме.
- PII, medical, consent и clinical evidence отделять от публичного каталога. Принцип minimization, scoped reads, audit. Сроки хранения/удаления **PENDING_LEGAL_DECISION** — не назначать произвольные числа.

## Синтетические данные

Строгая схема `schemas/synthetic-dataset.schema.json` применяется **только** к тестовой fixture, не к production DTO. У каждой fixture: `classification=SYNTHETIC`, `publishable=false`, источник/seed и владельцы. Никаких реальных телефонов, карт пациентов, «проверенных отзывов», выдуманных рейтингов или записи к несуществующему врачу. Перед pilot/demo для реальной клиники нужна независимая сверка с клиникой и связка с authoritative slot read.

### Хранилища

PostgreSQL — единственный transaction/source-of-truth для booking и clinical; outbox — атомарно с изменением; Redis/cache — disposable, не writer; файловые байты — approved protected storage; browser/sessionStorage — только несекретное временное UI-состояние и локальная demo fixture. Любой перенос data ownership между слоями — архитектурное изменение Tier C.
