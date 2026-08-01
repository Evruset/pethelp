# V50-CLINIC-MVP1-02 — Booking Journal UX Prototype

Status: `PROTOTYPE_READY / INTERNAL_PRODUCT_REVIEW_PASS / INTERNAL_ACCESSIBILITY_REVIEW_PASS / PRODUCT_OWNER_REVIEW_PENDING / RUNTIME_NOT_STARTED`

Date: 2026-08-01

## Purpose and boundary

This standalone prototype proves the Clinic MVP product model: time × staff × pending requests × confirmed appointments × operational context × permitted administrator actions. It is not a Portal, backend, BFF, authorization, command, polling or state-machine implementation. Every person, pet, phone, ID and transition is synthetic and demonstrational.

Prototype path: `prototype-v50/clinic-booking-journal/`

Entrypoint: `prototype-v50/clinic-booking-journal/index.html`

Contract: `docs/v50/V50-CLINIC-MVP1-01-BOOKING-JOURNAL-CONTRACT.md`

## Deterministic URLs

Query contract: `index.html?state=<state>&role=<role>&date=2026-08-01`. Unknown states/roles and invalid dates render a controlled prototype error. No `localStorage`, cookies or external requests are used; URL transitions restore after reload.

The 25 states are: `reception-ready`, `admin-ready`, `veterinarian-limited`, `multi-role-ready`, `pending-request`, `request-due-soon`, `request-overdue`, `confirmed-appointment`, `alternative-selection`, `owner-decision-pending`, `reject-confirmation`, `manual-booking`, `client-lookup`, `quick-client-create`, `operational-empty`, `no-staff`, `technical-error`, `stale-retained`, `forbidden`, `slot-conflict`, `search-results`, `search-empty`, `filters-active`, `week-view`, `mobile-agenda`.

Roles: `reception`, `admin`, `veterinarian`, `multi-role`. Reception exposes administrative booking flows. Admin additionally sees target Staff/Settings navigation. Veterinarian is explicitly labelled as a limited target mode whose runtime authority requires a separate contract. Multi-role presents the non-duplicated union.

## Structure and interaction model

Desktop composition is toolbar → compact pending-SLA bar → filters → vertical-time/horizontal-staff day grid → selected-entry drawer. Demo hours are 08:00–20:00 in 30-minute steps; card height represents 30/45/60/90-minute duration. The limited Week view selects one employee and exposes bounded real visible free intervals. Drag-and-drop is absent.

Mobile is a separate presentation of the same data: compact header → date → urgent request → agenda grouped by time → full-screen detail → bottom navigation. It never compresses the desktop grid. Tablet uses compact navigation, internally scrollable calendar, filter overlay and detail overlay.

Implemented deterministic prototype interactions:

- open the authoritative-priority request from the SLA bar;
- confirm within two interactions, including submitting lock and `aria-live` result;
- retain an open request on slot conflict and promote the alternative CTA;
- choose an alternative only from visible bounded availability, review time/staff/service/price/reason, then simulate owner-decision pending;
- reject through destructive confirmation and human-readable reason;
- create a manual booking from toolbar/free slot with client, pet, service, staff, date, time, price, comment and inline validation;
- synthetic client lookup and quick client create without medical data;
- owner/pet/appointment/staff search without UUIDs;
- staff/service/status/action filters with visible selection and reset;
- Escape closes drawer/dialog/filter/search surfaces and returns focus.

## Fixtures and privacy

The embedded `demo-*` dataset contains three staff, twelve schedule entries, three pending requests (one overdue and one due soon), one alternative, break/unavailable intervals, a 90-minute procedure, five synthetic owners, six pets, five service patterns, prices and varied durations. The displayed phone is masked. No production IDs, tokens, email, real contacts, clinical record, diagnosis, payment, insurance, telemedicine or Quality data is present. Simulated actions are labelled as prototype behavior and never claim backend success.

## Viewports and accessibility

Validated viewports: 1440×900, 1920×1080, 1024×768, 768×1024, 375×812 and 412×915. The prototype uses semantic `header`, `nav`, `main`, `aside`, one `h1`, skip link, visible focus, 44×44 controls, status text plus icon/color, dialog semantics, focus return, keyboard entry navigation, live announcements, error alerts, reduced-motion and forced-colors styles. At 200% text it remains operable; page-wide horizontal overflow is absent and tablet calendar overflow stays inside its container.

Chromium assertions covered all 25 states and exact-state reload, confirm, conflict/alternative, reject/Escape, manual create, search, filters, desktop/tablet/mobile presentation and all six viewports. Result: zero console errors, page errors, failed requests, serious/critical axe violations and page-wide overflow failures.

## Manifest and evidence

Prototype manifest: `prototype-v50/clinic-booking-journal/manifest.json`

Prototype SHA-256: `b1b216b96070b7c6b092e518420f605a22b2acff7a407a7ec4db43012f17f629`

Checksum algorithm: sorted required files as `path\0content\0`; manifest and `generatedAt` excluded.

Evidence path: `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02/`

Screenshots: 37

Contact sheets: desktop core, tablet core, mobile core, state matrix

Evidence SHA-256: `7e10cc8c218176716f3ca4a619d455551d2e0efa990d5ee6a1b12cdf4e55187d`

Browser: Chromium 149.0.7827.55.

## Review status and gaps

- Automated prototype inventory: `PASS`.
- Browser interaction/responsive/keyboard/accessibility evidence: `PASS`.
- Independent Product/UX review: `PASS`.
- Independent Architecture/Security review: `PASS`.
- Independent QA review: `PASS`.
- Product-owner review: `PENDING`.
- Runtime suites: `ABSTAIN / PROTOTYPE_ONLY`.

Known gaps are intentional: no runtime projection, authority evaluation, command, staff/settings contract, manual-create backend, clinic cancellation/reschedule, live countdown/polling or production flag. The current prototype may be amended on this branch if the product owner rejects any UX point.

`V50-CLINIC-MVP1-03 / Clinic Booking Journal Backend Read Projection` is `NOT_STARTED / BLOCKED_BY_PRODUCT_OWNER_UX_ACCEPTANCE`. It may start only after explicit product-owner acceptance of this prototype.
