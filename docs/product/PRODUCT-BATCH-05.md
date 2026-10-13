# PRODUCT BIG BATCH 05 — Clinic Operations → Owner Booking → Visit

Локальная ветка `agent/product-batch-01-eg0mppwf`, HEAD `b00b11764d7c49aa2cb37b068b206e0259b2635a`. Batch03/04 продолжены в том же worktree; изменения Batch05 не закоммичены. Никаких remote reconciliation, push, deployment или main merge.

`PRODUCT_BATCH_05_IMPLEMENTATION=COMPLETE` · `OCR_FROZEN=YES`

## Реализованный процесс

- Clinic: переходы к услугам/ценам, справочникам, часам, окнам и ограничениям; подписанные формы, адаптивные редактируемые строки. При неуспешном обновлении или смене периода настройки заблокированы до authoritative readback. Проверка будущего начала, конца и целочисленной вместимости 1–50 перед POST; серверная проверка сохраняется. При неизвестном исходе запроса UI предлагает сначала обновить данные, а не утверждает отсутствие записи.
- Owner: ручное обновление услуг/цен, сохранённые цены и currency из API; существующие шаги Batch04 сохранены. Исправлена гонка availability: старый scope/session ответ не продолжает booking; новый контекст очищает selection/busy и снова допускает выбор. Тест теперь действительно ожидает async RN14 events и проверяет восстановление после смены authority.
- Veterinarian: фильтр по дню устройства, «Сегодня», сброс к всем приёмам; подтверждённые и завершённые приёмы, patient context, существующее завершение и draft/publish. Персональные назначения не создавались.
- Backend: воспроизведён 500 при повторном сохранении рабочих часов. У metadata нет aggregate revision, поэтому постоянный outbox key `event:location:1` конфликтовал. Только для этой операции dedup теперь включает действующий employee-scoped idempotency namespace + key. Hours/outbox/audit/idempotency остаются в одной транзакции; другие события не менялись. Миграций и API expansion нет.

Переиспользованы каталог, weekly hours, inventory, manual windows, capacity/blackout/period APIs, Booking Core, FIFO queue, confirmed reschedule/cancellation, Patient Registry, veterinarian visit/result и Wave4A sharing. Новых clinical authority, doctor eligibility или OCR функций нет.

## Что сохраняется и что подготовлено для demo

| Ресурс | Проверенное поведение |
|---|---|
| Услуги и цена | Создание и редактирование цены через Clinic UI → настоящий API → reload/Owner catalog; 1450.00 и 2200.00 RUB |
| Специалист / ресурс | Создание и редактирование через настоящий UI/API, authoritative reload; без создания user accounts или личного назначения врача |
| Weekly hours | Сохранение через UI/API; два последовательных сохранения, replay без duplicate audit/event, независимые employee namespaces доказаны real PostgreSQL тестами |
| Будущие окна | Clinic UI создаёт окна с service/staff/resource; reload доказывает persistence. Окно capacity=1 исчезает из Owner availability после pending/confirmed booking |
| Профили клиник и confirmation policy | **DEMO_SEEDED**: две существующие synthetic клиники из `dev/product-batch01/seed.cjs`; не self-service feature |
| Patient projection | Существующая test fixture явно подготавливает projection для registry; переход проверяет detail URL + настоящий h1 |

`CLINIC_CONFIGURATION=PERSISTED_SERVICES_PRICES_INVENTORY_WEEKLY_HOURS_WINDOWS`
`SERVICE_AVAILABILITY=REAL_API_CAPACITY_AND_BLACKOUT_PASS`
`OWNER_BOOKING=REAL_API_MANUAL_AND_AUTOMATIC_PASS`
`VETERINARIAN_WORKFLOW=REAL_API_COMPLETE_PUBLISH_OWNER_DIARY_PASS`
`END_TO_END_DEMO=REAL_API_TWO_CLINICS_PASS`

Сквозной новый flow создаёт услуги, специалистов, ресурсы и будущие окна обеих клиник через Clinic UI. Owner выбирает новый service и реальное окно, MANUAL → PENDING_CONFIRMATION → Clinic confirm, AUTO → CONFIRMED/AUTOMATIC. Schedule отображает запись; ветеринар открывает её из списка, завершает, сохраняет draft и публикует синтетический результат. Owner открывает его в дневнике. Текст помечен DEMO ONLY, не является медицинским заключением настоящего пациента.

## Проверки

| Gate | Фактический результат |
|---|---|
| Patient-link, до изменений | PASS: detail URL + exact h1, existing visual harness |
| Owner focused Jest | **25 unique PASS**: Service8, Availability9, BookingReview8 |
| Clinic focused Playwright | **28 unique PASS**: schedule admin13, schedule8, veterinarian7; без SKIP |
| Backend real PostgreSQL | **4 PASS**: successive updates, replay, different actors/same key, scope denial |
| Новый real-API lifecycle / authority validation | **2 PASS** |
| Existing manual/auto, decline/cancel, alternatives/clinical/sharing/revoke | **3 PASS**, real API |
| Inventory edit/capacity/blackout; visual gates | **2 PASS**: реальное сохранение/availability и настройки 1440/768/390 + vet history390 |
| Owner / Clinic typecheck; Backend / Clinic build | PASS |
| Expo web bundle / real runtime | PASS в выполненных browser journeys |
| Independent bounded review | Owner stale-scope liveness и employee namespace findings исправлены; последняя проверка без material findings |
| git diff --check / index / original674 | PASS / пустой / byte-identical |

Итого Product harness: **7 unique PASS, 0 unresolved FAIL** (4 новых сценария + 3 существующих); initial patient precheck отдельно PASS. Counts — union идентичностей тестов, не сумма повторов. После CSS/labels повторены только затронутые admin checks; backend4 и основной новый business flow sticky. 23 старых flag/policy SKIP из Batch04 не выдаются за PASS и не пересчитываются: новые возможности проверены отдельными выполняемыми gates. Accepted OCR/миграции/W1–4A не запускались заново.

Ранние сбои: неоднозначный status locator, exact select label, истёкшие demo cookies, async RN14 harness, missing edit-field labels и отсутствующее тестовое окружение backend; исправлены. Visual test теперь создаёт fresh local JWT на каждый context; эти credentials не означают реальные внешние provider/OTP gates. В RN harness остаются act warnings, без unresolved FAIL. Также найдены и исправлены два production defects: late availability navigation и repeated working-hours outbox collision. Один зависший harness прогон прерван; не считается PASS. Финальные локальные журналы: `/tmp/product-batch05-owner-final.log` (17), `owner.log` (BookingReview8 из раннего run); `clinic-tests.log` (28), `admin-final.log` (13 входят в28), `inventory-ui-final.log` (2 входят в28); `backend-final.log` (4); `demo-final.log` (2), `product-final.log` (3 PASS + 2 superseded harness FAIL), `remaining-final.log` (2 финальных PASS); `clinic-build-final.log`, `backend-build-final.log`, `owner-typecheck-final.log`, `clinic-typecheck-final.log` с prefix `/tmp/product-batch05-`. Ранние FAIL не удалены и не считаются зелёными; superseding evidence указана. Без большой evidence directory.

## Снимки и запуск

[Галерея actual UI](../../dev/product-batch01/screenshots/batch05-gallery.html). До: [настройки](../../dev/product-batch01/screenshots/batch05-operations-before.png). Финальные формы и editable rows: 1440/768/390; новый real-API Owner flow: 390; реальные опубликованные результаты Owner/Vet. PNG/галерея — ignored local outputs, не добавлены в Git. Transport 503/403 simulation отдельно помечена в тесте; реальные role/location denials проверены без mocks.

Worktree: `/var/folders/ys/ypbk3mr54jqcwm2520hzs0ph0000gn/T/vethelp-product-batch01-eg0mppwf/worktree`.

```sh
# Node22; существующий test-owned PostgreSQL container/database сохраняются.
node dev/product-batch01/start.mjs
node dev/product-batch01/inspect.mjs
# Воспроизводимый synthetic walkthrough; не reset/seed retained базы:
(cd apps/clinic-portal && npx playwright test -c playwright.product.config.ts clinic-operations.spec.ts)
```

Owner http://localhost:8088, Clinic/Vet http://127.0.0.1:3318, backend3308. `inspect.mjs` открывает роли в отдельных browser contexts. OTP stub и synthetic fixtures не доказывают человеческий вход или доставку OTP. При истечении fixture sessions existing `owner-clinic.spec.ts` / `veterinary-journey.spec.ts` обновляют их через local demo auth. Использован только test-owned PG16 `vethelp-product01-eg0mppwf-postgres`, port55484, DB `product_batch01`; developer/production/retained acceptance DB не изменялись.

## Границы и реальные gaps

- Self-service изменения профиля клиники/филиала и booking policy отсутствуют в использованных accepted Portal contracts: demo configuration остаётся DEMO_SEEDED. Owner service DTO содержит INFORMATIONAL price, не FROM или confirmationMode. UI не обещает режим заранее; фактический MANUAL/AUTOMATIC подтверждён ответом booking API.
- Weekly hours — metadata, не персональные working shifts и не generator слотов. Нет принятой service↔specialist eligibility matrix и Owner specialist selection. Slot inventory не назначает пользователя-врача на клинический приём.
- Manual-slot endpoint проверяет scope/active inventory/time и отдельную slot capacity; не добавлена новая модель взаимного исключения пересекающихся интервалов специалиста/кабинета. UI явно предупреждает о пересечениях. Такие правила требуют отдельного принятого контракта.
- Native real-device/UAT/Pilot не выполнялись и не заявляются. Нет fake clinic comparison, medical facts, legal consent, external provider или production data.
- OCR заморожен. Production isolation, real adapter, retention и physical restore остаются незакрытыми.

## Изменённые файлы Batch05

Source/test scope относительно сохранённого input snapshot Batch04:

- `apps/clinic-portal/app/globals.css`
- `apps/clinic-portal/components/schedule/ClinicScheduleClient.tsx`
- `apps/clinic-portal/components/veterinarian/VeterinarianVisitWorkspace.tsx`
- `apps/clinic-portal/tests/e2e/clinic-schedule-admin.spec.ts`
- `apps/clinic-portal/tests/product/owner-clinic.spec.ts`
- `apps/clinic-portal/tests/product/clinic-operations.spec.ts`
- `apps/owner-app/src/clinics/AvailabilityScreen.tsx`
- `apps/owner-app/src/clinics/AvailabilityScreen.test.tsx`
- `apps/owner-app/src/clinics/ClinicServiceScreen.tsx`
- `apps/owner-app/src/clinics/ClinicServiceScreen.test.tsx`
- `backend/src/booking-core/clinic-schedule.service.ts`
- `backend/test/product-schedule-hours.integration-spec.ts`
- `docs/product/PRODUCT-BATCH-05.md`
- `docs/ai/current-state.md`

Root sole writer, один read-only reviewer. Efficiency: INEFFICIENT — несколько исправлений нового harness и повторные UI build после визуальных находок; production repair ограничен двумя найденными дефектами. Новые workstreams и широкие regression suites не добавлялись.

## Финальная сохранность

Original674 byte-identical: `f4fe840760b5c771ac774d252cea85b2303dc535872bf255450900dbbdb9fbb5`. HEAD/index сохранены; ранее существовавшие файлы Batch03/04 вне перечисленного UI refinement byte-identical. Source/test SHA256 aggregate (12 sorted `path\tSHA256\n` lines): `4c0094166654ebd51e3d46e301264a7be4fbcae13c500a63ad5f488cf223df32`. Локальная карта: `/tmp/product-batch05-source-hashes.txt`. Документы исключены из собственного source aggregate. Всего Batch05: 12 source/test + 2 документа; generated next-env восстановлен в исходные bytes. Owner8088 и Clinic3318 отвечают HTTP200, runtime оставлен работающим.

`PRODUCT_BATCH_05_IMPLEMENTATION=COMPLETE` означает завершение поддержанного scope и перечисленных gates с явно указанными unsupported gaps, не приёмку полного clinic self-service или человеческого UAT. Изменения локальные/uncommitted, OCR_FROZEN=YES. STOP после отчёта.
