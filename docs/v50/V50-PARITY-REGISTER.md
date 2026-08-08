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
| CLN-001 | `prototype-v50/manifest.json#sha256` | Clinic/Vet / Workspace home | `#clinic-workspace` → `/clinics/:clinicId/locations/:locationId` | backend projection plus default-off scoped Portal page/BFF implemented | exact active clinic/location membership remains backend authority; Portal session/scope is presentation fencing | strict bounded Queue + Appointments summaries; Schedule/Veterinarian/Quality no-facts states; no identifiers | closed Queue/Appointments scoped links only for `AVAILABLE` | loading/empty/role/degraded/retry/stale-retained/forbidden and authority-loss purge tested | 375/412/768/1440, keyboard, axe, 200%, reduced motion and forced colors evidenced | `CLINIC_V50_WORKSPACE_HOME`, default off, depends on `PORTAL_V50_SHELL`; absent-route rollback | backend PostgreSQL/performance plus Portal parser/BFF/full E2E/live-stack and independent reviews PASS | BACKEND_FOUNDATION_IMPLEMENTED / TESTED; PORTAL_FOUNDATION_IMPLEMENTED / TESTED | BOUNDED_VISUAL_EVIDENCE_PASS / FULL_PRODUCT_PARITY_PARTIAL / ROLLOUT_NOT_STARTED |
| CLN-002 | `prototype-v50/manifest.json#sha256` | Clinic / Schedule | `#clinic-schedule` → `/clinics/:clinicId/locations/:locationId/schedule` | `ClinicScheduleClient` in V50 reception frame | admin/reception; `schedule.read/manage` | schedule slots/snapshot | hours, services, staff, resources, periods, slots, import/export | L/Ø/E/C; open/blocked/booked/telemed | D/T/M shell tested | `PORTAL_V50_SHELL` + V51 fallback; read capability | schedule capability/full Playwright/build PASS; shell screenshot updated | REUSE | DISCOVERY / screen content visual acceptance remains |
| CLN-003 | `prototype-v50/manifest.json#sha256` | Vet / Visit workspace | `#clinic-visit` → `/clinics/:clinicId/locations/:locationId/vet/visits/:holdId` | bounded vet routes in role-aware V50 veterinarian frame | clinic veterinarian; `clinical.visit.workspace.read/complete` | vet visit list/detail | complete; full draft/sign/amend absent | L/E/C/T; confirmed, in-visit, completed, immutable/amend | D/T/M shell tested | `PORTAL_V50_SHELL` + V51 fallback; additive reads | veterinarian and multi-role capability/scope behavior PASS in full 95/95 | MODIFY | DISCOVERY / clinical model and content visual acceptance |
| CLN-004 | `prototype-v50/manifest.json#sha256` | Clinic / Appointments | `#clinic-appointments` → scoped `/appointments` and nested `/:appointmentId` | default-off registry and administrative detail are implemented end to end; Queue unchanged | admin/reception `appointment.registry.read`; active exact clinic/location backend authority; Portal effective-capability/scope fence | list/detail scoped Portal BFF → canonical backend GETs | list/detail read-only; detail actions empty; Queue and clinical commands remain separate | list and detail loading/no-leak/error/degraded/unknown/nullability states implemented | D/T/M screenshots, keyboard, axe and 200% text evidenced | existing registry flag reused for list/detail page+BFF/backend | Portal detail Chromium 23/23 + rollback 1/1; backend detail 13/13 and registry 27/27; OpenAPI/migrations unchanged | MODIFY | DETAIL_END_TO_END_IMPLEMENTED / ADMINISTRATIVE_MUTATIONS_AND_HISTORY_NOT_IMPLEMENTED |
| CLN-005 | `prototype-v50/manifest.json#sha256` | Clinic / Patients | `#clinic-patients` → `/clinics/:clinicId/locations/:locationId/patients` | registry/detail and exact-scope alias backend/Portal workflow implemented; structured reference is contract-only | read uses `patient.admin.read`; local-profile write uses `patient.admin.local-profile.update`; owner corrections and clinical access separate | signed read snapshot plus current privacy override; versioned clinic-local alias projection; owner master unchanged | read/navigation and alias set/replace/clear implemented; reference backend, create/import/lifecycle absent | read states plus alias mutation no-leak/version/idempotency/error matrix PASS | responsive read and alias editor evidence PASS | existing Patients read flag plus independent default-off mutation flag | alias backend 12/12; capability 35/35; focused alias Chromium 7/7; Detail/Registry/rollback/build/parser PASS | MODIFY | LOCAL_ALIAS_END_TO_END_IMPLEMENTED / REFERENCE_CONTRACT_ONLY / OTHER_MUTATIONS_EXCLUDED |
| CLN-006 | `prototype-v50/manifest.json#sha256` | Clinic/Vet / Patient detail | `#clinic-patient` → scoped `/clinics/:clinicId/locations/:locationId/patients/:patientId` | administrative backend GET, scoped Portal page/BFF, strict parser, Registry navigation and local alias workflow implemented; clinical record separate | admin read uses `patient.admin.read`; local alias write is separately flag/capability guarded; exact current association required | safe pet/relationship/bounded appointment projection plus exact-scope alias/version/timestamp; owner contacts and all clinical/document/financial fields excluded | read detail and alias set/replace/clear implemented; structured reference backend and clinical draft absent | no-leak, technical, malformed, revoke-refresh, absent/cleared alias, mutation retry/conflict and degraded states pass | responsive detail/editor, keyboard and accessibility evidence PASS | Patients read flag; alias read independent of mutation flag; writes default off | backend detail 11/11 + Registry 8/8; Portal parser 3/3; focused alias Chromium 7/7; Node 22 typecheck/build PASS | MODIFY | ADMIN_DETAIL_AND_ALIAS_END_TO_END / REFERENCE_CONTRACT_ONLY / CLINICAL_POLICY_SEPARATE |
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
