# VetHelp prototype-v50: анализ текущего состояния и разрывов

Дата снимка: 11 июля 2026 года

Этап: 0 — инвентаризация, без feature-кода

Репозиторий: `Evruset/pethelp`, checkout `/Users/evrusetskiy/work/pethelp-alpha`

Ветка: `backup/local-wip-20260703` (`eac51aa`)

Эталон UX: `/Users/evrusetskiy/Downloads/VetHelp_Prototype_UAT_Insurance_Catalog_v50`

## 1. Границы и достоверность анализа

Этот документ описывает фактический working tree, а не только `HEAD`. На момент снимка в нём уже были пользовательские изменения:

- изменены `apps/owner_mobile/ios/Flutter/Debug.xcconfig`, `Release.xcconfig` и `apps/owner_mobile/lib/features/catalog/public_catalog_page.dart`;
- не отслеживаются local launcher, lockfiles, iOS Podfile/devtools, catalog tests и Playwright snapshots.

Эти файлы не изменялись в Этапе 0. Незакоммиченный catalog UI учитывается как локальное текущее состояние и помечается как такое; выводы о backend-контрактах опираются только на отслеживаемый server code и migrations.

Источники в порядке доказательной силы:

1. migrations, controllers/services, route files и клиентские repositories;
2. автоматизированные tests и сохранённые QA-отчёты;
3. `prototype-v50` как эталон семантики, IA и responsive-композиции;
4. README и ранние планы.

Локальный `AGENTS.md` и корневой README отсутствуют. Компонентные README прочитаны, но не считаются источником истины при расхождении с кодом.

Статусы в матрицах:

- **реализовано** — production route и серверный контракт существуют, ключевой сценарий тестируется;
- **частично** — есть рабочий вертикальный срез, но не вся семантика/роль/state coverage v50;
- **отсутствует** — production route, модель или API не найден;
- **конфликт** — текущий код противоречит целевой безопасности или продуктовой границе;
- **неизвестно** — доказательств недостаточно; предположение не подставляется.

## 2. Резюме

VetHelp существенно шире, чем описывают ранние README: production-код уже содержит OTP/JWT, owner pets/care, booking и alternative slot, зрелое расписание и очередь клиники, telemed owner/vet, payment/reconciliation, insurance, emergency, outbox, audit и observability. Однако parity с v50 пока не является расширением нескольких страниц: отсутствуют единый capability contract, admin read models, clinic patient access и нормализованный clinical visit domain.

Критическая последовательность зависимостей подтверждает порядок master prompt:

`capabilities/ABAC → admin read models и clinical schema/API → role-aware portal workspaces → owner parity → realtime/UAT`.

Самые опасные текущие противоречия:

1. Применённая в local DB migration `1719380000000_harden_audit_compliance_metadata.js` переименована в checkout в `1719400000002_harden_audit_compliance_metadata.js` при том же SHA-256. Из-за утраты исходного имени `node-pg-migrate` блокирует штатный backend startup до запуска новых migrations.
2. `POST /v1/clinic/booking-holds/:holdId/complete` разрешён `CLINIC_ADMIN` и принимает свободный `summary`; это прямо нарушает границу v50 «администратор не подписывает медицинское заключение». Проверка использует JWT `locationIds`, но не активную DB membership в транзакции.
3. Migration разрешает `CLINIC_VETERINARIAN` в `employee_location_memberships`, но `ClinicEmployeeAccessService`, portal `canAccessClinicLocation` и все queue/schedule/quality endpoints допускают только admin/receptionist. Это база для врача, но не capability-aware workspace.
4. `booking_holds`, `appointments` и одно поле `clinical_summary` сейчас выполняют часть роли визита. Отдельных visit states, versioned sections, signature/amendment, consent evidence и clinical audit aggregate нет.
5. Platform telemed vet slice зрелый, но admin dispatcher клиники отсутствует; текущий legacy clinic telemed route намеренно возвращает denial.

## 3. Фактическая структура

### 3.1 Backend

NestJS 11 root собирается в `backend/src/nest-root-full.ts`. Основные bounded contexts:

| Контекст | Фактические модули/таблицы | Состояние относительно v50 |
| --- | --- | --- |
| Identity/auth | `auth/*`, `identity_schema.*` | OTP, access/refresh/logout, role enum и owner scope реализованы; session capabilities отсутствуют |
| Pets/care | `owner-pet.*`, `pet_schema.pets`, `pet_documents` | owner CRUD/care summary/documents есть; clinic patient registry/read access отсутствуют |
| Booking | `booking-core/*`, `booking_schema.*` | зрелые hold transitions, FIFO, SLA, alternatives, idempotency, audit/outbox; appointment lifecycle неполон |
| Schedule | `clinic-schedule.*`, `clinic_schema.clinic_*`, `schedule_periods`, `location_working_hours` | services/staff/resources/periods/hours/manual slots/blackout/capacity реализованы |
| Telemed | `modules/telemed/*`, `telemed_schema.*` | owner intake/payment/wait/cancel/room и assigned vet workspace есть; clinic admin dispatch и clinical conclusion отсутствуют |
| Payments/MIS | `modules/payments`, `modules/mis-integration` | fencing, webhook verification, outbox и reconciliation есть |
| Insurance | `modules/insurance`, `insurance_schema.*` | profile, consent revoke, coverage snapshot/worker есть |
| Emergency | `emergency-routing/*`, `clinic_schema.emergency_*` | rules, verified capabilities, triage and route actions есть |
| Audit/ops | `audit_schema.audit_log`, observability, outbox | append-only operational evidence развито; clinical read/sign/amend audit не существует |

Авторитетный migration runner использует `backend/migrations/node-pg`; старые `backend/migrations/*.sql` всё ещё лежат рядом и создают риск ошибочного чтения схемы. Checksums и forward-only guards документированы.

### 3.2 Clinic portal

Production routes существуют для location-scoped queue, schedule и quality, а также отдельной platform telemed vet queue:

- `/clinics/[clinicId]/locations/[locationId]/queue`;
- `/clinics/[clinicId]/locations/[locationId]/schedule`;
- `/clinics/[clinicId]/locations/[locationId]/quality`;
- `/telemed/vet`;
- `/ops/security`.

Shell показывает только «Очередь / Расписание / Качество». Workspace, appointment registry/detail, patient registry/detail и visit workbench отсутствуют. Clinic telemed page не является dispatcher: он перенаправляет `TELEMED_VETERINARIAN` на platform route, остальных блокирует.

### 3.3 Owner Flutter

Production-like entry point — `lib/owner_journey_main.dart`; `lib/main.dart` остаётся demo launcher с UUID/JWT из `--dart-define`. Реальные repositories покрывают auth, catalog, booking, appointments, pets/care, insurance, emergency и telemed.

Текущий outbox policy корректно запрещает offline booking/payment/telemed/emergency/coverage commands, но store создаётся как `InMemoryOfflineCommandStore`. Access/refresh tokens живут только в `OwnerSession` в памяти; secure storage/refresh lifecycle отсутствуют. Replay repository и gap/version gate есть, но durable cursor и transport subscription не интегрированы в общий app lifecycle.

## 4. Главная gap matrix

| Область | Статус | Доказательство текущего состояния | Разрыв до v50 |
| --- | --- | --- | --- |
| Role enum | реализовано | `backend/src/auth/auth.types.ts` | enum есть, но enum не равен capability contract |
| Capability payload/evaluator | отсутствует | session/JWT содержит только `roles`, `clinicIds`, `locationIds` | нет deny-by-default `capabilities`, allowed actions и assignment/data-category scope |
| Clinic membership | частично | `employee_location_memberships`, migration `1719400000001` | vet membership разрешена схемой, но access service её отвергает |
| Admin dashboard | отсутствует | нет route/controller/read model | нужны operational counters, arrivals, delays, unassigned telemed, utilisation |
| Queue | реализовано | queue service/controller, Next page, Playwright | сильный Level-C slice; не встроен в role-aware shell/route map |
| Schedule | реализовано | 15 backend operations, Next client, HIG Playwright | admin-only role contract; responsive coverage только 1280/768 |
| Appointment registry/detail | отсутствует | owner read models есть, clinic list/detail API нет | server filters, cursor, timeline, check-in/reschedule/admin detail отсутствуют |
| Patient registry/detail | отсутствует | только owner-scoped pet endpoints | нет clinic treatment relationship/category-filtered patient reads |
| Clinical visit | конфликт/отсутствует | `clinical_summary` на hold и admin/vet `complete` endpoint | нет отдельного aggregate/state machine/sections/signature/amendment; admin имеет клиническую команду |
| Admin telemed | отсутствует | legacy clinic route возвращает denial | нет clinic/location dispatcher и assign-to-clinic-vet capability |
| Doctor telemed | частично | `/v1/telemed/vet`, `/telemed/vet` | platform role only; нет clinic doctor integration и final clinical record |
| Owner catalog/booking | реализовано | catalog + marketplace repositories/pages/tests | doctor selection/comparison/review route parity неполна |
| Owner appointments/alternative | реализовано | list/detail/cancel/alternative pages and APIs | deep-link/router persistence не оформлены |
| Owner pet/care | частично | pet CRUD, care summary, documents | diary IA, attachments lifecycle и full v50 polish неполны |
| Owner telemed | частично | intake/payment/list/wait/cancel/LiveKit view | pre-check, reconnect/fallback и summary route не выделены полностью |
| Owner insurance/emergency | реализовано/частично | APIs/pages/tests | route recovery, broad visual/UAT matrix неполны |
| Notifications/profile | отсутствует | snackbar и placeholder copy | нет repository/API/session management/preferences UI |
| Durable mobile persistence | отсутствует | pubspec не содержит secure storage/DB; in-memory outbox/session | restart recovery и encrypted local data отсутствуют |
| Realtime | частично | booking replay endpoint/repository | нет WebSocket/SSE subscription, durable cursor и full-domain replay |
| Localization | частично | большая часть UI русская | quality/technical strings и часть statuses остаются английскими; нет единого l10n layer |
| Accessibility/responsive | частично | axe telemed, HIG tests, selected Flutter scale tests | не покрыта обязательная viewport/zoom/keyboard matrix |

## 5. Capability matrix: target и текущий enforcement

`✓` — разрешено и подтверждено; `—` — запрещено; `P` — частично; `!` — конфликт.

| Capability | Admin/reception target | Doctor target | Текущий backend | Текущий portal |
| --- | ---: | ---: | --- | --- |
| `clinic.dashboard.read` | ✓ | personal only | отсутствует | отсутствует |
| `booking.queue.read/manage` | ✓ | — | admin/reception + DB membership | admin/reception |
| `schedule.read/manage` | ✓ | — без отдельной capability | admin/reception + DB membership | admin/reception |
| `appointment.registry.read` | ✓ | assigned shift only | отсутствует | отсутствует |
| `appointment.confirm/decline/alternative` | ✓ | — | admin/reception + DB membership | queue UI |
| `appointment.check_in/reschedule` | ✓ | — | отсутствует как отдельная команда | отсутствует |
| `patient.registry.read/admin_edit` | ✓ | scoped medical read | отсутствует | отсутствует |
| `visit.read_assigned/start/edit` | — | ✓ | отсутствует | отсутствует |
| `visit.sign/amend` | — | ✓ | отсутствует | отсутствует |
| `appointment.complete_with_summary` | — | только через visit sign | **admin + clinic vet; JWT location only** | schedule admin UI — **конфликт** |
| `telemed.dispatch` | ✓ | — | отсутствует | отсутствует |
| `telemed.case.claim` | — | assigned/available | `TELEMED_VETERINARIAN`, self-assign global queue | `/telemed/vet` |
| `telemed.clinical_update` | — | ✓ | assigned platform vet | `/telemed/vet` |
| `quality.read` | ✓ без clinical drafts | только отдельная capability | admin/reception + DB membership | admin/reception |
| `ops.security.read` | — | — | platform admin/security auditor | dedicated ops page |

Текущие authorization primitives:

- coarse role guard: `RolesGuard`;
- JWT claim scope: `clinicIds`/`locationIds`;
- transactional DB membership for queue/schedule/quality and booking mutations through `ClinicEmployeeAccessService`;
- assigned-employee check for telemed vet cases;
- owner derived from JWT for pets/booking/telemed/insurance.

Не хватает единого evaluator, session capabilities response, clinic/location/assignment/data-category resource descriptors, deny reasons и negative matrix tests для doctor/cross-clinic/revoked membership.

## 6. State-machine matrix

| Ось | Фактический источник истины | Состояния/переходы | Разрыв |
| --- | --- | --- | --- |
| Booking hold | `booking_schema.booking_holds.state`, `booking-state-machine.ts` | 16 states: manual/MIS/payment flows, cancellation/reschedule/completed | зрелая, но `COMPLETED` и clinical summary смешивают booking и visit |
| Appointment | `booking_schema.appointments.status` | default `CONFIRMED`; code пишет `COMPLETED`; analytics ожидает `NO_SHOW` | нет constraint и явной state machine/check-in/reschedule/arrival transitions |
| Slot | `appointment_slots.state`, counters/status | `OPEN/CLOSED/CANCELLED`; derived `AVAILABLE/LOCKED_BY_HOLD/BOOKED` | зрелая operational модель; нужно сохранить отдельно от appointment/visit |
| Alternative | `alternative_swap_groups.state` | `PENDING/ACCEPTED/DECLINED/EXPIRED/REPLACED` | реализовано |
| Visit | отсутствует | только `hold.clinical_summary` и `hold COMPLETED` | требуются `not_started/in_progress/ready_to_sign/signed/amended` и forbidden transitions |
| Payment | `payment_intents.status` | provider/authorization/capture/void/refund/reconcile states | реализовано отдельно; не объединять с booking/visit |
| Telemed case | `telemed_cases.state` | draft/payment/queued/assigned/joined/in-progress/completed/timeout/cancel variants | в сервисных типах отражено не полностью; admin dispatch отсутствует |
| Telemed session | `telemed_sessions.state` | waiting/connected/completed/timeout/cancelled | реализовано отдельно от case/payment |
| Insurance | `coverage_checks.state` | consent/request/process/covered/not covered/manual review/fail/expire | реализовано |
| Emergency | triage outcome + capability profile states | emergency/same-day/telemed/planned/insufficient + verified availability | реализовано отдельным bounded context |

## 7. Data ownership matrix

| Данные | Владелец/source of truth | Текущий read/write scope | Требуемое уточнение |
| --- | --- | --- | --- |
| Owner identity/session | `identity_schema` | owner JWT, platform auth service | secure mobile lifecycle и session capability response |
| Pet profile | `pet_schema.pets` | owner only | clinic admin vs clinical fields; treatment relationship |
| Pet documents | `pet_schema.pet_documents` | owner care endpoints | document categories, clinic read grants, signed download |
| Clinic/location/catalog | `clinic_schema`, `catalog_schema` | public reads; admin schedule writes | doctor roster/public doctor endpoints и capability scoped staff reads |
| Slot/availability | `clinic_schema.appointment_slots` | public read; admin/reception manage | сохранить server time and version |
| Booking/appointment | `booking_schema` | owner + scoped admin flows | clinic registry/detail/check-in and explicit appointment state machine |
| Clinical visit | отсутствует | summary stored on booking hold | отдельный clinical schema, assigned doctor, immutable signature/amendments |
| Insurance | `insurance_schema` | owner APIs/workers | clinic admin metadata view without overexposure |
| Payment | `payment_schema` | owner command + providers/workers | admin financial capability, never doctor by default |
| Telemed | `telemed_schema` | owner + platform telemed vet | clinic dispatcher/doctor scopes and clinical-record boundary |
| Emergency | `clinic_schema.emergency_*` | public/owner; clinic admin submit; platform approve | current separation is sound |
| Audit/outbox | `audit_schema`, `booking_schema.outbox_events` | services/workers; ops readers | clinical read/sign/amend events and retention policies |

## 8. API coverage summary

Полная route/action mapping находится в `00-route-api-role-matrix.md`.

| Product slice | Read API | Mutation API | Coverage |
| --- | --- | --- | --- |
| Owner auth/profile | auth/me есть | OTP/refresh/logout есть | profile settings/notifications нет |
| Owner pets/care | list/detail/care summary есть | create/update/document upload есть | полно для текущего MVP, не для clinic access |
| Catalog | clinics/locations/services/availability есть | нет | doctor list/detail отсутствуют |
| Booking/appointments | slots, hold, owner appointment list/detail/timeline, replay есть | hold/release/cancel request/alternative/payment есть | core реализован |
| Clinic queue | FIFO snapshot/audit есть | confirm/decline/notes/alternative есть | реализован |
| Clinic schedule | composite snapshot есть | services/staff/resources/periods/hours/import/manual/blackout/capacity есть | реализован |
| Admin dashboard/registry/patients | нет | нет | отсутствует |
| Clinical visits | нет | free-text complete only | конфликт/отсутствует |
| Telemed owner | list/detail есть | intake/payment/cancel/token есть | реализован частично |
| Telemed vet | queue/assigned/audit есть | self-assign/start/connect/workspace patch есть | platform doctor slice реализован частично |
| Telemed admin dispatcher | нет | нет | отсутствует |
| Insurance/emergency | есть | есть | реализовано для owner/current admin profile flow |

OpenAPI exporter строит полный runtime document, но `scripts/assert-openapi.cjs` проверяет только пять booking/queue/alternative/telemed операций. Сгенерированный `artifacts/openapi/swagger.json` не отслеживается; traceability по всем API отсутствует.

## 9. UX и responsive gap matrix

| Требование v50 | Prototype evidence | Production evidence | Gap |
| --- | --- | --- | --- |
| Admin/doctor independent nav | v50 smoke: 5 admin, 4 doctor tabs | portal shell: queue/schedule/quality; vet telemed separate | отсутствует единый role-aware shell |
| Mobile clinic workbench | 390×844, no overflow | shell tested 1280 and 768; schedule screenshot | 320/375/390/1024/1440/1920 и 200% zoom не покрыты |
| Queue long text/status hierarchy | prototype checked 390/1440 | queue table + conflict states tested | mobile card/reflow parity не доказана |
| Schedule resource/selected slot | prototype v50 selected-slot composition | production rich schedule/HIG retry | structural parity and mobile one-column not fully verified |
| Visit sticky/long form | prototype desktop/mobile | production route absent | отсутствует |
| Explicit loading/empty/error/conflict/stale | prototype mostly fixtures | queue/schedule/telemed cover several states | cross-route state vocabulary not centralized |
| Russian localization | prototype Russian | several production pages use English technical labels | l10n layer absent |
| Accessibility | prototype automated smoke; debt names VoiceOver/200% | axe in telemed, hit-target and text-scale widget tests | manual SR, keyboard long form, full zoom matrix absent |
| Owner adaptive UI | prototype 375 evidence | iOS/Android adaptive shell and selected tests | full route parity/goldens/deep links absent |

## 10. Automated evidence and blind spots

| Layer | Confirmed tests | Major blind spots |
| --- | --- | --- |
| Backend | booking races/FIFO/SLA/alternatives, payments, MIS, telemed, emergency, auth/catalog unit tests | capability matrix, clinic doctor ABAC, admin registry, clinical visit, cross-clinic patient isolation |
| Portal | queue happy/conflict/403, schedule retry/layout, vet telemed isolation/states/axe/screenshots | workspace/appointments/patients/visit/admin telemed; role-aware navigation; mandatory viewport matrix |
| Flutter | repositories, outbox policy, replay gate, catalog iOS, appointments, telemed, insurance, emergency layout | restart persistence, secure tokens, notifications/profile, doctor selection, full deep-link and golden matrix |
| End-to-end | local owner journey and stack scripts exist | no admin → doctor visit sign and no admin telemed dispatch → doctor consult traceability |

## 11. README drift

Не исправляется на Этапе 0, но должно войти в финальную документацию:

- `backend/README.md` называет систему «MVP-1 Booking Core», перечисляет малую часть маршрутов и всё ещё утверждает, что owner ID допустим в request для development, хотя production controller derives owner from JWT.
- `apps/clinic-portal/README.md` описывает только Level-C queue и называет Playwright следующим шагом, хотя queue/schedule/telemed tests уже существуют.
- `apps/owner_mobile/README.md` верно перечисляет persistence/realtime gaps, но не отражает новые owner appointment/care/telemed history slices полностью.
- `backend/docs/TDS-BC-001...` помечен как partially implemented и не перечисляет поздние `CANCELLATION_REQUESTED`, `RESCHEDULE_REQUESTED`, `COMPLETED` в основной таблице.
- Migration docs верно называют `node-pg` authoritative, но параллельный legacy SQL каталог остаётся заметным без явного marker в корне.

## 12. Migration и integration risks

| Риск | Приоритет | Доказательство | Митигация для следующих этапов |
| --- | --- | --- | --- |
| Applied migration identity lost by rename | P0 | local DB/checksum table contains `171938...`; checkout contains byte-identical `1719400000002...`; `make local-up` fails migration ordering | restore the applied filename/identity or introduce a reviewed adoption fix; never edit/rename the applied body; verify clean and existing DB paths |
| Clinical data attached to booking hold | P0 | `clinical_summary` + `COMPLETED` hold | additive clinical aggregate; migrate/read-through without rewriting old migrations |
| Admin clinical privilege | P0 | complete endpoint allows `CLINIC_ADMIN` | capability denial first; compatibility plan for existing callers |
| Vet membership/enforcement split | P0 | migration allows vet, service rejects vet | centralized evaluator and positive/negative tests |
| Appointment status unconstrained | P0 | table has text status, code/analytics use different values | explicit contract and additive constraint after data audit |
| Telemed global self-assign vs clinic dispatch | P0 | `TELEMED_VETERINARIAN` global queue | decide platform vs clinic case ownership; migrate assignments safely |
| Two migration trees | P1 | legacy SQL + node-pg | document authoritative runner; checksum verification; never edit applied files |
| OpenAPI weak assertion | P1 | only five operations checked | contract matrix and generated diff gate |
| Feature flags and integration tests disagree | P1 | `FEATURE_MIS_INTEGRATION` and `FEATURE_ONLINE_PAYMENTS` are frozen `false`; full tests expect Level-C manual/payment provider flows | make test configuration explicit and cover on/off modes without mutable global state |
| LiveKit audit contract drift | P1 | service writes `telemed.session.joined`; test expects `TELEMED_DOCTOR_JOINED_LIVEKIT` | choose a versioned audit vocabulary and update producer/consumer/test atomically |
| In-memory mobile state | P1 | session/outbox instantiated in memory | secure token store + encrypted durable DB migrations |
| External providers | P1 | MIS/acquiring/LiveKit/insurance workers | preserve outbox/reconciliation; no network in DB transaction |
| Large local catalog change | P1 | dirty file with substantial uncommitted diff | do not overwrite; isolate later stage branch/commit and rebase only by owner decision |
| Generated reports/artifacts in worktree | P2 | Allure/Playwright/dist directories present | explicit staging and artifact ignore/cleanup policy, without deleting user evidence |

## 13. Ordered backlog

### P0 — security and architecture blockers

1. Restore a valid immutable migration chain for both clean and already-migrated databases; dependency: none; before any new migration.
2. Define capability vocabulary, resource scope and session payload; dependency: none; target Stage 1/3.
3. Remove `CLINIC_ADMIN` clinical completion authority and require transactional active membership + assigned doctor; dependency: capability contract; Stage 3/5.
4. Define independent booking/appointment/visit/payment/telemed state contracts; dependency: architecture ADR; Stage 1.
5. Design additive clinical schema, visit state machine, signatures/amendments/consent evidence; dependency: item 4; Stage 5.
6. Define appointment states/check-in/reschedule/no-show and migrate unconstrained status safely; dependency: item 4; Stage 4/5.
7. Decide platform telemed vs clinic dispatcher ownership and assignment scopes; dependency: capabilities; Stage 1/8.
8. Add ABAC negative matrix: cross-clinic/location, revoked membership, unassigned visit/telemed and direct endpoint calls; dependency: items 2–7; Stage 3/5/8.

### P1 — product parity

1. Semantic tokens/primitives and role-aware portal shell; dependency: capability payload; Stage 2/3.
2. Admin operational dashboard, appointments and patients read models with pagination/filtering/allowed actions; dependency: capability contract; Stage 4.
3. Admin workspace screens and telemed dispatcher; dependency: P1.1–2 and telemed ownership decision; Stage 6/8.
4. Doctor shift/patient context/visit workbench/sign/amend; dependency: clinical API; Stage 7.
5. Owner comparison and doctor selection/detail API/UI; dependency: catalog doctor contract; Stage 9.
6. Owner notifications/profile/session management and durable secure persistence; dependency: auth/session contract; Stage 9.
7. Transport-backed realtime replay with durable cursor and polling fallback; dependency: event contract; Stage 10.
8. Expand OpenAPI contract tests and traceability matrix; dependency: each vertical contract; continuous, Stage 11.

### P2 — polish and release completeness

1. Central Russian localization/status vocabulary across Next/Flutter.
2. Full viewport 320/375/390/768/1024/1440/1920, 200% zoom, large text, reduced motion and screen-reader evidence.
3. Performance/index/query-plan review for new admin read models.
4. Artifact hygiene, current README, route maps, runbooks and release notes.
5. Production-like UAT for all ten master scenarios.

## 14. Решения, требующие подтверждения до stateful implementation

Этап 0 не блокируется этими вопросами, но Stage 1 должен зафиксировать ответы:

1. Является ли `CLINIC_VETERINARIAN` также допустимым исполнителем platform telemed, или `TELEMED_VETERINARIAN` остаётся отдельным credential/capability?
2. Может ли clinic admin назначать врача только внутри clinic/location roster или также передавать case в platform pool?
3. Должен ли legacy `clinical_summary` импортироваться как signed historical conclusion, unsigned legacy note или только read-only migration evidence?
4. Какой appointment lifecycle утверждается: достаточно `confirmed/checked_in/in_progress/completed/no_show/cancelled/reschedule_requested` или нужны отдельные arrival/ready states?
5. Какие document categories доступны reception/admin, а какие только assigned clinician?
6. Какой официальный production Flutter entry point закрепляется в build manifests: `owner_journey_main.dart` или он должен стать `main.dart` после удаления demo launcher?
7. Требуются ли clinic/location IDs в URL после появления server-issued workspace context, или текущая location-scoped convention сохраняется?

## 15. Неизвестное

- Shared/staging PostgreSQL не проверялись. Local PostgreSQL проверен: его migration/checksum tables подтверждают rename drift, но это не доказывает состояние других окружений.
- Provider contracts и secrets не открывались; интеграционный анализ ограничен adapters/workers/tests.
- Ручные VoiceOver/TalkBack, physical device и 200% browser zoom не выполнялись.
- Семантика реального appointment `NO_SHOW` не найдена в mutation code; наличие analytics reference не считается реализацией.
- Незакоммиченный catalog rewrite может содержать UI, отсутствующий в `HEAD`; до отдельного review он не считается опубликованным контрактом.

## 16. Выполненные проверки

| Проверка | Результат |
| --- | --- |
| `git diff --check -- docs/v50` | passed |
| Prototype `data-page` set против route matrix | passed: 30/30 unique routes |
| Backend TypeScript build | passed |
| OpenAPI generate + assertion | passed: 79 paths, 82 operations; current assertion covers only 5 key operations |
| Backend isolated `src` unit tests with explicit env | passed: 4 suites, 10 tests |
| Backend full tests in one-off Node 22 container against local DB | partial: 17/22 suites and 49/57 tests passed; feature-flag expectations and LiveKit audit action drift caused 5 suite failures |
| `migrate:verify` / normal Compose backend startup | blocked: applied migration filename was changed; backend stops before start |
| Clinic portal `typecheck` | passed |
| Clinic portal production build + Playwright | passed under Node 22: 22/22 tests |
| Flutter `pub get` + `analyze` | passed; no analyzer issues |
| Flutter tests | passed: 50/50 |
| Flutter web build, `lib/owner_journey_main.dart` | passed |
| `make local-seed`, `make local-smoke`, `make local-stack-e2e` | not run: normal backend startup is blocked by migration ordering |

The host default Node is 18.13.0, while Next 16 requires Node 20.9+. Portal build/e2e was therefore run with the configured Node 22 toolchain. The generated OpenAPI and Flutter/Next build outputs are verification artifacts, not deliverables.

## 17. Definition of Done Этапа 0

- Все 30 уникальных `data-page` routes прототипа сопоставлены в соседней матрице.
- Для всех обнаруженных prototype staff actions указаны production endpoint/capability/transition/audit либо явно `отсутствует`.
- Capability, state-machine, data ownership, API, UX/responsive и migration/integration matrices зафиксированы.
- Backlog P0/P1/P2 содержит зависимости и target stages.
- Неизвестное не заменено предположениями.
- Feature-код и пользовательский dirty worktree не изменены.
