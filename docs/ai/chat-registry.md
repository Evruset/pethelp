# V50 Chat Registry

| Chat ID | Title | Domain | Branch/Worktree | Status | Current Slice | Handoff | Last Commit | Blockers |
|---|---|---|---|---|---|---|---|---|
| ROOT | V50 Program Coordinator | Program | `agent/v51-stage-01-architecture` / root worktree | ACTIVE | V50-OWNER-02 is the next planned slice; not started | `docs/ai/current-state.md` | `1c58ad6` | protected `.codex` changes remain untouched |
| BASELINE-01 | Source Provenance Gate | Baseline | historical root worktree | COMPLETE | source inventory/provenance | `docs/ai/handoffs/BASELINE-01.md` | `22da293` (integrated with BASELINE-02) | none |
| BASELINE-02 | V50 Authoritative Source Registration | Baseline | historical root worktree | COMPLETE / COMMITTED | manifest, checksum, canonical naming | `docs/ai/handoffs/BASELINE-02.md` | `22da293` | none; source gate OPEN |
| V50-SHELL-01 | Shared Design Tokens and Application Shells | Shared UI | integrated into program branch from `agent/v50-shell-01` | COMPLETE / INTEGRATED | tokens, Owner shell, Portal role shells, rollback | `docs/ai/handoffs/V50-SHELL-01.md` | `1c58ad6` | none |
| V50-OWNER-01 | V50 Owner Home and Next Safe Action | Owner | `agent/v50-owner-01` / `/Users/evrusetskiy/work/pethelp-alpha-v50-owner-01` | COMPLETE / READY_FOR_INTEGRATION | `OWN-001` bounded Home; selected pet; server-authoritative next action | `docs/ai/handoffs/V50-OWNER-01.md` | `8052ed5` runtime commit before metadata amend; final local commit is branch HEAD | Docker npm `spawn EINVAL` affected one post-repair reproduction only; validator PASS |

## Ownership

- ROOT owns program/current state, registry, token contract, architecture, parity and handoff.
- V50-SHELL-01 owns only the focused Owner/Portal shell, adapters and tests recorded in its handoff.
- V50-OWNER-01 owns the bounded Owner Home/read-model paths listed in its bootstrap; Portal remains forbidden.
- Runtime authorization remains backend-owned; V50-OWNER-01 adds only the focused owner-home read module and root registration, with no mutation or migration.
- Persistent user Work Chats are not exposed by this environment; bootstrap and registry files are the durable coordination artifacts.
