# Wave 3 Clinical Result reconciliation

Status: `APPROVED_FOR_BOUNDED_PORT`

Date: 2026-10-02

Remote checkpoint: local and `origin/agent/v15-transition-wave-01` both resolved to `0ade5628b431b0e7f3682b39dc0bc1016c08d64a` before production changes.

## Source topology

- Canonical transition base is Wave 2 on `agent/v15-transition-wave-01`.
- PR #73 is open at `6118c735`; its clinical foundation starts at `02755347` and includes the publish-dialog accessibility repair `d2a76fd` and contract repair `6118c735`.
- PR #73 is an ancestor of PR #78 head `176e7f39`. PR #78 retains the clinical backend and later refines the client surfaces.
- Neither draft PR is merged wholesale. Wave 2 Appointment authority wins wherever the older hold-centric implementation differs.

## Reconciliation matrix

| Capability | Transition branch | PR #73/#78 | Decision |
|---|---|---|---|
| Appointment authority | Wave 2 Appointment lifecycle | Completion is hold-centric | Keep Wave 2; modify completion to lock and gate Appointment |
| Visit creation | No canonical Visit aggregate | Foundation plus completion integration | Port schema and behavior with Appointment lifecycle guards |
| Result draft | Absent | Versioned `DRAFT` service | Reuse; add payload-bound idempotency and closed API contract |
| Publish | Absent | Transactional `PUBLISHED`, DB trigger, Diary projection | Reuse; add explicit version/idempotency fencing |
| Amendment | Absent | Immutable append-only children | Reuse; expose bounded author/time/provenance |
| Owner Diary | Existing nonclinical projection | Published Result/Amendment projection and client | Reconcile bounded backend and final PR #78 client hunks only |
| Clinic client | Existing visit workspace | Result workflow and accessible confirmation dialog | Reconcile PR #73 plus `d2a76fd`; preserve current shell/contracts |
| Authorization | Clinical capabilities exist | Veterinarian plus clinic/location scope | Preserve veterinarian-only writes; require active exact clinic/location membership |
| OpenAPI | Generated contract is authoritative | Draft routes lack complete schemas/errors/headers | Reuse routes, rebuild explicit closed documentation and assertions |

## Authority and invariants

- Appointment owns the booking agreement and attendance lifecycle.
- Visit owns performed veterinary care and retains immutable Appointment/hold/owner/pet/clinic/location/slot provenance.
- Exactly one canonical Visit may exist per applicable Appointment.
- Initial Visit completion is allowed only from hold `CONFIRMED` and Appointment `status=CONFIRMED`, `lifecycle_state=CONFIRMED` under the global `hold -> appointment` lock order.
- `CANCELLED_BY_USER`, `CANCELLED_BY_CLINIC`, `NO_SHOW` and unresolved `RESCHEDULE_PROPOSED` cannot create a normal completed Visit.
- Clinical Result owns the clinical document: `DRAFT` is versioned and editable; `PUBLISHED` is terminal and database-immutable.
- Amendment is an immutable append-only child ordered by `(created_at, id)` and never rewrites the original Result.
- Owner Diary is a read-only projection of published Results and Amendments. Drafts are never Owner-visible final outcomes.

## Migration decision

PR #73 migration numbers `171961` and `171962` are draft lineage only. Canonical Wave 2 already applies `171963` through `171968`, and repository migration commands keep node-pg-migrate order checking enabled. Adding the old filenames would make a legitimate Wave 2 database fail upgrade.

The audited SQL semantics will therefore be ported under new forward-only numbers after `171968`. Order checking will not be disabled. Acceptance must use isolated databases for both a fresh chain and a real `171968 -> Wave 3` upgrade; the shared local database is not canonical evidence because it previously received temporary `171961/171962` ledger entries.

Published clinical history makes destructive rollback unsafe. Once data exists, recovery is application/feature disable or forward repair while retaining schema and records.

## Required remediations to reused code

- Current completion can overwrite Wave 2 `NO_SHOW` because it checks only hold state and performs an unguarded Appointment update. It must lock/gate Appointment and verify exactly one guarded transition.
- `notification.push.summary_ready.v1` must move from appointment completion to published-result authority; a Visit or draft is not an Owner-ready summary.
- Draft creation must reject same-key/different-content replay.
- Publish must have explicit optimistic and idempotency fencing.
- Amendment readback must include bounded provenance already stored by the database.
- Clinical APIs require bearer auth, closed request/response schemas, required concurrency/idempotency headers and canonical error envelopes in generated OpenAPI.

## Bounded reuse

Reuse backend semantics from `02755347`, the accessibility repair from `d2a76fd`, the clinical contract repairs from `6118c735`, and only the final clinical client evolution carried by PR #78. Reject unrelated PR #78 shell, package, catalog and booking changes.

Wave 4 OCR, medical sharing, Premium/family access, VisitConfirmed billing and other later-wave scope remain excluded.
