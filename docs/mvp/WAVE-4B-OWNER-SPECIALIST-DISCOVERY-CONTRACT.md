# Wave 4B — Owner Specialist Discovery and Map UI

Status: `W4B_COMPLETE`

## Implemented shared Owner flow

The canonical React Native + Expo application now provides one shared iOS,
Android, and Web discovery journey:

`specialty/service → eligible doctor → clinic/location → published slot →
existing service/availability authority checks → Booking Review`.

The screen uses the W4-A specialist-discovery endpoint and existing Owner
session transport. A minimal Owner-only `specialist-discovery/options`
projection was added because the closed W4-A result endpoint accepted selector
identities but exposed no authoritative choices for an initial UI selection.
It uses the same active DoctorService and published-inventory boundary and adds
no migration or new taxonomy.

## UI and authority

- specialty-first and service-first entry are supported;
- doctor, specialty, service, clinic/location, and nearest published slots are
  rendered only from API results;
- loading, empty, error, retry, refresh-in-progress, removed/stale selection,
  and map-unavailable states fail closed;
- exact `specialtyId`, `doctorId`, `serviceId`, `clinicId`, `locationId`,
  `slotId`, and slot version survive the discovery handoff;
- existing ClinicService and Availability reads revalidate the chosen service
  and slot before the unchanged Booking Review/Booking command path;
- cards, selector rows, toggles, and actions use the existing V50-adapted Owner
  primitives and 44px-class or larger targets;
- Web uses the existing Expo Router/BFF session bridge; no separate web
  application exists.

## Authoritative map coordinates

The approved W4-B1 repair reuses canonical persisted
`clinic_locations.latitude/longitude`; no migration was required. The Owner
specialist projection exposes nullable `latitude` and `longitude` on the exact
`locationId`. PostgreSQL range constraints remain authoritative and the read
projection/parser fail closed to `null` or rejection for unusable values.

The shared Expo map surface creates pins only from these API fields, groups them
by exact clinic/location identity, and uses pin selection only to reveal the
matching eligible doctor/service/slot cards. It performs no geocoding,
distance calculation, ranking, clustering, or availability inference. Results
without a complete coordinate pair remain fully usable in the list fallback.

```text
W4B_COMPLETE=YES
W4B_PARTIAL=NO
W4B_MAP_COORDINATES_CONTRACT_GAP=NO
MIGRATION_CHANGED=NO
BOOKING_SEMANTICS_CHANGED=NO
DOCTORSHIFT_CHANGED=NO
SEPARATE_OWNER_WEB_APP=NO
```

W4-B is complete for shared iOS, Android, and Web implementation. Real
cross-application and bounded visual evidence belong to W4-C.

## W4-C real-stack and visual closure

The final machine closure uses the canonical Owner Expo Web production build
through the Owner BFF, Backend, and PostgreSQL. One isolated DoctorService
fixture proves both specialty-first and service-first discovery, API-derived
map/list behavior, exact clinic/location/doctor/service/slot/version identity,
nullable-coordinate list fallback, and an authoritative stale-selection
failure after the selected generated slot is unpublished. A separate fresh
selection reaches the existing Booking Review and creates a real
`PENDING_CONFIRMATION` hold; no later Booking lifecycle is included.

The final-source evidence package at
`docs/testing/evidence/wave4-owner-discovery` contains 19 screenshots covering
the 12 required discovery states across `390×844`, `430×932`, `768×1024`,
`1024×768`, and `1440×900`. Its verifier binds screenshots to current source
hashes and records zero serious/critical axe findings, no horizontal overflow,
and keyboard focus on the retry path.

```text
REAL_SPECIALTY_DISCOVERY_E2E=PASS
REAL_SERVICE_DISCOVERY_E2E=PASS
MAP_LIST_PARITY=PASS
IDENTITY_PRESERVATION=PASS
STALE_SELECTION_SAFETY=PASS
BOOKING_HANDOFF=PASS
VISUAL_EVIDENCE=PASS
OWNER_PRODUCT_UX_REVIEW=NO_VETO
GIT_DIFF_CHECK=PASS
W4_STATUS=IMPLEMENTED/MACHINE_COMPLETE/VISUALLY_VERIFIED
W4_COMPLETE=YES
```

This classification is machine evidence. It does not represent physical-device,
signed-build, UAT, pilot-clinic, deployment, or production-booking evidence.
