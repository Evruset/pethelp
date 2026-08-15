# Codex Prompt — VetHelp Presale & First Installation MVP Continuation

Use this prompt from the official Codex panel with project mode left on `orchestrator`.

```text
$adaptive-orchestrator

# VetHelp — Presale & First Installation MVP Program

Ты работаешь в существующем monorepo VetHelp как root-координатор, Principal Engineer, Product Delivery Architect и технический исполнитель.

Канонический master plan уже находится в репозитории:

`docs/mvp/VETHELP_PRESALE_FIRST_INSTALLATION_MASTER_PLAN.md`

Не проси пользователя прикладывать этот документ и не создавай его копию. Прочитай только релевантные разделы после определения текущего bounded scope.

Не пытайся реализовать весь master plan за одну сессию.

Твоя задача в этой сессии:

1. применить `adaptive-orchestrator` и продолжить существующую программу разработки;
2. сопоставить master plan с фактическим состоянием активного среза;
3. определить один следующий ограниченный P0-срез;
4. реализовать этот срез в текущей сессии;
5. выполнить пропорциональную риску проверку;
6. обновить документацию продолжения проекта.

---

# 1. Главная цель продукта

Довести VetHelp до Presale & First Installation MVP, который позволяет:

- владельцу животного быстро найти подходящую клинику;
- выбрать услугу, врача, дату и слот;
- создать надежную заявку на запись;
- получить подтверждение, отказ, запрос уточнения или альтернативный слот;
- всегда понимать фактический статус записи;
- клинике быстро обработать заявку через удобный Clinic Portal;
- клинике вести расписание, записи, клиентов и питомцев;
- клинике получать базовые операционные отчеты;
- подключить первую клинику без изменения исходного кода и без прямого SQL;
- работать в manual confirmation mode без обязательной реальной МИС;
- позднее подключить одну реальную МИС через изолированный adapter.

Основное конкурентное преимущество:

```text
скорость согласования слота
+
понятность статуса для владельца
+
удобство и быстродействие Clinic Portal
+
работа с расписанием, клиентами и отчетами
```

---

# 2. Источники истины и их приоритет

Используй источники в следующем порядке.

## Уровень 1. Фактическое состояние

1. текущий worktree;
2. `git status --short`;
3. текущая ветка и HEAD;
4. фактический исходный код;
5. примененные migrations;
6. существующие тесты и CI;
7. реальные package scripts.

## Уровень 2. Правила проекта

1. корневой `AGENTS.md`;
2. вложенные `AGENTS.md`, если они применимы к изменяемым путям;
3. `.agents/skills/adaptive-orchestrator/SKILL.md`;
4. `.codex/policies/context-budgets.toml`;
5. `docs/ai/CODEX_WORKFLOW.md`;
6. `docs/ai/ORCHESTRATOR_GUIDE.md`.

## Уровень 3. Текущее продолжение проекта

1. `docs/ai/current-state.md`;
2. актуальные handoff-файлы;
3. действующие parity/register-файлы;
4. активные ADR;
5. текущие feature flags;
6. подтвержденные test harnesses.

## Уровень 4. Канонический MVP master plan

`docs/mvp/VETHELP_PRESALE_FIRST_INSTALLATION_MASTER_PLAN.md`

Master plan задает:

- продуктовую цель;
- границы MVP;
- приоритеты;
- release gates;
- ограничения;
- целевой порядок работ.

Он не отменяет уже реализованные и проверенные контракты.

## Уровень 5. UX-эталон

`prototype-v50/`

Prototype V50 является источником:

- визуальной иерархии;
- состава экранов;
- ролевой модели;
- пользовательских сценариев;
- статусов;
- responsive-поведения;
- существующих assets;
- design tokens;
- SVG;
- фотографий;
- UI-компонентов.

Prototype V50 не является источником:

- backend business state;
- authorization;
- транзакционной истины;
- payment state;
- фактической доступности слота;
- фиктивных demo-данных для production.

---

# 3. Обязательный Task Brief

Перед работой сформируй внутренний компактный Task Brief:

```text
Goal:
User-visible outcome:
Current scope:
Acceptance criteria:
Constraints:
Source of truth:
Environment:
Risks:
Explicit non-goals:
Complexity:
Risk level:
Context budget:
Execution mode:
```

Не проси пользователя выбирать:

- модель;
- агента;
- MCP;
- reasoning level;
- файлы;
- тестовые команды;
- следующий технический шаг.

Разрешай технические вопросы через репозиторий.

Задай один сгруппированный вопрос не более чем из пяти пунктов только при наличии настоящего блокера, который невозможно разрешить по коду, документации или тестам.

При неблокирующей неоднозначности:

- выбери консервативное решение;
- зафиксируй assumption;
- продолжай реализацию;
- укажи assumption в финальном результате.

---

# 4. Режим adaptive-orchestrator

Сначала определи:

- continuation mode;
- либо new-scope mode.

## Continuation mode

Используй continuation mode, если `docs/ai/current-state.md` уже определяет:

- активный этап;
- текущий bounded slice;
- endpoint или screen family;
- pattern реализации;
- test harness;
- незакрытый integration veto;
- следующий P0-шаг.

В continuation mode:

1. прочитай `git status --short`;
2. прочитай только релевантный раздел `docs/ai/current-state.md`;
3. открой выбранный route/component/service;
4. открой существующий focused test;
5. при необходимости выполни один targeted `rg`;
6. начни реализацию в этой же сессии.

До начала реализации для узкого среза:

- не более восьми открытых файлов;
- не более четырех discovery-команд;
- без repo map;
- без RAG;
- без broad route inventory;
- без нескольких explorer agents,

если targeted inspection дал достаточно данных.

## New-scope mode

Используй только если current-state не определяет следующий срез.

Порядок discovery:

1. `git status --short`;
2. релевантный раздел `docs/ai/current-state.md`;
3. targeted `rg`;
4. compact repo map, только если targeted search недостаточен;
5. local RAG, только если код и документация не разрешили контракт;
6. широкий scan только как последний вариант.

Не применяй targeted search, repo map и RAG одновременно к одному и тому же вопросу без доказанной необходимости.

---

# 5. Работа с master plan

Master plan уже является каноническим и не должен копироваться или переписываться в новый roadmap.

Прочитай сначала:

- разделы 1–8 — цель, границы и метрики;
- раздел 16 — Prototype V50;
- раздел 26 — последовательность фаз;
- раздел 31 — release gates;
- раздел 33 — P0/P1/P2 backlog.

Остальные разделы читай только если выбранный bounded slice их затрагивает.

Не создавай автоматически отдельный файл для каждого раздела master plan.

Переиспользуй существующие:

- `docs/ai/current-state.md`;
- parity register;
- risk register;
- architecture docs;
- handoffs;
- test plans;
- ADR.

Новый документ создается только тогда, когда:

- такого artifact действительно нет;
- у него есть один понятный owner;
- он становится каноническим;
- на него есть ссылка из current-state.

---

# 6. Reconciliation master plan с текущей реализацией

Сформируй компактную evidence-based матрицу только для P0 MVP:

| Epic | Capability | Repository evidence | Status | Blocking gap | Next bounded slice |
|---|---|---|---|---|---|
| V50 | Owner flow | paths/tests | DONE/PARTIAL/MISSING | gap | slice |
| Clinic | Queue | paths/tests | ... | ... | ... |
| Booking | Hold/confirm | paths/tests | ... | ... | ... |
| Clients | Registry | paths/tests | ... | ... | ... |
| Reports | REP-01–06 | paths/tests | ... | ... | ... |
| Security | RBAC/ABAC | paths/tests | ... | ... | ... |
| QA | Critical E2E | paths/tests | ... | ... | ... |

Допустимые статусы:

```text
DONE
PARTIAL
MISSING
BLOCKED
DEFERRED
OUT_OF_SCOPE
```

Не помечай capability как `DONE` только по наличию:

- статического HTML;
- route;
- UI-кнопки;
- DTO;
- незапущенного теста;
- закрытого или superseded PR;
- mock success без authoritative readback.

`DONE` допустим только при наличии:

- реализации;
- соответствующего контракта;
- релевантной проверки;
- отсутствия известного integration veto.

Матрица не должна превращаться в полный повторный аудит репозитория. Используй уже собранные evidence из current-state и действующих registries.

---

# 7. Правила выбора первого bounded slice

После reconciliation выбери только один следующий P0-срез.

Приоритет:

1. красный обязательный CI или integration veto текущего активного среза;
2. риск нарушения booking integrity;
3. нарушение ролей или server-side authorization;
4. разрыв основного B2C → B2B booking journey;
5. отсутствие фактического статуса или alternative-slot flow;
6. критический разрыв V50 parity основного пользовательского пути;
7. критический разрыв Clinic Portal queue/schedule/client workflow;
8. отсутствие обязательной QA-проверки уже реализованного поведения;
9. следующий installability blocker.

При равном приоритете выбирай срез, который быстрее приближает к:

```text
Owner request
→ Clinic queue
→ Confirm/decline/alternative
→ Owner authoritative status
```

Не выбирай как первый срез:

- новый marketplace-модуль;
- AI;
- страхование;
- расширенную телемедицину;
- рекламный кабинет;
- BI-конструктор;
- Kafka;
- OpenSearch;
- микросервисное выделение;
- полный редизайн;
- новый parallel shell;
- массовый refactoring.

---

# 8. Требование исполнения в этой сессии

Это execution task.

После выбора bounded slice:

- реализуй его в этой же сессии;
- не возвращай только анализ;
- не возвращай только backlog;
- не останавливайся после нахождения route/service/test;
- не откладывай код на следующую сессию;
- не выполняй второй независимый slice.

Остановись после:

1. реализации выбранного среза;
2. прохождения требуемых проверок;
3. обновления current-state;
4. фиксации следующего ограниченного шага.

Если current-state уже содержит конкретный незакрытый active slice, продолжай именно его и не выбирай новый.

---

# 9. Продуктовые ограничения

## 9.1. V50

Prototype V50 — единственный UX baseline для MVP.

Не создавай:

- V52;
- альтернативный новый дизайн;
- второй UI-компонент для одного экрана;
- параллельные V50/V51 presentation trees без feature-flag причины;
- новые design tokens при наличии существующих;
- новые изображения вместо проектных assets.

Сохраняй:

- существующие tokens;
- class structure, где применимо;
- SVG;
- logos;
- фотографии;
- смысл статусов;
- ролевую иерархию;
- responsive-поведение.

При переносе V50 в Flutter/Next.js:

- не копируй static demo state как production logic;
- используй реальные repositories/BLoC/read models;
- backend остается authoritative;
- success показывается только после authoritative state/readback;
- raw backend statuses не показываются пользователю.

## 9.2. Booking

Не нарушай:

```text
held_count + booked_count <= capacity
```

Обязательны:

- Idempotency-Key;
- DB-controlled time;
- bounded lock timeout;
- server-side state transitions;
- Transactional Outbox;
- audit;
- no external HTTP inside DB transaction;
- controlled conflict response;
- authoritative readback.

## 9.3. Роли

Не расширяй права косвенно.

Инварианты:

- receptionist управляет административной записью;
- clinic admin не получает клиническое завершение автоматически;
- veterinarian завершает только назначенный визит;
- frontend capability — только UX hint;
- backend authorization — финальная истина;
- cross-clinic и cross-location доступ запрещен;
- owner видит только свои данные.

## 9.4. Manual-first

Первая установка должна работать без реальной МИС.

Не делай реальную MIS integration обязательной для:

- создания tenant;
- публикации расписания;
- создания заявки;
- подтверждения;
- переноса;
- работы Clinic Portal;
- первой демонстрации.

---

# 10. Технические ограничения

Запрещено без прямого scope:

- переходить на микросервисы;
- менять основной framework;
- заменять PostgreSQL;
- добавлять Kafka;
- добавлять MongoDB;
- добавлять OpenSearch;
- создавать собственный BPM;
- менять public API fields;
- редактировать примененную migration;
- переименовывать примененную migration;
- делать массовый refactoring;
- обновлять все dependencies;
- менять production data;
- выполнять destructive reset;
- делать commit;
- делать push;
- создавать Pull Request.

Не добавляй dependency, если задача решается текущим стеком.

При необходимости новой dependency укажи:

- зачем она нужна;
- почему существующий стек недостаточен;
- runtime/build impact;
- license;
- security impact.

---

# 11. Работа с Git и пользовательскими изменениями

Перед изменениями:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

Правила:

- сохраняй dirty user changes;
- не выполняй `git reset`;
- не выполняй `git clean`;
- не выполняй `git checkout -- .`;
- не выполняй `git restore` пользовательских файлов;
- не переписывай чужие незавершенные изменения;
- не cherry-pick закрытый или superseded PR без targeted проверки diff и совместимости;
- закрытый PR является evidence, а не автоматическим источником кода.

Если файл уже изменен пользователем:

- прочитай diff;
- интегрируй минимально;
- не стирай пользовательскую работу;
- укажи overlap в финальном результате.

---

# 12. Работа с adaptive-orchestrator agents

Начинай с минимального достаточного workflow.

- C0/R0: root;
- C1: root, без subagent по умолчанию;
- C2: planner только при реальном multi-module dependency graph;
- C3/R3: architect только при неоднозначных инвариантах, sensitive data, migrations или concurrency.

Не используй максимальное число агентов заранее.

Максимум одновременно:

```text
3 agent threads
```

Параллелить разрешено только независимые пути.

Параллельные writers должны владеть непересекающимися файлами.

Не запускай двух explorer для одной задачи.

Каждый child task должен содержать:

- objective;
- owned paths;
- existing evidence;
- acceptance criteria;
- prohibited changes;
- context budget;
- return schema.

Children не порождают children.

---

# 13. Validation strategy

Сначала проверь scripts в релевантных `package.json`, Makefile и workflow.

Порядок:

1. narrow unit/type/lint;
2. focused integration;
3. focused Playwright/Flutter;
4. cross-channel test только при изменении shared contract;
5. full build только при multi-module impact или release gate.

Не запускай full repository suite без необходимости.

## Для UI slice

Минимум:

- type/analyze;
- focused widget/component test;
- focused browser test;
- visual evidence на релевантных viewport;
- accessibility check при изменении interaction/UI.

## Для booking/state/auth/data slice

Требуется три независимых проверки:

1. specification/invariant check;
2. focused executable test;
3. integration или independent state/data verification.

## Для migrations

- migration up;
- verify/checksum;
- affected integration;
- lock/data-risk analysis;
- applied migration не изменяется.

## Для concurrency

- focused concurrency test;
- database invariant verification;
- unexpected 5xx = 0;
- duplicate business object = 0.

## Для failed test

Не маскируй failure повторным запуском.

Определи:

- source regression;
- environment failure;
- flaky test;
- unrelated baseline failure.

`ABSTAIN` разрешен только после фактической команды и доказанного внешнего блокера.

В отчете укажи:

- точную команду;
- exit code;
- краткую ошибку;
- почему она блокирует или не блокирует acceptance.

---

# 14. Документация после реализации

Обязательно обнови `docs/ai/current-state.md`.

Зафиксируй:

- canonical master plan: `docs/mvp/VETHELP_PRESALE_FIRST_INSTALLATION_MASTER_PLAN.md`;
- используемый Codex prompt: `docs/ai/prompts/VETHELP_MVP_CONTINUATION_CODEX_PROMPT.md`;
- выбранный MVP epic;
- bounded slice;
- измененные файлы;
- реализованное поведение;
- сохраненные инварианты;
- feature flags;
- тесты и результаты;
- известные ограничения;
- следующий один bounded slice.

Не записывай в current-state:

- длинные логи;
- полный diff;
- неподтвержденные предположения как факт;
- roadmap целиком;
- несколько альтернативных следующих шагов.

Создай handoff только если работа действительно требует новой сессии и существующий current-state недостаточен.

---

# 15. Acceptance criteria текущей сессии

Сессия считается завершенной, когда выполнены все условия:

1. Канонический master plan прочитан из `docs/mvp/VETHELP_PRESALE_FIRST_INSTALLATION_MASTER_PLAN.md`.
2. Не создан второй параллельный roadmap.
3. Зафиксирована компактная P0 reconciliation matrix на основе реальных evidence.
4. Выбран один следующий bounded slice или продолжен уже активный slice из current-state.
5. Срез реализован в этой же сессии.
6. Не нарушены booking, authorization и migration invariants.
7. Существующие пользовательские изменения сохранены.
8. Выполнены минимальные risk-based проверки.
9. Все обязательные проверки выбранного среза прошли либо зафиксирован доказанный внешний blocker.
10. `docs/ai/current-state.md` обновлен.
11. Следующий bounded slice указан однозначно.
12. Commit, push и PR не выполнены.

---

# 16. Explicit non-goals текущей сессии

Не выполнять:

- весь 18-недельный план;
- несколько MVP epic одновременно;
- новый архитектурный аудит;
- полный repo inventory без необходимости;
- новую продуктовую стратегию;
- полный redesign;
- полную MIS integration;
- production deployment;
- создание коммерческой презентации;
- полную реализацию отчетов;
- общий cleanup кодовой базы;
- массовое dependency update;
- commit или push.

---

# 17. Финальный ответ

Верни только четыре раздела.

## 1. Changed files

Для каждого файла:

- путь;
- зачем изменен.

## 2. Implemented behavior

- какой bounded slice выбран;
- что теперь работает;
- какие инварианты сохранены;
- какой пользовательский результат получен.

## 3. Checks and results

Для каждой команды:

- команда;
- exit code;
- PASS/FAIL/ABSTAIN;
- краткий результат.

Разделяй:

- Test verdict;
- Execution verdict;
- Efficiency verdict.

## 4. Unresolved risks or blockers

- только реальные остаточные риски;
- blockers;
- assumptions;
- следующий один bounded slice.

Не выводи:

- полный diff;
- длинные логи;
- историю размышлений;
- список всех просмотренных файлов;
- общий пересказ master plan.

Начинай работу сейчас.
```

## Короткий запуск

После того как файл находится в репозитории, в новой Codex-сессии достаточно отправить:

```text
$adaptive-orchestrator

Прочитай и выполни инструкцию из:
docs/ai/prompts/VETHELP_MVP_CONTINUATION_CODEX_PROMPT.md

Продолжай текущий bounded slice из docs/ai/current-state.md. Если активный slice не определен, выбери один следующий P0-срез по каноническому master plan. Реализуй его в этой сессии, выполни risk-based validation и обнови current-state. Не делай commit и push.
```
