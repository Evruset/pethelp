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
