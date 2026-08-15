# VetHelp Autonomous Jira Delivery Contract

## Objective

Autonomously advance first-MVP delivery through dependency-ready Jira items while preserving product scope, repository integrity and verifiable evidence.

## Starting point and selection

At every checkpoint, read `docs/ai/current-state.md` for `NEXT`, `NEXT_READY_JIRA_ITEM`, `RERUN`, blocked items, human reviews and known gaps. Validate an explicit hint against Jira before execution. If none is valid, query only the relevant milestone/dependency neighborhood, inspect direct dependencies, exclude genuinely blocked work and select one smallest useful Ready item. Do not rescan the full backlog.

Keep Jira workflow state separate from machine delivery state. Machine statuses are `COMPLETE`, `IMPLEMENTED`, `IMPLEMENTED_EXISTING`, `CONTRACT_VALIDATED`, `COMPATIBILITY_VALIDATED`, `READY_FOR_HUMAN_REVIEW`, `READY_FOR_HUMAN_SIGNOFF`, `PARTIAL`, `BLOCKED_PRODUCT_DECISION`, `BLOCKED_EXTERNAL_DEPENDENCY`, `BLOCKED_SCOPE_EXPANSION`, `BLOCKED_TOOLING` and `MIGRATION_APPROVAL_REQUIRED`. A Jira item still in `К выполнению` is not rerun when current-state proves its machine work complete.

An upstream item awaiting human review/signoff may feed downstream machine work only when its contract is stable and no missing decision can change downstream behavior. Human review never establishes scope, architecture, business rules, external commitments or legal/commercial decisions on Codex's behalf.

## Per-task loop

For each Jira item:

1. Fetch the issue, direct dependencies, linked normative Confluence, nearest current-state evidence and affected repository contracts.
2. Classify it as `CONTRACT`, `CODE`, `QA`, `DEVOPS`, `UX` or `GOVERNANCE`.
3. Check genuine DoR preconditions without treating stale workflow state as a blocker.
4. Define and execute the smallest task-local scope.
5. Run focused validation only.
6. Use one independent reviewer for material auth/security, state-machine, concurrency, ownership, migration, public API, architecture or product-contract work.
7. Repair evidence-backed vetoes and rerun affected checks only.
8. Update `docs/ai/current-state.md` with Jira key, machine status, changed files, behavior, evidence, risks, human gate, next item and efficiency.
9. Immediately select the next dependency-safe Ready item.

Default discovery budget is eight meaningful calls per Jira item. Reuse current-state and never repeatedly rediscover unchanged architecture. Validation should match the surface: RN focused checks for RN, affected integration/concurrency for Booking Core, contract validator plus diff check for contract-only work, focused typecheck/build/Playwright for Portal, and existing plus clean temporary database checks for migrations.

Subagents are primarily read-only scouts and reviewers. The main agent owns writes; never run overlapping write-heavy agents.

## Boundaries

An additive migration may proceed autonomously only when the Jira task clearly requires it, scope is bounded and non-destructive, no product decision is missing, and rollback/compatibility is understood. Stop with `MIGRATION_APPROVAL_REQUIRED` for destructive schema change, irreversible loss, large backfill, ownership ambiguity, cross-domain redesign or unexpected schema.

Add a dependency only when authoritative architecture/Jira requires it and no existing capability suffices. Never autonomously select a paid SaaS, credential-bearing production provider, or run `npm audit fix --force`.

Stop with `BLOCKED_PRODUCT_DECISION` when authoritative sources leave multiple reasonable product choices. Report the decision, options, impact, recommended default and affected Jira keys. Stop on unavailable real-world clinic identity/approval, credentials, commercial/legal decisions or production access; do not invent placeholders.

Safe Jira/Confluence writes are limited to deterministic reconciliation where the active contract task and an already-settled authoritative decision determine the exact edit. Never invent policy, approve the agent's own work, or mark human review complete.

## Governance acceptance and Jira transitions

The Product Owner currently also acts as Technical Lead and Product/Business/SA/UX decision owner under Confluence page `2686977`. Explicit approval is scoped to the named class, item and revision. Codex/reviewer PASS remains independent machine evidence, not human approval. Reproducible machine-only QA may satisfy QA acceptance, but real-device, signed-build, UAT, external-provider, clinic/pilot, training, executed restore/load, Pilot Candidate, Go-Live and real-booking gates must actually occur.

Already implemented work may be reconciled in bounded packages using `current contract → repository → tests/evidence → gap classification`; do not create artificial production diffs. Package approval may approve all explicitly listed rows except named exclusions and applies to no unlisted revision.

A Jira item may transition to Done only when all are true: the current contract was read fresh; dependencies/DoR are satisfied or reconciled; implementation is complete or implemented-existing; required evidence and review pass without veto; applicable explicit human/package approval exists; no real-world gate remains; residual risks are recorded. A Story/Epic additionally requires all mandatory children, its own AC/DoD, the cross-component result, no blocking gaps and actual completion of real-world gates. Completion percentage alone is never authority.

Never run `git reset --hard`, `git clean`, force push, push, rewrite user work, create/edit a PR or deploy without explicit authorization. Do not commit unless explicitly authorized. Stop with `STOP_DIRTY_STATE_CONFLICT` when overlap cannot be isolated safely.

## Stop conditions

Stop the autonomous batch when any condition holds:

1. Five Jira checkpoints are complete.
2. No dependency-safe Ready Jira item remains.
3. A genuine human/product decision is required.
4. Real external information, credentials or provider commitment is required.
5. A destructive or ambiguous migration is required.
6. An architecture/security reviewer has an unresolved veto.
7. Continuing requires push, PR mutation or production deployment.
8. Dirty-tree overlap makes safe isolation impossible.
9. Jira and normative Confluence contradict each other.

On stop, record completed checkpoints, pending human items, blocked items, branch/HEAD, dirty-state summary and one recommended next action.

## Current continuation

The targeted `SCRUM-626 / T002` rerun after `SCRUM-708 / T084` must not repeat the full T002 audit. Once its notification contradiction is reconciled, continue through the dependency graph under this contract.
