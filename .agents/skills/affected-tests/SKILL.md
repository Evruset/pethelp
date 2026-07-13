---
name: affected-tests
description: Find the smallest relevant test set for changed or proposed files without running the full suite. Use before implementation validation, regression checks, or review.
---

# Affected Tests

1. Run `./scripts/affected-tests.sh` with changed files or let it inspect git diff.
2. Prefer nearest unit tests and module-level integration tests.
3. Add typecheck/build only when the changed boundary requires it.
4. Add e2e only for a user-visible flow or cross-layer contract.
5. Full suite is allowed only for schema, auth, shared contract, state-machine, shared package, or multi-context changes.
6. Return candidate commands, rationale, and confidence.
