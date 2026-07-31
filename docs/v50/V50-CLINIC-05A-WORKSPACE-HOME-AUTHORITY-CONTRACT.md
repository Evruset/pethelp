# V50-CLINIC-05A — Clinic Workspace Home Authority Contract

## 1. Status

`CONTRACT_READY`.

This document is the normative input for
`V50-CLINIC-05B / Clinic Workspace Home Backend Projection`. It defines a
read-only contract; no runtime, API, Portal, migration or feature-flag code is
part of 05A.

## 2. Scope

The canonical clinic workspace home is the exact-location operational landing
page at:

```text
/clinics/:clinicId/locations/:locationId
```

It presents a server-authored, capability-filtered summary of Queue, Schedule,
Appointments, Veterinarian workspace and Quality. The backend is the sole
authority for identity, active membership, exact clinic/location scope,
capabilities, section availability, counts and action links.

## 3. Non-goals

- no mutations, state-machine changes or action eligibility changes;
- no Portal UI, new screen implementation or visual-fidelity claim;
- no migration, materialized view, event stream, WebSocket or SSE;
- no patient registry card, owner or patient lookup, clinical record, document,
  payment or audit data;
- no reuse of prototype demo values or role switch as an authority boundary;
- no umbrella `clinic.workspace.all` capability;
- no full-list composition from Queue, Appointments, Patients or Visits.

## 4. Prototype evidence

The authoritative `#clinic-workspace` anchor establishes:

- a staff-only workspace with clinic/location and current-user role context;
- reception emphasis on SLA risk, queue actions, schedule and visit workload;
- a doctor mode that removes commercial KPIs and prioritizes clinical work;
- explicit navigation between Queue, Schedule and Visit;
- desktop KPI/cards and a mobile task-card hierarchy instead of a compressed
  desktop table;
- criticality conveyed with labels such as “SLA risk” in addition to color;
- backend-authored FIFO/SLA/action ordering; the UI must not reorder locally.

The prototype also contains patient names, owner context, clinical fields,
documents, action buttons and fixed example counts. Those are illustrative
only and are excluded from this aggregate contract. The prototype has no
authoritative loading, empty, technical-error, stale, forbidden or
partial-degradation semantics; this contract supplies them.

Responsive interpretation:

- desktop: summary cards in a readable grid followed by prioritized sections;
- tablet: two-column cards with preserved heading and action order;
- mobile: one-column task/summary cards, no squeezed table;
- reduced motion: no status meaning depends on animation.

## 5. Current runtime inventory

| Source | Authoritative owner and route | Capability and scope | Freshness / bounds | Safe summary reuse and risk |
| --- | --- | --- | --- | --- |
| Portal shell | `ClinicPortalShellV50`; exact scoped layout | `EffectiveSessionProvider` is a UX hint; server remains authority | session fetched without browser bearer forwarding to arbitrary services | Reuse shell, context, skip link and capability-aware navigation. Never authorize from role/persona alone. |
| Queue | `ClinicQueueService`; `GET /v1/clinic/:clinicId/locations/:locationId/booking-queue` | `booking.queue.read`; JWT clinic/location claims plus active membership | database `serverNow`; limit 50, max 100; FIFO by state-change/id | New bounded aggregate query may reuse state/SLA predicates. Do not load items, holds, pets, audit or owners. Existing list projection is privacy-rich and unsuitable for composition. |
| Schedule | `ClinicScheduleService`; `GET .../schedule/slots` | `schedule.read`; exact location membership | slot snapshot/freshness fields; existing read can be broad by requested window | Use a today-only aggregate. Do not fetch full services/staff/resources/periods/slots; avoid mutation capabilities and identifiers. |
| Appointments | `ClinicAppointmentsRegistryService`; `GET .../appointments` | `appointment.registry.read`; exact clinic/location membership | database `serverNow`, snapshot cursor; default 50, max 100; 500 ms statement timeout | Use bounded today/action aggregates, not registry rows or cursor traversal. No appointment, pet, owner or doctor identifiers. |
| Patients | `ClinicPatientsRegistryService`; `GET .../patients` | `patient.admin.read`; exact clinic/location membership and visibility policy | signed cursor, bounded limit, snapshot semantics | Not a 05A section. Patient totals create existence/count leakage and are prohibited. |
| Quality | `ClinicQualityService`; `GET .../quality-dashboard` | `quality.read`; exact active location | range-scoped aggregate; 350 ms statement timeout | A dedicated bounded alert-state query may reuse safe predicates. Do not reuse owner-return or commercial numerator/denominator data. |
| Veterinarian workspace | `VeterinarianVisitReadService`; `GET .../vet/visits` | `clinical.visit.workspace.read`; exact location membership | current list is unpaginated and location-wide | Do not compose the list or return pet/hold fields. The prototype’s personal-shift facts are not proven; 05B returns this section as `NOT_CONFIGURED` until assignment authority is contracted. |
| Effective authority | `CapabilityEvaluatorService`, `ClinicEmployeeAccessService`, `/v1/auth/session` | capability + JWT early reject + active, non-revoked database membership | membership is read on every authoritative request | Reuse evaluator/resource descriptors. Effective session only controls shell hints and fail-closed page selection. |

The current runtime has no workspace-home route or projection. Existing
bounded-context reads are not an acceptable client composition API because
several return privacy-rich rows and one visit list is unbounded.

## 6. Chosen architecture

Choose **Option A: one canonical backend projection**:

```http
GET /v1/clinic/:clinicId/locations/:locationId/workspace-home
```

Boundary:

```text
one backend workspace-home projection
one same-origin Portal BFF
one Portal page
no new mutations
```

The backend performs one common authority gate and bounded summary queries,
then returns one typed snapshot. The Portal BFF uses the established
cookie/session-to-backend mechanism; it must not accept or forward an arbitrary
browser-supplied bearer token. Backend authorization cannot be weakened or
reimplemented in the BFF.

## 7. Rejected alternatives

- **Option B, Portal BFF composition:** rejected because multiple backend reads
  repeat membership work, create a fan-out latency/failure cascade and force
  the BFF to reconcile capability, count visibility and snapshot semantics.
- **Option C, independent widgets:** rejected because it produces N independent
  authority/freshness decisions, visible timing/count side channels, unstable
  partial states and browser-driven fan-out.

## 8. API contract

```ts
type IsoDateTime = string;
type WorkspaceAvailability =
  | 'AVAILABLE'
  | 'NOT_AUTHORIZED'
  | 'NOT_CONFIGURED'
  | 'TEMPORARILY_UNAVAILABLE';
type WorkspaceRoute =
  | 'queue'
  | 'schedule'
  | 'appointments'
  | 'vet/visits'
  | 'quality';

type SectionBase<K extends string> = {
  kind: K;
  availability: WorkspaceAvailability;
  generatedAt: IsoDateTime;
};

type WorkspaceSectionKind =
  | 'QUEUE'
  | 'SCHEDULE'
  | 'APPOINTMENTS'
  | 'VETERINARIAN'
  | 'QUALITY';

type UnavailableSection<K extends WorkspaceSectionKind> =
  SectionBase<K> & {
    availability:
      | 'NOT_AUTHORIZED'
      | 'NOT_CONFIGURED'
      | 'TEMPORARILY_UNAVAILABLE';
    facts?: never;
    action?: never;
  };

type QueueWorkspaceSection =
  | (SectionBase<'QUEUE'> & {
      availability: 'AVAILABLE';
      facts: {
        waitingCount: number;
        requiresActionCount: number;
        oldestWaitAgeBucket:
          | 'NONE'
          | 'LT_5_MIN'
          | '5_TO_10_MIN'
          | '10_TO_30_MIN'
          | 'GT_30_MIN';
        slaRisk: 'NONE' | 'DUE_SOON' | 'OVERDUE' | 'UNKNOWN';
      };
      action: { route: 'queue'; labelKey: 'WORKSPACE_OPEN_QUEUE' };
    })
  | UnavailableSection<'QUEUE'>;

type ScheduleWorkspaceSection =
  | (SectionBase<'SCHEDULE'> & {
      availability: 'AVAILABLE';
      facts: {
        openSlotsToday: number;
        operatingState: 'OPEN' | 'BLOCKED' | 'CLOSED' | 'UNKNOWN';
        configurationWarning: boolean;
      };
      action: { route: 'schedule'; labelKey: 'WORKSPACE_OPEN_SCHEDULE' };
    })
  | UnavailableSection<'SCHEDULE'>;

type AppointmentsWorkspaceSection =
  | (SectionBase<'APPOINTMENTS'> & {
      availability: 'AVAILABLE';
      facts: {
        todayCount: number;
        requiresActionCount: number;
        nextScheduledAt: IsoDateTime | null;
      };
      action: {
        route: 'appointments';
        labelKey: 'WORKSPACE_OPEN_APPOINTMENTS';
      };
    })
  | UnavailableSection<'APPOINTMENTS'>;

type VeterinarianWorkspaceSection =
  | (SectionBase<'VETERINARIAN'> & {
      availability: 'AVAILABLE';
      facts: {
        assignedVisitsCount: number;
        inProgressVisitsCount: number;
        nextVisitAt: IsoDateTime | null;
      };
      action: {
        route: 'vet/visits';
        labelKey: 'WORKSPACE_OPEN_ASSIGNED_VISITS';
      };
    })
  | UnavailableSection<'VETERINARIAN'>;

type QualityWorkspaceSection =
  | (SectionBase<'QUALITY'> & {
      availability: 'AVAILABLE';
      facts: {
        alertState: 'NONE' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN';
        dataFreshness: 'FRESH' | 'STALE' | 'UNKNOWN';
      };
      action: { route: 'quality'; labelKey: 'WORKSPACE_OPEN_QUALITY' };
    })
  | UnavailableSection<'QUALITY'>;

type ClinicWorkspaceSection =
  | QueueWorkspaceSection
  | ScheduleWorkspaceSection
  | AppointmentsWorkspaceSection
  | VeterinarianWorkspaceSection
  | QualityWorkspaceSection;

type ClinicWorkspaceHomeDto = {
  clinicId: string;
  locationId: string;
  serverNow: IsoDateTime;
  generatedAt: IsoDateTime;
  freshness: {
    state: 'FRESH' | 'STALE';
    maxAgeSeconds: 30;
  };
  sections: [
    QueueWorkspaceSection,
    ScheduleWorkspaceSection,
    AppointmentsWorkspaceSection,
    VeterinarianWorkspaceSection,
    QualityWorkspaceSection,
  ];
};
```

Rules:

- the five kinds are returned once in canonical order; their presence reveals
  no tenant data;
- unavailable sections contain no facts, counts, timestamps from domain data
  or action links;
- integer counts are non-negative and saturate at `999` in the transport
  (`999` means “999 or more”) to bound representation and reduce inference;
- all action routes are enum values resolved by Portal against the exact
  clinic/location path; backend never returns arbitrary URLs;
- action copy is selected by Portal from the closed `labelKey` union; backend
  returns no free-form label;
- the available Veterinarian variant is reserved for a later assignment
  contract; 05B emits `NOT_CONFIGURED` with no facts/action for that kind.

## 9. Role and capability matrix

Roles contribute capabilities; they never directly authorize a section.
Multi-role access is the union of capabilities, followed by the same exact
resource-scope evaluation.

| Section | Required capability | Receptionist / Admin | Veterinarian | Count and action rule |
| --- | --- | --- | --- | --- |
| Queue | `booking.queue.read` | `AVAILABLE` | `NOT_AUTHORIZED` unless independently granted | Count and `queue` action only when allowed. |
| Schedule | `schedule.read` | `AVAILABLE` | `NOT_AUTHORIZED` under the current capability map | Count and `schedule` action only when allowed. |
| Appointments | `appointment.registry.read` | `AVAILABLE` | `NOT_AUTHORIZED` unless independently granted | Count and `appointments` action only when allowed. |
| Veterinarian | `clinical.visit.workspace.read` | `NOT_AUTHORIZED` | `NOT_CONFIGURED` in 05B despite the capability | No count or Home action until actor-bound assignment semantics exist. The existing shell may retain its separately authorized `vet/visits` navigation. |
| Quality | `quality.read` | `AVAILABLE` | `NOT_AUTHORIZED` unless independently granted | Bounded alert state and `quality` action only. |

Authority outcomes:

| Actor/scope condition | Result |
| --- | --- |
| `CLINIC_RECEPTIONIST` or `CLINIC_ADMIN` with matching claims and active membership | Available sections follow effective capabilities as above. |
| `CLINIC_VETERINARIAN` with matching claims and active membership | Veterinarian section only under the current map. |
| Multi-role employee | Capability union; no duplicated section and no role-priority override. |
| Revoked or inactive membership | Full normalized 403; no DTO. |
| Claims without membership | Full normalized 403; no DTO. |
| Membership without matching JWT clinic/location claims | Full normalized 403; no DTO. |
| Cross-clinic or cross-location route | Full normalized 403; no existence or section signal. |
| Missing clinic or location JWT scope | Full normalized 403. |
| Malformed clinic/location identifier | Normalized 400 with no tenant lookup. |

## 10. Exact scope rules

1. Validate UUID syntax before any domain query.
2. Authenticate, then require both route identifiers in JWT claims as an early
   reject.
3. In one read-only transaction, verify active, non-revoked employee membership
   in `locationId`, join the location, require its `clinic_id = clinicId` and
   active status, and lock/observe the membership consistently.
4. Evaluate each existing capability with the exact clinic/location resource.
5. Run only the allowed section queries. Never run a query and redact it later.
6. Normalize all scope, membership and resource-denial outcomes; no count,
   timing, cache or error detail may prove whether another tenant exists.

## 11. Section contracts

- **Queue:** manual-confirmation operational states only; database-time SLA
  classification; authoritative ordering stays in Queue and is not reproduced
  on Home.
- **Schedule:** current database day in `clinic_schema.clinics.timezone`,
  reached through the exact location’s `clinic_id`; bounded open-slot count
  and configuration state, no staff/resource IDs.
- **Appointments:** current location day; bounded count, action count and next
  time; no registry item or appointment identifier.
- **Veterinarian:** `NOT_CONFIGURED` in 05B. Assignment, personal workload,
  next visit and `in-progress` facts remain absent until an actor-bound
  assignment/state source is authoritative. The location-wide existing list
  must not be repurposed as “my shift”.
- **Quality:** a bounded operational alert classification, not the full quality
  dashboard and not commercial/owner-return ratios.

An allowed but operationally unconfigured section is `NOT_CONFIGURED`.
Capability denial is always `NOT_AUTHORIZED`. Technical failure after the
common authority gate is `TEMPORARILY_UNAVAILABLE`.

## 12. Freshness and consistency

- PostgreSQL `transaction_timestamp()` is the source of `serverNow` and the
  common snapshot boundary.
- 05B should use one short `READ ONLY, REPEATABLE READ` transaction so authority
  and all successful section facts share a snapshot. If connection-pool
  constraints force independent section queries, they must share one captured
  database boundary and have at most 2 seconds generated-time skew; this
  alternative requires explicit 05B evidence.
- `generatedAt` is database-derived. Section `generatedAt` records its
  successful snapshot time; unavailable sections use the common `generatedAt`
  and never a leaked source timestamp.
- `maxAgeSeconds = 30`. A snapshot older than 30 seconds is `STALE`.
- Backend response is `Cache-Control: private, no-store`; Portal BFF and shared
  intermediaries must not persist it. No ETag or `If-None-Match` in 05B because
  membership revocation must not be bypassed by a 304/shared cache.
- Client refresh is on navigation, explicit retry and visibility restoration;
  a later UI slice may poll no faster than every 30 seconds with one page timer.
- Stale operational data may remain visible only when explicitly marked stale,
  but authorization or membership revocation must remove protected data
  immediately on the next authoritative read.
- A browser-retained stale snapshot must be discarded on any 401/403 or session
  subject/scope change.

## 13. Partial degradation

Full-response failure is mandatory for authentication failure, malformed route
identifiers, missing or incompatible clinic/location claims, inactive/revoked
membership, clinic/location mismatch, or policy/capability infrastructure
failure when safe filtering cannot be completed.

Only after the common authority gate and all section capability decisions
succeed may an allowed section become `TEMPORARILY_UNAVAILABLE`. A section
timeout, database error isolated by the implementation, or unavailable
upstream summary is eligible. Authorization failures are never partial
degradation. If transaction abort semantics prevent isolation, the entire
request returns a normalized retryable technical error rather than fabricated
empty sections.

## 14. Privacy allowlist

Allowed fields are exactly the DTO fields above. Prohibited:

- owner contacts, names or identifiers;
- patient names, pet/owner/hold/appointment identifiers;
- doctor identifiers or individual workload;
- raw audit, clinical, document, payment or financial fields;
- unrestricted or capability-inaccessible counts;
- arbitrary URLs, backend error strings or query diagnostics.

## 15. Threat model

| Threat | Impact | Mitigation | 05B test/evidence gate |
| --- | --- | --- | --- |
| Authenticated enumeration and cross-tenant inference | Tenant/resource discovery | exact claims + DB membership/location join; normalized denial | cross-clinic/location/malformed/no-resource leakage matrix |
| Count leakage | Patient/owner/activity inference | query only authorized sections; fixed unavailable shape without facts; saturation | capability downgrade and zero-query assertions |
| Revoked membership or stale claims | Continued protected access | membership checked on every read; no reusable cache/304 | revoke between reads immediately returns 403 |
| Multi-role overexposure | Capability escalation by persona | evaluator union only; no role shortcut | multi-role exact union matrix |
| Patient/owner existence inference | Sensitive relationship disclosure | no patient section or identifiers; aggregate allowlist | schema/serialization negative assertions |
| Doctor workload disclosure | Staff privacy | no doctor ID or personal-assignment claim | DTO negative assertions and route-wide count semantics |
| Clinical-data leakage | Medical data exposure | no row/list composition or clinical fields | OpenAPI allowlist and fixture sentinel tests |
| Timing side channel | Capability/tenant inference | authority-first, bounded queries, normalized errors, latency buckets | compare denied paths within a documented tolerance |
| Cache-key collision/shared-cache leakage | Cross-session disclosure | `private, no-store`, no ETag, subject/scope change purge | header and BFF cache tests |
| Telemetry/access-log leakage | Sensitive values/high cardinality | fixed route template, section kind/outcome enums; no IDs, counts or errors as labels | telemetry label allowlist/redaction tests |
| Partial-response authorization bypass | Unauthorized facts in degraded 200 | capability decisions before queries; auth failure is full failure | forced evaluator failure returns no DTO |
| BFF bearer forwarding | Token substitution/confused deputy | cookie/session-owned server credential path only; reject browser Authorization | BFF request-header tests |
| SSR/session confusion | Previous actor data shown | no shared cache; bind response to effective subject and exact scope | account/scope-switch browser test |
| Local demo session treated as authority | Production bypass | demo identity never accepted by backend; server JWT/membership required | production-mode negative test |

## 16. Performance contract

The Home is stricter than a registry list because it is a landing-page
projection and must not multiply five list latencies.

- at most 1 authority/location query plus 5 section summary statements;
- no unbounded list fetch, cursor traversal, N+1 or per-row authorization;
- every operational predicate starts with exact `clinic_id` and
  `clinic_location_id` (or reaches clinic only through the exact location);
- each section returns cardinality one; response always has five section rows;
- section statement timeout target 100 ms; whole backend projection budget
  400 ms and serialized response budget 8 KiB;
- 10k operational fixture: p95 < 150 ms, p99 < 300 ms for the whole endpoint,
  zero disk/temp spill, zero sequential scans on large operational fact tables,
  bounded statement/result cardinality;
- cold and warm measurements must both be reported; thresholds apply to the
  deterministic warm measurement, with cold evidence retained for diagnosis.

05B must capture PostgreSQL version/settings, query parameters, fixture
cardinality, returned cardinality and three
`EXPLAIN (ANALYZE, BUFFERS, WAL, SETTINGS, VERBOSE, FORMAT JSON)` plans per
summary query. Evidence must name scans/indexes/joins, estimated versus actual
rows, loops, rows removed, planning/execution time, shared/temp blocks, sort
method/space, hash batches/peak memory and prove cleanup is zero. A 10k fixture
must include skewed sections and unauthorized capabilities to prove skipped
queries.

## 17. Telemetry

Emit one bounded endpoint observation and one per attempted section:

- route template, status class, freshness state, section kind, availability,
  outcome and latency bucket;
- fixed error taxonomy only;
- no subject, clinic/location, counts, search terms, identifiers, raw errors or
  timestamps in labels/log fields;
- alert on whole-endpoint error/latency, authority-infrastructure failures,
  section-unavailable ratio and stale ratio using minimum traffic floors.

Access logs use the route template and status only; path parameter values are
redacted.

## 18. Portal and BFF contract

- canonical page route is `/clinics/:clinicId/locations/:locationId`;
- server-side selection requires `PORTAL_V50_SHELL=true` and future
  `CLINIC_V50_WORKSPACE_HOME=true`;
- reuse `EffectiveSessionProvider` for presentation/navigation hints, but make
  the BFF/backend response authoritative;
- BFF is same-origin, cookie-session based, strips browser `Authorization`,
  validates the typed allowlist and forwards no arbitrary backend errors;
- session missing, forbidden and unsafe parsing fail closed and discard prior
  protected content.

UX states: semantic `h1` for workspace context, `h2` per section, DOM/action
order matching visual order, skip link, keyboard traversal, polite loading
skeleton, full empty, role-specific empty, partial degraded, explicit stale,
retryable technical error, session missing and forbidden. Criticality uses
text/icon plus color. Layout is grid on desktop/tablet and ordered cards on
mobile, supports 200% text, reduced motion and 44 px controls, and never
compresses desktop tables on mobile.

## 19. Feature flag

Proposed runtime flag for later slices:

```text
CLINIC_V50_WORKSPACE_HOME=false
```

Effective exposure requires:

```text
PORTAL_V50_SHELL = true
CLINIC_V50_WORKSPACE_HOME = true
```

05A does not add the flag. Backend 05B may deploy the authenticated endpoint
dark before Portal exposure, but production use remains blocked until the
default-off flag, BFF and Portal page exist.

## 20. Rollout and rollback

1. Deploy backend endpoint dark with telemetry and strict allowlist.
2. Run read-only shadow comparison for an internal clinic cohort; shadow
   results must not be returned or logged with identifiers.
3. Verify authority, privacy, performance and stale/degraded alerts.
4. Enable the Portal flag for the internal cohort, then expand deliberately.

Rollback sets `CLINIC_V50_WORKSPACE_HOME=false`, invalidates any in-process
private snapshot and returns the prior scoped landing behavior. Backend
endpoint exposure may remain dark. No database or migration rollback exists.

Production activation blockers: incomplete 05B tests/EXPLAIN/OpenAPI,
capability or count leakage, BFF bearer forwarding, missing cache headers,
unbounded query, failed alerting, or absent Portal accessibility/browser
evidence.

## 21. Test matrix

05B must cover:

- success for receptionist, admin and veterinarian;
- multi-role union without duplicates;
- role present but capability absent;
- cross-clinic, cross-location, inactive, revoked, claims-only,
  membership-only, missing clinic/location scope and malformed identifiers;
- fixed `NOT_AUTHORIZED` shape with no facts/action and zero section query;
- `NOT_CONFIGURED` and isolated `TEMPORARILY_UNAVAILABLE`;
- evaluator/policy failure produces full failure;
- database time, 30-second stale boundary and revoke-after-snapshot behavior;
- no protected DTO after 401/403, subject change or location change;
- privacy/OpenAPI negative field assertions;
- bounded query count/cardinality, no fan-out/N+1 and required 10k plans;
- `Cache-Control: private, no-store`, no ETag;
- bounded telemetry/redaction.

Portal slice tests must additionally cover BFF header stripping, typed parsing,
server-side flags, D/T/M, loading/empty/error/stale/degraded/forbidden,
keyboard/skip-link, reduced motion and 200% text.

## 22. Implementation slices

Exactly one next slice is selected:

```text
V50-CLINIC-05B / Clinic Workspace Home Backend Projection
```

05B includes only backend DTO, read-only endpoint, exact authority, bounded
summary queries, telemetry, PostgreSQL integration tests, performance evidence
and OpenAPI. Portal BFF/page/UI are not part of 05B.

## 23. Unresolved blockers

No blocker prevents starting 05B. Two explicit limitations must remain visible:

- the existing veterinarian read is location-wide and does not prove personal
  assignment; 05B must return `VETERINARIAN/NOT_CONFIGURED` without
  “my/assigned” counts, actions or doctor identifiers;
- partial section recovery inside one PostgreSQL transaction requires an
  implementation choice (savepoint/isolation or full technical failure) and
  must never convert an authorization failure into partial success.

## 24. Acceptance criteria

05A is accepted when:

- Option A is the sole canonical model;
- exact clinic/location and active membership are mandatory;
- section facts/actions are capability-filtered before query execution;
- the DTO is typed, fixed, bounded and privacy allowlisted;
- freshness, revoke and partial-degradation semantics are deterministic;
- performance and EXPLAIN gates are measurable;
- flag is proposed default-off with safe rollout/rollback;
- `CLN-001` is only `CONTRACT_READY`;
- runtime diff is empty;
- one independent architecture/security review has no veto;
- the only next slice is V50-CLINIC-05B.
