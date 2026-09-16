# Independent validation policy

Each validator must be independent and use primary evidence. Review diff-first and avoid reopening unrelated modules.

Required report fields:
- VERDICT: PASS, FAIL, or ABSTAIN (`NEEDS_CORRECTION` normalizes to FAIL and `BLOCKED` to ABSTAIN)
- CONFIDENCE: 0-100
- BLOCKING_FINDINGS
- EVIDENCE: changed files, symbols, commands, or observed behavior
- NOTES or MINIMAL_REMEDIATION

Tests and static checks are primary evidence. Model review supplements them and
cannot convert a failing or unexecuted required check into PASS.

## Sparse selection using configured roles

- Tier A: deterministic checks plus root diff-first review; no validator by default.
- Tier B: exactly one of `validator_spec_luna` or `validator_tests_terra`, matched to the dominant risk.
- Tier C: one independent `reviewer_sol`; use `security_reviewer_sol` for authorization, sensitive data, or trust-boundary risk.
- Add a second validator only for conflicting evidence or a distinct high-value veto risk.

The validator receives diff/evidence, performs no edits, and must not be the
implementing invocation. If a Tier C veto-domain reviewer is unavailable,
preserve deterministic evidence but return `BLOCKED_VALIDATION`. A low-risk
route may record `DEGRADED_VALIDATION` only when deterministic acceptance is
complete and the missing reviewer was optional.

## Vetoes
A vote is rejected regardless of majority when evidence shows:
- a required test still fails;
- critical or high-confidence exploitable security issue;
- credible data loss or irreversible unsafe migration;
- broken authorization, transaction, concurrency, state-machine, or idempotency invariant;
- requested acceptance behavior is not implemented.

Style preferences, speculative concerns, or unproven hypotheticals are not vetoes. No majority clears a veto.
