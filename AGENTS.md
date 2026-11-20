# VetHelp

VetHelp monorepo for veterinary owner, clinic and platform workflows.

## Project authority

Use this precedence: the Jira issue being executed, linked normative Confluence (including Scope Freeze), then approved repository contracts. Use code and reproducible evidence to establish implementation state. `docs/ai/current-state.md` is the execution/evidence overlay. Stop the affected work on a Jira/Confluence product contradiction.

The first-MVP Owner App is React Native + Expo in `apps/owner-app`. `apps/owner_mobile` is legacy read-only reference; do not add Flutter functionality.

Follow the normative first-MVP Scope Freeze. Do not silently reintroduce payments, mandatory MIS, telemedicine, insurance, emergency routing, Push, SMS, Telegram, a full clinical record or advanced BI. Legacy implementations may remain only when isolated from the Pilot.

The current Product Owner also acts as Technical Lead and Product/Business/SA/UX decision owner for the MVP under Confluence page `2686977`. Explicit Product Owner approval counts only for the named decision classes, items and revisions. Codex/reviewer PASS is machine evidence, never human approval. Machine-only QA may close from reproducible automated evidence; never simulate real-device, signed-build, UAT, external-provider, pilot-clinic, training, restore/load execution, Pilot Candidate, Go-Live or real-booking evidence.

Keep machine delivery state separate from Jira workflow. Allowed states include `COMPLETE`, `IMPLEMENTED`, `IMPLEMENTED_EXISTING`, `CONTRACT_VALIDATED`, `COMPATIBILITY_VALIDATED`, `READY_FOR_HUMAN_REVIEW`, `READY_FOR_HUMAN_SIGNOFF`, `PARTIAL`, `BLOCKED_PRODUCT_DECISION`, `BLOCKED_EXTERNAL_DEPENDENCY`, `BLOCKED_SCOPE_EXPANSION`, `BLOCKED_TOOLING` and `MIGRATION_APPROVAL_REQUIRED`. Do not repeat a completed machine reconciliation solely because Jira workflow status is stale.

Jira/Confluence writes are limited to deterministic reconciliation already settled by authoritative evidence. A future run may transition an item to Done only after fresh contract/dependency reconciliation, complete or implemented-existing behavior, PASS evidence, applicable explicit human approval, no missing real-world gate and documented residual risks. Package approval applies only to explicitly listed items/revisions and may exclude named rows. Never invent approval or autonomously change assignee, priority, parent, sprint or sign-off.

Story/Epic closure is never inferred from child completion percentage. Verify mandatory children, the parent AC/DoD, the cross-component result, absence of blocking gaps and actual completion of every applicable real-world gate.

## Scope

- `backend/`: NestJS services, PostgreSQL and migrations.
- `apps/clinic-portal/`: clinic and platform web portal.
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
- Preserve dirty user changes. Never reset, clean, commit, push, create/edit a PR, deploy, or alter production data unless the active request explicitly authorizes the action. External writes remain subject to their applicable project gates.

## Verification

- Inspect the relevant `package.json` scripts before choosing commands.
- Use `$affected-tests` when affected checks need discovery and `$targeted-tests` to execute the selected checks. Start with narrow static/unit checks, then run affected integration or Playwright when the risk warrants it. Run full checks only when justified by a shared contract, schema, auth, state machine, multiple bounded contexts, or a release gate.
- Run `git diff --check` and use existing reproducible evidence where inputs match.
- Bound logs with `--tail`, `tail`, `rg` or a targeted test selector.

## Session discipline

- In a normal session, deliver one bounded result using [the task brief guide](docs/ai/task-template.md). Read only relevant sections of `docs/ai/current-state.md`. Update it within scope when meaningful execution evidence or status changes.
- With an active VetHelp `/goal`, follow [the autonomous delivery contract](docs/ai/codex-autonomous-delivery.md). Read the relevant current-state continuation and evidence. At each checkpoint validate DoR, implement the smallest scope, run focused checks and `git diff --check`, obtain independent review when material, update current-state and advance the next dependency-ready Jira item without prompting per item.

## Codex execution

- Apply the existing [adaptive-orchestrator](.agents/skills/adaptive-orchestrator/SKILL.md) for nontrivial repository tasks. Follow its C/R budgets and bounded discovery. Start with targeted search, use repo map and local RAG when needed before broad reads, and skip generated output, dependency folders, archives, logs and large binaries unless directly required.
- Delegate only independent bounded work. Allow at most three active threads including root, subject to any lower configured limit. Only root can spawn. Root owns production and authoritative project writes unless a child receives explicit authorization.
- Use the [proposal index](docs/agent-contracts/README.md) to find the [authority and scope proposal](docs/agent-contracts/00-authority-scope.md) and only the directly relevant domain material. These are analytical proposals pending scoped PO approval. Use live contracts for API, role, permission, status and schema decisions.

## Response

Return only:
1. changed files;
2. implemented behavior;
3. checks and results;
4. unresolved risks or blockers.
