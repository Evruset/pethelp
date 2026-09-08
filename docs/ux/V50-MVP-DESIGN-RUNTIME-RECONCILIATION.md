# V50 MVP design/runtime reconciliation

Status: `CONTRACT_VALIDATED / READY_FOR_HUMAN_REVIEW`

Cross-application completion is in `TOTAL-MVP-UX-UI-RUNTIME-PARITY.md`; it preserves this 134-state inventory and adds Owner Web, Clinic Portal and Operations target coverage without recalculating the source.

Baseline: branch `agent/v51-stage-01-architecture`, HEAD `e9b7b2fb8a9208fb76e0ba2003246a741f3a1c8b`, 2026-08-25. The pre-existing dirty worktree was preserved. This audit changes documentation only.

## Evidence boundary

- Canonical visual source is the current `prototype-v50/index.html`, plus the current Clinic Booking Journal at `prototype-v50/clinic-booking-journal/index.html`.
- Fresh extraction still yields 30 unique primary screens, 31 DOM nodes, 15 routes, 41 state/status tokens, and desktop/tablet/mobile/reduced-motion variants. Its current bundle SHA-256 is `5bdc47225b79462aca8ca3dabd0a6b892682f0bc672d5cf2e4cdd3e8fb2e7de8`.
- `prototype-v50/manifest.json` is stale: it declares `245e0929...` and `node scripts/v50-prototype-inventory.mjs prototype-v50/index.html --require-v50 --verify-manifest` exits `5 / MANIFEST_MISMATCH`. Historical packages bound to that hash remain historical evidence, not current-source acceptance.
- Clinic Journal manifest verifies 104 named states, four roles and ten viewports; its declared SHA-256 is `9fdf10b5f692d5d4e1af8ece2df4f354f57a181a2c269d1ddee9f8fa765c9c62`.
- Current Owner evidence renders production React Native Web components with controlled seams; Clinic evidence renders the production Portal build with controlled session/API seams. Evidence covers mobile/tablet/desktop and representative loading/error/conflict/degraded/dialog states. It is not a physical-device or live-backend run.
- Product semantics override prototype behavior: Pilot booking is `MANUAL_CONFIRM -> PENDING_CONFIRMATION -> CONFIRMED | REJECTED | EXPIRED`, with an authoritative server/PostgreSQL 15-minute deadline. Prototype payment, telemedicine, insurance and emergency behavior is outside the Pilot Scope Freeze.

No row is newly called `VISUALLY_VERIFIED`: the current V50 source hash lacks a matching side-by-side runtime acceptance package, and several current runtime captures use controlled seams.

## Primary screen mapping

`Evidence` names the current screenshot family, not an exact-parity claim. `Design` is one of the requested design-source classes. `UX / Visual` uses the requested parity vocabulary.

| V50 screen state | Target MVP task | Runtime application / route / component | Evidence | UX / Visual | Product semantic delta | Design / required action |
|---|---|---|---|---|---|---|
| OWN-001 `#home` | Owner home | Owner Mobile/Web / app index / `PetJourneyScreen` composition | `owner-mvp-foundation/04-home.png` | `MAJOR_DELTA / HIGH_DELTA` | MVP home must prioritize discovery, active booking and diary | `V50_NEEDS_ADAPTATION`; rebuild hierarchy from V50 language |
| OWN-002 `#catalog` | Clinic discovery | Owner Mobile/Web / app index / `ClinicCatalogScreen` | `owner-mvp-foundation/06-clinic-catalog.png` | `SMALL_DELTA / MEDIUM_DELTA` | specialist-first and published inventory are authoritative | `V50_NEEDS_ADAPTATION`; retain cards/tokens, add target search hierarchy |
| OWN-003 `#decision-comparison` | Clinic comparison | none | none | `NO_RUNTIME / NOT_IMPLEMENTED` | comparison is useful but subordinate to specialist-first discovery | `V50_EXISTING`; implement target screen |
| OWN-004 `#clinic` | Clinic/service detail | Owner Mobile/Web / app index / `ClinicServiceScreen` | `owner-mvp-foundation/07-clinic-service.png` | `SMALL_DELTA / MEDIUM_DELTA` | use current published service/doctor/inventory facts | `V50_NEEDS_ADAPTATION`; align composition and states |
| OWN-005 `#booking` | Availability | Owner Mobile/Web / app index / `AvailabilityScreen` | `s11-owner-availability/*` | `SMALL_DELTA / MEDIUM_DELTA` | request creates pending manual confirmation, not a confirmed visit | `V50_NEEDS_ADAPTATION`; retain slot language, expose request semantics |
| OWN-006 `#booking-review` | Booking request review | Owner Mobile/Web / app index / `BookingReviewScreen` | `s12-owner-booking-request/*` | `SMALL_DELTA / MEDIUM_DELTA` | show 15-minute clinic confirmation SLA and server authority | `V50_NEEDS_ADAPTATION`; replace obsolete confirmation/payment copy |
| OWN-007 `#appointments` | Booking list | Owner Mobile/Web / no first-MVP route yet | historical legacy/V50 package only | `NO_RUNTIME / NOT_IMPLEMENTED` | list needs pending/confirmed/rejected/expired/change-request buckets | `V50_NEEDS_ADAPTATION`; port into Owner App |
| OWN-008 `#appointment-detail` | Booking status/cancel | Owner Mobile/Web / app index / `BookingStatusScreen` | `s14-owner-booking-decision/*`, `s16-owner-cancellation/*` | `SMALL_DELTA / MEDIUM_DELTA` | current 15-minute pending/terminal semantics override V50; reschedule is separate change request | `V50_NEEDS_ADAPTATION`; complete hierarchy and change-request path |
| OWN-009 `#pets` | Pet selection/list | Owner Mobile/Web / app index / `PetJourneyScreen` | `owner-mvp-foundation/05-pet-selection.png` | `MAJOR_DELTA / HIGH_DELTA` | pet context is foundational, not a substitute for Diary | `V50_NEEDS_ADAPTATION`; split list/profile/diary routes |
| OWN-010 `#pet-profile` | Pet profile | no independent first-MVP route | none current | `NO_RUNTIME / NOT_IMPLEMENTED` | keep owner-safe identity; exclude unapproved clinical record scope | `V50_EXISTING`; implement in Owner App |
| OWN-011 `#diary` | Pet Health Diary | no persistent Diary runtime | none current | `NO_RUNTIME / NOT_IMPLEMENTED` | target needs additive authoritative DiaryEntry/result lineage; OCR deferred | `V50_NEEDS_ADAPTATION`; redesign around current result/diary semantics |
| OWN-012 `#telemed` | Telemedicine | legacy only | none accepted | `PROTOTYPE_OUTDATED / NOT_IMPLEMENTED` | over Scope Freeze | `V50_EXISTING`; retain as legacy reference, disabled |
| OWN-013 `#telemed-wait` | Telemedicine wait | legacy only | none accepted | `PROTOTYPE_OUTDATED / NOT_IMPLEMENTED` | over Scope Freeze | `V50_EXISTING`; retain as legacy reference, disabled |
| OWN-014 `#insurance` | Insurance | legacy only | none accepted | `PROTOTYPE_OUTDATED / NOT_IMPLEMENTED` | over Scope Freeze | `V50_EXISTING`; retain as legacy reference, disabled |
| OWN-015 `#notifications` | In-app notifications | no first-MVP screen | none | `NO_RUNTIME / NOT_IMPLEMENTED` | in-app only; Push/SMS/Telegram excluded | `V50_NEEDS_ADAPTATION`; new bounded screen from V50 system |
| OWN-016 `#profile` | Owner profile/security | public/auth foundation only | welcome/phone/OTP captures | `MAJOR_DELTA / HIGH_DELTA` | bounded identity/session/preferences only | `V50_NEEDS_ADAPTATION`; create first-MVP profile screen |
| OWN-017 `#emergency` | Emergency routing | legacy only | none accepted | `PROTOTYPE_OUTDATED / NOT_IMPLEMENTED` | over Scope Freeze | `V50_EXISTING`; keep isolated and disabled |
| OWN-018 `#doctor-select` | Specialist-first discovery | partial within `ClinicCatalogScreen` | catalog evidence | `MAJOR_DELTA / HIGH_DELTA` | specialist-first is now primary; public consent remains required | `V50_NEEDS_ADAPTATION`; promote specialist search and consent-safe facts |
| OWN-019 `#doctor-detail` | Public doctor profile | no independent first-MVP route | none current | `NO_RUNTIME / NOT_IMPLEMENTED` | consent-safe public fields only | `V50_NEEDS_ADAPTATION`; implement after consent contract |
| OWN-020 `#alternative-slot` | Reallocation proposal | legacy runtime only; no first-MVP route | historical V50 package only | `NO_RUNTIME / NOT_IMPLEMENTED` | target Smart Reallocation needs cross-clinic lineage and owner decision | `V50_NEEDS_ADAPTATION`; redesign for target domain |
| OWN-021 `#telemed-check` | Telemedicine check | legacy only | none accepted | `PROTOTYPE_OUTDATED / NOT_IMPLEMENTED` | over Scope Freeze | `V50_EXISTING`; disabled legacy reference |
| OWN-022 `#telemed-call` | Telemedicine call | legacy only | none accepted | `PROTOTYPE_OUTDATED / NOT_IMPLEMENTED` | over Scope Freeze | `V50_EXISTING`; disabled legacy reference |
| OWN-023 `#telemed-summary` | Telemedicine summary | legacy only | none accepted | `PROTOTYPE_OUTDATED / NOT_IMPLEMENTED` | over Scope Freeze | `V50_EXISTING`; disabled legacy reference |
| CLN-001 `#clinic-workspace` | Clinic home | Clinic Portal / scoped root / `ClinicWorkspaceHome` | historical responsive package | `MAJOR_DELTA / HIGH_DELTA` | Booking Journal is primary; workspace summary is retained foundation | `V50_NEEDS_ADAPTATION`; demote to overview |
| CLN-002 `#clinic-schedule` | DoctorShift schedule | Clinic Portal / scoped `/schedule` / `ClinicScheduleClient` | historical shell evidence | `MAJOR_DELTA / HIGH_DELTA` | generic periods/manual slots do not satisfy DoctorShift inventory | `V50_NEEDS_ADAPTATION`; redesign after schedule contract |
| CLN-003 `#clinic-visit` | Visit/result | Clinic Portal / scoped vet route / `VeterinarianVisitWorkspace` | no current accepted comparison | `MAJOR_DELTA / HIGH_DELTA` | target completed visit/result/Diary publication is incomplete | `V50_NEEDS_ADAPTATION`; redesign around additive result flow |
| CLN-004 `#clinic-appointments` | Appointments registry | Clinic Portal / scoped `/appointments` / `ClinicAppointmentsRegistry` | historical runtime captures | `SMALL_DELTA / MEDIUM_DELTA` | preserve administrative/clinical authority separation | `V50_NEEDS_ADAPTATION`; current-source comparison required |
| CLN-005 `#clinic-patients` | Patients registry | Clinic Portal / scoped `/patients` / `ClinicPatientsRegistry` | historical runtime captures | `SMALL_DELTA / MEDIUM_DELTA` | local alias only; no full clinical record | `V50_NEEDS_ADAPTATION`; current-source comparison required |
| CLN-006 `#clinic-patient` | Patient detail | Clinic Portal / scoped patient route / `ClinicPatientDetail` | historical runtime captures | `SMALL_DELTA / MEDIUM_DELTA` | bounded administrative projection; Diary/result authority separate | `V50_NEEDS_ADAPTATION`; current-source comparison required |
| CLN-007 `#clinic-telemed` | Clinic telemedicine | legacy/hidden routes | none accepted for Pilot | `PROTOTYPE_OUTDATED / NOT_IMPLEMENTED` | over Scope Freeze | `V50_EXISTING`; isolate and disable |

## Application design coverage

| Surface | Design source verdict | Consequence |
|---|---|---|
| Owner Mobile | `V50_EXISTING` for core discovery/booking/pets; `V50_NEEDS_ADAPTATION` for current semantics | Reuse tokens, cards, navigation and interaction language; implement in `apps/owner-app`, not legacy Flutter |
| Owner Web | `NEW_SCREEN_REQUIRED / V50_DESIGN_SYSTEM_REUSE` | Adaptive web is a transformation of Owner V50, not a separate visual language |
| Clinic Portal | `V50_EXISTING` plus Clinic Journal states; most content `V50_NEEDS_ADAPTATION` | Journal becomes primary; schedule/visit must follow current Product contracts |
| Operations / Call Center | `NEW_SCREEN_REQUIRED / V50_DESIGN_SYSTEM_REUSE` | No direct V50 application; derive shell, typography, density, cards, status and form language from Clinic V50 |

## V50 state coverage matrix

The 134 identifiers below are mutually classified. The 41 extracted lower-level tokens are validation anchors and are not double-counted.

### Primary source (30)

- `RUNTIME_IMPLEMENTED` (11): OWN-002, OWN-004, OWN-005, OWN-006, OWN-009, OWN-018, plus historically implemented but not present in first-MVP navigation OWN-007, OWN-010, OWN-011, OWN-019, OWN-020. Their existence is not current visual acceptance.
- `RUNTIME_PARTIAL` (8): OWN-001, OWN-008, CLN-001, CLN-002, CLN-003, CLN-004, CLN-005, CLN-006.
- `FUTURE_MVP` (3): OWN-003, OWN-015, OWN-016.
- `OVER_SCOPE` (8): OWN-012, OWN-013, OWN-014, OWN-017, OWN-021, OWN-022, OWN-023, CLN-007.

### Clinic Booking Journal (104)

- `RUNTIME_PARTIAL` (38): `pending-request`, `request-due-soon`, `request-overdue`, `confirmed-appointment`, `alternative-selection`, `owner-decision-pending`, `reject-confirmation`, `technical-error`, `stale-retained`, `forbidden`, `slot-conflict`, `mobile-pending-detail`, `mobile-request-list`, `mobile-request-detail`, `mobile-request-confirmed`, `mobile-request-rejected`, `mobile-alternative-date`, `mobile-alternative-slots`, `mobile-alternative-review`, `mobile-owner-decision-pending`, `mobile-stale`, `mobile-error`, `mobile-forbidden`, `mobile-loading`, `request-detail-pending`, `request-detail-overdue`, `request-detail-submitting`, `request-detail-success`, `request-detail-conflict`, `request-detail-alternative`, `request-detail-stale`, `request-detail-technical-error`, `request-detail-forbidden`, `mobile-request-detail-pending`, `mobile-request-detail-overdue`, `mobile-request-detail-submitting`, `mobile-request-detail-success`, `mobile-request-detail-conflict`.
- `FUTURE_MVP` (66): `reception-ready`, `admin-ready`, `veterinarian-limited`, `multi-role-ready`, `manual-booking`, `client-lookup`, `quick-client-create`, `operational-empty`, `no-staff`, `search-results`, `search-empty`, `filters-active`, `week-view`, `mobile-agenda`, `week-view-selected`, `week-alternative-selection`, `manual-booking-invalid`, `mobile-manual-booking`, `mobile-today`, `mobile-today-overdue`, `mobile-today-empty`, `mobile-booking-step-client`, `mobile-booking-step-schedule`, `mobile-booking-step-review`, `mobile-booking-invalid`, `mobile-client-search`, `mobile-quick-client`, `mobile-client-detail`, `mobile-more`, `desktop-calendar-search-results`, `desktop-filters-active`, `desktop-filters-collapsed`, `compact-calendar`, `compact-filters-open`, `compact-detail-open`, `tablet-calendar`, `tablet-calendar-search`, `tablet-filters-open`, `tablet-filters-active`, `tablet-detail`, `mobile-calendar-search`, `mobile-calendar-search-results`, `mobile-calendar-search-empty`, `mobile-filters-open`, `mobile-filters-active`, `mobile-filters-empty-result`, `manual-booking-global`, `manual-booking-free-slot`, `manual-booking-client-context`, `manual-booking-request-context`, `manual-booking-validation`, `manual-booking-submitting`, `manual-booking-success`, `manual-booking-conflict`, `manual-booking-terminal-error`, `manual-booking-readonly-denied`, `mobile-booking-conflict`, `mobile-booking-success`, `keyboard-booking-open`, `keyboard-booking-return-focus`, `reduced-motion-booking`, `calendar-card-wide`, `calendar-card-compact`, `calendar-card-mobile`, `calendar-free-slot`, `calendar-overdue`.

Totals:

| Metric | Count |
|---|---:|
| `TOTAL_V50_STATES` | 134 |
| `MAPPED_TO_MVP` | 126 |
| `IMPLEMENTED_RUNTIME` | 11 |
| `PARTIAL_RUNTIME` | 46 |
| `FUTURE_MVP` | 69 |
| `SUPERSEDED` | 0 atomic identifiers |
| `OVER_SCOPE` | 8 |

`SUPERSEDED=0` does not mean no semantic debt. Six mapped screens (OWN-005, OWN-006, OWN-008, OWN-011, OWN-020 and CLN-003) contain prototype behaviors or content that must be adapted to newer Product semantics. They remain mapped screens, classified `V50_NEEDS_ADAPTATION`, rather than being discarded as whole states.

## V50 DESIGN VERDICT

- Total current prototype states: **134 named identifiers** (30 primary screens + 104 Journal states), plus 41 non-additive state/status tokens.
- States relevant to new MVP: **126**; eight whole screens are over Scope Freeze.
- Exact runtime matches: **0 newly proven against the current V50 hash**.
- Partial matches: **46 state identifiers**; 11 more have runtime implementations but still lack current-source exact visual acceptance.
- Missing runtime screens: Owner comparison, independent pet profile/Diary in the first-MVP app, notifications, profile/security, doctor detail, Smart Reallocation, most Journal/calendar/manual-booking flows, Owner Web and Operations.
- States superseded by new Product semantics: no whole identifier is discarded; six screen families require semantic adaptation. Booking must show manual confirmation and a PostgreSQL-authoritative 15-minute deadline; Diary/result, DoctorShift and Smart Reallocation also override older prototype behavior.
- Top 10 visual/UX deviations: Owner home hierarchy; specialist-first discovery; map/search composition; booking-request versus instant-confirm copy; 15-minute pending-status treatment; first-MVP appointments navigation; Pet Diary absence; Clinic Journal absence; DoctorShift calendar model; no V50-derived Operations shell.
- Screens reusable nearly unchanged: catalog card primitives, clinic/service detail structure, appointment registry, patient registry/detail, shared V50 shell/tokens and Journal status/control primitives. Each still needs a fresh hash-bound comparison.
- Screens requiring redesign: Home, booking/review/status, Pet Diary, specialist discovery/detail, Smart Reallocation, Clinic Schedule and Visit/Result.
- Completely new screens requiring V50 design-system extension: Owner Web adaptive shell/pages, Operations/Call Center workspace, BookingChangeRequest/reschedule, cross-clinic reallocation operations, persistent Diary/result publication states, and in-app notifications/profile screens.

## Visual acceptance gate

A future row may be `VISUALLY_VERIFIED` only after: current V50 or explicit V50-system-derived target identification; actual runtime render; representative viewport; no major hierarchy/composition mismatch; no blocking responsive or accessibility defect; and correct current Product semantics. The next evidence package must render current prototype and current runtime side by side, bind both source hashes, distinguish controlled-seam from live-backend evidence, and include loading, empty, error, stale/degraded, unauthorized/session-expired, conflict, dialog/drawer, validation and terminal states.
