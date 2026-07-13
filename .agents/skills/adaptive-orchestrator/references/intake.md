# Intake checklist

A task is ready when enough is known to implement safely:

- Goal: what problem or user outcome is expected?
- Scope: which product, repository, module, screen, API, or workflow?
- Done: observable acceptance criteria or a source of truth.
- Constraints: compatibility, design system, dependencies, performance, security, rollout.
- Environment: relevant version, branch, runtime, test environment, credentials only if truly needed.
- Data/state: schema changes, migrations, state-machine transitions, ownership, idempotency.
- Validation: what evidence is expected, and what checks already exist?

Blocking ambiguity examples:
- two materially different product behaviors are both plausible;
- destructive data action has no explicit authorization;
- required credentials, endpoint, design, or business rule is absent and cannot be derived;
- migration ownership or backward compatibility is unclear;
- requested behavior conflicts with an existing invariant and the priority is unknown.

Do not ask about:
- file names or commands discoverable from the repository;
- implementation details the orchestrator should decide;
- preferences that do not affect correctness or risk.
