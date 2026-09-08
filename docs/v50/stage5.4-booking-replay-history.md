# Stage 5.4 — Booking Replay History

## Status — COMPLETED

The approved surface is a dedicated responsive `История обработки` panel
opened from Booking Hold Inspector. It is not the audit drawer and has no
global route or navigation item.

## Implemented slice

- The entry action is gated by server-derived `booking.replay.read` and the
  current clinic/location scope; missing capability suppresses it.
- Same-origin `GET /api/booking-holds/:holdId/events` forwards only the server
  session token to the backend replay endpoint. It preserves backend status
  authority and does not grant access itself.
- The proxy emits a closed safe projection only: timestamp, mapped label,
  source and outcome. Raw payloads, event type values, IDs, correlation,
  causation, trace and provider metadata never reach the client.
- The panel keeps loading, empty, retrying/recoverable and unavailable states
  explicit; 401/403/404 are fail-closed while 5xx/network failures offer a
  disabled-in-flight retry. Close aborts the active request and returns focus
  to the entry button.

## Verification

- Chromium replay suite passes 7/7: capability suppression, safe allow-listed
  history with unknown-event fallback, empty, malformed, isolated 401/403/404
  denials, retry de-duplication, abort cleanup and focus return.
- Replay is a named dialog with scoped axe WCAG 2 A/AA coverage; the backdrop
  is not an accessible control.
- Shared regressions pass: booking hold inspector 7/7 and clinic queue 9/9.
- Portal typecheck, Node 22 production build and `git diff --check` pass.
