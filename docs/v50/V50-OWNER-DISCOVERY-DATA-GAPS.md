# V50 Owner Discovery data-authority gaps

Status: `R2E SPECIALIST INTEGRATION IMPLEMENTED DEFAULT-OFF / PRODUCTION ROLLOUT BLOCKED`

This register separates the V50 `#catalog`, `#clinic`, and `#booking` product
composition from fields currently available in the Owner Pilot projections.
The UI stays useful while absent fields are omitted rather than synthesized.

## Reconciliation matrix

| V50 element | Current source | Classification | R2B action |
| --- | --- | --- | --- |
| Catalog task framing | Frontend-owned copy | IMPLEMENT_NOW | Owner-oriented heading and concise next-step explanation |
| Clinic identity, address, phone | `GET /v1/owner/clinic-catalog` | IMPLEMENT_NOW | One whole-card continuation control |
| Catalog availability, price, confirmation | `decisionSummary` in authenticated Owner catalog | UI_INTEGRATED | Catalog renders clinic-local nearest time, localized `FROM` price, and manual-confirmation expectation |
| Search, filters, recommendation and comparison | No query/ranking projection | DATA_AUTHORITY_GAP | Omit search/ranking UI and comparison screen |
| Clinic image, trust and capabilities | No approved public projection | DATA_AUTHORITY_GAP | Use neutral code-native identity marker only |
| Clinic context and service choice | Clinic detail projection | IMPLEMENT_NOW | Retain clinic context and one selected service |
| Informational service price | `services[].price` | IMPLEMENT_NOW | Locale-format without changing amount or payment meaning |
| Specialists, equipment and trust content | Closed bounded projection exists behind default-off `OWNER_V50_DOCTOR_DISCOVERY`; default response remains `specialists=[]` | IMPLEMENTED_DEFAULT_OFF / BLOCKED_BY_DATA | Do not render specialist UI; omit equipment/trust |
| Selected clinic/service/Pet | Existing journey state and Owner Pet read | IMPLEMENT_NOW | Show context through Availability |
| Calendar dates and slots | Availability projection / DoctorShift inventory | IMPLEMENT_NOW | Date-first selection and version-fenced continuation |
| Selected doctor and informational price in Availability | Selected-service `informationalPrice` is projected; doctor remains absent | PARTIAL / UI_INTEGRATED | Availability repeats the selected-service price; doctor remains omitted |
| Insurance, emergency, Booking Review/Status | Outside R2B | EXCLUDED | No implementation |

## Required additive projections

| V50 use case | Required field or projection | Authority/domain | Server derivation | Proposed additive API change | MVP priority | UI while absent |
| --- | --- | --- | --- | --- | --- | --- |
| Surface next availability in Catalog | `decisionSummary.nextAvailability` per clinic/location | Appointment slots + active Clinic Service Catalog | Server time; earliest OPEN future slot with remaining capacity on an active exact-location service | UI_INTEGRATED: clinic-local Today/Tomorrow/date formatting | High | Rendered without device-time reinterpretation |
| Surface catalog price | `decisionSummary.informationalPrice` | Active exact-location Clinic Service Catalog | Same-currency minimum only; `FROM`; mixed currencies fail closed to `null` | UI_INTEGRATED | High | Null price is omitted without fallback |
| Search/filter by owner task | Normalized supported service taxonomy and query-match reason | Clinic Service Catalog | Partly; requires product taxonomy | Add `serviceCategories[]` and a server-evaluated search/filter contract | Medium | Render an unranked clinic list |
| Distance/travel time | Owner-consented origin, clinic coordinates, route distance and observed time/source | Location/Maps integration | Distance yes; travel time requires provider | Add a privacy-reviewed location input and `distanceMeters`/`travelDurationMinutes` with provenance/freshness | Low | Show address only |
| Confirmation explanation | `decisionSummary.confirmation.mode=MANUAL`; no SLA | PILOT_V1 Booking Core policy | Explicit Pilot invariant; no duration inferred | UI_INTEGRATED | High | Owner-facing request/confirmation copy rendered |
| Clinic media | Approved public asset ID/URL, alt text, version and publication consent | Clinic public-content domain | No; requires governed content | Add allowlisted `publicMedia` projection | Low | Use neutral code-native marker |
| Capabilities/equipment | Public capability codes, display labels, verification source/date | Clinic capability registry | Yes if registry becomes normative | Add `publicCapabilities[]` with verification metadata | Medium | Omit capability claims |
| Trust/reviews | Verified-visit aggregate, sample size, period and methodology version | Analytics/trust domain | Yes after normative metric contract | Add `trustSummary`; never expose arbitrary marketplace ratings | Low | Omit ratings and recommendation claims |
| Recommendation reason | Ranked candidate score inputs and owner-safe reason codes | Discovery/ranking domain | Only after product-approved ranking policy | Add a server-authored ranked discovery endpoint with reason codes | Low | Do not label clinics recommended |
| Specialists in Clinic/Booking | `services[].specialists[]` integration contract; empty unless exact-true rollout flag is enabled | Public-profile consent plus DoctorService/DoctorShift authority | Enabled integration requires exact active staff/DoctorService, published shift and published doctor-bound slot; production activation remains blocked | IMPLEMENTED_DEFAULT_OFF / BLOCKED_BY_DATA | Medium | Current R2D UI remains unchanged |
| Service grouping | Stable category code/label/order per service | No authoritative service→specialty relation | Cannot derive from service name or a doctor's specialty | `services[].specialty=null`; ARCHITECTURAL_SLICE_REQUIRED | Medium | Render a compact flat list |
| Booking summary price | `informationalPrice` in Availability | Exact selected Clinic Service Catalog row | Reuses the service price columns; slot rows contain no price copy | UI_INTEGRATED | High | Rendered in selected-context summary |

## Comparison decision

`DECISION_COMPARISON_BLOCKED_BY_DATA_AUTHORITY=YES`

R2C supplies truthful clinic/location-level next availability, same-currency
minimum informational price, and Pilot manual confirmation. V50 comparison
remains blocked because it still lacks a product-approved comparable service
taxonomy/identity, explicit availability freshness policy, distance/travel
provenance, public capabilities, and recommendation/ranking reasons. A
comparison screen would still imply unsupported equivalence and ranking.

## R2C derivation semantics

The catalog remains capped at 50 rows and preserves the S09 eligibility rule:
a clinic/location without a future bookable slot is excluded. The DTO still
models `nextAvailability` as nullable so a missing authority can never become a
fabricated timestamp. One SQL statement uses PostgreSQL `clock_timestamp()`,
exact clinic/location/service joins, OPEN state, positive remaining capacity,
and `starts_at, slot.id` ordering. Price is the minimum across active services
only when they share one currency; otherwise it is `null`, with no conversion.
Confirmation is the existing PILOT_V1 manual-confirmation invariant. Availability
reads the selected service's current informational price; price is not stored or
projected per slot and does not represent payment.

## R2E specialist authority verdict

R2E implements the bounded projection only behind the exact-true,
default-off `OWNER_V50_DOCTOR_DISCOVERY` mitigation required by the normative
consent debt. It activates only after the exact-true dependency chain
`VETHELP_OWNER_V50_SHELL` → `OWNER_V50_CATALOG` →
`OWNER_V50_CLINIC_DETAIL`, plus `OWNER_DOCTOR_DISCOVERY_SCHEMA_READY_V1`, and
only when its own value is the literal string `true`; uppercase, mixed-case and
whitespace variants remain disabled. With any dependency disabled, service
`specialty=null` and
`specialists=[]` are returned without referencing later workforce tables; a
decorative `doctor_id` cannot cause disclosure. Production activation remains
blocked because `public_booking_enabled` is not auditable publication consent.

The enabled integration query reuses Doctor, Specialty, the clinic staff bridge,
DoctorService, DoctorShift and generated appointment-slot lineage present in the
shared integration schema. A doctor appears only for the exact active service
and location when the doctor is active/public-bookable, the staff assignment is
an active VETERINARIAN, DoctorService is active, DoctorShift is PUBLISHED, and
the nearest slot is PUBLISHED/OPEN/non-stale/future/positive-capacity and inside
the same shift and 14-day horizon. Resource-bound eligibility also requires the
exact active resource. Past, draft, full, inactive, wrong-role, cross-service
and mismatched doctor/slot lineage are excluded.

The response is bounded to 50 services and 10 specialists per service, ordered
by nearest availability, safe display name and doctor UUID. The allowlist is
only `doctorId`, `displayName`, authoritative `specialtyName`, and clinic-local
`nextAvailability`; blank/UUID-shaped names and all contact, employee, role,
membership, auth, HR and audit fields are excluded. Enabled integration is one
database round trip and uses the existing published-slot index.

This worktree still lacks the checked-in migration that creates the staff
bridge, DoctorService, DoctorShift and publication lineage used by the enabled
branch. The flag must remain false until that authoritative migration is
integrated; the implementation does not make database drift a default runtime
dependency.

The availability route now accepts an optional UUID `doctorId` only while the
same discovery gate is enabled. A selected-doctor read returns only slots whose
doctor, staff bridge, DoctorService, DoctorShift, publication, freshness,
capacity and optional resource lineage match the selected clinic, location and
service. An unknown or ineligible doctor returns the valid context with an empty
slot list, avoiding a doctor-existence oracle. While the gate is disabled, a
doctor-filtered read is masked as unavailable before any workforce table is
queried. The Pilot hold payload remains closed and slot-identity based; because
only an exact doctor-bound slot can be selected from this read, the existing
slot identity and version remain booking authority without adding a client
supplied `doctorId` to the write contract.

A representative selected-doctor availability `EXPLAIN (ANALYZE, BUFFERS)`
used the existing `appointment_slots_doctor_search_idx`, required no new index,
and completed in 0.350 ms on the focused shared-schema fixture. The service and
specialist projections each remain a single bounded database statement; R2E
adds no per-service or per-doctor query loop.

Classifications: specialist integration `IMPLEMENTED_DEFAULT_OFF`; public
identity `BLOCKED_BY_DATA`; specialty taxonomy/grouping
`ARCHITECTURAL_SLICE_REQUIRED`; doctor availability `IMPLEMENTED_DEFAULT_OFF`;
doctor-slot authority `IMPLEMENTED_DEFAULT_OFF` pending checked-in schema;
comparison `BLOCKED_BY_DATA`.

`SERVICE_TAXONOMY_AUTHORITY_GAP=YES`

`DOCTOR_SLOT_AUTHORITY_GAP=NO` for the enabled integration contract;
production rollout remains blocked by consent and reproducible schema authority.

## Content-quality issue

The local seed currently returns backend-owned English service names such as
`Initial visit` and multiple distinct service IDs with the repeated display name
`Smart reallocation visit`. Production UI must not silently translate names or
collapse distinct authoritative IDs. Local demo presentation should be repaired
in governed seed/content ownership, not in the Owner client.
