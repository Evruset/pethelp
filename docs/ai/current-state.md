# V51 current-state handoff

## Program status

`V51 migration in progress`.

Repository: `Evruset/pethelp`
Baseline on `main`: `a36a33297708294f922b60b7fad68cef04621335`
Active branch: `agent/v51-stage-55-authority-orchestration`
Active chat: `CLINIC-AUTHORITY-01`
Selected slice: Stage 5.5 — clinical authority hardening.
Complexity/risk: C2 / R3 because this is a clinical-role boundary with an existing test harness and no schema change.

## Sources of truth

- product/route inventory: `docs/v51/00-route-api-role-matrix.md`;
- gap evidence: `docs/v51/00-current-state-gap-analysis.md`;
- parity: `docs/v51/V51-PARITY-REGISTER.md`;
- program: `docs/v51/V51-PROGRAM-PLAN.md`;
- chat ownership: `docs/ai/chat-registry.md`;
- adaptive workflow: `.agents/skills/adaptive-orchestrator/SKILL.md`.

## Backend verification environment

- Use the existing `docker-compose.local.yml` backend service for focused backend HTTP/e2e tests.
- Use the container `DATABASE_URL`; do not use localhost PostgreSQL.
- Canonical execution uses `docker compose exec -T backend`.
- If the backend dev container stops because of unrelated fixture workers, restart it once and retry only the interrupted command.
- Node must be >=20.9 for Clinic Portal production builds; validated baseline is Node 22.22.2.

## Closed foundations

### Stage 3 — centralized capabilities

Closed and verified capabilities include:

- `clinical.visit.complete`;
- `clinical.visit.workspace.read`;
- `booking.queue.read`;
- `quality.read`;
- `schedule.read`;
- `booking.hold.read`;
- `booking.replay.read`;
- `telemed.vet.queue.read`;
- `telemed.vet.audit-trail.read`;
- `ops.slo.snapshot.read`.

The backend derives capabilities and active scopes. JWT capability-shaped claims are never final authority. Endpoint authorization remains authoritative; frontend capabilities are fail-closed UX hints.

### Stage 4 — frontend capability consumption

Completed surfaces:

- clinic queue;
- quality;
- schedule read;
- platform veterinarian telemed queue;
- ops SLO/security.

The V51 shell remains feature-flagged and the existing legacy shell remains available for rollout compatibility.

### Stage 5.1–5.4

Completed:

- veterinarian visit LIST and DETAIL read projections;
- dedicated veterinarian visit portal routes;
- doctor-only clinical completion UI and focused 8-test completion suite;
- strict visit DTO parser hardening;
- display-safe telemedicine audit trail DTO and portal timeline;
- booking hold inspector;
- booking replay history.

Prior focused evidence recorded in the repository handoff:

- veterinarian read suite 6/6;
- veterinarian completion 8/8;
- telemedicine audit 6/6 plus shared telemed 15/15;
- hold inspector 7/7;
- replay 7/7;
- queue 9/9;
- portal typecheck/build PASS.

## Stage 5.5 selected issue

The administrative schedule route was still computing:

```text
CLINIC_ADMIN || CLINIC_VETERINARIAN → canCompleteAppointments
```

and exposing a `Закрыть приём` action that accepted a clinical summary. This contradicted the established V51 authority boundary because `schedule.read` must never imply `clinical.visit.complete`.

The dedicated veterinarian workspace already exists and is capability-gated. Stage 5.5 therefore removes the schedule UI path without changing the backend mutation contract or migrations.

## Stage 5.5 changes

- administrative schedule always disables the legacy clinical completion surface;
- focused schedule E2E now proves both receptionist and clinic administrator see no completion action and produce zero completion requests;
- local-stack owner booking journey now uses a `CLINIC_VETERINARIAN` session and `/vet/visits/:holdId` to complete the visit before verifying Pet Diary;
- initial parity/program/chat registries and bootstrap/handoff templates were added.

## Stage 5.5 required checks

Run on Node 22.22.2 where applicable:

1. `npm run typecheck` in `apps/clinic-portal`;
2. Clinic Portal production build;
3. focused `clinic-schedule.spec.ts`;
4. focused `veterinarian-visit-completion.spec.ts`;
5. local-stack `owner-booking-to-pet-diary.spec.ts` when Docker/local stack is available;
6. `git diff --check`.

Do not claim Stage 5.5 complete until required CI/focused checks are recorded with exit codes and pass counts.

## Constraints still in force

- do not edit or rename applied migrations;
- do not weaken backend `clinical.visit.complete` capability enforcement;
- do not restore clinic-admin clinical authority;
- do not mix booking, appointment, visit, payment or telemed state ownership;
- do not commit secrets, `.env.local`, generated Flutter/iOS files or `backend/package-lock.json`;
- do not merge this branch before validation.

## Next single action

Validate Stage 5.5. If all required checks pass, update the chat registry, parity row and handoff to `COMPLETE`, then integrate. The next bounded product slice should be selected from the parity register; current candidate is the clinic appointment registry read foundation.
