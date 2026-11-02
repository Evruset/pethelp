# Owner V50 Catalog Search — S09 Contract Amendment

Status: APPROVED / Product Owner scope amendment, 2026-09-20.

This amendment extends the previously approved S09 Owner Clinic Catalog MVP
contract. It does not imply that the original S09 revision included search.

## HTTP contract

`GET /v1/owner/clinic-catalog` preserves OWNER authentication, the existing
response DTO, location-scoped `{clinicId, locationId}` identity and all current
online-bookable eligibility rules.

The endpoint accepts one optional query parameter:

- name: `q`;
- type: string;
- maximum normalized length: 120 Unicode code units;
- normalization: trim leading/trailing whitespace and collapse internal
  whitespace runs to one ASCII space;
- empty normalized value: identical to an omitted query;
- matching: case-insensitive substring over clinic public name and branch
  address;
- branch name: not searched because the current location model has no separate
  authoritative branch-name field;
- result order: existing deterministic clinic name, address and location ID
  order after open-slot precedence;
- result bound: at most 50.

Eligibility and visibility are applied first, the normalized text predicate is
applied to those eligible clinic locations, deterministic ordering follows,
and `LIMIT 50` is applied last. A matching eligible location beyond the first
50 unfiltered rows therefore remains discoverable. No medical full-text,
ranking, recommendation or fuzzy-search semantics are introduced.

An oversized query returns `400 / INVALID_REQUEST`. No match returns the normal
`200` envelope with `clinics: []`. SQL remains parameterized.

## Owner UI contract

The existing `ClinicCatalogScreen` provides one input and a separate `Найти`
CTA. Enter and the CTA submit the same normalized server query. Clearing the
input restores the default catalog. Loading, empty-search, error/retry and
clinic/location handoff remain distinct and authoritative.

V50 fields not present in the Owner catalog DTO remain data gaps: photography,
ratings/reviews, distance/travel time, catalog-level price, service context and
nearest availability, plus unsupported specialty/species/insurance/24x7
filters. They must not be fabricated.
