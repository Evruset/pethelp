# VETHELP V50 FULL PRODUCT PARITY PROGRAM

## Master Goal Prompt for Adaptive Orchestrator

Canonical target version: V50.

V51 does not exist. Any instruction referencing V51 is stale and must be interpreted as V50 only when it refers to the product target, but existing runtime identifiers, environment variables, selectors, branch names, migration history, commits, and quoted historical evidence must not be renamed without compatibility analysis.

Используй установленный skill:

```text
adaptive-orchestrator
```

Работай как root coordinator программы полного перехода VetHelp на V50.

Не проси пользователя выбирать:

* модель;
* reasoning level;
* агента;
* MCP;
* тест;
* файл;
* команду;
* очередной этап.

Самостоятельно выбирай наименьший безопасный workflow в соответствии с `adaptive-orchestrator`, текущим состоянием репозитория, сложностью и риском выбранного среза.

---

# 1. Главная цель

Полностью перевести текущую реализацию VetHelp на интерфейсную, функциональную и архитектурную модель прототипа V50.

Не ограничиваться:

* косметическим обновлением экранов;
* внедрением нового shell;
* отдельными backend endpoint;
* отдельными страницами Clinic Portal;
* isolated vertical slices;
* документацией без реализации;
* тестами без пользовательского маршрута;
* визуальным сходством без работающей функциональности.

Конечный результат:

```text
Все экраны, маршруты, состояния и пользовательские действия V50
реализованы в production-коде,
связаны с реальными backend-контрактами,
защищены авторизацией,
покрыты тестами,
адаптированы под нужные разрешения,
прошли визуальную и функциональную приёмку,
включены через контролируемый rollout,
а заменённый legacy-код удалён.
```

---

# 2. Проблема, которую нужно исправить

Предыдущая задача формулировалась как переход интерфейса и функциональности на V50, но фактически были реализованы отдельные технические и продуктовые срезы:

* Booking Core;
* capabilities;
* queue;
* schedule;
* replay;
* booking inspector;
* отдельные owner-flow;
* telemedicine;
* локальная инфраструктура;
* отдельные V50-компоненты;
* тестовые harness;
* архитектурные документы.

Эти изменения могут быть полезны и должны переиспользоваться, но они не подтверждают полный переход на V50.

Не считать V50 реализованным, пока не доказан полный parity.

Запрещено выдавать за завершённый переход:

```text
частичный shell;
один готовый экран;
набор новых компонентов;
наличие backend API;
успешный unit test;
отдельный Playwright suite;
готовую архитектурную документацию;
визуально похожую страницу;
реализацию только happy path.
```

---

# 3. Источники истины

Используй следующую иерархию.

## 3.1. Продуктовый и визуальный source of truth

```text
prototype-v50 и связанные с ним локальные assets/specifications
```

Сначала найди фактическое расположение V50 в репозитории.

Не предполагай:

* число экранов;
* число состояний;
* названия маршрутов;
* соответствие старых компонентов;
* актуальность предыдущих отчётов.

Подтверди всё по исходному прототипу.

## 3.2. Runtime source of truth

```text
реальный код репозитория;
актуальные migrations;
OpenAPI;
backend state machines;
Flutter routes;
Next.js routes;
фактически запускаемые тесты.
```

Документ или отчёт не является доказательством реализации, если runtime-код ему не соответствует.

## 3.3. Текущее состояние программы

```text
docs/ai/current-state.md
```

Это основной handoff между запусками Adaptive Orchestrator.

Если файла нет — создай его.

Если он устарел — обнови на основе проверенного состояния репозитория.

## 3.4. Реестр перехода

```text
docs/v50/V50-PARITY-REGISTER.md
```

Если файл отсутствует — создай.

Если существует — продолжай его, не создавая параллельную версию.

---

# 4. Обязательная модель исполнения

Весь переход V50 слишком велик для одного неделимого изменения.

Не пытайся реализовать всю программу в одном хаотичном diff.

Adaptive Orchestrator должен:

1. определить фактическое текущее состояние;
2. создать или обновить программу перехода;
3. выбрать один максимальный, но безопасно ограниченный вертикальный срез;
4. реализовать его полностью в текущем запуске;
5. проверить его;
6. обновить parity register и current-state;
7. остановиться после прохождения обязательных проверок.

Каждый следующий запрос «продолжай», «дальше», «следующий этап», «заверши V50» должен использовать continuation mode.

В continuation mode:

* не повторяй широкое исследование репозитория;
* прочитай `git status --short`;
* прочитай релевантную часть `docs/ai/current-state.md`;
* прочитай строку или группу строк Parity Register для текущего среза;
* используй уже найденные implementation patterns;
* используй уже известные test harness;
* начинай реализацию в том же запуске;
* не возвращай только план.

---

# 5. Context Partitioning, Separate Chats and Token Economy

## 5.1. Цель

Не веди всю программу V50 в одном бесконечном чате.

Разделяй программу на:

```text
один Root Coordination Chat;
несколько изолированных Work Chats по bounded context;
временные Integration Chats;
файловые handoff-артефакты в репозитории;
короткий общий реестр состояния.
```

Цель разделения:

```text
не сжимать один огромный контекст;
не перечитывать весь репозиторий на каждом запуске;
не передавать каждому агенту всю историю программы;
не расходовать токены на нерелевантные решения;
не допускать конфликтующего владения файлами;
не терять проверенное состояние между чатами.
```

Root Chat координирует программу, но не хранит полную историю реализации каждого модуля.

---

## 5.2. Проверка возможностей среды

Сначала определи, поддерживает ли текущая среда автоматическое создание отдельных постоянных пользовательских чатов или изолированных рабочих сессий.

### Если среда поддерживает создание отдельных чатов

Создай отдельный чат для выбранного bounded context и передай ему только:

```text
Chat ID;
название среза;
одну конкретную цель;
user-visible outcome;
acceptance criteria;
разрешённые каталоги;
запрещённые каталоги;
branch/worktree;
релевантные ADR/TDS;
релевантные строки Parity Register;
известные test harness;
обязательный формат handoff.
```

### Если среда не позволяет создавать постоянные пользовательские чаты

Не симулируй создание чата и не утверждай, что чат создан.

Вместо этого:

1. подготовь точное название нового чата;
2. создай самодостаточный bootstrap prompt;
3. сохрани его в репозитории;
4. укажи пользователю путь к bootstrap-файлу;
5. Root Chat продолжает работать только как координатор.

Формат:

```text
docs/ai/chats/<chat-id>-bootstrap.md
```

Краткоживущий subagent не считается отдельным постоянным Work Chat.

---

## 5.3. Роли чатов

### Root Coordination Chat

Root Chat является единственным владельцем:

```text
общей цели V50;
порядка фаз;
приоритетов P0/P1/P2;
V50 Parity Register;
общих ADR;
межмодульных зависимостей;
Chat Registry;
feature flag registry;
release gates;
rollout;
legacy retirement;
финального parity certificate.
```

Root Chat не должен:

```text
хранить полные test logs;
обсуждать каждую CSS-правку;
содержать полный diff;
повторять историю каждого workstream;
перечитывать весь репозиторий перед каждым этапом;
реализовывать несколько крупных bounded contexts одновременно;
копировать в контекст полные handoff-файлы.
```

Основные файлы Root Chat:

```text
docs/ai/current-state.md
docs/ai/chat-registry.md
docs/v50/V50-PARITY-REGISTER.md
docs/v50/V50-PROGRAM-PLAN.md
docs/v50/V50-PARITY-CERTIFICATE.md
```

### Work Chat

Work Chat владеет:

```text
одним bounded context;
или одним крупным вертикальным срезом;
или одним ограниченным набором V50 IDs.
```

Work Chat обязан:

```text
читать bootstrap вместо полной истории Root Chat;
изменять только назначенные файлы;
выполнять focused validation;
обновлять назначенные строки Parity Register;
создавать короткий handoff;
не начинать новый bounded context после завершения своего.
```

### Integration Chat

Временный Integration Chat создаётся, когда нужно объединить два и более завершённых workstream.

Он получает только:

```text
commit hash каждого workstream;
handoff-файлы;
OpenAPI diff;
migration list;
test commands;
known conflicts;
cross-domain acceptance journey.
```

Он отвечает за:

```text
интеграцию веток;
разрешение конфликтов;
проверку shared contracts;
cross-domain tests;
обновление Parity Register;
integration handoff.
```

После завершения переводится в `ARCHIVED`.

---

## 5.4. Рекомендуемая карта чатов

Подготовь следующие логические чаты программы:

```text
ROOT
V50 Program Coordinator

BASELINE-01
Repository, migrations, local runtime and architecture baseline

OWNER-01
Owner shell, home, pets, Pet Diary, profile and notifications

OWNER-02
Catalog, clinics, doctors, booking, my bookings and alternatives

CLINIC-01
Clinic shell, queue and booking operations

CLINIC-02
Schedule, services, staff, resources and quality

VET-01
Visit workspace, clinical completion and medical audit

TELEMED-01
Owner and veterinarian telemedicine journey

SAFETY-01
Emergency, insurance and sensitive-data guardrails

QA-01
V50 visual, functional, accessibility and rollout certification
```

Не запускай все чаты одновременно.

Одновременно активны не более:

```text
3 implementation Work Chats;
1 QA или Integration Chat;
1 Root Chat.
```

Это ограничение снижает:

```text
merge conflicts;
дублирование исследований;
расхождение API;
расхождение state machines;
нагрузку на shared files;
стоимость handoff;
контекстные потери.
```

---

## 5.5. Когда создавать новый чат

Создавай отдельный Work Chat, если выполнено хотя бы одно условие:

```text
1. Работа относится к новому bounded context.
2. Требуется отдельный набор файлов и тестов.
3. Срез займёт несколько запусков.
4. Появляется отдельный владелец или исполнитель.
5. Работа может выполняться независимо от других срезов.
6. Продолжение потребует повторного сжатия текущего контекста.
7. Новая задача почти не использует историю текущего чата.
8. Текущий чат приблизился к context budget.
9. Для среза нужна отдельная ветка или worktree.
```

Не создавай новый чат, если:

```text
исправляется один локальный дефект;
изменяются те же файлы и тот же сценарий;
работа завершается за один короткий запуск;
handoff будет дороже самой реализации;
новый чат повторит исследование тех же файлов;
срез нельзя отделить от текущей транзакционной или архитектурной задачи.
```

---

## 5.6. Context Budget и ротация

Используй следующую модель:

```text
Root Chat:
только программа, статусы, зависимости и gates.

Work Chat:
один bounded context или один крупный вертикальный срез.

Active implementation context:
не более одного текущего среза на чат.

Completed implementation detail:
сразу переносится в handoff-файл и больше не повторяется в активном контексте.
```

Сигналы для закрытия или ротации чата:

```text
bounded context завершён;
потребовалось повторное сжатие контекста;
новая задача почти не использует текущую историю;
релевантная информация уже сохранена в репозитории;
чат повторно читает те же файлы;
растёт число предположений из устаревшего контекста;
число repair cycles увеличивается из-за потери контекста;
следующий срез имеет другой file ownership.
```

После закрытия Work Chat не используй его для нового bounded context.

---

## 5.7. Chat Registry

Веди:

```text
docs/ai/chat-registry.md
```

Формат:

```markdown
# V50 Chat Registry

| Chat ID | Title | Domain | Branch/Worktree | Status | Current Slice | Handoff | Last Commit | Blockers |
|---|---|---|---|---|---|---|---|---|
| ROOT | V50 Program Coordinator | Program | main | ACTIVE | Phase 1 | docs/ai/current-state.md | abc123 | none |
| OWNER-01 | V50 Owner Core | Owner | agent/v50-owner-core | ACTIVE | OWNER-01–05 | docs/ai/handoffs/OWNER-01.md | def456 | API gap |
| CLINIC-01 | V50 Clinic Queue | Clinic | agent/v50-clinic-queue | COMPLETE | CLINIC-01–03 | docs/ai/handoffs/CLINIC-01.md | aaa111 | none |
```

Статусы:

```text
PLANNED
ACTIVE
BLOCKED
READY_FOR_INTEGRATION
COMPLETE
ARCHIVED
SUPERSEDED
```

Не храни в реестре:

```text
полные промпты;
полные логи;
секреты;
JWT;
длинные diff;
private reasoning.
```

Root Chat обязан обновлять Chat Registry после создания, блокировки, завершения, интеграции или архивации чата.

---

## 5.8. Bootstrap Prompt нового Work Chat

Для каждого Work Chat создай:

```text
docs/ai/chats/<chat-id>-bootstrap.md
```

Обязательная структура:

```markdown
# Chat Identity

Chat ID:
Domain:
Role:
Branch:
Worktree:
Base Commit:

# Goal

Один конкретный результат.

# User-visible Outcome

Что начнёт работать после завершения.

# V50 Scope

Конкретные V50 IDs и prototype anchors.

# Allowed Scope

Разрешённые функции и каталоги.

# Non-goals

Что этот чат не должен менять.

# Sources of Truth

- prototype-v50 anchors;
- Parity Register rows;
- relevant ADR/TDS;
- OpenAPI contracts;
- current implementation;
- latest relevant handoff.

# Starting State

- current commit;
- existing implementation;
- known tests;
- known blockers;
- dirty files;
- feature flags.

# Acceptance Criteria

Проверяемые критерии.

# Required Validation

Команды и ожидаемые результаты.

# Git Ownership

Owned:
Shared — coordinate before change:
Forbidden:

# Handoff Contract

Какой файл создать или обновить после завершения.
```

Bootstrap prompt должен быть самодостаточным.

Новый Work Chat не должен читать всю историю Root Chat.

---

## 5.9. Handoff рабочего чата

Каждый Work Chat по завершении создаёт:

```text
docs/ai/handoffs/<chat-id>.md
```

Рекомендуемый предел:

```text
150–300 строк;
без полных test logs;
без полного diff;
без повторения общих ADR;
без private reasoning.
```

Структура:

```markdown
# Result

COMPLETE / PARTIAL / BLOCKED

# Implemented V50 IDs

# User-visible Outcome

# Changed Files

# Contracts Added or Changed

# Migrations

# Authorization Model

# Feature Flags

# Tests Executed

| Command | Exit Code | Result |

# Evidence

# Remaining Risks

# Integration Instructions

# Next Recommended Slice

# Last Commit
```

Root Chat читает handoff, а не полный диалог Work Chat.

Если результат `BLOCKED`, handoff должен включать:

```text
доказанный blocker;
выполненную команду;
exit code;
краткую ошибку;
почему локального безопасного обхода нет;
какой чат или контракт должен снять blocker.
```

---

## 5.10. Правила экономии токенов

Запрещено передавать в новый чат:

```text
полную историю Root Chat;
полные ответы предыдущих агентов;
полные логи сборки;
весь roadmap;
весь Parity Register;
все ADR;
нерелевантные исходные файлы;
полный git diff, если достаточно commit hash и списка файлов.
```

Передавай только:

```text
конкретные V50 IDs;
user-visible outcome;
acceptance criteria;
релевантные пути;
точные API-контракты;
ссылки на ADR/TDS;
известные blockers;
команды focused tests;
base commit;
feature flags;
file ownership.
```

Вместо копирования большого документа используй ссылку:

```text
Read:
docs/v50/adr/ADR-0004-clinical-authority.md

Relevant sections:
3, 5 and 7
```

Не пересказывай весь документ, если Work Chat может прочитать его из репозитория.

Не передавай изображения и большие артефакты повторно, если достаточно пути и checksum.

---

## 5.11. Ветки, worktree и владение файлами

Каждый параллельный Work Chat должен иметь отдельную ветку.

Формат:

```text
agent/v50-<domain>-<slice>
```

Примеры:

```text
agent/v50-owner-catalog
agent/v50-clinic-schedule
agent/v50-vet-clinical-completion
agent/v50-telemed-waiting-room
```

При реальной параллельной работе используй отдельный `git worktree`, если среда это поддерживает.

Нельзя двум активным чатам одновременно владеть одним файлом.

Перед запуском чата зафиксируй:

```text
Owned:
apps/owner_mobile/lib/features/catalog/**

Shared — coordinate before change:
apps/owner_mobile/lib/app/router.dart
backend/src/modules/catalog/**

Forbidden:
apps/clinic-portal/**
backend/src/modules/telemed/**
```

Изменения shared-файлов выполняются:

```text
Root Chat;
или одним назначенным Integration Chat;
или одним Work Chat после явного обновления Chat Registry.
```

Work Chat не выполняет merge в `main`, если это отдельно не поручено.

---

## 5.12. Запрет повторного исследования

Новый Work Chat начинает с:

```text
bootstrap prompt;
base commit;
релевантные строки Parity Register;
релевантные ADR/TDS;
последний handoff;
focused source files;
focused tests.
```

Он не должен повторно сканировать весь репозиторий.

Широкое исследование допустимо только если:

```text
bootstrap фактически неверен;
код изменился после handoff;
обнаружено противоречие runtime и документации;
не найден заявленный контракт;
существует риск безопасности;
существует риск потери данных;
file ownership оказался конфликтующим.
```

Причину широкого исследования укажи в handoff и Context Economy.

---

## 5.13. Закрытие Work Chat

Work Chat считается закрытым, когда:

```text
срез завершён или доказан blocker;
handoff сохранён;
Parity Register обновлён;
тесты записаны;
evidence сохранён;
commit hash зафиксирован;
Chat Registry обновлён;
следующий шаг сформулирован;
ветка готова к интеграции или архивирована.
```

После закрытия:

```text
не начинай в нём другой bounded context;
не продолжай накапливать нерелевантный контекст;
создай новый bootstrap для следующей области.
```

---

## 5.14. Context Economy Metrics

После каждого запуска и интеграционного цикла фиксируй:

```text
number of active chats;
number of newly created chats;
number of archived chats;
reused handoffs;
broad repository scans;
repeated file reads;
repeated test runs;
merge conflicts;
context compression events;
estimated duplicated work;
work chats with overlapping ownership;
budget exceeded: yes/no.
```

Efficiency verdict `EFFICIENT` допустим только если:

```text
Work Chat получил ограниченный контекст;
не повторил широкое исследование без причины;
не изменял чужие файлы;
создал качественный handoff;
Root Chat не получил полную implementation history;
focused tests не были без причины заменены полным suite;
между чатами не возникло необъявленного пересечения ownership.
```

---

## 5.15. Немедленное применение стратегии чатов

В первом запуске программы:

1. не создавай все Work Chats сразу;
2. создай или обнови:
   - `docs/ai/chat-registry.md`;
   - `docs/ai/chats/CHAT-BOOTSTRAP-TEMPLATE.md`;
   - `docs/ai/handoffs/CHAT-HANDOFF-TEMPLATE.md`;
3. определи первый P0 bounded context;
4. подготовь один bootstrap prompt;
5. если среда поддерживает постоянные отдельные чаты — создай его;
6. если не поддерживает — сохрани bootstrap и укажи пользователю:
   - название чата;
   - путь к bootstrap;
   - короткую инструкцию запуска;
7. не дублируй реализацию Work Chat внутри Root Chat;
8. не активируй больше чатов, чем требуется текущему gate;
9. после завершения первого Work Chat проверь качество handoff до запуска следующего.

---

---

# 6. Task Brief

В начале каждого запуска сформируй внутренний компактный Task Brief:

```text
Goal
User-visible outcome
Selected V50 slice
Scope
Acceptance criteria
Constraints
Source of truth
Environment
Risks
Explicit non-goals
```

Не выводи private chain-of-thought.

В итоговом отчёте покажи только краткое содержание Task Brief и принятые инженерные решения.

---

# 7. Классификация программы и отдельных срезов

Полная программа V50 является:

```text
Complexity: C3
Risk: R3
```

Но отдельный рабочий срез классифицируй независимо.

Примеры:

```text
Один UI-компонент без бизнес-логики:
C0–C1 / R0

Существующий read-only route:
C1 / R1

Экран + API + права + тесты:
C2 / R2

Booking, migrations, clinical authorization,
payments, telemedicine state machine:
C3 / R3
```

Не используй максимальное число агентов и самые дорогие модели по умолчанию.

Эскалируй workflow только по доказанной необходимости.

---

# 8. Агентная стратегия

Adaptive Orchestrator сам выбирает агентов.

## 8.1. Requirements analyst

Используй `requirements_analyst_luna` только если требования:

* противоречат друг другу;
* не позволяют определить acceptance criteria;
* создают риск неправильного продуктового поведения.

Не запускай его для обычного чтения V50.

## 8.2. Planner

Используй `planner_terra`, когда выбранный срез действительно включает несколько зависимых модулей, например:

```text
Flutter
→ backend API
→ migration
→ Clinic Portal
→ E2E
```

Для небольшой локальной правки planner не нужен.

## 8.3. Architect

Используй `architect_sol` только для:

* миграций;
* authorization boundary;
* clinical role separation;
* booking concurrency;
* payment fencing;
* telemedicine state machine;
* sensitive data;
* cross-system invariants;
* неразрешённого конфликта архитектуры V50 и текущего runtime.

Не используй Sol для обычного поиска файлов, CSS, test execution или уже установленного implementation pattern.

## 8.4. Implementers

Разрешено параллелить только независимые workstream.

Пример допустимого разделения:

```text
Implementer A:
apps/owner_mobile/**

Implementer B:
apps/clinic-portal/**

Implementer C:
backend/src/** и backend/test/**
```

Параллельные implementers не должны владеть пересекающимися файлами.

Children agents не создают собственных children.

## 8.5. QA и validators

Используй:

* `tester_terra` для реализации и запуска тестов;
* `browser_debugger_terra` для Playwright/browser reproduction;
* один независимый validator для обычной C2-задачи;
* validation quorum только для R3.

Veto:

* failing required test;
* authorization defect;
* data leakage;
* double booking;
* unsafe migration;
* broken transaction invariant;
* broken idempotency;
* missing acceptance behavior;
* clinical role violation.

Veto нельзя перекрыть большинством других validators.

---

# 9. Программа перехода

Веди реализацию по следующим фазам.

## Phase 0 — Repository and Runtime Baseline

Цель:

* устранить незавершённые merge/conflicts;
* сохранить полезные изменения;
* определить актуальный `main`;
* проверить migration lineage;
* получить чистый воспроизводимый baseline;
* не потерять локальные данные;
* подтвердить canonical local stack.

Обязательно проверить:

```text
git status
current branch
merge/rebase state
tracked and untracked files
generated files
migration history
docker compose config
backend health
Flutter baseline
Clinic Portal baseline
backend test baseline
```

Запрещено:

```text
git reset --hard
git clean -fd
docker compose down -v
удалять PostgreSQL volume
переписывать applied migration
терять пользовательские изменения
```

Результат:

```text
чистый или контролируемо dirty baseline;
зафиксированная migration head;
известные baseline failures;
обновлённый current-state.
```

---

## Phase 1 — V50 Parity Register

Создай исчерпывающий реестр.

Для каждого экрана, route или состояния V50 зафиксируй:

```text
V50 ID
Domain
Screen/state name
Prototype anchor
Target route
Current route
Current implementation
Target component
Required role
Required capability
Read API
Command API
Backend owner
State machine
Loading state
Empty state
Error state
Conflict state
Terminal states
Desktop
Tablet
Mobile
Feature flag
Required tests
Evidence
Migration action
Status
Blockers
```

Migration action:

```text
REUSE
MODIFY
REPLACE
REMOVE
MISSING
```

Статусы:

```text
NOT_STARTED
DISCOVERY
CONTRACT_READY
IMPLEMENTED
TESTED
VISUALLY_VERIFIED
UAT_ACCEPTED
ROLLED_OUT
LEGACY_REMOVED
BLOCKED
```

Не использовать процент готовности по числу файлов или коммитов.

Экран не считается реализованным только потому, что существует route или JSX/Dart-компонент.

---

## Phase 2 — V50 Architecture Contract

Подготовь и реализуй необходимые ADR/TDS:

```text
domain ownership;
route ownership;
effective session;
capability model;
role and scope model;
owner/clinic/veterinarian separation;
clinical completion authority;
booking state machine;
telemedicine state machine;
payment state;
realtime contract;
offline policy;
feature flag strategy;
API compatibility;
migration strategy;
legacy retirement.
```

Не создавай новый ADR, если решение уже существует и соответствует V50.

В таком случае:

* переиспользуй;
* при необходимости уточни;
* зафиксируй связь в Parity Register.

---

## Phase 3 — V50 Design System and Shells

Реализуй:

```text
Owner Shell
Clinic Portal Shell
Veterinarian Workspace Shell
Ops/Security Shell where required
```

Общий смысл и токены должны совпадать, но Flutter и Next.js могут иметь platform-native реализацию.

Обязательные компоненты:

```text
PageScaffold
Section
StatusCard
StatusPill
FeatureCard
AsyncButton
Form controls
Segmented control
Skeleton
Empty state
Error state
Offline banner
Stale banner
Conflict banner
Timeline
Confirmation sheet/dialog
Responsive navigation
Task cards
Accessible data table
```

Не заменяй весь продукт generic web-layout.

Owner mobile должен ощущаться как мобильное приложение.

Clinic workspace должен ощущаться как операционный B2B-инструмент.

---

## Phase 4 — Effective Session, Capabilities and API Foundation

Для каждого endpoint family реализуй:

```text
resource descriptor;
effective capability;
active membership;
clinic/location/owner/platform scope;
normalized denial;
no data leakage;
feature flag;
legacy rollback path;
focused HTTP matrix.
```

Нельзя полагаться только на:

* роль в JWT;
* скрытую кнопку;
* sidebar visibility;
* client-side guard.

Backend всегда повторно проверяет полномочия.

---

## Phase 5 — Owner Core

Перенеси на V50:

```text
owner shell;
home;
selected pet context;
pets;
pet profile;
Pet Diary;
documents;
notifications;
profile and security.
```

Запрещено:

* demo pet ID;
* статические данные вместо API;
* локальный success без backend readback;
* потеря выбранного питомца между маршрутами.

---

## Phase 6 — Catalog and Booking

Полный маршрут:

```text
Home
→ Catalog
→ Filters
→ Clinic comparison
→ Clinic details
→ Doctor selection
→ Doctor profile
→ Service
→ Date
→ Slot
→ Review
→ Create hold
→ Server-authoritative status
```

Обязательные сценарии:

```text
loading availability;
empty availability;
stale availability;
slot selected;
creating hold;
SLOT_LOCKED_RETRY;
SLOT_ALREADY_TAKEN;
manual confirmation;
MIS reservation;
confirmed;
expired;
released;
booking failed;
offline blocking.
```

PostgreSQL и backend остаются источником истины.

Не подтверждай запись на основании локального UI.

---

## Phase 7 — My Bookings and Alternative Slot

Реализуй:

```text
active bookings;
history;
requires action;
booking details;
timeline;
cancel;
rebook;
alternative slot;
clinic contact;
route;
clinical summary after visit.
```

Alternative slot должен иметь реальный backend workflow.

Нельзя показывать:

```text
«слот удерживается»
```

если backend не создал соответствующий hold/protection.

---

## Phase 8 — Clinic Workspace

Реализуй V50 для:

```text
queue;
booking details;
confirm;
decline;
alternative;
notes;
SLA;
FIFO;
schedule;
services;
staff;
resources;
working hours;
blackout;
quality;
audit;
replay;
security.
```

На mobile не сжимай desktop table.

Используй task-flow:

```text
что требует действия;
какой SLA;
что можно сделать;
что заблокировано;
что изменилось.
```

---

## Phase 9 — Veterinarian Workspace

Реализуй:

```text
my visits;
visit details;
patient context;
allergy warnings;
documents;
clinical draft;
clinical completion;
recommendations;
follow-up;
attachments;
final publication;
amendments;
audit.
```

Критический инвариант:

```text
Clinic administrator не подписывает клиническое заключение.
Receptionist не заполняет медицинское заключение.
Platform administrator не редактирует clinical content.
Veterinarian выполняет clinical completion.
```

---

## Phase 10 — Telemedicine

Полный маршрут:

```text
intake
→ emergency guard
→ consent
→ payment authorization
→ queue
→ doctor assignment
→ waiting room
→ LiveKit room
→ call
→ completion
→ recommendation
→ history
```

Обязательные состояния:

```text
payment pending;
authorized;
queued;
assigned;
doctor joined;
joining room;
in call;
reconnecting;
poor connection;
doctor late;
cancelled by owner;
void requested;
refund pending;
refunded;
completed;
failed.
```

Не смешивать:

```text
payment authorization
capture
void
refund
```

Не писать пользователю «вернули деньги», если фактически выполняется void авторизации.

LiveKit отвечает за media transport.

Backend отвечает за business state.

Локальное завершение звонка не означает завершение консультации.

---

## Phase 11 — Emergency and Insurance

Emergency:

```text
без обязательной регистрации;
без оплаты;
без hold;
без telemed queue;
verified capability profile;
accepts now;
species support;
freshness;
direct call;
route;
safe fallback.
```

Insurance:

```text
policy;
consent;
verification;
coverage check;
partner status;
claim draft;
history.
```

VetHelp не принимает страховое решение и не гарантирует покрытие.

---

## Phase 12 — Realtime, Offline, Audit and Observability

Realtime:

```text
eventId;
eventType;
aggregateId;
aggregateVersion;
sequence;
occurredAt;
correlationId;
reconnect;
replay;
gap recovery;
REST rehydrate;
deduplication.
```

Offline допустим только для безопасных drafts и cached reads.

Запрещено offline:

```text
CreateHold
ConfirmAppointment
AcceptAlternative
Payment
JoinTelemed
CoverageCheck
ClinicalCompletion
```

Observability должна покрывать:

```text
booking conflicts;
DB lock waits;
SLA breach;
outbox lag;
MIS failures;
payment reconciliation;
LiveKit failures;
authorization denials;
realtime lag.
```

---

## Phase 13 — Full QA and V50 Certification

Для каждого V50 screen/state получи evidence.

Viewport matrix:

```text
1920×1080
1440×900
1024×768
768×1024
375×812
412×915
```

Проверить:

```text
layout;
content;
navigation;
actions;
states;
modals;
responsive behavior;
overflow;
keyboard;
focus;
screen reader semantics;
contrast;
text scaling;
reduced motion.
```

Обязательные E2E:

```text
Owner → Catalog → Booking → Clinic confirmation

Owner → Alternative slot → Accept → Updated booking

Owner → Booking → Visit → Veterinarian completion → Pet Diary

Owner → Telemed → Payment authorization → Queue
→ Doctor → LiveKit → Completion

Emergency red flag → Verified clinic → Call/route

Insurance → Coverage check → Partner status
```

Создай:

```text
docs/v50/V50-PARITY-CERTIFICATE.md
```

---

## Phase 14 — Rollout and Legacy Removal

Используй независимые feature flags.

Rollout:

```text
internal
pilot clinic
5%
20%
50%
100%
```

Rollback должен работать без downgrade базы.

Legacy удаляется только после:

```text
100% P0 parity;
critical E2E pass;
authorization validation;
rollback rehearsal;
stable pilot;
product sign-off;
UX sign-off;
QA sign-off;
architecture sign-off.
```

---

# 10. Definition of Done одного среза

Каждый выбранный срез считается завершённым только при наличии применимых слоёв:

```text
1. Product contract
2. V50 parity entry
3. ADR/TDS, если меняется инвариант
4. Schema/migration, если требуется
5. Backend implementation
6. OpenAPI DTO
7. Authorization and ownership
8. Idempotency/versioning, если требуется
9. Outbox/realtime contract, если требуется
10. Flutter или Next.js UI
11. Loading state
12. Empty state
13. Error state
14. Retry/conflict state
15. Offline/stale state, если применимо
16. Terminal states
17. Unit tests
18. Integration/HTTP tests
19. UI tests
20. Visual evidence
21. Accessibility check
22. Local seed/fixture
23. Smoke/E2E
24. Feature flag and rollback
25. Documentation/current-state update
```

Если применимый слой отсутствует, статус не может быть `DONE`.

---

# 11. Непереговорные технические инварианты

## Booking

* PostgreSQL — source of truth.
* Один slot не получает два active hold.
* Клиент не подтверждает запись.
* Idempotency-Key обязателен для mutation.
* Внешний MIS HTTP не вызывается внутри DB lock transaction.
* Late payment не оживляет expired hold.
* Client time не является источником TTL.
* `SKIP LOCKED` запрещён для interactive booking.

## Payments

* различать authorization, capture, void и refund;
* webhook deduplication;
* payment fencing;
* late webhook reconciliation;
* UI отображает только authoritative backend state.

## Authorization

* deny-by-default;
* effective capability;
* resource scope;
* active membership;
* no cross-clinic;
* no cross-location;
* no cross-owner;
* no resource leakage.

## Clinical data

* receptionist и clinic admin не подписывают medical conclusion;
* sensitive documents требуют server-side scope;
* access фиксируется в audit;
* final conclusion immutable либо изменяется через amendment.

## Telemedicine

* red flag не направляется в telemed queue;
* doctor join подтверждается backend event;
* room transport не владеет payment/session state;
* запись видео выключена по умолчанию;
* completion не определяется локальной кнопкой.

## Emergency

* не зависит от auth, booking, MIS, payment или telemed;
* только verified capabilities;
* freshness обязательна.

## Offline

* booking, payment, insurance check и clinical completion не ставятся в offline outbox.

---

# 12. Запрещённые действия

Не выполняй без отдельного доказанного основания:

```text
полный rewrite приложения;
переименование applied migration;
force push;
git reset --hard;
git clean -fd;
docker compose down -v;
удаление пользовательской БД;
слепой git add .;
коммит секретов;
коммит .env.local;
коммит JWT;
коммит generated Flutter/iOS files;
массовый dependency upgrade;
npm audit fix --force;
удаление legacy до rollout;
создание второго параллельного local stack;
временный backend на другом постоянном порту;
фиктивный API;
фиктивный success state;
hardcoded demo IDs в production flow;
UI-only authorization.
```

---

# 13. Git policy

Перед изменениями:

```text
git status --short
git branch --show-current
проверка merge/rebase state
```

Перед commit:

```text
git diff --check
git status -sb
git diff --cached --stat
git diff --cached
```

Один commit должен соответствовать одному логическому срезу.

Не смешивай:

* backend migration;
* unrelated UI;
* generated files;
* документацию другого этапа;
* случайный formatting;
* dependency update.

Не выполняй push, merge или создание PR, если это явно не требуется текущим пользовательским запросом или утверждённой инструкцией `current-state`.

---

# 14. Test policy

Используй минимально достаточный набор тестов.

Для известного continuation slice сначала запускай focused harness.

Полный suite нужен, если изменились:

* shared contract;
* authorization core;
* migrations;
* design system shared globally;
* booking transaction;
* payment;
* common routing;
* common realtime infrastructure.

Не повторяй успешный тест без изменения релевантного кода.

Не называй тест успешным, если:

```text
No tests found
test skipped unexpectedly
command не запускался
environment был недоступен
exit code неизвестен
```

Сохраняй:

```text
command;
exit code;
pass/fail count;
краткую причину ошибки.
```

Не сохраняй в контекст полный test log.

---

# 15. Работа с блокерами

Не используй `ABSTAIN` без фактической попытки выполнить необходимую команду.

Блокер считается доказанным только если указаны:

```text
команда;
exit code;
краткая ошибка;
почему безопасного локального обхода нет.
```

При неблокирующей неопределённости:

* прими консервативное решение;
* продолжи;
* укажи assumption в отчёте.

При блокирующей неопределённости задай одно сгруппированное сообщение, максимум пять вопросов.

Не задавай вопрос, ответ на который можно получить из репозитория.

---

# 16. Первый запуск этого master prompt

В первый запуск не ограничивайся созданием очередного roadmap.

Выполни реальную работу.

## Обязательная последовательность первого запуска

1. Прочитай:

   * `.agents/skills/adaptive-orchestrator/SKILL.md`;
   * `git status --short`;
   * `docs/ai/current-state.md`, если существует.

2. Определи:

   * текущую ветку;
   * merge/rebase state;
   * dirty files;
   * актуальный V50 source;
   * существующий parity/current-state;
   * migration risk;
   * известные test harness.

3. Классифицируй состояние:

   * continuation или new scope;
   * complexity;
   * risk;
   * context budget.

4. Создай или обнови:

   * `docs/ai/current-state.md`;
   * `docs/ai/chat-registry.md`;
   * `docs/ai/chats/CHAT-BOOTSTRAP-TEMPLATE.md`;
   * `docs/ai/handoffs/CHAT-HANDOFF-TEMPLATE.md`;
   * `docs/v50/V50-PARITY-REGISTER.md`;
   * `docs/v50/V50-PROGRAM-PLAN.md`.

   Затем определи первый P0 bounded context и создай только один bootstrap:

   ```text
   docs/ai/chats/<chat-id>-bootstrap.md
   ```

5. Не ограничивайся документацией:

   * выбери первый безопасный P0-срез;
   * реализуй его в текущем запуске;
   * выполни focused checks;
   * обнови status/evidence.

6. При текущем merge conflict или migration inconsistency:

   * сначала стабилизируй baseline;
   * не начинай feature development поверх неопределённого Git/DB state.

7. Остановись после:

   * завершения выбранного среза;
   * прохождения обязательных проверок;
   * обновления current-state;
   * записи следующего рекомендованного среза.

---

# 17. Правило выбора следующего среза

Выбирай работу по следующему приоритету:

```text
1. Data loss / migration blocker
2. Authorization or clinical-role violation
3. Broken repository/runtime baseline
4. Missing parity register or source mapping
5. Shared V50 shell/design foundation
6. Owner catalog and booking
7. Clinic confirmation
8. Veterinarian clinical completion
9. Telemedicine
10. Emergency and insurance
11. Realtime/offline
12. Legacy cleanup
```

Внутри одинакового приоритета выбирай срез, который:

* завершает пользовательский маршрут;
* снимает blocker для нескольких экранов;
* имеет известный test harness;
* минимизирует параллельный незавершённый код;
* даёт проверяемый user-visible outcome.

---

# 18. Обязательный отчёт после каждого запуска

Верни:

## Result

```text
COMPLETED
PARTIALLY_COMPLETED
BLOCKED
```

## Selected slice

* V50 IDs;
* domain;
* routes;
* authority model;
* feature flags.

## User-visible outcome

Что теперь реально может сделать владелец, сотрудник клиники или ветеринар.

## What changed

Кратко по поведению.

## Changed files

Только релевантные файлы.

## Architecture decisions

Только решения, реально принятые в этом запуске.

## Agents and models

Только фактически использованные агенты и причина.

Не придумывай агентов.

## Validation

Отдельно:

```text
Test verdict
Execution verdict
Validator verdict
Vetoes
```

## Checks

Для каждой команды:

```text
command
exit code
passed/failed count
```

## V50 parity update

```text
Implemented
Tested
Visually verified
Still blocked
```

## Chat orchestration

```text
root chat status
active work chats
newly created chats
completed/archived chats
chat IDs and V50 scope
branch/worktree ownership
handoffs reused
integration chat status
overlapping ownership: yes/no
context compression events
```

## Context economy

```text
discovery methods
files inspected
files changed
tool-call count
test/build commands
Docker retries
repair cycles
repeated checks
broad repository scans
repeated file reads
repeated test runs
estimated duplicated work
budget exceeded: yes/no
```

## Efficiency verdict

Ровно одно значение:

```text
EFFICIENT
ACCEPTABLE
INEFFICIENT
```

С кратким объяснением.

## Assumptions and residual risks

Только существенные.

## Next slice

Один конкретный следующий срез.

Не предлагай несколько альтернатив пользователю, если технически можешь определить приоритет самостоятельно.

---

# 19. Финальный критерий программы

Нельзя заявить:

```text
V50 implemented
V50 completed
Full parity achieved
```

до выполнения всех условий:

```text
Все V50 screens/states находятся в Parity Register.
Все P0 строки имеют статус не ниже UAT_ACCEPTED.
Все production routes существуют.
Все CTA работают через реальные contracts.
Нет demo ID в production flow.
Backend является source of truth.
Authorization проверяется сервером.
Clinical roles разделены.
Booking и payment invariants подтверждены.
Desktop/tablet/mobile проверены.
Loading/empty/error/conflict/offline/terminal states покрыты.
Critical E2E пройдены.
Accessibility audit пройден.
Rollout выполнен.
Rollback проверен.
Legacy удалён.
V50-PARITY-CERTIFICATE подписан.
```

До этого используй только формулировку:

```text
V50 migration in progress
```

Начинай выполнение сейчас.
