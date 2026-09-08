# Wave 5C2 — Booking change real E2E and visual closure

Status: `COMPLETE / MACHINE-VERIFIED`

## Real-stack proof

The focused Playwright journey uses the canonical local path:

`Owner Expo Web -> Owner BFF -> Backend -> PostgreSQL -> Operations Next.js Portal -> Operations BFF -> Backend -> Owner authoritative readback`.

- CANCEL: Owner submission leaves BookingHold, Appointment, and booked capacity unchanged while the request is `OPEN`; Operations claims and completes it; the transaction cancels the Appointment, releases the Hold and capacity, completes the request, and Owner readback shows the actual cancelled state.
- RESCHEDULE: Owner submission leaves the original slot authoritative while the request is `OPEN`; Operations claims it and selects a currently published replacement; completion releases old capacity, consumes new capacity, converges Hold/Appointment/request slot identity, and Owner readback shows the new authoritative slot.
- Stale replacement: Operations loads a replacement that is consumed before submit. Processing fails safely, the request remains `PROCESSING`, the original booking remains authoritative, and neither source nor replacement capacity is corrupted.

The fixture uses isolated W5 IDs and removes only their dependent local-test rows in FK order. No production cleanup or migration is part of this closure.

## Final-source visual and accessibility evidence

Evidence: `docs/testing/evidence/wave5-booking-change-closure/manifest.json`.

- 21 screenshots cover all 13 required distinct states.
- Owner viewports: `390x844`, `768x1024`, `1440x900`.
- Operations viewports: `430x932`, `1024x768`, `1440x900`.
- Each capture checks axe serious/critical violations, horizontal overflow, and visible action height.
- Critical keyboard coverage includes Owner request triggers, modal initial focus/focus containment/focus return, and Operations reschedule apply.
- Status is text-labelled rather than color-only. Mobile Operations is a compact task list; desktop retains the full queue plus contextual split detail; smaller detail opens as a full-screen task surface.
- The manifest binds final source files, every image, the outer V50 pack, and the nested Owner/Clinic authority archives with SHA-256 hashes. The verifier rejects missing states/viewports, hash drift, and orphan screenshots.

## Focused closure repairs

- The Owner web confirmation primitive uses a semantic dialog with initial focus, Tab containment, Escape handling, and focus return; native continues to use React Native `Modal`.
- Owner semantic colors were strengthened enough to meet the captured WCAG contrast gate.
- Operations mobile queue no longer forces a 760 px table onto a 430 px viewport.
- Operations preserves the stale/conflict banner after authoritative detail and queue refresh.

No Booking lifecycle, migration, capacity policy, DoctorShift behavior, notification scope, ranking, recommendation, or Wave 6 functionality was added.

## Verification

- `W5_C2_REAL_E2E ...`: `PASS (1/1)`.
- Evidence verifier: `PASS (21/21)`.
- Required states: `13/13`; screenshot target: `21` (within `18–24`).
- Runtime flags: real CANCEL, real RESCHEDULE, stale safety, Owner/Operations authoritative readback, and capacity final state are all `PASS`.
- Accessibility: axe serious/critical `0`, horizontal overflow `0`, minimum action height `44`, critical keyboard/focus path `PASS`.
- Product/UX closure review: the single independent reviewer inspected all 21 screenshots and final source after focused repairs and returned `PASS / NO VETO` with no blocking findings.

## Exit

`W5_COMPLETE=YES`. The next recommended delivery wave is W6; this closure does not start it.
