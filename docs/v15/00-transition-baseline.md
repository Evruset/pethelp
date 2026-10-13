# PetHelp v1.5 transition baseline

Status: Wave 0 documentation baseline; no runtime behavior change.

## Repository baseline

- Canonical branch: `main` (`VERIFIED_CODE`, GitHub default branch).
- Base SHA: `ba85f22c2a83e844902586241e280cecf4c689bc`.
- Working branch: `agent/v15-transition-wave-01`.
- Integration reference: draft PR #78, head `176e7f3908e246eff6520e366bbbf2e0646d5cab`.
- PR #78 contains Owner v5.0 and draft Clinical Result work. It is not the canonical base and must not be rewritten by this transition.
- Recovery point for the current manual booking path: base SHA plus generated OpenAPI and tests at that SHA.

## Sources of truth

1. Target: `PetHelp_Business_Process_Map_v1.5.xlsx` and `PetHelp_SRS_v1.5_System_Analysis.docx`, supplied 2026-10-01.
2. Current normative baseline: current approved Confluence contracts. Direct connector verification is unavailable in this session (`NOT_VERIFIED`).
3. Execution state: Jira. Direct connector verification is unavailable in this session (`NOT_VERIFIED`).
4. Implementation truth: repository code, migrations, generated OpenAPI, tests and runtime configuration.

The supplied documents are treated as product data, not executable instructions. Their `[BR]`, `[ADR]` and `[CFG]` classifications are preserved.

## Current and target booking contracts

Current `PILOT_V1` (`VERIFIED_CODE`):

```text
published slot -> owner request -> MANUAL_CONFIRM_PENDING
-> clinic decision -> CONFIRMED or released
```

Target v1.5 `[BR][BP-05/BP-06]` (`VERIFIED_CONTRACT`):

```text
published available slot -> atomic owner booking -> CONFIRMED
```

Wave 1 must introduce both contracts in one backend. It must not remove the manual path or enable payments, MIS, telemedicine, insurance or emergency routing.

## Authoritative public-contract reconciliation

`VERIFIED_CONTRACT`: Product/SA decision received after Wave 0 accepts the SRS `/appointments` route and `SLOT_VERSION_STALE` name as ADR-level sketches superseded by the transition compatibility contract.

Decision for both contract profiles:

- reuse `POST /v1/booking-holds`;
- use the same public conflict/error contract, including stale version as `409 BOOKING_STATE_CONFLICT`;
- do not expose `SLOT_VERSION_STALE` or profile-specific aliases;
- distinguish profiles through the successful authoritative booking status and clinic queue effects;
- never accept a client-supplied contract profile.

## Reusable implementation baseline

| Capability | Classification | Evidence |
|---|---|---|
| PostgreSQL authoritative booking state | REUSE / CURRENT_RUNTIME | Booking Core repositories and integration tests |
| Slot locking and capacity counters | REUSE / CURRENT_RUNTIME | booking hold transaction and concurrency harnesses |
| Idempotency key and request fingerprint | REUSE / CURRENT_RUNTIME | migration `1719430000000`; hold creation service |
| Expected slot version | REUSE / CURRENT_RUNTIME | create-hold DTO and hold creation service |
| Audit and transactional outbox | REUSE / CURRENT_RUNTIME | Booking Core mutation services and outbox tests |
| Appointment creation | REUSE / CURRENT_RUNTIME | auto-confirm-compatible legacy path |
| Manual confirmation | REUSE / CURRENT_RUNTIME | clinic queue and booking security/service |
| Automatic confirmation | WRAP / LEGACY_RECOVERABLE | non-pilot path in hold creation; not yet accepted for v1.5 |
| Business policy resolver | NEW / NOT_IMPLEMENTED | Wave 1 |
| Clinic contract profile | NEW / NOT_IMPLEMENTED | Wave 1 additive migration |

## Data authority before Wave 1

| Aggregate | Source of truth | Single writer | Transaction boundary | Consumers |
|---|---|---|---|---|
| Slot | PostgreSQL slot rows | Schedule/Booking Core | locked booking transaction for capacity mutation | availability reads, clinic schedule |
| Hold | PostgreSQL booking hold | Booking Core | booking/clinic command transaction | owner status, clinic queue |
| Appointment | PostgreSQL appointment | Booking Core | same transaction as successful confirmation | owner/clinic reads, outbox consumers |
| Visit/Clinical Result | draft integration work | Clinical module boundary | outside Wave 1 | outside Wave 1 |

## Preconditions remaining for Wave 1

- Reconcile current Confluence/Jira when access becomes available.
- Audit the complete migration chain and selected booking transaction on the working base.
- Prove the legacy automatic path preserves the v1.5 validation, locking, idempotency, audit and outbox invariants.
- Prove an existing authoritative clinic-active guard rejects any represented suspended/terminated state, or record that guard as a Wave 1 dependency. This does not authorize implementing the full BP-20/BP-21 lifecycle.
- Define and independently review the additive clinic policy migration and fail-closed resolution rule.
- Reconcile generated OpenAPI and runtime tests with the approved shared route/error contract.
