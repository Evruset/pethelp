# OWN-003 — Clinic Comparison Contract

Status: `PROPOSED / PRODUCT OWNER DECISION REQUIRED`  
Scope: `PILOT_V1`, Owner App, read-only comparison  
Source UI: `prototype-v50/index.html#decision-comparison`  
Authoritative runtime: current Owner Catalog, Clinic Detail, Doctor Discovery and Availability contracts

## 1. User journey

The bounded journey is:

1. Open the eligible Owner catalog.
2. Select two or three **clinic locations** identified by the exact pair
   `{clinicId, locationId}`.
3. Open comparison. Never merge different locations of one clinic into one row.
4. Compare only authoritative values. Missing or non-comparable values render
   `Неизвестно`; they do not affect a recommendation because Pilot has no
   recommendation algorithm.
5. Choose one location.
6. Choose or confirm one active service at that location.
7. Read authoritative availability for the exact
   `{clinicId, locationId, serviceId}` context.
8. Choose a returned slot and continue through the existing booking journey.

Selection eligibility is inherited from `GET /v1/owner/clinic-catalog`: only
active clinics/locations with an active service and a future OPEN slot with
remaining capacity are selectable. Comparison must revalidate each selected
location before handoff; it must not turn a stale comparison row into booking
authority.

For service-specific comparison, the logically complete journey is instead:

`Catalog → select 2–3 locations → select one common service → compare → choose location → confirm preselected service → availability → booking`.

The fixed target journey places service selection after comparison. Under the
current DTO that means price and nearest service slot cannot be compared
safely; this is an explicit Product Owner decision, not a client inference.

## 2. V50 versus PILOT_V1

V50 visibly compares three options using time/freshness, confirmation mode,
price, capabilities, expected waiting, reviews, distance and a generated
safety/value recommendation/trust score. It also carries pet/medical context
and offers recommended/backup labels.

PILOT_V1 permits the location-scoped catalog, active services, informational
price, authoritative availability, manual clinic confirmation and booking.
It excludes telemedicine, emergency routing, insurance, payment and advanced
analytics. No current contract authorizes trust scores, medical fit/safety
ranking, recommendation labels, queue-wait predictions, review-based ranking
or an assertion that a user may travel before an authoritative confirmed
booking status.

Therefore the Pilot comparison is a neutral side-by-side fact view. It must
not reproduce V50 scores, `Рекомендуем`, `лучший баланс`, safety conclusions or
similar-case claims.

## 3. Data availability matrix

| Criterion | User value | Authoritative source | Current DTO field | Level | Selected-service context | Status | Required API change |
|---|---|---|---|---|---|---|---|
| Clinic/location name | Identify option | Owner catalog/detail | `name`, `{clinicId,locationId}` | location row with clinic display name | No | `AVAILABLE` | None |
| Branch address | Distinguish and plan visit | Owner catalog/detail | `address` | location | No | `AVAILABLE` | None |
| Public phone | Contact branch | Owner catalog/detail | `phone` | location | No | `AVAILABLE` | None |
| Active services | Know whether branch can help | Owner detail | `services[].{serviceId,name}` | location/service | No for display; yes for comparison | `AVAILABLE` as a list | Option B: expose stable `serviceCode` for cross-location identity |
| Price of one service | Compare expected cost | Owner detail | `services[].price.{kind,amount,currency}` | service at location | Yes | `AVAILABLE`, but cross-location comparability is `MISSING` | Option B: stable `serviceCode`; retain `INFORMATIONAL` semantics |
| Nearest service slot | Compare timing | Owner availability | first ordered `slots[].{startsAt,localDate,localTime}` | location/service | Yes | `DERIVABLE` after exact service resolution | No aggregate endpoint required; Option B adds freshness/mode fields |
| Booking confirmation mode | Explain request versus immediate booking | Public booking/availability model and Pilot policy | Not present in `OwnerAvailabilityDto`; public model has `confirmationMode` | slot/location | Yes | `MISSING` from Owner contract | Option B: add closed `confirmationMode` to Owner availability |
| Availability freshness | Warn about aging/stale values | Public availability model | Not present in `OwnerAvailabilityDto`; public model has `sourceUpdatedAt`, `freshness` | availability snapshot/slot | Yes | `MISSING` from Owner contract | Option B: add `sourceUpdatedAt` and closed `freshness` |
| Veterinarians | Show discoverable staff | `GET /v1/clinics/{clinicId}/doctors?locationId=...` | doctor `id`, `displayName`, `title`, `nextAvailableAt`, freshness | clinic/location/doctor | Optional | `AVAILABLE` for discovery; service compatibility is not established | None for neutral doctor count/list; service filtering requires an approved compatibility contract |
| Photos | Recognize branch | None in Owner catalog/detail | none | location | No | `MISSING` | New governed media projection and provenance/consent policy |
| Ratings/reviews | Trust signal | None in Pilot Owner contracts | none | clinic/location/visit | Potentially | `MISSING` | New verified-review and aggregation contract; out of minimal MVP |
| Distance/travel time | Proximity | Public catalog can calculate clinic summary distance, but Owner location DTO hides coordinates/distance | none in Owner DTO | location/user position | No | `MISSING` for Owner comparison | Location-scoped distance field plus consent/location-input contract; travel time needs a provider |
| Additional capabilities | Know equipment/operational fit | V50 assumes verified capabilities; current Owner contract exposes none | none | location/capability | Often service-specific | `MISSING` | New allowlisted verified location-capability projection; emergency/telemedicine remain excluded |
| Expected waiting/queue | Predict visit delay | None | none | location/appointment | Yes | `MISSING` | Requires measured operational contract; out of minimal MVP |
| Recommendation/trust score | Reduce decision effort | None authorized | none | derived | Yes | `MISSING` and prohibited for this slice | Separate Product/data/governance decision; not proposed |

`DERIVABLE` means deterministic selection from authoritative data, not local
medical/business inference. The first availability slot is derivable because
the endpoint orders by `startsAt, slotId` and bounds results to 50.

## 4. Minimal read model

The UI-owned read model is ephemeral and read-only:

```ts
type ClinicLocationComparison = {
  observedAt: string;
  selectedService: {
    serviceCode: string | null;
    displayName: string | null;
  };
  locations: Array<{
    clinicId: string;
    locationId: string;
    clinicName: string;
    address: string;
    phone: string | null;
    service: null | {
      serviceId: string;
      serviceCode: string | null;
      name: string;
      price: {
        kind: 'INFORMATIONAL';
        amount: string;
        currency: string;
      };
    };
    nextAvailability: null | {
      slotId: string;
      startsAt: string;
      localDate: string;
      localTime: string;
      expectedVersion: number;
      confirmationMode: 'CLINIC_CONFIRMATION' | null;
      freshness: 'CURRENT' | 'AGING' | 'STALE' | 'UNAVAILABLE' | null;
      sourceUpdatedAt: string | null;
    };
    doctors: { known: boolean; count: number | null };
  }>;
};
```

Rules:

- exactly 2–3 distinct `locationId` values;
- every row preserves its `clinicId/locationId` pair;
- `serviceId` and `slotId` remain opaque and location-specific;
- missing/failed optional dimensions are `null`/unknown, never zero, false or
  “not available” unless the authoritative endpoint says so;
- the comparison snapshot never creates a hold and is not accepted by Booking
  Core;
- final handoff reuses the existing detail/availability revalidation and exact
  booking tuple.

## 5. API changes and reuse

### Option A — existing APIs only

Reuse:

- `GET /v1/owner/clinic-catalog?q=...`;
- `GET /v1/owner/clinic-catalog/{clinicId}/locations/{locationId}`;
- after choosing a branch/service,
  `GET .../services/{serviceId}/availability`;
- optional existing doctor discovery for neutral branch staff display.

The client may fan out at most three detail reads. It can compare identity,
address, phone and service lists. Because current Owner services have no stable
cross-location service code, it must show service-specific price and nearest
time as `Неизвестно` in the comparison itself. Those values appear only after
the user chooses the branch and its exact service. This option preserves the
requested original journey but is intentionally less informative than V50.

No new endpoint or DTO change is required.

### Option B — extended authoritative comparison

Prefer additive changes to existing endpoints:

1. Add stable, allowlisted `serviceCode` to each Owner detail service.
2. Add `sourceUpdatedAt`, closed `freshness` and closed `confirmationMode` to
   Owner availability, sourced from the authoritative slot snapshot.
3. Keep price informational and tied to the exact location-specific service.
4. Resolve the same selected `serviceCode` to each location's own `serviceId`,
   then request availability in parallel for at most three rows.

This supports a service selector before comparison results and truthful
side-by-side price/next-slot/mode/freshness. It still does not need a dedicated
comparison endpoint. Propose one only if measured fan-out latency, snapshot
consistency requirements or rate limits fail acceptance; any aggregate endpoint
must reuse the same eligibility queries and must not introduce ranking.

## 6. Price and slot comparability

- Compare prices only when all displayed rows refer to the same stable
  `serviceCode` and `price.kind === INFORMATIONAL`.
- Compare numerically only inside one ISO currency. For mixed currencies show
  each amount but no cheaper/more-expensive label.
- Do not convert currencies, calculate a final visit total or include possible
  additional procedures.
- If a location lacks the selected service, render `Услуга недоступна` and do
  not request its availability.
- Nearest time is the first slot from the authoritative exact-service
  availability response. Empty slots means `Нет доступного времени в текущем
  горизонте`, not clinic unavailability.
- `STALE` or unknown freshness remains visible and is not ranked ahead of
  current data.
- Confirmation mode describes the booking process; it is not proof of a
  confirmed appointment and never authorizes travel.
- Selecting a row revalidates location, service and slot through the existing
  journey before handoff.

## 7. Loading, empty and error states

- **Initial loading:** show 2–3 row skeletons; no partial recommendation.
- **Partial loading:** each location owns an independent loading state; loaded
  rows remain visible.
- **Empty selection:** comparison is unavailable until two eligible locations
  are selected.
- **No common service (Option B):** explain that selected branches have no
  comparable active service and return to selection.
- **No slots:** retain branch/service/price and show the bounded-horizon empty
  message.
- **Optional dimension failure:** show `Неизвестно` only for that field.
- **Required detail failure:** mark the row unavailable with Retry/Remove; do
  not render stale cached facts as current.
- **All rows failed:** full error state with Retry and Back to catalog.
- **Eligibility changed:** remove or disable the affected row after
  authoritative refresh; never continue with copied display data.

## 8. Acceptance criteria

1. User selects exactly 2–3 eligible clinic locations; duplicate locations are
   rejected while two branches of one clinic remain distinct.
2. Comparison never mixes clinic-level and location-level identity.
3. Option A renders only current DTO facts and unknowns; Option B compares one
   stable service code across locations.
4. Price comparison requires the same service and currency and always labels
   price informational.
5. Nearest time comes from exact-service authoritative availability and retains
   freshness/mode semantics when contracted.
6. No rating, recommendation, medical fit, queue prediction, photo, distance or
   capability claim is fabricated.
7. Loading, partial failure, empty, no-common-service, no-slots, stale and
   eligibility-change states are deterministic and accessible.
8. Choosing a row passes only opaque clinic/location identity into the existing
   service/availability flow; final booking tuple is revalidated.
9. Mobile and desktop have no horizontal overflow; comparison rows remain
   keyboard/screen-reader operable with touch targets at least 44 points.
10. No hold, Booking Core mutation, payment, telemedicine, insurance or
    emergency behavior is added.

## 9. Product Owner decisions

| Decision | Option A — existing data | Option B — extended authoritative data |
|---|---|---|
| User-visible value | Compare branch identity, address, phone and service lists; price/time remain unknown until branch/service selection | Compare the same selected service, informational price, nearest slot, confirmation mode and freshness across 2–3 branches |
| Journey | Preserves `compare → branch → service → availability` | Adds common-service selection before comparison result, then confirms it after branch choice |
| API dependency | None | Add `serviceCode` to Owner detail and freshness/mode fields to Owner availability |
| Calls | Up to three detail reads; one availability read after branch/service choice | Up to three detail plus three availability reads; optional doctors calls |
| Limitations | Material V50 price/time criteria are unknown; no safe cross-location service identity | Still no photos, ratings, distance, capabilities, queue estimates or recommendation score |
| Dedicated comparison endpoint | Not required | Not initially required; reconsider only from measured performance/consistency evidence |

Open decisions:

1. Choose Option A or B.
2. If B, approve moving common-service selection before the comparison result.
3. Decide whether neutral doctor count belongs in Pilot comparison; it does not
   prove service compatibility.
4. Defer or separately contract media, distance and verified capabilities.
5. Explicitly reject V50 recommendation/trust score for this slice unless a
   later governed data contract is approved.

## Verification status

- Current repository/OpenAPI-aligned Owner and public read contracts were read
  directly; historical R2B/R2D gap statements were not reused as authority.
- Latest Parity Register marks OWN-003 comparison absent and requiring a widget
  plus API/contract decision.
- Fresh Jira search was attempted twice on 2026-09-22 but the Atlassian
  connector returned HTTP 504 both for JQL and Rovo search. Therefore no Jira
  workflow/status claim or write is made; this document must be reconciled with
  the latest Jira issue before approval.

Exit state:

- `OWN003_CURRENT_CONTRACT=VERIFIED` — repository/S09/S10/S11 contract surface;
- `OWN003_V50_GAPS=DOCUMENTED`;
- `OWN003_MINIMAL_READ_MODEL=PROPOSED`;
- `OWN003_API_DELTA=DOCUMENTED`;
- `OWN003_PO_DECISION=PENDING`.
