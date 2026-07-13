# VetHelp V51 Parity Register

Runtime and the original `prototype-v51` are the sources of truth. A route is not complete merely because a component exists. Status vocabulary: `NOT_STARTED`, `DISCOVERY`, `CONTRACT_READY`, `IMPLEMENTED`, `TESTED`, `VISUALLY_VERIFIED`, `UAT_ACCEPTED`, `ROLLED_OUT`, `LEGACY_REMOVED`, `BLOCKED`.

Migration action vocabulary: `REUSE`, `MODIFY`, `REPLACE`, `REMOVE`, `MISSING`.

## Owner surfaces

| V51 ID | Prototype surface | Production route/component | Action | Status | Main gap / next proof |
|---|---|---|---|---|---|
| OWNER-01 | `home` | `OwnerJourneyPage` / owner home | MODIFY | IMPLEMENTED | notifications, deep links and full visual matrix |
| OWNER-02 | `catalog` | `PublicCatalogPage` | MODIFY | TESTED | visual parity and durable navigation |
| OWNER-03 | `decision-comparison` | absent | MISSING | NOT_STARTED | decision-support read model and route |
| OWNER-04 | `clinic` | clinic drill-down inside catalog | MODIFY | IMPLEMENTED | dedicated route/deep link |
| OWNER-05 | `booking` | `BookingMarketplacePage` | REUSE | TESTED | V51 visual/state certification |
| OWNER-06 | `booking-review` | embedded marketplace submit | MODIFY | IMPLEMENTED | review/back-recovery route |
| OWNER-07 | `appointments` | `OwnerAppointmentsPage` | REUSE | TESTED | deep-link persistence and full states |
| OWNER-08 | `appointment-detail` | `OwnerAppointmentDetailPage` | REUSE | TESTED | named route persistence |
| OWNER-09 | `pets` | `OwnerPetsPage` | REUSE | TESTED | visual/UAT matrix |
| OWNER-10 | `pet-profile` | pet edit + care page | MODIFY | IMPLEMENTED | unify profile/care IA |
| OWNER-11 | `diary` | `OwnerPetCarePage` | MODIFY | TESTED | reminders and attachment lifecycle |
| OWNER-12 | `telemed` | `OwnerTelemedPage` | MODIFY | IMPLEMENTED | route/state parity |
| OWNER-13 | `telemed-wait` | `TelemedWaitingRoomPage` | REUSE | TESTED | UAT and reconnect evidence |
| OWNER-14 | `insurance` | `CoverageCheckPage` | REUSE | TESTED | visual/UAT matrix |
| OWNER-15 | `notifications` | absent | MISSING | NOT_STARTED | API, repository and center/preferences UI |
| OWNER-16 | `profile` | partial iOS landing | REPLACE | NOT_STARTED | personal data, devices and session management |
| OWNER-17 | `emergency` | triage and emergency routes | REUSE | TESTED | required viewport/accessibility evidence |
| OWNER-18 | `doctor-select` | absent | MISSING | NOT_STARTED | public doctor list/selection contract |
| OWNER-19 | `doctor-detail` | absent | MISSING | NOT_STARTED | public doctor detail contract |
| OWNER-20 | `alternative-slot` | `AlternativeSlotPage` | REUSE | TESTED | full UAT and realtime recovery |
| OWNER-21 | `telemed-check` | intake validation only | MISSING | NOT_STARTED | dedicated pre-call state/contract |
| OWNER-22 | `telemed-call` | `TelemedLiveCallView` | MODIFY | IMPLEMENTED | reconnect/fallback/reconciliation coverage |
| OWNER-23 | `telemed-summary` | completed row in telemed page | MODIFY | NOT_STARTED | dedicated summary/document route |

## Clinic and veterinarian surfaces

| V51 ID | Prototype surface | Production route/component | Action | Status | Main gap / next proof |
|---|---|---|---|---|---|
| CLINIC-01 | `clinic-workspace` | no operational dashboard | MISSING | NOT_STARTED | dashboard read model and role-aware landing |
| CLINIC-02 | `clinic-schedule` | location schedule | MODIFY | TESTED | Stage 5.5 removes clinical completion; full responsive matrix remains |
| VET-01 | `clinic-visit` | `/vet/visits` list/detail and `VeterinarianVisitWorkspace` | MODIFY | TESTED | selected P0: prove it is the sole clinical completion UI |
| CLINIC-03 | `clinic-appointments` | queue only; registry absent | MISSING | NOT_STARTED | appointment list/detail/check-in/reschedule |
| CLINIC-04 | `clinic-patients` | absent | MISSING | NOT_STARTED | treatment-scoped/admin patient registry |
| CLINIC-05 | `clinic-patient` | absent | MISSING | NOT_STARTED | category-filtered patient detail |
| TELEMED-01 | `clinic-telemed` | platform vet queue; clinic dispatcher absent | MODIFY | BLOCKED | approve platform-vs-clinic ownership and dispatcher contract |

## Operational supporting surfaces

| V51 ID | Surface | Production evidence | Action | Status | Remaining proof |
|---|---|---|---|---|---|
| OPS-01 | Clinic FIFO queue | queue route, hold inspector, replay | REUSE | TESTED | V51 viewport/UAT certification |
| OPS-02 | Quality | quality dashboard | REUSE | TESTED | full-page accessibility debt |
| OPS-03 | Security/SLO | `/ops/security` | REUSE | TESTED | rollout/UAT |
| AUTH-01 | Effective session/capabilities | `/v1/auth/session`, centralized evaluator | REUSE | TESTED | extend only with bounded resources |
| REALTIME-01 | replay/reconnect | booking replay exists | MODIFY | IMPLEMENTED | transport subscription and durable cursor |

## Selected current slice — Stage 5.5

| Field | Value |
|---|---|
| Chat | `CLINIC-AUTHORITY-01` |
| V51 IDs | `CLINIC-02`, `VET-01` |
| Goal | Remove medical completion from administrative schedule and preserve dedicated veterinarian completion |
| Authority | `schedule.read` never implies `clinical.visit.complete`; backend remains final authority |
| Required tests | schedule admin/reception negative UI matrix; veterinarian completion suite; local-stack owner → veterinarian → Pet Diary |
| Feature flag | none; this closes an unsafe legacy UI path |
| Status | IMPLEMENTED; CI validation pending |
