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

All rows below are anchored to the verified V50 source and common manifest SHA-256 `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`. Source registration sets no row above `DISCOVERY` or `CONTRACT_READY`; visual fidelity remains `0/30 VISUALLY_VERIFIED`.

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
| OWN-002 | `prototype-v50/manifest.json#sha256` | Owner / Catalog | `#catalog` → `/owner/catalog` | `PublicCatalogPage` | public/OWNER; public catalog read | clinics, locations, services, availability | none | L/Ø/E/O/C; filters, stale availability | D/T/M | MISSING | catalog widget/integration; `features/catalog` | REUSE | DISCOVERY / none |
| OWN-003 | `prototype-v50/manifest.json#sha256` | Owner / Clinic comparison | `#decision-comparison` → `/owner/catalog/compare` | absent | public/OWNER; target `catalog.compare.read` | comparison read model absent | none | L/Ø/E/O; selection limits | D/T/M | MISSING | required widget + API + E2E | MISSING | DISCOVERY / contract |
| OWN-004 | `prototype-v50/manifest.json#sha256` | Owner / Clinic details | `#clinic` → `/owner/clinics/:locationId` | drill-down inside `PublicCatalogPage`; no deep link | public/OWNER; public catalog read | clinic/location/services/availability | none | L/Ø/E/O; closed/unavailable | D/T/M | MISSING | catalog drill-down tests | MODIFY | DISCOVERY / route |
| OWN-005 | `prototype-v50/manifest.json#sha256` | Owner / Booking slot | `#booking` → `/owner/booking` | `BookingMarketplacePage` | `OWNER`; `booking.own.create` | slots, availability, hold read | `POST /v1/booking-holds` | L/Ø/E/C/O; hold, SLOT_TAKEN, expired | D/T/M | MISSING | booking marketplace/integration | REUSE | DISCOVERY / none |
| OWN-006 | `prototype-v50/manifest.json#sha256` | Owner / Booking review | `#booking-review` → `/owner/booking/review` | embedded submit flow; no recoverable route | `OWNER`; `booking.own.create` | selected slot/service snapshot | create hold/payment intent as applicable | L/E/C/O; booking-review, pending, idempotent submit | D/T/M | MISSING | required review/back/double-submit E2E | MODIFY | DISCOVERY / route |
| OWN-007 | `prototype-v50/manifest.json#sha256` | Owner / My bookings | `#appointments` → `/owner/bookings` | `OwnerAppointmentsPage` | `OWNER`; target `booking.own.read` | `GET /v1/owner/appointments` | none | L/Ø/E/O; active/history/action-required | D/T/M | MISSING | appointments widget/integration | REUSE | DISCOVERY / none |
| OWN-008 | `prototype-v50/manifest.json#sha256` | Owner / Booking detail | `#appointment-detail` → `/owner/bookings/:holdId` | `OwnerAppointmentDetailPage`; anonymous route | `OWNER`; booking own read/write | owner appointment detail, hold/events/alternative | release, cancellation request, payment | L/E/C/O/T; manual, alternative, confirmed, cancelled, expired | D/T/M | MISSING | detail/cancel/alternative tests | MODIFY | DISCOVERY / deep link |
| OWN-009 | `prototype-v50/manifest.json#sha256` | Owner / Pets | `#pets` → `/owner/pets` | flagged `OwnerPetsPage` | `OWNER`; owner-scoped read/write | `GET /v1/owner/pets` | create/edit/archive/restore | loading/empty/error/offline; active/selected | D/T/M | IMPLEMENTED / TESTED / VISUAL FAIL | focused/full Flutter + 12 runtime captures | REUSE | prototype title/insurance/current-care hierarchy missing |
| OWN-010 | `prototype-v50/manifest.json#sha256` | Owner / Pet profile | `#pet-profile` → `/owner/pets/:petId` | `OwnerPetProfileV50Page` | `OWNER`; ownership + If-Match | pet detail/document metadata | PATCH/archive/restore | ready/warnings/archived/conflict/session | D/T/M | IMPLEMENTED / TESTED / VISUAL FAIL | Flutter/backend + 16 runtime captures | MODIFY | prototype hero/broader grouped sections missing; raw OCR excluded |
| OWN-011 | `prototype-v50/manifest.json#sha256` | Owner / Pet Diary | `#diary` → `/owner/pets/:petId/diary` | `OwnerPetDiaryV50Page` | `OWNER`; pet/document isolation | authoritative diary + metadata + stream | none added | loading/empty/error/offline/filter/process/fail/preview unavailable | D/T/M | IMPLEMENTED / TESTED / VISUAL FAIL | Flutter/backend + 20 runtime captures | MODIFY | prototype lab dynamics/reminders lack bounded authority; safe PDF action present |
| OWN-012 | `prototype-v50/manifest.json#sha256` | Owner / Telemedicine | `#telemed` → `/owner/telemed` | `OwnerTelemedPage` | `OWNER`; target `telemed.own.read/create` | telemed cases/sessions | create intake/payment intent | L/Ø/E/C/O; intake/payment/queued/history | D/T/M | MISSING | telemed owner integration | MODIFY | DISCOVERY / none |
| OWN-013 | `prototype-v50/manifest.json#sha256` | Owner / Telemed waiting | `#telemed-wait` → `/owner/telemed/:id/wait` | `TelemedWaitingRoomPage` | `OWNER`; telemed participant | session read with server time/version | cancel, room-token | L/E/C/O/T; PAYMENT_PENDING, WAITING_DOCTOR, DOCTOR_JOINED, cancelled | D/T/M | MISSING | waiting-room/reconciliation tests | REUSE | DISCOVERY / none |
| OWN-014 | `prototype-v50/manifest.json#sha256` | Owner / Insurance | `#insurance` → `/owner/insurance` | `CoverageCheckPage` | `OWNER`; insurance own read/write | profiles, coverage checks | consent/revoke, create check | L/Ø/E/O/T; NOT_CHECKED, CHECK_PENDING, NEEDS_DOCUMENTS, active/expired/unsupported | D/T/M | MISSING | insurance widget/API tests | REUSE | DISCOVERY / none |
| OWN-015 | `prototype-v50/manifest.json#sha256` | Owner / Notifications | `#notifications` → `/owner/notifications` | snackbar only; no repository/API | `OWNER`; target `notification.own.read/manage` | absent | preferences absent | L/Ø/E/O; unread/read/preferences | D/T/M | MISSING | required API/widget/E2E | MISSING | DISCOVERY / contract |
| OWN-016 | `prototype-v50/manifest.json#sha256` | Owner / Profile-security | `#profile` → `/owner/profile` | iOS placeholder; Android absent | `OWNER`; `owner.self.read`, session revoke | `GET /v1/owner/me` | refresh/logout; settings absent | L/E/O/T; devices/sessions/logout | D/T/M | MISSING | auth/session + profile UI tests | MISSING | DISCOVERY / settings contract |
| OWN-017 | `prototype-v50/manifest.json#sha256` | Safety / Emergency | `#emergency` → `/emergency` | `EmergencyTriagePage` → `EmergencyPage` | public; verified emergency profile | triage/clinics/freshness | triage decision, route action; direct call | L/Ø/E/O/T; emergency, needs-route, safe fallback | D/T/M | MISSING | emergency integration/E2E | REUSE | DISCOVERY / none |
| OWN-018 | `prototype-v50/manifest.json#sha256` | Owner / Doctor select | `#doctor-select` → `/owner/doctors` | absent | public/OWNER; target `catalog.doctor.read` | public doctor list absent | select in booking draft | L/Ø/E/O; specialty/availability | D/T/M | MISSING | required API/widget/E2E | MISSING | DISCOVERY / API |
| OWN-019 | `prototype-v50/manifest.json#sha256` | Owner / Doctor detail | `#doctor-detail` → `/owner/doctors/:doctorId` | absent; DB table not publicly exposed | public/OWNER; target `catalog.doctor.read` | doctor detail absent | choose doctor | L/Ø/E/O; unavailable doctor | D/T/M | MISSING | required API/widget/E2E | MISSING | DISCOVERY / API |
| OWN-020 | `prototype-v50/manifest.json#sha256` | Owner / Alternative slot | `#alternative-slot` → `/owner/bookings/:holdId/alternative` | `AlternativeSlotPage` | `OWNER`; booking alternative own | alternative snapshot | accept/release with version/idempotency | L/E/C/O/T; ALTERNATIVE_PROPOSED, accepted, expired | D/T/M | MISSING | alternative widget/integration | REUSE | DISCOVERY / none |
| OWN-021 | `prototype-v50/manifest.json#sha256` | Owner / Telemed pre-check | `#telemed-check` → `/owner/telemed/:id/check` | intake validation only | `OWNER`; telemed participant | session/device-local state | consent/update; room-token later | L/E/O; permission denied, weak network, ready | D/T/M | MISSING | required device/network/consent tests | MODIFY | DISCOVERY / bounded contract |
| OWN-022 | `prototype-v50/manifest.json#sha256` | Owner / Telemed call | `#telemed-call` → `/owner/telemed/:id/call` | `TelemedLiveCallView` | `OWNER`; active participant | session + authoritative business state | room token; local media actions only | L/E/C/O/T; joining, IN_CALL, reconnecting, poor connection, cancelled | D/T/M | MISSING | LiveKit/reconnect/reconciliation tests | MODIFY | DISCOVERY / coverage |
| OWN-023 | `prototype-v50/manifest.json#sha256` | Owner / Telemed summary | `#telemed-summary` → `/owner/telemed/:id/summary` | completed row inside `OwnerTelemedPage` | `OWNER`; telemed own read | completed session/recommendation | follow-up action as defined | L/Ø/E/O/T; COMPLETED, failed | D/T/M | MISSING | required summary/document E2E | MODIFY | DISCOVERY / summary contract |
| CLN-001 | `prototype-v50/manifest.json#sha256` | Clinic/Vet / Workspace home | `#clinic-workspace` → scoped clinic root | role-aware V50 frame exists; dashboard read model absent | reception/admin/vet by server capabilities | queue/quality/shift projections fragmented | task commands by capability | L/Ø/E/C; shell loading/error/forbidden tested | D/T/M shell tested | `PORTAL_V50_SHELL` + V51 fallback | shell focused 14/14 including multi-role union; full Portal 95/95; viewport shell evidence | MISSING | DISCOVERY / dashboard/read models not certified |
| CLN-002 | `prototype-v50/manifest.json#sha256` | Clinic / Schedule | `#clinic-schedule` → `/clinics/:clinicId/locations/:locationId/schedule` | `ClinicScheduleClient` in V50 reception frame | admin/reception; `schedule.read/manage` | schedule slots/snapshot | hours, services, staff, resources, periods, slots, import/export | L/Ø/E/C; open/blocked/booked/telemed | D/T/M shell tested | `PORTAL_V50_SHELL` + V51 fallback; read capability | schedule capability/full Playwright/build PASS; shell screenshot updated | REUSE | DISCOVERY / screen content visual acceptance remains |
| CLN-003 | `prototype-v50/manifest.json#sha256` | Vet / Visit workspace | `#clinic-visit` → `/clinics/:clinicId/locations/:locationId/vet/visits/:holdId` | bounded vet routes in role-aware V50 veterinarian frame | clinic veterinarian; `clinical.visit.workspace.read/complete` | vet visit list/detail | complete; full draft/sign/amend absent | L/E/C/T; confirmed, in-visit, completed, immutable/amend | D/T/M shell tested | `PORTAL_V50_SHELL` + V51 fallback; additive reads | veterinarian and multi-role capability/scope behavior PASS in full 95/95 | MODIFY | DISCOVERY / clinical model and content visual acceptance |
| CLN-004 | `prototype-v50/manifest.json#sha256` | Clinic / Appointments | `#clinic-appointments` → scoped `/appointments` | queue route/commands; no full registry/detail route | admin/reception; booking queue/read/commands | booking queue, hold, replay/audit | confirm/decline/notes/alternative | L/Ø/E/C; new, confirmed, checked-in, done, SLA | D/T/M | queue/hold/replay capability flags | Queue 9/9, Inspector 7/7, Replay 7/7 historical | MODIFY | DISCOVERY / registry |
| CLN-005 | `prototype-v50/manifest.json#sha256` | Clinic / Patients | `#clinic-patients` → scoped `/patients` | absent | scoped clinic staff; target `patient.admin.read` | absent | create/update absent | L/Ø/E/C; search/no-result/restricted | D/T/M | MISSING | required privacy/API/UI tests | MISSING | DISCOVERY / sensitive-data contract |
| CLN-006 | `prototype-v50/manifest.json#sha256` | Clinic/Vet / Patient detail | `#clinic-patient` → scoped `/patients/:petId` | absent | category/assignment-scoped capabilities | absent clinical/admin projections | admin edits or clinical draft by separate capability | L/Ø/E/C/T; allergy warning, restricted sections, audit | D/T/M | MISSING | required no-leak/read-audit/E2E | MISSING | DISCOVERY / authority model |
| CLN-007 | `prototype-v50/manifest.json#sha256` | Clinic/Vet / Telemedicine | `#clinic-telemed` → scoped `/telemed` plus `/telemed/vet` | clinic telemed route and platform vet route exist, ownership split | clinic dispatcher vs assigned telemed vet | vet queue/workspace/audit; clinic projection partial | assign/start/connect/workspace update | L/Ø/E/C/T; scheduled, waiting, assigned, in-call, completed, failed | D/T/M | telemed capability flags + shell | clinic telemed 15/15, audit 6/6 historical | MODIFY | DISCOVERY / target ownership |

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

Shell structure, navigation selection, role/capability visibility, responsive modes and shell states passed automated and screenshot validation. Evidence is stored outside Git at `/tmp/v50-shell-evidence/`. This does not certify business content against the prototype; the register remains `0/30 VISUALLY_VERIFIED`.

## Next update rule

When any prototype file changes, regenerate the manifest, rerun inventory verification, diff screen/route/state identities, and update affected evidence before implementation continues. `V50-OWNER-02` closeout captured 48 runtime and 12 prototype images, but structured comparison failed hierarchy for all three IDs; the `0/30 VISUALLY_VERIFIED` count remains unchanged. `V50-OWNER-03` must not start until this slice becomes integration-ready.
