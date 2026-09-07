# Total MVP UX/UI Runtime Parity

Canonical design language: current V50 source and Clinic Booking Journal. Current primary V50 extraction is 30 screens/41 state tokens with hash `5bdc47225b79462aca8ca3dabd0a6b892682f0bc672d5cf2e4cdd3e8fb2e7de8`; the checked-in primary manifest remains stale. Journal manifest verifies 104 states.

## Cross-application design verdict

| Application | Design source | Runtime parity | Required direction |
|---|---|---|---|
| Owner Mobile | `V50_EXISTING + V50_NEEDS_ADAPTATION` | partial production components | preserve tokens/hierarchy; update current Product semantics |
| Owner App Web target | `V50_DESIGN_SYSTEM_REUSE / SHARED_RESPONSIVE_IMPLEMENTATION` | Expo Web target in `apps/owner-app` | use the same screens/tokens/presentation state with responsive composition; do not create a separate Web design system |
| Clinic Portal | `V50_EXISTING + V50_NEEDS_ADAPTATION` | substantial partial runtime | Journal becomes primary; redesign Schedule/Visit for target domains |
| Operations | `V50_DESIGN_SYSTEM_REUSE / NEW_DESIGN_REQUIRED` | no runtime | derive dense internal shell/status/forms/drawers from Clinic V50 |

## Visual evidence counts

| Metric | Count | Meaning |
|---|---:|---|
| `CURRENT_SOURCE_VISUALLY_VERIFIED` | 3 bounded packages | Wave 1 Owner decision, Wave 1 Clinic Queue, and Wave 3 DoctorShift Schedule current-source packages; not full-product parity |
| `HISTORICAL_VISUAL_EVIDENCE` | 12 primary V50 rows plus current controlled-seam app captures | useful historical/runtime evidence, not current parity |
| `PARTIAL_RUNTIME` | 46 of 134 named identifiers | some runtime behavior/surface exists |

## Wave 1 bounded current-source evidence — 2026-08-26

| Surface | V50 design source | Runtime states | Evidence / parity |
|---|---|---|---|
| Owner Mobile booking decision (`OWN-006`, adapted `OWN-008`) | current `prototype-v50` manifest/index/tokens; Product semantics override historical instant-confirm/payment behavior | pending, near-expiry, confirmed, rejected, expired, network, malformed/stale | `docs/testing/evidence/s14-owner-booking-decision/manifest.json`; `RN_WEB_EVIDENCE_RENDERER`; current runtime/V50/capture hashes; `LOW_DELTA`, not Owner Web or physical-device proof |
| Clinic Portal Queue | current V50 Clinic Journal request/SLA language, adapted to existing Queue | normal, warning, critical, urgent, expired, confirm/reject readback, stale/degraded | `docs/testing/evidence/s14-clinic-booking-decision/manifest.json`; production Portal component with controlled seams; current hashes; `LOW_DELTA` for bounded Queue states, not certification of the future 104-state Journal |

Wave 1 semantics are `MANUAL_CONFIRM → PENDING_CONFIRMATION → 15-minute PostgreSQL-authoritative deadline → CONFIRMED | REJECTED | EXPIRED`. Countdown/SLA bands are presentation only and no client creates a terminal state. Owner Web is the Expo Web target of `apps/owner-app`; the prior distinct-application decision is `SUPERSEDED_BY_PRODUCT_ARCHITECTURE_DECISION`. Operations remains separately unresolved.

## Wave 3 bounded current-source evidence — 2026-08-28

| Surface | V50 design source | Runtime states | Evidence / parity |
|---|---|---|---|
| Clinic Portal DoctorShift Schedule (`CLN-002`, Product-adapted) | hashed `prototype-v50/index.html` and manifest; Product DoctorShift semantics override the historical generic grid | empty, doctor selected, draft, editor, generated preview, published, blocked, held, booked, stale, degraded, read-only across 390/430/768/1024/1440 | `docs/testing/evidence/wave3-doctor-shift-inventory/manifest.json`; production Next build and actual Chromium capture run; runtime/V50/capture/build/artifact hashes; 60 overflow checks, 12 axe scans and 12 semantic assertions; independent machine Product/UX review |
| `NO_RUNTIME` | 77 of 134 identifiers | 69 future plus 8 over-scope identifiers lack target runtime |

The remaining 11 identifiers have implemented runtime foundations but are not current-source visually verified.

## Required UX acceptance coverage

Every application must cover information hierarchy, composition, navigation, typography, spacing/density, cards, filters, forms, dialogs/drawers, primary/secondary actions, status, loading, empty, error, stale/degraded, unauthorized/session-expired, conflict, responsive transformation, keyboard/focus, 200% text, reduced motion and color-independent status.

## Principal deviations

1. Remaining Owner App responsive surfaces beyond the bounded acquisition/booking journey. 2. No Operations UI. 3. Clinic Journal prototype is not runtime. 4. Owner home hierarchy is incomplete. 5. Specialist-first/map absent. 6. Human V50 acceptance remains. 7. Booking history/change UI incomplete. 8. Result/Diary flow absent. 9. Specialty configuration remains incomplete beyond implemented DoctorService eligibility. 10. Smart Reallocation is represented only by legacy same-location alternative mechanics. 11. Primary full-product V50 manifest is stale. Bounded DoctorShift Schedule is current-source verified and no longer listed as absent.

## Reuse rules

Reuse V50 tokens, typography, spacing, status language, cards, navigation principles, form language, dialogs/drawers and responsive rules. Preserve current Product semantics even when V50 behavior is outdated. Expo Web uses the same Owner design system; Operations may extend the system but must not introduce an unrelated visual language.

The exhaustive 134-state mapping remains in `V50-MVP-DESIGN-RUNTIME-RECONCILIATION.md` and is not duplicated here.
