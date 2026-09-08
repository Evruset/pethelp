# Stage 5.3 — Booking Hold Inspector

## Discovery decision

| Area | Existing state | Decision |
| --- | --- | --- |
| Hold read endpoint | `GET /v1/booking-holds/:holdId` | Reuse; no backend contract change. |
| Hold DTO | `holdId`, `slotId`, `state`, `expiresAt`, `clinicLocationId`, `startsAt`, `endsAt` | Display-safe for a clinic inspector; add a strict portal parser. |
| Capability authority | `booking.hold.read` for receptionist/admin; backend resolves the hold and evaluates clinic/location scope and active membership | Preserve; portal is only a fail-closed UX gate. |
| Existing booking detail | Confirmation queue has a selected-item drawer pattern (`ClinicQueueClientV2`) but no hold-details panel | Add the inspector as a selected queue-item disclosure; do not use Schedule. |
| Schedule dependency | None | Preserve separation; do not require or broaden `schedule.read`. |
| Runtime parser | No parser for this DTO | Add a closed-key parser with UUID and RFC3339 validation. |
| Existing tests | `clinic-queue.spec.ts`; backend hold HTTP matrix | Add a dedicated `booking-hold-inspector.spec.ts`; keep the queue suite as the shared regression. |

## Confirmed existing backend contract

- Endpoint: `GET /v1/booking-holds/:holdId`.
- The response is a small explicit projection: hold/slot/location identifiers,
  `state`, and slot/hold timestamps. It does not include owner contact data,
  payment data, tokens, lock keys, raw event payloads, or authorization
  internals.
- OpenAPI enumerates the currently published states:
  `MANUAL_CONFIRM_PENDING`, `MIS_RESERVATION_PENDING`, `MIS_HELD`,
  `CONFIRMED`, `EXPIRED`, `RELEASED`, `MIS_BOOKING_FAILED`.
- Clinic staff authorization is server-owned: the resource resolves its clinic
  and location, then `booking.hold.read` is evaluated with active membership
  and exact clinic/location scope. Owner and system-worker branches remain
  backend-only and are not portal UI authority.

## Selected implementation boundary

Branch A is selected. The portal will add a same-origin proxy
`GET /api/clinic/booking-holds/:holdId`, preserving authenticated-session and
Authorization forwarding without accepting a client capability or duplicating
resource authorization. The queue disclosure will be shown only after the
server-derived effective session contains `booking.hold.read` and the exact
clinic/location scope. It will display the heading `Состояние удержания слота`,
textual status, and the authoritative absolute timestamps in `<time>` elements.

The parser must reject unknown states, extra or missing keys, invalid UUIDs,
and non-RFC3339 timestamps as one unavailable surface. No raw body or partial
hold data may be rendered. `404` is a normalized unavailable/resource-mismatch
state, distinct from a no-hold result only if the existing endpoint contract
introduces one; it currently has no empty-hold envelope.

## Status — COMPLETED

- The same-origin proxy, closed DTO parser, capability/scoped disclosure,
  abort handling and single-pending retry are implemented.
- Focused Chromium coverage passes 7/7, including exact retry request count,
  capability/scope gating, normalized denials, malformed payloads and scoped
  axe checks. The shared queue regression passes 9/9.
- The V50 shell's duplicated responsive representations made two queue-suite
  locators strict-mode ambiguous. The tests now use the capability-shell's
  current error copy and an exact accessible error heading; no production UI
  was changed for that locator repair.
- `EffectiveSessionProvider` treats HTTP 403 as fail-closed denial, separate
  from recoverable 5xx/network session errors. Portal typecheck, production
  build and `git diff --check` pass on Node 22.22.2.

`booking.replay.read` remains a Stage 5.4 decision candidate and is not part
of this surface.
