# Budget-Aware Orchestrator: how to use it

You do not need to choose a model, agent, MCP, file, or test command.

1. Open the project in VS Code.
2. Open the official Codex panel.
3. Start a new task and describe the desired result.
4. The orchestrator validates the request and asks only blocking product questions.
5. It searches the compact repo map and local RAG before opening source files.
6. It applies a small, standard, or complex context budget.
7. It delegates only work that benefits from a separate agent.
8. It selects affected tests and validates the result proportionally to risk.

Force the workflow with:

```text
$adaptive-orchestrator
```

Example:

```text
$adaptive-orchestrator

On the clinic appointment screen, add cancellation by the clinic administrator.
The client must see the new status immediately. Preserve existing design and APIs where possible.
```

## Validation result

- cosmetic change: one independent specification check;
- local executable behavior: specification + targeted test check;
- API, state, auth, data, migration, or multi-module work: three independent checks;
- Sol tie-breaker runs only when lower-cost validators disagree.

A required test failure, security issue, data-loss risk, or broken invariant always blocks acceptance.
