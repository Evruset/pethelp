# Total MVP Capability Matrix

Classification: `I` implemented, `P` partial/foundation, `M` missing, `L` legacy-only, `D` deferred/disabled. Semantic match: `Y`, `Δ` or `N`. Complexity: S/M/L/XL. Runtime evidence is a concise source family; it is not a UAT claim.

| ID | Capability | User/app | Target behavior | Current implementation / evidence | API / DB / UI / V50 | Match | Class | Pri | Cx | Dependency | Wave |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-001 | OTP authentication | Owner channels | secure OTP session | Mobile auth bounded; auth specs | auth / session / Mobile / profile adaptation | Δ | P | P0 | M | provider | 2 |
| CAP-002 | Session refresh/logout | all | fail-closed sessions | auth/session implemented | auth / token / Mobile+Portal / shell | Y | I | P0 | M | 001 | 0 |
| CAP-003 | Role authorization | staff | explicit role/capability | capability evaluator tests | auth / membership / Portal / Clinic V50 | Y | I | P0 | L | none | 0 |
| CAP-004 | Tenant isolation | clinic | exact clinic/location | HTTP authority matrices | auth / membership / Portal / Clinic V50 | Y | I | P0 | L | 003 | 0 |
| CAP-005 | Owner profile read | Owner | bounded self profile | partial auth/home projection | owner / owner / Mobile / OWN-016 | Δ | P | P1 | M | 001 | 4 |
| CAP-006 | Owner profile UI Mobile | Owner Mobile | profile/security screen | composed/partial | owner / owner / partial / OWN-016 | Δ | P | P1 | M | 005 | 4 |
| CAP-007 | Owner profile UI Web | Owner Web | profile/security screen | no app | owner / owner / missing / OWN-016 | N | M | P1 | M | APP-002 | 2 |
| CAP-008 | Pet list | Owner | owned pets | owner pet APIs/screens | owner-pet / pet / Mobile / OWN-009 | Δ | P | P0 | M | 001 | 4 |
| CAP-009 | Pet profile | Owner | bounded authoritative profile | backend foundation; Mobile partial | owner-pet / pet / partial / OWN-010 | Δ | P | P0 | L | 008 | 4 |
| CAP-010 | Pet edit/archive | Owner | version-fenced change | legacy/V50 foundation | owner-pet / pet / legacy UI / OWN-010 | Δ | P | P1 | L | 009 | 4 |
| CAP-011 | Diary read | Owner | persistent timeline | legacy projection only | diary / derived rows / legacy / OWN-011 | N | L | P0 | L | Result | 7 |
| CAP-012 | DiaryEntry persistence | Owner | provenance-bearing entry | absent | future / missing / missing / adapted OWN-011 | N | M | P0 | XL | 069 | 7 |
| CAP-013 | Diary Mobile UI | Owner Mobile | timeline/documents | no first-MVP runtime | future / missing / missing / OWN-011 | N | M | P0 | L | 012 | 7 |
| CAP-014 | Diary Web UI | Owner Web | timeline/documents | absent | future / missing / missing / OWN-011 | N | M | P0 | L | 012,APP-002 | 7 |
| CAP-015 | Document metadata | Owner/Clinic | secure metadata | reusable foundation | document / metadata / partial / OWN-011 | Δ | P | P0 | L | storage | 7 |
| CAP-016 | Private document delivery | Owner | authorized signed access | partial/legacy | document / object ref / partial / OWN-011 | Δ | P | P0 | L | storage | 7 |
| CAP-017 | Clinic registry | Owner | published clinics | catalog implemented | catalog / clinic / Mobile / OWN-002 | Y | I | P0 | M | scope | 4 |
| CAP-018 | Location registry | Owner | published locations | catalog implemented | catalog / location / Mobile / OWN-002/004 | Y | I | P0 | M | 017 | 4 |
| CAP-019 | Specialty taxonomy | Owner/Clinic | approved taxonomy | shallow IDs only | catalog / partial / partial / OWN-018 | N | P | P0 | XL | Product | 3 |
| CAP-020 | Doctor public read | Owner | consent-safe facts | bounded default-off foundation | catalog / staff / partial / OWN-019 | Δ | P | P0 | L | consent | 4 |
| CAP-021 | Service catalog | Owner/Clinic | published services/prices | implemented foundation | catalog / service / Mobile+Portal / OWN-004 | Y | I | P0 | M | 017 | 3 |
| CAP-022 | DoctorService relation | all | explicit eligibility/duration | same-location staff↔catalog doctor bridge and versioned DoctorService eligibility implemented | schedule / `doctor_services` / Portal / V50 adaptation | Y | I | P0 | XL | 019-021 | 3 |
| CAP-023 | Clinic configuration | Clinic | services/doctors/specialties | services/staff partial | schedule APIs / tables / Portal partial / Clinic V50 | Δ | P | P0 | L | 019-022 | 3 |
| CAP-024 | Working hours | Clinic | base hours | schedule API exists | schedule / working hours / Portal / CLN-002 | Y | I | P1 | M | 004 | 3 |
| CAP-025 | Schedule periods | Clinic | reusable intervals | implemented | schedule / periods / Portal / CLN-002 | Y | I | P1 | L | 024 | 3 |
| CAP-026 | DoctorShift model | Clinic | typed work interval | typed, timezone-bound, non-overlapping DoctorShift implemented | schedule / `doctor_shifts` / Portal / CLN-002 adaptation | Y | I | P0 | XL | 022,024 | 3 |
| CAP-027 | Shift lifecycle | Clinic | draft/publish/block | version-fenced draft/generate/publish/unpublish/block/cancel lifecycle implemented | schedule / shift+run state / Portal / Journal adaptation | Y | I | P0 | XL | 026 | 3 |
| CAP-028 | Slot generation | Clinic | service-duration slots | deterministic service-duration generation into canonical slots with run lineage | schedule / slots+runs / Portal preview / Journal adaptation | Y | I | P0 | XL | 022,026 | 3 |
| CAP-029 | Slot blackout | Clinic | block inventory | implemented foundation | schedule / blackout / Portal / CLN-002 | Y | I | P1 | M | 028 | 3 |
| CAP-030 | Published inventory | Owner | queryable safe inventory | only published, valid generated canonical slots reach shared Owner availability | availability / slots / Expo iOS+Android+Web / OWN-005 | Y | I | P0 | L | 027-029 | 3 |
| CAP-031 | Availability read | Owner | authoritative slots | implemented | booking options / slots / Mobile / OWN-005 | Y | I | P0 | L | 030 | 1 |
| CAP-032 | Cross-clinic discovery | Owner | ranked clinics | catalog only | catalog / clinic / Mobile partial / OWN-002 | N | P | P0 | XL | 019,030 | 4 |
| CAP-033 | Map discovery | Owner | map/list/geo | absent | future / geo index / missing / OWN-002/003 | N | M | P0 | XL | 032 | 4 |
| CAP-034 | Specialist-first search | Owner | specialty/date/geo first | doctor catalog partial | future / relations/index / partial / OWN-018 | N | P | P0 | XL | 019,022,032 | 4 |
| CAP-035 | Clinic comparison | Owner | bounded compare | prototype only | future / projection / missing / OWN-003 | N | M | P1 | L | 032 | 4 |
| CAP-036 | Booking Core claim | Owner | atomic protected request | strong transaction | booking / holds+slots / Mobile / OWN-005/006 | Y | I | P0 | XL | 031 | 1 |
| CAP-037 | Booking idempotency | Owner | payload-bound replay | implemented/tested | booking / idempotency / none / V50 semantic | Y | I | P0 | L | 036 | 1 |
| CAP-038 | Booking version fence | all | stale command rejection | implemented/tested | booking / version / clients / V50 semantic | Y | I | P0 | L | 036 | 1 |
| CAP-039 | Manual confirmation mode | Pilot | default mode | implemented Pilot branch | booking / hold / all / adapted V50 | Y | I | P0 | L | 036 | 1 |
| CAP-040 | 15-minute SLA write | Pilot | DB-authoritative deadline | explicit 15-minute SQL paths | booking / confirmation_sla / clients / adapted V50 | Y | I | P0 | M | 039 | 1 |
| CAP-041 | Late confirm denial | Clinic | no late resurrection | transaction checks DB time | booking / hold lock / Queue / Journal | Y | I | P0 | L | 040 | 1 |
| CAP-042 | Late reject behavior | Clinic | no mutation after expiry | implemented; real-PG late/race evidence | booking / hold / Queue / Journal | Y | I | P0 | L | 040 | 1 |
| CAP-043 | Expiry capacity release | system | exactly once | worker/read-path foundation/tests | booking / counters / status / V50 | Y | I | P0 | XL | 040 | 1 |
| CAP-044 | Owner pending status | Owner | authoritative read | implemented | owner bookings / hold / Mobile / OWN-008 | Y | I | P0 | M | 039 | 1 |
| CAP-045 | Owner SLA countdown | Owner | server-time countdown | implemented; server-calibrated presentation and authoritative zero readback | owner status / deadline / Mobile / adapted OWN-008 | Y | I | P0 | M | 040,044 | 1 |
| CAP-046 | Confirmed readback | Owner | authoritative terminal | implemented/tested | owner status / hold+appointment / Mobile / OWN-008 | Y | I | P0 | M | 041 | 1 |
| CAP-047 | Rejected readback | Owner | authoritative terminal | implemented/tested | owner status / hold / Mobile / OWN-008 | Y | I | P0 | M | 042 | 1 |
| CAP-048 | Expired readback | Owner | authoritative terminal | implemented/tested; no local terminal fabrication | owner status / hold / Mobile / OWN-008 | Y | I | P0 | M | 043 | 1 |
| CAP-049 | Clinic Queue read | Clinic | ordered SLA queue | mature runtime | queue / holds+slots / Portal / Journal | Y | I | P0 | L | 039 | 1 |
| CAP-050 | Queue confirm | Clinic | authorized atomic decision | mature runtime | booking command / hold+appointment / Portal / Journal | Y | I | P0 | L | 049 | 1 |
| CAP-051 | Queue reject | Clinic | reasoned terminal decision | mature runtime | booking command / hold / Portal / Journal | Y | I | P0 | L | 049 | 1 |
| CAP-052 | Booking Journal runtime | Clinic | primary operational workspace | prototype only; Queue separate | future/BFF / projection / missing / Journal 104 | N | M | P0 | XL | 049,Schedule | 3 |
| CAP-053 | Booking history | Owner | list/timeline | backend/legacy foundation | owner bookings/events / audit / Mobile partial / OWN-007/008 | Δ | P | P0 | L | 044-048 | 5 |
| CAP-054 | Direct cancellation | Owner | current direct release | implemented runtime | cancel / hold+slot / Mobile / OWN-008 | N | L | P1 | L | 036 | retire |
| CAP-055 | Cancellation request | Owner/Ops | preserve booking pending resolution | absent | future / change request / missing / adapted OWN-008 | N | M | P0 | XL | Operations | 5 |
| CAP-056 | Reschedule request | Owner/Ops | preserve booking pending resolution | absent | future / change request / missing / extension | N | M | P0 | XL | Operations | 5 |
| CAP-057 | BookingChangeRequest | Ops | lifecycle/SLA/outcome | absent | future / new aggregate / missing / V50 reuse | N | M | P0 | XL | 055-056 | 5 |
| CAP-058 | Callback task | Ops | owned SLA task | absent | future / task / missing / V50 reuse | N | M | P0 | L | 057 | 5 |
| CAP-059 | Operations workspace | Operator | work queues/context/outcome | absent | future / new tables / missing / V50 system | N | M | P0 | XL | 057-058 | 5 |
| CAP-060 | Alternative slot foundation | Owner/Clinic | same-location proposal | implemented legacy foundation | alternative / swap / legacy UI / OWN-020 | Δ | L | P1 | XL | Booking | 6 |
| CAP-061 | Reallocation policy search | Ops | cross-clinic candidates | absent | future / policy/index / missing / adapted OWN-020 | N | M | P0 | XL | 032,059 | 6 |
| CAP-062 | Reallocation offer | Owner | safe offer/decision | absent target | future / offer / missing / OWN-020 adaptation | N | M | P0 | XL | 061 | 6 |
| CAP-063 | Replacement Booking B | system | atomic new booking | absent | future / booking+lineage / missing / semantic | N | M | P0 | XL | 062 | 6 |
| CAP-064 | Booking lineage | all | A→B provenance | absent | future / lineage / views / semantic | N | M | P0 | L | 063 | 6 |
| CAP-065 | Preserve Booking A | system | active until B accepted | absent target | future / booking / clients / semantic | N | M | P0 | XL | 063 | 6 |
| CAP-066 | Visit workspace | Veterinarian | assigned visit | bounded runtime | visit / appointment / Portal / CLN-003 | Δ | P | P0 | L | confirmed booking | 7 |
| CAP-067 | Visit completion | Veterinarian | authoritative completion | bounded command exists | visit / appointment / Portal partial / CLN-003 | Δ | P | P0 | XL | 066 | 7 |
| CAP-068 | No-show | Clinic | terminal reason/audit | missing target | future / visit / missing / Journal | N | M | P1 | L | 066 | 7 |
| CAP-069 | Result aggregate | Veterinarian | signed/amendable result | absent | future / result / missing / CLN-003 adaptation | N | M | P0 | XL | 067 | 7 |
| CAP-070 | Result document upload | Clinic | private result file | document foundation only | future/document / object ref / missing / V50 | N | M | P0 | XL | 015,069 | 7 |
| CAP-071 | Diary publication | system | Result→DiaryEntry | absent | future / diary / missing / OWN-011 | N | M | P0 | XL | 012,069 | 7 |
| CAP-072 | Owner notification event | Owner | result/status notification | outbox/projector foundation | notifications / rows / no inbox / OWN-015 | Δ | P | P0 | L | 046-048,071 | 7 |
| CAP-073 | Notification inbox Mobile | Owner Mobile | in-app inbox | absent | future / notification / missing / OWN-015 | N | M | P1 | M | 072 | 7 |
| CAP-074 | Notification inbox Web | Owner Web | in-app inbox | absent | future / notification / missing / OWN-015 | N | M | P1 | M | 072,APP-002 | 7 |
| CAP-075 | Owner Mobile shell | Owner | native navigation | implemented bounded | APIs / n/a / Mobile / V50 | Δ | P | P0 | L | none | 2 |
| CAP-076 | Owner Web shell | Owner | production responsive portal | absent | APIs / n/a / missing / V50 system | N | M | P0 | XL | APP-002 | 2 |
| CAP-077 | Clinic Portal shell | staff | scoped navigation | implemented foundation | session/BFF / n/a / Portal / V50 Clinic | Y | I | P0 | L | 003-004 | 0 |
| CAP-078 | Operations shell | operator | bounded internal IA | absent | future / n/a / missing / V50 system | N | M | P0 | L | 059 | 5 |
| CAP-079 | Partner QR intake | public | campaign/deep link | partial intent only | future / attribution / Mobile partial / V50 adaptation | N | P | P1 | L | Web/Mobile | 8 |
| CAP-080 | Attribution persistence | system | QR→booking→visit | absent | future / attribution / none / n/a | N | M | P1 | L | 079 | 8 |
| CAP-081 | Pilot analytics | Product | minimal funnel/SLA | telemetry fragments | future / projection / no UI / V50 system | Δ | P | P1 | L | 080 | 8 |
| CAP-082 | Audit trail | internal | immutable business audit | strong foundation | audit / audit rows / Portal partial / V50 | Y | I | P0 | L | domains | 0 |
| CAP-083 | Transactional outbox | system | atomic events | strong foundation | outbox / outbox rows / none / n/a | Y | I | P0 | XL | domains | 0 |
| CAP-084 | Observability | operations | sanitized metrics/traces | strong fragments | metrics / n/a / ops partial / n/a | Δ | P | P0 | L | 082-083 | 9 |
| CAP-085 | Pilot scope profile | deploy | fail-closed Pilot | explicit profile but legacy default | config / n/a / gates / n/a | Δ | P | P0 | L | deploy | 9 |
| CAP-086 | Payment containment | Pilot | at clinic only | Pilot module/route gates | scope / legacy tables / hidden / over-scope V50 | Y | D | P0 | M | 085 | 9 |
| CAP-087 | MIS containment | Pilot | optional/not required | Pilot omitted | scope / legacy / hidden / n/a | Y | D | P1 | M | 085 | 9 |
| CAP-088 | Telemed/insurance/emergency containment | Pilot | disabled | Pilot gates/tests | scope / legacy / hidden / over-scope V50 | Δ | D | P0 | L | 085 | 9 |
| CAP-089 | OCR product | Owner | deferred | legacy worker only | none Pilot / legacy JSON / no UI / n/a | N | D | P2 | XL | Product | deferred |
| CAP-090 | OCR runtime containment | Pilot | cannot affect active Pilot | routes absent; worker registered/default-enabled debt | config/worker / legacy / hidden / n/a | Δ | P | P1 | M | 085 | 9 |

Total rows: **90**. Stable `CORE-001..CORE-045` remain in `MVP-CORE-IMPLEMENTATION-RECONCILIATION.md`; this cross-application `CAP-*` register supplements rather than deletes them.
