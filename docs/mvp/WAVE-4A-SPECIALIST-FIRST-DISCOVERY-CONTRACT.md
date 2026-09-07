# Wave 4A — Specialist-First Discovery Backend Contract

Status: `W4A_COMPLETE`

## Scope

Wave 4A prepares the Owner discovery read contract only. It reuses the existing
`catalog_schema.specialties`, Wave 3 `doctor_services`, public doctor consent,
and published generated inventory. It adds no schema, ranking, map, Owner UI,
Booking change, or DoctorShift lifecycle behavior.

## Owner API

`GET /v1/owner/clinic-catalog/specialist-discovery`

- authority: authenticated `OWNER` only;
- selectors: at least one of `specialtyId` or `serviceCode` is required;
- `serviceCode` is normalized to uppercase;
- `limit` defaults to 25 and is constrained to 1–50;
- each returned row preserves `specialtyId`, `doctorId`, `serviceId`,
  `clinicId`, and `locationId`;
- each doctor/service projection contains at most five chronological slots;
- ordering is deterministic by first availability and stable identity
  tie-breakers.

## Visibility invariant

A result exists only when all of the following remain true at read time:

- clinic and location are active;
- doctor is active and public booking is enabled;
- veterinarian staff mapping is active and points to the same catalog doctor;
- DoctorService is active and binds the exact doctor, service, and location;
- clinic service is active;
- DoctorShift and generation run are both `PUBLISHED`;
- the generated slot is `DOCTOR_SHIFT`, `OPEN`, `PUBLISHED`, future, and has
  remaining capacity.

Draft, unpublished, stale-source, blocked, held-to-capacity, and booked-to-
capacity inventory is therefore excluded. A mismatched specialty/service pair
returns an empty collection and never falls back to another tenant or service.
The response exposes no staff, resource, generation-run, or internal
eligibility identity.

## Verification

Focused PostgreSQL and controller contract coverage proves eligible results,
wrong mappings/selectors, inactive resources, public-consent fencing,
blocked/draft/consumed inventory exclusion, exact identity preservation,
deterministic bounds/order, and the bounded response shape. Backend build and
generated OpenAPI assertions are required because the public Owner contract is
changed.

The focused checks pass and the single applicable data-boundary re-review is
`PASS / NO VETO` after repair of resource fencing, exposed-identity
deduplication, exact run→shift lineage, DTO normalization, and HTTP authority
coverage.

```text
W4A_COMPLETE=YES
MIGRATION_CHANGED=NO
OWNER_UI_CHANGED=NO
BOOKING_SEMANTICS_CHANGED=NO
DOCTORSHIFT_LIFECYCLE_CHANGED=NO
```
