# Current task handoff

## Backend verification environment

- Focused backend HTTP/e2e tests must run through the existing
  `docker-compose.local.yml` backend service.
- Use the `DATABASE_URL` already configured inside the backend container.
- Do not use localhost PostgreSQL.
- Canonical execution uses `docker compose exec -T backend`.
- The backend dev container may stop because of the unrelated
  hold-expiration worker on existing fixture data.
- If this happens, restart the backend service once and retry only the
  interrupted command.
- A later environment exit 137 does not invalidate an earlier PASS when
  no relevant code changed.

## Goal

Stage 3 v51 capability foundation and incremental migration of bounded
operational read endpoints to centralized, server-derived authorization.

The centralized evaluator, effective session contract and several
authority-specific read slices are already implemented and verified.

## Acceptance criteria

- Server derives effective capabilities and active scopes; JWT capability
  payloads are never treated as authority.
- Every migrated endpoint has an explicit resource descriptor and authority
  model: clinic, location, platform, owner or mixed/special.
- Centralized authorization is deny-by-default and uses only checks applicable
  to the selected authority model.
- Each migrated family preserves its existing legacy behavior behind an
  independent rollback flag.
- Existing coarse `@Roles`, legacy tokens, routes, DTOs, response shapes,
  owner paths and system-worker paths remain compatible unless explicitly
  included in scope.
- UI capability hints are not authorization proof.

## Decisions still in force

- Stage 1 ADR-0007 — token spec общий, реализации компонентов platform-native.
- Не менять applied migrations, backend contracts, пользовательские dirty files, commit или push.
- Stage 3 remains backend-first: UI is not authorization proof and does not expose capability-dependent routes before read models.

## Changed files and key symbols

- `backend/src/auth/capability-evaluator.service.ts` centralizes grant, JWT-scope early reject and active membership checks with normalized denials.
- `GET /v1/auth/session` is additive and returns server-derived `effectiveCapabilities` plus active `clinicScopes`.
- `booking.queue.read` covers the existing booking queue/audit-trail read family; clinical completion delegates to the same evaluator without restoring admin authority.
- `quality.read` HTTP slice is complete: `GET /v1/clinic/:clinicId/locations/:locationId/quality-dashboard` has an e2e matrix for allowed access, role/scope/membership denials, normalized centralized denials and the legacy rollback flag; no quality mutations or routes were added.
- `schedule.read` HTTP slice is complete for `GET /v1/clinic/:clinicId/locations/:locationId/schedule/slots`: it has its own capability/resource descriptor, centralized evaluator flag and focused RBAC/ABAC matrix; schedule mutations and every other schedule endpoint remain on their existing path.
- `booking.replay.read` HTTP slice is complete for `GET /v1/booking-holds/:holdId/events`: clinic-staff access resolves the hold's clinic/location before centralized capability evaluation, while existing owner and system-worker branches remain unchanged; its flag preserves the clinic legacy path.
- `booking.hold.read` HTTP slice is complete for `GET /v1/booking-holds/:holdId`: clinic-staff access resolves the hold's clinic/location before centralized capability evaluation, while existing owner and system-worker branches remain unchanged; `BOOKING_HOLD_READ_CAPABILITY_V1=false` preserves the clinic legacy path.
- `telemed.vet.queue.read` HTTP slice is complete for `GET /v1/telemed/vet/queue`: the platform-veterinarian queue has its own platform resource descriptor and centralized evaluator path; clinic/location JWT claims and clinic membership are intentionally not authority for this platform-scoped resource, and `TELEMED_VET_QUEUE_READ_CAPABILITY_V1=false` preserves the legacy queue path.
- `ops.slo.snapshot.read` HTTP slice is complete for `GET /v1/ops/slo-snapshot`: its resource descriptor explicitly declares `authorityModel: 'platform'`; `PLATFORM_ADMIN` and `SECURITY_AUDITOR` are server-derived grants, while clinic/location JWT claims and memberships are intentionally not authority. `OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1=false` preserves the legacy guarded snapshot path.
- First assignment/data-category slice is complete for `GET /v1/telemed/vet/cases/:caseId/audit-trail`: `telemed.vet.audit-trail.read` has an explicit `platform-assignment` descriptor. The assigned platform veterinarian is required; clinic/location scopes and memberships are not authority for this platform resource. Only the existing non-emergency intake categories are allowed for audit-trail payloads; unknown or restricted categories deny by default. Internal evaluator logs retain the specific reason, while HTTP returns the normalized denial. `TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1=false` preserves the legacy assigned-veterinarian path.
- `CAPABILITY_EVALUATOR_V1` remains the rollout flag for the original
  `booking.queue.read` family.
- Later migrated families use independent rollback flags:
  `QUALITY_READ_CAPABILITY_V1`,
  `SCHEDULE_READ_CAPABILITY_V1`,
  `BOOKING_REPLAY_READ_CAPABILITY_V1`,
  `BOOKING_HOLD_READ_CAPABILITY_V1`,
  `TELEMED_VET_QUEUE_READ_CAPABILITY_V1` and
  `TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1` and
  `OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1`.
- None of these flags relaxes doctor-only clinical completion.
- `app/design-system/feature-flags.ts::isPortalV51ShellEnabled` is a server-side, exact-`true` flag evaluation.
- `app/(clinic)/clinics/[clinicId]/locations/[locationId]/layout.tsx` selects `ClinicPortalShellV51` only when the flag is enabled; `ClinicPortalShell` remains intact for legacy rollout.
- `components/layout/ClinicPortalShellV51.tsx` adds the flagged accessible composition and skip link, reusing existing Stage 2 shell styles/tokens.
- Existing Stage 1/backend and user changes remain untouched.

## Checks completed

- Historical discovery and architecture analysis are complete.
- Future bounded Stage 3 slices must reuse this handoff and targeted inspection;
  repo map, RAG and broad route inventory must not be repeated unless targeted
  discovery is insufficient.
- Backend focused capability/evaluator/access tests — PASS (11 tests); backend `npm run build` — PASS.
- Backend quality.read HTTP matrix — PASS: centralized mode (10 cases) and `QUALITY_READ_CAPABILITY_V1=false` rollback mode (1 case); focused capability/access tests — PASS (8 tests); backend `npm run build` — PASS.
- Backend schedule.read HTTP matrix — PASS: centralized mode (10 cases) and `SCHEDULE_READ_CAPABILITY_V1=false` rollback mode (1 case); focused capability/access tests — PASS (8 tests); backend `npm run build` — PASS.
- Backend booking.replay.read HTTP matrix — PASS: centralized mode (10 cases) and `BOOKING_REPLAY_READ_CAPABILITY_V1=false` rollback mode (1 case); focused capability/access tests — PASS (8 tests); backend `npm run build` — PASS.
- Backend booking.hold.read HTTP matrix — PASS inside the compose backend service: centralized mode (10 cases) and `BOOKING_HOLD_READ_CAPABILITY_V1=false` rollback mode (1 case); focused capability/evaluator tests — PASS (8 tests); backend `npm run build` — PASS.
- Backend telemed.vet.queue.read HTTP matrix — PASS inside the compose backend service: centralized mode (3 applicable platform-scope cases) and `TELEMED_VET_QUEUE_READ_CAPABILITY_V1=false` rollback mode (1 case); focused capability/evaluator tests — PASS (8 tests); backend `npm run build` — PASS.
- Backend ops.slo.snapshot.read HTTP matrix — PASS inside the compose backend service: centralized mode (3 applicable platform-scope cases) and `OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1=false` rollback mode (1 case); focused capability/evaluator tests — PASS; backend `npm run build` — PASS.
- Backend telemed.vet.audit-trail.read assignment/data-category HTTP matrix — PASS inside the compose backend service: centralized mode (assigned doctor success with irrelevant clinic/location claims; role, unassigned-doctor and forbidden-category denials without data leakage) and `TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1=false` rollback mode (1 case); focused capability/evaluator/workspace tests — PASS (18 tests); backend `npm run build` — PASS; `git diff --check` — PASS.
- Node 22.22.2: focused `stage2-design-system.spec.ts` — PASS (1 test).
- Node 22.22.2: `clinic-telemed.spec.ts` — PASS (11 tests), including axe WCAG 2 A/AA check.
- `git diff --check` — PASS.
- Local Node 18.13 production build — ABSTAIN: Next requires Node >=20.9; this is an environment constraint, not a source failure.

## Stage 3 closure

Stage 3 capability foundation is closed and ready for Stage 4 frontend
capability consumption. Completed capabilities are
`clinical.visit.complete`, `booking.queue.read`, `quality.read`,
`schedule.read`, `booking.replay.read`, `booking.hold.read`,
`telemed.vet.queue.read`, `telemed.vet.audit-trail.read` and
`ops.slo.snapshot.read`.

- Clinic/location authority applies to clinical completion and the booking,
  quality and schedule read resources; centralized evaluation requires the
  applicable JWT scopes and active location membership.
- Platform authority applies to telemedicine veterinarian queue and OPS SLO
  snapshot resources; clinic/location claims and memberships are not
  authority. Audit-trail is the sole `platform-assignment` resource and adds
  assigned-veterinarian plus allow-listed data-category checks.
- Owner and system-worker special paths for booking hold/replay remain legacy
  branches and were not broadened. Clinical completion remains veterinarian
  only.
- `CAPABILITY_EVALUATOR_V1`, `QUALITY_READ_CAPABILITY_V1`,
  `SCHEDULE_READ_CAPABILITY_V1`, `BOOKING_REPLAY_READ_CAPABILITY_V1`,
  `BOOKING_HOLD_READ_CAPABILITY_V1`, `TELEMED_VET_QUEUE_READ_CAPABILITY_V1`,
  `OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1` and
  `TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1` default to centralized mode;
  each independently restores only its own legacy branch when set to `false`.
- `GET /v1/auth/session` remains additive: capabilities and active
  clinic/location scopes are server-derived UX hints, never a substitute for
  endpoint authorization. Denials are normalized externally; detailed
  evaluator reasons are retained only by the internal logger/audit path.
- Closure review verification: focused capability/evaluator/policy tests —
  PASS (21 tests); Compose backend build — PASS; `git diff --check` — PASS.

## Stage 4.1 closure — `booking.queue.read` frontend slice

- `apps/clinic-portal/lib/auth/effective-session.ts` owns the typed additive
  `/v1/auth/session` UX contract, validation and capability/scope selectors.
  It contains no frontend role-to-capability mapping.
- The V51 shell uses a small client context that loads and can refresh the
  effective session; session-change events invalidate it. Loading, failed
  fetches and absent capability all fail closed for the queue navigation only.
- The queue page retains its legacy clinic role/scope check and additionally
  requires the server-derived `booking.queue.read` hint plus applicable
  clinic/location scope before requesting queue data. Backend endpoint
  authorization remains authoritative and normalized 403 responses still
  render the existing denied state.
- `PORTAL_V51_SHELL=true` enables this capability-aware V51 navigation;
  `false` or unset continues to use the unchanged legacy shell.
- Focused verification: effective-session unit tests — PASS (2); portal
  typecheck — PASS; Node 22.22.2 production build — PASS; focused
  `clinic-queue.spec.ts` Playwright scenario — PASS (9 tests, including
  allowed/denied/direct URL/loading/error and scoped axe WCAG 2 A/AA check);
  `git diff --check` — PASS.

## Stage 4.2 closure — `quality.read` frontend slice

- The existing effective-session contract, proxy, provider and selectors are
  reused unchanged. V51 displays Quality only after `quality.read` and the
  current active clinic/location scope are both present.
- The quality route retains its legacy clinic role/scope guard and adds the
  same server-derived effective-session fail-closed gate before dashboard
  retrieval. Missing capability, mismatched scope and session errors do not
  request or render dashboard data; backend 403 remains final authority.
- Focused verification: effective-session unit tests — PASS (3); portal
  typecheck — PASS; Node 22.22.2 production build — PASS; focused
  `clinic-quality-capability.spec.ts` Playwright scenario — PASS (4 tests,
  including allowed/denied/direct URL/scope/loading-error and scoped axe
  WCAG 2 A/AA); `git diff --check` — PASS.
- Existing full-page contrast debt remains in the unchanged legacy quality/
  queue content. It is explicitly excluded from the scoped V51 navigation
  axe assertion and is not repaired by this bounded slice.

## Stage 4.3 closure — `schedule.read` frontend slice

- The existing V51 capability navigation now displays Schedule only after the
  server-derived `schedule.read` UX hint and exact active clinic/location
  scope are present. Loading, session error, absent capability and mismatched
  scope hide the item.
- The schedule page retains its legacy clinic role/scope guard and adds the
  effective-session fail-closed gate before its initial read-only
  `GET .../schedule/slots`. Denied and scope-mismatched direct URLs do not
  request or render slots; backend 403 remains final authority.
- Schedule mutation handlers, their routes and their existing role checks are
  unchanged. This slice grants no mutation capability and gates only the
  read-only slots surface.
- Focused verification: effective-session unit tests — PASS (3); portal
  typecheck — PASS; Node 22.22.2 production build — PASS; focused
  `clinic-schedule-capability.spec.ts` Playwright scenario — PASS (4 tests,
  including explicit upstream slots no-request denial proof and scoped axe
  WCAG 2 A/AA); `git diff --check` — PASS.

## Stage 4.4 closure — `telemed.vet.queue.read` frontend slice

- Existing `/telemed/vet` page, `/api/telemed/vet/queue` proxy and
  `TelemedVetQueueClient` form the confirmed platform queue surface for
  `GET /v1/telemed/vet/queue`.
- The page retains its legacy telemedicine-veterinarian role guard and now
  requires the server-derived `telemed.vet.queue.read` UX hint before the
  queue endpoint is requested. The client gate reuses the effective-session
  provider for loading, session-error retry and invalidation behavior.
- This is platform-scoped: clinic/location scopes are intentionally not read
  as authority or UX eligibility. Backend remains responsible for queue and
  assignment authorization; telemed mutation handlers are unchanged.
- Focused verification: portal typecheck — PASS; Node 22.22.2 production
  build — PASS; `clinic-telemed.spec.ts` — PASS (15 tests, including denied
  no-request proof, incompatible clinic/location claims, backend deny and
  scoped axe WCAG 2 A/AA); `git diff --check` — PASS.

## Stage 4 deferred backend-only capabilities

- `booking.hold.read` is deferred: no existing clinic-portal hold-details
  consumer of `GET /v1/booking-holds/:holdId` exists.
- `booking.replay.read` is deferred: the existing queue audit drawer uses a
  distinct audit-trail contract, not `GET /v1/booking-holds/:holdId/events`.
- `telemed.vet.audit-trail.read` — RESOLVED: this was initially deferred
  because no clinic-portal surface existed and the endpoint exposed unsafe raw
  `payload_json`. Stage 5.2A introduced the backend-owned display-safe DTO and
  Stage 5.2B added the selected-case portal section. Stage 5.2 is COMPLETED;
  the clinic booking audit drawer remains a distinct contract.

## Stage 4 closure — frontend capability consumption foundation

- Completed frontend slices are `booking.queue.read`, `quality.read`,
  `schedule.read` and `telemed.vet.queue.read`. Each treats the typed
  effective session as a fail-closed UX hint; backend endpoint authorization
  remains authoritative. Clinic/location scope is used only by the
  clinic/location surfaces, while the platform telemed queue intentionally
  ignores those claims.
- The foundation is stable: `/v1/auth/session` is parsed into a typed
  server-derived contract; a single provider supplies capability, scope,
  loading, error and retry behavior; no frontend role-to-capability mapping
  or parallel capability store exists. The V51 capability shell is flagged;
  legacy shell and legacy role guards remain intact.
- Test inventory across completed slices covers capability present/absent,
  clinic/location mismatch, platform scope independence, loading without an
  unauthorized flash, session-error fail-closed, direct no-request gates,
  backend denials and scoped axe WCAG 2 A/AA. Existing full-page legacy
  contrast debt remains outside these bounded changes.
- `ops.slo.snapshot.read` has an existing operational frontend surface:
  `/ops/security` directly consumes `getOpsSloSnapshot` for
  `GET /v1/ops/slo-snapshot`. It is a separate platform-scoped bounded slice
  and was not implemented during closure review.

## Stage 4.5 closure — `ops.slo.snapshot.read` frontend slice

- Existing `/ops/security` remains the operational dashboard surface for
  `GET /v1/ops/slo-snapshot`. Its legacy platform role guard is retained and
  a server-derived `ops.slo.snapshot.read` gate now runs before snapshot or
  audit-event loading.
- This is platform-scoped: clinic/location claims and clinic scopes are not
  consulted for frontend eligibility. The client gate reuses the single
  effective-session provider for loading, error/retry and invalidation; the
  backend remains the final authorization authority.
- Focused verification: portal typecheck — PASS; Node 22.22.2 production
  build — PASS; `ops-slo-capability.spec.ts` — PASS (4 tests covering
  platform scope independence, denied no-request, loading/error retry,
  backend denial and scoped axe WCAG 2 A/AA); `git diff --check` — PASS.

### Product-surface backlog for deferred capabilities

- `booking.hold.read` — endpoint `GET /v1/booking-holds/:holdId`; authority
  is clinic/location plus backend resource resolution. Missing surface: clinic
  hold-details page. Prerequisite: approved product flow and route. Do not
  create a details page automatically.
- `booking.replay.read` — endpoint `GET /v1/booking-holds/:holdId/events`;
  authority is clinic/location plus backend resource resolution. Missing
  surface: replay/event-history consumer. Prerequisite: product decision on
  audit-drawer versus dedicated replay experience. Do not retarget the
  existing audit-trail contract automatically.
- `telemed.vet.audit-trail.read` — RESOLVED: endpoint
  `GET /v1/telemed/vet/cases/:caseId/audit-trail`; authority is
  platform-assignment plus data category. The initial blocked-scope decision
  was resolved by the safe DTO in `docs/v51/stage5.2a-telemed-safe-audit-dto.md`
  and the portal section in `docs/v51/stage5.2b-telemed-audit-portal.md`.
  Stage 5.2 is COMPLETED; frontend does not duplicate assignment/category policy.

## Unresolved risks/errors

- Cross-resource visit/telemed policy matrix and further endpoint families remain out of this first Stage 3 slice.
- CI/local runner must use Node >=20.9 (validated on Node 22.22.2); Node 18 cannot run the Next production build.
- Flag state is environment-owned; default remains legacy unless exactly `PORTAL_V51_SHELL=true`.
- Stage 5 `clinical.visit.complete` is blocked by an existing UI authority
  mismatch: the only completion action is embedded in the schedule screen,
  whose server gate requires `schedule.read` and admits receptionist/admin
  access, while the backend completion endpoint is deliberately
  veterinarian-only. The schedule read endpoint cannot be broadened merely
  to expose a clinical mutation. A product-approved veterinarian appointment
  workspace or a separately authorized existing surface is required before
  the completion workflow can be migrated safely.

## Stage 5.0 veterinarian completion surface decision

- Product/architecture brief: `docs/v51/stage5-veterinarian-completion-surface.md`.
- Decision: `NEW_BOUNDED_READ_REQUIRED`. Existing Schedule and hold reads are
  administrative contracts and must not become veterinarian discovery paths.
- Selected direction: an approved veterinarian clinic visit list/workspace
  backed by a minimal server-authorized in-person visit projection, then reuse
  the unchanged completion mutation in a later UI slice.
- Stage 5.1A is the only next implementation action: read-surface foundation.
  It must not broaden `schedule.read`, restore admin completion authority, or
  infer an in-person assignment model on the frontend.

## Stage 5.1A1a veterinarian visit LIST — COMPLETED

- Capability: server-derived `clinical.visit.workspace.read`, granted only to
  `CLINIC_VETERINARIAN`; `CLINIC_ADMIN`, platform roles, JWT capability-shaped
  claims without that role, and non-veterinarians remain denied.
- Endpoint: `GET /v1/clinic/:clinicId/locations/:locationId/vet/visits`.
  Centralized evaluation requires the veterinarian role, active membership,
  clinic JWT scope and location JWT scope; denials remain normalized.
- DTO is an explicit projection only: `holdId`, `clinicId`, `locationId`,
  `scheduledStart`, `scheduledEnd`, `status`, `petDisplayName`, `species`.
  It has no owner/contact/admin fields and no assignment semantics.
- List returns only the requested clinic/location and persisted `CONFIRMED`
  and `COMPLETED` holds; cancelled, expired and unknown states are excluded.
- No feature flag or legacy rollback path was added because this is an
  additive endpoint with no legacy read contract.

## Stage 5.1A1b veterinarian visit DETAIL — COMPLETED

- Endpoint: `GET /v1/clinic/:clinicId/locations/:locationId/vet/visits/:holdId`.
  It uses the same centralized `clinical.visit.workspace.read` evaluation and
  explicit eight-field DTO allow-list as LIST.
- Detail resolves the hold through its slot and clinic location; missing,
  cross-clinic, cross-location, cancelled/expired and unknown-state resources
  all return the same normalized external denial as an authorization failure.
- The focused HTTP matrix covers LIST and DETAIL success, role/capability,
  active/inactive/revoked membership, clinic/location scope, state filtering,
  cross-resource isolation and response no-leak assertions.
- No owner/identity data or veterinarian assignment is loaded, returned or
  inferred. No feature flag, migration, legacy branch or mutation was added.

## Stage 5.1A backend read foundation — COMPLETED

## Next single action

## Stage 5.1A2 veterinarian visit portal surface — COMPLETED

- Added V51 list/detail routes and same-origin portal proxies for the bounded
  veterinarian visit read family.
- Navigation `Приёмы врача` is shown only after effective-session capability
  and matching clinic/location scope checks; routes fail closed before any
  protected proxy request.
- The list proxy had a duplicate local clinic/location predicate that returned
  `LOCATION_SCOPE_DENIED` before upstream. It was removed: the proxy retains
  its authenticated-session boundary and Authorization forwarding, while the
  backend evaluator remains the sole authorization authority.
- The detail proxy rejected valid fixture IDs because its UUID regex used
  three-character groups. It now uses standard UUID v1–v5 validation; malformed
  `holdId` values remain fail-closed before upstream.
- Fresh diagnostic evidence recorded list proxy/upstream HTTP 200 and one mock
  hit. The final focused portal suite verifies list/detail upstream reads,
  valid detail navigation, malformed-ID denial, client UX gates, normalized
  backend denials and keyboard detail/back flow (5/5 PASS).
- UI displays only the approved visit fields. It has no owner/assignment data
  or Schedule integration. The frontend capability/scope gate is UX-only.

## Next single action

Stage 5.1B production implementation is partially verified. Next: dedicated
Stage 5.1B completion Playwright closure for validation, pending/replay/conflict
and focus behavior.

## Stage 5.1B veterinarian completion UI — COMPLETED

- Dedicated Chromium completion suite passes 8/8. It verifies capability/scope/
  state gates, summary validation from 3 through 8000 characters (including an
  injected over-limit value), pending/double-submit protection, normalized
  validation/403/conflict/5xx/network behavior, controlled detail refresh and
  scoped axe checks.
- The pending accessible name transitions from `Завершить приём` to
  `Завершение…`; the pending mock is released in test cleanup, and double-click
  plus repeated Enter perform exactly one POST. Error-matrix fixtures reset
  state per iteration and synchronize their mutation count with the mock.
- Client validation and server errors return focus to the summary field.
  Successful completion announces through `role="status"`. Backend contracts,
  capability grants and read flows were not changed. Stage 5.1 is complete.

## Next single action

Stage 5.1 closure/hardening review.

## Stage 5.1 DTO parser hardening — COMPLETED

- Runtime parsing now permits only `CONFIRMED | COMPLETED` and semantically
  validates RFC3339 timestamps with a required `Z` or numeric timezone offset,
  calendar and offset checks, and finite parsing. The exact eight-field DTO
  contract is unchanged; malformed HTTP 200 responses fail closed without
  displaying raw visit data.
- The focused veterinarian read suite passes 6/6, including malformed status,
  timestamp and exact-key matrix coverage for list and detail. The completion
  regression suite passes 8/8. There are no open Stage 5.1 P0/P1 findings.

## Stage 5.2 telemedicine audit trail — COMPLETED

- Stage 5.2A replaced raw audit payload with the exact safe item DTO: `id`,
  `eventType`, `summaryCode`, `createdAt`. The closed event taxonomy fails
  closed for unknown mapper input; mapper tests pass 9/9, audit HTTP matrix 2/2,
  and backend build passes.
- Stage 5.2B embeds `История консультации` in the selected veterinarian case
  panel through a same-origin authenticated proxy. Strict runtime parsing,
  `telemed.vet.audit-trail.read` gating, newest-first semantic timeline,
  loading/empty/error/retry UX and AbortController stale-request protection are
  implemented. Clinic/location scopes are intentionally not authority.
- Happy path passes 1/1; dedicated audit suite passes 6/6; shared telemedicine
  regression passes 15/15; portal typecheck/build pass. The original
  `BLOCKED_BY_SCOPE` condition is resolved through Stage 5.2A; no Stage 5.2
  blockers remain. Stage 5.1 remains APPROVED.

## Stage 5.3 booking hold inspector — COMPLETED

- The clinic queue now exposes a capability- and exact clinic/location-scoped
  hold inspector through the existing read-only hold contract and a strict
  portal DTO parser. Invalid payloads and normalized denials fail closed;
  recoverable failures retry once without duplicate requests, and pending
  disclosure work is aborted on close.
- V51 effective-session navigation remains hidden while capability loading is
  pending. HTTP 403 session denial is fail-closed and separate from 5xx/network
  errors, which expose an accessible retry state.
- Chromium regressions pass: `clinic-queue.spec.ts` 9/9 and
  `booking-hold-inspector.spec.ts` 7/7. Portal typecheck, production build and
  `git diff --check` pass on Node 22.22.2.

## Next single action

Stage 5.4 — Booking Replay History is COMPLETED. The separate capability- and
scope-gated replay dialog uses a safe BFF projection and never exposes raw
payload. Chromium replay coverage passes 7/7, including isolated empty,
malformed and 401/403/404 cases, retry de-duplication, abort/focus lifecycle
and scoped axe; inspector 7/7, queue 9/9, portal typecheck/build and
`git diff --check` pass on Node 22.22.2. Stage 5.5 was not started.
