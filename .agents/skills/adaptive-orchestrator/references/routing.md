# Complexity, risk, budget, and model routing

## Complexity
- C0: deterministic text/config/CSS/rename or tiny one-file change with explicit acceptance.
- C1: bounded feature or bug in one module, known pattern, limited tests.
- C2: multiple modules, API + UI, meaningful state, integration, or non-trivial test design.
- C3: architecture, migration, concurrency, security, broad refactor, ambiguous ownership, or high blast radius.

## Risk
- R0: docs or cosmetic behavior with easy rollback.
- R1: local functional behavior with no sensitive data or schema impact.
- R2: public API, authorization, financial/medical/business rules, cross-service behavior, or persistent state.
- R3: destructive data, production migration, secrets, security boundary, concurrency, or irreversible operation.

## Budget selection
- C0 + R0/R1 -> `small`.
- C1 or bounded C2 + R0/R1 -> `standard`.
- C2 + R2 or any C3/R3 -> `complex`.

## Routing
- C0/R0 cosmetic: root or implementer_luna; one spec validator.
- C0/R1 executable: implementer_luna; spec + targeted test validation.
- C1/R0-R1: optional repo_mapper_luna; implementer_terra; spec + test vote.
- C2 or R2: planner_terra only when dependencies justify it; bounded Terra workers; integrator only if slices need reconciliation; three-validator vote.
- C3 or R3: architect_sol first; Terra workers by default; complex_implementer_sol only for the hard core; three-validator vote with veto policy.

Escalate model strength only when a cheaper worker reports evidence-backed uncertainty, fails validation, or risk class requires it. Never rerun the entire task on a stronger model by default.
