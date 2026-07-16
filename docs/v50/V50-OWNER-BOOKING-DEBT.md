# V50 Owner Booking Debt Register

## BACKEND-ROLE-TSJEST-COMPILE

- Status: `PRE_EXISTING`.
- Impact: the full `platform-smoke` suite cannot start because existing e2e
  sources use the `Role` runtime value as a TypeScript type.
- Does not invalidate: focused real-PostgreSQL OWNER-05 or OWNER-06 suites.
- Future action: repair existing Role value/type use in a separate tooling task.

## NULL-SUPPORTED-SPECIES-LEGACY-COMPATIBILITY

- Current semantics: `supported_species IS NULL` means unrestricted legacy
  compatibility.
- Risk: old services may match more species than a future curated policy.
- Current mitigation: explicit contract documentation and regression tests.
- Future gate: product decision, data inventory/backfill and migration plan
  before changing null semantics. Null must not be converted to an empty array
  or deny-by-default inside OWNER-06.
