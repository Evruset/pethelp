# Wave 5-B1 — Owner BookingChangeRequest UI contract

## Surface and authority

The canonical implementation is shared React Native + Expo code in
`apps/owner-app` and is used by iOS, Android, and Web. A confirmed booking card
loads the W5-A current request and allows the Owner to request either:

- `CANCEL` — cancellation by Operations;
- `RESCHEDULE` — changing the appointment time by Operations.

No replacement slot is selected or suggested. Submission carries only the
canonical hold identity, request type, and a stable UUID idempotency key. The
response is accepted only when its hold, clinic, location, and slot match the
currently verified Booking projection; the W5-A aggregate remains the
authority for its exact Appointment binding.

## Owner semantics

Both actions require confirmation that the current booking and selected time
remain unchanged until the request is processed. A successful `CANCEL` create
is rendered as `Запрос на отмену: запрос отправлен.` and never as
`Запись отменена`.

The five authoritative request states are mapped as follows:

| State | Owner copy |
| --- | --- |
| `OPEN` | `Запрос отправлен` |
| `PROCESSING` | `Запрос обрабатывается` |
| `COMPLETED` | `Изменение выполнено` |
| `REJECTED` | `Изменение не удалось выполнить` |
| `CANCELLED` | `Запрос отменён` |

Every request status includes an explicit reminder that the Booking is not
cancelled or rescheduled until the separately authoritative Booking status
changes.

## Safety and recovery

- An in-flight ref single-flights confirmation taps.
- Transport retries and `425 IDEMPOTENCY_IN_PROGRESS` reuse the same key.
- A `409` active-request conflict triggers current-request readback instead of
  creating local state.
- Initial load, reload, network retry, malformed/mismatched identity, stale
  booking/request, submission, success, and all five server states have bounded
  Owner copy; backend codes and foreign/internal identifiers are not rendered.
- Expo Web allows only the two W5-A routes through the existing HttpOnly-session
  BFF and forwards only the established safe request headers.

Existing direct Booking cancellation remains unchanged as a separate sticky
capability. This slice adds no Operations UI or processing command, Booking
mutation, slot selection, reallocation, migration, or backend behavior.
