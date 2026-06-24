# Emergency Routing MVP — Alpha contract

## Product boundary

The Emergency Routing MVP does not diagnose an animal and does not replace a veterinary emergency assessment. It returns only clinic locations that have a current, verified emergency capability profile and explicitly report `ACCEPTING_NOW`.

A generic clinic location is never included merely because it is nearby.

## Public endpoint

```text
GET /v1/emergency/clinics?species=DOG&requiredCapabilities=ICU,TRAUMA&latitude=55.751244&longitude=37.618423
```

The endpoint is intentionally public: an emergency route must not require registration, a payment method or an owner JWT.

Response fields include:

- clinic and location identity;
- address and optional emergency contact phone;
- matched capability codes for the requested species;
- `statusUpdatedAt` and `validUntil` so the client can show freshness;
- `straightLineDistanceKm` only when both caller and clinic coordinates are available.

`straightLineDistanceKm` is not road ETA. A maps provider and route-time calculation are a later integration.

## Eligibility invariant

A location is eligible only when all conditions are true:

```text
accepts_emergency_now = true
emergency_status = ACCEPTING_NOW
verification_status = VERIFIED
valid_until > PostgreSQL clock_timestamp()
all requested capability codes exist for the requested species or ALL
```

The query excludes stale, pending, rejected, closed and temporarily unavailable profiles.

## Clinic configuration endpoint

```text
PUT /v1/clinic/locations/:locationId/emergency-profile
```

Only a `CLINIC_ADMIN` with an active database-backed location membership can update a profile. The endpoint stores a capability version, verification state, validity window, optional emergency phone and a source/evidence reference for every capability.

An `ACCEPTING_NOW` profile must be `VERIFIED` and contain at least one declared capability.

## Follow-up scope

1. Clinical rule governance and red-flag triage rule sets.
2. Map provider, ETA and clinic current-capacity signals.
3. Operations workflow that verifies capabilities, renewal dates and evidence.
4. Notification/direct-call UX and emergency-route analytics.
