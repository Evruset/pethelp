# PRODUCT BIG BATCH 02 — Complete Veterinary Journey

Дата: 2026-10-12. Продолжение тех же 42 незакоммиченных файлов Batch 01 в `agent/product-batch-01-eg0mppwf`, HEAD `a33226a5e7f3f5e9e14954a18e057adcf3fbcc78`. Коммитов/push нет. OCR заморожен.

## Результат и границы

`PRODUCT_BATCH_02_IMPLEMENTATION=PARTIAL`: все поддержанные сценарии A–H работают; персональное назначение приёма конкретному врачу не реализовано, поскольку существующий API предоставляет capability-scoped приёмы филиала, без контракта назначения. Интерфейс прямо сообщает об отсутствии этих сведений. Новые права или клинические факты не вводились.

- `OWNER_FLOW=VERIFIED`: серверные списки/детали, original/proposed slot, deadline по serverNow, явные accept/decline, exact proposal/version/idempotency, подтверждённая отмена клиникой с причиной; для недоступной прямой отмены — контакт клиники. Неподтверждённая заявка освобождается по существующей policy.
- `CLINIC_ADMIN_FLOW=VERIFIED`: очередь confirm/decline, расписание и реестр из Batch 01; карточка позволяет предложить совместимое свободное время и отменить подтверждённый приём, показывает ограниченную историю событий. Ошибки требуют authoritative readback. Неопределённая команда сохраняет body/key/version/correlation по subject/clinic/location/appointment, включая reload вкладки.
- `VETERINARIAN_FLOW=VERIFIED_BRANCH_SCOPE`: доступный по capability Pilot workspace, фильтр предстоящих/завершённых приёмов, пациент и время, завершение, draft/publish/amendment по существующим клиническим контрактам. Персональное назначение отсутствует. Admin не получает veterinarian authority.
- `MEDICAL_SHARING_FLOW=VERIFIED`: прямой переход из Owner appointment в существующий Wave4A context; явный выбор отдельных eligible ресурсов; grant, ветеринарное чтение и revoke/очистка отображения. Отдельное юридическое согласие не фабрикуется.
- `BOOKING_E2E=REAL_API_A_TO_H`: A/B/E переиспользуют успешный Batch 01 walkthrough; новый Batch 02 walkthrough дополнительно выполняет A/C/D/E/F/G/H на настоящих NestJS/PostgreSQL без route mocks.
- `DEMO_READY=YES`, `OCR_FROZEN=YES`.

Backend изменён только для bounded administrative detail projection: slot/service/lifecycle, advisory canCancel/canPropose, cancellation reason и последние 50 event type/time, без event payload. Существующие Booking mutations, capacity/lock/idempotency, clinical transitions и Wave4A grant authority переиспользованы. Миграции/зависимости не менялись. Удалён неработающий вызов legacy Owner cancellation-request из нового appointment клиента; confirmed manual cancellation остаётся операцией Clinic.

UX: прямые переходы appointment → patient/schedule/sharing; пояснения сохранения исходной записи при переносе; доступные mobile controls и серверные empty/error/revoked состояния. Ветеринарный раздел не выдаёт branch-scoped список за персональный график. Неизвестные ответы сохраняют точную команду; поздний ответ старой команды не стирает новую.

## Проверки

| Проверка | Фактический результат |
|---|---|
| Owner affected Jest | 50 unique PASS: appointments API 11, screens 5, alternative API 11, decision UX 7, existing sharing 16 |
| Clinic affected Playwright | 89 unique PASS, 2 expected flag-off SKIP: исходные 6 файлов 62 PASS + detail 27 PASS |
| Backend real Nest/PostgreSQL integration | 19 PASS в 2 файлах: detail authority/projection и appointment lifecycle |
| Новый cross-application REAL_API demo | 1 PASS, 12.8 s сценарий / 14.7 s запуск |
| Owner и Clinic typecheck | PASS |
| Backend и Clinic production build | PASS |
| Изолированная тестовая БД | 73 существующие миграции применены; новые миграции не создавались |
| Root + 2 read-only bounded reviews | Найденные replay/response/scope риски исправлены; финальный review без оставшихся material findings |
| git diff --check / index | PASS / пустой |
| Original dirty snapshot | 674 entries byte-identical, digest совпадает с Batch 01 |

Unique counts — объединение последних успешных результатов по test identity, без повторного прибавления repaired runs. Ранние FAIL: тестовые ожидания поля/кнопки/status, выключенный patient flag, фильтр completed; исправлены и проверены узко. Replay fixes покрыты отдельными regression tests. React harness выдаёт act warnings, успешность тестов от них не зависит. Ни real-device UAT, ни Pilot acceptance не заявляются.

Локальные результаты `/tmp/product-batch02-`: `owner-tests.log` (sharing), `owner-final.log`, `owner-race.log`, `owner-policy.log`; `clinic-tests.log`, `clinic-repair.log` (исправленный product-scope case), `clinic-parser-fixed.log`, `clinic-detail.log`, `clinic-command-final.log`; `backend-tests.log`, `testdb.log`, `backend-build.log`, `clinic-build-complete.log`, `owner-typecheck-complete.log`, `clinic-typecheck-final.log`, `demo-complete.log`. Sticky Batch 01/W1–4A/OCR проверки не повторялись без затронутого поведения. Исторический Batch 01 Pilot completion-hidden check теперь superseded явным подключением существующего veterinarian workspace; его нельзя считать текущей product visibility проверкой.

Original worktree `/Users/evrusetskiy/work/pethelp-v15-wave-01` не изменялся: `f4fe840760b5c771ac774d252cea85b2303dc535872bf255450900dbbdb9fbb5`, 674 entries. Все 42 исходных файла Batch 01 сохранены; текущие изменения в них ограничены продолжением этой задачи. `docs/ai/current-state.md` сохранён ровно в состоянии Batch 01.

## Demo

Worktree и подготовка инфраструктуры — [Batch 01](PRODUCT-BATCH-01.md). Node 22; test-owned container `vethelp-product01-eg0mppwf-postgres`, localhost:55484. Demo DB `product_batch01`; backend integration DB `product_batch02_tests` отдельно. Без truncate/reset/developer DB writes.

```sh
# Из корня worktree, после существующей подготовки Batch 01:
node dev/product-batch01/prepare.mjs
(cd apps/clinic-portal && npm run build)
node dev/product-batch01/start.mjs
# Во втором терминале:
(cd apps/clinic-portal && npx playwright test -c playwright.product.config.ts tests/product/veterinary-journey.spec.ts)
node dev/product-batch01/inspect.mjs
```

`seed` добавляет синтетического ветеринара с настоящими memberships без очистки БД. `inspect` открывает Owner, Clinic и Veterinarian после walkthrough. Локальные OTP и JWT fixtures остаются DEMO_ONLY; сами booking/clinical/sharing mutations — REAL_API с реальной backend authority. Синтетический опубликованный текст явно помечен DEMO ONLY; никаких реальных диагнозов/пациентов. Workers/OCR выключены. Credentials/state/screenshots — ignored local files.

Owner http://localhost:8088; Clinic http://127.0.0.1:3318; backend:3308. Скриншоты: `dev/product-batch01/screenshots/batch02-owner-alternative.png`, `batch02-owner-sharing.png`, `batch02-veterinarian-shared.png`, `batch02-clinic-cancelled.png`; исходные Batch 01 preview сохранены. Новые detail tests также проверяют keyboard/axe/200% text/mobile и denied/foreign/late-response состояния.

Для узкой проверки UI:

```sh
(cd apps/owner-app && npm test -- src/appointments/appointments-api.test.ts src/appointments/OwnerAppointmentsScreen.test.tsx src/appointments/alternative-api.test.ts src/appointments/AlternativeDecision.test.tsx)
(cd apps/owner-app && npm run typecheck)
(cd apps/clinic-portal && VETHELP_CLINIC_APPOINTMENTS_REGISTRY=true VETHELP_CLINIC_PATIENTS_REGISTRY=true npx playwright test tests/e2e/clinic-appointment-detail.spec.ts tests/e2e/veterinarian-visits.spec.ts)
```

Backend integration scripts намеренно разрешены только при NODE_ENV=test и DATABASE_URL, оканчивающемся `/product_batch02_tests`; fixtures additive. Не направлять их на retained/developer БД.

## Изменённые файлы Batch 02 относительно Batch 01

- `apps/clinic-portal/app/(clinic)/clinics/[clinicId]/locations/[locationId]/schedule/page.tsx`
- `apps/clinic-portal/app/api/clinic/[clinicId]/locations/[locationId]/appointments/[appointmentId]/[action]/route.ts`
- `apps/clinic-portal/components/appointments/AppointmentOperations.tsx`
- `apps/clinic-portal/components/appointments/ClinicAppointmentDetail.tsx`
- `apps/clinic-portal/components/layout/clinicPortalShellNavigation.ts`
- `apps/clinic-portal/components/veterinarian/VeterinarianVisitWorkspace.tsx`
- `apps/clinic-portal/lib/api/clinic-appointments.ts`
- `apps/clinic-portal/lib/config/mvp-product-scope.ts`
- `apps/clinic-portal/tests/e2e/clinic-appointment-detail.spec.ts`
- `apps/clinic-portal/tests/e2e/mvp-product-scope.spec.ts`
- `apps/clinic-portal/tests/e2e/veterinarian-visits.spec.ts`
- `apps/clinic-portal/tests/product/veterinary-journey.spec.ts`
- `apps/owner-app/src/appointments/AlternativeDecision.test.tsx`
- `apps/owner-app/src/appointments/AlternativeDecision.tsx`
- `apps/owner-app/src/appointments/OwnerAppointmentsScreen.test.tsx`
- `apps/owner-app/src/appointments/OwnerAppointmentsScreen.tsx`
- `apps/owner-app/src/appointments/alternative-api.test.ts`
- `apps/owner-app/src/appointments/alternative-api.ts`
- `apps/owner-app/src/appointments/appointment-date.ts`
- `apps/owner-app/src/appointments/appointments-api.test.ts`
- `apps/owner-app/src/appointments/appointments-api.ts`
- `apps/owner-app/src/medical-sharing/MedicalSharingScreen.tsx`
- `backend/src/booking-core/clinic-appointments-registry.service.ts`
- `backend/src/booking-core/dto/clinic-appointment-detail.dto.ts`
- `backend/test/clinic-appointment-detail.e2e-spec.ts`
- `backend/test/v15-appointment-lifecycle-http.e2e-spec.ts`
- `dev/product-batch01/inspect.mjs`
- `dev/product-batch01/seed.cjs`
- `docs/product/PRODUCT-BATCH-01.md`
- `docs/product/PRODUCT-BATCH-02.md`

## Остаточные решения

Персональное назначение врача требует отдельного продуктового/API контракта; текущий доступ остаётся по активной clinic/location membership и capability. Юридическая форма consent — отдельное решение, resource grant её не заменяет. Нужны real-device/native accessibility/UAT и Pilot проверки. OTP/login fixtures не доказывают доставку OTP или человеческий вход. Production OCR/storage/retention/restore остаются замороженными и не входят в этот batch.

Рекомендация следующего продуктового batch: определить назначение врача и согласовать персональный график, затем провести приоритетный Owner/native + Clinic UAT текущих A–H. Новые инженерные Waves не начаты.
