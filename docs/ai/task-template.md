# AI task

Use the [canonical YAML task brief](../agent-contracts/templates/task-brief.yaml) for fields and defaults. A Markdown brief can present the same fields under their YAML names. Keep one brief per task and apply the authority and validation rules in [AGENTS.md](../../AGENTS.md).

| YAML sections | What to capture |
|---|---|
| `issue`, `objective` | The request, applicable authority and revision, and one observable outcome |
| `scope`, `authority`, `feasibility` | Allowed paths, affected contracts, non-goals, authoritative ownership and missing decisions |
| `acceptance`, `verification` | Positive and forbidden outcomes, regression invariants and focused evidence |
| `orchestrator`, `stop_conditions` | The selected route and budgets from the existing orchestrator |
| `output` | Changed files, implemented behavior, checks, unresolved risks and one next action |
