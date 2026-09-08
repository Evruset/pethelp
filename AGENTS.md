# VetHelp

VetHelp monorepo for veterinary owner, clinic and platform workflows.

## Project authority

Use this precedence: the Jira issue being executed; normative Confluence linked from Jira; repository contracts; `docs/ai/current-state.md` as the execution/evidence overlay. Stop on a Jira/Confluence product contradiction instead of choosing a side.

The first-MVP Owner App is React Native + Expo in `apps/owner-app`. `apps/owner_mobile` is legacy read-only reference; do not add Flutter functionality.

Follow the normative first-MVP Scope Freeze. Do not silently reintroduce payments, mandatory MIS, telemedicine, insurance, emergency routing, Push, SMS, Telegram, a full clinical record or advanced BI. Legacy implementations may remain only when isolated from the Pilot.

When a VetHelp `/goal` is active, read `docs/ai/codex-autonomous-delivery.md` and `docs/ai/current-state.md`, then advance dependency-ready Jira work without requiring a prompt per item. Only the main agent may write production or authoritative project files; subagents are read-heavy/review-only unless explicitly authorized.

The current Product Owner also acts as Technical Lead and Product/Business/SA/UX decision owner for the MVP under Confluence page `2686977`. Explicit Product Owner approval counts only for the named decision classes, items and revisions. Codex/reviewer PASS is machine evidence, never human approval. Machine-only QA may close from reproducible automated evidence; never simulate real-device, signed-build, UAT, external-provider, pilot-clinic, training, restore/load execution, Pilot Candidate, Go-Live or real-booking evidence.

Keep machine delivery state separate from Jira workflow. Allowed states include `COMPLETE`, `IMPLEMENTED`, `IMPLEMENTED_EXISTING`, `CONTRACT_VALIDATED`, `COMPATIBILITY_VALIDATED`, `READY_FOR_HUMAN_REVIEW`, `READY_FOR_HUMAN_SIGNOFF`, `PARTIAL`, `BLOCKED_PRODUCT_DECISION`, `BLOCKED_EXTERNAL_DEPENDENCY`, `BLOCKED_SCOPE_EXPANSION`, `BLOCKED_TOOLING` and `MIGRATION_APPROVAL_REQUIRED`. Do not repeat a completed machine reconciliation solely because Jira workflow status is stale.

Jira/Confluence writes are limited to deterministic reconciliation already settled by authoritative evidence. A future run may transition an item to Done only after fresh contract/dependency reconciliation, complete or implemented-existing behavior, PASS evidence, applicable explicit human approval, no missing real-world gate and documented residual risks. Package approval applies only to explicitly listed items/revisions and may exclude named rows. Never invent approval or autonomously change assignee, priority, parent, sprint or sign-off.

Story/Epic closure is never inferred from child completion percentage. Verify mandatory children, the parent AC/DoD, the cross-component result, absence of blocking gaps and actual completion of every applicable real-world gate.

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
- For each autonomous Jira checkpoint: validate DoR, implement the smallest scope, run focused checks, obtain independent review when material, run `git diff --check`, update current-state, and select the next Ready item.
- Never push, create/edit a PR, deploy, or commit unless the active request explicitly authorizes it.

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
