# Stage 5.2A — Display-safe telemedicine audit DTO

## Compatibility and authority

No production consumer depended on raw audit payload. The existing endpoint
`GET /v1/telemed/vet/cases/:caseId/audit-trail` retains centralized
`telemed.vet.audit-trail.read` platform-assignment/data-category authority;
clinic/location scope remains intentionally irrelevant.

## Event and sensitivity matrix

| Event type | Writer payload keys | Display projection |
|---|---|---|
| `ASSIGNED` | `assigneeId` | type/code only |
| `SAFETY_ESCALATED` | none | type/code only |
| `RECOMMENDATION_SAVED` | `recommendationText` | type/code only |
| `FOLLOW_UP_ROUTED` | `followUpNotes` | type/code only |
| `SESSION_STARTED` | `sessionId` | type/code only |
| `DOCTOR_CONNECTED` | `sessionId` | type/code only |
| `OWNER_CANCELLED` | `sessionId`, `reason` | type/code only |
| `DOCTOR_TIMEOUT` | `telemedSessionId`, `reason` | type/code only |

All payload keys are prohibited in the veterinarian response: identifiers and
reasons are internal, while recommendation/follow-up text is arbitrary
user-entered clinical content. Additional stored JSON is also prohibited.

## Exact DTO and ordering

Response remains `{ caseId, serverNow, items }`. Each item has exactly `id`,
closed `eventType`, `summaryCode`, `createdAt`. `eventType` and `summaryCode`
are the same backend-owned closed enum. `createdAt` is RFC3339 UTC. Ordering
remains newest-first with deterministic `created_at DESC, id DESC`. Raw
`payload`, actors and arbitrary metadata are absent.

## Unknown events

The database event-type check constraint and mapper allow-list are closed. The
mapper fails closed for unsupported in-memory/stored input; endpoint returns
`TELEMED_AUDIT_EVENT_UNSUPPORTED` without partial history. Extensibility
requires explicit mapper entry, safe-field approval and tests before an event
becomes displayable.

## Evidence and next step

Mapper unit suite: 9/9 PASS. Canonical Docker audit HTTP matrix: 2/2 PASS
(other platform-smoke tests intentionally filtered). Backend TypeScript build:
PASS. Sensitive stored fields were injected in the HTTP fixture and absent from
serialized response. Next step: Stage 5.2B bounded portal audit section.
