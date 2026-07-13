# Codex budget-aware workflow

1. Leave project mode on `orchestrator`.
2. Start one Codex session per functional scope.
3. Describe the task normally or invoke `$adaptive-orchestrator`.
4. The root agent classifies complexity/risk and selects a context budget.
5. Discovery uses repo map, local RAG, and targeted `rg` before file reads.
6. Only independent bounded work is delegated.
7. Validation uses affected tests and a risk-based quorum.
8. Start a new session when the functional scope changes.

## Default topology

```text
Root: Terra / low
├── repo_mapper_luna or explorer_luna  Luna / low / read-only
├── implementer_luna or implementer_terra
├── affected_tests_luna / tester_terra
└── Sol agents only for architecture, risk, or disputed validation
```

Do not parallelize one-file edits, overlapping writers, undecided designs, or sequential debugging.
