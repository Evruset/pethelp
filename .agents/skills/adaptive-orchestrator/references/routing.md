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
| C0/R0 | root | Luna/low if delegated | deterministic checks; no validator by default |
| C1/R0-R1 | root or implementer_terra | Terra low/medium | targeted tests; at most one matched validator |
| C2 or R2 | planner only for a real dependency graph; bounded Terra implementer | Terra medium/high | one matched independent validator; domain reviewer only for veto risk |
| C3 or R3 | architect only for ambiguous invariants; hard-core implementer only where needed | Astra high/xhigh when eligible, otherwise Sol | one independent reviewer plus mandatory applicable domain reviewer |

More votes never replace tests. Integrator activation requires independently
completed slices. Validator invocation must differ from implementation and be
read-only; repair is a separate implementer action.

## Availability and fallback

`.codex/policies/model-catalog.toml` lists candidates and capabilities, not
availability. Every decision requires a current runtime inventory. An empty
inventory blocks routing. Astra is eligible only when runtime-confirmed and the
selected work is C3/R3 with hard architectural risk or uncertainty.

Fallback is Astra -> Sol -> Terra -> gpt-5.5 and Sol -> Terra -> gpt-5.5.
Reasoning must be supported by the selected model. If fallback removes a
required capability or independent veto-domain reviewer, return a blocked
result rather than weakening assurance.

## Failure and sticky evidence

- Required test failure is a veto and routes only to targeted repair.
- Rerun failed or dependency-affected checks; keep other PASS evidence.
- PASS is sticky only while check, scoped-input/diff, command/config, and environment fingerprints match.
- Relevant change makes only dependent evidence stale.
- At most two repair rounds; an unresolved failure stays blocked.

The executable reference is `scripts/orchestrator-route.py`; fixtures are in
`scripts/test-orchestrator-routing.py`.
