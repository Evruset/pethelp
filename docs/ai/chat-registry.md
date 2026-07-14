# V50 Chat Registry

| Chat ID | Title | Domain | Branch/Worktree | Status | Current Slice | Handoff | Last Commit | Blockers |
|---|---|---|---|---|---|---|---|---|
| ROOT | V50 Program Coordinator | Program | historical `agent/v51-stage-01-architecture` / root | ACTIVE | target correction and source registration | `docs/ai/current-state.md` | `4baf4e5` | none |
| BASELINE-01 | Source Provenance Gate | Baseline | same branch/worktree | COMPLETE | source inventory and fail-closed provenance | `docs/ai/handoffs/BASELINE-01.md` | uncommitted | none; product owner confirmed V50 |
| BASELINE-02 | V50 Authoritative Source Registration | Baseline | same branch/worktree; no parallel writer | COMPLETE / READY_FOR_COMMIT | manifest, checksum, rename, anchors, naming debt | `docs/ai/handoffs/BASELINE-02.md` | uncommitted | none; source gate OPEN |
| V50-SHELL-01 | Shared Design Tokens and Application Shells | Shared UI | not created | PLANNED | authoritative V50 shell/design foundation | not started | — | none; bootstrap ready |

## Ownership

- ROOT owns `docs/ai/current-state.md`, this registry, V50 program/parity/certification artifacts, shared ADRs, feature-flag registry, release gates, rollout, and legacy retirement.
- BASELINE-02 owns the V50 manifest/inventory tooling, `docs/v50/**`, compatibility note under `docs/v51/**`, and its bootstrap/handoff.
- Runtime trees are read-only in BASELINE-02.
- Forbidden: applied migrations, runtime identifiers/flags, API/UI behavior, secrets, commits, pushes, and unrelated workstreams.
- Overlapping active ownership: none.

## Environment note

Bootstrap files define future Work Chats; they do not claim that this environment created persistent user chat sessions.
