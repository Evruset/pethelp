# V50-CLINIC-05C — Clinic Workspace Home Portal

Status: `PORTAL_FOUNDATION_IMPLEMENTED / TESTED`. Visual status: `BOUNDED_VISUAL_EVIDENCE_PASS`. Full product parity: `PARTIAL`. Production rollout: `NOT_STARTED`.

## Runtime and rollback

`CLINIC_V50_WORKSPACE_HOME` is an exact-`true`, server-only, default-off flag and is effective only with `PORTAL_V50_SHELL=true`. When disabled, the previously absent scoped root route remains a 404 through `notFound()`, the Home navigation item disappears and no Workspace Home browser request is made. The backend 05B endpoint can remain deployed dark; rollback needs no backend, data or migration action.

When enabled, `/clinics/:clinicId/locations/:locationId` renders inside the existing V50 shell. Home is the first eligible navigation item when the effective session has at least one existing workspace capability. Exact root selection does not select Home on nested routes. Mobile navigation remains one bounded horizontally scrollable row and does not create page overflow or cover content.

## BFF, parser and session boundary

The same-origin `GET /api/clinic/:clinicId/locations/:locationId/workspace-home` BFF validates UUIDs and an empty query, obtains the HttpOnly clinic session, performs an early exact-scope check and calls only the canonical 05B endpoint. Incoming browser `Authorization` is ignored; only `getClinicSession().token` is used upstream. Redirect following is disabled, the request is no-store with a three-second timeout, and the streamed response is bounded to 8 KiB.

The BFF exposes only the closed 400/401/403/404/502/503 taxonomy, never forwards upstream headers or bodies, and returns `Cache-Control: private, no-store`, `Vary: Cookie`, without ETag. Successful data is strict-parsed before browser delivery: exact keys, route scope, calendar-valid ISO timestamps, freshness, fixed five-section order, bounded facts and closed action pairs are required.

The client strict-parses the same response again before retaining it. Snapshots are in-memory only and synchronously owned by subject, clinic, location and exact-scope state. Initial, manual and visibility-restoration reads use AbortController and request generations with no interval, polling, persistence or concurrent refresh. Technical refresh failures retain and explicitly mark the last valid snapshot stale; 401, 403, other nontechnical 4xx, subject change, route change or scope loss purge protected facts immediately.

## Presentation and accessibility

Queue and Appointments render only backend-authorized bounded facts and closed scoped links. SLA risk has explicit text, counts saturate visually at `999+`, and operational zero uses a distinct empty summary. `NOT_AUTHORIZED` sections are hidden; `NOT_CONFIGURED` and `TEMPORARILY_UNAVAILABLE` contain no facts or actions. Schedule, Veterinarian and Quality remain non-operational foundation cards; no workload, Schedule or Quality facts are synthesized.

The page covers loading, session error/missing, forbidden, empty, role-specific, partial/all degradation, initial technical error, retry and stale-retained states. It provides semantic landmarks/headings, a skip link, polite refresh announcements, focus restoration after retry, visible focus, textual severity, 44 px actions, full-page axe coverage, keyboard traversal, 200% text, reduced motion and forced-colors checks at 375, 412, 768 and 1440 widths.

## Validation and evidence

Node 22 Portal typecheck and default-off/enabled builds pass. Strict parser is 10/10, BFF/flag contracts are 4/4, focused enabled Chromium is 8/8 with one rollback-only skip, and the separate default-off rollback is 1/1. The full Portal E2E suite is 114 passed, 93 feature-disabled skipped and zero failed out of 207. The affected Schedule selector repair and intentional selected-navigation contrast snapshot pass. The canonical live-stack smoke is 1/1 and uses a real HttpOnly session, Portal BFF, the unchanged 05B Nest endpoint and PostgreSQL; it proves no browser bearer, fixed tuple rendering, safe headers and identifier exclusion.

Bounded evidence is stored outside Git at `/Users/evrusetskiy/docs/ai/evidence/V50-CLINIC-05C/`. Its 15 PNG artifacts cover reception at four viewports, veterinarian and multi-role at mobile/desktop, empty, partial degradation, stale, forbidden, 200% text, reduced motion and the authoritative `#clinic-workspace` reference. `manifest.json` SHA-256 is `1f6497158c159640f887eb1e9eeccc9273be4889df193c88bb53e8690b931582`; it records per-file SHA-256, viewport/state/role, runtime source commit `1cc1611fb805e836759e62ffcd67f0bd2cc74034` and prototype checksum `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`. This evidence does not increment the program visual-fidelity counter.

## Authority debts and rollout blockers

Schedule, Veterinarian and Quality operational summaries remain outside this slice. Schedule authority debt and Quality authority debt are open. Production activation, UAT, legacy removal, main integration and full `CLN-001` visual/product parity are not claimed.

The only next bounded slice is `V50-CLINIC-05D / Clinic Workspace Home End-to-End Certification and Stacked Integration`.
