# Total Application and Portal Inventory

## Current and target applications

| ID | Name / audience | Repository / framework | Runtime/build/route | Current → target | Gate/contracts/design | Screens current → target | Reuse verdict / largest gaps |
|---|---|---|---|---|---|---:|---|
| APP-001 | Owner App / pet owners | `apps/owner-app`; React Native, Expo Router, Expo Web | Single cross-platform runtime and route tree; production server export supports iOS, Android and Web | `ACTIVE_RUNTIME → CORE_MVP` | `PILOT_V1`; Owner APIs; V50 Owner | shared Owner groups across three targets | `REUSE_MAJOR_DELTA`; map, specialist-first, history/change, reallocation, Diary |
| APP-002 | Owner Web target / acquisition and owners | `apps/owner-app` Web target; no separate application | Expo Router Web plus bounded same-origin session bridge | `ACTIVE_TARGET → CORE_MVP` | same Owner contracts/UI; HttpOnly Web session | shared APP-001 inventory | `SAME_APPLICATION`; dedicated Next.js decision superseded |
| APP-003 | Clinic Portal / clinic staff | `apps/clinic-portal`; Next.js App Router | Active buildable/routable runtime with scoped pages and BFF | `ACTIVE_RUNTIME → CORE_MVP` | clinic capabilities/scope; V50 Clinic + Journal | 10 primary page families → 20+ | `REUSE_MAJOR_DELTA`; Journal, DoctorShift, staff relations, Result |
| APP-004 | Operations / Call Center | no bounded application; `/ops/security` is not booking Operations | No booking-change runtime | `MISSING → CORE_MVP` | future operations APIs; V50 system reuse | 0 → 8 | `NEW_APPLICATION_REQUIRED` as internal Portal section first |
| APP-005 | VetHelp Admin / internal backoffice | `apps/clinic-portal/app/ops/security`; Next.js | Narrow security route only | `PARTIAL_RUNTIME → MVP_SUPPORTING` | platform security capability | 1 → bounded admin only | `REUSE_MAJOR_DELTA`; not a substitute for Operations |
| APP-006 | Legacy Owner Flutter | `apps/owner_mobile`; Flutter | Buildable legacy/reference, not first-MVP target | `LEGACY_READ_ONLY → LEGACY_COMPAT` | legacy APIs/flags | many legacy screens → 0 new | `RETIRE_LATER`; read-only archaeology |
| APP-007 | V50 Primary Prototype | `prototype-v50`; HTML/CSS/JS | Routable static prototype, not runtime | `PROTOTYPE_ONLY → MVP_SUPPORTING` | canonical design language | 30 screens | `REUSE_AS_IS` as design source; manifest stale |
| APP-008 | Clinic Booking Journal Prototype | `prototype-v50/clinic-booking-journal`; HTML/CSS/JS | Routable static prototype, manifest verified | `PROTOTYPE_ONLY → MVP_SUPPORTING` | Clinic Journal target | 104 states | `REUSE_SMALL_DELTA` as target design |

## Owner cross-platform verdict

`apps/owner-app` is canonical for iOS, Android and Web: one product, one shared UI/domain implementation, one API contract and three platform targets. The former `OWNER_WEB_MISSING / NEW_APPLICATION_REQUIRED` and dedicated Next.js recommendation are `SUPERSEDED_BY_PRODUCT_ARCHITECTURE_DECISION`.

Web-specific code is restricted to secure same-origin credential transport and genuine platform lifecycle/navigation seams. Whole screens, booking semantics and design systems are not forked.

## Owner channel parity

| Capability | Backend authority | Mobile implementation / required parity | Web implementation / required parity | V50 source | Gap |
|---|---|---|---|---|---|
| Auth/OTP | auth/session | `IMPLEMENTED / FULL` | `SHARED_IMPLEMENTED / FULL` | Profile/auth adaptation | later profile/security surfaces |
| Home | owner projection | `PARTIAL / FULL` | `SHARED_PARTIAL / FULL` | OWN-001 | hierarchy and later capability groups |
| Pets | owner/pet | `PARTIAL / FULL` | `SHARED_PARTIAL / FULL` | OWN-009 | independent profile routes |
| Pet Profile | owner/pet | `PARTIAL / FULL` | `SHARED_PARTIAL / FULL` | OWN-010 | bounded profile/detail |
| Diary | future DiaryEntry | `MISSING / FULL` | `MISSING / FULL` | OWN-011 | domain and shared client |
| Documents | document metadata/storage | `MISSING / FULL` | `MISSING / FULL` | OWN-011 | target delivery surface |
| Clinic discovery | catalog | `IMPLEMENTED / FULL` | `SHARED_IMPLEMENTED / FULL` | OWN-002 | later map/specialist expansion |
| Map | geo/catalog | `MISSING / FULL` | `MISSING / FULL` | OWN-002/003 | backend projection/UI |
| Specialist-first | doctor/specialty | `PARTIAL / FULL` | `SHARED_PARTIAL / FULL` | OWN-018 | relations/ranking/consent |
| Clinic detail | catalog | `IMPLEMENTED / FULL` | `SHARED_IMPLEMENTED / FULL` | OWN-004 | bounded shared composition |
| Doctor detail | public doctor | `PARTIAL / FULL` | `SHARED_PARTIAL / FULL` | OWN-019 | consent-safe independent route |
| Service | catalog | `IMPLEMENTED / FULL` | `SHARED_IMPLEMENTED / FULL` | OWN-004/005 | none for current bounded journey |
| Availability | Booking Core | `IMPLEMENTED / FULL` | `SHARED_IMPLEMENTED / FULL` | OWN-005 | generated/published inventory is Wave 3 |
| Booking review | Booking Core | `IMPLEMENTED / FULL` | `SHARED_IMPLEMENTED / FULL` | OWN-006 | none for current bounded journey |
| Pending + countdown | server time/SLA | `IMPLEMENTED / FULL` | `SHARED_IMPLEMENTED / FULL` | adapted OWN-006/008 | none for Wave 1 contract |
| Confirmed/rejected/expired | owner projection | `IMPLEMENTED / FULL` | `SHARED_IMPLEMENTED / FULL` | adapted OWN-008 | none for Wave 1 contract |
| Appointments/detail | owner bookings | `PARTIAL / FULL` | `SHARED_PARTIAL / FULL` | OWN-007/008 | complete history/navigation |
| Cancellation request | future change request | `PARTIAL_DIRECT_CANCEL / FULL` | `SHARED_PARTIAL / FULL` | adapted OWN-008 | target BookingChangeRequest semantics |
| Reschedule request | future change request | `MISSING / FULL` | `MISSING / FULL` | extension | domain/shared client |
| Reallocation offer | future reallocation | `MISSING / FULL` | `MISSING / FULL` | adapted OWN-020 | cross-clinic domain |
| Notifications | notification projection | `MISSING / BOUNDED` | `MISSING / BOUNDED` | OWN-015 | inbox/delivery |
| Profile | owner/session | `PARTIAL / FULL` | `SHARED_PARTIAL / FULL` | OWN-016 | complete profile/security screens |
| QR/deep link | attribution/auth | `PARTIAL / FULL` | `SHARED_PARTIAL / FULL` | V50 adaptation | partner attribution; booking deep link implemented |

## Target screen inventory and IA

| Screen IDs | Application / role | Primary task | V50 source | Current route/state | API dependency | Target / wave |
|---|---|---|---|---|---|---|
| OM-001..005 | Owner Mobile / Owner | auth, home, pet/list/profile | OWN-001/009/010 | composed index; partial | auth/owner/pet | Core / W0-W4 |
| OM-006..013 | Owner Mobile / Owner | discovery, map, specialist, clinic/doctor/service/availability | OWN-002..005/018/019 | catalog/service/availability partial | catalog/specialty/availability | Core / W3-W4 |
| OM-014..020 | Owner Mobile / Owner | review, pending, terminal, bookings/detail | OWN-006..008 | review/status partial | Booking Core/read projection | Core / W1 |
| OM-021..027 | Owner Mobile / Owner | change request, reallocation, Diary/documents, notifications/profile | adapted OWN-008/011/015/016/020 | mostly missing | change/reallocation/Diary/notification | Core / W5-W7 |
| OW-001..018 | Owner App Web target / Owner/public | QR, OTP, pet, discovery, booking/status/history/change/reallocation/Diary | shared V50 responsive system | Expo Web runtime in `apps/owner-app`; bounded acquisition/booking complete, later groups remain | same backend authority as native | Core / W2-W7 |
| CP-001..007 | Clinic Portal / reception/admin | Journal, Requests, Schedule, Clients, Staff, Settings, manual booking | Clinic Journal + CLN-001/002/005 | Queue/schedule/patients partial; Journal/staff missing | queue/schedule/patient/staff | Core / W1-W5 |
| CP-008..011 | Clinic Portal / veterinarian | assigned Visit, complete/no-show, Result/document | CLN-003/006 adaptation | Visit bounded; result missing | visit/result/document | Core / W7 |
| OP-001..008 | Operations / operator | callbacks, cancellation, reschedule, reallocation, booking/owner context, SLA, outcome | V50 system reuse | no runtime | change request/reallocation | Core / W5-W6 |

Target IA:

- Owner Mobile: Home; Search; Bookings; Pets/Diary; Profile.
- Owner Web: acquisition landing; Search; Bookings; Pets/Diary; Profile.
- Clinic Portal: **Журнал записи; Заявки; Клиенты; Сотрудники; Настройки**, with contextual Schedule, Visit and Result flows.
- Operations: Callbacks; Cancellation Requests; Reschedule Requests; Reallocation; case context/SLA/outcome.

## Clinic Portal runtime map

| Target/current surface | Portal route → component | BFF → backend authority | DB authority | UX/V50/MVP | Reuse |
|---|---|---|---|---|---|
| Scoped root | scoped root → `ClinicWorkspaceHome` | workspace-home BFF → scoped projection/capability | memberships, holds, appointments | partial home; Journal should be primary | major delta |
| Booking Journal | no runtime route/component | none; future aggregate projection | schedule, holds, appointments | 104-state prototype only; Core MVP | new runtime from V50 |
| Queue/Requests | scoped `/queue` → `ClinicQueueClientV2` | booking-queue + command BFFs → Queue/read/confirm/decline/request-notes | holds, slots, appointments, audit/outbox | mature partial Journal asset | reuse small delta |
| Schedule | scoped `/schedule` → `ClinicScheduleClient` + `DoctorShiftPanel` | bounded schedule/DoctorShift BFF family → schedule APIs/capabilities | hours, DoctorService, DoctorShift, generation runs, canonical slots, publication, blackouts | Wave 3 DoctorShift create/edit/preview/publish/read-only runtime implemented | reused with approved major delta |
| Appointments | scoped `/appointments` → `ClinicAppointmentsRegistry` | appointments BFF → scoped list | appointments/holds | bounded registry | reuse small delta |
| Appointment detail | scoped appointment route → `ClinicAppointmentDetail` | detail BFF → scoped detail | appointment/hold | bounded administrative detail | reuse small delta |
| Patients/Clients | scoped `/patients` → `ClinicPatientsRegistry` | patients BFF → patient admin read | pets/clinic association | bounded registry; rename IA to Clients | reuse small delta |
| Patient detail | scoped patient route → `ClinicPatientDetail` | detail/local-profile BFF → safe admin projection | pet association/local alias | administrative only; not full clinical record | reuse small delta |
| Staff/Doctors/Specialties | schedule-context explicit staff↔catalog-doctor mapping and DoctorService eligibility; no primary specialty page | bounded DoctorShift BFFs → same-location mapping/eligibility authority | staff, catalog doctors, `doctor_services`; specialty taxonomy remains partial | DoctorService relation implemented; specialty configuration remains later scope | bounded Wave 3 delta plus later specialty surface |
| Services | schedule-context controls | services BFF → schedule services | service rows | partial configuration | reuse major delta |
| Settings | no bounded MVP page | none | none | missing | V50-system extension |
| Manual booking | manual-slot API only; no appointment workflow | manual-slots BFF → schedule | slots only | slot creation is not booking | new workflow |
| Visit workspace | scoped `/vet/visits/:holdId` → `VeterinarianVisitWorkspace` | visit BFF → visit read/complete | appointment/hold | bounded completion foundation | reuse major delta |
| Result upload | no page | no target Result API | document metadata only | missing | new V50-derived flow |
| No-show | no page/command proven | none target | none target | missing | new state/action |
| Alternative slot | Queue drawer → `AlternativeSlotDrawer` | alternative BFF → same-location proposal | holds/slots/swap | legacy foundation, not Smart Reallocation | keep as foundation |
| Quality | scoped `/quality` | quality BFF → legacy quality projection | operational aggregates | overbuilt/outside primary Pilot IA | hide in `PILOT_V1` |
| Clinical legacy | compatibility routes/components | legacy APIs | legacy clinical data | not target full record | hide/contain |
| Telemedicine | scoped `/telemed` and platform vet routes | telemed BFF/API | legacy telemed tables | over Scope Freeze | hide/disable |

Clinic audit answers:

1. Booking Journal runtime: **No**; prototype only. 2. Actual Journal states: Queue supplies partial behavior for 38 mapped states; none is accepted as the complete Journal runtime, and 66 remain future prototype states. 3. Prototype-only: the 66 future states plus Journal composition itself. 4. Queue: **yes, mature reusable runtime asset**. 5. Schedule satisfies bounded Wave 3 DoctorShift: **yes, machine-complete**. 6. Doctor/service/specialty relations configurable: **DoctorService yes; specialty taxonomy remains partial**. 7. Generated inventory publishing: **yes, canonical and Owner-consumed**. 8. Clinic manual appointment: **no; manual slot is not appointment**. 9. Visit completion: **bounded foundation**. 10. Result/documents: **no target Result upload; metadata foundation only**. 11. Required Patient scope: identity, owner-safe booking context, clinic-local alias and visit/result context. 12. Overbuilt Patient scope: full clinical/CRM/financial record. 13. Hide in Pilot: Quality, telemedicine, legacy clinical/full-record and unrelated admin routes. 14. Direct reuse: shell, Queue, registries, patient detail, status/cards/forms/drawers. 15. Remaining redesign: Journal composition, specialty configuration, manual appointment and Visit/Result.

## Operations audit

Verdict: `OPERATIONS_RUNTIME_MISSING`. Searches found roles, operational terminology and a narrow `/ops/security` page, but no booking-change/callback/reallocation frontend or backend aggregate. Backend `RESCHEDULE_REQUESTED` tokens and same-location alternative mechanics do not constitute Operations.

Placement: `INTERNAL_PORTAL_SECTION` initially, with separate platform-operator capabilities and no clinic-membership shortcut. IA: Callbacks; Cancellation Requests; Reschedule Requests; Reallocation; Booking Context; Owner Contact; SLA; Outcome.
