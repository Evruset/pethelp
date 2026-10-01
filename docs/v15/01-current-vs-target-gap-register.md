# PetHelp v1.5 current-to-target gap register

Evidence labels: `VERIFIED_CONTRACT`, `VERIFIED_CODE`, `INFERRED`, `NOT_VERIFIED`.

| BP | Target requirement | Current contract/code | Current Jira | Gap | Reuse candidate | Wave | Risk / acceptance evidence |
|---|---|---|---|---|---|---|---|
| BP-01 | Registration and login | OTP/session APIs (`VERIFIED_CODE`) | `NOT_VERIFIED` | MATCH | Auth module | 0 | Preserve auth/security regression |
| BP-02 | Owner pet card | Owner pet CRUD/profile/document APIs (`VERIFIED_CODE`) | `NOT_VERIFIED` | PARTIAL | Owner pet services | Later | Full target field/medical authority parity not audited |
| BP-03 | Clinic/specialist search | Public catalog and doctor reads (`VERIFIED_CODE`) | `NOT_VERIFIED` | PARTIAL | Public Catalog | 0/later | Consent-gated public doctor data remains a known constraint |
| BP-04 | Services and clinic-owned prices | Service/catalog/schedule management exists (`VERIFIED_CODE`) | `NOT_VERIFIED` | PARTIAL | Catalog/Schedule | Later | Target price formats and accountability need contract tests |
| BP-05 | Published availability is an offer to accept booking | Availability exists, but PILOT booking semantics remain manual (`VERIFIED_CODE`) | `NOT_VERIFIED` | CONTRADICTION | Schedule and availability reads | 1 | Response must expose authoritative semantics |
| BP-06 | Atomic auto-confirm on slot selection; SRS sketches `/appointments` and `SLOT_VERSION_STALE` | PILOT uses `/v1/booking-holds`, creates `MANUAL_CONFIRM_PENDING`, and canonically returns `BOOKING_STATE_CONFLICT` for stale version; legacy non-PILOT path can confirm (`VERIFIED_CODE`) | `NOT_VERIFIED` | CONTRADICTION / BLOCKED_PRODUCT_DECISION | Booking Core transaction | 1 | Preserve current public contract until approved mapping; then real PostgreSQL race/idempotency/rollback evidence |
| BP-07 | Owner cancellation; classify under-two-hour cancellation | Cancellation exists; approved limit/consequences are unset (`VERIFIED_CODE`, `VERIFIED_CONTRACT`) | `NOT_VERIFIED` | PARTIAL | Booking cancellation | 2 | Do not invent `[CFG]` values |
| BP-08 | Clinic cancellation with mandatory reason | Decline/release command and audit exist (`VERIFIED_CODE`) | `NOT_VERIFIED` | PARTIAL | Clinic booking command | 2 | Target appointment terminology/state mapping required |
| BP-09 | Clinic proposes; owner accepts/rejects reschedule | Alternative-slot proposal and owner decision exist (`VERIFIED_CODE`) | `NOT_VERIFIED` | PARTIAL | Alternative slot flow | 2 | Must prohibit silent confirmed-slot mutation |
| BP-10 | Alternatives after clinic cancellation | Same-clinic alternative flow exists; broader cross-clinic matching not proven (`VERIFIED_CODE`) | `NOT_VERIFIED` | PARTIAL | Alternative slot/catalog | 2 | No replacement until owner selects |
| BP-11 | Only minimum booking data shared automatically | Scoped owner/clinic reads exist; exact target field set not fully reconciled (`INFERRED`) | `NOT_VERIFIED` | PARTIAL | Existing scoped read models | 4 | Field-level no-leak API tests |
| BP-12 | Explicit appointment-scoped medical sharing | No authoritative `AppointmentDataShare` confirmed (`NOT_VERIFIED`) | `NOT_VERIFIED` | NOT_IMPLEMENTED | Pet documents and memberships | 4 | Separate purpose from patient registry consent |
| BP-13 | Visit result | Implemented on draft PR #73/#78 lineage, not canonical main (`VERIFIED_CODE`) | `NOT_VERIFIED` | INTEGRATION_ONLY | Clinical Result slice | 3 | Reconcile PR; do not duplicate |
| BP-14 | Published result immutable; append-only correction | Draft integration contains version/amendment work (`VERIFIED_CODE`) | `NOT_VERIFIED` | INTEGRATION_ONLY | Clinical Result slice | 3 | Real DB immutability/cardinality evidence |
| BP-15 | OCR candidates require owner confirmation | OCR worker/document flow exists; target authority separation is not proven (`VERIFIED_CODE`) | `NOT_VERIFIED` | LEGACY_GATED | OCR ingestion | 4 | Provider must never mutate authoritative facts directly |
| BP-16 | Clinic-created provisional owner with consent assertion | No complete target flow confirmed (`NOT_VERIFIED`) | `NOT_VERIFIED` | NOT_IMPLEMENTED | Auth + Booking Core | 5 | Consent/legal decision and acceptance token security |
| BP-17 | Veterinary service payment goes directly to clinic | Legacy payment modules exist outside PILOT; target non-agent boundary not proven (`VERIFIED_CODE`) | `NOT_VERIFIED` | LEGACY_GATED | None until contract audit | Later | Must not activate with Wave 1 |
| BP-18 | Treatment complaint routed to clinic with history | No bounded target flow confirmed (`NOT_VERIFIED`) | `NOT_VERIFIED` | NOT_IMPLEMENTED | Audit/support primitives | 5 | Keep outside booking state machine |
| BP-19 | PetHelp owns booking disputes | No bounded target support-case flow confirmed (`NOT_VERIFIED`) | `NOT_VERIFIED` | NOT_IMPLEMENTED | Audit/read models | 5 | Dispute must not become booking state |
| BP-20 | Suspend clinic from new bookings | Emergency/feature infrastructure is not proof of clinic suspension policy (`VERIFIED_CODE`) | `NOT_VERIFIED` | NOT_IMPLEMENTED; BP-06 guard dependency | Capability/policy infrastructure | 5 | Wave 1 must prove an existing active-clinic guard or remain blocked; full suspension lifecycle stays Wave 5 |
| BP-21 | Terminate clinic; preserve required history | No target lifecycle confirmed (`NOT_VERIFIED`) | `NOT_VERIFIED` | NOT_IMPLEMENTED; BP-06 guard dependency | Membership/audit foundations | 5 | Wave 1 must fail closed if such a state is represented; lifecycle/retention stay Wave 5 |
| BP-22 | Owner deletion with lawful retention | Pet archival exists, but account deletion/retention orchestration is not proven (`VERIFIED_CODE`) | `NOT_VERIFIED` | PARTIAL | Pet archival and audit | 5 | Human legal decision required |
| BP-23 | Referral link/QR; partner sends no client data | No target referral flow confirmed (`NOT_VERIFIED`) | `NOT_VERIFIED` | NOT_IMPLEMENTED | Catalog links | 5 | Prove no partner personal-data ingestion |
| BP-24 | Telemedicine future boundary, outside current MVP | Legacy telemedicine exists and is excluded from PILOT (`VERIFIED_CODE`) | `NOT_VERIFIED` | LEGACY_GATED | Isolated telemed module | Later | Do not activate in Wave 1 |
| BP-25 | 60-day B2B trial and configurable billing after VisitConfirmed | Legacy billing/payment elements do not prove target tariff/visit authority (`VERIFIED_CODE`) | `NOT_VERIFIED` | NOT_IMPLEMENTED | Outbox and versioned config patterns | 6 | Fees/grace remain unset; race with No_Show |
| BP-26 | Free search/booking; Premium entitlements | Search/booking exist; target subscriptions/entitlements not confirmed (`VERIFIED_CODE`) | `NOT_VERIFIED` | PARTIAL | Auth/catalog plus future entitlements | 7 | Do not hardcode price/quota |

## Wave 1 acceptance focus

BP-05 and BP-06 are the only business-process semantics changed in Wave 1. All other rows are documentation/backlog inputs and explicit non-goals.
