# V50 Parity Register

Updated: 2026-07-14

Baseline: `4baf4e502e083fd6247f2dfe23626e546702fa1b`

Program state: V50 migration in progress

## Provenance gate

The product owner confirmed `prototype-v50/index.html` as the authoritative product and visual source. It declares `v50-clinic-role-workspaces` and is registered by `prototype-v50/manifest.json`.

Source-derived command:

```text
node scripts/v50-prototype-inventory.mjs prototype-v50/index.html --require-v50 --verify-manifest
```

Authoritative source inventory:

- 30 distinct `data-page` screens across 31 nodes; duplicate node: `catalog`;
- 15 primary sidebar anchors and 15 distinct `data-route-link` targets;
- 41 distinct source state/status tokens;
- desktop, tablet, mobile, reduced-motion, and print CSS variants;
- prototype roles: owner/default plus clinic `reception` and `doctor` modes.

All rows below are anchored to the verified V50 source and common manifest SHA-256 `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`. Evidence package `v50-owner-07-670bc32` passed integrity and product/visual validation; state/security validation also passed with zero vetoes. `OWN-020` is the one newly independent visually verified row, so visual fidelity is `12/30 VISUALLY_VERIFIED`.

## Reading the register

- State shorthand: `L` loading, `Ø` empty, `E` error/retry, `C` conflict/stale, `O` offline, `T` terminal, `A` accessibility/focus/live-region.
- Responsive: `D/T/M` means desktop/tablet/mobile variants are required, not yet accepted.
- Migration action: `REUSE`, `MODIFY`, `REPLACE`, `REMOVE`, `MISSING`.
- Status vocabulary: `NOT_STARTED`, `DISCOVERY`, `CONTRACT_READY`, `IMPLEMENTED`, `TESTED`, `VISUALLY_VERIFIED`, `UAT_ACCEPTED`, `ROLLED_OUT`, `LEGACY_REMOVED`, `BLOCKED`.
- “Current” records runtime evidence, not V50 acceptance. Feature flags marked `MISSING` must be decided before rollout.

## Screen, route, role, capability, API, state, test, and evidence matrix

| V50 ID | Source checksum | Domain / screen-state | Authoritative DOM anchor → target route | Current implementation / route | Required role / capability | Read API | Command API | State anchors | Responsive anchors | Flag | Tests / evidence | Action | Status / blockers |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OWN-001 | `prototype-v50/manifest.json#sha256` | Owner / Home | `#home` → `/owner/home` | `OwnerJourneyEntry` → canonical V50 shell → default-off V50 Care Journey Home | `OWNER`; owner identity only from JWT `sub` | `GET /v1/owner/home`; owned pets/appointments/telemed read projection | none; existing route callbacks only | L/Ø/E/O/T; selected pet, next-safe-step, active care, stale/offline, session-expired, unknown-action fallback | D/T/M responsive/state evidence at 375/412/768/1440 | `VETHELP_OWNER_V50_SHELL` + `OWNER_V50_HOME`; independent legacy rollback | backend 9/9; affected Flutter 16/16; analyze PASS; full Flutter 164/164; web build PASS; 10 checksum-bound visual artifacts | MODIFY | PARTIAL_IMPLEMENTATION / TESTED; shell, functional bounded slice, responsive and state coverage PASS; full prototype content parity PARTIAL and not `VISUALLY_VERIFIED` |
| OWN-002 | `prototype-v50/manifest.json#sha256` | Owner / Catalog | `#catalog` → `/owner/catalog` | flagged `OwnerCatalogV50Page`; legacy fallback retained | public/OWNER; optional JWT; foreign pet hint normalized | clinics, locations, services, freshness, fit reasons | typed booking intent only; no hold | loading/ready/map/filter/empty/error/stale/location fallback | 375/412/768/1440 captured | IMPLEMENTED / TESTED / VISUALLY_VERIFIED | backend 20/20 focused; affected Flutter 48/48; full 241/241; 12 runtime captures | REUSE | independent visual PASS; server freshness visible; default-off rollback |
| OWN-003 | `prototype-v50/manifest.json#sha256` | Owner / Clinic comparison | `#decision-comparison` → `/owner/catalog/compare` | absent | public/OWNER; target `catalog.compare.read` | comparison read model absent | none | L/Ø/E/O; selection limits | D/T/M | MISSING | required widget + API + E2E | MISSING | DISCOVERY / contract |
| OWN-004 | `prototype-v50/manifest.json#sha256` | Owner / Clinic details | `#clinic` → `/owner/clinics/:clinicId` | flagged deep-linkable `OwnerCatalogV50Page` detail | public/OWNER; active public clinic/location/service only | clinic, location, pricing, freshness and confirmation | typed location/service handoff only | loading/ready/not-found/stale/no-services/error | 375/412/768/1440 captured | IMPLEMENTED / TESTED / VISUALLY_VERIFIED | focused Flutter/backend plus 12 runtime captures; independent PASS | MODIFY | hero/pricing/doctor-preview hierarchy accepted; black band classified and removed as capture defect |
| OWN-005 | `prototype-v50/manifest.json#sha256` | Owner / Booking slot | `#booking` → `/owner/booking` | flagged `OwnerBookingSelectionV50Page`; legacy marketplace rollback | public/OWNER; optional owned-pet context | `GET /v1/clinic-locations/:locationId/booking-options`; safe service/date/slot projection | none in V50 path; typed intent only | L/Ø/E/C/O; service/date/slot reset; request-only/stale | 375/412/768/1440 captured | `OWNER_V50_SERVICE_SELECTION` + `OWNER_V50_SLOT_SELECTION`, default off/dependency ordered | backend/Flutter PASS; 32 runtime captures; independent PASS | REPLACE | IMPLEMENTED / TESTED / VISUALLY_VERIFIED; server authority, no capacity disclosure or hold |
| OWN-006 | `prototype-v50/manifest.json#sha256` | Owner / Booking review | `#booking-review` → `/owner/booking/review` | flagged Review with guarded Create Hold submission | public browse; mutation requires OWNER pet/session | selection read plus authoritative `POST /v1/booking-holds` and GET readback | payload-bound idempotent Create Hold only | ready/submitting/soft retry/final conflict/network/offline/session; selection retained | 375/412/768/1440 captured | `OWNER_V50_BOOKING_REVIEW` + default-off `OWNER_V50_CREATE_HOLD`/`OWNER_V50_BOOKING_STATUS` | PostgreSQL 4/4 including 100 concurrency; Flutter focused/full/analyze/build; visual PASS | REPLACE | IMPLEMENTED / TESTED / VISUALLY_VERIFIED; success and expiry only from server state |
| OWN-007 | `prototype-v50/manifest.json#sha256` | Owner / My bookings | `#appointments` → `/owner/bookings` | flagged `OwnerBookingsV50Page`; legacy appointments retained | `OWNER`; JWT-scoped own read | `GET /v1/owner/bookings`; server buckets/time/filter/keyset cursor | none | L/Ø/E/O; requires-action/active/history | D/T/M; 20 list captures | `OWNER_V50_MY_BOOKINGS`, default off; legacy rollback | real PG paging/isolation + Flutter full/focused + evidence package PASS | MODIFY | IMPLEMENTED / TESTED / VISUALLY_VERIFIED |
| OWN-008 | `prototype-v50/manifest.json#sha256` | Owner / Booking detail | `#appointment-detail` → `/owner/bookings/:holdId` | flagged `OwnerBookingDetailV50Page`; legacy detail/status retained | `OWNER`; normalized own-hold read/mutation | `GET /v1/owner/bookings/:holdId`; safe timeline/policy/version | `POST /v1/owner/bookings/:holdId/cancel`; If-Match + payload-bound idempotency | pending, confirmed, terminal, confirmation, submitting, external-pending, cancelled, offline stale | D/T/M; combined OWNER-05/06 evidence | detail/cancellation flags default off and dependency ordered | real PG 5/5 including concurrency/rollback; Flutter and visual PASS | MODIFY | PARTIAL_IMPLEMENTATION / TESTED / VISUALLY_VERIFIED; status/detail/cancellation complete, alternative/rebook/payment remain out of scope |
| OWN-009 | `prototype-v50/manifest.json#sha256` | Owner / Pets | `#pets` → `/owner/pets` | flagged `OwnerPetsPage` | `OWNER`; owner-scoped read/write | `GET /v1/owner/pets` | create/edit/archive/restore | loading/empty/error/offline; active/selected | D/T/M | IMPLEMENTED / TESTED / VISUALLY_VERIFIED | focused/full Flutter + 12 runtime captures | REUSE | media uses fallback avatar when no authoritative photo exists |
| OWN-010 | `prototype-v50/manifest.json#sha256` | Owner / Pet profile | `#pet-profile` → `/owner/pets/:petId` | `OwnerPetProfileV50Page` | `OWNER`; ownership + If-Match | pet detail/document metadata | PATCH/archive/restore | ready/warnings/edit/conflict/archived/not-found/session/offline | D/T/M | IMPLEMENTED / TESTED / VISUALLY_VERIFIED | Flutter/backend + 16 runtime captures and acceptance states | MODIFY | uncontracted insurance/care concepts omitted; raw OCR excluded |
| OWN-011 | `prototype-v50/manifest.json#sha256` | Owner / Pet Diary | `#diary` → `/owner/pets/:petId/diary` | `OwnerPetDiaryV50Page` | `OWNER`; pet/document isolation | authoritative diary + metadata + stream | none added | loading/empty/error/offline/filter/process/review/preview/document failure | D/T/M | IMPLEMENTED / TESTED / VISUALLY_VERIFIED | Flutter/backend + 20 runtime captures | MODIFY | lab dynamics/reminders remain outside bounded authority; safe PDF action present |
| OWN-012 | `prototype-v50/manifest.json#sha256` | Owner / Telemedicine | `#telemed` → `/owner/telemed` | `OwnerTelemedPage` | `OWNER`; target `telemed.own.read/create` | telemed cases/sessions | create intake/payment intent | L/Ø/E/C/O; intake/payment/queued/history | D/T/M | MISSING | telemed owner integration | MODIFY | DISCOVERY / none |
| OWN-013 | `prototype-v50/manifest.json#sha256` | Owner / Telemed waiting | `#telemed-wait` → `/owner/telemed/:id/wait` | `TelemedWaitingRoomPage` | `OWNER`; telemed participant | session read with server time/version | cancel, room-token | L/E/C/O/T; PAYMENT_PENDING, WAITING_DOCTOR, DOCTOR_JOINED, cancelled | D/T/M | MISSING | waiting-room/reconciliation tests | REUSE | DISCOVERY / none |
| OWN-014 | `prototype-v50/manifest.json#sha256` | Owner / Insurance | `#insurance` → `/owner/insurance` | `CoverageCheckPage` | `OWNER`; insurance own read/write | profiles, coverage checks | consent/revoke, create check | L/Ø/E/O/T; NOT_CHECKED, CHECK_PENDING, NEEDS_DOCUMENTS, active/expired/unsupported | D/T/M | MISSING | insurance widget/API tests | REUSE | DISCOVERY / none |
| OWN-015 | `prototype-v50/manifest.json#sha256` | Owner / Notifications | `#notifications` → `/owner/notifications` | snackbar only; no repository/API | `OWNER`; target `notification.own.read/manage` | absent | preferences absent | L/Ø/E/O; unread/read/preferences | D/T/M | MISSING | required API/widget/E2E | MISSING | DISCOVERY / contract |
| OWN-016 | `prototype-v50/manifest.json#sha256` | Owner / Profile-security | `#profile` → `/owner/profile` | iOS placeholder; Android absent | `OWNER`; `owner.self.read`, session revoke | `GET /v1/owner/me` | refresh/logout; settings absent | L/E/O/T; devices/sessions/logout | D/T/M | MISSING | auth/session + profile UI tests | MISSING | DISCOVERY / settings contract |
| OWN-017 | `prototype-v50/manifest.json#sha256` | Safety / Emergency | `#emergency` → `/emergency` | `EmergencyTriagePage` → `EmergencyPage` | public; verified emergency profile | triage/clinics/freshness | triage decision, route action; direct call | L/Ø/E/O/T; emergency, needs-route, safe fallback | D/T/M | MISSING | emergency integration/E2E | REUSE | DISCOVERY / none |
| OWN-018 | `prototype-v50/manifest.json#sha256` | Owner / Doctor select | `#doctor-select` → `/owner/doctors` | flagged doctor discovery in `OwnerCatalogV50Page` | public/OWNER; active clinic/location/VETERINARIAN allowlist | public id/name/title/clinic/location/availability only | optional doctor in typed booking intent | loading/ready/empty/not-found/error/stale | 375/412/768/1440 captured | IMPLEMENTED / TESTED / VISUALLY_VERIFIED | focused backend/Flutter plus 12 runtime captures; independent PASS | ADD | integration PASS; production rollout BLOCKED by `PUBLIC_DOCTOR_PROFILE_CONSENT_CONTRACT_MISSING`; default-off mitigation |
| OWN-019 | `prototype-v50/manifest.json#sha256` | Owner / Doctor detail | `#doctor-detail` → `/owner/doctors/:doctorId` | flagged safe direct deep link | public/OWNER; inactive/private normalized to not found | strict public doctor allowlist and freshness | typed handoff only | loading/profile/not-found/unavailable/error/stale | 375/412/768/1440 captured | IMPLEMENTED / TESTED / VISUALLY_VERIFIED | focused backend/Flutter plus 12 runtime captures; independent PASS | ADD | integration PASS; production rollout BLOCKED by `PUBLIC_DOCTOR_PROFILE_CONSENT_CONTRACT_MISSING`; photo/bio/rating/specialty omitted |
| OWN-020 | `prototype-v50/manifest.json#sha256` | Owner / Alternative slot | `#alternative-slot` → `/owner/bookings/:holdId/alternative` | flagged `AlternativeSlotPage` from V50 detail | `OWNER`; booking+proposal owner binding, normalized 404 | canonical alternative snapshot with server deadline/actions/price copy | proposal-ID accept/decline; If-Match + payload-bound idempotency | ready, price, expiring, expired, superseded, unavailable, submitting, accepted, decline, offline, ambiguous | 375/412/768/1440; 48 runtime captures | `OWNER_V50_ALTERNATIVE_RESOLUTION`, default off/dependency ordered | real PG 12/12 + legacy 4/4; Flutter/full/evidence; independent validators PASS | REUSE/MODIFY | IMPLEMENTED / TESTED / VISUALLY_VERIFIED |
| OWN-021 | `prototype-v50/manifest.json#sha256` | Owner / Telemed pre-check | `#telemed-check` → `/owner/telemed/:id/check` | intake validation only | `OWNER`; telemed participant | session/device-local state | consent/update; room-token later | L/E/O; permission denied, weak network, ready | D/T/M | MISSING | required device/network/consent tests | MODIFY | DISCOVERY / bounded contract |
| OWN-022 | `prototype-v50/manifest.json#sha256` | Owner / Telemed call | `#telemed-call` → `/owner/telemed/:id/call` | `TelemedLiveCallView` | `OWNER`; active participant | session + authoritative business state | room token; local media actions only | L/E/C/O/T; joining, IN_CALL, reconnecting, poor connection, cancelled | D/T/M | MISSING | LiveKit/reconnect/reconciliation tests | MODIFY | DISCOVERY / coverage |
| OWN-023 | `prototype-v50/manifest.json#sha256` | Owner / Telemed summary | `#telemed-summary` → `/owner/telemed/:id/summary` | completed row inside `OwnerTelemedPage` | `OWNER`; telemed own read | completed session/recommendation | follow-up action as defined | L/Ø/E/O/T; COMPLETED, failed | D/T/M | MISSING | required summary/document E2E | MODIFY | DISCOVERY / summary contract |
| CLN-001 | `prototype-v50/manifest.json#sha256` | Clinic/Vet / Workspace home | `#clinic-workspace` → current `/clinics/:clinicId/locations/:locationId` | backend projection plus default-off scoped Portal page/BFF implemented; product disposition `RETAINED_FOUNDATION / NOT_PRIMARY_MVP_HOME` | exact active clinic/location membership remains backend authority; Portal session/scope is presentation fencing | strict bounded Queue + Appointments summaries; Schedule/Veterinarian/Quality no-facts states; no identifiers | closed Queue/Appointments scoped links only for `AVAILABLE` | loading/empty/role/degraded/retry/stale-retained/forbidden and authority-loss purge tested | 375/412/768/1440, keyboard, axe, 200%, reduced motion and forced colors evidenced | `CLINIC_V50_WORKSPACE_HOME`, default off, depends on `PORTAL_V50_SHELL`; absent-route rollback | backend PostgreSQL/performance plus Portal parser/BFF/full E2E/live-stack and independent reviews PASS | BACKEND_FOUNDATION_IMPLEMENTED / TESTED; PORTAL_FOUNDATION_IMPLEMENTED / TESTED | RETAINED_FOUNDATION / NOT_PRIMARY_MVP_HOME; bounded evidence retained; possible `/overview` move is future work |
| CLN-002 | `prototype-v50/manifest.json#sha256` | Clinic / Schedule | `#clinic-schedule` → `/clinics/:clinicId/locations/:locationId/schedule` | `ClinicScheduleClient` in V50 reception frame | admin/reception; `schedule.read/manage` | schedule slots/snapshot | hours, services, staff, resources, periods, slots, import/export | L/Ø/E/C; open/blocked/booked/telemed | D/T/M shell tested | `PORTAL_V50_SHELL` + V51 fallback; read capability | schedule capability/full Playwright/build PASS; shell screenshot updated | REUSE | DISCOVERY / screen content visual acceptance remains |
| CLN-003 | `prototype-v50/manifest.json#sha256` | Vet / Visit workspace | `#clinic-visit` → `/clinics/:clinicId/locations/:locationId/vet/visits/:holdId` | bounded vet routes in role-aware V50 veterinarian frame | clinic veterinarian; `clinical.visit.workspace.read/complete` | vet visit list/detail | complete; full draft/sign/amend absent | L/E/C/T; confirmed, in-visit, completed, immutable/amend | D/T/M shell tested | `PORTAL_V50_SHELL` + V51 fallback; additive reads | veterinarian and multi-role capability/scope behavior PASS in full 95/95 | MODIFY | DISCOVERY / clinical model and content visual acceptance |
| CLN-004 | `prototype-v50/manifest.json#sha256` | Clinic / Appointments | `#clinic-appointments` → scoped `/appointments` and nested `/:appointmentId` | default-off registry and administrative detail are implemented end to end; Queue unchanged | admin/reception `appointment.registry.read`; active exact clinic/location backend authority; Portal effective-capability/scope fence | list/detail scoped Portal BFF → canonical backend GETs | list/detail read-only; detail actions empty; Queue and clinical commands remain separate | list and detail loading/no-leak/error/degraded/unknown/nullability states implemented | D/T/M screenshots, keyboard, axe and 200% text evidenced | existing registry flag reused for list/detail page+BFF/backend | Portal detail Chromium 23/23 + rollback 1/1; backend detail 13/13 and registry 27/27; OpenAPI/migrations unchanged | MODIFY | DETAIL_END_TO_END_IMPLEMENTED / ADMINISTRATIVE_MUTATIONS_AND_HISTORY_NOT_IMPLEMENTED |
| CLN-005 | `prototype-v50/manifest.json#sha256` | Clinic / Patients | `#clinic-patients` → `/clinics/:clinicId/locations/:locationId/patients` | registry/detail and exact-scope alias backend/Portal workflow implemented; structured reference is contract-only | read uses `patient.admin.read`; local-profile write uses `patient.admin.local-profile.update`; owner corrections and clinical access separate | signed read snapshot plus current privacy override; versioned clinic-local alias projection; owner master unchanged | read/navigation and alias set/replace/clear implemented; reference backend, create/import/lifecycle absent | read states plus alias mutation no-leak/version/idempotency/error matrix PASS | responsive read and alias editor evidence PASS | existing Patients read flag plus independent default-off mutation flag | alias backend 12/12; capability 35/35; focused alias Chromium 7/7; Detail/Registry/rollback/build/parser PASS | MODIFY | LOCAL_ALIAS_END_TO_END_IMPLEMENTED / REFERENCE_CONTRACT_ONLY / OTHER_MUTATIONS_EXCLUDED |
| CLN-006 | `prototype-v50/manifest.json#sha256` | Clinic/Vet / Patient detail | `#clinic-patient` → scoped `/clinics/:clinicId/locations/:locationId/patients/:patientId` | administrative backend GET, scoped Portal page/BFF, strict parser, Registry navigation and local alias workflow implemented; clinical record separate | admin read uses `patient.admin.read`; local alias write is separately flag/capability guarded; exact current association required | safe pet/relationship/bounded appointment projection plus exact-scope alias/version/timestamp; owner contacts and all clinical/document/financial fields excluded | read detail and alias set/replace/clear implemented; structured reference backend and clinical draft absent | no-leak, technical, malformed, revoke-refresh, absent/cleared alias, mutation retry/conflict and degraded states pass | responsive detail/editor, keyboard and accessibility evidence PASS | Patients read flag; alias read independent of mutation flag; writes default off | backend detail 11/11 + Registry 8/8; Portal parser 3/3; focused alias Chromium 7/7; Node 22 typecheck/build PASS | MODIFY | ADMIN_DETAIL_AND_ALIAS_END_TO_END / REFERENCE_CONTRACT_ONLY / CLINICAL_POLICY_SEPARATE |
| CLN-007 | `prototype-v50/manifest.json#sha256` | Clinic/Vet / Telemedicine | `#clinic-telemed` → scoped `/telemed` plus `/telemed/vet` | clinic telemed route and platform vet route exist, ownership split | clinic dispatcher vs assigned telemed vet | vet queue/workspace/audit; clinic projection partial | assign/start/connect/workspace update | L/Ø/E/C/T; scheduled, waiting, assigned, in-call, completed, failed | D/T/M | telemed capability flags + shell | clinic telemed 15/15, audit 6/6 historical | MODIFY | DISCOVERY / target ownership |

## Clinic MVP1 booking-journal reset

Initial MVP1-02 owner review was `CHANGES_REQUESTED`. The bounded MVP1-02-R1 repair now has `INTERNAL_REPAIR_REVIEW_PASS / PRODUCT_OWNER_REVIEW_PENDING`: readability, useful viewport height, drawer actions, manual validation, calendar-derived alternatives, viewport-driven mobile agenda and the seven-day time×day Week journal are evidenced. Runtime remains not started.

R2 owner review remained `CHANGES_REQUESTED_R2`. The bounded R2 repair cache-busts prototype assets, proves the dedicated Week alternative URL, expands the week to an operational 11-event load view, keeps alternative context above the full-width calendar, removes compact Day-card clipping and normalizes form/toolbar/close-control geometry. Status is `R2_INTERNAL_REPAIR_PASS / PRODUCT_OWNER_REVIEW_PENDING`; runtime remains unchanged.

R2 owner review subsequently remained `CHANGES_REQUESTED` because mobile did not meet the product-quality bar. R3 resets the phone presentation as a standalone CRM: Today agenda, four task destinations, request-first detail/sticky actions, mobile-only alternative recommendations, three-step booking, separate quick-client flow and bounded Clients/More screens. The 53-state manifest, 8-viewport matrix, 42 screenshots, 3 MOV recordings and 7 contact sheets pass locally; independent Product/CRM, Mobile UX and Accessibility reviews have no remaining vetoes. Status is `R3_INTERNAL_REVIEW_PASS / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED`; PR #70 remains on the published R1 head.

R3 owner review remained `CHANGES_REQUESTED` because breakpoint presentations did not read as one CRM, mobile calendar search/filter was incomplete, and the tablet filter rail compressed. R4 makes the desktop navy/blue language canonical through shared tokens, typography, outline SVG icons, statuses and actions. Wide desktop alone retains a 232px filter rail; compact desktop/tablet use a 72px navy rail plus overlay filters/detail; mobile retains the agenda with full-screen shared search/filter tasks. The 70-state, 10-viewport, 40-screenshot and six-contact-sheet gate passes with independent Design-System, CRM UX and Responsive approval. Status is `R4_INTERNAL_REVIEW_PASS / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED`.

These rows register contract decisions only. `CONTRACT_READY` does not claim runtime, test, visual, rollout, or UAT completion.

| V50 ID | Target | Canonical route / authority | Decision | Status |
|---|---|---|---|---|
| CLN-MVP1-001 | Journal shell | canonical scoped root; exact membership/location and capability-filtered navigation | Prototype proves journal-first shell; Workspace Home retained | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-002 | Day calendar | future journal projection date/day boundary authority | R2 proves full-height internally scrollable 08:00–20:00 grid with zero clipped appointment cards | R2_UX_REPAIR_READY / PRODUCT_OWNER_REVIEW_PENDING / RUNTIME_NOT_STARTED |
| CLN-MVP1-003 | Pending SLA bar | server timestamps/clock; one shared Portal timer | Prototype normal/due/overdue/zero-pending non-color model | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-004 | Entry detail drawer | capability-filtered bounded journal entry | R1 proves 420–460px/overlay/full-screen detail, independent body scroll and always-visible pending actions | UX_REPAIR_READY / PRODUCT_OWNER_REVIEW_PENDING / RUNTIME_NOT_STARTED |
| CLN-MVP1-005 | Confirm request | existing clinic hold confirm authority | Two-interaction simulated flow; runtime invariants remain contract-only | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-006 | Reject request | existing decline/release requires semantic repair | Simulated reason/confirmation; no runtime mapping claim | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-007 | Alternative slot | existing clinic alternative command; owner decides separately | R1 selects from visible journal availability and preserves explicit old/new review | UX_REPAIR_READY / PRODUCT_OWNER_REVIEW_PENDING / RUNTIME_NOT_STARTED |
| CLN-MVP1-008 | Manual booking | no proven manual appointment command | R1 large form, client result, bounded slot, service price and disabled-invalid submit prove UX only; backend remains MISSING | UX_REPAIR_READY / PRODUCT_OWNER_REVIEW_PENDING / RUNTIME_NOT_STARTED |
| CLN-MVP1-009 | Requests registry | current scoped Queue / `booking.queue.read` | Target navigation/request states represented | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-010 | Appointments registry | current Registry/detail / `appointment.registry.read` | Confirmed/history context represented | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-011 | Clients registry | current Patients / `patient.admin.read` | Search/navigation product model represented without UUIDs | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-012 | Client detail | current safe Patients detail and separate alias capability | Safe synthetic client/pet presentation represented | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-013 | Staff | target `/staff`; dedicated capability/API missing | Admin-only target navigation and staff columns represented; authority still missing | UX_PROTOTYPE_READY / RUNTIME_NOT_STARTED |
| CLN-MVP1-014 | Working hours | existing Schedule operations under current guards | R2 seven-day 08:00–20:00 Week calendar exposes 11 duration blocks, load summary, break/closed time and three bounded alternative slots | R2_UX_REPAIR_READY / PRODUCT_OWNER_REVIEW_PENDING / RUNTIME_NOT_STARTED |
| CLN-MVP1-015 | Responsive CRM | same authoritative journal projection/order | R5-A adds one Day/Week/List shell and centralized role-capability presentation: reception/admin/veterinarian/multi-role expose distinct navigation and actions without claiming security enforcement | R5_A_ROLE_SHELL_READY / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED / RUNTIME_NOT_STARTED |

## Complete source state inventory (41)

The inventory is generated from `state:`/`status:` values, status assignments/comparisons, and state/status/demo data attributes in the actual HTML and its 12 linked local scripts.

| Domain mapping | Exact source tokens |
|---|---|
| Booking/appointments | `ALTERNATIVE_PROPOSED`, `CLINIC_CANCELLED`, `CONFIRMED`, `MANUAL_CONFIRM_PENDING`, `SLOT_TAKEN`, `booking-review`, `hold`, `new`, `booked`, `confirmed`, `cancelled`, `expired`, `checkedin`, `in-visit`, `done` |
| Telemedicine | `INTAKE`, `PAYMENT_PENDING`, `WAITING_DOCTOR`, `DOCTOR_JOINED`, `IN_CALL`, `COMPLETED`, `waiting`, `scheduled`, `telemed`, `telemed-wait`, `in-call`, `completed`, `cancelled`, `offline` |
| Insurance | `NOT_CHECKED`, `CHECK_PENDING`, `NEEDS_DOCUMENTS`, `active`, `none`, `expired`, `unsupported-species`, `insurance-none` |
| Emergency/safety | `emergency`, `needs-route` |
| Clinic schedule/operations | `open`, `blocked`, `booked`, `needs-info` |
| Accessibility scenario | `accessibility` |

Tokens shared between groups are counted once; exact unique total is 41. Static tokens do not prove production state-machine parity.

## Responsive variants

The authoritative source contains CSS contracts for:

- mobile breakpoints from 420–768px;
- tablet ranges around 701/761/768–1080/1120px;
- desktop minimums at 961/1121px;
- `prefers-reduced-motion` and print modes.

Required acceptance viewport matrix remains `1920×1080`, `1440×900`, `1024×768`, `768×1024`, `375×812`, `412×915`. No row is visually verified in this register.

## Program blockers and evidence

| Blocker | Evidence | Effect | Resolution gate |
|---|---|---|---|
| `AUTHORITATIVE_SOURCE_CONFIRMED` | product owner clarification plus verified manifest/checksum | source gate is OPEN; does not raise runtime/visual statuses | keep manifest verification green when prototype files change |
| Missing owner comparison/doctor contracts | runtime routes/components/API absent | blocks OWN-003/018/019 | public bounded read models and privacy/product decisions |
| Missing notifications/profile settings | no repository/API or complete cross-platform route | blocks OWN-015/016 | owner settings/session contract |
| Missing clinic patient authority | no category/assignment-scoped read/write APIs | blocks CLN-005/006 | ADR/TDS plus deny/no-leak/read-audit matrix |
| Incomplete clinical record model | bounded visit completion exists; draft/sign/amend semantics absent | blocks full CLN-003 parity | additive clinical model and veterinarian-only invariants |

## V50-SHELL-01 evidence boundary

Shell structure, navigation selection, role/capability visibility, responsive modes and shell states passed automated and screenshot validation. Evidence is stored outside Git at `/tmp/v50-shell-evidence/`. That shell-only gate did not certify business content, so its closure counter was `0/30`; the current program counter is recorded above.

## Next update rule

When any prototype file changes, regenerate the manifest, rerun inventory verification, diff screen/route/state identities, and update affected evidence before implementation continues. `V50-OWNER-03` package `v50-owner-03-dc762b4` passed the final independent gate with zero vetoes; `OWN-002`, `OWN-004`, `OWN-018` and `OWN-019` are `VISUALLY_VERIFIED` and the counter is `7/30`. Doctor integration is ready, but production rollout remains blocked by `PUBLIC_DOCTOR_PROFILE_CONSENT_CONTRACT_MISSING`.
## V50-CLINIC-04F — Clinic-local alias Portal workflow

- Existing Patient Detail now distinguishes official name from clinic-local
  alias and exposes a compact accessible editor only under the mutation flag
  and effective write capability.
- Exact-scope concurrency, idempotency, validation, conflict refresh, no-leak
  denial and last-valid-snapshot behavior are covered by focused Portal tests.
- No Owner Mobile, Registry mutation, backend, migration, role, state-machine,
  Queue, booking or clinical scope was added.

## V50-CLINIC-04G — Structured administrative reference contract

- Contract complete: one nullable, implicit-`CLINIC_MANUAL`, exact-location
  structured reference in the shared clinic-patient local-profile aggregate.
- The contract fixes format/normalization, location-local uniqueness, bounded
  reference route, capability/flag reuse, shared concurrency, scoped
  idempotency, no-raw-value audit, lifecycle/no-leak and future exact-search
  boundaries.
- Documentation only: no backend, migration, OpenAPI, Portal, Registry,
  capability/flag runtime or tests changed. The reference is neither a
  medical-record number nor a global/owner-visible identifier.

## V50-CLINIC-04H — Structured administrative reference backend

- Additive reversible storage, pinned Unicode 17.0.0 normalization,
  exact-location uniqueness and bounded set/replace/clear are implemented on
  the existing shared local-profile aggregate.
- Patient Detail/OpenAPI expose the required nullable reference; the strict
  Portal parser is compatible without a rendered UI change.
- Authority, default-off flag, strong version, idempotency, collision
  normalization and no-raw-value audit/outbox reuse the proven alias boundary.
- Registry DTO/search, Portal reference workflow, Owner, Queue, booking,
  clinical and integration scopes remain unchanged.

## V50-CLINIC-04I — Structured administrative reference Portal

- Existing Patient Detail displays the location-scoped internal number
  separately from official name and clinic-local alias.
- Capability/flag-gated set, replace and explicit clear use the shared
  local-profile version, one pending lock and scoped retry-safe idempotency.
- Collision, stale refresh, authority/no-leak, technical snapshot retention,
  malformed-success rejection, keyboard, accessibility and responsive states
  have focused Portal coverage.
- Registry DTO/search and all backend/runtime contracts remain unchanged.

## V50-CLINIC-04J — Administrative reference Registry search contract

- Documentation fixes an exclusive exact-normalized filter on the existing
  exact-location Registry route; no separate or global lookup authority exists.
- Current Registry visibility is established before reference matching.
  Unknown, foreign, revoked, archived and privacy-ineligible values are
  indistinguishable empty results.
- Future Registry items add only nullable display reference. The existing
  scoped unique comparison-key index, canonical envelope, 0..1 cardinality,
  no-cursor rule, safe telemetry and a dedicated default-off flag are fixed.
- No backend, migration, OpenAPI, Portal, runtime flag, test or package changed.

## V50-CLINIC-04K — Administrative reference Registry search backend

- The existing Registry route implements exclusive exact normalized reference
  search behind a dedicated default-off flag; ordinary Registry behavior is
  unchanged when the flag is off.
- Authority/current visibility and exact clinic/location scope constrain the
  existing indexed comparison-key lookup. Unknown and inaccessible matches are
  identical empty envelopes; corrupt duplicate results fail closed.
- Registry/OpenAPI items require nullable display reference and never expose
  the comparison key. The canonical envelope has 0..1 items and no cursor in
  exact mode.
- Focused PostgreSQL/HTTP, rollback, regression, EXPLAIN, strict Portal parser
  and Node 22 typecheck gates cover the implementation without a migration or
  rendered Portal search UI.

## V50-CLINIC-04L — Administrative reference Registry search Portal

- Existing Patients Registry has an explicit, independently flag-gated
  **Внутренний номер** mode; ordinary name search remains the default.
- Exact search is submit-only, current-location scoped and sends no ordinary
  query or cursor. NFC/trim/space normalization preserves display case.
- Canonical one-item and neutral empty states, authority no-leak, last-valid
  technical snapshot, explicit retry, clear, scope change and stale-request
  fencing have focused deterministic coverage.
- Keyboard/focus, axe and 1440/1024/390 responsive proofs pass. No backend,
  migration, autocomplete, prefix/global search or Patient Detail change is
  introduced.

## V50-CLINIC-04M — Reference search operational hardening contract

- Threats are bounded to authenticated exact-location enumeration, sustained
  query load, sensitive telemetry, plan regression, rollout and support.
- Production requires separate replica-safe 20/minute and 200/hour configurable
  actor/location exact-search windows; aggregate location protection is
  alert-first pending traffic evidence.
- Metrics/traces use fixed low-cardinality outcomes. Raw/display/normalized
  references, comparison keys, URLs and fingerprints are not retained.
- Controlled thresholds, 10k/100k fixture tiers, semantic JSON EXPLAIN guard,
  rollout stages, rollback, alerts, diagnostics and incident runbook are fixed.
- Runtime remains unchanged. `V50-CLINIC-04M-R1` separates strict
  database-time logical expiry (maximum 65 minutes) from a healthy-worker
  physical deletion target (maximum 24 hours). Indexed bounded startup and
  periodic cleanup uses the existing application maintenance mechanism;
  consume correctness never depends on deletion.
- The one next slice is `V50-CLINIC-04N-A`, the bounded PostgreSQL shared
  limiter foundation. Product endpoint integration remains out of scope.

## V50-CLINIC-04N-A — Shared PostgreSQL rate limiter foundation

- An additive table and shared Nest module provide atomic fixed-window
  PostgreSQL counters across backend replicas, with database-time eligibility
  and fail-closed typed errors.
- Strict logical expiry remains at most 3,900 seconds and is independent of
  cleanup. Indexed startup/periodic cleanup deletes at most 1,000 expired rows
  per transaction toward the healthy-worker 24-hour physical target.
- Aggregate telemetry excludes limiter identity and search data. Focused
  PostgreSQL concurrency, cleanup, migration, configuration and lifecycle
  proofs cover N-01..N-30 and R-01..R-14.
- The foundation is not connected to the Registry endpoint. The one next slice
  is `V50-CLINIC-04N-B`.

## V50-CLINIC-04N-B — Registry shared rate limiter integration

- Exact administrative-reference search now consumes the shared PostgreSQL
  limiter after authority, exact scope, feature and request validation and
  before visibility/reference lookup.
- Typed short/sustained defaults are 20/60 seconds and 200/3,600 seconds.
  Safe 429 responses use database-derived `Retry-After`; infrastructure
  failures fail closed with the existing safe policy-unavailable response.
- Shared enforcement is invoked once across replicas. The process-local
  counter is no longer part of exact-reference decisions and remains only for
  ordinary `q` search.
- Focused PostgreSQL tests prove authority ordering, thresholds, durable
  denial, actor/location isolation, two-instance concurrency with zero
  over-admission, privacy, no domain side effects and ordinary Registry /
  Patient Detail isolation.
- Status is `PASS / COMPLETE`. 04N remains open for operational evidence. The
  one next slice is
  `V50-CLINIC-04N-C / Registry Reference Search Operational Evidence Closure`.

## V50-CLINIC-04N-C — Registry reference operational evidence closure

- Status is `PASS / COMPLETE`. Redacted access logging, bounded
  low-cardinality telemetry, alert definitions and the 10k PR / 100k nightly
  semantic-plan cadence are implemented.
- The failing 100k plan was an external-merge `Sort` over 50,000 snapshot
  revisions (4,408 kB disk, 551 temp blocks read, 552 written) before the exact
  reference predicate discarded 49,999 rows.
- Scoped candidate selection now occurs before snapshot sorting via
  `clinic_patient_local_profiles_reference_location_key`. No index migration,
  memory tuning, authority change or visibility relaxation was introduced.
- Canonical PostgreSQL 16.14 evidence with `work_mem=4MB` passes at both tiers:
  10k p95/p99 20.578/22.571 ms and 100k p95/p99 14.971/15.898 ms; cardinality is
  one, local-profile sequential scans and temp spill are zero in three
  repeated JSON EXPLAIN measurements.
- Rollback-based fixture teardown is failure-safe and bounded. Reserved
  cleanup is `0|0|0|0`; measured 100k build/cleanup is
  70,764.024/40.045 ms.
- Parent `V50-CLINIC-04N` may be closed. Production rollout remains
  `NOT_STARTED`.

## V50-CLINIC-MVP1-02-R5-B parity note

Prototype parity now includes action-first SLA/queue presentation, clean mobile decision detail, distinct primary/secondary/destructive hierarchy, submitting/readback/conflict/stale states and veterinarian read-only context. Evidence `V50-CLINIC-MVP1-02-R5-B-RESPONSIVE` is 216/216 PASS. SLA ordering and readback remain deterministic prototype presentation; runtime/backend are unchanged.

## V50-CLINIC-MVP1-02-R5-C parity note

Prototype parity now includes one contextual booking draft across global, free-slot, client and request entry; desktop/tablet and three-step mobile presentation; validation/submitting/readback/conflict/terminal states; capability-filtered entry; canonical calendar/free-slot semantics; and keyboard/focus/reduced-motion behavior. Evidence `V50-CLINIC-MVP1-02-R5-C-RESPONSIVE` is 299/299 PASS across 10 viewports and 4 roles. Creation and readback remain deterministic prototype presentation; backend/runtime authority is unchanged. The one next slice is `V50-CLINIC-MVP1-02-R5-D / Views, filters and communication`.

## 2026-09-21 — OWN-002 Owner Catalog server-search closure

Product Owner explicitly amended S09 to add server-side search; the original
S09 revision did not include it. Contract:
`docs/v50/OWNER-V50-CATALOG-SEARCH-CONTRACT.md`.

| V50 screen | Runtime route | Mismatch | Classification | Fix | Evidence |
|---|---|---|---|---|---|
| `#catalog` search panel | `/` → `ClinicCatalogScreen` | V50 search previously filtered only the already bounded client snapshot, then was removed because Owner API had no query | `CONTRACT_DELTA` resolved | Optional server `q`, normalized name/address predicate before `LIMIT 50`; input, Enter and separate CTA restored | Backend unit `3/3`, focused PostgreSQL `1/1`, HTTP `1/1`; Owner adapter `3/3`, screen `12/12`, Web bridge/client `10/10` |
| `#catalog` responsive search | same | Search result state required equal viewport proof | `VISUAL_DEFECT` resolved | Desktop inline input/CTA and mobile stacked controls use existing tokens; no overflow and targets >=44 | `docs/ai/artifacts/owner-v50-catalog-live-closure/` at 390x844 and 1440x900 |
| `#catalog` clinic cards | same | V50 shows media, rating, distance, price and nearest slots unavailable in Owner list DTO | `DATA_GAP` | Omit unsupported facts; retain one `Посмотреть услуги` CTA and exact clinic/location handoff | Live search → result → service selection PASS at both viewports |
| `#catalog` filters | same | V50 presents distance/date/24x7/specialty/species/insurance/price controls without current Owner authority | `DATA_GAP` | Render only authoritative `Онлайн-запись` and name/address search | OpenAPI optional `q` PASS; unsupported controls absent |

Acceptance: `CATALOG_SEARCH_CONTRACT=PASS`, `CATALOG_SERVER_SEARCH=PASS`,
`CATALOG_SEARCH_BEFORE_LIMIT=PASS`, `CATALOG_ELIGIBILITY_PRESERVED=PASS`,
`CATALOG_OWNER_SEARCH=PASS`, `CATALOG_CLINIC_HANDOFF=PASS`,
`CATALOG_RESPONSIVE=PASS`, `CATALOG_ACCESSIBILITY=PASS`,
`CATALOG_RUNTIME_ERRORS=0`, `CATALOG_VISUAL_PARITY=PARTIAL` because the listed
non-search data gaps remain.

## 2026-09-17 — OWN-001 Owner Home parity restoration

| V50 screen | Runtime route | Component | Confirmed mismatch | Severity | Fix | Evidence |
|---|---|---|---|---|---|---|
| `prototype-v50/index.html#home` | `/` | `OwnerHome` / `SearchHero` | Banner-led hero and generic stacked paths displaced the V50 search-led decision composition | Critical | Restored search-led title/control and the V50 desktop action rail/mobile action stack with only current-Pilot routes | `docs/ai/evidence/v50-ui-parity-restoration/` |
| `#home` | `/` | `OwnerHome` | `ImmediateValue` separated the hero from authoritative Pet/next-care context | High | Moved the strip below Pet/next-care so the V50 decision → care hierarchy is preserved | same package |
| `#home` | `/` | Home shell | Full-width desktop shell and tall mobile chrome changed the reference geometry | High | Bounded desktop shell to the V50 1120px rail and reduced mobile header height while preserving logout and four truthful routes | same package |

`OWN-001_VISUAL_PARITY=PARTIAL`; the earlier visual PASS is withdrawn after
direct review of the stored 390×844 and 1440×900 pairs. Functional parity,
responsive execution, touch-target and runtime-error evidence remain PASS.

| Classification | Remaining mismatch in the stored pair | Required disposition |
|---|---|---|
| `VISUAL_DEFECT` | Search control and CTA are merged; action substitutions, Pet card, next-action card and mobile navigation differ materially in geometry/hierarchy | Repair and recapture |
| `APPROVED_PILOT_DELTA` | Emergency and telemedicine actions are excluded by `PILOT_V1` | Preserve the exclusion and identify it explicitly |
| `DATA_GAP` | Owner display name/time greeting, Pet photo, breed/age/weight and a real upcoming booking are not present in the current Home projection | Use neutral/fallback design-system states; never fabricate |
| `UNRESOLVED` | None at repair start | — |

### Repair closure

| Classification | Final result |
|---|---|
| `VISUAL_DEFECT` | Closed: standalone search field and CTA, V50 hero/action geometry, mobile topbar and navigation order, desktop media/copy Pet Card, and text-first nearest-action card are restored. |
| `APPROVED_PILOT_DELTA` | Preserved and visible: the two excluded emergency/telemedicine cards are represented by truthful Pilot clinic/time paths in the same action-rail geometry; this is not literal prototype content identity. |
| `DATA_GAP` | Remains open: neutral greeting, large no-photo placeholder, available species only and server-authored next action are truthful fallbacks, but the prototype has no equivalent state for an identical-state pair. |
| `UNRESOLVED` | Product/UX must decide whether the truthful no-photo / no-active-booking Home state is an accepted parity variant or requires a new canonical V50 state. |

Final verdict: `OWN-001_VISUAL_PARITY=PARTIAL`. The repair closes the confirmed
presentation defects, but the required identical-state comparison cannot be
produced from the current fixed prototype without fabricating runtime data.
Functional parity remains PASS. Evidence:
`docs/ai/evidence/v50-home-parity-repair/`.

Source audit confirms the blocker: `v47-test-fixtures.js` has no Home fixture
for one Pet + no photo + no active booking, and the canonical `#home` markup
hard-codes both the Barney media treatment and a confirming appointment.

## 2026-09-21 — OWN-003 Clinic Detail → Service → Availability

| V50 screen | Runtime route | Component | Mismatch | Classification | Fix / disposition | Evidence |
|---|---|---|---|---|---|---|
| `#clinic` | Catalog handoff | `ClinicServiceScreen` | Selected clinic identity was duplicated and one copy used a generic reference interior unrelated to the selected clinic | `VISUAL_DEFECT` | One authoritative identity/location/phone/facts panel; generic image removed | Fresh mobile/desktop runtime captures and live clinic/location response |
| `#clinic` services | same | `ClinicServiceScreen` | V50 assumes duration, add-on, clinic media/capabilities/reviews and doctor-bound selection beyond current DTO/handoff | `DATA_GAP` / `UNRESOLVED` | Render active services, informational price and truthful doctor discovery only; exact service handoff revalidated | Focused Jest plus live service → availability transition |
| `#booking` | Service handoff | `AvailabilityScreen` | V50 includes demo pet/insurance/photo/cost composition; runtime slot radio missed explicit web `aria-checked` | `APPROVED_PILOT_DELTA` / `DATA_GAP` / resolved accessibility defect | Preserve Pilot composition and server-authored local slots; add explicit radio state | Axe, >=44px targets, no overflow, authoritative availability response |
| `#booking` continuation | Availability handoff | `AvailabilityScreen` → pet/review flow | Exact slot/version must survive handoff | Functional contract | Revalidate and forward existing clinic/location/service/slot/version tuple | Live `Кого записываем?` transition at 390x844 and 1440x900 |

Acceptance: `CLINIC_DETAIL=PARTIAL`, `SERVICE_SELECTION=PARTIAL`,
`AVAILABILITY=PARTIAL`, `BOOKING_HANDOFF=PASS`, `VISUAL_PARITY=PARTIAL`,
`RESPONSIVE=PASS`, `ACCESSIBILITY=PASS`, `RUNTIME_ERRORS=0`. Evidence:
`docs/ai/artifacts/owner-v50-clinic-service-parity/`. Partial statuses reflect
the explicit data/contract/Pilot gaps above; no unsupported values or media
were fabricated.

## 2026-09-21 — OWN-018 Doctor booking continuity

| V50 screen | Runtime route/component | Mismatch | Classification | Disposition | Evidence |
|---|---|---|---|---|---|
| `#doctor-select` | `ClinicServiceScreen` doctor discovery | V50 selects a named doctor; Pilot runtime exposes the same identity class as read-only clinic/location discovery | `APPROVED_PILOT_DELTA` / `CONTRACT_DELTA` | Do not add a selectable control without a Product/API amendment | Live four-doctor response; zero doctor button/radio controls |
| `#booking` | `AvailabilityScreen` | V50 availability is downstream of selected doctor; Owner availability is service-scoped and intentionally omits doctor/staff fields | `CONTRACT_DELTA` | Preserve authoritative slot/version; server retains slot doctor binding | Live service/slot response plus PostgreSQL slot inspection |
| Booking command/read | `BookingReviewScreen` / Booking Core | Pilot command rejects `doctorId`; hold read derives doctor from locked slot | `APPROVED_PILOT_DELTA` | No navigation/adapter repair is valid under the current closed six-field body | Controller/DTO and slot identity trace |

`DOCTOR_SELECTION_CONTRACT=VERIFIED`,
`DOCTOR_SERVICE_COMPATIBILITY=PASS`, `DOCTOR_AVAILABILITY=PASS`,
`BOOKING_IDENTITY_CONTINUITY=DOCUMENTED_SCOPE_GAP`,
`VISUAL_PARITY=PARTIAL`, `RESPONSIVE=PASS`, `ACCESSIBILITY=PASS`,
`RUNTIME_ERRORS=0`. The exact residual requirement is a Product-approved
doctor-selection contract spanning doctor/service compatibility, filtered
availability and Booking input. Evidence:
`docs/ai/artifacts/owner-v50-doctor-booking-continuity/`.

## 2026-09-22 — OWN-007/OWN-008 R2K live closure

| V50 screen | Runtime route/component | Live result | Classification | Evidence |
|---|---|---|---|---|
| `#appointments` | `OwnerBookingsScreen` | Authoritative active/history buckets open exact hold detail and refresh from server after cancellation | Functional parity `PASS`; visual `PARTIAL` | `bookings_before_*`, `bookings_after_*` |
| `#appointment-detail` eligible | `OwnerBookingDetailScreen` | Server status, pet/clinic/service/time/price/history and cancel authority render without raw enum/version | Functional parity `PASS`; visual `PARTIAL` | `eligible_detail_*` |
| cancellation confirmation | `ConfirmationModal` | Explicit destructive confirmation; controlled network failure keeps confirmed truth and retry | Functional parity `PASS` | `confirmation_*`, harness assertions |
| cancelled detail | same | Canonical command returns public `CANCELLED`; detail refetch renders `Отменена`; cancel action disappears | Functional parity `PASS` | `cancelled_detail_*`, replay `200`, stale `409` |
| terminal detail | same | Existing terminal booking never exposes cancellation | Functional parity `PASS` | `terminal_detail_*` |

Residual V50 differences are data/scope backed: clinic and pet photography,
richer appointment metadata and prototype-only actions are not present in the
authoritative Pilot detail DTO. They are omitted rather than fabricated.
`VISUAL_PARITY=PARTIAL` independently of functional closure.

`OWNER_BOOKING_DETAIL_LIVE=PASS`, `OWNER_CANCELLATION_LIVE=PASS`,
`OWNER_CANCELLATION_READBACK=PASS`,
`OWNER_CANCELLATION_R2J_REFRESH=PASS`,
`OWNER_CANCELLATION_TERMINAL_GUARD=PASS`,
`OWNER_CANCELLATION_STALE_SAFE=PASS`, `RESPONSIVE=PASS`,
`ACCESSIBILITY=PASS`, `RUNTIME_ERRORS=0`, `OWNER_V50_R2K_COMPLETE=YES`.
Persistent evidence: `docs/ai/artifacts/owner-v50-r2k-live/`.

## 2026-09-22 — OWN-007/OWN-008 appointments structural restoration

| V50 screen | Runtime component | Confirmed mismatch | Classification | Repair / disposition | Comparable evidence |
|---|---|---|---|---|---|
| `#appointments` | `OwnerBookingsScreen` | Desktop reused vertically stacked mobile cards across the content rail, weakening status/facts/action hierarchy | `STRUCTURAL_DEFECT` | Responsive desktop row with grouped content, status priority and fixed detail CTA; mobile remains stacked | `{prototype_appointments,bookings_before}_{mobile,desktop}.png` |
| `#appointments` | same | V50 includes clinic media and a separate quick-action rail unsupported by the Pilot projection/scope | `DATA_GAP` / `APPROVED_PILOT_DELTA` | Do not fabricate images or reintroduce telemedicine/emergency/insurance paths | same pair |
| `#appointment-detail` | `OwnerBookingDetailScreen` | Shared phone-width shell left excessive unused desktop space and flattened status/action/fact hierarchy | `STRUCTURAL_DEFECT` | Wide 1120px rail, status/action hero, responsive facts/history columns and mobile stacking | `{prototype_appointment-detail,eligible_detail}_{mobile,desktop}.png` |
| `#appointment-detail` | same | Prototype is pending confirmation and exposes richer management choices; live fixture is authoritative confirmed state | `UNRESOLVED` state comparability / `APPROVED_PILOT_DELTA` | Compare common structural regions only; retain server-authorized cancellation and omit unsupported actions | same pair plus structural harness assertions |
| both | same | Clinic/pet imagery and richer provider/service metadata are absent from current authoritative DTOs | `DATA_GAP` | Omit absent fields; no fake media or metadata | live runtime payload/render |

Acceptance: `MY_BOOKINGS_STRUCTURAL_PARITY=PARTIAL`,
`BOOKING_DETAIL_STRUCTURAL_PARITY=PARTIAL`, `FUNCTIONAL_REGRESSION=NONE`,
`RESPONSIVE=PASS`, `ACCESSIBILITY=PASS`, `RUNTIME_ERRORS=0`,
`VISUAL_PARITY=PARTIAL`. All confirmed data-independent layout defects are
closed; Partial records the remaining data, Pilot-scope and exact-state gaps.
Evidence: `docs/ai/artifacts/owner-v50-appointments-structural-parity/`.

## 2026-09-22 — OWN-007 My Bookings parity repair

| V50 area | Runtime component | Mismatch | Classification | Final disposition | Evidence |
|---|---|---|---|---|---|
| Active / History control | `OwnerBookingsScreen` | Server groups were rendered simultaneously instead of through the V50 switch | `STRUCTURAL_DEFECT` | Active maps only `REQUIRES_ACTION + ACTIVE`; History maps only `HISTORY`; selected tab has semantic accessibility state | `bookings_before_*`, `bookings_history_*`, 8 browser assertions per viewport |
| Booking card hierarchy | same | Clinic identity dominated; time, pet and status were less scannable and cards were taller than V50 | `STRUCTURAL_DEFECT` | Compact card prioritizes time/status/pet, then clinic/address and server presentation, with one detail CTA | mobile/desktop pairs |
| Desktop composition | same | No bounded secondary action area | `STRUCTURAL_DEFECT` / `APPROVED_PILOT_DELTA` | Primary list plus a catalog-only new-booking panel; no telemedicine/emergency/insurance actions | desktop pair |
| Service title and media | same | V50 cards include service and photography absent from the list DTO | `DATA_GAP` | Omitted; no inferred service or fake media | DTO inspection and runtime pair |
| Booking Detail history | `OwnerAppointmentsService.timeline` → `OwnerBookingDetailScreen` | Repeated public fallback text looked like possible UI duplication | Read-only verification | `REAL_EVENTS`: separate persisted audit/appointment-event rows; UI maps each returned row once | timeline SQL unions and detail mapper |

`MY_BOOKINGS_STRUCTURAL_PARITY=PASS`,
`BOOKING_HISTORY_DUPLICATION=REAL_EVENTS`,
`R2J_R2K_FUNCTIONAL_REGRESSION=NONE`, `RESPONSIVE=PASS`,
`ACCESSIBILITY=PASS`, `RUNTIME_ERRORS=0`, `VISUAL_PARITY=PARTIAL`.
Structural PASS covers data-independent composition; service/media gaps and
Pilot exclusions remain explicit. Evidence:
`docs/ai/artifacts/owner-v50-my-bookings-parity-repair/`.

## 2026-09-22 — OWN-008 Booking Detail structural closure

| Metric | Status | Evidence / residual |
|---|---|---|
| `BOOKING_DETAIL_STRUCTURAL_PARITY` | `PASS` | Existing `prototype_appointment-detail_{mobile,desktop}.png` ↔ `eligible_detail_{mobile,desktop}.png` pairs prove container, status/action hero, facts, history, responsive columns/stack and action placement |
| `EXACT_STATE_COMPARABILITY` | `NO` | Canonical prototype is `PENDING_CONFIRMATION`; authoritative rich-demo runtime is `CONFIRMED` |
| `REMAINING_STRUCTURAL_DEFECTS` | `NONE` | No data-independent mismatch remains in the evaluated regions |
| `DATA_GAPS` | Open | Clinic/pet media and richer provider/appointment metadata are absent from the detail DTO and remain omitted |
| `R2K_FUNCTIONAL_STATUS` | `UNCHANGED` | Existing R2K functional closure remains sticky; cancellation acceptance was not rerun |

Evidence: `docs/ai/artifacts/owner-v50-appointments-structural-parity/`.
Overall `VISUAL_PARITY=PARTIAL` remains independent from structural closure
because exact state comparability is unavailable and the listed DTO/Pilot gaps
remain.
