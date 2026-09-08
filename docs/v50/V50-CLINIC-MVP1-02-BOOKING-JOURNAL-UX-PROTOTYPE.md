# V50-CLINIC-MVP1-02 — Booking Journal UX Prototype

Status: `R3_OWNER_REVIEW_CHANGES_REQUESTED / R4_INTERNAL_REVIEW_PASS / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED / RUNTIME_NOT_STARTED`

Date: 2026-08-02

## Purpose and boundary

This dependency-free standalone prototype proves the Clinic MVP booking-journal product model. It is not a Portal, backend, BFF, authorization, command, polling or state-machine implementation. All people, pets, contacts, IDs and transitions are synthetic demonstrations.

Prototype: `prototype-v50/clinic-booking-journal/`

Contract: `docs/v50/V50-CLINIC-MVP1-01-BOOKING-JOURNAL-CONTRACT.md`

The initial prototype received product-owner status `CHANGES_REQUESTED`. `V50-CLINIC-MVP1-02-R1` repairs data readability, vertical space usage, drawer clipping, manual-form validation, calendar-based alternative selection, viewport-driven mobile semantics and the Week-view product model. Internal repair review passes; product-owner acceptance is not inferred.

The subsequent owner verdict `CHANGES_REQUESTED_R2` triggered a focused Week-calendar and visual repair. Prototype CSS/JS links now carry the `r2` cache key so a previously cached state inventory cannot produce an obsolete `Неизвестное состояние` page. Direct Chromium navigation proves `week-alternative-selection` loads and reloads as the exact requested state.

## R3 — Mobile CRM UX Reset

R2 owner review remained `CHANGES_REQUESTED` because the phone experience still looked like a responsive desktop derivative. R3 introduces a separate mobile CRM presentation below 600px while reusing the same synthetic fixture/state semantics. Tablet compact remains 600–839px and desktop begins at 840px; existing Day, Week, drawer, alternative, forms, filters and search remain separate regression surfaces.

The canonical mobile home is `Сегодня`: compact location/date app bar, seven-day strip plus bounded calendar control, one work summary, at most one urgent request and a chronological low-chrome agenda with current-time marker. The bottom navigation has exactly four labelled destinations — `Сегодня`, `Заявки`, `Клиенты`, `Ещё`; create is a contextual `+` action, never a navigation destination. Safe-area padding is applied on all sides.

`Заявки` defaults to overdue/due-soon/pending ordering and hides confirmed appointments. Record detail is a page-level screen with one Back model, decision-first summary, progressive disclosure, distinct Call/Client actions and a sticky action bar that temporarily replaces global navigation. Confirm, reject and owner-decision results have dedicated deterministic states.

Mobile alternative selection is a date → recommended slots → old/new review flow and never exposes the seven-column Week grid. Mobile booking is a three-step client/pet → schedule → review flow with retained draft/back state, bounded slots, disabled invalid continuation and a separate full-screen quick-client subflow. Client list/detail and `Ещё` are task-oriented bounded screens.

The canonical mobile inventory adds 22 required R3 states plus `mobile-more`; legacy `mobile-agenda`, `mobile-pending-detail` and `mobile-manual-booking` normalize to the new Today/detail/booking presentations. Unknown state count across the 53-state manifest is zero.

## R4 — Responsive CRM Design System Unification

R3 owner review remained `CHANGES_REQUESTED`: desktop, tablet and mobile used inconsistent visual identities, mobile lacked the complete calendar search/filter workflow, and the tablet filter rail compressed into unreadable content. R4 keeps the R3 task architecture while making the desktop navy/blue CRM language canonical at every breakpoint.

One shared `--vh-*` token system now defines shell, primary actions, surfaces, borders, typography, focus, radii, control sizes, spacing and closed status semantics. One local outline SVG set supplies search, filters, calendar, navigation, refresh, create, Clients, Requests, Staff, Settings, More, Back and Close. Green is limited to success/status meaning; mobile headers are navy and all primary commands are desktop blue.

The breakpoint model is wide desktop `>=1280`, compact desktop/tablet landscape `960–1279`, tablet portrait `600–959`, and mobile `<600`. Wide desktop retains the 232px filter rail. Below 1280 the rail disappears completely and Filters opens an overlay sheet; tablet uses a 72px navy icon rail and retains the calendar as the dominant work object. Mobile remains an agenda with full-screen task/search/filter surfaces.

Search uses the same synthetic fixture fields and `Поиск по расписанию` contract on all breakpoints, including debounce, clear, empty result, URL-restorable states, result-to-detail and query-preserving Back. Filters use the same Employees, Services, Statuses and action-only entities, staged application, active count and removable chips. Mobile Back and tablet Escape close overlays and return focus to their invoking controls.

## Repaired interaction model

Desktop Day view occupies the useful viewport and internally scrolls through 08:00–20:00 in 30-minute steps. Appointment geometry represents 30/45/60/90-minute durations. Morning and afternoon fixtures expose confirmed, pending, overdue, alternative, break and unavailable treatments with text/icon/border distinctions. Free-slot affordances are employee- and time-scoped.

The 420–460px detail drawer uses an independently scrolling body and visible sticky footer. Pending requests always expose Confirm, Alternative and Reject. Status and elapsed/future SLA are separate values; the SLA bar distinguishes new count, overdue count and nearest future deadline.

Manual booking uses a two-column 680–760px composition, client lookup/result, pet/service/staff/date, bounded available slots, service-derived price, comment and a pre-submit summary. Submit is disabled until a visible time slot is selected. Alternative selection uses visible schedule availability with original/new staff, time, service, price and reason comparison.

Week view is a single-employee seven-day time×day journal with 08:00–20:00 axis, eleven proportional appointment blocks, calm free intervals, explicit break/closed treatments, weekly load summary and no repeated `Свободно` text. Its default drawer is closed. The dedicated alternative state keeps a compact request comparison above the full-width calendar rather than shrinking it with a drawer; three bounded candidate slots lead to an old/new review dialog.

R2 also removes clipping from compact 30-minute Day cards, keeps the document height equal to the viewport while the full workday scrolls internally, gives manual-form selects one consistent affordance, prevents form-column overlap, and replaces ambiguous toolbar glyphs with labelled Search/Refresh controls. Drawer and modal initial focus now lands on content rather than presenting the close control as an error-like selected state.

Responsive composition is determined only by CSS viewport media queries, never by a state name. At 375×812 and 412×915 the desktop sidebar, filters column and time×staff grid are replaced by compact header, date strip, urgent card, grouped agenda, bottom navigation and full-screen detail/forms. On wide desktop, `mobile-agenda` remains a data scenario rather than a simulated phone.

## Deterministic states and privacy

The URL contract is `index.html?state=<state>&role=<role>&date=2026-08-01`; reload restores all 30 states. Five R1 states supplement the original set: `week-view-selected`, `week-alternative-selection`, `manual-booking-invalid`, `mobile-pending-detail` and `mobile-manual-booking`.

No `localStorage`, cookies, external dependencies or network calls are used. Fixtures contain no production identifiers, credentials, clinical records, diagnosis, payment, insurance, telemedicine or Quality data. Simulated actions do not claim backend success.

## Validation and evidence

- Node 22 inventory tests: `6/6 PASS`.
- Strict inventory: 30 states, 4 roles, 6 declared viewports, zero missing paths/external dependencies/duplicate IDs; manifest verified.
- Prototype SHA-256: `f0276f25fcc9bb47bfbac12c21de5e7b72e086d78b1d867a378990c1221f961e`.
- Chromium 149.0.7827.55: 30/30 states and reloads; useful-height, internal-scroll, 20:00, drawer-footer, pending-actions, disabled-submit, seven-day Week, no free-cell text noise, default Week drawer, viewport replacement and page-overflow assertions pass.
- Browser errors: console/page/request `0/0/0`; axe serious/critical `0`; overflow failures `0`.
- Evidence: `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R1/`.
- Screenshots/contact sheets: `38/6`.
- Evidence checksum: `3a6da81c127858a477e184063e3bf3756dcc40b31ad53c667a83bd72ac339380`.
- Independent R3 Product/CRM, Mobile UX and Accessibility reviews: `PASS` with no remaining vetoes.
- Runtime suites: `ABSTAIN / PROTOTYPE_ONLY`.

R2 focused Chromium evidence: 30/30 states and reloads, seven viewports, console/page/request `0/0/0`, axe serious/critical `0`, overflow `0`; nine screenshots at `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R2/`, checksum `36df4beb669da83a37d7d89cb1d441a05309cf39becfb2da6135e0628d940f17`.

R3 evidence: `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R3/`. Chromium validates 53/53 states and reloads, eight required viewports, touch targets, keyboard-reduced viewport, orientation, browser back/focus, three-step draft retention, associated error announcement, alternative selection, real browser zoom at 200%, reduced motion and forced colors. Console/page/request, axe serious/critical, overflow and sub-44px target counts are all zero. The package contains 42 screenshots, three 16–18 second MOV recordings and seven contact sheets. Screenshot checksum: `8445e8f00d0a0c218674b0126729342080d60696d3b3f6ed1f6395c09224485f`; recording checksum: `125e199a0d5a9e18a73a108d00796df7e1539dd84481ff4acfda8f37b356a957`.

R4 evidence: `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-MVP1-02-R4/`. Chromium validates 70/70 states and reloads, ten required viewports, shared design tokens, mobile search/detail/Back restoration, staged filters/chips, overlay focus return, tablet rail replacement and wide filter width. Console/page/request, axe serious/critical, overflow and sub-44px target counts are all zero. The package contains 40 screenshots and six required consistency contact sheets. Screenshot checksum: `25988dff944ed71bc9ab6e0fe475dcc31bf1a075d8059ca1272df75e8566d501`. Independent Design-System, CRM UX and Responsive reviews pass with no remaining vetoes.

R4 responsive screenshot regression harness is `IMPLEMENTED LOCALLY`. The repository evidence package at `docs/v50/evidence/V50-CLINIC-MVP1-02-R4-RESPONSIVE/` captures all ten allowed manifest viewports through 158 bounded matrix cases plus four canonical breakpoint interaction flows. Automated Chromium assertions and offline evidence verification pass; the package contains 220 screenshots within the repository size guard. It records the dirty-tree source hash, per-file SHA-256 values, full results and a local comparison gallery. Product-owner review remains `PENDING`.

## R5-A — Role and shell foundation

R5-A implements `UX-01`, `UX-02` and the bounded shell/status/responsive parts of `UX-05` and `UX-15`. A single `VH_ROLE_PRESENTATION` map owns prototype capabilities and active workspace. Reception receives Journal/Requests/Clients and decision/create actions; Admin additionally receives Staff/Settings and an explicit Management context; Veterinarian receives My Day/My Visits and read-only assigned-visit context without administrative decision controls; Multi-role shows an explicit `Режим: Ресепшен` marker. This is presentation behavior only and is not authorization enforcement.

Desktop and tablet Day/Week/List states now use one shell, header hierarchy, date navigation, view switch, search/filter/refresh/create command area and optional detail surface. Breakpoints change composition without changing landmark meaning. Hidden role controls are removed from the DOM and therefore from keyboard and accessibility order. R5-A evidence is stored at `docs/v50/evidence/V50-CLINIC-MVP1-02-R5-A-RESPONSIVE/`: 158 matrix cases plus four interaction flows, 220 screenshots, failures `0`, prototype SHA-256 `fc73b765c216a813a211efc45b1fc81e1da84f2257b7ae5eb79b87939e847f28`.

## Gate

`V50-CLINIC-MVP1-02`: `R5_A_INTERNAL_GATE_PASS / PRODUCT_OWNER_REVIEW_PENDING / LOCAL_UNCOMMITTED / PR_OPEN_AT_R1_HEAD`.

The only next bounded slice in the accepted correction order is `V50-CLINIC-MVP1-02-R5-B / Action priority and request detail`; it remains `NOT_STARTED`. R5-C, R5-D, R5-E and `V50-CLINIC-MVP1-03` remain `NOT_STARTED`. Production rollout and main integration remain `NOT_STARTED`.

## R5-B — Action Priority and Request Detail

R5-B makes request decisions action-first without changing runtime or backend authority. SLA presentation now has one leading overdue request and CTA, a weaker pending summary, and a clear state without a disabled action. Queue entries expose human-readable priority, status, pet, service, requested time, deadline, responsible role and next action.

Desktop/tablet retain the shared shell and use a side detail surface. Mobile detail removes global search, filters, create and view controls; its first viewport leads with status, SLA and next action. Primary confirm, secondary alternative and destructive reject are distinct. Veterinarian detail is read-only; Admin and multi-role retain explicit workspace markers.

Deterministic states cover pending, overdue, submitting, authoritative success readback, alternative proposed/waiting owner, conflict, stale, technical error and forbidden. Conflict and stale retain request context. The timeline contains only safe event label, actor, timestamp and optional detail.

Evidence `docs/v50/evidence/V50-CLINIC-MVP1-02-R5-B-RESPONSIVE/` passes 212 matrix cases plus four decision flows: 216/216 PASS, 259 screenshots, 42 full-page screenshots, zero failures. Prototype SHA-256: `9f912c12fcda2e5aef9ef522b92c169616ff2aa2cfabd615e1972e9f8511cd00`; source-diff SHA-256: `825b9f1817639bc4a1e9a327ef488dbb7c334e72d418b4d024f5015544168359`; evidence manifest SHA-256: `38fcf2b1d1df1d761b9eed15f257f6a43073f72037cced7a324c10c00bc388c8`.

All SLA values, ordering and readback are deterministic prototype presentation data, not production backend behavior. The only next bounded slice is `V50-CLINIC-MVP1-02-R5-C / Booking productivity`.

## R5-C — Booking Productivity

R5-C adds one isolated presentation draft for contextual booking creation. The same model is initialized from a free interval, client detail, owner request or the global create command; it preserves safe known context and never invents client, pet, veterinarian or service values for a global draft. Back navigation, retryable conflict and terminal failure retain the current draft.

Wide and compact layouts use the shared CRM dialog/surface hierarchy. Mobile uses explicit Client, Schedule and Review steps with a visible `Шаг N из 3` indicator, compact retained context and sticky navigation. Validation focuses the first incomplete field; submitting locks duplicate commands; successful presentation is a distinct readback state. Request/client create entry points are capability-filtered and veterinary presentation remains read-only.

Calendar records preserve time → pet/owner → service → veterinarian/resource → status → price information hierarchy, while free slots expose time and resource in an actionable accessible name. Keyboard flow supports `/`, `N`, `Esc`, `Enter` and `Ctrl/⌘+Enter`, protects text-entry controls, traps focus in the creation surface and restores it to the invoking slot or control.

Evidence `docs/v50/evidence/V50-CLINIC-MVP1-02-R5-C-RESPONSIVE/` passes 293 responsive/role cases plus `FLOW-05` through `FLOW-10`: 299/299 PASS, 341 screenshots, 42 full-page screenshots and zero failures. Prototype SHA-256: `9fdf10b5f692d5d4e1af8ece2df4f354f57a181a2c269d1ddee9f8fa765c9c62`; source-diff SHA-256: `4921f6c038a0470cf837a49d0af01055e84b2f1b23aa091f777fe6301559f918`; evidence manifest SHA-256: `35ed58e1f3f8f321901b9d790a35b72d32a38296fbc3dcdd0ff5ec9899516424`.

All booking creation, conflict and readback behavior is deterministic prototype presentation. Backend/runtime authority is unchanged. The only next bounded slice is `V50-CLINIC-MVP1-02-R5-D / Views, filters and communication`.

Efficiency verdict: `INEFFICIENT`. The required focused gates preceded full capture, but multiple complete attempts exposed deterministic composition, observer and harness-selector defects before the final clean PASS. No viewport, assertion or evidence requirement was removed or bypassed.
