# Wave 3 clinical result evidence

Status: `READY_FOR_HUMAN_REVIEW`

Date: 2026-10-05

Accepted Wave 2 checkpoint: `0ade562`

Implementation head before this evidence commit: `a6591df`

## Reconciliation and authority

PR #73/#78 was used as a reuse source under `REUSE_WITH_MODIFICATION`; it was not merged or cherry-picked wholesale. The reconciliation ADR is `docs/v15/08-wave3-clinical-reconciliation.md`.

- Appointment remains the scheduled agreement and attendance-lifecycle authority.
- Visit is created once when an eligible confirmed Appointment is completed.
- Clinical Result is one-per-Visit and transitions `DRAFT → PUBLISHED` with optimistic version control and payload-bound idempotency.
- Published Result content is immutable at the database boundary.
- Amendments are immutable append-only children with a per-Result monotonic version.
- Owner Diary is a read-only, owner-bound projection of published Results and Amendments; drafts are never owner-visible.

## Implementation

- Forward-only migrations `171969` through `171972` add the clinical foundation, one-Result-per-Visit constraint, publish idempotency and concurrency-safe per-Result Amendment versions. Historical/applied migrations were not rewritten.
- Visit completion locks the authoritative hold and Appointment, rejects cancellation, no-show and reschedule lifecycle states, and commits Visit, audit and outbox atomically.
- Clinical create/update/publish/amend endpoints require veterinarian authority and exact clinic/location scope. Create, publish and amendment retries are idempotent; stale edits and competing publications fail closed.
- Completion holds active clinic, location and employee membership authority through transaction commit. Real two-order races prove deactivation-first denies without side effects and completion-first blocks clinic/location deactivation until commit.
- Missing, foreign-clinic and foreign-location Visits return the same bounded `404 / CLINICAL_VISIT_NOT_FOUND` response across every Result endpoint.
- `notification.push.summary_ready.v1` is emitted only by the atomic `DRAFT → PUBLISHED` transition with identifier-only payload and outbox deduplication; completion, draft and Amendment paths emit none.
- Generated OpenAPI documents closed bodies/responses, required `If-Match`, `Idempotency-Key` and correlation headers, plus canonical errors.
- Clinic Portal supports completion, draft editing, confirmed publication and append-only correction. The publication dialog contains Tab/Shift+Tab focus, closes on Escape and restores focus.
- Expo Owner App provides owner/pet-scoped published diary list and detail views while preserving the original result separately from ordered amendments.

## Verification

- Real Nest + PostgreSQL, isolated database per suite: PASS `5/5` suites and `29/29` tests covering Visit completion/replay/terminal veto, both orders of clinic/location deactivation races and cross-scope denial; authoritative Appointment/Visit workspace projection; competing Result create/stale edit/publish; exact no-leak responses on all Result endpoints; summary-ready timing/replay; amendment replay/concurrent monotonic order; draft hiding and Owner isolation.
- Fresh database, real Wave 2 → Wave 3, and populated `171971 → 171972` acceptance: PASS `3/3`. The populated upgrade preserves historical Amendment/provenance fields, assigns versions `1,2`, restores UPDATE/DELETE immutability, accepts the old application insert shape as version `3`, and serializes two concurrent inserts as versions `4,5`.
- Backend TypeScript build: PASS.
- Generated OpenAPI export/assertion: PASS.
- Clinic Portal Node 22 typecheck/build: PASS; focused Chromium workflow/accessibility acceptance: PASS `5/5`.
- Expo Owner App Node 22 typecheck: PASS; focused diary/parser acceptance: PASS `10/10`; surrounding foundation/root checks: PASS `3/3`.
- Shared-database remediation matrix: PASS `3/3` suites and `7/7` tests; summary-ready assertions are resource-scoped and do not depend on global database emptiness.
- `git diff --check`: PASS.

## Final veto review

- Security Review: `PASS / NO RESIDUAL VETO`. Missing and foreign Visits are indistinguishable; clinic/location authority is locked through completion; inactive authority cannot complete; Owner projections expose no staff `authorId`; and missing/invalid client idempotency keys fail closed instead of receiving a generated mutation key.
- Independent Review: initial final review found one shared-database test-isolation veto. Commit `a6591df` scoped the assertion to the authoritative Result; the reviewer verified the repair and returned `PASS / NO RESIDUAL VETO`.
- Residual operational note: future clinic/location lifecycle writers must retain lock compatibility with the established completion authority order. Concurrent publish replay is serialized by the Result `FOR UPDATE` lock; sequential replay and exact logical-once side effects are covered by real runtime acceptance.

All final backend commands used the isolated worktree directly with host Node 22 and PostgreSQL 16. Docker Compose bind mounts were found to resolve the primary checkout rather than the worktree in this environment, so those ambiguous runs were discarded and are not evidence.

## Commit evidence

- `818d10e` reconciliation ADR
- `eae67e4` forward-only clinical foundation
- `8a3669d` Appointment-authoritative Visit completion
- `ecdf67b` immutable Result publication and Amendments
- `4d582be` published Owner Diary backend
- `22f925f` veterinarian Clinic Portal workflow
- `9a933a1` Expo Owner App diary
- `241f73f` final migration/runtime acceptance reconciliation
- `0959e93` post-review authorization, privacy, runtime-contract and Amendment-version remediation
- `f5927de` transactional clinic/location authority serialization
- `a0a4bfb` missing/foreign Visit no-leak normalization
- `997879f` publication-authoritative summary-ready outbox intent
- `4e86f66` populated immutable Amendment migration repair
- `5f1daf1` deterministic two-order authority race acceptance
- `a6591df` shared-database summary-ready test isolation

Each commit was pushed to `origin/agent/v15-transition-wave-01`; local and remote HEAD were compared after every push. No force-push, rebase, merge to `main`, or push to another branch occurred.

## Rollback and deferred scope

Application rollback retains the additive clinical schema and immutable facts. The `171972` insert trigger preserves compatibility with the prior Wave 3 application insert shape. Repository and remote history show `171972` only on the unmerged transition branch and absent from `origin/main`; the available PostgreSQL server is disposable test infrastructure. Its earlier checksum is therefore superseded before release by `4e86f66`, not rewritten after canonical deployment. Once published data exists, migration `171971` blocks destructive rollback; once Amendments exist, `171972` independently blocks removal of their ordering invariant. Full BP-20/BP-21 suspension/termination lifecycle, external notification providers, VisitConfirmed billing, OCR, consent sharing and all Wave 4+ work remain deferred. No unsupported clinic lifecycle state was fabricated.

Jira and Confluence were not mutated. Stop at the Wave 3 human gate.
