# Total MVP Target Architecture

## Target model

```text
Owner App (Expo: iOS / Android / Web) ─┐
                                      ├─ HTTPS / generated contracts ─ Backend modular monolith ─ PostgreSQL
Clinic Portal ───────┤                                  │   │
Operations section ─┘                                  │   ├─ transactional outbox/workers
                                                       │   └─ audit/observability
                                                       └──── private object storage
```

The backend remains the sole authority for identity, tenant scope, inventory, booking state, server time, Result/Diary provenance and operations outcomes.

## Application decisions

- Owner App: existing `apps/owner-app`, React Native/Expo, is the single Owner product targeting iOS, Android and Expo Web. Web uses the same Expo Router screens, domain clients, contracts, V50 tokens and booking state mapping.
- Owner Web infrastructure: the Expo server export includes only a same-origin HttpOnly session/transport bridge. It is an infrastructure adapter inside `apps/owner-app`, not a second application. The former dedicated-Next.js decision is `SUPERSEDED_BY_PRODUCT_ARCHITECTURE_DECISION`.
- Clinic Portal: existing Next.js application, restructured around Journal/Requests/Clients/Staff/Settings plus contextual Schedule/Visit/Result.
- Operations: initially an **internal Clinic Portal sibling section** with a separate layout, platform capability namespace and backend modules. This minimizes operational duplication while keeping clinic membership authority separate from platform-operator authority.

## Shared boundaries

Share by default: Owner screens and journeys, generated OpenAPI/API client contracts, DTO/types, validation schemas, domain vocabulary, booking/status semantics, design tokens, presentation state, copy, React Query hooks, telemetry vocabulary and contract fixtures.

Platform adapters are limited to secure session storage/transport, deep links and URL/history, app/visibility lifecycle, file/share/external-open behavior, push integration and necessary safe-area/navigation details. Native credentials use SecureStore; Web credentials remain in a same-origin `HttpOnly; Secure; SameSite=Lax` cookie and never enter browser JavaScript storage.

## Backend/domain ownership

- Existing Booking Core owns locks, capacity, idempotency, manual-confirm decisions and appointment creation.
- New BookingChangeRequest owns cancellation/reschedule requests, callback SLA and outcomes; it cannot mutate booking implicitly.
- New Reallocation module owns policy search, offers and A→B lineage, invoking Booking Core for Booking B.
- Schedule has gained the approved Wave 3 DoctorShift and generation/publish lineage without replacing slot primitives.
- Visit/Result owns clinical completion/result/amendment. Diary owns immutable longitudinal Owner entries. Documents own private object references/delivery.
- Notification projection consumes outbox events; no Push/SMS/Telegram is required.

## Additive schema recommendations

1. `doctor_services` eligibility/duration/versioning is implemented; approved specialty taxonomy remains future work.
2. `doctor_shifts` plus generation/publish revision and source lineage on canonical slots is implemented by the approved additive Wave 3 migrations.
3. approved partial/constraint strategy for one active booking per slot/capacity model.
4. `booking_change_requests`, tasks, SLA timestamps, outcome and versions.
5. `reallocation_cases`, candidates/offers, decisions and booking lineage.
6. `visit_results`, result revisions/amendments and signer authority.
7. `diary_entries` with source type/id, provenance, visibility and immutable chronology.
8. private document/result link tables and retention metadata.
9. in-app notification projection/read state.
10. partner attribution chain from link/session to booking and visit.

This document itself authorizes no additional migration. Wave 3 migration authority is recorded in `DOCTORSHIFT-SCHEMA-PLAN.md` and its explicit Product approvals.
