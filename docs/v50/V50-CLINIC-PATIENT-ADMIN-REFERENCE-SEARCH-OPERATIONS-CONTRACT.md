# V50-CLINIC-04M — Administrative Reference Search Operations Contract

Status: `CONTRACT_COMPLETE / DOCUMENTATION_ONLY`.

## 1. Purpose

Define the production-operational boundary for exact administrative-reference
search on the existing clinic/location Patients Registry. This document closes
rate-limit, abuse, privacy, telemetry, performance, rollout, incident and
support decisions before bounded runtime hardening.

## 2. Scope

The contract applies only to authenticated:

```http
GET /v1/clinic/:clinicId/locations/:locationId/patients?administrativeReference=...
```

It governs exact-search requests after the existing Registry authentication,
membership, scope and `patient.admin.read` checks. It does not change authority,
visibility, normalization, result cardinality or Portal behavior fixed by
04J–04L.

## 3. Explicit non-goals

No runtime implementation, Redis/gateway/infrastructure platform, middleware,
exporter, dashboard, alert deployment, migration, index, OpenAPI, Portal UI,
support endpoint, search history, autocomplete, prefix/contains/global search,
automatic account blocking, SIEM integration or product test change is part of
04M.

## 4. Privacy classification

`administrativeReference` is a clinic-location-local operational identifier.
It is not clinical data or owner contact data, but it is sensitive operational
data and is forbidden in broad logs, metrics, traces and support exports.

A search is a security-relevant read access event, not a domain mutation. It
creates no domain audit, outbox or idempotency record. Bounded operational
telemetry is permitted only under the allowlists below.

## 5. Threat model

| Risk | Preconditions | Impact | Existing control | Remaining gap | Required action |
| --- | --- | --- | --- | --- | --- |
| Location enumeration | Authenticated actor with `patient.admin.read` guesses values | Infers likely local identifiers or creates load | Exact scope and all inaccessible matches collapse to `EMPTY` | Repeated empty searches are not production-throttled | Separate actor/scope exact-search limiter and aggregate empty-ratio signal |
| High-frequency exact lookup | Authorized session and automation | Visibility-join/database pressure | Submit-only Portal, bounded 0..1 query, scoped index | Direct API can exceed human rate | Short and sustained distributed limiter |
| Insider brute force | Legitimate membership and capability | Repeated no-leak probes and operational load | Capability, exact location and no-leak outcome | No alert-first abuse correlation | Safe actor/scope event stream and manual review |
| Raw reference disclosure | Query reaches access/application telemetry | Sensitive identifier leaks | Service does not intentionally log raw value | Access URLs and future metrics could capture it | Query-string redaction and strict field/label allowlists |
| Metric cardinality explosion | Query/scope/actor used as labels | Metrics instability and privacy leak | Existing aggregate metric convention | Search-specific taxonomy absent | Low-cardinality labels only |
| Visibility-join load | Large location Registry | Latency and database contention | One query, statement timeout, scoped B-tree | Representative-volume guard is too small for rollout | 10k PR and 100k nightly fixtures |
| Query-plan regression | Planner/schema/statistics change | Local-profile Seq Scan or unbounded work | 04K production-shaped EXPLAIN proof | No durable JSON semantic guard/cadence | Path-triggered semantic EXPLAIN guard |
| Large-clinic rollout | Flag enabled broadly without evidence | Error/latency spike | Default-off independent flag | No staged evidence gate | Five-stage rollout with explicit rollback |
| Duplicate invariant | Corrupt rows produce multiple visible matches | Ambiguous/no-leak failure | Fail-closed `SEARCH_INVARIANT_VIOLATION` | No formal alert/runbook | Critical safe signal and bounded diagnostic procedure |
| Explicit retry repetition | User repeats technical search | Request amplification | No automatic Portal retry | Retry is not separated operationally | Count retry as a normal limited request |
| Scope-switch stale request | User changes location during request | Confusing stale presentation | Abort/generation fencing | Operational diagnosis lacks outcome context | Safe correlation/scope diagnostics, no resubmit |
| Support investigation | Operator needs to diagnose failure | Pressure to request raw reference | Correlation and structured JSON conventions exist | Search-safe checklist absent | Safe diagnostic allowlist and runbook |

Anonymous global, prefix/autocomplete, cross-clinic lookup and write-collision
attacks are excluded because those capabilities do not exist in this read path.

## 6. Rate limiting

Production hardening uses a shared, replica-safe limiter after authentication
and successful Registry authority/scope evaluation but before the visibility
snapshot/reference query. Database work needed to establish authority may
precede it; the reference lookup may not.

The key is:

```text
actorSafeId + clinicId + locationId + "administrative-reference-exact"
```

It never includes the raw/normalized reference, comparison key, IP, session or
patient. IP is an optional secondary abuse signal only. Exact-reference search
is isolated from ordinary Registry browsing/name search.

Initial configurable rollout defaults:

- short window: 20 accepted attempts per minute per key;
- sustained window: 200 accepted attempts per hour per key;
- aggregate location protection: metrics and alert-only initially; a hard
  ceiling requires measured Stage 1–3 traffic and a separate approved value.

Twenty per minute permits normal correction/retry bursts while making automated
enumeration expensive; 200 per hour prevents sustained probing without
inventing a clinic-wide limit before traffic evidence. Both values remain
configuration, not product constants. Counters have TTL and a bounded key cap.

Denial is `429` with the existing safe public search rate-limit code and
`Retry-After`; its operational outcome is `RATE_LIMITED`. It never indicates
whether a reference exists.

## 7. Retry amplification

- One submit produces one request.
- There is no automatic retry loop, polling, debounce request or timeout retry.
- Explicit retry uses the same current scope/query and counts against both
  limiter windows.
- Clear/scope-change abort or stale-response fencing never creates another
  request.
- Read search uses no idempotency key.

## 8. Abuse detection

Rate enforcement and abuse detection are separate. Detection uses counts,
empty/validation/rate-limit ratios, safe actor/location cardinality in secured
event analysis, scope-change frequency, duration, technical errors and
invariant violations.

Suspicious patterns include sustained high frequency, long empty-result runs,
frequent location switching, repeated validation rejection, one actor across
many sessions and reconnect-based limiter evasion. MVP response is alert-first,
manual security review and optional temporary throttling. It never
automatically revokes membership, blocks an account or changes capability.

## 9. Metrics

Logical low-cardinality series:

```text
registry_reference_search_requests_total{outcome,role_class,feature_state}
registry_reference_search_duration_seconds{outcome}
registry_reference_search_rate_limited_total
registry_reference_search_validation_rejected_total{reason_class}
registry_reference_search_invariant_violation_total
registry_reference_search_empty_ratio
```

Allowed label enums are bounded. Forbidden labels include reference/display
value/key/fingerprint, patient/owner/actor/session/correlation IDs and
clinic/location IDs. Secure logs/traces may carry policy-approved safe
actor/scope identifiers, but metrics may not. These are logical contracts for
the existing observability boundary, not a requirement to add Prometheus.

## 10. Outcome taxonomy

Only:

```text
FOUND
EMPTY
VALIDATION_REJECTED
INVALID_COMBINATION
AUTH_DENIED
SCOPE_UNAVAILABLE
POLICY_UNAVAILABLE
RATE_LIMITED
TECHNICAL_ERROR
INVARIANT_VIOLATION
FLAG_DISABLED
```

Unknown, foreign, revoked, archived, consent-invalid and privacy-ineligible
references are all `EMPTY`. No outcome may distinguish those cases.

## 11. Safe fingerprint

No query fingerprint is stored in MVP. The repository has no approved
separate HMAC key lifecycle, rotation/access policy or short-retention store;
adding one solely for this search would create a new security platform.
Aggregate counters and secured actor/scope events are sufficient for initial
rollout.

Plain SHA, application-secret reuse, fingerprint metric labels and support
visibility are forbidden. A future fingerprint requires a separately approved
HMAC-SHA-256 key, rotation and maximum seven-day retention contract.

## 12. Retention

| Category | Retention |
| --- | --- |
| Application JSON logs | Existing platform production-log retention; search adds no longer copy |
| Safe search security event | 14 days, sufficient for bounded abuse review |
| Effective short/sustained limiter state | Logical expiry through `expires_at`, based on database time; maximum 3,900 seconds (65 minutes) |
| Physically expired limiter rows | Target deletion within 86,400 seconds (24 hours) while the backend maintenance loop is healthy |
| Query fingerprint | Absent |
| Aggregate metrics | Existing observability-platform retention |
| Incident evidence | Only an approved security case with its own access/retention |

No search history is stored in a profile. Raw queries must not be copied into
support tickets or incident evidence.

Logical expiry and physical deletion are independent. After `expires_at`, a
row is excluded from `consume`, cannot block or increment an active window,
cannot contribute to `Retry-After` and cannot affect a newly created window.
The consume transaction uses PostgreSQL time and does not require a physical
delete on its critical path.

Physical deletion is an operational target, not a security invariant during a
complete platform outage. The existing application maintenance mechanism runs
cleanup at startup and periodically while a backend maintenance owner is
healthy. It deletes by indexed `expires_at` in idempotent batches of at most
1,000 rows; the default interval is 900 seconds. Concurrent workers may
cooperate safely, and cleanup never takes a full-table lock.

If every backend replica is stopped, cleanup pauses and the 24-hour target may
temporarily be exceeded. No requests are served during that outage. On
recovery, database-time predicates still exclude expired rows and startup
cleanup reduces the backlog, so an expired counter never becomes active again.

Future typed configuration separates:

```text
logicalStateRetentionSeconds = 3900 maximum
physicalCleanupTargetSeconds = 86400
cleanupIntervalSeconds = 900
cleanupBatchSize = 1000
```

Logical retention must cover the largest window and remain at most 3,900
seconds. Physical target must be between logical retention and 86,400 seconds.
Cleanup interval and batch size must be positive.

## 13. Log redaction

Forbidden everywhere:

```text
raw or normalized administrativeReference
comparison key
full request URL/query string
patientId, owner data, patient name or alias
session token, cookie or Authorization header
```

Allowlisted structured fields are event type, policy-approved actor safe ID,
policy-approved clinic/location scope IDs, outcome, duration, result count
`0|1`, correlation ID, feature state, limiter bucket (`short|sustained`),
query-length bucket and application/backend version. No fingerprint is allowed
under the MVP decision.

HTTP access logs must drop the query string or replace the
`administrativeReference` value with `[REDACTED]` before persistence/export.
Exception messages and SQL comments must not include it.

## 14. Tracing

Span name:

```text
clinic.registry.reference_search
```

Bounded attributes:

```text
outcome
feature_state
result_count
query_length_bucket
rate_limited
db_plan_class (test/diagnostic mode only)
```

Reference/key/fingerprint is forbidden in span name, attributes, baggage,
exception text and SQL comments. Sampling cannot depend on a reference value.
Clinic/location and correlation remain subject to the existing secure trace
policy and are not metric labels.

## 15. Performance budget

The production engineering invariants are one bounded Registry query, scoped
B-tree use, repository cardinality read capped at two for corruption defense,
response cardinality 0..1, no N+1, no local-profile full/Seq Scan, no
autocomplete/polling and one canonical item maximum.

Controlled pre-production initial thresholds:

- p95 backend processing at 10k/100k representative fixtures: at most 150 ms;
- p99: at most 300 ms, observed as an engineering release signal;
- `clinic_patient_local_profiles` uses the scoped reference index with no Seq
  Scan and at most two matching rows reaching the invariant boundary;
- one application query for the Registry item, excluding authority/session
  establishment already measured separately.

These are initial controlled-environment thresholds, not production SLA/SLO.
Production SLOs require measured Stage 1–3 baselines.

## 16. Representative-volume fixtures

Fast relevant-PR fixture: 10,000 local-profile rows. Nightly/extended fixture:
at least 100,000 rows. The split keeps relevant PR feedback bounded while
testing large-clinic planner behavior nightly.

Both include multiple clinics and locations, large ordinary visible
populations, invisible patients, revoked/archived/consent-invalid
associations, reference-bearing profiles, misses/hits, realistic selectivity
and identical normalized references legally reused across locations. Fixtures
are deterministic and ANALYZE statistics are refreshed before EXPLAIN.

## 17. EXPLAIN regression guard

Use the production-shaped visibility/reference query and:

```text
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
```

Parse semantic nodes; do not compare textual plans byte-for-byte. Assert the
scoped administrative-reference index name/family, index-capable node on
`clinic_patient_local_profiles`, exact scope/key predicates, bounded
estimated/actual rows, no Seq Scan on that relation and constant application
query count/no N+1.

Planner variation in join order/node decoration is accepted when all semantic
invariants hold. A different index family requires explicit review. A
forbidden scan, lost scope predicate or unbounded row estimate fails the guard.

## 18. CI cadence

- Every PR touching Registry query/service, local-profile schema/index,
  normalizer, reference search flag/config or the focused performance test:
  10k scoped semantic EXPLAIN.
- Nightly: 100k+ plan and controlled performance thresholds.
- Pre-release before each rollout-stage promotion: flag-on load evidence.
- After any migration/index/PostgreSQL-major/statistics-policy change:
  mandatory plan revalidation.
- Portal-only and unrelated changes do not run the heavy database fixture.

## 19. Feature rollout

The existing non-percentage flag
`VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH` remains authoritative.

| Stage | Minimum evidence period | Success criteria | Rollback criteria | Reviewed signals | Decision owner |
| --- | --- | --- | --- | --- | --- |
| 0 default-off | Until 04N gates pass | Tests, redaction, alerts and runbook ready | Any missing gate | CI plan, safe telemetry schema | Clinic backend owner |
| 1 internal/test clinic | 2 business days or 500 searches | No invariant/Seq Scan; thresholds pass; safe logs | Any privacy leak/invariant or sustained technical errors | All search outcomes, latency, limits | Backend + security |
| 2 one small production location | 3 days or 1,000 searches | Error/rate ratios stable; support runbook works | Critical alert, p95 breach for 15 min or policy spike | Volume, empty baseline, p95/p99, support cases | Product ops + backend |
| 3 varied-volume clinics | 7 days or 5,000 searches | No volume-correlated regression; nightly 100k pass | Any plan regression or material baseline deviation | Per-stage aggregate dashboard, alerts | Product ops + SRE/backend |
| 4 broad rollout | Ongoing | Stage 3 evidence accepted and alert ownership staffed | Critical privacy/invariant/plan incident | Production aggregate trends | Product owner + SRE |

Search-count minima are evidence sufficiency gates, not quotas. Percentage
rollout is not specified because the current flag platform is boolean.

## 20. Rollback

Disabling the search flag hides Portal mode and rejects backend reference
queries without affecting ordinary Registry, ordering, Patient Detail
reference, reference mutation, stored values or schema. No migration rollback
or data deletion occurs.

An in-flight request is evaluated by the canonical backend flag at request
time: it either finishes under that evaluation or fails closed. Portal clears
reference state and returns to ordinary Registry; it never silently converts
the request into an unfiltered Registry query. Repeated invariant, redaction,
plan or sustained technical-alert conditions trigger rollback consideration.

## 21. Alerting

Alerts contain no patient/reference/fingerprint.

| Alert | Signal | Suggested threshold | Window | Severity | Runbook action |
| --- | --- | --- | --- | --- | --- |
| Invariant violation | invariant counter | `>0` | 5 min | Critical | Fail closed, correlate, restrict diagnostics, consider flag rollback |
| Technical error ratio | `TECHNICAL_ERROR / requests` | `>5%`, minimum 100 requests | 10 min | High | Check dependencies/version, compare ordinary Registry, rollback if sustained |
| Policy unavailable | `POLICY_UNAVAILABLE / requests` | `>1%`, minimum 50 | 10 min | High | Verify policy/config health; never treat as empty |
| Rate-limited spike | rate-limited ratio | `>10%`, minimum 100 | 15 min | Medium | Distinguish abuse from under-sized limits; manual review |
| Pre-production latency | p95/p99 controlled evidence | p95 `>150 ms` or p99 `>300 ms` | 15 min/run | Release-blocking | Inspect plan/buffers; do not promote |
| Plan regression | semantic EXPLAIN | forbidden scan/index/scope failure | One run | Release-blocking | Stop change, compare statistics/query/index |
| Empty anomaly | empty ratio versus baseline | +30 percentage points, minimum 200 | 30 min | Medium | Check location/data/rollout causes before security escalation |
| Flag-on volume anomaly | request rate versus stage baseline | `>3x`, minimum 200 | 15 min | Medium | Confirm rollout/config, then abuse review |

Thresholds are configurable initial values and must be recalibrated from
Stage 1–3 evidence. A single empty result never alerts.

## 22. Empty-result anomaly

`EMPTY` is normal and preserves no-leak semantics. Only aggregate deviation
with minimum volume may alert. The runbook first checks user input ergonomics,
wrong selected location, data import/reference quality and rollout/config
changes, then considers enumeration. High empty ratio alone is not proof of a
security incident.

## 23. Invariant violation handling

`503 SEARCH_INVARIANT_VIOLATION` remains fail-closed. Increment the dedicated
safe metric, emit a high-priority allowlisted event with correlation ID, alert
without patient/reference and do not automatically retry.

Only restricted engineering/security roles may run a scoped diagnostic query
under an approved incident. Support sees only outcome/scope/correlation.
Repeated violations require pausing rollout and considering immediate flag
rollback; corrupt rows are never returned or selected.

## 24. Support diagnostics

Allow support to establish feature state, validation/rate-limit/outcome class,
duration, correlation ID, policy-approved clinic/location scope, policy or
invariant status, query-length bucket and application/backend version.

Support must not see or request the reference/key/fingerprint, patient match,
foreign patient, owner data, token/header/cookie or raw URL. No support endpoint
is added by this slice; diagnostics use existing restricted logs and approved
incident tooling.

## 25. Runbook

| Symptom | Safe checks/signals | Never request | Rollback/escalation |
| --- | --- | --- | --- |
| Mode absent | Flag state, deployment version, Registry authority | Reference value | Correct rollout config; frontend owner |
| All searches empty | Aggregate empty ratio, selected scope, reference data health | Patient/reference screenshots or foreign match | Roll back recent data/feature rollout; data/backend owner |
| Frequent 429 | Short/sustained bucket, volume baseline, actor/session pattern | Raw queries | Manual security review; tune only with evidence |
| Policy unavailable | Policy/config health and ordinary Registry comparison | Query value | Roll back flag if sustained; backend/on-call |
| Technical errors | Outcome ratio, dependency health, correlation/version | Headers/tokens/raw URL | Roll back if sustained; SRE/backend |
| Plan regression | JSON plan semantics, ANALYZE stats, index/schema change | Production reference | Block release or flag; database/backend owner |
| Unexpected Seq Scan | Relation/node/predicates/statistics | Query value | Stop rollout; correct query/stats/index only in approved slice |
| Invariant violation | Safe event, correlation, count, exact authorized scope | Patient IDs/reference | Critical incident, restricted diagnostics, flag rollback |
| Flag rollback | Flag state, ordinary Registry/Detail/mutation health | Stored references | Confirm isolation; product ops/backend |
| Stale result after scope change | Client generation/abort trace outcome and versions | Reference or patient | Portal owner; disable mode if reproducible/no-leak risk |

Support records correlation ID and safe outcome only. Security owns abuse
review; backend/database own plan/invariant; SRE owns operational dependency
incidents; product ops owns rollout/rollback.

## 26. Security review decision

No separate broad security slice is required. 04M fully fixes the bounded
rate-limit, safe telemetry, redaction, rollout and manual-review requirements;
04N receives independent security-focused validation because it implements
those trust-boundary controls.

A new formal security contract becomes mandatory only for cross-location/global
search, raw/fingerprint retention, external integration, support lookup
endpoint, automatic blocking or global identity semantics.

## 27. Decision matrix

| Decision | Chosen option | Rejected alternatives | Reason | Implementation consequence |
| --- | --- | --- | --- | --- |
| Rate-limit key | actor + clinic + location + exact-search type | IP-only, raw query | Authority-safe, no sensitive key | Replica-safe scoped buckets |
| Short window | configurable 20/min | unlimited, hard-coded value | Human burst allowance with brute-force friction | Config validation and TTL |
| Sustained limit | configurable 200/hour | short-only | Stops slow enumeration | Second bucket |
| Aggregate protection | alert-first | invented hard ceiling | No traffic baseline | Metric/alert, later evidence decision |
| 429 semantics | existing safe code + `Retry-After`, outcome `RATE_LIMITED` | existence hints | Compatibility/no leak | Bounded response mapping |
| Abuse detection | alert-first manual review | automatic revoke/block | Avoid false-positive authority changes | Safe event analysis |
| Auto-blocking | none | membership revoke | Outside read-search authority | Optional manual throttle only |
| Metrics | bounded aggregate enums | actor/scope/query labels | Privacy and cardinality | Allowlisted fields |
| Outcomes | fixed 11-value taxonomy | lifecycle-specific misses | Preserves `EMPTY` no leak | Shared enum/validation |
| Raw query logging | prohibited/redacted | full URL | Sensitive identifier | Access-log filter |
| Fingerprint | absent in MVP | SHA or reused-secret HMAC | No approved key lifecycle | Aggregate abuse signals only |
| Fingerprint retention | none | seven-day store now | Fingerprint absent | No storage/support access |
| Log retention | existing platform; safe event 14 days | search history | Minimum abuse-review window | TTL/config evidence |
| Limiter retention | logical expiry <=65 minutes; healthy-worker physical deletion target <=24 hours | hard physical deletion <=65 minutes during total outage | Consume correctness needs logical expiry, not an unavailable database scheduler | Database-time expiry predicates plus indexed bounded startup/periodic cleanup |
| Tracing | fixed safe span/attributes | query baggage | Correlation without leakage | Attribute allowlist |
| Performance budget | controlled p95 150 ms; observed p99 300 ms | production SLA | No production baseline | Release evidence only |
| CI fixture size | 10k PR, 100k+ nightly | 100k every PR, 120 rows only | Cost/evidence balance | Two fixture tiers |
| EXPLAIN guard | semantic JSON | text snapshot | Planner-tolerant invariants | JSON plan parser |
| CI cadence | path PR/nightly/pre-release/post-index | all suites always | Bounded relevant cost | Path trigger |
| Rollout stages | default-off through broad | unsupported percentage rollout | Current boolean flag | Evidence-gated manual promotion |
| Rollback | flag only, no data/schema change | migration rollback | Isolation already proven | Runbook verification |
| Alerts | bounded ratios/minimum volumes | per-empty alert | Avoid noise/leak | Safe alert payloads |
| Support diagnostics | allowlisted correlation/outcome/scope | reference lookup endpoint | Diagnosis without existence disclosure | Existing restricted tooling |
| Security review | bounded review in 04N | separate broad slice now | Threat boundary is fixed | Security validator for implementation |

## 28. Future test matrix

```text
M-01 rate limit applied after auth and before reference DB lookup
M-02 key scoped by actor/clinic/location/search type
M-03 raw reference absent from limiter key/logs
M-04 429 includes safe Retry-After
M-05 ordinary Registry unaffected by search limiter
M-06 no automatic Portal retry amplification
M-07 safe metric outcomes only
M-08 foreign/revoked/archived all recorded as EMPTY
M-09 no raw query metric labels
M-10 query-string access-log redaction
M-11 tracing contains no raw reference
M-12 fingerprint is explicitly absent
M-13 no fingerprint storage/retention path
M-14 small CI EXPLAIN guard
M-15 nightly representative-volume fixture
M-16 no local-profile Seq Scan
M-17 no N+1
M-18 controlled p95/p99 threshold proof
M-19 alert on invariant violation
M-20 alert payload contains no patient/reference
M-21 empty-ratio alert requires minimum volume
M-22 feature rollout stage controls
M-23 rollback preserves ordinary Registry
M-24 rollback preserves Detail and mutations
M-25 in-flight rollback behavior
M-26 support diagnostics contain safe fields only
M-27 logical rate-limit state expires within 65 minutes independently of physical cleanup
M-28 abuse pattern alert-first behavior
M-29 no automatic membership revoke
M-30 path-based CI trigger
M-31 no domain audit/outbox
M-32 operational runbook validation
```

The shared-limiter foundation also carries the repaired retention proofs:

```text
R-01 expired row does not affect consume after logical TTL
R-02 logical expiry uses database time
R-03 expired row does not affect Retry-After
R-04 new window is created without preliminary physical DELETE
R-05 periodic cleanup removes expired rows
R-06 startup cleanup removes backlog
R-07 cleanup uses bounded batches
R-08 cleanup uses the expires_at index
R-09 concurrent cleanup is safe
R-10 backend outage does not change logical-expiry semantics
R-11 physical deletion target is <=24 hours with a healthy worker
R-12 stale backlog after recovery produces an alert
R-13 logs and alerts exclude limiter identity dimensions
R-14 consume correctness is independent of cleanup availability
```

04M adds no runtime tests.

## 29. Implementation evidence

`V50-CLINIC-04N-B / Registry Shared Rate Limiter Integration` is
`PASS / COMPLETE`.

- The exact `administrativeReference` mode now evaluates authentication,
  capability, active membership, exact clinic/location scope, feature
  availability and request validity before consuming the shared limiter.
  Visibility/reference SQL runs only after an allowed consume.
- The safe limiter identity is actor, clinic, location and the fixed
  `administrative-reference-exact` namespace. Raw/display/normalized
  references, comparison keys and patient data never enter limiter input,
  state or public errors.
- Typed defaults are 20 attempts per 60 seconds and 200 attempts per 3,600
  seconds. Invalid, inverted or retention-incompatible policies fail startup.
- Denials retain the existing safe
  `PATIENTS_REGISTRY_SEARCH_RATE_LIMITED` 429 response and database-derived
  integer `Retry-After`. Shared-limiter failures fail closed as
  `PATIENTS_REGISTRY_POLICY_UNAVAILABLE` 503 without reference lookup or
  process-local fallback.
- Exact search invokes the shared PostgreSQL limiter once and the legacy
  per-process limiter zero times. The legacy map remains only for ordinary
  `q` search, whose behavior is unchanged.
- Real PostgreSQL tests prove short/sustained thresholds, durable denied
  attempts, expired-window admission, actor/location isolation, two service
  instances, concurrent zero over-admission, failure isolation, privacy and
  zero domain side effects. Registry, Patient Detail and shared-foundation
  regressions pass.

04N is not complete. Access-log redaction deployment, safe telemetry/alerts,
representative 10k/100k semantic EXPLAIN cadence, rollout evidence and
operational runbook validation remain.

## 30. Recommended next slice

`V50-CLINIC-04N-C / Registry Reference Search Operational Evidence Closure`.

Close only the remaining redaction, telemetry/alert, representative-plan,
rollout and runbook evidence fixed by this contract. Do not change Registry
authority, limiter semantics, migrations or product behavior.
