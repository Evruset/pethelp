---
name: affected-tests
description: Select the smallest relevant verification set for changed or proposed files when the affected checks are unknown. Return commands for execution by targeted-tests.
---

# Affected Tests

1. Reuse known focused checks. If coverage is unclear, use `./scripts/affected-tests.sh` with explicit changed paths to discover candidates.
2. Prefer nearest unit tests and module-level integration tests.
3. Add typecheck/build only when the changed boundary requires it.
4. Add e2e only for a user-visible flow or cross-layer contract.
5. Full suite is allowed only for schema, auth, shared contract, state-machine, shared package, or multi-context changes.
6. Return candidate commands, rationale, and confidence. Leave execution to `$targeted-tests`.
