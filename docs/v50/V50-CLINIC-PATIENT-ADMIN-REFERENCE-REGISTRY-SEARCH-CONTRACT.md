# V50-CLINIC-04J — Administrative Reference Registry Search Contract

Status: `CONTRACT_COMPLETE / DOCUMENTATION_ONLY`.

## 1. Purpose

Define one bounded implementation contract for finding an already-visible
clinic patient by the exact clinic-local administrative reference. Search is a
filter over the authorized Registry population, never a source of authority.

## 2. Scope

The future change extends the existing exact-location Registry route:

```http
GET /v1/clinic/:clinicId/locations/:locationId/patients?administrativeReference=PET-004281
```

It adds strict query parsing, exact normalized matching, a nullable display
field in each Registry item, one default-off search flag, scoped index use,
OpenAPI/parser compatibility and bounded PostgreSQL/HTTP tests.

## 3. Explicit non-goals

No separate lookup endpoint, global/clinic-wide/cross-location search, prefix,
contains, substring, fuzzy, phonetic, wildcard, regular-expression or full-text
search; no autocomplete, per-keystroke requests, bulk lookup, QR/barcode,
PMS/1C, owner contact, clinical/document search, Detail or mutation changes.
`04J` adds no runtime, migration, OpenAPI, Portal, tests, packages or telemetry.

## 4. Definitions

- **Display reference**: nullable `administrativeReference`, preserving accepted
  user case for presentation.
- **Comparison key**: server-only Unicode 17 full Default Case Folding result.
- **Visible Registry set**: patients passing current exact-location association,
  consent, privacy, pet and authority predicates.
- **Exact reference search**: equality on the comparison key inside that set.

## 5. Security principle

Reference is not authority. Evaluation order is mandatory:

1. authentication;
2. active exact-location membership;
3. requested clinic and location ownership/scope;
4. effective `patient.admin.read`;
5. current association, consent, privacy and pet qualification;
6. reference filter;
7. canonical response projection.

A global reference lookup followed by an access check is forbidden. Query
validity may be established before SQL, but it must not produce a database
lookup or existence signal before authority and visibility are established.

## 6. Exact clinic/location scope

The path supplies both `clinicId` and `locationId`; no other scope is valid.
Reuse of the same key in another location or clinic is expected. No clinic-wide,
multi-location, multi-clinic or platform lookup path may exist.

## 7. Search semantics

MVP is exact normalized equality only. It returns zero or one visible item.
Prefix search is deferred to a separate privacy/performance slice; it is not an
implicit fallback when exact search returns no match.

## 8. Query normalization

Backend uses the same canonical function and pinned Unicode 17.0.0 folding as
mutation uniqueness:

1. reject control/format/line/tab input;
2. NFC;
3. trim and collapse internal whitespace to one ASCII space;
4. validate display format;
5. full locale-independent Default Case Folding;
6. NFC comparison key.

No `lower()`, `citext`, locale collation or separately implemented search
normalizer is allowed. Portal may perform NFC/trim/space collapse for UX but
sends the display query; backend remains authoritative.

## 9. Query validation

After display normalization the query is 1–40 Unicode code points and contains
only Unicode letters, Unicode decimal digits, ASCII space, `-`, `_`, `/`, `.`.
Blank, emoji, quotes, backslash, control/format/line characters, wildcard/regex
tokens, URL, email, phone-like and unbounded free text are rejected as
`400 INVALID_ADMINISTRATIVE_REFERENCE_QUERY` before database lookup. Unknown
properties and repeated/conflicting query parameters are rejected.

## 10. API shape

The canonical Registry endpoint accepts:

```text
administrativeReference?  exclusive exact-reference display query
limit?                    existing 1..100 bound; permitted but result remains <=1
q?                        existing pet-name prefix; mutually exclusive
cursor?                   existing cursor; mutually exclusive with reference
```

No `/by-reference`, `/references/:value/patient` or single-result DTO is added.
When the search flag is off and `administrativeReference` is supplied, return
`404 ADMINISTRATIVE_REFERENCE_SEARCH_UNAVAILABLE`; never ignore the parameter
and return the ordinary Registry.

## 11. Registry projection

Every Registry item gains required nullable:

```text
administrativeReference: string | null
```

This is the exact-location display value. It is distinct from official name and
future alias presentation. Comparison key, profile version/timestamp, source,
audit, idempotency and global identifiers are forbidden. Existing
`additionalProperties: false` remains.

## 12. Result cardinality

Exact location uniqueness makes cardinality `0..1`. The response retains the
canonical Registry envelope (`clinicId`, `locationId`, `serverNow`, `items`,
`nextCursor`). A miss is `200` with `items: []` and `nextCursor: null`; a hit
contains one item and `nextCursor: null`. There is no total count or match hint.

## 13. Pagination

Reference search creates no cursor. `administrativeReference + cursor` is
`400 INVALID_SEARCH_COMBINATION`, because the cursor binds another result set.
Existing `limit` is allowed and validated normally but cannot increase the
result beyond one. Ordinary Registry keyset pagination is unchanged.

## 14. Filter compatibility

`administrativeReference` is an exclusive semantic filter. It cannot combine
with `q`, owner/name/status/appointment filters, any future free-text filter or
cursor. Only path scope and canonical `limit` are compatible. Conflicts return
`400 INVALID_SEARCH_COMBINATION`.

## 15. Authority and capability

Search requires only existing `patient.admin.read`; write capability and the
mutation flag are irrelevant. Existing Registry session, membership, scope,
centralized capability and current visibility semantics are reused unchanged.
Platform and veterinarian behavior does not gain a new override.

## 16. Privacy and no-leak

A reference that exists only in another clinic/location, or whose patient is
revoked, archived, consent-invalid or privacy-ineligible, produces the same
`200 items: []` as an unknown value. It must not produce a foreign scope,
patient, owner, name, alias or match hint. Lack of Registry authority retains
the Registry’s canonical 401/403/404 boundary and is distinct from no result.

## 17. Collision defense

The scoped unique index is authoritative. If corrupt data nevertheless produces
more than one visible match, return `503 SEARCH_INVARIANT_VIOLATION`, no items,
and a safe operational alert. Never select a winner or expose a mutation
collision. `409 ADMINISTRATIVE_REFERENCE_ALREADY_IN_USE` remains mutation-only.

## 18. Database/index strategy

Use the existing partial unique B-tree:

```text
(clinic_id, clinic_location_id, administrative_reference_key)
WHERE administrative_reference_key IS NOT NULL
```

The query must bind all three columns and join/filter through the current
visibility relation. Searching display text, key without scope, runtime SQL
case conversion or a sequential scan at representative volume is forbidden.
No additional index or migration is required unless EXPLAIN disproves coverage.

## 19. Performance limits

One indexed lookup, at most one projected row, bounded joins, no N+1, no full
scan, wildcard, autocomplete, polling or background request. Expected lookup
complexity is B-tree `O(log N)`; no unevidenced latency SLA is promised.
Implementation proof requires representative-volume `EXPLAIN (ANALYZE,
BUFFERS)`, scoped index use, no sequential scan for the lookup and bounded
response size. Existing Registry actor+scope search rate limiting applies
before SQL under its configured threshold and `Retry-After` contract.

## 20. Feature flag

Add default-off read/search flag:

```text
VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH
```

It gates only use of the reference query and the corresponding Portal search
mode. Ordinary Registry, Detail display and reference mutation remain
unchanged. Rollback cannot silently reinterpret or ignore the query.

## 21. Audit and observability

No domain mutation audit/outbox is emitted. Security/operational telemetry may
record event type, safe actor ID, clinic/location, search type
`ADMINISTRATIVE_REFERENCE_EXACT`, result cardinality `0|1`, duration,
correlation ID, timestamp, normalized length and a pinned non-reversible
fingerprint. Raw query/reference, names, alias, owner data, comparison key and
patient UUID are forbidden in ordinary logs without an established masking
policy.

## 22. Error model

| Status/code | Meaning |
|---|---|
| `400 INVALID_ADMINISTRATIVE_REFERENCE_QUERY` | malformed reference query; no SQL |
| `400 INVALID_SEARCH_COMBINATION` | reference combined with incompatible filter/cursor |
| `401 AUTHENTICATION_REQUIRED` | no authenticated session |
| `403 ACTION_NOT_PERMITTED` | no Registry read authority |
| `404 REGISTRY_SCOPE_UNAVAILABLE` | canonical unavailable/foreign scope |
| `404 ADMINISTRATIVE_REFERENCE_SEARCH_UNAVAILABLE` | reference-search flag off |
| `429 PATIENTS_REGISTRY_SEARCH_RATE_LIMITED` | existing scoped limiter |
| `503 POLICY_TEMPORARILY_UNAVAILABLE` | current visibility policy unavailable |
| `503 SEARCH_INVARIANT_VIOLATION` | duplicate/corrupt result; fail closed |

An unknown or inaccessible patient is not an error: `200`, empty items.

## 23. Portal UX contract

Future Registry UI places a distinct **Внутренний номер** mode in the existing
search/filter area. It is not mixed with name search without explicit mode
selection. Exact search executes only on submit, with no autocomplete or
per-character requests. Empty copy is: **Пациент с таким внутренним номером не
найден в этой локации.** It never says a match exists elsewhere or is forbidden.

## 24. Decision matrix

| Decision | Chosen option | Rejected alternatives | Reason | Implementation consequence |
|---|---|---|---|---|
| Search mode | exact normalized match | prefix/contains/fuzzy | unique structured value, least enumeration | equality only |
| API shape | Registry `administrativeReference` query | lookup endpoint/path value | reuses authority/envelope | extend strict Registry query DTO |
| Normalization | mutation Unicode 17 function | `lower`, `citext`, locale | identical equality semantics | import one canonical normalizer |
| Scope | clinic + location path | clinic/global/multi-scope | uniqueness and authority boundary | bind both scope columns |
| Authority ordering | Registry authority/visibility before match | global lookup then authorize | no enumeration | filter inside authorized set |
| Registry projection | required nullable display reference | omit/key/source | confirms safe match | additive DTO/OpenAPI/parser field |
| Cardinality | 0 or 1 in canonical envelope | single DTO/multiple rows | scoped uniqueness | `nextCursor: null` |
| Pagination | no cursor for reference | reference cursor/ignore cursor | no ambiguous result set | reject combination |
| Filter combinations | exclusive except limit | combine with q/free text | predictable semantics | strict conflict error |
| Empty result | `200 items: []` | 404/403/match hint | foreign and unknown indistinguishable | neutral UI copy |
| Foreign/inaccessible | empty result | existence denial | no leak | visibility predicates precede match |
| Collision defense | safe 503 + alert | arbitrary winner/list | corrupt invariant | cardinality assertion |
| Index | existing scoped partial unique B-tree | new/lower/display/global index | exact query already covered | EXPLAIN gate, no migration by default |
| Feature flag | new default-off search flag | mutation flag/unflagged | independent read rollout | ordinary Registry unaffected |
| Audit/telemetry | safe operational event, no raw query | mutation audit/raw logs | read, privacy | masking/fingerprint only |
| Performance | one indexed bounded lookup | scan/autocomplete/N+1 | predictable volume | plan and representative fixture proof |
| Portal UX mode | explicit bounded mode, submit only | mixed/per-keystroke | exact intent and rate control | future separate input/mode selector |
| Error model | bounded 400/401/403/404/429/503 | mutation 409/raw errors | safe actionable outcomes | strict normalized mapping |

## 25. Future test matrix

```text
J-01 exact normalized reference returns one visible patient
J-02 unknown reference returns empty items
J-03 same reference in another location not returned
J-04 same reference in another clinic not returned
J-05 revoked association returns empty items
J-06 archived association returns empty items
J-07 consent/privacy denial returns empty items
J-08 user without patient.admin.read denied
J-09 inactive membership denied
J-10 malformed query rejected before DB lookup
J-11 Unicode case-fold equivalent query matches
J-12 NFC-equivalent query matches
J-13 collapsed-space equivalent query matches
J-14 contains query not supported
J-15 wildcard query rejected
J-16 reference plus cursor rejected
J-17 reference plus incompatible filter rejected
J-18 Registry item includes display reference
J-19 comparison key never returned
J-20 result cardinality is 0 or 1
J-21 corrupt duplicate invariant fails closed
J-22 feature flag default-off
J-23 ordinary Registry unaffected when flag off
J-24 Detail/reference mutation unaffected by search rollback
J-25 query uses scoped unique index
J-26 representative volume avoids sequential scan
J-27 no raw reference in logs/telemetry
J-28 no domain mutation audit/outbox
J-29 pagination envelope remains canonical
J-30 Registry existing ordering unaffected without reference filter
J-31 no N+1 read
J-32 no global lookup path
```

## 26. Recommended next slice

`V50-CLINIC-04K / Clinic Patient Administrative Reference Registry Search
Backend`: add only the Registry exact query parameter, strict DTO, nullable
projection, default-off search flag, authority-first indexed lookup, OpenAPI,
bounded PostgreSQL/HTTP proofs and Portal parser compatibility without UI.
