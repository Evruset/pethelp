# PetHelp v1.5 transition roadmap

| Wave | Scope | Gate |
|---|---|---|
| 0 | Baseline, gap register, boundaries, roadmap, risks, test strategy | Documentation review; no runtime change |
| 1 | Additive clinic contract profile, policy resolver, dual-mode booking, OpenAPI and real-stack evidence | Human approval after evidence package |
| 2 | Cancellation, No_Show, reschedule proposal and alternatives lifecycle | Separate product/architecture approval |
| 3 | Visit, immutable result, amendments and owner diary; reconcile existing draft PR | Separate approval; no parallel rewrite |
| 4 | Appointment-scoped medical sharing and owner-confirmed OCR authority | Consent/privacy approval |
| 5 | Provisional accounts, support/disputes, suspension/termination, deletion and referral | Separate bounded slices |
| 6 | Visit confirmation and configurable B2B billing | Tariff and operational policy approval |
| 7 | Premium subscriptions and resource-scoped family access through entitlements | Pricing/entitlement approval |

## Wave 1 planned slices

1. Audit migration chain and legacy automatic-confirm transaction.
2. Add an additive, auditable clinic contract profile with manual default.
3. Add a fail-closed `BookingPolicyResolver`.
4. Replace manual/automatic decisions in booking creation with resolved policy while retaining runtime capability gates.
5. Prove the existing authoritative clinic-active guard covers represented suspended/terminated states, or stop Wave 1 on that missing dependency; do not implement the full lifecycle in this wave.
6. Reconcile the SRS `/appointments` and `SLOT_VERSION_STALE` sketch with the approved PILOT `/v1/booking-holds` and `BOOKING_STATE_CONFLICT` contract. This is `BLOCKED_PRODUCT_DECISION`; preserve PILOT behavior until approved. Do not create `/v15` routes.
7. Add dual-mode, authorization, idempotency, stale-version, rollback and concurrency tests.
8. Validate fresh and upgraded PostgreSQL, real Nest runtime, generated OpenAPI and rollback.
9. Stop at the human approval gate.

## Proposed governance output

- Confluence proposals: v1.5 Transition Baseline, Architecture Delta, Dual Booking Contract, Transition Roadmap.
- Jira proposal: `E-V15` with `V15-001` through `V15-008` as listed in the transition brief.
- No Jira or Confluence mutation is authorized by this repository change.
