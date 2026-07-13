# VetHelp V51 Program Plan

## Program objective

Reach verified product parity with `prototype-v51` without weakening booking, payment, authorization, clinical or emergency invariants. Until the parity certificate and rollout gates pass, the only valid program status is **V51 migration in progress**.

## Sources of truth

1. `prototype-v51` and its assets for product semantics and responsive composition.
2. Runtime routes, migrations, OpenAPI, state machines and executable tests.
3. `docs/v51/V51-PARITY-REGISTER.md` for progress.
4. `docs/ai/current-state.md` for the active bounded slice.
5. `docs/ai/chat-registry.md` for context partitioning and file ownership.

## Execution model

- Root Chat owns priorities, dependencies, gates and integration.
- A Work Chat owns one bounded context or one small set of V51 IDs.
- An Integration Chat combines disjoint completed branches.
- No more than three implementation chats and one QA/integration chat are active.
- Every Work Chat produces a short handoff; Root Chat never imports the full conversation history.

## Ordered phases

| Phase | Outcome | Current state |
|---|---|---|
| 0 | repository/runtime baseline and immutable migration chain | baseline merged; migration lineage documented |
| 1 | complete Parity Register and chat governance | initial register and templates created in Stage 5.5 branch |
| 2 | architecture contracts and source-of-truth boundaries | ADR foundation present |
| 3 | V51 design system and shells | partial owner/portal implementation |
| 4 | effective session, capabilities and bounded read foundations | completed for current Stage 3/4 families |
| 5 | owner core: shell, pets, profile, diary | partial |
| 6 | catalog, doctors and booking | booking present; doctor routes missing |
| 7 | owner bookings, alternatives and notifications | bookings/alternatives present; notifications missing |
| 8 | clinic workspace: queue, schedule, appointments, patients | queue/schedule present; registry/patients missing |
| 9 | veterinarian visit workspace and clinical completion | implemented; Stage 5.5 authority hardening selected |
| 10 | telemedicine end-to-end | partial; clinic dispatcher ownership unresolved |
| 11 | emergency, insurance and service settings | emergency/insurance present; profile/settings partial |
| 12 | realtime, offline, audit and observability hardening | partial |
| 13 | complete functional, visual, accessibility and UAT certification | not started |
| 14 | controlled rollout, rollback rehearsal and legacy removal | not started |

## Current gate

Stage 5.5 must prove that:

1. administrative schedule surfaces cannot render or submit clinical completion;
2. receptionist and clinic administrator receive no clinical completion control;
3. the dedicated veterinarian visit workspace remains the only portal UI path;
4. owner booking → veterinarian completion → Pet Diary remains functional;
5. focused portal tests, veterinarian completion tests, typecheck/build and local-stack E2E pass.

## Next priority after Stage 5.5

Return to the parity register and select the highest P0/P1 bounded gap that completes a real user journey. The current candidate is the clinic appointment registry foundation, unless CI or the Stage 5.5 handoff identifies a higher-risk blocker.

## Final completion gate

Do not claim V51 completion until all P0 parity rows are at least `UAT_ACCEPTED`, critical E2E journeys pass, required viewport/accessibility evidence exists, rollback is rehearsed, rollout is complete and replaced legacy code is removed.
