# V50 Chat Registry

| Chat ID | Title | Domain | Branch/Worktree | Status | Current Slice | Handoff | Last Commit | Blockers |
|---|---|---|---|---|---|---|---|---|
| ROOT | V50 Program Coordinator | Program | `agent/v51-stage-01-architecture` / root worktree | ACTIVE | V50-OWNER-03 visual repair required | `docs/ai/current-state.md` | `d55b292` | protected `.codex` changes remain untouched |
| BASELINE-01 | Source Provenance Gate | Baseline | historical root worktree | COMPLETE | source inventory/provenance | `docs/ai/handoffs/BASELINE-01.md` | `22da293` (integrated with BASELINE-02) | none |
| BASELINE-02 | V50 Authoritative Source Registration | Baseline | historical root worktree | COMPLETE / COMMITTED | manifest, checksum, canonical naming | `docs/ai/handoffs/BASELINE-02.md` | `22da293` | none; source gate OPEN |
| V50-SHELL-01 | Shared Design Tokens and Application Shells | Shared UI | integrated into program branch from `agent/v50-shell-01` | COMPLETE / INTEGRATED | tokens, Owner shell, Portal role shells, rollback | `docs/ai/handoffs/V50-SHELL-01.md` | `1c58ad6` | none |
| V50-OWNER-01 | V50 Owner Home and Next Safe Action | Owner | integrated into program branch | COMPLETE / INTEGRATED | `OWN-001` bounded Home; selected pet; server-authoritative next action | `docs/ai/handoffs/V50-OWNER-01.md` | `2077b00` | clean canonical reproduction PASS, 22/22 focused tests |
| V50-OWNER-02 | V50 Pets, Pet Profile and Pet Diary | Owner | integrated into program branch from `agent/v50-owner-02` | COMPLETE / INTEGRATED | `OWN-009..OWN-011`; owner pet/profile/diary/document journey | `docs/ai/handoffs/V50-OWNER-02.md` | integrated through `78d9322` | independent read-only validation PASS with zero vetoes; retained evidence package verified after integration |
| V50-OWNER-03 | V50 Clinic Catalog and Doctor Discovery | Owner | `agent/v50-owner-03` / `/Users/evrusetskiy/work/pethelp-alpha-v50-owner-03` | PARTIALLY_COMPLETED / NOT_READY | `OWN-002`, `OWN-004`, `OWN-018`, `OWN-019` | `docs/ai/handoffs/V50-OWNER-03.md` | runtime `9a6318a` | independent validator FAIL: one material visual-parity veto; security/function PASS |

## Ownership

- ROOT owns program/current state, registry, token contract, architecture, parity and handoff.
- V50-SHELL-01 owns only the focused Owner/Portal shell, adapters and tests recorded in its handoff.
- V50-OWNER-01 owns the bounded Owner Home/read-model paths listed in its bootstrap; Portal remains forbidden.
- V50-OWNER-02 owns focused Owner pets/care paths and one designated owner for shared Owner entrypoint/backend registration/docs; Portal, payment, MIS and telemed mutations remain forbidden.
- V50-OWNER-03 owns focused public catalog/doctor reads and Owner catalog/doctor UI; it may pass only typed context to existing booking entry and may not mutate booking state.
- Runtime authorization remains backend-owned; V50-OWNER-01 adds only the focused owner-home read module and root registration, with no mutation or migration.
- Persistent user Work Chats are not exposed by this environment; bootstrap and registry files are the durable coordination artifacts.
