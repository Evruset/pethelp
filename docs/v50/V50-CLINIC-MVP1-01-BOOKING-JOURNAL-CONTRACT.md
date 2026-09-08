# V50-CLINIC-MVP1-01 — Booking Journal Contract

Status: `CONTRACT_READY`

Date: 2026-08-01

Runtime implementation: `NOT_STARTED`

## Decision

The clinic MVP is reset around a booking journal, not a dashboard. The canonical scoped route is `/clinics/:clinicId/locations/:locationId`; `/clinics/:clinicId/locations/:locationId/journal` is a convenience alias that must server-redirect to the canonical route when the new flag is enabled. With the flag disabled, existing 05C behavior is preserved and no journal alias is exposed.

The current Workspace Home remains a tested operational foundation, but is `RETAINED_FOUNDATION / NOT_PRIMARY_MVP_HOME`. Its possible future route is `/overview`; no route move occurs in this slice. `V50-CLINIC-05D` is `SUPERSEDED_BY_PRODUCT_RESET`.

## Product outcome

The journal is the employee's day workspace: see appointments and requests in authoritative time order, understand what needs action, open a bounded detail, and execute only permitted commands. It optimizes time-to-next-action and reduces missed confirmation SLA without implying clinical, financial, capacity, or owner-contact authority.

Primary navigation is closed for MVP:

1. `Журнал записи` — canonical scoped root.
2. `Заявки` — current Queue workflow.
3. `Клиенты` — current Patients registry and detail.
4. `Сотрудники` — target contract; authority/API gap remains.
5. `Настройки` — optional and capability-gated; target contract only.

Dashboard, Quality, Telemedicine and other secondary modules leave primary MVP navigation. Existing deep links may remain; this contract does not remove runtime routes.

## Authority and security

Chosen design: **Variant A — one backend journal projection**. A future request performs one active clinic-membership and exact-location scope gate, then filters sections, fields and actions by effective capabilities. Navigation is presentation only and never grants authority. The Portal BFF uses only the server-held HttpOnly session and must not accept browser bearer substitution, redirects, arbitrary query forwarding, or unbounded bodies.

Existing Queue, Appointment Registry and Schedule endpoints remain reusable domain authorities, but a browser/BFF fan-out cannot claim a consistent journal snapshot: clocks, transactions, pagination and failures are independent. The future projection may reuse their query/service logic behind one bounded read transaction; it must not broaden their scopes.

Proposed future read API (not implemented):

```http
GET /v1/clinic/:clinicId/locations/:locationId/journal?date=YYYY-MM-DD&cursor=opaque&limit=50
```

Response contract: `serverNow`, `scope`, `date`, ordered `entries`, capability-filtered `sections`, `availableActions`, freshness metadata and opaque next cursor. The BFF/parser must require response `scope.clinicId`, `scope.locationId`, and `date` to exactly equal normalized route/query values; mismatch is a normalized authority failure that synchronously purges protected state. A cross-scope upstream `200` is tested as no-leak, never as stale retention.

Every entry has a projection-only opaque `entryId` (never accepted by domain commands), `kind`, scheduled/effective timestamp, closed target status, version and allowed actions. Field allowlists are closed:

| Entry kind / required capability | Permitted journal facts |
|---|---|
| request / `booking.queue.read` | opaque entry ID, bounded pet display name, bounded service label, requested/start/end time, target status, SLA deadline/state, version, projected actions |
| appointment / `appointment.registry.read` | opaque entry ID, bounded pet display name, bounded service label, bounded assigned-staff display name, start/end time, target status, version, projected actions |
| schedule availability / `schedule.read` | opaque entry/column ID, bounded staff display name, start/end time, availability classification/freshness; no raw capacity |
| client lookup / `patient.admin.read` | opaque lookup ID, bounded pet display name and clinic-local alias only; detail remains a separately authorized route |

Raw hold/appointment/pet/owner/staff IDs are not projection IDs and are never exposed unless an existing separately authorized deep-link contract explicitly requires a bounded opaque reference. Owner names/contacts/profile, staff contacts/profile, clinical notes/diagnoses/documents, payment data, internal capacity, raw integration payloads and cross-location identifiers are excluded. Unknown kinds, fields, statuses or actions fail closed; malformed payloads do not replace the last valid technical snapshot.

Ordering is backend-authoritative and stable: effective time, server priority, stable opaque tie-breaker. Local timers or status presentation must never reorder rows. Refresh/polling may replace ordering only after a complete valid authoritative snapshot.

## Closed target status taxonomy

| Target / exclusive source predicate | Portal label; visibility/bucket | Actions; terminal; non-color semantics; owner effect |
|---|---|---|
| `REQUEST_PENDING`: hold `MANUAL_CONFIRM_PENDING` | `Ожидает подтверждения`; day + active | confirm/reject/alternative only if projected; nonterminal; clock+text/icon; owner still waiting |
| `ALTERNATIVE_PENDING`: hold `ALTERNATIVE_PENDING` **without** a canonical pending proposal snapshot | `Предложено другое время`; day + active | no owner decision action; nonterminal; exchange icon+text; owner sees proposal state |
| `OWNER_DECISION_PENDING`: canonical pending alternative proposal bound to the hold | `Ждём решения клиента`; day + active | clinic read-only; nonterminal; person/clock icon+text; owner may accept/decline |
| `CONFIRMED`: canonical appointment `SCHEDULED`; correlated hold `CONFIRMED` is suppressed | `Подтверждено`; day + active | open detail only until commands contracted; nonterminal for journal history; check icon+text; owner confirmed |
| `COMPLETED`: canonical appointment/hold `COMPLETED` with appointment precedence | `Завершено`; day/history | open detail; terminal; check-circle+text; owner sees completed authority where exposed |
| `NO_SHOW`: appointment `NO_SHOW` | `Не пришли`; day/history | open detail; terminal; person-off icon+text; owner effect follows appointment authority |
| `CANCELLED`: appointment `CANCELLED` | `Отменено`; day/history | no journal mutation; terminal; cancel icon+text; owner cancellation authority unchanged |
| `REJECTED`: no canonical persisted source proven | `Отклонено`; hidden until authority exists | none; blocked mapping; text/icon specified only after source approval; no invented owner effect |
| `EXPIRED`: hold `EXPIRED` or authoritative expiry result | `Истекло`; day/history | none; terminal; clock-off icon+text; owner sees authoritative expiry |
| `RELEASED`: hold `RELEASED`, excluding correlated appointment terminal rows | `Освобождено`; history | none; terminal; unlock icon+text; distinct owner-facing released state |

`SLA_BREACHED` is source evidence for overdue presentation, not an additional target status. MIS/payment/cancellation/reschedule intermediate states are not exposed until an explicit mapping is approved. Projection identity is backend-owned: appointment is canonical after creation; correlated hold and appointment rows deduplicate to one `entryId`; proposal state refines (and is mutually exclusive with) raw `ALTERNATIVE_PENDING`; source precedence and correlation are tested at transaction boundaries.

## Commands and reuse

| User intent | Existing authority | Decision |
|---|---|---|
| Open request / appointment / client | Queue, Appointment Registry, Patients routes | `READY`; closed scoped links only. |
| Confirm manual request | `POST /v1/clinic/booking-holds/:holdId/confirm` | `READY`; retain version/idempotency and backend transition authority. |
| Decline/release request | existing clinic decline/release command | `MODIFY`; journal wording must not collapse released/rejected/cancelled semantics. |
| Propose alternative slot | `POST .../alternative-slot` | `READY`; `Idempotency-Key` and `If-Match` required. |
| Owner accepts/declines alternative | owner authority | `BLOCKED` in clinic UI; clinic may only observe authoritative result. |
| Edit schedule capacity/blackout | Schedule APIs | `READY` as deep workflow, not inline journal mutation. |
| Create manual appointment | only manual slot creation is proven | `MISSING`; manual slot is not an appointment. |
| Cancel/reschedule confirmed appointment from clinic journal | no closed clinic command contract proven | `MISSING`; do not route through owner commands. |
| Manage staff/settings | role-guarded schedule fragments exist, dedicated capability absent | `MISSING`; fail closed and omit navigation until contracted. |

Current confirm, decline and alternative controllers are guarded by clinic administrator/receptionist roles plus transactional exact-scope/state checks; no stable mutation capability exists today. Therefore future `availableActions` may be projected only by the same backend command policy and current state/version, never by Portal role checks. Before journal runtime, this policy must either expose a stable action-authority service/capability or keep actions absent; the read contract does not invent mutation capabilities. Confirm requires `MANUAL_CONFIRM_PENDING`; decline follows its existing FIFO/state guard; alternative permits only backend-supported pending states. All three require `If-Match`, payload-bound `Idempotency-Key`, exact scope, audit correlation and authoritative read-after-write reconciliation. The journal never applies optimistic state-machine transitions.

## UX and responsive behavior

Desktop composition is normative: toolbar → pending SLA bar → filters → day grid → selected-entry drawer. The day grid uses vertical time and horizontal staff columns; unassigned items remain explicit rather than assigned client-side. Week view is optional and limited to one selected employee; it cannot block Day MVP. Drag-and-drop is not required, and manual reschedule uses explicit authoritative slot selection. Mobile uses date → urgent requests → agenda list → full-screen entry detail. All layouts use non-color status label/icon, explicit permitted actions, and no hover-only information. Required presentations: loading, empty, technical failure with retry, stale-valid snapshot, partial capability view, forbidden/not-found, offline, malformed refresh retained, and terminal entries. A technical failure must never render as an empty journal.

SLA presentation is `normal`, `due-soon`, `overdue`, `not-applicable`, or `unknown`, with text/icon plus color. One shared UI clock updates visible countdowns; no timer per row. Hidden-tab restore recomputes from authoritative `serverNow` offset, while authoritative polling corrects drift. Impossible calendar timestamps are rejected.

## Feature flag and rollback

Future canonical flag: `CLINIC_MVP1_BOOKING_JOURNAL`, exact string `true`, default false, server evaluated. Off preserves the current 05C scoped root and current navigation. On selects the journal root and alias redirect only after its backend/BFF/UI dependencies are ready. Rollback is flag-off without schema rollback. The 05C flag remains independent until route disposition is implemented.

## Performance and observability budgets

These are target budgets to confirm during the backend contract, not measured claims:

- Backend p95 < 300 ms and p99 < 500 ms for a bounded pilot day.
- Response <= 128 KiB; cardinality never exceeds the capped limit.
- No N+1, disk spill, or large-table full sequential scan.
- Portal initial useful render < 2.5 s on the local/pilot profile.
- Selection feedback < 100 ms; drawer open < 150 ms.
- One shared clock must not cause a whole-grid rerender each SLA second.
- BFF timeout and body-size bounds remain explicit; no unbounded fan-out.
- Navigation/action telemetry contains route, result, latency bucket and correlation ID only; no owner/pet names, contacts, notes or tokens.
- Alert on elevated projection failures, authorization denials, malformed upstream payloads and latency SLO breach; never log protected payloads.

## Exact future verification matrix

Backend: exact scope; capabilities; day boundary; timezone; staff columns; pending ordering; action projection; privacy; query count; performance; double-booking regression.

BFF: browser `Authorization` ignored; server session token; route validation; exact response route/scope/date equality; cross-scope upstream `200` no-leak; normalized errors; no-store; strict parser; timeout; malformed body; oversized body.

Portal: root route; navigation; toolbar; grid; drawer; SLA; confirm; reject; alternative; manual create; search; filters; stale; 401/403 data purge; mobile agenda; keyboard; axe; 200% text; no overflow. Unit evidence also proves one shared clock, no row timers, five SLA presentations, hidden restore, polling drift correction, no local reorder, and last-valid retention after malformed technical refresh.

Local E2E chain 1:

```text
owner create request
→ clinic journal
→ confirm
→ owner confirmed
```

Local E2E chain 2:

```text
owner request
→ clinic alternative
→ owner accepts
→ clinic journal consistent
```

Rollback: flag off restores exact 05C root/navigation and emits no journal request.

## Delivery sequence

1. `V50-CLINIC-MVP1-02` — interactive UX prototype and accepted evidence for the journal.
2. Backend projection/security contract implementation.
3. Portal BFF/parser and journal read UI behind the default-off flag.
4. Command integration and Workspace Home route disposition.
5. End-to-end certification, rollout and evidence update.

No authoritative booking-journal prototype is currently accepted: `#clinic-workspace` is a summary/workspace reference, not the required operational journal. Therefore the one next bounded slice is exactly `V50-CLINIC-MVP1-02 / Booking Journal Interactive UX Prototype`.

## Exclusions

No runtime route, endpoint, migration, state-machine, role, dependency, WebSocket/SSE, clinical record, billing workflow, staff administration or production rollout is implemented by MVP1-01. PR #68's optional Linux `lightningcss` CI failure remains a separate CI slice and is not a product blocker.
