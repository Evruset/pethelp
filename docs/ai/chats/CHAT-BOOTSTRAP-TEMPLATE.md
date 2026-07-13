# Chat Identity

Chat ID:
Domain:
Role:
Branch:
Worktree:
Base Commit:

# Goal

One concrete bounded result.

# User-visible Outcome

Describe what a user, clinic employee or veterinarian can do after completion.

# V51 Scope

- V51 IDs:
- Prototype anchors:
- Target routes:

# Allowed Scope

Owned paths:

# Non-goals

List explicit exclusions.

# Sources of Truth

- `docs/v51/V51-PARITY-REGISTER.md`
- relevant ADR/TDS paths
- exact OpenAPI/controller routes
- latest relevant handoff
- runtime code at Base Commit

# Starting State

- existing implementation:
- known tests:
- known blockers:
- dirty files:
- feature flags:

# Acceptance Criteria

1.
2.
3.

# Required Validation

| Command | Expected result |
|---|---|
| focused test | PASS |
| typecheck/build where applicable | PASS |
| `git diff --check` | PASS |

# Git Ownership

Owned:

Shared — coordinate before change:

Forbidden:

# Handoff Contract

Create or update `docs/ai/handoffs/<chat-id>.md` using `CHAT-HANDOFF-TEMPLATE.md`. Update only the assigned rows in `docs/v51/V51-PARITY-REGISTER.md` and the corresponding row in `docs/ai/chat-registry.md`.
