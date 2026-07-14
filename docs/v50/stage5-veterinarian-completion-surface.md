# Stage 5.0 — veterinarian appointment completion surface

## 1. Problem statement

`clinical.visit.complete` is a safe backend mutation, but its only portal
control is embedded in the administrative Schedule surface. That surface
requires `schedule.read`; it is not a veterinarian workspace and must not be
broadened merely to expose clinical completion.

The product needs a minimal veterinarian-only in-person appointment surface:
assigned, confirmed visits; visit context; an existing clinical-summary form;
and the existing completion mutation. It must not expose administrative
scheduling data or make frontend state/assignment checks authoritative.

## 2. Existing contracts

- Mutation: `POST /v1/clinic/booking-holds/:holdId/complete`, through the
  existing portal proxy `POST /api/clinic/booking-holds/:holdId/complete`.
- Server authority: `CLINIC_VETERINARIAN`, server-derived
  `clinical.visit.complete`, applicable JWT clinic/location scope and active
  location membership. Resource location is resolved server-side.
- Mutation state: `CONFIRMED → COMPLETED`; completed replay returns its
  persisted result; every other state denies with `INVALID_STATE_TRANSITION`.
- Summary validation remains 3–8000 trimmed characters. The transaction locks
  hold and slot, updates versions, and writes audit/outbox atomically.
- Existing reads are unsuitable: Schedule is an administrative
  `schedule.read` aggregate; hold read is an administrative known-id read.

## 3. Architecture Decision Map

| Decision | Result | Reason |
| --- | --- | --- |
| Read prerequisite | `NEW_BOUNDED_READ_REQUIRED` | No veterinarian-authorized discovery/read contract exists. |
| Completion mutation | Reuse unchanged | It already owns authorization, state, audit, outbox and replay behavior. |
| Assignment authority | Backend only | Current completion contract has no confirmed in-person assignment model. |
| Scope authority | Backend, with frontend UX hints | Frontend may filter UI by server-derived capability/scope but never proves access. |
| Schedule reuse | Reject | Would expose management aggregate and broaden `schedule.read`. |

## 4. UI Surface Reuse Map

- Reuse telemed’s master-detail workspace interaction pattern: selectable
  cards, keyboard focus, busy/error states and responsive two-column layout.
  Do not reuse telemed authority, data or assignment semantics.
- Reuse Schedule’s completion mechanics only: summary validation, pending
  action UX, existing complete proxy, notice/error presentation.
- Do not reuse Schedule slots/table as the data source; it is coupled to
  management reads and mutations.
- Queue and booking audit drawer are not assigned in-person visit surfaces.

## 5. Options

### A — veterinarian work queue

Create a dedicated clinic-scoped list/workspace for veterinarian-completable
visits. This is the selected product direction, but requires a bounded read.

### B — appointment details route

Use a new veterinarian-scoped visit details route opened from that list. This
is part of A’s master-detail flow, not an independent read source.

### C — bounded action from an existing surface

Rejected. Telemed is platform-only; Schedule requires `schedule.read`; Queue
is a confirmation workflow. None provides an authorized in-person discovery
surface.

## 6. Selected option

Select A with B as its detail/workspace step: a veterinarian clinic visit
workspace backed by an explicit, authorization-aware in-person visit read.

## 7. Authority model

- Backend computes and enforces `clinical.visit.complete` and veterinarian
  role, JWT scope, active membership, resource location and state transition.
- Frontend uses effective capability plus active clinic/location scope only as
  fail-closed UX hints.
- No frontend role mapping, in-person assignment inference, category policy,
  or state machine is permitted.
- `CLINIC_ADMIN`, receptionist, platform, owner and system-worker paths remain
  denied for completion.

## 8. Read-side prerequisite and minimal contract

Classification: `NEW_BOUNDED_READ_REQUIRED`.

Future read must be a veterinarian-only clinic/location-scoped projection of
completable visits, authorized with the same clinical completion authority
inputs. Minimum fields: opaque visit/hold identifier, clinic/location context,
scheduled start/end, current status, and product-approved minimal pet/owner
display context. Include an eligibility/status indicator only as display data;
completion remains server-authoritative.

Do not return owner IDs, prices, staff/external IDs, resources, period
reasons, working hours, unrelated holds, audit/event history, clinical
summary, detailed membership/assignment denial reasons, or raw capabilities.

Focused authorization matrix: active scoped veterinarian success; wrong/missing
clinic or location scope; inactive/revoked membership; admin/receptionist/
platform/owner/system denial; cross-clinic/location; stale state; normalized
not-found/deny with no resource leakage.

## 9. Route and navigation proposal

Introduce no route in Stage 5.0. Stage 5.1A must obtain product approval for a
veterinarian-scoped clinic route adjacent to existing clinic/location routes,
with a list entry visible only after effective capability and applicable scope.
The exact URL and navigation placement are product decisions; it must not be
the Schedule navigation or an administrative sub-route.

## 10. Product flow

1. Veterinarian enters a dedicated assigned-visit list.
2. Loading is fail-closed; capability/scope denial shows no visit data.
3. Select an assigned confirmed visit and open its workspace.
4. Show minimal visit context and clinical-summary field.
5. Preserve typed summary on validation failure; focus the error/form field.
6. Submit calls the existing completion proxy once; pending blocks double-click.
7. Success shows returned completed state and conclusion.
8. Completed replay renders the persisted result without a second workflow.
9. Conflict/state change refreshes authoritative visit state and offers retry
   only when the existing normalized contract permits it.
10. Deny/not-found remains normalized; return to the permitted list.

## 11. State and error matrix

| Condition | UI | Server result |
| --- | --- | --- |
| `CONFIRMED` | completion form enabled | completion may succeed |
| `COMPLETED` | completed/read-only result | idempotent persisted result |
| other/unknown state | no completion action | normalized 422 transition denial |
| invalid summary | retain input, focused error | 400 validation denial |
| scope/membership/role deny | no protected data/action | normalized 403 |
| lock/state conflict | authoritative refresh/retry guidance | existing normalized conflict |
| session failure | fail-closed retry state | no protected read/action |

## 12. Security and accessibility invariants

- Never broaden `schedule.read`, `canAccessClinicLocation`, or admin authority.
- Do not add owner/system-worker UI or frontend assignment/state authority.
- Reuse server transaction/audit/outbox/replay semantics; do not add a public
  idempotency field or change the completion DTO.
- Keyboard entry, visible focus, dialog/form focus return, `aria-live` pending
  and error feedback, reduced motion, responsive mobile/desktop layout and
  scoped axe WCAG 2 A/AA are required.
- Preserve the legacy shell boundary; capability-aware UX applies only to the
  approved new veterinarian surface.

## 13. Planned implementation slices

### Stage 5.1A — read surface foundation

Approve and implement only the bounded veterinarian read, its clinic route/
workspace shell, server authorization and focused read matrix.

#### Stage 5.1A1a — LIST endpoint — COMPLETED

- `GET /v1/clinic/:clinicId/locations/:locationId/vet/visits` is protected by
  server-derived `clinical.visit.workspace.read` for `CLINIC_VETERINARIAN`.
- Its explicit projection contains only hold, clinic/location, scheduled
  timing, status and pet name/species. Owner identity/contact data and
  schedule administration data are not loaded or returned.
- The query is clinic/location bounded and returns only `CONFIRMED` and
  `COMPLETED` holds. No in-person veterinarian assignment was inferred or
  checked.
- The next stage is Stage 5.1A1b, a detail endpoint. Frontend and completion
  mutation work remain out of this slice.

#### Stage 5.1A1b — DETAIL endpoint and HTTP matrix — COMPLETED

- `GET /v1/clinic/:clinicId/locations/:locationId/vet/visits/:holdId` uses the
  same server-derived capability and eight-field allow-list as LIST.
- Its bounded query resolves hold clinic/location through the slot relation.
  Missing, cross-resource and disallowed-state rows return normalized denial,
  without exposing whether the hold exists or why it was denied.
- A focused HTTP/e2e suite validates list/detail success, role and claim
  denial, membership state, scope mismatch, allowed states, cross-resource
  isolation and no protected-field leakage.
- Neither endpoint loads owner data or adds/infer veterinarian assignment.

Stage 5.1A backend read foundation is complete. Next: Stage 5.1A2,
frontend-only veterinarian visit surface; no completion mutation change.

### Stage 5.1A2 — frontend veterinarian visit surface — COMPLETED

- V50 owns `/vet/visits` and `/vet/visits/[holdId]`, with matching no-store
  portal proxies. Capability and clinic/location scope act as fail-closed UX
  gates; the backend remains the authority.
- The navigation item is capability-scoped. List/detail display only the
  approved DTO fields and normalized unavailable/error states.
- The LIST proxy local `LOCATION_SCOPE_DENIED` predicate was removed after it
  was proven to deny before upstream. Its authenticated-session boundary and
  Authorization forwarding remain; backend evaluation is the authorization
  authority. Diagnostic evidence recorded proxy 200, upstream 200 and mock hit 1.
- DETAIL now accepts standard UUID v1–v5 IDs; its earlier regex had invalid
  three-character groups. Valid detail navigation reaches upstream, while a
  malformed `holdId` remains denied before upstream.
- The focused Chromium portal suite is PASS (5/5): allowed list/detail and
  keyboard back flow, capability/scope no-request gates, malformed-ID
  fail-closed behavior and normalized upstream denial. Stage 5.1A is complete.

### Stage 5.1B — completion mutation UI

Production implementation is partially verified. Next: dedicated Stage 5.1B
completion Playwright closure for pending, double-click, validation preservation,
normalized deny/conflict, replay and focus behavior.

Stage 5.1B is now complete. The dedicated Chromium suite passes 8/8 and covers
capability/scope/state gates, 3–8000 summary validation including injected
over-limit input, pending and double-submit behavior, success/idempotency,
normalized validation/403/conflict/5xx/network outcomes, controlled refresh and
scoped axe checks. Pending uses the accessible-name transition `Завершить приём`
→ `Завершение…`; cleanup releases the deferred mock response, and double-click
plus repeated Enter make exactly one POST. Focus returns to the summary field
after validation/server errors and success announces with `role="status"`.
Backend contracts and capability grants were unchanged. Next: Stage 5.1
closure/hardening review.

### Stage 5.1C — hardening only if evidence requires it

Address remaining concurrency translation, retry/refetch, runtime parsing,
accessibility or observability gaps without widening contracts.

## 14. Test strategy, rollout and rollback

Stage 5.1A: focused backend authorization/read matrix and portal route/gate
tests. Stage 5.1B: completion transition, duplicate/concurrent attempts,
summary validation, audit/outbox uniqueness, frontend pending/error/focus and
scoped Playwright axe. Do not run full suites without shared-contract evidence.

No new completion feature flag is required by this brief. Preserve the current
backend mutation contract; rollback is removal/disablement of the new read/UI
surface while existing completion endpoint behavior remains unchanged.

## 15. Residual risks and approvals

- Product must approve veterinarian list/detail route, navigation owner and
  minimal pet/owner display fields.
- Backend must decide whether the new read is list-only or list-plus-detail,
  and prove lock-timeout translation for the documented completion conflict.
- Existing domain model does not prove assigned in-person veterinarian; do not
  invent assignment until a domain decision is approved.
