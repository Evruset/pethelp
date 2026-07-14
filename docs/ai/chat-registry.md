# V50 Chat Registry

| Chat ID | Title | Domain | Branch/Worktree | Status | Current Slice | Handoff | Last Commit | Blockers |
|---|---|---|---|---|---|---|---|---|
| ROOT | V50 Program Coordinator | Program | `agent/v50-shell-01` / isolated worktree | ACTIVE | V50-SHELL-01 integration | `docs/ai/current-state.md` | `22da293` | none |
| BASELINE-01 | Source Provenance Gate | Baseline | historical root worktree | COMPLETE | source inventory/provenance | `docs/ai/handoffs/BASELINE-01.md` | `22da293` (integrated with BASELINE-02) | none |
| BASELINE-02 | V50 Authoritative Source Registration | Baseline | historical root worktree | COMPLETE / COMMITTED | manifest, checksum, canonical naming | `docs/ai/handoffs/BASELINE-02.md` | `22da293` | none; source gate OPEN |
| V50-SHELL-01 | Shared Design Tokens and Application Shells | Shared UI | `agent/v50-shell-01` / `/Users/evrusetskiy/work/pethelp-alpha-v50-shell-01` | COMPLETE / COMMITTED | tokens, Owner shell, Portal role shells, rollback | `docs/ai/handoffs/V50-SHELL-01.md` | `feat(v50-shell): add shared tokens and adaptive application shells` | none |
| V50-OWNER-01 | Owner Home, Selected Pet Context and Next Safe Action | Owner | not created | PLANNED | next bounded slice only | not started | — | none |

## Ownership

- ROOT owns program/current state, registry, token contract, architecture, parity and handoff.
- V50-SHELL-01 owns only the focused Owner/Portal shell, adapters and tests recorded in its handoff.
- Runtime authorization remains backend-owned; no backend file changed.
- Persistent user Work Chats are not exposed by this environment; bootstrap and registry files are the durable coordination artifacts.
