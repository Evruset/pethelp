# ORCH-MOE rollback reference

Source: `git show HEAD:.agents/skills/adaptive-orchestrator/references/routing.md`
at baseline `065cf6df80f8b29bd4fdd6711624eba027e2c8a8`.
This file is evidence only and is not an active policy.

## Routing v1

- C0/R0 cosmetic: root or implementer_luna; one spec validator.
- C0/R1 executable: implementer_luna; spec + targeted test validation.
- C1/R0-R1: optional repo_mapper_luna; implementer_terra; spec + test vote.
- C2 or R2: planner_terra only when dependencies justify it; bounded Terra workers; integrator only if slices need reconciliation; three-validator vote.
- C3 or R3: architect_sol first; Terra workers by default; complex_implementer_sol only for the hard core; three-validator vote with veto policy.

Budget v1: C0 + R0/R1 -> small; C1 or bounded C2 + R0/R1 ->
standard; C2 + R2 or any C3/R3 -> complex.

Validation v1:

- C0/R0: validator_spec_luna, optionally validator_tests_terra.
- C1/R0-R1: validator_spec_luna + validator_tests_terra; disagreement,
  FAIL, or ABSTAIN triggers the undeclared `adjudicator_sol`.
- C2/C3 or R2/R3: validator_spec_luna + validator_tests_terra + the
  undeclared `validator_risk_sol`; two PASS votes required and vetoes remain mandatory.

The v1 source also referenced undeclared `repo_mapper_luna`. These unresolved
roles are intentionally retained in the benchmark adapter as baseline defects.

## Verbatim routing source

```text
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
```

## Verbatim validation source

```text
# Validation and voting policy

Each validator must be independent and use primary evidence. Review diff-first and avoid reopening unrelated modules.

Required report fields:
- VERDICT: PASS, FAIL, or ABSTAIN
- CONFIDENCE: 0-100
- BLOCKING_FINDINGS
- EVIDENCE: changed files, symbols, commands, or observed behavior
- NOTES or MINIMAL_REMEDIATION

## Vote rules

C0/R0 cosmetic:
- validator_spec_luna only;
- executable behavior or styling regression risk may add validator_tests_terra.

C1/R0-R1:
- validator_spec_luna + validator_tests_terra;
- PASS/PASS = accepted 2/2;
- disagreement, FAIL, or ABSTAIN triggers adjudicator_sol.

C2/C3 or R2/R3:
- validator_spec_luna + validator_tests_terra + validator_risk_sol;
- require at least two PASS votes;
- no veto may remain unresolved.

## Vetoes
A vote is rejected regardless of majority when evidence shows:
- a required test still fails;
- critical or high-confidence exploitable security issue;
- credible data loss or irreversible unsafe migration;
- broken authorization, transaction, state-machine, or idempotency invariant;
- requested acceptance behavior is not implemented.

Style preferences, speculative concerns, or unproven hypotheticals are not vetoes.
```
