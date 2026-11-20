# 04 — Ролевая модель и публичные статусы

**Contract:** `VETORA-AUTH-001` · `v0.1.0` · `PROPOSED_FOR_PO_APPROVAL`. См. [enum ролей](../../backend/src/auth/auth.types.ts), [статические capabilities](../../backend/src/auth/capability.ts) и [аналитическую таблицу](contracts/role-matrix.yaml).

## Identity и authority

- JWT `roles` — атрибут; он **не** даёт доступ сам по себе.
- Backend policy проверяет `capability`, фактическое активное membership, `clinicId`, `locationId`, owner relationship и resource/assignment. Frontend-навигация — только presentation.
- Нет доверия к `role`, `clinicId`, `doctorId`, `ownerId`, `price`, `confirmationMode` из клиентского переключателя или формы. Сервер резолвит authority из аутентифицированной сессии и БД.
- Cross-scope deny не должен выдавать данные другой клиники/владельца через код ошибки, тело, кэш или timing leak, где применимо.

## Роли для первого пилота

| Роль из backend | Разрешённый смысл | Ограничения |
|---|---|---|
| `OWNER` | свои питомцы, поиск, заявка, свои записи, решение о переносе, опубликованный результат | Нет прав читать чужих владельцев/медицинские drafts, выбирать подтверждение серверу |
| `CLINIC_RECEPTIONIST` | очередь, записи, расписание, административные пациенты, bounded local profile | Нет клинической публикации, смены договора/финансов или чужого филиала |
| `CLINIC_ADMIN` | та же операционная база с разрешёнными настройками в рамках конкретной клиники | Не означает врача; не публикует Clinical Result |
| `CLINIC_VETERINARIAN` | назначенные приёмы/пациенты, собственные клинические действия | Не видит чужие календари; не получает admin mutation rights |
| `PLATFORM_ADMIN` / `SECURITY_AUDITOR` | отдельные платформенные security/ops функции | Не наследуют Owner/Clinic private data по умолчанию |

`TELEMED_VETERINARIAN`, `SUPPORT_L1/L2`, `FINANCE_OPERATOR`, `INSURANCE_OPERATOR`, `SYSTEM_WORKER` есть в enum, но не должны автоматически появляться в первой пилотной навигации.

**Руководитель:** `manager` в CRM V07 — UI persona, **не** backend enum. Пока нет отдельного утверждённого capability mapping — не создавать `CLINIC_MANAGER`, не переносить права admin по названию. Можно показывать прототип с меткой DEMO, но не claim authenticated access.

**Врач только свой календарь:** предлагаемое ограничение требует нормативной сверки. Проверенный [read service](../../backend/src/booking-core/veterinarian-visit-read.service.ts) ограничивает выдачу клиникой и филиалом. Персональная серверная фильтрация назначений остаётся `OPEN_GAP_NEEDS_SERVER_PROOF`; фильтр UI не закрывает этот пробел.

## Статусы UI

| Server truth | Допустимый UI-смысл | Чего не делать |
|---|---|---|
| `PENDING_CONFIRMATION` | «Заявка ожидает подтверждения клиникой» | «Вы записаны» |
| `CONFIRMED` | «Запись подтверждена» | «Визит состоялся» |
| `REJECTED` | «Клиника отклонила заявку» при доказанном decline | Путать с пользовательской отменой |
| `CANCELLED` | «Запись/заявка отменена» с server actor/причиной, если доступна | Не выводить отмену из локальной кнопки до readback |
| `EXPIRED` | «Срок подтверждения истёк» по серверу | Не решать по browser countdown |
| Visit/Result `DRAFT` | Доступно уполномоченному врачу | Показать владельцу как заключение |
| Result `PUBLISHED` | Итог осмотра доступен владельцу в Diary | Разрешить overwrite |

Status projection/version извлекать только из канонических API. Клиентские success toast и модальные окна не являются machine evidence. Источник приёма, no-show, факт visit completion, Result publication и CPA — отдельные события; не сворачивать в один «Завершено».
