# V50-CLINIC-MVP1-02 — Booking Journal UX Prototype

Status: `INITIAL_OWNER_REVIEW_CHANGES_REQUESTED / R1_INTERNAL_REPAIR_REVIEW_PASS / PRODUCT_OWNER_REVIEW_PENDING / RUNTIME_NOT_STARTED`

Date: 2026-08-02

## Purpose and boundary

This dependency-free standalone prototype proves the Clinic MVP booking-journal product model. It is not a Portal, backend, BFF, authorization, command, polling or state-machine implementation. All people, pets, contacts, IDs and transitions are synthetic demonstrations.

Prototype: `prototype-v50/clinic-booking-journal/`

Contract: `docs/v50/V50-CLINIC-MVP1-01-BOOKING-JOURNAL-CONTRACT.md`

The initial prototype received product-owner status `CHANGES_REQUESTED`. `V50-CLINIC-MVP1-02-R1` repairs data readability, vertical space usage, drawer clipping, manual-form validation, calendar-based alternative selection, viewport-driven mobile semantics and the Week-view product model. Internal repair review passes; product-owner acceptance is not inferred.

## Repaired interaction model

Desktop Day view occupies the useful viewport and internally scrolls through 08:00–20:00 in 30-minute steps. Appointment geometry represents 30/45/60/90-minute durations. Morning and afternoon fixtures expose confirmed, pending, overdue, alternative, break and unavailable treatments with text/icon/border distinctions. Free-slot affordances are employee- and time-scoped.

The 420–460px detail drawer uses an independently scrolling body and visible sticky footer. Pending requests always expose Confirm, Alternative and Reject. Status and elapsed/future SLA are separate values; the SLA bar distinguishes new count, overdue count and nearest future deadline.

Manual booking uses a two-column 680–760px composition, client lookup/result, pet/service/staff/date, bounded available slots, service-derived price, comment and a pre-submit summary. Submit is disabled until a visible time slot is selected. Alternative selection uses visible schedule availability with original/new staff, time, service, price and reason comparison.

Week view is a single-employee seven-day time×day journal with 08:00–20:00 axis, proportional appointment durations, calm free intervals, explicit break/closed treatments and no repeated `Свободно` text. Its default drawer is closed. The dedicated alternative state pins request context while available week slots remain keyboard-selectable.

Responsive composition is determined only by CSS viewport media queries, never by a state name. At 375×812 and 412×915 the desktop sidebar, filters column and time×staff grid are replaced by compact header, date strip, urgent card, grouped agenda, bottom navigation and full-screen detail/forms. On wide desktop, `mobile-agenda` remains a data scenario rather than a simulated phone.

## Deterministic states and privacy

The URL contract is `index.html?state=<state>&role=<role>&date=2026-08-01`; reload restores all 30 states. Five R1 states supplement the original set: `week-view-selected`, `week-alternative-selection`, `manual-booking-invalid`, `mobile-pending-detail` and `mobile-manual-booking`.

No `localStorage`, cookies, external dependencies or network calls are used. Fixtures contain no production identifiers, credentials, clinical records, diagnosis, payment, insurance, telemedicine or Quality data. Simulated actions do not claim backend success.

## Validation and evidence

- Node 22 inventory tests: `6/6 PASS`.
- Strict inventory: 30 states, 4 roles, 6 declared viewports, zero missing paths/external dependencies/duplicate IDs; manifest verified.
- Prototype SHA-256: `3fce953a319b8d7c0a90432ca0f07a6a4dd3ddd5446a3d40c442911595f91728`.
- Chromium 149.0.7827.55: 30/30 states and reloads; useful-height, internal-scroll, 20:00, drawer-footer, pending-actions, disabled-submit, seven-day Week, no free-cell text noise, default Week drawer, viewport replacement and page-overflow assertions pass.
- Browser errors: console/page/request `0/0/0`; axe serious/critical `0`; overflow failures `0`.
- Evidence: `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R1/`.
- Screenshots/contact sheets: `38/6`.
- Evidence checksum: `3a6da81c127858a477e184063e3bf3756dcc40b31ad53c667a83bd72ac339380`.
- Independent Product/UX review: `INTERNAL_REPAIR_REVIEW_PASS`.
- Runtime suites: `ABSTAIN / PROTOTYPE_ONLY`.

## Gate

`V50-CLINIC-MVP1-02`: `INITIAL_OWNER_REVIEW_CHANGES_REQUESTED / R1_INTERNAL_REPAIR_PASS / PRODUCT_OWNER_REVIEW_PENDING / PR_OPEN`.

The only next bounded slice is `V50-CLINIC-MVP1-03 / Clinic Booking Journal Backend Read Projection`, and it remains `NOT_STARTED / BLOCKED_BY_PRODUCT_OWNER_UX_ACCEPTANCE` until explicit owner acceptance. Production rollout and main integration remain `NOT_STARTED`.
