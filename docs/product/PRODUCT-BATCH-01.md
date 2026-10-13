# PRODUCT EXPERIENCE BIG BATCH 01

Дата: 2026-10-12. Изолированная ветка `agent/product-batch-01-eg0mppwf`; база `a33226a5e7f3f5e9e14954a18e057adcf3fbcc78` (проверена через fresh fetch). Изменения не закоммичены и не опубликованы.

## Фактический результат

- Owner: главная с питомцами и ближайшей серверной записью; каталог клиник/филиалов; услуги и рублёвые цены; выбор времени; ручная и автоматическая запись; переход в детали; серверные статусы и история; освобождение неподтверждённой заявки; карточка/дневник питомца; навигация в его записи. Добавление второго питомца и запись для него выполнены через настоящий API.
- Clinic: существующие workspace, FIFO-очередь, confirm/decline и реестр пациентов сохранены и соединены с Owner demo. Добавлена доступная по capability навигация «Записи». Расписание показывает приёмы перед настройками, день/неделю/14 дней, врача/ресурс и отдельные статусы доступности и записи. При смене диапазона или потере authority старые строки не остаются доступными для действий. Кнопка закрытия приёма скрыта в PILOT_V1, где её BFF запрещён.
- Реальный изолированный cross-app demo: MANUAL/PENDING_CONFIRMATION → подтверждение Clinic → CONFIRMED у Owner; отмена другой заявки → RELEASED; отклонение Clinic → серверное «Отменена» у Owner; V15_AUTO_CONFIRM → CONFIRMED/AUTOMATIC и соответствующая запись в расписании.
- Повторная запись получает новую cache-generation. Сервис нельзя сменить во время проверки authority. Неопределённая отправка сохраняет idempotency key; неизвестная отмена сохраняется при переходе список/детали до завершения Owner session. Никакого оптимистического утверждения успеха отмены.
- Backend: единственная правка — разрешён существующий заголовок `If-Match` в CORS для browser Owner. API, миграции, роли, booking state machine, Wave4A sharing и OCR не изменены.

Уже существовали OTP/session, pet CRUD, каталог/availability, Booking Core, очередь и её операции, workspace, patient registry/detail, клинические результаты и sharing. Они переиспользованы; новая клиническая authority не создавалась. Цены сохраняют серверную INFORMATIONAL семантику («Ориентировочная стоимость»); FROM не придумывается. Расписание явно указывает timezone устройства: API расписания не передаёт timezone филиала.

## Проверки

| Проверка | Фактический итог |
|---|---|
| Owner: 9 затронутых Jest файлов | 66 unique PASS по объединению последних результатов; ранние ошибки исправлены |
| Clinic: queue/workspace/schedule/admin/HIG Playwright | 57 unique PASS по объединению прогонов, 1 ожидаемый flag-off SKIP |
| Сквозной Playwright, настоящий API/PostgreSQL | 1 PASS, без route mocks |
| PILOT completion visibility | 1 PASS на настоящем Pilot runtime; закрытый action отсутствует |
| Owner/Clinic typecheck | PASS |
| Backend build / Clinic production build | PASS |
| Изолированная БД | 73 существующие миграции применены для запуска demo; миграции не менялись |
| git diff --check / index | PASS / пустой |
| Исходные 674 dirty entries | Byte-for-byte сохранены |

Owner покрытие: booking API 10, review 8, appointments API 9, appointments screens 7, service 7, catalog 7, availability 8, pet journey 6, diary 4. Проверены malformed/foreign response, session/scope isolation, stale selections, timeout/idempotency, ручная неопределённая отмена без replay, конфликты, empty/error состояния. Clinic включает keyboard/axe/responsive и late-response/scope-loss тесты. После привязки completion к profile повторно выполнены только 2 непосредственно затронутых legacy completion теста: 2 PASS; они входят в 57 unique, не добавляются к счётчику. Mocked Clinic completion/alternative проверки относятся к LEGACY_COMPAT, не доказывают доступность в PILOT_V1. React test harness выдаёт act warnings; тесты проходят. Sticky W1–W4A/OCR suites не запускались.

Локальные журналы: `/tmp/product-batch01-owner-final.log` + узкие исправленные результаты `owner-pet-final`, `owner-readback-final`, `owner-decision-final`, `owner-cancel-api`, `owner-auto-final` с тем же prefix; Clinic `clinic-tests`, `clinic-repair-tests`, `clinic-final`; `demo`, `clinic-build`, `owner-typecheck-final`, `clinic-typecheck-final`. Это локальные машинные результаты, не UAT или signed mobile build.

Исходный dirty snapshot digest: `f4fe840760b5c771ac774d252cea85b2303dc535872bf255450900dbbdb9fbb5` (674 entries, содержимое/статусы/режимы/index/diff). Проверен до и после работ. Исходный worktree не изменялся.

## Запуск и просмотр

Рабочая копия: `/var/folders/ys/ypbk3mr54jqcwm2520hzs0ph0000gn/T/vethelp-product-batch01-eg0mppwf/worktree`.
Node 22, Docker, установленные зависимости из существующих lockfiles; новых зависимостей нет. Текущая test-owned БД: контейнер `vethelp-product01-eg0mppwf-postgres`, PostgreSQL 16, localhost:55484, database `product_batch01`. Retained/developer databases не затрагивались.

Для нового изолированного окружения при свободном порте:

```sh
docker run -d --name vethelp-product-batch01-demo -p 127.0.0.1:55484:5432 \
  -e POSTGRES_USER=product_demo -e POSTGRES_PASSWORD=isolated-demo-only \
  -e POSTGRES_DB=product_batch01 postgres:16-alpine
# Дождаться pg_isready. Затем из корня worktree:
(cd backend && npm ci)
(cd apps/owner-app && npm ci)
(cd apps/clinic-portal && npm ci && npm run build)
node dev/product-batch01/prepare.mjs
node dev/product-batch01/start.mjs
# Во втором терминале:
(cd apps/clinic-portal && npx playwright test --config playwright.product.config.ts)
node dev/product-batch01/inspect.mjs
```

`prepare` применяет миграции и добавляет синтетические fixtures без очистки. `start` запускает backend:3308, Clinic http://127.0.0.1:3318, Owner http://localhost:8088. Ctrl+C останавливает дочерние процессы, сохраняя БД. `inspect` открывает обе авторизованные стороны после Playwright demo; session cookies/tokens хранятся только в ignored `*.local.json`. При истёкшей сессии повторить demo в пределах OTP rate limit. Это локальные публичные demo secrets, не production credentials. Используется PILOT_V1; workers и verified OCR выключены.

Walkthrough:

1. Owner: «Записать питомца» → Барсик → «ДЕМО · Забота» → терапевт → окно → отправка → «Открыть запись».
2. Clinic administrator: очередь того же филиала → обработать первый элемент FIFO → подтвердить/отклонить; Owner обновляет статус. Нельзя обойти FIFO ради новой заявки.
3. Отмена: у неподтверждённой заявки «Отменить запись» → подтверждение → authoritative readback. Подтверждённая ручная запись имеет отдельную policy, см. ограничение ниже.
4. Несколько питомцев: «Управлять питомцами» → «Добавить ещё» → сохранить → выбрать нового питомца для «ДЕМО · ВетЛиния»; ответ AUTOMATIC/CONFIRMED, запись видна в её расписании.
5. Пациент: открыть реестр/Барсика после явной DEMO consent fixture. Медицинские факты не генерируются.
6. Conflict/empty: детерминированные `AvailabilityScreen.test.tsx` и `BookingReviewScreen.test.tsx` моделируют исчезнувшее окно, пустой список, stale version и uncertain retry; queue/admin Playwright проверяет конфликты. Эти сценарии используют явно тестовые ответы. Отдельный real-API conflict drill не заявляется.
7. Ветеринар/назначенный визит: блокирован в PILOT_V1; не демонстрировать через LEGACY_COMPAT как принятый Pilot flow.

Скриншоты настоящего demo (ignored): `dev/product-batch01/screenshots/owner-home.png`, `owner-manual.png`, `owner-automatic.png`, `clinic-incoming.png`, `clinic-patient.png`, `clinic-schedule.png`. Fixtures синтетические. OTP delivery simulated (123456); Clinic login заменён локальной подписью JWT тестового пользователя с реальной membership/permission проверкой backend. `patient-fixture.cjs` явно создаёт синтетическую consent/association для demo, не подтверждает человеческое согласие. Запись сама по себе не предоставляет patient/medical access.

## Точные ограничения и следующий продуктовый пакет

- PILOT_V1 закрывает `/vet/visits` и BFF completion; существующее backend v1.5 поведение не открыто самовольно. Нет подтверждённого сценария «ветеринар видит именно назначенные ему визиты». Нужен продуктовый контракт Pilot clinical workspace и assignment filtering.
- Альтернативное время: Clinic legacy implementation существует; Pilot BFF его закрывает. Owner при action-required показывает связь с клиникой; онлайн accept/decline в данном пакете не реализован.
- Подтверждённая ручная запись возвращает CLINIC_CONFIRMATION_REQUIRED_V1, но её legacy cancellation-requests URL закрыт PILOT_V1. Этот flow не принят как рабочий; серверный отказ не отображается как отмена. Нужна согласованная Pilot policy и contracted endpoint; новая отмена для неподтверждённых заявок работает.
- Patient registry требует согласованную consent/visibility policy; synthetic demo fixture не разрешает production rollout. Документы/результаты доступны только в уже разрешённых границах; новые загрузки/OCR не добавлены.
- Нет real-device, подписанного mobile build, UAT, real booking или production acceptance. Availability часовой пояс серверный, schedule — явно device timezone до расширения существующего read contract.

Рекомендация PRODUCT BATCH 02: согласовать и реализовать Pilot veterinarian assignment/workspace, альтернативное время и ручную отмену после подтверждения; затем human patient-consent journey и реальное mobile/UAT. OCR остаётся замороженным до отдельного продуктового решения; никакой инфраструктурной Wave не начинается.

PRODUCT_BATCH_01_IMPLEMENTATION=PARTIAL
OWNER_EXPERIENCE=HOME_PETS_BOOKING_STATUS_PENDING_CANCEL_DIARY_VERIFIED
CLINIC_EXPERIENCE=QUEUE_CONFIRM_DECLINE_SCHEDULE_PATIENT_DEMO_VERIFIED
BOOKING_INTEGRATION=MANUAL_AUTOMATIC_CONFIRM_DECLINE_PENDING_CANCEL_REAL_API_PASS
DEMO_READY=YES
OCR_FROZEN=YES

## Изменённые файлы

- `apps/clinic-portal/app/(clinic)/clinics/[clinicId]/locations/[locationId]/schedule/page.tsx`
- `apps/clinic-portal/components/layout/ClinicPortalShellV50.tsx`
- `apps/clinic-portal/components/layout/ClinicPortalShellV50Client.tsx`
- `apps/clinic-portal/components/layout/clinicPortalShellNavigation.ts`
- `apps/clinic-portal/components/schedule/ClinicScheduleClient.tsx`
- `apps/clinic-portal/playwright.config.mjs`
- `apps/clinic-portal/playwright.product.config.ts`
- `apps/clinic-portal/tests/e2e/clinic-layout-hig.spec.ts`
- `apps/clinic-portal/tests/e2e/clinic-layout-hig.spec.ts-snapshots/schedule-occupied-blackout-chromium-darwin.png`
- `apps/clinic-portal/tests/e2e/clinic-schedule-admin.spec.ts`
- `apps/clinic-portal/tests/e2e/clinic-schedule.spec.ts`
- `apps/clinic-portal/tests/e2e/shared-medical.spec.ts`
- `apps/clinic-portal/tests/product/owner-clinic.spec.ts`
- `apps/owner-app/src/app/(app)/index.tsx`
- `apps/owner-app/src/appointments/OwnerAppointmentsScreen.test.tsx`
- `apps/owner-app/src/appointments/OwnerAppointmentsScreen.tsx`
- `apps/owner-app/src/appointments/appointments-api.test.ts`
- `apps/owner-app/src/appointments/appointments-api.ts`
- `apps/owner-app/src/booking/BookingReviewScreen.test.tsx`
- `apps/owner-app/src/booking/BookingReviewScreen.tsx`
- `apps/owner-app/src/booking/booking-api.test.ts`
- `apps/owner-app/src/booking/booking-api.ts`
- `apps/owner-app/src/clinics/AvailabilityScreen.test.tsx`
- `apps/owner-app/src/clinics/AvailabilityScreen.tsx`
- `apps/owner-app/src/clinics/ClinicCatalogScreen.tsx`
- `apps/owner-app/src/clinics/ClinicServiceScreen.test.tsx`
- `apps/owner-app/src/clinics/ClinicServiceScreen.tsx`
- `apps/owner-app/src/pets/PetDiaryScreen.tsx`
- `apps/owner-app/src/pets/PetJourneyScreen.test.tsx`
- `apps/owner-app/src/pets/PetJourneyScreen.tsx`
- `apps/owner-app/src/ui/format-price.ts`
- `apps/owner-app/src/ui/primitives.tsx`
- `backend/src/main.ts`
- `dev/product-batch01/.gitignore`
- `dev/product-batch01/demo-env.mjs`
- `dev/product-batch01/inspect.mjs`
- `dev/product-batch01/patient-fixture.cjs`
- `dev/product-batch01/prepare.mjs`
- `dev/product-batch01/seed.cjs`
- `dev/product-batch01/start.mjs`
- `docs/ai/current-state.md`
- `docs/product/PRODUCT-BATCH-01.md`

## Продолжение Batch 02 — 2026-10-12

Исторические результаты выше сохранены. В этой же незакоммиченной рабочей копии выполнен [PRODUCT-BATCH-02](PRODUCT-BATCH-02.md): Owner alternative decisions, Clinic cancellation/proposals, существующий Pilot veterinarian workspace и выбранный sharing/revoke. Ограничения Batch 01 про закрытый veterinarian UI и отсутствие альтернатив описывают прежнюю точку; текущая доступность и проверки перечислены в Batch 02. Персональное назначение врача по-прежнему отсутствует. Legacy manual cancellation-request не используется: Owner показывает контакт, Clinic выполняет существующую авторизованную отмену. Original 674 dirty entries сохранены; OCR frozen; commit/push отсутствуют.
