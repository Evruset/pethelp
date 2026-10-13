# PRODUCT BIG BATCH 04 — Visual QA, UX Polish & Demo

2026-10-12 · `agent/product-batch-01-eg0mppwf` · checkpoint `b00b11764d7c49aa2cb37b068b206e0259b2635a` сохранён. Batch03 продолжен и сохранён; Batch04 не закоммичен.

`PRODUCT_BATCH_04_IMPLEMENTATION=COMPLETE` · `DEMO_READY=YES` · `OCR_FROZEN=YES`.

## 1. Исправленные UX-дефекты

| Наблюдение в реальном UI | Исправление |
|---|---|
| Длинные списки скрывали возврат и следующую операцию Owner | Постоянный верхний возврат; footer для выбора питомца, услуги и времени; Home footer с записями и питомцами |
| Каждое время занимало целую строку, CTA уходила за экран | Выбор даты + сетка времени; постоянная сводка выбора/Continue; смена даты сбрасывает выбор, серверная повторная проверка сохранена |
| Неясно, на каком шаге записи пользователь | Контекст «шаг 2–5 из 5» в каталоге, услугах, времени и review |
| Review показывал ISO-дату | Человеческая локальная дата выбранного окна |
| Focus менял толщину рамок и сдвигал controls | Постоянная толщина, отдельный focus цвет; единые 48px Owner fields, 44px Clinic controls |
| На мобильном часть Clinic bottom navigation была за границей | Все разрешённые разделы помещаются в ширину, роли и capability gates сохранены |
| Таблицы очереди/расписания требовали горизонтального чтения | Один DOM: desktop table и подписанные двухколоночные mobile rows, без дублирования команд |
| Поиск/статус врача и навигация периода были выровнены по-разному | Общая filter panel; arrows/Today сгруппированы; короткие даты без секунд |
| Имя пациента выглядело как точка входа, но не открывало карточку | Имя стало реальной ссылкой; demo проверяет URL и patient h1 вместо похожего заголовка списка |

Ранняя visual-проверка ошибочно принимала реестр за detail после клика по некликабельному имени. Устранены UX-дефект и ложноположительное ожидание. Три ранних before-файла `clinic-patient-detail-*` исключены из сравнения; after detail получены с доказанным переходом.

## 2. Основные визуальные улучшения

`OWNER_UX=VERIFIED`: Home и pet/profile, каталог/поиск, услуги/цены, доступное время, review, список/детали/история записей, alternative decision и sharing. Верхний возврат остаётся доступен при длинном контенте; uncertain/sending запреты сохранены. Sharing больше не превращает каждую строку выбора в конкурирующую primary CTA.

`CLINIC_UX=VERIFIED`: workspace, очередь, период/фильтры/строки расписания, пациенты/detail, записи. Более плотные строки и разделители, единая mobile navigation; stale/draft/no-show состояния используют restrained violet вместо ochre, ошибки остаются красными.

`VETERINARIAN_UX=VERIFIED`: branch visit list, aligned patient/status filters, читаемые даты, result/shared-data section navigation и существующие клинические формы. Персональные назначения не выдумывались.

`VISUAL_QA=OWNER_375_430_CLINIC_VET_1440_768_390`. Автоматически пройдены и сняты основные маршруты на всех этих размерах; representative кадры каждой основной поверхности просмотрены визуально. Проверено отсутствие horizontal overflow. Normal/empty/error/loading/forbidden и confirmed/cancelled состояния просмотрены; pending/alternative/результат/sharing покрыты реальными journey и их снимками. Loading/error/forbidden transport simulations явно помечены и не считаются фактическими отказами backend.

## 3. Функциональные регрессии

| Проверка | Фактический результат |
|---|---|
| Owner affected Jest, 10 suites + новый date-selection case | **75 unique PASS**, unresolved FAIL: 0 |
| Clinic affected Playwright, 9 suites | **102 unique PASS, 23 expected flag/policy SKIP** |
| Финальные затронутые проверки расписания/пациентов | 8 PASS / 10 PASS + 9 SKIP; входят в unique counts выше |
| Real-API journeys | **3 PASS**: manual/auto booking и queue/patient/schedule; Pilot action boundary; alternatives/cancellation/clinical result/sharing/revoke |
| Visual/state scenarios | **3 PASS**: Owner 375/430; Clinic/Vet 1440/768/390; явно simulated loading/error |
| Owner / Clinic typecheck | PASS / PASS |
| Clinic production build / Expo web runtime bundle | PASS / PASS |
| Backend | Batch03 production diff не изменён; существующие workspace gates/build REUSED_STICKY_PASS, повторов нет |
| `git diff --check`, index | PASS / пустой |
| Original 674 dirty entries | Byte-identical; digest совпал |

После последнего изменения patient-name link повторены только соответствующие registry и real-API/visual journeys. Counts — union test identities, не сумма повторов. Новая Jest-проверка сначала требовала ожидания React state update; исправлен test harness. Один before locator использовал неверный forbidden copy; исправлено ожидание. React act warnings сохраняются, unresolved failures нет.

Реальные API-проверки используют test-owned PostgreSQL и synthetic data, включая явные Owner accept/decline, Clinic cancellation, veterinarian draft/publish и очистку отозванного ресурса. Новых backend изменений, миграций, зависимостей или authority semantics нет. Нет real-device/UAT/Pilot acceptance.

Локальные logs: `/tmp/product-batch04-owner-tests.log`, `...date-final.log`, `...owner-final.log`, `...home-final.log`, `...clinic-tests.log`, `...schedule-final.log`, `...patients-final.log`, `...product-final.log`, `...patient-demo-final.log`, `...clinic-build-complete.log`, `...owner-typecheck-final.log`, `...clinic-typecheck-final.log`. Они не добавлены в Git.

## 4. Скриншоты и локальная демонстрация

[Галерея реальных before/after](../../dev/product-batch01/screenshots/batch04-gallery.html): 50 корректных before кадров, 58 after, включая отдельно снятые состояния. Synthetic fixtures пополняются при выполнении journey; сравнение визуальное, не pixel-golden с фиксированными данными. Галерея/PNG находятся в ignored local screenshots, не в machine evidence directory.

Примеры:

- Owner время [до](../../dev/product-batch01/screenshots/batch04-before/owner-availability-375.png) / [после](../../dev/product-batch01/screenshots/batch04-after/owner-availability-375.png).
- Owner review [до](../../dev/product-batch01/screenshots/batch04-before/owner-booking-review-430.png) / [после](../../dev/product-batch01/screenshots/batch04-after/owner-booking-review-430.png).
- Врач [до](../../dev/product-batch01/screenshots/batch04-before/vet-list-1440.png) / [после](../../dev/product-batch01/screenshots/batch04-after/vet-list-1440.png).
- Clinic mobile [до](../../dev/product-batch01/screenshots/batch04-before/clinic-schedule-390.png) / [после](../../dev/product-batch01/screenshots/batch04-after/clinic-schedule-390.png); [строки расписания](../../dev/product-batch01/screenshots/batch04-after/clinic-schedule-rows-390.png); [реальный patient detail](../../dev/product-batch01/screenshots/batch04-after/clinic-patient-detail-768.png).

Worktree: `/var/folders/ys/ypbk3mr54jqcwm2520hzs0ph0000gn/T/vethelp-product-batch01-eg0mppwf/worktree`. Node 22; существующие dependencies и Docker container `vethelp-product01-eg0mppwf-postgres` на 55484, DB `product_batch01`. Не сбрасывать retained DB.

```sh
# Из корня указанного worktree; runtime оставлен работающим после проверки.
node dev/product-batch01/start.mjs
# В отдельном терминале: три авторизованные роли в отдельных browser contexts.
node dev/product-batch01/inspect.mjs
# Если локальные demo sessions истекли, исполнить real API walkthrough:
(cd apps/clinic-portal && npx playwright test --config playwright.product.config.ts owner-clinic.spec.ts veterinary-journey.spec.ts)
# Read-only navigation / явно simulated states:
(cd apps/clinic-portal && npx playwright test --config playwright.product.config.ts visual-polish.spec.ts)
```

Owner: [localhost:8088](http://localhost:8088). Clinic/Vet: [localhost:3318](http://127.0.0.1:3318), `inspect.mjs` открывает точные scope URLs с локальными тестовыми cookies. Backend: 3308. Непосредственный неавторизованный вход в Clinic не обходит guards. OTP — локальный stub; никаких внешних отправок. Ctrl+C у launcher останавливает дочерние процессы и сохраняет DB.

## 5. Оставшиеся реальные ограничения

Блокеров локальной демонстрации нет. Native-device/keyboard/safe-area и human UAT требуют отдельной проверки на настоящих устройствах. В текущем Pet API нет фотографий/породы/возраста; значения не выдумывались. Нет accepted персонального назначения врача. Некоторые dashboard summaries остаются NOT_CONFIGURED, legacy Pilot pending-alternative route остаётся закрытым; supported confirmed reschedule работает.

OCR остаётся замороженным. Production isolation, real adapter, retention и physical restore не закрывались. Никаких commit/push/deployment/main/Jira/Confluence действий.

Checkpoint и весь Batch03 сохранены; refinement затронул только UI и тесты. Original674 SHA256 aggregate: `f4fe840760b5c771ac774d252cea85b2303dc535872bf255450900dbbdb9fbb5`.

Изменённые в Batch04 файлы (отдельно от уже существующего Batch03):

- `apps/clinic-portal/app/globals.css`
- `apps/clinic-portal/components/appointments/ClinicAppointmentsRegistry.tsx`
- `apps/clinic-portal/components/patients/ClinicPatientDetail.tsx`
- `apps/clinic-portal/components/patients/ClinicPatientsRegistry.tsx`
- `apps/clinic-portal/components/queue/ClinicQueueClientV2.tsx`
- `apps/clinic-portal/components/schedule/ClinicScheduleClient.tsx`
- `apps/clinic-portal/components/veterinarian/VeterinarianVisitWorkspace.tsx`
- `apps/clinic-portal/tests/product/owner-clinic.spec.ts`
- `apps/clinic-portal/tests/product/visual-polish.spec.ts`
- `apps/owner-app/src/app/(app)/index.tsx`
- `apps/owner-app/src/appointments/OwnerAppointmentsScreen.tsx`
- `apps/owner-app/src/booking/BookingReviewScreen.tsx`
- `apps/owner-app/src/clinics/AvailabilityScreen.test.tsx`
- `apps/owner-app/src/clinics/AvailabilityScreen.tsx`
- `apps/owner-app/src/clinics/ClinicCatalogScreen.tsx`
- `apps/owner-app/src/clinics/ClinicServiceScreen.tsx`
- `apps/owner-app/src/medical-sharing/MedicalSharingScreen.tsx`
- `apps/owner-app/src/pets/PetDiaryScreen.tsx`
- `apps/owner-app/src/pets/PetJourneyScreen.tsx`
- `apps/owner-app/src/ui/primitives.tsx`
- `docs/ai/current-state.md`
- `docs/product/PRODUCT-BATCH-04.md`
