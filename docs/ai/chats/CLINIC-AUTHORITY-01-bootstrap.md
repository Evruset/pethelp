# Chat Identity

Chat ID: `CLINIC-AUTHORITY-01`
Domain: Clinic/Veterinarian authority boundary
Role: bounded implementation and validation
Branch: `agent/v51-stage-55-authority-orchestration`
Worktree: optional isolated worktree
Base Commit: `a36a33297708294f922b60b7fad68cef04621335`

# Goal

Remove clinical completion from the administrative schedule and retain the dedicated veterinarian visit workspace as the only Clinic Portal UI path for medical completion.

# User-visible Outcome

Clinic administrators and receptionists can manage schedule operations but cannot enter or submit a medical conclusion. A veterinarian with the required capability can complete the confirmed visit from the visit workspace, and the owner sees the resulting summary in Pet Diary.

# V51 Scope

- V51 IDs: `CLINIC-02`, `VET-01`
- Prototype semantics: administrative schedule is operational; clinical visit belongs to the veterinarian workspace.
- Routes:
  - administrative: `/clinics/:clinicId/locations/:locationId/schedule`
  - clinical: `/clinics/:clinicId/locations/:locationId/vet/visits/:holdId`

# Allowed Scope

- schedule page authority wiring;
- focused schedule Playwright regression;
- local-stack owner → veterinarian → Pet Diary journey;
- Stage 5.5 documentation and orchestration artifacts.

# Non-goals

- no backend completion contract change;
- no migration;
- no visit state-machine redesign;
- no new clinical fields;
- no schedule redesign;
- no merge into `main` without review and passing checks.

# Sources of Truth

- `docs/ai/current-state.md`
- `docs/v51/V51-PARITY-REGISTER.md`
- `docs/v51/stage5-veterinarian-completion-surface.md`
- `docs/v51/adr/0004-clinical-visit-state-machine.md`
- `apps/clinic-portal/components/veterinarian/VeterinarianVisitWorkspace.tsx`
- backend `clinical.visit.complete` capability enforcement

# Starting State

- Stage 5.1 veterinarian read/detail/completion is implemented and tested.
- Stage 5.2–5.4 are complete.
- The schedule route still passes `canCompleteAppointments=true` for `CLINIC_ADMIN`, exposing an unsafe legacy UI action.
- Focused schedule and veterinarian completion Playwright harnesses are known.

# Acceptance Criteria

1. Schedule renders no `Закрыть приём` control for receptionist or clinic administrator.
2. Schedule sends zero requests to the clinical completion BFF route.
3. Veterinarian completion route and existing capability checks remain unchanged.
4. Local-stack journey completes the visit under a veterinarian JWT and verifies Pet Diary readback.
5. Portal typecheck/build, schedule regression, veterinarian completion suite and `git diff --check` pass.

# Git Ownership

Owned:
- schedule page authority wiring;
- `clinic-schedule.spec.ts`;
- `owner-booking-to-pet-diary.spec.ts`;
- assigned docs under `docs/ai/**` and `docs/v51/**`.

Shared — coordinate before change:
- `ClinicScheduleClient.tsx`;
- completion BFF route;
- veterinarian workspace.

Forbidden:
- backend schema/migrations;
- owner mobile production source;
- telemedicine modules.

# Handoff Contract

Update `docs/ai/handoffs/CLINIC-AUTHORITY-01.md`, the Stage 5.5 row in the parity register and the chat-registry row. Record exact commands, exit codes, pass counts and residual risks.
