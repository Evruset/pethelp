# V50 Full Product Parity Program Plan

Updated: 2026-07-14

Baseline: `4baf4e502e083fd6247f2dfe23626e546702fa1b`

Program classification: `C3 / R3`, complex context budget

Program state: V50 migration in progress

## Gates

| Gate | Exit evidence | Status |
|---|---|---|
| P0 data safety | forward-only migration lineage, checksum verification where DB changes occur, no destructive baseline action | PASS for current no-schema slice |
| P0 clinical authority | veterinarian-only completion; no admin/reception/platform signing path | PASS in current baseline evidence; revalidate on clinical changes |
| P0 runtime baseline | required baseline commit plus previously completed backend/portal focused checks | PASS; do not rerun without relevant changes |
| P0 V50 source provenance | authoritative local V50 bundle, declared revision/checksum, source-derived inventory | COMPLETE: product owner confirmed `prototype-v50/index.html`; manifest registered |
| P0 parity register | every source screen/route/state mapped to runtime, contracts, tests, evidence, blocker | COMPLETE for source registration: 30 authoritative rows, runtime status at most DISCOVERY/CONTRACT_READY |
| P0 rollout safety | independent flags, rollback without DB downgrade | PASS for shell contract/tests; both applications default off and were not rolled out |

## Phases

| Phase | Outcome | Current state | Exit criterion |
|---|---|---|---|
| 0 Baseline | reproducible Git/runtime/migration baseline | COMPLETE for baseline commit | no unresolved merge/data-loss/runtime veto |
| 1 Source + parity register | authoritative inventory and complete mappings | COMPLETE for source registration | manifest verifies and all 30 rows reference its checksum |
| 2 Architecture contract | domain, route, capability, state, rollout ownership | PARTIAL/REUSE | applicable ADRs linked per row; gaps decided before mutation |
| 3 Design system + shells | Owner, Clinic, Vet, Ops shells with platform-native components | SHELL FOUNDATION TESTED; business content remains partial | shell evidence PASS at required viewports; business screens still require authoritative visual acceptance |
| 4 Session/capability/API | server-derived deny-by-default authority | PARTIAL/REUSE | each endpoint family has scope, denial, leakage and rollback tests |
| 5 Owner core | home, pets, diary, documents, notifications, profile | PARTIAL: bounded `OWN-001` Care Journey Home implemented/tested; full prototype content remains partial | full owner states and contracts accepted |
| 6 Catalog + booking | authoritative clinic/doctor/service/slot/hold journey | PARTIAL | conflict/offline/idempotency paths accepted |
| 7 Bookings + alternatives | lists, detail, timeline, cancel/rebook/alternative | PARTIAL | server hold/status evidence and E2E accepted |
| 8 Clinic workspace | queue, booking operations, schedule, resources, quality, audit | PARTIAL | role-specific desktop/tablet/mobile task flow accepted |
| 9 Vet workspace | assigned visit, clinical draft/sign/amend/audit | PARTIAL | clinical authority and immutability gates accepted |
| 10 Telemedicine | intake through payment, queue, LiveKit and completion | PARTIAL | business/media/payment states reconciled and E2E accepted |
| 11 Safety + insurance | unauthenticated emergency and bounded insurance claims | PARTIAL | safety/freshness/consent disclaimers accepted |
| 12 Realtime/offline/observability | replay, gap recovery, safe offline, audit metrics | PARTIAL | invariant-focused integration checks accepted |
| 13 QA/certification | visual, functional, accessibility and UAT evidence | NOT_STARTED | all P0 rows at least UAT_ACCEPTED; certificate signed |
| 14 Rollout/legacy | internal → pilot → 5/20/50/100%, rollback, removal | NOT_STARTED | stable rollout and legacy removal gates pass |

## Logical chat map

Completed contexts: `BASELINE-01`, `BASELINE-02`, `V50-SHELL-01`, `V50-OWNER-01`, `V50-OWNER-02`. `V50-OWNER-03` is functionally implemented/tested but NOT_READY after one independent visual-parity veto for `OWN-002`, `OWN-004`, `OWN-018` and `OWN-019`; its bounded visual repair is the only next work and V50-OWNER-04 remains inactive.

## Program rules

- Root owns shared registries, flags, ADR links, release gates, rollout, legacy retirement, and certificate.
- Work Chats receive only assigned V50 IDs, paths, contracts, tests, and handoff links.
- At most three implementation chats plus one QA/integration chat may be active, with disjoint owned paths.
- A screen is not complete because a route/component exists; every applicable product, API, authority, state, responsive, test, visual, accessibility, rollout, and rollback layer must have evidence.
- Source checksum mismatch, failing required test, authorization defect, data loss, unsafe migration, double booking, transaction/idempotency break, or missing acceptance behavior is a veto.

## Exactly one next slice

`V50-OWNER-03 / Clinic Catalog, Clinic Detail and Doctor Discovery`. Do not start it from the V50-OWNER-02 session.
