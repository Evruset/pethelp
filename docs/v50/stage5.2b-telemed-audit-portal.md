# Stage 5.2B — Veterinarian telemedicine audit portal

## Scope

Bounded read-only audit section in the veterinarian telemedicine selected-case
panel. No mutations, chat/video, state-machine or global-route changes.

## Backend prerequisite

`GET /v1/telemed/vet/cases/:caseId/audit-trail` returns only safe items with
`id`, `eventType`, `summaryCode`, `createdAt`; raw payload is absent.

## Portal implementation

`GET /api/telemed/vet/cases/:caseId/audit-trail` is the same-origin authenticated
proxy. `TelemedVetQueueClient` renders `История консультации` in the selected-case
panel; no global menu item or route was added.

## Authorization

The frontend UX gate is `telemed.vet.audit-trail.read`. Backend authority remains
capability, platform assignment, approved data category and case access.
Clinic/location scopes are not authority. Missing capability fail-closes the
section and produces zero audit GETs.

## Runtime parsing and presentation

The parser enforces exact envelope/item keys, closed event and summary-code
whitelists, strict timezone-aware RFC3339 timestamps and fail-closed malformed
HTTP 200 handling. Timeline order is newest-first, uses a semantic list, safe
Russian labels and `<time dateTime>` with the original RFC3339 value. Raw enums
are not the primary text; payload/internal fields are never displayed.

## UX, concurrency and accessibility

Loading, success, empty, unavailable, normalized 401/403/404, recoverable
5xx/network error and explicit retry states are present. Retry has no automatic
loop. AbortController clears old data and prevents stale responses from replacing
the current selected case. The section has a heading, semantic list, accessible
timestamps, keyboard retry and scoped axe coverage.

## Verification

- Happy path: PASS, 1/1.
- Dedicated audit suite: PASS, 6/6, exit 0.
- Shared telemedicine regression: PASS, 15/15, exit 0.
- Node 22 typecheck/build: PASS.
- `git diff --check`: PASS, exit 0.

## Final status

Stage 5.2A: COMPLETED. Stage 5.2B: COMPLETED. Stage 5.2: COMPLETED. No blockers
remain inside Stage 5.2.
