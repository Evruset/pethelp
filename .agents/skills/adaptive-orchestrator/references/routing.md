# Unified sparse routing contract (ORCH-MOE-01)

Routing order is fixed: classify -> allocate context -> choose the minimum roles
-> resolve model availability -> choose reasoning -> execute -> run deterministic
checks -> independently validate -> repair or fall back. Agent role, model, and
reasoning effort are separate fields; legacy role suffixes are compatibility
names, not model bindings.

## Classification and total budget rule

- C0 deterministic; C1 bounded one-module; C2 cross-module/integration; C3 architecture/security/concurrency/broad refactor.
- R0 cosmetic/docs; R1 local behavior; R2 public contract/authorization/persistent business state; R3 destructive/security/concurrency/irreversible.
- `small`: C0 with R0/R1.
- `standard`: C1, or C2 with R0/R1.
- `complex`: any R2/R3 or C3. Risk overrides complexity, covering every C/R pair.

Uncertainty can raise complexity. Specialization tags activate experts only for
evidence-backed needs: browser, external docs, unknown tests, architecture,
security/authorization/data loss, concurrency/transaction/idempotency, or
integration of disjoint slices.

## Sparse routes

| Class | Minimum route | Model/reasoning | Validation |
|---|---|---|---|
| C0 with R0/R1 | Current root, ordinarily no child | New root defaults to `gpt-6.2-sol` / medium | Deterministic checks and root review |
| C1 with R0/R1 | Current root, specialist only for a specific gap | Root default `gpt-6.2-sol` / medium | Targeted checks and at most one matched validator when needed |
| C2 or R2 below C3/R3 | Current root, one bounded specialist when required at a given phase | Root default `gpt-6.2-sol` / medium | Focused contract and behavior checks with independent validation matched to risk |
| C3 or R3 | Current root coordinates an architect, implementer, or veto-domain reviewer only as needed | `gpt-6.2-astra` / high for justified high-risk specialists | One independent reviewer covering the applicable veto domain. Add a second only for conflict or distinct veto risk |

More votes never replace tests. Integrator activation requires independently
completed slices. Validator invocation must differ from implementation and be
read-only; repair is a separate implementer action.

For Tier B, use `validator_spec_luna` for contract-heavy R2 work and
`validator_tests_terra` for C2 behavior or integration below R2. For Tier C,
use `reviewer_sol` for general high risk, including concurrency, and
`security_reviewer_sol` for authorization, sensitive data, or trust boundaries.

## Availability and fallback

Use the current client inventory to verify the model and effort. Candidate
settings come from `.codex/config.toml` and `.codex/agents/<role>.toml`. A
running root keeps its client-selected model and effort until the client
confirms a switch. An empty inventory blocks a new model selection.

| Model | Effort | Configured roles |
|---|---|---|
| `gpt-6-luna` | high | `affected_tests_luna`, `docs_researcher_terra`, `explorer_luna`, `implementer_luna`, `jira-scout`, `requirements_analyst_luna`, `validator_spec_luna` |
| `gpt-6.1-terra` | medium | `browser_debugger_terra` |
| `gpt-6.2-sol` | medium | `implementer_terra`, `integrator_terra`, `planner_terra`, `tester_terra`, `validator_tests_terra` |
| `gpt-6.2-sol` | high | `reviewer`, `reviewer_sol` |
| `gpt-6.2-astra` | high | `architect_sol`, `complex_implementer_sol`, `security_reviewer_sol` |

Apply the runtime limit, up to two children and depth one. Children inherit
the parent's sandbox and approval settings. Read-only instructions constrain
the assignment. For enforced isolation, use a parent permission mode that
enforces read-only access.

If a model or effort is unavailable, keep the working configuration and record
`BLOCKED_MODEL_AVAILABILITY` as the reason for the blocked phase. A mandatory
profile that exceeds the cost rank budget also blocks its phase. The executable
router plans with the configured profiles and has no automatic fallback.

## Failure and sticky evidence

- Required test failure is a veto and routes only to targeted repair.
- Rerun failed or dependency-affected checks. Exclude current failures from preserved PASS evidence.
- PASS is sticky only while check, scoped-input/diff, command/config, and environment fingerprints match.
- Relevant change makes only dependent evidence stale.
- At most two repair rounds; an unresolved failure stays blocked.

[`scripts/orchestrator-route.py`](../../../../scripts/orchestrator-route.py)
reads the configured profiles and checks them against the supplied client
inventory and [model catalog](../../../../.codex/policies/model-catalog.toml).
It returns ordered steps. Codex enforces the session limits at execution.
[`scripts/test-orchestrator-routing.py`](../../../../scripts/test-orchestrator-routing.py)
verifies the routing policy.
