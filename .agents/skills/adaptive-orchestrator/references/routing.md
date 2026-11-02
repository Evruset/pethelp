# GPT-6.1 Sol routing contract (AO-61)

Routing is based on complexity + risk + independence + reasoning effort + tool
requirements + write ownership. Agent profile suffixes are legacy
compatibility identifiers and never select the model.

## Classification and context budget

- C0: deterministic or cosmetic.
- C1: bounded one-module work.
- C2: multi-module or integration work with known boundaries.
- C3: architectural uncertainty, security, concurrency, or broad refactor.
- R0: cosmetic or documentation-only.
- R1: local behavior with bounded rollback.
- R2: public contract, authorization, or persistent business state.
- R3: destructive, security-critical, concurrent, or irreversible.

Budget selection:

- `small`: C0 with R0/R1;
- `standard`: C1, or C2 with R0/R1;
- `complex`: any C3 or R2/R3.

Risk overrides complexity. Budgets limit expansion; they are not consumption
targets.

## Root-first routes

| Class | Default execution | Reasoning | Optional escalation |
|---|---|---|---|
| C0 | root only | LOW | none unless a check reveals risk |
| C1 | root only | LOW or MEDIUM | one isolated specialist when the delegation gate passes |
| C2 | root first | MEDIUM | bounded independent workstream or one material-risk reviewer |
| C3/R3 | root architecture/risk pass first | HIGH | bounded specialist or distinct veto-domain review |

The default root model is `gpt-6.1-sol` with MEDIUM reasoning. LOW is preferred
for deterministic edits, known continuation slices, targeted discovery,
routine tests, and trivial repairs. HIGH is reserved for architecture,
security/authorization, migrations, concurrency, persistent-state invariants,
hard cross-module debugging, or conflicting evidence.

Do not escalate reasoning merely because a command failed. First classify the
failure as ENVIRONMENT, TEST_EXPECTATION, IMPLEMENTATION, CONTRACT,
ARCHITECTURE, SECURITY, or UNKNOWN. Only materially ambiguous CONTRACT,
ARCHITECTURE, SECURITY, and hard UNKNOWN justify HIGH.

## Delegation and parallelism

Delegate only when the objective and output are bounded, context is independent
or isolated, write ownership is safe, and expected benefit exceeds coordination
cost. Complexity or available capacity alone is insufficient.

Parallelize A and B only when neither consumes the other's intermediate
decision. Serialize A -> decision -> B. Parallel writers require disjoint
owned paths. Children do not spawn children.

Legacy profiles such as `explorer_luna`, `implementer_terra`, and
`reviewer_sol` retain their names for compatibility. Their suffixes do not
bind current model families. Profiles without `model` inherit the
runtime-selected model. Role intent is LOW for deterministic/explorer helpers,
MEDIUM for normal implementation/testing/integration, and HIGH for
architecture/security/high-risk review.

## Tool routing

- repository search/map/RAG: escalate only after the prior narrower discovery
  step fails;
- external documentation: use a bounded docs specialist or official docs tool
  only for version-sensitive facts;
- browser reproduction: use a browser specialist only for evidence requiring a
  real browser;
- planner: only for a real dependency graph;
- integrator: only for completed disjoint slices;
- reviewer: only for material residual risk not deterministically proven.

## Validation and sticky evidence

Prefer deterministic evidence, then root diff-first review, then one matched
independent specialist. Multiple reviewers are allowed only for distinct veto
domains. Vetoes are non-votable.

A PASS is sticky. Reuse it as `REUSED_STICKY_PASS` while its dependency surface
is unchanged and no contract, shared-infrastructure, contradictory-runtime, or
downstream-failure evidence invalidates it. Never label reused evidence as a
fresh run.

The Gate Ledger records `gate`, `status`, `evidence_revision`,
`dependency_surface`, `fresh_or_reused`, and `invalidated_by`.

## Efficiency

Judge efficiency by absence of duplicate discovery, unnecessary delegation,
unnecessary HIGH reasoning, repeated sticky PASS, unbounded tools/files, and
avoidable pipeline stages. Direct root implementation plus targeted validation
may be EFFICIENT for C2. Historical model names are never verdict criteria.
