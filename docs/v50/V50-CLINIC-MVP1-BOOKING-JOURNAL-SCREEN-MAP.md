# Booking Journal Screen Map

Status: `CONTRACT_READY`; target routes below are not runtime claims.

| Target route | Purpose | Authority | Read / commands | Required states | Responsive / flag behavior |
|---|---|---|---|---|---|
| `/clinics/:clinicId/locations/:locationId` | Canonical Booking Journal | active exact-scope membership; section/action capability filtering | future journal projection; closed links and permitted commands | loading, empty, technical error, stale valid, partial capability, forbidden/not-found, offline, malformed refresh retained | D/T/M; `CLINIC_MVP1_BOOKING_JOURNAL` on selects journal; off preserves 05C root |
| `/clinics/:clinicId/locations/:locationId/journal` | Convenience alias | same as root | no independent data fetch | redirect only | server redirect to root only while journal flag is on; otherwise absent |
| `/clinics/:clinicId/locations/:locationId/requests` | `Заявки` target registry | `booking.queue.read` + exact scope | current Queue authority through a future target-route adapter; current runtime is `/queue` | loading, empty, technical error, stale, forbidden, conflict | Target route is canonical after implementation; `/queue` disposition/redirect must preserve rollback and is not implemented here |
| `/clinics/:clinicId/locations/:locationId/appointments` | Appointment registry/deep workflow | `appointment.registry.read` + exact scope | current list/detail GETs | current list technical and empty states | Existing route retained; may be reached from journal |
| `/clinics/:clinicId/locations/:locationId/clients` | `Клиенты` target registry | `patient.admin.read` | current Patients read through a future target-route adapter; current runtime is `/patients` | loading, empty, technical error, stale, forbidden | Target route is canonical after implementation; `/patients` rollback/redirect disposition remains explicit future work |
| `/clinics/:clinicId/locations/:locationId/clients/:clientId` | Client/pet administrative detail | patient read; separate local-profile update | current safe Patients detail/alias authority; identifier mapping must be explicit | loading, not-found, no-leak, revoked, conflict, retry | Full-screen mobile; future adapter only, no runtime rename in MVP1-01 |
| `/clinics/:clinicId/locations/:locationId/staff` | `Сотрудники` | dedicated capability is `MISSING` | target bounded read/manage APIs are `MISSING` | fail closed, loading, empty, technical error | Omit navigation until authority exists; no role-only shortcut |
| `/clinics/:clinicId/locations/:locationId/settings` | Optional settings | dedicated capability is `MISSING` | target APIs are `MISSING` | fail closed and technical states | Optional nav only after contract; absent otherwise |
| `/clinics/:clinicId/locations/:locationId/overview` | Possible retained Workspace Home destination | current workspace authority | current projection | current tested states | Planned disposition only; no route exists in MVP1-01 |

## Journal composition

Desktop uses toolbar → pending SLA bar → filters → time/staff day grid → selected-entry drawer. Time is vertical and staff is horizontal. Tablet retains the day relationship while collapsing secondary metadata. Mobile uses date → urgent requests → agenda list → full-screen detail, not a squeezed desktop grid. Each entry exposes time, person/pet-safe label, service-safe label, closed status, SLA text/icon when applicable, and only backend-authorized actions. Color is supplementary. Week view is optional/single-employee; drag-and-drop is excluded.

The UX prototype must demonstrate reception, administrator and limited-capability views plus: normal day; pending request; overdue request; confirmed appointments; partial schedule; no entries; no staff; alternative selection; manual booking; client lookup; conflict; stale; forbidden; equal-time ordering; shared countdown movement without reorder; malformed/technical refresh retention; empty versus failure; and authority loss. Required viewports are 375×812, 412×915, 768×1024, 1024×768, 1440×900 and 1920×1080, with keyboard focus, axe, 200% text, reduced motion and forced colors.

## Prototype acceptance brief

`V50-CLINIC-MVP1-02` must create and register an interactive, checksum-bound journal prototype. It must not reuse `#clinic-workspace` as proof. It must not introduce fake medical data, telemedicine, insurance, payments, Quality dashboard or arbitrary analytics. Acceptance requires product-owner confirmation of information hierarchy, primary navigation, terminology, desktop/mobile action flow, status/SLA presentation, error/empty distinction, and canonical/redirect behavior before runtime implementation begins.
