# Chat Identity

Chat ID: `V50-SHELL-01`

Domain: shared design tokens and application shells

Role: bounded V50 shell implementer

Branch: create only when this Work Chat starts

Base Commit: use the integrated BASELINE-02 commit

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

# Starting State

BASELINE-02 must be COMPLETE and the V50 source gate OPEN. Runtime V51 identifiers remain compatibility debt until separately analyzed.

# Acceptance Criteria

Define focused visual/state/viewport acceptance and rollback before changing shared runtime files.

# Required Validation

Select affected UI tests after file ownership is fixed; do not inherit BASELINE product-suite evidence as visual acceptance.

# Git Ownership

Owned/shared/forbidden paths must be assigned at chat activation.

# Handoff Contract

Update only assigned parity rows and create `docs/ai/handoffs/V50-SHELL-01.md`. Do not start a second bounded context.
