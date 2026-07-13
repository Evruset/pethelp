# V51 Chat Registry

Этот реестр является коротким индексом bounded-context чатов программы V51. Полная история реализации хранится в handoff-файлах, а не в Root Chat.

| Chat ID | Title | Domain | Branch/Worktree | Status | Current Slice | Handoff | Last Commit | Blockers |
|---|---|---|---|---|---|---|---|---|
| ROOT | V51 Program Coordinator | Program | `main` | ACTIVE | Parity governance and integration | `docs/ai/current-state.md` | `a36a332` | PR #62 full Portal workflow is red |
| CLINIC-AUTHORITY-01 | Remove clinical completion from admin schedule | Clinic/Veterinarian boundary | `agent/v51-stage-55-authority-orchestration` | READY_FOR_INTEGRATION | Stage 5.5 authority hardening | `docs/ai/handoffs/CLINIC-AUTHORITY-01.md` | `8cd8089` | full Portal regression veto before merge |
| OWNER-01 | Owner shell, home, pets and Pet Diary | Owner | not created | PLANNED | OWNER-HOME, PETS, PROFILE, DIARY | — | — | current gate not integrated |
| OWNER-02 | Catalog, doctors, booking and owner bookings | Owner/Booking | not created | PLANNED | CATALOG, DOCTOR, BOOKING, APPOINTMENTS | — | — | doctor public API missing |
| CLINIC-01 | Queue and booking operations | Clinic | integrated in `main` | COMPLETE | QUEUE, HOLD INSPECTOR, REPLAY | `docs/ai/current-state.md` | `a36a332` | none |
| CLINIC-02 | Schedule, staff, resources and quality | Clinic | Stage 5.5 branch pending integration | READY_FOR_INTEGRATION | SCHEDULE, QUALITY | `docs/ai/handoffs/CLINIC-AUTHORITY-01.md` | `8cd8089` | full Portal regression veto before merge |
| VET-01 | Visit workspace and clinical completion | Veterinarian | Stage 5.5 branch pending integration | READY_FOR_INTEGRATION | VET VISIT LIST/DETAIL/COMPLETE | `docs/ai/handoffs/CLINIC-AUTHORITY-01.md` | `8cd8089` | full Portal regression veto before merge |
| TELEMED-01 | Telemedicine owner and veterinarian journey | Telemedicine | not created | PLANNED | TELEMED intake/wait/call/summary | — | — | ownership gap remains |
| QA-01 | V51 functional, visual and accessibility certification | QA/Release | not created | PLANNED | viewport matrix and cross-domain E2E | — | — | parity register incomplete |

## Status vocabulary

`PLANNED`, `ACTIVE`, `BLOCKED`, `READY_FOR_INTEGRATION`, `COMPLETE`, `ARCHIVED`, `SUPERSEDED`.

## Concurrency rule

At most three implementation chats, one QA/integration chat and the Root Chat may be active. Two active chats must never own the same file.
