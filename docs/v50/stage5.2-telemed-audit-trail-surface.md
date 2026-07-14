# Stage 5.2 — Veterinarian Telemedicine Audit Trail surface

## Decision

**Backend prerequisite required; no portal production surface is added.** The
existing endpoint is `GET /v1/telemed/vet/cases/:caseId/audit-trail` and uses
`telemed.vet.audit-trail.read` with `platform-assignment` authority. Clinic and
location scopes are intentionally not authority for this platform resource.

## Contract decision

| Area | Existing state | Required change |
|---|---|---|
| Veterinarian telemed list | `/telemed/vet` queue with selected-case workspace | Reuse as audit entry point |
| Veterinarian telemed detail | Selected case in the queue workspace | Add audit section only after safe DTO exists |
| Audit endpoint | `GET /v1/telemed/vet/cases/:caseId/audit-trail` | Preserve path and evaluator |
| Audit DTO | `{ caseId, serverNow, items[] }`; items include raw `payload_json` | Publish safe display projection/discriminator |
| Authority | Central evaluator, platform-assignment, data-category policy | Preserve |
| Runtime parser/tests | No portal audit parser or audit suite | Add against approved DTO |

## Why the DTO is insufficient

The service maps database `payload_json` directly to `items[].payload`. There
is no documented event allow-list, payload schema, safe metadata projection or
extensibility rule for portal rendering. Rendering it risks disclosure of owner
contact/profile data, documents, tokens, authorization internals or
infrastructure metadata. A frontend whitelist would invent a public contract.

## Required backend slice

Keep the endpoint and authorization model. Define a versioned display-safe
event projection with exact fields: event ID, approved event type, RFC3339
timestamp, optional approved actor label/type and event-specific safe summary.
Explicitly exclude raw payload, owner contact/profile, tokens, exception stacks,
authorization reasons and infrastructure identifiers. Document event ordering;
the current query is newest-first (`created_at DESC, id DESC`).

## Future portal surface

Place `История консультации` in the existing selected-case workspace. Gate it
after effective-session load and `telemed.vet.audit-trail.read`; do not add a
clinic/location gate. Its proxy must validate only case ID, forward session
authorization and normalize upstream errors. Runtime parsing must enforce the
approved DTO, event semantics and timezone-aware timestamps, failing closed for
malformed HTTP 200.

## Test plan and next action

Add a dedicated audit Playwright suite after the DTO is published: gate request
suppression, newest-first rendering, empty/error/retry states, exact GET counts,
data-minimization and scoped axe. Next action: backend safe-audit-DTO slice and
focused HTTP matrix; then implement the bounded portal section.

## Resolution

The original `BLOCKED_BY_SCOPE` decision is resolved. Stage 5.2A replaced raw
`payload_json` with the backend-owned display-safe DTO; Stage 5.2B implemented
the bounded portal audit section in the veterinarian selected-case workflow.
Raw payload is absent from the veterinarian response. **Stage 5.2: COMPLETED.**
See [Stage 5.2A safe DTO](stage5.2a-telemed-safe-audit-dto.md) and
[Stage 5.2B portal implementation](stage5.2b-telemed-audit-portal.md).
