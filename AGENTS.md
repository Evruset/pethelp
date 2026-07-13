# VetHelp

VetHelp monorepo for veterinary owner, clinic and platform workflows.

## Scope

- `backend/`: NestJS services, PostgreSQL and migrations.
- `portal/`: clinic and platform web portal.
- `docs/`: specifications, matrices and delivery notes.
- prototype directories: static UX/UI references and states.

## Working rules

- Implement only the requested capability and its directly affected contracts.
- Start from named files, routes, components or tests. Do not index or read the whole repository by default.
- Preserve existing design tokens, class structure, SVGs, logos, photos and project assets.
- Read `docs/assets-manifest.md` before searching binary assets.
- Do not refactor unrelated code or rename public API fields without an explicit migration plan.
- Do not rename, reorder or edit an already applied database migration.
- Keep role permissions and clinical state transitions explicit; do not broaden privileges incidentally.
- Do not introduce new dependencies unless the task requires them and the impact is stated.
- Preserve dirty user changes. Never reset, clean, commit or push unless explicitly requested.

## Verification

- Inspect the relevant `package.json` scripts before choosing commands.
- Run the narrowest unit/type/lint check that covers the change.
- Run affected integration or Playwright tests next.
- Run full builds/e2e only for cross-module changes or final release verification.
- Bound logs with `--tail`, `tail`, `rg` or a targeted test selector.

## Session discipline

- One feature or defect per session.
- Use `docs/ai/task-template.md` to define scope and acceptance criteria.
- Update `docs/ai/current-state.md` before starting a new session.

## Response

Return only:
1. changed files;
2. implemented behavior;
3. checks and results;
4. unresolved risks or blockers.

<!-- CODEX_AGENT_STACK_START -->
# Codex budget-aware adaptive orchestrator

For every non-trivial repository task, automatically apply `$adaptive-orchestrator`.
The user is not expected to select models, agents, reasoning levels, MCP servers, files, or test commands.

The root thread must:
1. validate task completeness and ask one grouped clarification only when blocked;
2. use search-first discovery, repo map, and local RAG before broad file reads;
3. classify complexity/risk and select the matching context budget;
4. choose the cheapest suitable model per work item;
5. delegate only independent bounded work and keep at most three agent threads open;
6. collect concise summaries instead of raw logs;
7. run affected tests and risk-based independent validation;
8. return a plain-language result with evidence.

Hard rules:
- Do not recursively scan the repository before targeted search.
- Do not read generated output, dependency folders, archives, logs, or large binaries unless directly required.
- Do not run a full test suite unless shared contracts, schema, auth, state machine, or multiple bounded contexts are affected.
- Do not commit, push, alter production data, or rewrite applied migrations unless explicitly requested.
<!-- CODEX_AGENT_STACK_END -->
