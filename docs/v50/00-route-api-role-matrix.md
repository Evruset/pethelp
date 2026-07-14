# VetHelp prototype-v50: route, API и role matrix

Дата снимка: 11 июля 2026 года

Связанный анализ: `docs/v50/00-current-state-gap-analysis.md`

## 1. Правила чтения

Матрица перечисляет все 30 уникальных значений `data-page` из `prototype-v50/index.html`. Повторный `catalog` в prototype DOM не считается отдельным экраном. Hash routes прототипа не предлагаются как production URL; они задают смысл, hierarchy и back behavior.

Production status:

- **реализовано** — route/component и необходимый API существуют;
- **частично** — сценарий собран внутри другого экрана либо отсутствует часть API/состояний;
- **отсутствует** — route/API не найден;
- **конфликт** — текущая реализация нарушает role/domain boundary v50.

В колонке capability сначала указывается целевая capability, затем фактическая role enforcement. Названия target capabilities являются результатом инвентаризации, а не уже опубликованным контрактом.

## 2. Owner route matrix

| Prototype route | Назначение v50 | Production route/component | API/source | Статус и основной разрыв |
| --- | --- | --- | --- | --- |
| `home` | выбранный питомец, следующий safe step, services | root `OwnerJourneyEntry` → canonical shell → flagged V50 Care Journey Home | `GET /v1/owner/home` owner-scoped read projection; legacy rollback uses pets + appointments | **частично реализовано и протестировано V50-OWNER-01**: backend owns priority/action eligibility; full prototype map/search/notifications/profile and unrelated deep links remain outside this bounded slice |
| `catalog` | search/filter clinic list, availability | `PublicCatalogPage` | `GET /v1/clinics`, `/v1/catalog/clinic-locations`, clinic locations/services/availability | **реализовано** для clinic/service/slot; локальный большой UI diff не считается опубликованным |
| `decision-comparison` | сравнение вариантов и decision support | отсутствует | специального API/read model нет | **отсутствует** |
| `clinic` | clinic detail, capabilities, location/service choice | clinic drill-down внутри `PublicCatalogPage` | clinic detail/locations/services/availability | **частично**: отдельный route/deep link отсутствует |
| `booking` | выбор дня/слота | `BookingMarketplacePage` | slots + create hold/read hold | **реализовано** |
| `booking-review` | review before authoritative command | встроенный submit flow `BookingMarketplacePage` | `POST /v1/booking-holds` | **частично**: отдельного review route/back recovery нет |
| `appointments` | active/history list | `OwnerAppointmentsPage` | `GET /v1/owner/appointments` | **реализовано** |
| `appointment-detail` | detail, timeline, cancel/alternative | `OwnerAppointmentDetailPage` | `GET /v1/owner/appointments/:holdId`, hold read, cancel/release | **реализовано**; named route/deep link persistence не оформлены |
| `pets` | pet selector/registry | `OwnerPetsPage` | `GET/POST /v1/owner/pets` | **реализовано** |
| `pet-profile` | pet profile and medical summary | `OwnerPetsPage` edit + `OwnerPetCarePage` | pet detail/update/care summary/documents | **частично**: profile/care split не совпадает с route map |
| `diary` | visits, documents, reminders | `OwnerPetCarePage` | `GET /v1/owner/pets/:petId/care-summary`, document upload | **частично**: care history есть; notification/reminder and robust attachment lifecycle неполны |
| `telemed` | active/history and intake entry | `OwnerTelemedPage` | telemed sessions + intake | **реализовано/частично** |
| `telemed-wait` | authoritative waiting room | `TelemedWaitingRoomPage` | session read/cancel, `serverNow`, version | **реализовано** |
| `insurance` | profile, consent, coverage | `CoverageCheckPage` | insurance profiles/coverage checks | **реализовано** |
| `notifications` | notification center/preferences | app-bar snackbar only | API/repository нет | **отсутствует** |
| `profile` | personal data, session/devices/logout | iOS `_OwnerProfileLanding` placeholder; Android no tab | auth me/refresh/logout есть, settings API нет | **отсутствует** как product flow |
| `emergency` | triage, verified clinic routing, calls/routes | `EmergencyTriagePage` → `EmergencyPage` | emergency triage/clinics/route actions | **реализовано** для current flow |
| `doctor-select` | doctor choice by clinic/service/slot | отсутствует | public doctor list/API отсутствует | **отсутствует** |
| `doctor-detail` | doctor profile and selection rationale | отсутствует | `catalog_schema.doctors` есть, public controller не отдаёт doctor detail | **отсутствует** |
| `alternative-slot` | review/accept/release proposed slot | `AlternativeSlotPage` | alternative snapshot/accept/release | **реализовано** |
| `telemed-check` | device/network/consent pre-check | intake validation only | dedicated pre-check contract нет | **отсутствует/частично** |
| `telemed-call` | LiveKit call, reconnect/fallback | `TelemedLiveCallView` opens from connected waiting state | owner room token + LiveKit | **частично**: call surface exists; reconnect/fallback/reconciliation coverage incomplete |
| `telemed-summary` | recommendations and follow-up | completed rows inside `OwnerTelemedPage` | telemed session read model | **частично**: separate summary route/document contract absent |

### 2.1 Owner action/API matrix

| Product action | Endpoint | Target capability / actual role | State effect | Audit/event evidence | Coverage |
| --- | --- | --- | --- | --- | --- |
| Request/verify OTP | `POST /v1/auth/otp/request`, `/verify` | `auth.owner.start` / public | challenge → session | `user.authenticated` on successful auth | implemented |
| Refresh/logout | `POST /v1/auth/refresh`, `/logout` | `session.refresh/revoke` / refresh token | session rotate/revoke | auth audit exists for successful auth; logout event not confirmed | partial evidence |
| Read self | `GET /v1/owner/me` | `owner.self.read` / `OWNER` | none | read audit not found | implemented |
| List/create/update pet | `GET/POST /v1/owner/pets`, `GET/PATCH .../:petId` | `pet.own.read/write` / `OWNER`, owner from JWT | pet aggregate version changes | `pet.created`, `pet.updated` | implemented |
| Upload pet document | `POST /v1/owner/pets/:petId/documents` | `pet.document.upload` / `OWNER` | document `PROCESSING` | `pet.document.uploaded` | implemented |
| Search clinics/availability | public catalog/slots endpoints | public read | none | no read audit expected | implemented |
| Create booking hold | `POST /v1/booking-holds` | `booking.own.create` / `OWNER` | initial → manual/MIS path | `booking.hold.created`, outbox `booking.hold.created.v1` | implemented; idempotency/correlation |
| Read hold/events | `GET /v1/booking-holds/:id`, `.../events` | own booking read / `OWNER` | none | replay from outbox; read audit not found | implemented |
| Release pending hold | `POST /v1/booking-holds/:id/release` | own booking cancel / `OWNER` | allowed state → `RELEASED` | `booking.hold.released` | implemented; idempotent |
| Request appointment cancellation | `POST /v1/booking-holds/:id/cancellation-requests` | own appointment cancel request / `OWNER` | allowed state → `CANCELLATION_REQUESTED` | `booking.cancellation_requested` | implemented; no idempotency header in controller |
| Read/accept alternative | `GET .../:id/alternative`, `POST .../alternative-slot/accept` | own booking alternative / `OWNER` | `ALTERNATIVE_PENDING` → `MIS_HELD` | `BOOKING_ALTERNATIVE_ACCEPTED`, outbox | implemented; If-Match/idempotency |
| Create payment intent | `POST /v1/booking-holds/:id/payment-intents` | own payment / `OWNER` | separate payment state; may advance booking | payment ledger/audit/outbox | implemented |
| Insurance profile/coverage | `/v1/insurance/profiles`, `/coverage-checks` | own insurance / `OWNER` | consent and coverage states | `consent.granted/revoked`, `insurance.request.created`, outbox | implemented |
| Emergency triage/route | `/v1/emergency/triage-decisions`, `/route-actions` | public/owner safety action | triage outcome / route action | dedicated triage/route tables; generic audit event not found | implemented |
| Create telemed intake/payment | `/v1/telemed/intakes`, `.../payment-intents` | own telemed / `OWNER` | draft/payment → queued through worker | case/payment events and outbox | implemented |
| Cancel waiting session | `POST /v1/telemed/sessions/:id/cancel` | own telemed cancel / `OWNER` | waiting → `CANCELLED`, case → `CANCELLED_BY_OWNER` | telemed case event + payment void outbox | implemented; idempotent |
| Join room | `POST /v1/telemed/sessions/:id/room-token` | active participant / `OWNER` | no direct state mutation | LiveKit join/completion audit occurs from verified webhook | implemented |
| Notifications/profile preference | отсутствует | own settings | unknown | absent | missing |

## 3. Clinic portal route matrix

Целевые URL из master prompt могут быть адаптированы к текущему location-scoped convention. Матрица не требует механического переименования `/clinics/:clinicId/locations/:locationId/*`, но требует documented deep links and ownership.

| Prototype route | Role semantics v50 | Current production route/component | API | Статус и разрыв |
| --- | --- | --- | --- | --- |
| `clinic-workspace` | admin operational dashboard или doctor personal shift | отсутствует; portal `/` — informational page | dashboard/shift read models отсутствуют | **отсутствует** |
| `clinic-schedule` | admin services/staff/resources/availability; no doctor default | `/clinics/:clinicId/locations/:locationId/schedule`, `ClinicScheduleClient` | full schedule snapshot + 14 mutation families | **реализовано** для admin/reception; shell parity partial |
| `clinic-visit` | assigned doctor clinical workbench | production page отсутствует | clinical visit API/schema отсутствуют | **отсутствует**; free-text complete endpoint is not replacement |
| `clinic-appointments` | admin registry/detail/actions; doctor personal shift only | queue route covers only manual pending; registry absent | clinic appointment list/detail/check-in/reschedule APIs absent | **отсутствует/частично** |
| `clinic-patients` | admin registry; doctor treatment-scoped registry | отсутствует | clinic patient list API absent | **отсутствует** |
| `clinic-patient` | capability-filtered administrative/medical card | отсутствует | clinic patient detail API absent | **отсутствует** |
| `clinic-telemed` | admin dispatcher or doctor assigned cases | location route blocks access; `/telemed/vet` is platform vet queue | vet queue exists; admin dispatcher absent | **частично/conflict in ownership model** |

Production-only routes without a one-to-one prototype hash:

| Production route | Meaning | Prototype destination |
| --- | --- | --- |
| `/clinics/:clinicId/locations/:locationId/queue` | mature Level-C FIFO queue | target `/clinic/queue`, operational part of admin workspace |
| `/clinics/:clinicId/locations/:locationId/quality` | quality metrics | target `/clinic/quality` |
| `/telemed/vet` | platform `TELEMED_VETERINARIAN` queue/workspace | doctor part of target `/clinic/telemed`, ownership decision required |
| `/ops/security` | platform security/audit view | outside clinic v50 route map |

## 4. Admin/reception action matrix

| Prototype/target action | Production endpoint | Target capability / actual enforcement | State transition | Audit/outbox | Status |
| --- | --- | --- | --- | --- | --- |
| Read operational dashboard | absent | `clinic.dashboard.read` | none | absent | missing |
| Read FIFO queue | `GET /v1/clinic/:clinicId/locations/:locationId/booking-queue` | `booking.queue.read` / admin+reception, JWT clinic/location + active DB membership | none | returns latest audit, no read audit | implemented |
| Read hold audit drawer | `GET .../booking-holds/:holdId/audit-trail` | `booking.audit.read` / admin+reception + scoped membership | none | reads append-only audit | implemented |
| Confirm request | `POST /v1/clinic/booking-holds/:id/confirm` | `booking.confirm` / admin+reception + DB membership | `MANUAL_CONFIRM_PENDING` → `CONFIRMED`, appointment created | `booking.confirmed`, `booking.confirmed.v1` | implemented; FIFO/If-Match/idempotency |
| Decline request | `POST .../:id/decline` | `booking.decline` / admin+reception + DB membership | pending → `RELEASED` | `booking.declined`, hold released outbox | implemented |
| Ask for clarification | `POST .../:id/request-notes` | `booking.request_notes` / admin+reception + DB membership | state unchanged, version +1 | `booking.notes.requested`, outbox | implemented |
| Propose alternative | `POST .../:id/alternative-slot` | `booking.alternative.propose` / admin+reception + DB membership | manual/alternative → `ALTERNATIVE_PENDING` | `BOOKING_ALTERNATIVE_PROPOSED`, outbox | implemented |
| Read schedule | `GET /v1/clinic/:clinicId/locations/:locationId/schedule/slots` | `schedule.read` / admin+reception + DB membership | none | no read audit | implemented |
| Working hours | `POST .../working-hours` | `schedule.hours.manage` / admin+reception + DB membership | hours upsert | `clinic.schedule.working_hours.updated`, outbox | implemented |
| Create/update service | `POST .../services`, `POST .../services/:id` | `schedule.service.manage` / admin+reception + DB membership | service create/version +1 | `clinic.schedule.service.created/updated`, outbox | implemented |
| Create/update staff | `POST .../staff`, `POST .../staff/:id` | `schedule.staff.manage` / admin+reception + DB membership | staff create/version +1 | `clinic.schedule.staff.created/updated`, outbox | implemented |
| Create/update resource | `POST .../resources`, `POST .../resources/:id` | `schedule.resource.manage` / admin+reception + DB membership | resource create/version +1 | `clinic.schedule.resource.created/updated`, outbox | implemented |
| Create/cancel period | `POST .../periods`, `POST .../periods/:id/cancel` | `schedule.period.manage` / admin+reception + DB membership | period create/cancel | `clinic.schedule.period.created/cancelled`, outbox | implemented |
| Import/create slots | `POST .../import`, `POST .../manual-slots` | `schedule.slot.manage` / admin+reception + DB membership | slot rows created | `clinic.schedule.import.completed` or `slot.created`, outbox | implemented |
| Blackout/capacity | `POST .../slots/:id/blackout`, `/capacity` | `schedule.slot.manage` / admin+reception + DB membership | slot `OPEN`→`CLOSED` or capacity/version update | `clinic.schedule.slot.blackout/capacity_updated`, outbox | implemented |
| Export attempt | `POST .../export-attempts` | `schedule.export` / admin+reception + DB membership | none | `export.download.attempted` | implemented |
| Appointment registry/detail | absent | `appointment.registry.read` | none | absent | missing |
| Create manual appointment | absent as clinic appointment command; prototype-only local action | `appointment.create` | unknown | absent | missing |
| Check-in/arrival | absent | `appointment.check_in` | expected appointment transition | absent | missing |
| Reschedule appointment | only alternative-slot for pending hold; no confirmed appointment reschedule command | `appointment.reschedule` | expected appointment transition | partial booking audit only | missing/partial |
| Register/edit patient admin data | absent | `patient.admin.create/update` | pet/admin aggregate | absent | missing |
| Read allowed patient sections | absent | `patient.admin.read` with category filter | none | read audit required for medical data | missing |
| Telemed dispatcher queue | absent | `telemed.dispatch.read/manage` | case assignment | absent | missing |
| Read quality | `GET .../quality-dashboard` | `quality.read` / admin+reception + DB membership | none | no read audit | implemented |
| Complete/sign visit | current `POST /v1/clinic/booking-holds/:id/complete` | target **denied**; actual admin+clinic vet | `CONFIRMED` hold and appointment → `COMPLETED`, free-text summary | `booking.appointment.completed`, push outbox | **conflict P0** |

## 5. Doctor action matrix

| Prototype/target action | Production endpoint | Target capability / actual enforcement | State transition | Audit/event | Status |
| --- | --- | --- | --- | --- | --- |
| Read personal shift | absent | `doctor.shift.read` | none | absent | missing |
| Read assigned patient context | absent | `patient.clinical.read_assigned` | none | medical read audit absent | missing |
| Start visit | absent | `visit.start_assigned` | `not_started` → `in_progress` | absent | missing |
| Save complaints/anamnesis/vitals/exam | absent | `visit.section.write_assigned` | draft version +1 | absent | missing |
| Add diagnosis/procedure/prescription | absent | granular clinical capabilities | draft section changes | absent | missing |
| Capture consent evidence/document | absent | `visit.consent/document.write` | consent/document aggregate | absent | missing |
| Validate ready to sign | absent | `visit.validate` | `in_progress` → `ready_to_sign` | absent | missing |
| Sign/complete conclusion | free-text complete endpoint exists | target `visit.sign_assigned`; actual `CLINIC_VETERINARIAN` **and admin**, JWT location only | booking/appointment → `COMPLETED` | `booking.appointment.completed` | **conflict/insufficient** |
| Amend signed conclusion | absent | `visit.amend_signed` | signed → amendment | absent | missing |
| List telemed cases | `GET /v1/telemed/vet/queue` | `telemed.case.read_available/assigned` / `TELEMED_VETERINARIAN` | none | no read audit | implemented for platform role |
| Claim case | `POST /v1/telemed/vet/cases/:id/assign` | target dispatcher or allowed-doctor claim; actual any platform telemed vet | `QUEUED` → `ASSIGNED` to self | case event `ASSIGNED` | implemented; target ownership undecided |
| Start session | `POST .../:id/start-session` | assigned platform vet | creates waiting session | telemed session/case events | implemented |
| Connect doctor | `POST .../sessions/:sid/connect` | assigned platform vet | session waiting → connected path; case doctor-joined/in-progress path | `DOCTOR_CONNECTED`, verified LiveKit audits | implemented |
| Save recommendation/follow-up/escalation | `PATCH .../:id/workspace` | assigned platform vet | case data update while assigned/joined/in-progress | `SAFETY_ESCALATED`, `RECOMMENDATION_SAVED`, `FOLLOW_UP_ROUTED` | implemented; not a full clinical record |
| Complete telemed clinical conclusion | driven by LiveKit room finished; no signed conclusion API | `telemed.conclusion.sign` | session/case complete | LiveKit completion audit | partial/missing clinical semantics |

## 6. Actual role-to-route enforcement

| Role | Backend access found | Portal access found | Key limitation |
| --- | --- | --- | --- |
| `OWNER` | owner/auth/pets/booking/payment/insurance/telemed | Flutter only | capabilities not returned as contract |
| `CLINIC_RECEPTIONIST` | queue, schedule, quality, booking mutations | location shell/queue/schedule/quality | no dashboard/registry/patients |
| `CLINIC_ADMIN` | same plus emergency profile and current clinical complete | same as receptionist | clinical completion is over-privileged |
| `CLINIC_VETERINARIAN` | current complete endpoint only; membership schema supports role | rejected by `canAccessClinicLocation`; no clinic routes | no doctor workspace/assignment ABAC |
| `TELEMED_VETERINARIAN` | global telemed vet queue/workspace | `/telemed/vet` | separate from clinic/location roster; self-assign model |
| `PLATFORM_ADMIN` | emergency approval, ops | `/ops/security` | outside clinic flow |
| `SECURITY_AUDITOR` | ops reads | `/ops/security` | outside clinic flow |

Enforcement mismatch details:

1. `backend/migrations/node-pg/1719400000001_allow_clinic_veterinarian_membership.js` permits clinic veterinarians.
2. `ClinicEmployeeAccessService.assertLocationAccess` still checks only admin/receptionist.
3. `apps/clinic-portal/lib/auth/clinic-session.ts::canAccessClinicLocation` does the same.
4. `ClinicPortalService.completeAppointment` bypasses DB membership and assignment, using role + JWT location only.

## 7. Route ownership and navigation gaps

| Concern | Prototype contract | Current implementation | Required contract |
| --- | --- | --- | --- |
| Clinic entry | role changes first screen and nav | no workspace entry | server capability chooses admin dashboard or doctor shift |
| Location context | implicit fixture clinic | IDs embedded in URL | document location selector and tamper-safe deep links |
| Owner deep links | each hash is addressable | Navigator pushes anonymous routes | named/declarative routes with restart recovery |
| Useful filters | retained in route/UI state | queue fixed; schedule dates built from local app clock; most filters not in URL | server-normalized query state and back/forward tests |
| Forbidden routes | role redirect in prototype | per-page denial; doctor clinic route absent | central guard + backend anti-enumeration |
| Telemed ownership | same visual route, role-specific content | platform vet separated; clinic route denied | explicit admin dispatcher vs assigned-doctor contract |

## 8. Audit completeness by action class

| Action class | Current evidence | Gap |
| --- | --- | --- |
| Booking commands | audit + outbox + correlation broadly present | cancellation request lacks explicit idempotency header |
| Schedule commands | per-command audit/outbox and versions | no capability names/allowed actions in response |
| Patient profile owner writes | pet audit present | clinic patient reads/writes absent |
| Clinical work | one completion audit with summary length | no section/version/signature/amendment/read audit |
| Telemed vet work | case events and LiveKit audit | no immutable signed clinical conclusion |
| Insurance | consent/request audit and outbox | clinic/admin views not defined |
| Sensitive reads | queue audit trail readable; general reads mostly not audited | patient/clinical read auditing policy undefined |

## 9. Traceability conclusion

Every v50 screen now maps to production code or an explicit absence. Existing queue, schedule, owner booking, alternatives, insurance, emergency and telemed slices should be reused; no evidence supports replacing them with prototype JavaScript. The first implementation boundary must be capability/state architecture, because current routes cannot safely expose new admin/doctor read models until the P0 role conflicts above are resolved.
