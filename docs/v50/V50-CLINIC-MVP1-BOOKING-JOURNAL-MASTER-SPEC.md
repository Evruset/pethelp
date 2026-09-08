# VETHELP CLINIC PORTAL MVP 1
## Master Prompt для Adaptive Orchestrator / Codex
### Полная продуктовая и UX-переделка Portal вокруг журнала записи

Используй установленный skill:

```text
adaptive-orchestrator
```

Работай как Root Product/Architecture Coordinator, Staff Next.js Engineer, Senior NestJS Engineer, Product Designer и QA Lead программы переделки Clinic Portal первого MVP VetHelp.

Не спрашивай пользователя:

- какую модель выбрать;
- какой reasoning level использовать;
- какого агента запускать;
- какой файл редактировать;
- какой тест запускать;
- какой следующий этап выбрать;
- продолжать ли после discovery.

Самостоятельно выбери минимальный безопасный workflow, выполни один завершённый bounded slice в текущем запуске, обнови program state и остановись только после обязательных проверок.

---

# 1. Главная цель

Полностью переделать Clinic Portal первого MVP VetHelp из текущего summary/dashboard-подхода в операционное рабочее место администратора записи класса YCLIENTS:

```text
главная страница
= журнал записи
= календарь + заявки + записи + карточка + действия
```

Не копировать визуальный стиль, бренд, proprietary UX или бизнес-модель YCLIENTS.

Использовать только общий продуктовый паттерн:

```text
время
× сотрудники
× записи
× заявки
× действия администратора
```

Конечный пользовательский результат:

```text
владелец выбрал клинику, услугу и время
→ заявка появилась в журнале клиники
→ администратор увидел её в контексте расписания
→ подтвердил либо предложил реальное другое время
→ владелец получил authoritative итог
```

Главная продуктовая метрика Portal:

```text
Clinic Request Decision Time
```

Цель MVP:

```text
p50 < 30 секунд
p95 < 60 секунд
double-booking rate = 0
```

---

# 2. Нормативный master document

Главный продуктовый и технический source of truth:

```text
VETHELP_CLINIC_PORTAL_MVP1_REDESIGN_MASTER_SPEC.md
```

Если документ передан агенту как внешний файл, сначала помести его в репозиторий:

```text
docs/v50/V50-CLINIC-MVP1-BOOKING-JOURNAL-MASTER-SPEC.md
```

Не сокращай его и не заменяй абстрактным пересказом.

Если файл уже существует в репозитории:

- прочитай его;
- используй как нормативный scope;
- не создавай параллельную копию;
- изменения вноси только при доказанном противоречии runtime или явном новом решении владельца продукта.

Дополнительная продуктовая основа:

```text
VetHelp.md
```

Первый MVP требует:

- очередь новых заявок;
- карточку заявки;
- подтверждение;
- отклонение;
- предложение другого времени;
- простое расписание;
- клиентов и питомцев;
- роли сотрудника и администратора;
- историю действий;
- работу без МИС.

Первый MVP исключает:

- страхование;
- телемедицину;
- AI-диагностику;
- онлайн-оплату;
- emergency routing;
- полноценную медицинскую карту;
- полноценную МИС;
- сложную аналитику.

При конфликте старых V50 документов с новым master spec:

```text
новое явное решение владельца продукта
→ master spec
→ текущий Booking Core runtime
→ старые Portal UX contracts
```

Не нарушай транзакционные и security-инварианты ради визуального соответствия.

---

# 3. Критическое продуктовое решение

Текущий `Workspace Home` с summary-секциями:

```text
QUEUE
SCHEDULE
APPOINTMENTS
VETERINARIAN
QUALITY
```

не является правильной домашней страницей первого MVP.

Зафиксировать:

```text
Workspace Home dashboard:
- не root route MVP;
- не основной экран администратора;
- не критерий завершённости Portal;
- не следующий продуктовый slice;
- может быть сохранён как future manager summary / operations surface.
```

Новый root route:

```text
/clinics/:clinicId/locations/:locationId
```

должен открывать:

```text
Журнал записи
```

Нельзя продолжать:

```text
V50-CLINIC-05D /
Clinic Workspace Home End-to-End Certification
```

как следующий продуктовый этап.

05D текущего dashboard считается:

```text
SUPERSEDED_BY_PRODUCT_RESET
```

Это не означает, что backend/BFF/session/security work 05A–05C нужно удалить.

---

# 4. Что переиспользовать

Сохраняй и переиспользуй, где runtime semantics доказаны:

## Booking Core

- slot integrity;
- hold lifecycle;
- double-booking protection;
- manual confirmation;
- FIFO;
- SLA;
- confirm;
- decline/release;
- alternative slot;
- cancellation;
- appointments;
- audit/history;
- idempotency;
- optimistic concurrency;
- database clock authority;
- PostgreSQL transactions.

## Security

- effective session;
- HttpOnly cookie;
- same-origin BFF;
- browser Authorization suppression;
- exact clinic/location membership;
- capabilities;
- normalized no-leak denials;
- strict parsing;
- actor-suppressed telemetry.

## Existing Portal

- V50 shell;
- responsive navigation foundation;
- Queue route;
- Appointments route;
- Schedule route;
- Patients Registry;
- Patient Administrative Detail;
- existing design-system components;
- Playwright harness;
- local rich-demo sessions;
- local-stack smoke;
- screenshot/evidence helpers.

## Existing 05A–05C work

Сохраняй как reusable foundation:

- common authority;
- Queue and Appointments summaries;
- transaction hardening;
- BFF/session patterns;
- strict parser patterns;
- stale-retained state pattern;
- route generation fencing;
- no-store response policy;
- accessibility and responsive test patterns.

Не сохраняй неправильную product hierarchy только потому, что она уже реализована.

---

# 5. Что заменить

Нужно заменить или существенно переделать:

- root location page;
- main Portal information architecture;
- shell primary navigation;
- current Home card grid;
- способ представления очереди;
- расписание как отдельную disconnected страницу;
- карточку заявки;
- alternative-slot selection UX;
- ручное создание записи;
- связь записей с клиентами и питомцами;
- мобильное представление B2B Portal.

---

# 6. Первый MVP Portal

Обязательные разделы:

```text
Журнал записи
Заявки
Клиенты
Сотрудники
```

Опционально для администратора:

```text
Настройки
```

Убрать из primary MVP navigation:

```text
Workspace summary
Quality dashboard
Telemedicine
Payments
Insurance
Emergency
Analytics
Inspector
Replay
technical diagnostics
```

Технические/admin маршруты могут оставаться доступными по deep link и capability, но не должны формировать основной рабочий сценарий.

---

# 7. Базовое состояние репозитория

Основной checkout:

```text
/Users/evrusetskiy/work/pethelp-alpha
```

Защищённое пользовательское изменение:

```text
.codex/config.toml
```

Не менять, не стейджить, не коммитить, не сбрасывать.

Последний Portal worktree:

```text
/Users/evrusetskiy/work/pethelp-v50-clinic-05c
```

Branch:

```text
agent/v50-clinic-05c-workspace-home-portal
```

Известный head до product reset:

```text
afe45deaa40258beb1704f524bff1d839e987251
```

Открытые stacked PR:

```text
#66 — 05A contract
#67 — 05B backend foundation
#68 — 05C Portal foundation
```

Не мержить их автоматически.

PR #68 имеет известный Linux CI install blocker:

```text
lightningcss-linux-x64-gnu optional native dependency missing
```

Этот blocker:

- не является продуктовым blocker журнала;
- не должен скрываться;
- должен быть исправлен отдельным bounded CI slice до финальной интеграции;
- не требует изменения product runtime.

Перед работой всегда проверяй актуальное состояние GitHub и local worktree. Не доверяй историческому SHA без проверки.

---

# 8. Worktree и branch strategy

Не работай в основном checkout.

Для первого product-reset slice создай:

```text
worktree:
/Users/evrusetskiy/work/pethelp-v50-clinic-mvp1-01

branch:
agent/v50-clinic-mvp1-01-booking-journal-contract
```

Предпочтительная база:

```text
origin/agent/v50-clinic-05c-workspace-home-portal
```

Только если:

- remote branch существует;
- local worktree clean;
- head соответствует опубликованному PR #68;
- stacked history сохранена.

Если 05C branch изменилась, используй актуальный remote head и зафиксируй SHA.

Не использовать:

```text
git reset --hard
git clean -fd
rebase
force push
```

Для следующих slices создавай отдельные worktree/branches с эксклюзивным file ownership.

---

# 9. Программа исполнения

Полная переделка является:

```text
Complexity: C3
Risk: R3
```

Не реализовывай всё одним diff.

Программа состоит из bounded slices.

## MVP1-01 — Product, UX and Architecture Contract

Documentation and discovery only.

Результат:

- master spec зарегистрирован;
- старый 05D superseded;
- route and screen map;
- reuse/gap analysis;
- role/capability matrix;
- status taxonomy;
- read/command API inventory;
- data ownership;
- rollout plan;
- test matrix;
- один следующий implementation slice.

## MVP1-02 — Interactive UX Prototype

Результат:

- desktop journal;
- tablet journal;
- mobile agenda;
- pending request;
- confirmed appointment;
- alternative selection;
- manual create;
- clients;
- staff;
- required states;
- visual acceptance.

Не использовать fixture как доказательство backend implementation.

## MVP1-03 — Journal Read Projection

Backend:

- day projection;
- staff columns;
- entries;
- pending summary;
- timezone;
- actions;
- query budget;
- OpenAPI;
- PostgreSQL tests;
- performance.

## MVP1-04 — Portal Journal Foundation

Portal:

- root route;
- BFF;
- parser;
- toolbar;
- SLA bar;
- time grid;
- cards;
- drawer;
- responsive agenda;
- loading/empty/error/stale;
- feature flag.

## MVP1-05 — Request Commands

- confirm;
- reject;
- alternative;
- idempotency;
- versioning;
- conflicts;
- readback;
- audit.

## MVP1-06 — Manual Booking

- client lookup;
- quick client;
- pet;
- service;
- staff;
- slot;
- create appointment.

## MVP1-07 — Clients and Staff

- clients;
- pets;
- staff;
- working hours;
- simple availability.

## MVP1-08 — End-to-End Certification

- owner → clinic → owner;
- alternative;
- concurrency;
- accessibility;
- visual evidence;
- rollback;
- stacked integration.

Каждый запуск должен завершать только один slice или доказанную repair-задачу.

---

# 10. Первая задача текущего запуска

Начни с:

```text
V50-CLINIC-MVP1-01 /
Booking Journal Product, UX and Architecture Contract
```

Не начинай runtime implementation журнала в первом запуске.

Не создавай новый backend endpoint.

Не создавай новый UI.

Не меняй migrations.

Не меняй dependencies.

Цель первого запуска — превратить master spec в исполнимую программу, связанную с фактическим runtime.

---

# 11. Continuation protocol

В начале каждого запуска:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -5 --oneline
```

Прочитай:

1. `docs/ai/current-state.md`;
2. master spec;
3. релевантные строки `V50-PARITY-REGISTER.md`;
4. route/API/role matrix;
5. текущие Queue/Appointments/Schedule Portal routes;
6. backend controllers/services этих контуров;
7. effective session/BFF pattern;
8. prototype anchor для clinic workspace;
9. ближайшие test harness.

Не выполняй повторный broad repo audit, если нужная информация уже в current state.

Но для MVP1-01 выполни один ограниченный фактический inventory текущего Portal.

---

# 12. MVP1-01 discovery scope

Изучи максимум:

```text
docs/v50/**
docs/ai/current-state.md

apps/clinic-portal/app/(clinic)/clinics/[clinicId]/locations/[locationId]/**
apps/clinic-portal/app/api/clinic/[clinicId]/locations/[locationId]/**
apps/clinic-portal/components/layout/**
apps/clinic-portal/components/queue/**
apps/clinic-portal/components/appointments/**
apps/clinic-portal/components/schedule/**
apps/clinic-portal/components/workspace-home/**
apps/clinic-portal/lib/auth/**
apps/clinic-portal/lib/api/**
apps/clinic-portal/tests/**

backend/src/booking-core/**
backend/test/*queue*
backend/test/*appointment*
backend/test/*schedule*
backend/test/*workspace*
```

Не исследуй:

- telemed;
- insurance;
- emergency;
- owner Flutter;
- unrelated Ops modules;
- full migration history;
- unrelated platform features.

---

# 13. Обязательные MVP1-01 документы

Создай:

```text
docs/v50/V50-CLINIC-MVP1-BOOKING-JOURNAL-MASTER-SPEC.md
docs/v50/V50-CLINIC-MVP1-01-BOOKING-JOURNAL-CONTRACT.md
docs/v50/V50-CLINIC-MVP1-BOOKING-JOURNAL-REUSE-GAP-MATRIX.md
docs/v50/V50-CLINIC-MVP1-BOOKING-JOURNAL-SCREEN-MAP.md
```

Обнови:

```text
docs/v50/V50-PARITY-REGISTER.md
docs/v50/00-route-api-role-matrix.md
docs/ai/current-state.md
```

Не создавай несколько competing master specs.

---

# 14. Reuse / Gap Matrix

Для каждого capability/экранного блока зафиксируй:

```text
REUSE
MODIFY
REPLACE
REMOVE
MISSING
```

Минимальные строки:

- shell;
- root route;
- Home navigation;
- Workspace Home;
- Queue;
- Queue detail;
- Appointments registry;
- Appointment detail;
- Schedule;
- Services;
- Staff;
- Working hours;
- Clients registry;
- Client detail;
- Pet admin detail;
- Audit timeline;
- confirm command;
- reject command;
- alternative command;
- cancel;
- reschedule;
- manual appointment create;
- search;
- server time;
- polling/realtime;
- feature flags;
- BFF/session;
- parser;
- tests;
- evidence.

Для каждого элемента:

```text
Current route
Current component
Current API
Current role/capability
Target behavior
Decision
Gap
Risk
Next slice
```

Не объявляй `REUSE`, если semantic contract не соответствует журналу.

---

# 15. Screen Map

Зафиксируй целевые routes.

## Root journal

```text
/clinics/:clinicId/locations/:locationId
```

## Optional canonical alias

```text
/clinics/:clinicId/locations/:locationId/journal
```

Определи одно canonical URL и одно допустимое redirect/alias behavior.

## Requests

```text
/clinics/:clinicId/locations/:locationId/requests
```

## Appointments

```text
/clinics/:clinicId/locations/:locationId/appointments
```

## Clients

```text
/clinics/:clinicId/locations/:locationId/clients
/clinics/:clinicId/locations/:locationId/clients/:clientId
```

## Staff

```text
/clinics/:clinicId/locations/:locationId/staff
```

## Settings

```text
/clinics/:clinicId/locations/:locationId/settings
```

Для каждого route:

- screen purpose;
- user role;
- capability;
- read API;
- command API;
- loading;
- empty;
- error;
- stale;
- forbidden;
- responsive behavior;
- feature flag;
- rollback.

---

# 16. Role and capability matrix

Не вводи общую capability:

```text
clinic.workspace.read
```

без необходимости.

Проверь возможность композиции существующих capabilities.

Предварительное направление:

```text
Journal shell:
at least one relevant existing capability

Queue entries:
booking.queue.read

Appointments:
appointment.registry.read

Schedule:
schedule.read

Clients:
patient.admin.read

Staff/settings:
existing admin capabilities
```

Backend должен возвращать только разрешённые данные.

Portal navigation eligibility не является authority.

Для composite journal зафиксируй один из вариантов:

## Variant A

Один backend journal projection сам фильтрует sections/entry facts по capabilities.

## Variant B

Journal требует минимальную booking capability, остальные surfaces недоступны.

Выбери вариант только после анализа существующей security model.

Не использовать прямые role checks.

---

# 17. Status taxonomy

Создай закрытый mapping:

```text
REQUEST_PENDING
CONFIRMED
ALTERNATIVE_PENDING
OWNER_DECISION_PENDING
CANCELLED
REJECTED
COMPLETED
NO_SHOW
EXPIRED
RELEASED
```

Свяжи с фактическими backend states.

Для каждого статуса:

- backend source;
- Portal label;
- calendar visibility;
- active/history bucket;
- available actions;
- terminal/nonterminal;
- color/icon semantics;
- owner-facing effect.

Не придумывай mapping при отсутствии authority.

В таком случае:

```text
BLOCKED / STATUS_MAPPING_AUTHORITY_NOT_PROVEN
```

или выдели отдельный contract debt.

---

# 18. Target journal UX contract

Desktop composition:

```text
toolbar
→ pending SLA bar
→ filters
→ time/staff grid
→ selected entry drawer
```

Day view:

```text
vertical = time
horizontal = staff
```

Mobile:

```text
date
→ urgent requests
→ agenda list
→ full-screen entry detail
```

Week view:

- optional in first implementation;
- limited to selected employee;
- cannot block Day view MVP.

Drag-and-drop:

```text
NOT_REQUIRED
```

Manual reschedule uses explicit slot selection.

---

# 19. Journal entry contract

Minimum safe projection:

```text
id
kind
version
startsAt
endsAt
staff projection
public status
pet administrative projection
owner administrative projection
service projection
price projection
SLA
available actions
source
```

Forbidden unless separately authorized:

```text
clinical notes
diagnosis
treatment
documents
payments
insurance
full owner profile
audit internals
MIS internals
raw identifiers not needed by UI
```

Phone access must be capability-gated and privacy-reviewed.

---

# 20. Read API inventory

Before creating a new endpoint, determine whether current APIs can safely compose the first journal.

Evaluate:

- Queue endpoint;
- Appointments registry endpoint;
- Schedule endpoint;
- Staff/service endpoints;
- Patients Registry;
- Workspace Home summary.

Criteria:

- one consistent snapshot;
- same database/server clock;
- bounded query budget;
- no client N+1;
- no cross-request state race;
- exact capabilities;
- enough fields for journal;
- no privacy overexposure.

If safe composition is impossible, specify new backend projection:

```http
GET /v1/clinic/:clinicId/locations/:locationId/journal
```

Do not implement it in MVP1-01.

---

# 21. Command API inventory

Map existing commands:

```text
confirm
reject/decline
propose alternative
cancel
reschedule
manual create
```

Для каждой:

- endpoint;
- method;
- capability;
- state guard;
- idempotency;
- expected version;
- error semantics;
- audit;
- readback.

Mark:

```text
READY
MODIFY
MISSING
BLOCKED
```

---

# 22. Feature flag strategy

New canonical flag:

```text
CLINIC_MVP1_BOOKING_JOURNAL
```

Default:

```text
false
```

Do not enable production.

Define behavior:

## Flag off

- preserve current root route behavior;
- current Workspace Home remains accessible only as explicitly decided;
- new navigation absent;
- no new journal BFF requests.

## Flag on

- root location route opens journal;
- primary navigation begins with `Журнал записи`;
- old Workspace Home is not primary home.

Rollback:

```text
CLINIC_MVP1_BOOKING_JOURNAL=false
```

No migration rollback.

---

# 23. Workspace Home disposition

MVP1-01 must choose and document one safe option.

Preferred:

```text
Workspace Home remains:
- hidden from primary MVP navigation;
- available at a non-root internal route;
- protected by existing feature flag/capabilities;
- not deleted in product-reset slice.
```

Potential route:

```text
/clinics/:clinicId/locations/:locationId/overview
```

Do not rename or move runtime route in MVP1-01.

Record as next implementation action.

---

# 24. UX prototype requirements for MVP1-02

MVP1-01 must prepare a precise prototype brief.

Required desktop states:

- normal day;
- pending request;
- overdue request;
- confirmed appointments;
- partial schedule;
- no entries;
- no staff;
- alternative selection;
- manual booking;
- client lookup;
- conflict;
- stale;
- forbidden.

Responsive viewports:

```text
375x812
412x915
768x1024
1024x768
1440x900
1920x1080
```

Prototype must not use:

- fake medical data outside administrative scope;
- telemed;
- insurance;
- payments;
- quality dashboard;
- arbitrary analytics.

---

# 25. Test matrix for future slices

MVP1-01 must create the exact test matrix.

## Backend

- exact scope;
- capabilities;
- day boundary;
- timezone;
- staff columns;
- pending ordering;
- action projection;
- privacy;
- query count;
- performance;
- double-booking regression.

## BFF

- browser Authorization ignored;
- server session token;
- route validation;
- normalized errors;
- no-store;
- strict parser;
- timeout;
- malformed body;
- oversized body.

## Portal

- root route;
- navigation;
- toolbar;
- grid;
- drawer;
- SLA;
- confirm;
- reject;
- alternative;
- manual create;
- search;
- filters;
- stale;
- 401/403 data purge;
- mobile agenda;
- keyboard;
- axe;
- 200% text;
- no overflow.

## Local E2E

```text
owner create request
→ clinic journal
→ confirm
→ owner confirmed
```

and:

```text
owner request
→ clinic alternative
→ owner accepts
→ clinic journal consistent
```

---

# 26. Performance budgets

MVP1-01 must fix target budgets, not measure them yet.

Suggested journal targets:

```text
backend p95 < 300 ms
backend p99 < 500 ms
response <= 128 KiB for bounded pilot day
no N+1
no disk spill
no large-table full seq scan
```

Portal:

```text
initial useful render < 2.5 s local/pilot
selection feedback < 100 ms
drawer open < 150 ms
no whole-grid rerender each SLA second
```

Confirm actual budgets during journal backend contract.

---

# 27. Documentation status changes

Update current program status:

```text
V50-CLINIC-05A: CONTRACT_READY / PR_OPEN
V50-CLINIC-05B: BACKEND_FOUNDATION_IMPLEMENTED / TESTED / PR_OPEN
V50-CLINIC-05C: PORTAL_FOUNDATION_IMPLEMENTED / TESTED / PR_OPEN / CI_BLOCKED
V50-CLINIC-05D: SUPERSEDED_BY_PRODUCT_RESET

V50-CLINIC-MVP1-01: CONTRACT_IN_PROGRESS
```

After completion:

```text
V50-CLINIC-MVP1-01:
PASS / BOOKING_JOURNAL_CONTRACT_READY
```

Schedule and Quality Workspace authority debts remain open but are no longer blockers for the journal MVP unless reused directly.

Production rollout:

```text
NOT_STARTED
```

Main integration:

```text
NOT_STARTED
```

---

# 28. Parity Register update

Add or replace Clinic MVP rows:

```text
CLN-MVP1-001 Journal shell
CLN-MVP1-002 Day calendar
CLN-MVP1-003 Pending SLA bar
CLN-MVP1-004 Entry detail drawer
CLN-MVP1-005 Confirm request
CLN-MVP1-006 Reject request
CLN-MVP1-007 Alternative slot
CLN-MVP1-008 Manual booking
CLN-MVP1-009 Requests registry
CLN-MVP1-010 Appointments registry
CLN-MVP1-011 Clients registry
CLN-MVP1-012 Client detail
CLN-MVP1-013 Staff
CLN-MVP1-014 Working hours
CLN-MVP1-015 Mobile agenda
```

Maximum status after MVP1-01:

```text
CONTRACT_READY
```

No `IMPLEMENTED`, `TESTED` or `VISUALLY_VERIFIED`.

For old Workspace Home row:

```text
RETAINED_FOUNDATION
NOT_PRIMARY_MVP_HOME
```

---

# 29. Route/API/role matrix update

Record:

- root route target;
- old route disposition;
- target read API decision;
- current command APIs;
- roles/capabilities;
- feature flag;
- no-MIS mode;
- clinical boundary.

Do not promise endpoint names not yet approved.

---

# 30. Current-state update

Record:

- owner reviewed 05C UI;
- UI does not meet MVP booking workflow expectations;
- YCLIENTS-like journal pattern selected;
- current Workspace Home superseded as primary Portal UX;
- valuable security/backend foundations retained;
- next slice is UX prototype or journal backend contract based on gap analysis;
- current CI blocker remains open;
- no runtime change in MVP1-01.

---

# 31. Independent reviews

MVP1-01 requires three bounded reviews.

## Product/UX reviewer

Veto if:

- dashboard remains home;
- journal is not central;
- request cannot be processed in context;
- MVP scope expands;
- mobile tries to copy desktop grid blindly.

## Architecture/security reviewer

Veto if:

- client composition breaks snapshot consistency;
- capability model becomes role-based;
- privacy fields are overexposed;
- new endpoint bypasses current membership;
- manual booking weakens double-booking guarantees.

## QA/integration reviewer

Veto if:

- requirements cannot be tested;
- status mapping is ambiguous;
- rollback undefined;
- owner → clinic → owner E2E cannot be constructed;
- old 05D remains next action.

Fix all vetoes.

---

# 32. Changed-file boundary MVP1-01

Allowed:

```text
docs/v50/**
docs/ai/current-state.md
```

Optional:

```text
prototype-v50/manifest.json
```

only if documenting a new prototype artifact already created in this slice. Do not modify prototype in MVP1-01.

Forbidden:

```text
backend/**
apps/clinic-portal/**
apps/owner_mobile/**
backend/migrations/**
.github/**
package manifests
lockfiles
.codex/**
```

Verify:

```bash
git diff --name-only -- \
  backend \
  apps \
  .github \
  .codex \
  package.json \
  package-lock.json
```

Expected empty.

---

# 33. Validation MVP1-01

Run:

```bash
node scripts/v50-prototype-inventory.mjs \
  prototype-v50/index.html \
  --require-v50 \
  --verify-manifest
```

Then:

```bash
git diff --check
git status --short
git diff --stat
git diff --name-only
```

Documentation consistency checks:

- no active claim that 05D is next;
- no active claim that Workspace Home is final MVP home;
- exactly one new next slice;
- all MVP functions from master spec represented;
- excluded scope explicitly excluded;
- role/capability matrix complete;
- all actions mapped to API status;
- all screens have states;
- rollback documented;
- current runtime not falsely marked implemented.

Runtime suites:

```text
ABSTAIN / documentation-only
```

---

# 34. MVP1-01 commit

Create one documentation commit:

```bash
git add \
  docs/v50/V50-CLINIC-MVP1-BOOKING-JOURNAL-MASTER-SPEC.md \
  docs/v50/V50-CLINIC-MVP1-01-BOOKING-JOURNAL-CONTRACT.md \
  docs/v50/V50-CLINIC-MVP1-BOOKING-JOURNAL-REUSE-GAP-MATRIX.md \
  docs/v50/V50-CLINIC-MVP1-BOOKING-JOURNAL-SCREEN-MAP.md \
  docs/v50/V50-PARITY-REGISTER.md \
  docs/v50/00-route-api-role-matrix.md \
  docs/ai/current-state.md

git commit -m "docs(clinic): reset portal around booking journal"
```

Do not use `git add -A`.

Push:

```bash
git push -u origin agent/v50-clinic-mvp1-01-booking-journal-contract
```

---

# 35. PR strategy

Create a new stacked PR.

Preferred base:

```text
agent/v50-clinic-05c-workspace-home-portal
```

Head:

```text
agent/v50-clinic-mvp1-01-booking-journal-contract
```

Title:

```text
docs(clinic): reset portal around booking journal
```

PR body must state:

- product owner rejected current Home UX;
- journal becomes MVP home;
- no runtime changes;
- 05A–05C foundations retained;
- 05D superseded;
- master spec;
- route/screen map;
- reuse/gap matrix;
- API/command inventory;
- feature flag;
- excluded scope;
- next slice;
- production rollout not started.

Do not merge any PR.

---

# 36. Choosing the next slice

At the end of MVP1-01 choose exactly one next slice based on evidence.

Preferred order:

## If UX structure is not visually proven

```text
V50-CLINIC-MVP1-02 /
Booking Journal Interactive UX Prototype
```

## If authoritative prototype already exists and is accepted

```text
V50-CLINIC-MVP1-03 /
Clinic Booking Journal Backend Read Projection
```

Do not choose Portal runtime before:

- UX contract is accepted;
- read projection is contract-ready;
- status/action mapping is authoritative.

---

# 37. Stop conditions

Return `BLOCKED` if:

1. Master spec cannot be found or registered.
2. Worktree is dirty before start.
3. Base branch or PR state cannot be verified.
4. Product scope conflicts with Booking Core invariants.
5. Current status mapping cannot be proven.
6. Journal requires clinical/financial data outside MVP.
7. No safe capability model can be defined.
8. Existing command APIs cannot be classified.
9. Root route rollback cannot be defined.
10. More than one next slice remains.
11. Runtime changes are required in MVP1-01.
12. Protected files enter diff.
13. Independent reviewer leaves veto.
14. Push requires force.
15. PR base is wrong.

---

# 38. Final report MVP1-01

Return exactly six sections.

## 1. Baseline

- worktree;
- branch;
- base SHA;
- PR state;
- changed files.

## 2. Product reset

- old Home decision;
- new journal decision;
- MVP scope;
- excluded scope;
- target navigation.

## 3. Reuse and gaps

- reusable runtime;
- replace/remove;
- missing read contracts;
- missing commands;
- authority debts.

## 4. Target contract

- routes;
- screens;
- roles/capabilities;
- status taxonomy;
- feature flag;
- rollback;
- next slice.

## 5. Checks and PR

- inventory;
- documentation validation;
- independent reviews;
- diff boundary;
- commit;
- push;
- PR metadata.

## 6. Final status

One:

```text
PASS / BOOKING_JOURNAL_CONTRACT_READY / PR_OPEN
```

or:

```text
BLOCKED / <exact proven reason>
```

Then:

```text
V50-CLINIC-05A: CONTRACT_READY / PR_OPEN
V50-CLINIC-05B: BACKEND_FOUNDATION_IMPLEMENTED / TESTED / PR_OPEN
V50-CLINIC-05C: PORTAL_FOUNDATION_IMPLEMENTED / TESTED / PR_OPEN / CI_BLOCKED
V50-CLINIC-05D: SUPERSEDED_BY_PRODUCT_RESET
V50-CLINIC-MVP1-01: CONTRACT_READY
V50-CLINIC-MVP1-02 or 03: NOT_STARTED
Production rollout: NOT_STARTED
Main integration: NOT_STARTED
```

---

# 39. Continuation after MVP1-01

When the user says:

```text
продолжай
следующий этап
дальше
```

do not repeat the entire discovery.

Read:

- current-state;
- MVP1-01 contract;
- reuse/gap matrix;
- screen map;
- target parity rows;
- Git status;
- relevant existing implementation patterns.

Then execute the single next slice fully.

---

# 40. Product acceptance principle

Do not optimize for number of pages, DTOs, tests or commits.

The Portal is successful only when this path is real:

```text
владелец отправил заявку
→ администратор увидел её в календаре
→ понял контекст расписания
→ принял решение
→ запись сохранилась без конфликта
→ владелец увидел правильный статус
```

Everything else is supporting infrastructure.
