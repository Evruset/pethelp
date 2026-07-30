# V50 local fixture source register

Status: `OPS-02B PASS / COMPLETE`.

## Scope

Nine database-writing fixture sources were found. Four auxiliary artifact/token
generators are recorded separately. The requested `backend/src/seed.ts` does
not exist as a tracked file; the Compose and npm base seed is
`backend/scripts/seed.ts`.

## Database source register

| Source | Script | Owned tables/rows | Ownership marker | Reset predicate | Overlap | Risk | Target action |
|---|---|---|---|---|---|---|---|
| `LOCAL_BASE_SEED` | `backend/scripts/seed.ts` | Pilot clinic/location/service, rolling slots, emergency profile/capabilities | slot `source=LOCAL_BASE_SEED`; capability `source=LOCAL_SEED`; other rows use natural keys | none | Pilot natural keys and shared service/location | natural upsert may capture user/foreign row | `COLLISION_RISK` | declare shared foundation; guard owner before update; emit manifest |
| `LOCAL_IDENTITIES_V1` | `seed-local-identities.ts` | user `11…`, owner phone, pet `22…`; updates Pilot clinic and all its slots | deterministic IDs, phone and external patient ID; no source column | none | base IDs and every Pilot slot | sets every Pilot slot to Level A | `GLOBAL_MUTATION_RISK` | bound slot update to allowed sources or remove it |
| `LOCAL_CLINIC_EMPLOYEE_V1` | `seed-local-clinic-employee.ts` | user `33…` and one receptionist membership | deterministic employee ID; Pilot natural lookup | none | shared Pilot location/membership key | can overwrite a foreign membership at same key | `COLLISION_RISK` | reserved ID guard and manifest |
| `LOCAL_DEV_QUEUE_FIXTURE` | `seed-local-clinic-queue.ts` | Level-C slots and unappointed holds | slot source; holds inherit ownership only through slot FK | deletes unappointed holds joined to source slots, then unreferenced source slots | identities and Pilot service | holds have no direct marker; appointed generations remain | `CONDITIONALLY_SAFE` | report owned slot/hold IDs; test reset preservation |
| `LOCAL_DEV_OWNER_MARKETPLACE` | `seed-local-owner-marketplace.ts` | rolling Pilot marketplace slots | `source` plus `(source, external_slot_id)` | none | base clinic/location/service | source-safe slot upsert; natural parent dependency | `SAFE` after base ownership guard | emit report/dependency |
| `LOCAL_RICH_DEMO_V1` | `seed-local-rich-demo.cjs` | two clinics, three locations, 10 services, optional specialties/doctors, 12 employees/memberships, 10 owners, 15 pets, slots, holds, appointments/events | reserved UUID ranges; slot source; event payload marker | optional prefix deletes for events/appointments/holds; slot source delete; per-employee membership delete on every run | specialties by code; membership keys; tables lacking source | deterministic overwrite if namespace is not reserved | `CONDITIONALLY_SAFE` | formal namespace manifest and collision guards |
| `LOCAL_STACK_E2E_<runId>` | `dev/local/local-stack-e2e.mjs` | 14 Pilot slots plus holds, appointments/events, cancellation and clinical-summary state created through APIs | dynamic per-run slot source only; dependent API rows have no fixture marker | none | Pilot parents, fixed local owner/pet and persistent booking history | dynamic source violates permanent-ID rule and accumulates rows | `OWNERSHIP_UNKNOWN` | replace with permanent source/version and bounded manifest/cleanup |
| `OWNER_WEB_E2E_UNSCOPED` | `dev/local/owner-mobile-web-e2e.mjs` | booking holds, appointments and insurance/owner workflow state created through APIs | none; test run ID is not persisted as row ownership | none | base/owner slots, fixed local owner/pet and booking history | persistent API mutation cannot be attributed or reset | `OWNERSHIP_UNKNOWN` | permanent diagnostic source/context, owned-ID report and bounded cleanup |
| `B01_TEST_FIXTURE` | `backend/scripts/b01-fixture.ts` | isolated B01 clinic graph plus fixed local owner/pet | no durable source marker | global `TRUNCATE ... CASCADE` across clinic, pet, identity, outbox, idempotency and audit | every runtime source | destroys all co-resident fixtures and user data | `GLOBAL_MUTATION_RISK` | assert isolated CI database; never expose from runtime profiles |

All sources use transactions. Base, identities, employee and rich demo use
natural-key or ID upsert; queue uses replace-current-unappointed-generation;
marketplace uses rolling `(source, external_slot_id)` upsert. No runtime source
has a general user-data reset contract today.

## Destructive statement register

| Source | Statement target | Ownership predicate | Classification |
|---|---|---|---|
| Queue | `DELETE FROM booking_schema.booking_holds` | hold joins a slot with `source=LOCAL_DEV_QUEUE_FIXTURE` and has no appointment | bounded, conditionally safe |
| Queue | `DELETE FROM clinic_schema.appointment_slots` | exact queue source and no remaining hold | bounded, conditionally safe |
| Rich demo reset | `DELETE FROM booking_schema.appointment_events` | event ID `99…` or related appointment `98…` or hold `97…` | bounded only by reserved namespace |
| Rich demo reset | `DELETE FROM booking_schema.appointments` | appointment ID `98…` | bounded only by reserved namespace |
| Rich demo reset | `DELETE FROM booking_schema.booking_holds` | hold ID `97…` | bounded only by reserved namespace |
| Rich demo reset | `DELETE FROM clinic_schema.appointment_slots` | exact `source=LOCAL_RICH_DEMO_V1` | source-safe |
| Rich demo reapply | `DELETE FROM clinic_schema.employee_location_memberships` | one exact deterministic `93…` employee per iteration | bounded only by reserved namespace |
| B01 test | three `TRUNCATE ... CASCADE` statements | none; whole schemas/tables | isolated-test-only global mutation |

There are no tracked runtime seed `DROP TABLE` statements. Every destructive
path above is executed inside a transaction, but transactionality does not
establish row ownership.

## Table and dependency detail

| Source | Reads/dependencies | Writes | Foreign-key dependants / outputs |
|---|---|---|---|
| Base | clinic natural name, location address | `clinics`, `clinic_locations`, `clinic_services`, `appointment_slots`, `emergency_capability_profiles`, `emergency_capabilities` | parent of all local profiles; JSON IDs/counts |
| Identities | Pilot natural name and all Pilot slots | `users`, `owner_identities`, `pets`; updates `clinics`, `appointment_slots` | owner/pet used by queue/smoke; JSON IDs |
| Employee | first Pilot clinic/location | `users`, `employee_location_memberships` | Clinic token/session helper; JSON IDs/role |
| Queue | Pilot clinic/location/service and fixed owner/pet | `appointment_slots`, `booking_holds` | appointments may retain old generation; JSON owned IDs |
| Marketplace | Pilot clinic/location/service | `appointment_slots` | owner booking flows; JSON available IDs |
| Rich demo | schema introspection only for optional tables | clinic, catalog, identity, pet, slot, hold, appointment and event tables | generated seed report consumed by session generator/verifiers |
| Local-stack E2E | Pilot parents, local employee/owner/pet and live APIs | direct `appointment_slots`; APIs create holds, appointments/events and clinical state | test-results evidence only; no DB cleanup or owned-ID report |
| Owner-web E2E | base/owner fixtures, fixed local owner/pet and live APIs | APIs create holds, appointments and insurance/owner workflow state | test evidence only; no DB marker, cleanup or owned-ID report |
| B01 | none; isolated database assumed | globally truncates then writes identity/pet/clinic/location/service/slot | CI workflow consumes temporary JSON |

Auxiliary non-database generators:

| Source | Script | Input/output | Classification |
|---|---|---|---|
| `RICH_DEMO_SESSION_ARTIFACT_V1` | `dev/local/create-rich-demo-sessions.cjs` | seed report → bounded session JSON/HTML | subordinate generated artifact; cleanup required |
| `LOCAL_CLINIC_SESSION_COMPAT` | `dev/local/clinic-portal-session.mjs` | backend/token helper → local Portal session artifact/browser action | compatibility/diagnostic only |
| `LOCAL_OWNER_TOKEN` | `dev/local/create-owner-token.mjs` | fixed owner ID + backend DB → stdout token | diagnostic secret, never persistent fixture ownership |
| `LOCAL_CLINIC_TOKEN` / `LOCAL_TELEMED_VET_TOKEN` | `dev/local/create-clinic-token.mjs`, `create-telemed-vet-token.mjs` | explicit scope/fixed employee → stdout token | diagnostic secret, not seed authority |

## `LOCAL_RICH_DEMO_V1` audit

Reserved UUID namespaces:

| Prefix/range | Entity |
|---|---|
| `90000000-…-0001..0002` | clinics |
| `91000000-…-0001..0003` | locations |
| `92000000-…` | services |
| `92500000-…` | doctors |
| `93000000-…-0001..0012` | employees/users |
| `94000000-…-0001..0010` | owners/users |
| `95000000-…-0001..0015` | pets |
| `96000000-…` | slots |
| `97000000-…` | holds |
| `98000000-…` | appointments |
| `99000000-…` | events |

`SOURCE` is durable on `appointment_slots`. It is present only as
`payload_json.fixtureSource` on appointment events. Clinics, locations,
services, doctors, identity users, memberships, owners/pets, holds and
appointments have no source column; their ownership is currently only the
reserved UUID contract. Specialty rows use shared natural key `code` and are
intentional shared reference data, not rich-owned rows.

With `DEMO_RESET=1`, events are deleted by event/appointment/hold prefixes,
appointments by `98…`, holds by `97…`, and slots by source. Parent rows,
users, pets, doctors, specialties and memberships are not reset. On every run,
all memberships for each `93…` employee are deleted before the exact package
set is inserted. That delete is safe only if `93…` is a formally reserved
namespace; without the contract it could erase another source's membership.

Other current runtime seeds do not use `90…`–`99…` deterministic IDs and
target the separate `VetHelp Pilot` natural-key graph, so current direct ID
collision is absent. A future seed can still overwrite any rich row by ID, and
rich demo can overwrite a foreign row that preclaims its ID. Order affects
shared specialty display names. OPS-02B must validate namespace ownership
before upsert and include every owned ID in its report.

No schema migration is required for current coverage. Slots have a source
column, events have a payload marker, and all remaining rich-owned rows can be
bounded by reserved namespaces plus a checked manifest. A migration becomes a
prerequisite if a future rich-owned entity cannot carry either a durable source
or an exclusive deterministic namespace.

## Pairwise collision matrix

Abbreviations: `B` base, `I` identities, `E` employee, `Q` queue, `O` owner
marketplace, `R` rich demo, `L` local-stack E2E, `W` owner-web E2E and `T`
B01 test fixture. Each cell is the effect of running the row source after the
column source.

| after ↓ / before → | B | I | E | Q | O | R | L | W | T |
|---|---|---|---|---|---|---|---|---|---|
| B | `PRESERVED` | `ORDER_DEPENDENT` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` |
| I | `INTENTIONAL_OVERRIDE` | `PRESERVED` | `PRESERVED` | `UNSAFE_OVERRIDE` | `INTENTIONAL_OVERRIDE` | `PRESERVED` | `UNSAFE_OVERRIDE` | `UNSAFE_OVERRIDE` | `PRESERVED` |
| E | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` |
| Q | `PRESERVED` | `ORDER_DEPENDENT` | `PRESERVED` | `INTENTIONAL_OVERRIDE` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` |
| O | `PRESERVED` | `ORDER_DEPENDENT` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` |
| R | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `PRESERVED` | `INTENTIONAL_OVERRIDE` | `PRESERVED` | `PRESERVED` | `PRESERVED` |
| L | `PRESERVED` | `ORDER_DEPENDENT` | `PRESERVED` | `ORDER_DEPENDENT` | `ORDER_DEPENDENT` | `PRESERVED` | `ORDER_DEPENDENT` | `ORDER_DEPENDENT` | `PRESERVED` |
| W | `ORDER_DEPENDENT` | `ORDER_DEPENDENT` | `PRESERVED` | `ORDER_DEPENDENT` | `ORDER_DEPENDENT` | `PRESERVED` | `ORDER_DEPENDENT` | `ORDER_DEPENDENT` | `PRESERVED` |
| T | `UNSAFE_OVERRIDE` | `UNSAFE_OVERRIDE` | `UNSAFE_OVERRIDE` | `UNSAFE_OVERRIDE` | `UNSAFE_OVERRIDE` | `UNSAFE_OVERRIDE` | `UNSAFE_OVERRIDE` | `UNSAFE_OVERRIDE` | `INTENTIONAL_OVERRIDE` |

Interpretation:

- `I` after `Q` changes queue slots from Level C to Level A and is unsafe.
  `Q` after `I` repairs only its newly created slots, so order matters.
- `I` intentionally sets all Pilot slots to Level A, including base and owner
  sources; this policy must be narrowed in OPS-02B.
- `Q` after itself deletes only unappointed prior holds/slots. Rows retained by
  appointments make its reset conditional rather than a complete source reset.
- `R` after itself deterministically replaces current rows; optional reset
  removes only bounded child scenarios. Namespace guards are still required.
- `L` after itself generates a new source name and persistent API-owned booking
  graph on every run. Other sources generally preserve those rows, but no
  source can identify or reset the complete graph; it is order-dependent
  persistent diagnostic mutation.
- `W` has no row marker at all. Repeated or cross-run booking/insurance flows
  accumulate and may consume slots owned by base, queue, owner or local-stack
  sources; order and available capacity decide the affected source.
- `T` after any source destroys it globally. Any source after `T` reconstructs
  only its own dependency subset, not the deleted full runtime.

Reset ordering has the same classifications: queue reset preserves foreign
sources through its slot-source join; rich reset preserves current foreign IDs
but relies on reserved prefixes; B01 reset never preserves a co-resident
source. Mock MIS, acquiring and cloud data are not mutated by these SQL seeds.
Emergency capability rows belong only to base; rich demo does not create them.

## OPS-02B contract checklist

1. `COMPLETE`: every source reachable from the canonical profiles emits a
   schema-versioned report with parsed counts and owned IDs.
2. `COMPLETE`: base rejects foreign Pilot clinic and emergency-profile natural
   keys; identity and clinic-employee fixed IDs reject cross-owner/scope
   capture.
3. `COMPLETE`: identities no longer updates Pilot clinic rows or all Pilot
   slots. Owner marketplace owns only its `LOCAL_DEV_OWNER_MARKETPLACE` slots.
4. `COMPLETE`: queue reports current slot/hold IDs and retained
   slot/hold/appointment dependants; reset remains joined to its slot source.
5. `COMPLETE`: rich demo preflights every reserved table/prefix before reset,
   verifies stable ownership fields before ID upsert and bounds membership
   deletion to an asserted employee ID. Existing employees additionally
   require a durable prior source event marker and exact profile membership
   match before destructive reconciliation.
6. `NOT_REACHABLE`: B01 is not in any canonical local profile and retains its
   isolated-test classification.
7. `NOT_REACHABLE`: local-stack E2E is not dispatched by the canonical
   lifecycle/profile graph.
8. `NOT_REACHABLE`: owner-web E2E is not dispatched by the canonical
   lifecycle/profile graph.
9. `COMPLETE_FOR_ACTIVE_GRAPH`: focused synthetic tests prove reserved/source
   preservation; live base/all and rich A→A runs prove idempotent manifests,
   deterministic rich IDs and exact memberships. Destructive diagnostic-pair
   testing against the persistent user database remains forbidden.
10. `COMPLETE`: mock fixtures are read-only to seed profiles; base alone owns
    the guarded `local-dev-v1` emergency profile/capabilities.

## OPS-02B implemented boundary

The canonical dispatcher now emits schema-versioned profile and source
manifests under `.runtime/vethelp-local/seeds`. The active runtime sources are
`LOCAL_BASE_SEED`, `LOCAL_IDENTITIES_V1`, `LOCAL_DEV_OWNER_MARKETPLACE`,
`LOCAL_CLINIC_EMPLOYEE_V1`, `LOCAL_DEV_QUEUE_FIXTURE` and
`LOCAL_RICH_DEMO_V1`; their exact profile order is recorded in each report.

`LOCAL_RICH_DEMO_V1` has a shared permanent namespace helper. Its deterministic
reserved UUID prefixes are disjoint, reset SQL is bounded to the source or
reserved namespace, and employee membership deletion first rejects any ID
outside the reserved employee namespace. Synthetic focused tests prove that
foreign employee, membership and slot sentinels are outside every reset
predicate. Two live rich-demo runs produced the same 111 owned IDs and an
exact 12-membership matrix without duplicates.

The isolated B01 fixture and two mutating E2E diagnostics are not canonical
seed sources and cannot be invoked by this control plane. Their legacy command
deprecation is bounded to OPS-02C. No migration or global delete was added.
