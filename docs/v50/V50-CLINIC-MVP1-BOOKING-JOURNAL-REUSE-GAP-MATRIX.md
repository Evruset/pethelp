# Booking Journal Reuse and Gap Matrix

Status: `CONTRACT_READY`; runtime claims are unchanged. A decision of `REUSE` applies to domain authority, not automatic semantic fitness for the composite journal.

| Item | Current route | Current component | Current API | Current role/capability | Target behavior | Decision | Gap | Risk | Next slice |
|---|---|---|---|---|---|---|---|---|---|
| Shell | scoped routes | `ClinicPortalShell` | none | effective session capabilities | Journal frame/tokens | REUSE | Primary nav change | Navigation overclaim | MVP1-02/04 |
| Root route | scoped root | Workspace Home page | workspace BFF | capability-filtered membership | Canonical Journal | REPLACE | Flagged route switch | Rollback collision | MVP1-04 |
| Home navigation | shell nav | navigation config | none | presentation filter only | `Журнал записи` first | MODIFY | Closed MVP nav | Nav mistaken for authority | MVP1-04 |
| Workspace Home | scoped root | workspace client | workspace projection | existing exact scope | Hidden primary; future `/overview` | MODIFY | Runtime move absent | Lose tested fallback | MVP1-04 |
| Queue | `/queue` | Queue client/list | booking queue | `booking.queue.read` | Requests authority | MODIFY | Target `/requests` adapter | FIFO ≠ journal | MVP1-03/04 |
| Queue detail | Queue row/audit route | Queue detail/audit UI | hold audit/read | `booking.queue.read` | Journal drawer/deep detail | MODIFY | Projection shape differs | Protected overfetch | MVP1-03/04 |
| Appointments registry | `/appointments` | Registry client | appointments GET | `appointment.registry.read` | Journal confirmed/history source | MODIFY | Separate snapshot | Inconsistent order | MVP1-03 |
| Appointment detail | `/appointments/:id` | Admin detail | detail GET | `appointment.registry.read` | Scoped deep link/drawer facts | MODIFY | Commands/history absent | False action affordance | MVP1-04 |
| Schedule | `/schedule` | Schedule client | slots snapshot/mutations | `schedule.read` + existing guards | Time/staff availability grid | MODIFY | Journal projection absent | Capacity inference | MVP1-03 |
| Services | Schedule workflow | service editor | schedule services | existing admin/reception guard | Filter/display safe labels | MODIFY | Dedicated read capability unclear | Overbroad settings access | MVP1-03 |
| Staff | Schedule workflow | staff editor | schedule staff | existing admin/reception guard | Staff columns and `/staff` | MODIFY | Dedicated capability/API absent | Role shortcut | later contract |
| Working hours | Schedule workflow | hours editor | working-hours commands | existing admin/reception guard | Optional settings/deep workflow | MODIFY | Explicit capability contract absent | Mutation overreach | later contract |
| Clients registry | `/patients` | Patients registry | patients GET | `patient.admin.read` | Target `/clients`, client lookup | MODIFY | Route adapter/search contract | Privacy/identity ambiguity | MVP1-04 |
| Client detail | `/patients/:id` | Patient detail | safe detail GET | `patient.admin.read` | Target `/clients/:clientId` | MODIFY | Identifier mapping/adapter | Cross-association leak | MVP1-04 |
| Pet admin detail | patient detail | bounded pet facts | same safe projection | `patient.admin.read` | Drawer/deep safe pet facts | MODIFY | Client/pet distinction | Clinical overexposure | MVP1-03/04 |
| Audit timeline | hold detail | audit trail | hold audit GET | scoped queue authority | Bounded request timeline | MODIFY | Appointment audit not proven | Sensitive actor metadata | later contract |
| Confirm command | Queue | confirm action | clinic hold confirm | backend scope/transition | Journal action | REUSE | Reconcile projection | Double booking/stale version | MVP1-05 |
| Reject command | Queue | decline action | clinic decline/release | backend scope/transition | Explicit reject intent | MODIFY | Rejected vs released mapping | Wrong owner effect | MVP1-05 |
| Alternative command | Queue/detail | slot selection | alternative-slot | backend scope/transition | Journal alternative flow | REUSE | Owner decision external | Impersonation/stale swap | MVP1-05 |
| Cancel | absent journal action | none | no proven clinic command | missing | Cancel confirmed visit | MISSING | Authority/state contract | Reuse owner command | later contract |
| Reschedule | absent journal action | none | no proven clinic command | missing | Explicit slot reschedule | MISSING | Authority/state contract | Accidental DnD transition | later contract |
| Manual appointment create | absent | none | only manual slot proven | missing | Client/pet + appointment create | MISSING | Command/validation absent | Slot mistaken for booking | later contract |
| Search | Patients has bounded search patterns | registry controls | no unified journal search | capability-specific | Safe client/entry lookup | MODIFY | Cross-domain search projection | Enumeration/privacy | MVP1-03/04 |
| Server time | Queue responses | SLA utilities | per-endpoint clocks | scoped read | One projection `serverNow` | MODIFY | No common snapshot clock | Drift/wrong SLA | MVP1-03 |
| Polling/realtime | Queue/Workspace patterns | refresh clients | separate reads | scoped read | Bounded authoritative polling | MODIFY | No common cadence/snapshot | Reorder/storm | MVP1-04 |
| Feature flags | scoped root/surfaces | server flag helpers | env | server-evaluated | `CLINIC_MVP1_BOOKING_JOURNAL` | MODIFY | Dependency order | Broken rollback | MVP1-04 |
| BFF/session | existing scoped BFFs | route handlers | server token upstream | effective session | Strict Journal BFF | REUSE | New fixed upstream needed | Token/query forwarding | MVP1-04 |
| Parser | Workspace/Queue parsers | strict allowlists | normalized payloads | n/a | Strict journal parser | MODIFY | Closed timestamps/status/actions | Malformed snapshot replaces valid | MVP1-04 |
| Tests | backend/Portal focused suites | Jest/Playwright harness | test fixtures | n/a | Exact future matrix | REUSE | New journal fixtures/chains | False coverage | each runtime slice |
| Evidence | prototype manifest/evidence patterns | inventory tooling | checksum manifest | n/a | Accepted journal UX evidence | REPLACE | No authoritative journal prototype | Build wrong product | MVP1-02 |
