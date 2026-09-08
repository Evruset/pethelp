# Chat Identity

Chat ID: `V50-SHELL-01`

Domain: shared design tokens and application shells

Role: bounded V50 shell implementer

Branch: `agent/v50-shell-01`

Base Commit: `22da293aeec1a0acd2d07d6950376e04fe740af4`

Status: `COMPLETE / COMMITTED`

# Goal

Align shared design tokens plus Owner, Clinic, and Veterinarian shell foundations to the authoritative V50 source without broad product-flow implementation.

# User-visible Outcome

Consistent V50 shell/navigation foundations with controlled compatibility for existing V51-named runtime flags.

# V50 Scope

Select only shell/design anchors from `docs/v50/V50-PARITY-REGISTER.md` after focused prototype inspection.

# Allowed Scope

To be assigned before implementation with disjoint Owner/Portal ownership and explicit shared-file coordination.

# Non-goals

No booking, clinical, telemedicine, migration, API, or legacy-removal work.

# Sources of Truth

- `prototype-v50/index.html`
- `prototype-v50/manifest.json`
- `docs/v50/V50-SOURCE-MANIFEST.md`
- `docs/v50/V50-PARITY-REGISTER.md`
- `docs/v50/V50-NAMING-DEBT.md`
- applicable design-token ADR

# Completed State

BASELINE-02 is COMPLETE and committed. V50-SHELL-01 delivered the independently flagged Owner and Portal shell foundations; V51 identifiers remain compatibility aliases until a separate removal audit.

# Acceptance Criteria

Acceptance and rollback are recorded in `docs/v50/V50-SHELL-ARCHITECTURE.md` and the handoff.

# Required Validation

Validation completed as recorded in `docs/ai/handoffs/V50-SHELL-01.md`; shell evidence does not certify business-screen content.

# Git Ownership

Owned/shared/forbidden paths must be assigned at chat activation.

# Handoff Contract

Update only assigned parity rows and create `docs/ai/handoffs/V50-SHELL-01.md`. Do not start a second bounded context.
