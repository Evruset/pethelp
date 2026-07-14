# ADR-0003: route map и ownership экранов

- Статус: принято для v50
- Дата: 2026-07-12
- Зависимости: ADR-0001, ADR-0002

## Контекст

Production portal уже использует location-scoped URLs для queue/schedule/quality, но общего workspace, appointment/patient registry и clinical workbench нет. Прототипные hash routes не являются production contract. Один экран telemed смешивал бы admin dispatch и клиническую работу врача.

## Альтернативы

1. Скопировать hash routes прототипа. Быстро визуально, но теряются deep links, scope и server ownership.
2. Один dashboard с условными блоками по роли. Увеличивает риск утечки и связывает независимые API.
3. Стабильные scoped routes, route-level capability guards и отдельные admin/doctor compositions.

## Решение

Выбран вариант 3. Канонический portal prefix: `/clinics/:clinicId/locations/:locationId`.

| Route | Owner | Required capability | Backend read model |
| --- | --- | --- | --- |
| `/workspace` | admin: operations; doctor: personal shift redirect | `clinic.dashboard.read` или `doctor.shift.read` | отдельные admin/doctor projections |
| `/queue` | admin/reception | `booking.queue.read` | существующий queue API |
| `/schedule` | admin/reception | `schedule.read` | существующий schedule API |
| `/appointments` | admin registry | `appointment.registry.read` | новый cursor list/detail |
| `/visits/:visitId` | assigned doctor | `clinical.visit.read_assigned` | clinical visit API |
| `/patients` | admin registry / doctor scoped list | соответствующий `patient.*.read` | category-filtered patient API |
| `/patients/:patientId` | role-specific composition | data-category capability + relationship | filtered patient detail |
| `/telemed` | admin dispatcher | `telemed.dispatch.read` | location dispatcher projection |
| `/telemed/cases/:caseId` | assigned clinic doctor | `telemed.case.read_assigned` | doctor case/workspace API |
| `/quality` | admin/reception | `quality.read` | существующий quality API |

`/telemed/vet` остаётся legacy platform-vet route до миграции identity/assignment. Clinic routes не переиспользуют его global queue как admin dispatcher.

Server guard проверяет capability и URL scope; client guard нужен только для navigation UX. Query/filter/page cursor хранится в URL. Forbidden и not-found не раскрывают cross-clinic resource. Owner Flutter получает именованные declarative routes для catalog, booking, appointments, pets, telemed, insurance, notifications, profile и emergency; anonymous Navigator routes постепенно выводятся.

Экран принадлежит одному composition layer, а данные — своим доменам. Composition может читать несколько projections, но mutation отправляется только в owning domain API.

## Последствия

- Положительные: устойчивые deep links, независимые вертикальные срезы и ясный API owner.
- Отрицательные: admin/doctor используют отдельные read models даже при похожем UI; требуется route migration/redirect coverage.

## Обратная совместимость

Текущие `/queue`, `/schedule`, `/quality` сохраняются. Portal root и старые telemed links получают capability-aware redirects. Существующие owner links поддерживаются redirect table минимум один релиз.

## Миграция

1. Добавить route manifest и central server guard без замены существующих страниц.
2. Реализовать отсутствующий backend read model до соответствующего UI.
3. Добавлять routes вертикальными срезами: API/OpenAPI/client → page → navigation.
4. Ввести redirects и telemetry старых ссылок; удалить их после нулевого использования.

## Rollback

Navigation flags скрывают новый route, redirect возвращает на прежнюю страницу. Backend read model может остаться неэкспонированным. Rollback страницы не откатывает additive schema или уже записанные clinical данные.
