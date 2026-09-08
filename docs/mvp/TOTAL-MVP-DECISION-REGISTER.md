# Total MVP Decision Register

## Decided

| Decision | Value |
|---|---|
| Booking confirmation mode | `MANUAL_CONFIRM = PILOT_DEFAULT` |
| Confirmation deadline | 15 minutes, PostgreSQL/server authority |
| Automatic approval | `FUTURE_OPTIONAL_CAPABILITY` |
| Owner App | Required; one React Native/Expo application in `apps/owner-app`, targeting iOS, Android and Web |
| Owner Web | Required Expo Web target of `apps/owner-app`; no distinct production application |
| Clinic Portal | Required first-class MVP application |
| Operations | Required bounded internal application/surface |
| Operations placement | `INTERNAL_PORTAL_SECTION` initially, with separate route/layout/capability boundary; extract only if organizational/deployment needs emerge |
| Payment | At clinic; no VetHelp acquiring in first Pilot |
| MIS | Optional, not required |
| OCR | `DEFERRED_BY_PRODUCT_DECISION` |
| OCR containment | `PARTIALLY_CONTAINED / TECHNICAL_CONTAINMENT_DEBT` |
| Pet Diary | MVP Core independent of OCR |
| V50 | Canonical design/UX language |
| Product versus prototype | New Product semantics override old V50 behavior while preserving design language |
| Owner cancellation/reschedule | BookingChangeRequest; booking remains active until resolution |
| Smart Reallocation | Cross-clinic Booking B plus preserved Booking A and lineage |
| DoctorShift | Work interval generating service-duration canonical slots; implemented in Wave 3 by immutable `171954` plus approved additive correction `171955`, without a second slot identity |
| Owner Web implementation | Expo Router Web from `apps/owner-app`; shared screens/domain/client with platform-only secure session/transport and lifecycle adapters |
| Previous dedicated Next.js Owner Web decision | `SUPERSEDED_BY_PRODUCT_ARCHITECTURE_DECISION`; accidental `apps/owner-web` runtime removed after reusable security/test concepts migrated |
| Pilot exclusions | payments, mandatory MIS, telemedicine, insurance, emergency, full CRM, AI diagnosis disabled |

## Needs Product Decision

- Exact Operations staffing/queue ownership and callback business hours.
- Doctor public-profile consent revision and approved specialty taxonomy.
- Smart Reallocation eligibility/ranking policy and Owner offer lifetime.
- Result taxonomy, amendment policy and notification copy.
- Russian personal-data hosting/retention/provider approvals.

These questions do not reopen any decided item above.
