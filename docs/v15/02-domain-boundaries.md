# PetHelp v1.5 domain boundaries

## Transition rule

Deployment capability and business contract are independent dimensions:

```text
runtime capability profile -> modules/routes available
clinic contract profile    -> booking confirmation semantics
```

`MVP_SCOPE_PROFILE` must not remain the authority for manual versus automatic booking.

## Booking boundary

One Booking Core owns the booking command. A `BookingPolicyResolver` resolves a server-authoritative clinic contract:

```text
MVP_V1_MANUAL  -> MANUAL_REQUEST
V15_AUTO_CONFIRM -> AUTO_CONFIRM_PUBLISHED_SLOT
```

Missing, unknown, inactive or ambiguous policy fails closed. Existing clinics receive `MVP_V1_MANUAL` during migration. Policy changes affect new booking attempts only and never rewrite existing appointments.

## Aggregate separation

- Slot/Hold: technical reservation and capacity protection (`HELD`, `RELEASED`, `EXPIRED`, plus temporary compatibility states).
- Appointment: Owner–Clinic agreement. Wave 1 requires only the existing pending compatibility path and confirmed appointment creation.
- Visit: performed care and clinical outcome; outside Wave 1.

The existing `booking_holds.state` compatibility model may remain during Wave 1. The transition must not expand it into the final Visit lifecycle.

## Transaction invariant

For `V15_AUTO_CONFIRM`, a successful transaction must atomically:

1. lock and validate the authoritative slot;
2. validate clinic, location, service, doctor, pet ownership and slot version;
3. consume capacity;
4. persist the booking/hold compatibility record;
5. create exactly one confirmed appointment;
6. write audit and outbox records;
7. persist the idempotent result;
8. commit.

Any failure rolls back the entire effect set. No external provider call belongs inside this transaction.

## Security boundary

Owner identity comes from authenticated server context. Clinic policy is resolved from the slot's authoritative clinic relation, never from client input. Existing RBAC plus clinic/location/resource scope remains mandatory for clinic commands and reads.
