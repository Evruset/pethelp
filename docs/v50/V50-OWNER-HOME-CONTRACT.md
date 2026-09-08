# V50 Owner Home read contract

Status: IMPLEMENTING

V50 scope: `OWN-001`, `prototype-v50/index.html#home` → `/owner/home`.

## Authority boundary

`GET /v1/owner/home` is a read-only projection protected by the existing owner JWT and role guards. The owner is always `JwtPayload.sub`; the endpoint accepts no owner identifier. Optional `selectedPetId` is a preference hint and never authority. Every pet, booking hold and telemedicine session in the projection remains owner-scoped.

A foreign, removed or stale valid pet hint returns the same deterministic owned fallback as an absent hint, without revealing whether the requested pet exists. Invalid UUID syntax is a normalized client error.

## Response

The response has `schemaVersion: 1`, database/server time, minimal pet choices, the validated selected pet, one server-prioritized `nextAction`, and at most one `activeCare` item. It excludes routes, arbitrary URLs, mutation commands, internal MIS/payment identifiers, private clinic notes and other-owner data.

Closed action codes:

- `OPEN_EMERGENCY`
- `OPEN_ALTERNATIVE_SLOT`
- `OPEN_TELEMED`
- `OPEN_APPOINTMENT`
- `OPEN_CATALOG`
- `ADD_PET`
- `NONE`

The backend owns action eligibility, priority, user-safe title/description and server deadlines. Flutter maps only these codes to existing callbacks. An unknown or malformed code is non-executable and uses the safe appointments fallback copy; it never becomes an arbitrary route.

## Selected pet

Selection order is:

1. a future server-preferred pet when such a contract exists;
2. an owner-scoped local preference that the response validates;
3. the deterministic first authoritative active pet;
4. no-pet state.

The local key includes authenticated owner identity. A preference is rewritten only from authoritative readback and is cleared when no authoritative pet exists. It does not grant access and is not synchronized across devices.

## Compatibility and rollback

`OWNER_V50_HOME` is default off and effective only with the canonical V50 shell. `Home=ON / Shell=OFF` renders the legacy Home and emits only a non-PII diagnostic. Disabling the Home flag restores the legacy pets/appointments composition without schema or data rollback. The additive read endpoint may remain deployed unused.
