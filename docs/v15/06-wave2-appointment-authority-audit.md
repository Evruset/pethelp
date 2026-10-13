# Wave 2 appointment authority audit

| Model | CURRENT_WRITER | TARGET_WRITER | CURRENT_STATE | TARGET_STATE | MIGRATION_STRATEGY |
|---|---|---|---|---|---|
| Booking Hold | Booking creation/security and legacy alternative services | Same services, limited to request/confirmation compatibility | Confirmation, release and legacy proposal states; some confirmed cancellation projection | Compatibility projection of the Appointment lifecycle; never the final lifecycle authority | Keep fields and routes compatible; lifecycle commands lock the hold but persist the business outcome on Appointment |
| Appointment | Confirmation paths create rows; Owner cancel updates status | `AppointmentLifecycleService` | `status/version/slot_id`; cancellation metadata absent | `CONFIRMED`, `CANCELLED_BY_USER`, `CANCELLED_BY_CLINIC`, `RESCHEDULE_PROPOSED`, `NO_SHOW` plus immutable decision metadata | Add nullable lifecycle metadata and a truthful lifecycle state derived only for known historical statuses |
| Alternative Slot Proposal | `AlternativeSlotService` / `OwnerAlternativeAcceptanceService`, authoritative for pending-hold proposals | Same proposal table, appointment lifecycle service for confirmed appointments | Swap group is stateful but primarily rewrites pending holds | Proposal remains separate authority; confirmed Appointment remains unchanged until Owner acceptance | Add nullable `appointment_id`; reuse pending/accepted/declined/expired states; accept atomically changes Appointment and counters |
| Booking public projection | Hold read and Owner appointment services | Existing projections enriched from Appointment | Five-value booking status compatibility contract | Existing enum retained; additive lifecycle/cancellation/proposal metadata | No breaking enum replacement; map Appointment lifecycle without exposing internal hold state |

## Invariants and compatibility decision

- Appointment is the authoritative business agreement once confirmation creates it. The hold remains the compatibility correlation aggregate and is locked with Appointment commands, but is not a second lifecycle writer.
- Existing public `BookingStatus` is not replaced. Appointment lifecycle is additive.
- Clinic cannot update `appointments.slot_id` directly. It may create a proposal; only the Owner accept transaction moves the Appointment.
- Global lock order for confirmed lifecycle commands is hold, Appointment, sorted slots, proposal.
- Owner cancellation boundary is `databaseNow >= startsAt - 2 hours`; the immutable boolean records classification only and creates no penalty.
- Schema changes are additive. Unknown historical status maps to `NULL`, not fabricated meaning.
- Existing pending-hold alternative implementation is `LEGACY_GATED` for the v1.5 confirmed lifecycle and remains available for its current callers.
