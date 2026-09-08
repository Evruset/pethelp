# MVP Core Implementation Reconciliation

Fresh runtime baseline: `agent/v51-stage-01-architecture`, HEAD `e9b7b2fb8a9208fb76e0ba2003246a741f3a1c8b`, 2026-08-25. The substantial pre-existing dirty worktree was preserved. This is an audit, not an implementation claim.

## Executive result

Approximate weighted target-core completeness is **50%**.

| Group | Weight | Score | Contribution | Basis |
|---|---:|---:|---:|---|
| Critical architecture/core | 35% | 62% | 21.7 | Strong atomic claim, locking, idempotency, audit and outbox; wrong Pilot approval semantics and no DB active-booking-per-slot invariant. |
| Owner product | 20% | 54% | 10.8 | OTP, pets, catalog, service, availability and booking exist; map, specialist-first, complete profile and request-based changes do not. |
| Clinic product | 20% | 55% | 11.0 | Queue, journal and schedule administration exist; shift generation, manual appointment, no-show and result delivery are incomplete. |
| Diary/OCR | 10% | 18% | 1.8 | Legacy projection/documents exist; Pilot DiaryEntry and confirmed OCR do not. |
| Operations/Reallocation | 10% | 12% | 1.2 | Same-location alternative mechanics exist; callback operations and cross-clinic replacement do not. |
| Pilot containment | 5% | 72% | 3.6 | Modules/routes mostly gated; OCR worker, secrets and fail-open defaults need containment. |

Classification counts (45 rows): `REUSE_AS_IS` 5 (11.1%); `REUSE_WITH_SMALL_DELTA` 10 (22.2%); `REUSE_WITH_MAJOR_DELTA` 15 (33.3%); `REPLACE` 0; `MISSING` 14 (31.1%); `OVER_SCOPE_KEEP_DISABLED` 1 (2.2%).

## Reconciliation matrix

| ID | Target capability | Target behavior | Current implementation | Runtime files/modules | Current API | Current DB entities | Current UI | Current tests | Semantic match | Classification | Gap | Reuse decision | Required change | Risk | Priority | Dependency | Suggested delivery slice |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CORE-001 | Owner OTP | Phone auth | Challenge/hash/limits exist | `auth/owner-auth.*` | `/v1/auth/otp/*` | `owner_otp_sessions` | Expo auth | OTP suites | High | REUSE_WITH_SMALL_DELTA | Provider proof | Keep | Pilot provider verification | M | P1 | Provider | A |
| CORE-002 | Owner Profile | Editable profile | `/owner/me` only id/phone/pet count | owner auth service | `GET /v1/owner/me` | owner identity | Minimal | Auth specs | Low | REUSE_WITH_MAJOR_DELTA | No editable data | Extend | Contract/UI | M | P1 | 001 | D |
| CORE-003 | Pet Profile | Full demographics/chip | Rich legacy service; Pilot create name/species | `auth/owner-pet*`, RN pets | Pilot pet list/create | `pets` rich columns | Narrow create | Pet/RN specs | Medium | REUSE_WITH_MAJOR_DELTA | Fields hidden in Pilot | Reuse entity | Expose/edit full profile | M | P1 | Owner shell | D |
| CORE-004 | Species/Breed | Extendable taxonomy | DOG/CAT/OTHER enum; breed text | pet DTO/service | Pet APIs | pet columns | Pet form | Pet specs | Low | REUSE_WITH_MAJOR_DELTA | Hardcoded/shallow | Compatible migration | Data catalogs | L | P1 | Contract | A/D |
| CORE-005 | Clinic Catalog | Pilot clinic list | Clinic/location/service/open-slot query | `public-catalog/*` | `/v1/owner/clinic-catalog` | clinic/location/service/slot | RN catalog | Catalog tests | High | REUSE_AS_IS | Duplicate legacy family | Keep owner API | Consolidate ownership | S | P1 | Tenant auth | D |
| CORE-006 | Map Discovery | Map/geo search | Geo SQL exists, no RN map | public catalog | legacy geo query | location lat/lon | None | Catalog only | Low | MISSING | No Pilot flow | Reuse geo query | Map projection/UI | L | P1 | 005 | D |
| CORE-007 | Specialty Taxonomy | Specialty→Clinic/Doctor/Service | Table plus shallow ids | catalog migrations | Partial | `specialties`, ids | None | Catalog | Low | REUSE_WITH_MAJOR_DELTA | Missing target joins | Reuse table | Add relations | XL | P0 | Migration approval | A/C |
| CORE-008 | Specialist-first Search | Cross-clinic ranked search | Clinic-first only | public catalog | None target | indexes only | None | None | None | MISSING | Requires clinic first | New query | Specialty/date/geo API+UI | XL | P0 | 007,011-013 | D |
| CORE-009 | Clinic Detail | Profile/services/doctors | Location/service detail | catalog + RN | owner location detail | catalog tables | Service screen | RN/catalog | Medium | REUSE_WITH_SMALL_DELTA | Content incomplete | Extend | Complete projection/UI | M | P1 | 005,011 | D |
| CORE-010 | Service Selection | Published service | Owner list + clinic CRUD | catalog/schedule | detail + schedule services | `clinic_services` | RN/Portal | Schedule/catalog | High | REUSE_AS_IS | Minor price copy | Keep | Contract cleanup | S | P1 | 005 | C/D |
| CORE-011 | Doctor-Service relation | Explicit compatibility | Inferred from slots/filters | catalog/schedule | booking filters | slot ids | Indirect | Availability | Low | REUSE_WITH_MAJOR_DELTA | No DoctorService | Transitional reuse | Explicit relation | L | P0 | 007 | C |
| CORE-012 | Doctor Shifts | 3-hour doctor shifts | Generic staff periods | clinic schedule | schedule staff/periods | staff, periods | Portal | Schedule e2e | Medium | REUSE_WITH_MAJOR_DELTA | No DoctorShift semantics | Reuse periods cautiously | Typed shift/publish rules | L | P0 | 011 | C |
| CORE-013 | Generated Slots | Variable slots in shifts | Manual/import slots and blackout | clinic schedule/availability | manual/import/availability | `appointment_slots` | Portal/RN | Schedule/availability | Low | REUSE_WITH_MAJOR_DELTA | No shift generation | Reuse slot primitive | Generation lifecycle | XL | P0 | 010-012 | C |
| CORE-014 | Atomic Booking | Claim and `PENDING_CONFIRMATION` | Slot lock/capacity/hold atomic transaction | booking hold creation/repository | owner hold create | slots/holds/appointments | Review/status | PG/concurrency | Strong primitive | REUSE_WITH_SMALL_DELTA | Pilot already chooses pending branch | Keep core | Preserve atomic pending branch | M | P0 | 013,015 | B |
| CORE-015 | Manual Confirmation SLA | Published inventory creates a bounded request | Manual pending + Clinic Queue decision exist | booking creation + semantics spec | Same create | hold/appointment | Pending UI | Semantics tests | Aligned foundation | REUSE_WITH_SMALL_DELTA | Enforce authoritative 15-minute deadline and exact terminal semantics | Keep current branch | Deadline/expiry/readback contract | M | P0 | 014 | B |
| CORE-016 | Booking History | Owner active/history | Owner-scoped keyset buckets | owner appointments | owner appointments | holds/appointments | Status/history | Paging tests | High | REUSE_WITH_SMALL_DELTA | New statuses/lineage | Keep | Extend projection | M | P1 | 015,017-024 | E/F |
| CORE-017 | Cancellation Request | Preserve booking; callback | Pilot cancels/releases immediately | booking controller/security | owner cancel | hold/appointment | RN cancel | HTTP/PG | Contradictory | REUSE_WITH_MAJOR_DELTA | No request aggregate | Keep internal cancel only | New public request flow | XL | P0 | 019-020 | E |
| CORE-018 | Reschedule Request | Callback-required request | Enum remnant only | booking types | None | None | None | None | None | MISSING | No flow | New | BookingChangeRequest | XL | P0 | 019-020 | E |
| CORE-019 | Callback Task | Owned task/SLA | None | None | None | None | None | None | None | MISSING | Domain absent | New | Task lifecycle/SLA | L | P0 | Ops contract | E |
| CORE-020 | Operator Workspace | Queues/context/outcomes | Support roles only | auth roles | None | None | None | None | None | MISSING | Queue is clinic-only | New frontend | Operations workspace | XL | P0 | 017-019 | E |
| CORE-021 | Smart Reallocation Search | Cross-clinic ranked replacements | Same-location staff-chosen alternative | alternative service | clinic alternative | swap group | Alternative drawer | Atomicity tests | None | MISSING | No search/policy | Reuse catalog/slots | New Reallocation domain | XL | P0 | 007-013,019 | F |
| CORE-022 | Reallocation Offer | OFFER_ONLY accept/decline | Owner alternative read/accept/decline | alternative services | alternative endpoints | reservation/swap | Owner/clinic | Race tests | Partial | REUSE_WITH_MAJOR_DELTA | Same-location/old hold | Reuse offer mechanics | Generalize offer | L | P1 | 021 | F |
| CORE-023 | Replacement Booking | Create Booking B | Acceptance mutates original hold slot | alternative services | accept | old hold updated | Existing | Race tests | Contradictory | MISSING | No Booking B | Do not mutate A | Atomic B creation | XL | P0 | 021,022,024 | F |
| CORE-024 | Booking Lineage | A superseded_by B | Slot swap group only | alternative migration | None target | `alternative_swap_groups` | None | Alternative tests | None | MISSING | No booking lineage | Reuse correlation | Explicit lineage | L | P0 | 023 | F |
| CORE-025 | Clinic Booking Journal | Unified journal | Queue + appointment registry | clinic queue/registry | queue + appointments | holds/appointments | Portal | Authority/e2e | Medium | REUSE_WITH_SMALL_DELTA | Split views/vocabulary | Keep | Unified projection | M | P1 | 015-016 | B/E |
| CORE-026 | Clinic Schedule | Doctors/shifts/slots | Broad generic administration | clinic schedule | schedule family | staff/periods/slots/services | Portal | Schedule e2e | Medium | REUSE_WITH_MAJOR_DELTA | Not generated inventory | Keep shell/CRUD | Reconcile model | L | P0 | 011-013 | C |
| CORE-027 | Manual Booking | Clinic creates appointment | Manual slot only | clinic schedule | manual-slots | slot | Portal | Schedule | None | MISSING | Slot is not appointment | Reuse booking command | Add manual appointment | L | P1 | 014/patient lookup | C |
| CORE-028 | Visit Completion | Complete + summary | Completion/read workspace exists | veterinarian visit | clinic complete/read | visit projection | Portal | Visit tests | Medium | REUSE_WITH_SMALL_DELTA | Result delivery absent | Keep | Connect Result/Diary | M | P0 | 030-032 | G |
| CORE-029 | No-show | Clinic marks no-show | Read vocabulary only | parsers | None mutation | status remnant | None | None | None | MISSING | No command | New command | Audit/outbox transition | M | P1 | 025 | G |
| CORE-030 | Result Upload | Summary + files | Summary text only | visit workspace | complete summary | None target | Text form | Visit tests | Low | MISSING | No Result/files | Reuse documents later | Result aggregate/upload | L | P0 | 028,033 | G |
| CORE-031 | Pet Diary | Longitudinal Diary | Legacy SQL UNION; absent Pilot | owner pet service | legacy diary | source tables | None Pilot | Legacy specs | Low | REUSE_WITH_MAJOR_DELTA | Not aggregate/taxonomy | Reuse sources | Pilot canonical Diary | XL | P0 | 028,030,032-033 | G |
| CORE-032 | DiaryEntry Model | Persistent provenance | Response TS type only | owner pet service | None | None | None | None | None | MISSING | No model | Additive model | DiaryEntry entity | XL | P0 | Migration approval | G |
| CORE-033 | Documents | Private owner/clinic files | Legacy owner upload/download/audit; absent Pilot | owner pet controller/service | legacy documents | `pet_documents` | None Pilot | Owner pet specs | Medium | REUSE_WITH_MAJOR_DELTA | No clinic delivery/Pilot | Reuse metadata/auth | Pilot flows/storage | L | P0 | 030-032 | G |
| CORE-034 | OCR Upload | Deferred post-MVP pipeline | Legacy document PROCESSING; Pilot absent | owner pet/OCR worker | legacy upload | pet documents | None | Legacy | Low | DEFERRED | No safe Pilot job/dedup | Reuse upload metadata later | Product delivery deferred; contain worker now | L | P2 | 033 | DEFERRED |
| CORE-035 | OCR Extraction | Deferred post-MVP provider flow | Hardcoded simulated OCR blob | OCR worker | None | `ocr_result`, pet JSON | None | Limited | Low | DEFERRED | No abstraction/confidence/retry | Keep leasing pattern only | Containment hardening; provider delivery deferred | XL | P2 | 034/provider | DEFERRED |
| CORE-036 | OCR Confirmation | Deferred post-MVP confirmation | None; worker auto-writes pet OCR JSON | OCR worker | None | pet JSON mutated | None | None | Contradictory legacy | DEFERRED | Unconfirmed auto-trust in legacy | Stop Pilot exposure | Containment hardening now; product flow deferred | XL | P1 containment / P2 product | 032,035 | DEFERRED |
| CORE-037 | Notifications | Operational notifications | Booking outbox projection/list/read | notifications | owner notifications | notification/delivery | Limited | Repo/controller | Medium | REUSE_WITH_SMALL_DELTA | Missing new domain types | Keep | Extend taxonomy | M | P1 | Outbox/new domains | E/G/J |
| CORE-038 | Partner Attribution | Grooming QR/link | None; insurance partner code unrelated | None | None | None | None | None | None | MISSING | Attribution absent | New small domain | Persist source through booking | M | P1 | Booking contract | I |
| CORE-039 | Tenant Isolation | Exact clinic/location authority | Membership + server-side scope | employee access/capabilities | Clinic APIs | memberships | Capability gates | Authority matrices | High | REUSE_AS_IS | Extend to new routes | Keep invariant | Apply centrally | M | P0 | All clinic work | All |
| CORE-040 | Purpose Pet Access | Visit-bounded context | Registry/consent/revision foundation | clinic patient services | registry/detail/visit | associations/consents | Bounded views | Authority tests | Medium | REUSE_WITH_SMALL_DELTA | Full lifecycle not proven | Keep | Bind Result/Diary purpose | L | P0 | 028-033 | G/J |
| CORE-041 | Audit | Security/business trail | Transactional audit log | audit/domain services | bounded reads | `audit_log` | Ops/queue | Domain tests | High | REUSE_WITH_SMALL_DELTA | New actions/provenance | Keep | Extend | M | P1 | New domains | All |
| CORE-042 | Outbox | Reliable transactional events | Lease/retry/fencing/FAILED | `outbox/*` | Internal | `outbox_events` | None | Replay/restart | High | REUSE_AS_IS | New types only | Keep | Add consumers | S | P1 | New aggregates | All |
| CORE-043 | Observability | Core SLIs/SLA/privacy | Context/DB/outbox/auth metrics | observability/ops SLO | Ops SLO | operational queries | Ops | Unit/e2e | Medium | REUSE_WITH_SMALL_DELTA | No callback/OCR/Diary SLIs | Keep | New metrics/privacy | M | P1 | New domains | J |
| CORE-044 | Payment Absence | At-clinic only | Pilot module/routes/workers off; secret/mock residue | MVP scope/payments | Pilot 404 | Legacy tables | Hidden | Boot/worker containment | High runtime | OVER_SCOPE_KEEP_DISABLED | Secrets/health residue | Preserve disabled | Remove Pilot coupling | M | P0 | Deployment | A/J |
| CORE-045 | MIS Independence | No mandatory MIS | Pilot module/workers omitted | MVP scope/MIS | Pilot absent | Legacy tables | Hidden | Boot/worker | High | REUSE_AS_IS | Config residue/default risk | Keep disabled | Maintain isolation | S | P0 | Scope profile | A/J |

## Special findings

Current Pilot booking is `create → locked capacity hold → MANUAL_CONFIRM_PENDING/PENDING_CONFIRMATION → Clinic Queue decision → CONFIRMED | REJECTED | EXPIRED`; this is also the latest Product target. The confirmation deadline is 15 minutes and must use authoritative server/PostgreSQL time. Confirm cannot succeed after it; reject cannot mutate an expired request; expiry must release capacity exactly once. The current confirmed branch remains reusable for the clinic-confirm transition. The database capacity check is strong, but appointments are unique by `hold_id`, not by active `slot_id`; a later approved additive invariant remains advisable.

Current cancellation immediately releases capacity or cancels an appointment. It does not preserve the booking behind a separate callback request. There is no target BookingChangeRequest, callback task/SLA, operator workspace or reschedule flow.

Current alternative-slot is not Smart Reallocation: it is same-location and mutates the original hold. It lacks cross-clinic search, policy filters, Booking B and A→B lineage.

Legacy Diary is a disconnected read projection and is absent from Pilot. Existing sources can feed a new additive DiaryEntry model. OCR product delivery is `DEFERRED_BY_PRODUCT_DECISION`. The legacy worker can auto-write simulated output and remains registered, so it is `PARTIALLY_CONTAINED / TECHNICAL_CONTAINMENT_DEBT` for Pilot hardening, not an active MVP product dependency or automatic Pilot P0 while Pilot upload/routes remain absent.

Top product gaps: exact manual-confirmation SLA closure; specialist-first; map; full Pet Profile; shift inventory; change requests; operator workspace; Smart Reallocation; Result/Diary; confirmed OCR.

Top architectural gaps: BookingChangeRequest; Reallocation domain; DiaryEntry; Result; specialty joins; DoctorShift generation; active-slot DB invariant; replacement lineage; callback SLA; OCR quarantine.

Strongest reuse assets: atomic Booking Core; slot capacity/locks; idempotency/version fences; capability/tenant isolation; catalog; schedule shell; journal; audit; outbox.

Do not rewrite: Booking transaction primitive; authorization/capability foundation; clinic/location tenant model; audit/outbox reliability; catalog/schedule/Portal shells.
