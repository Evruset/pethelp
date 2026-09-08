# Chat Identity

Chat ID: `BASELINE-02`

Domain: V50 source registration

Role: canonical target correction and manifest implementer

Branch: historical `agent/v51-stage-01-architecture`

Worktree: `/Users/evrusetskiy/work/pethelp-alpha`

Base Commit: `4baf4e502e083fd6247f2dfe23626e546702fa1b`

# Goal

Register `prototype-v50/index.html` as the authoritative V50 source and remove stale product-target V51 claims without changing runtime compatibility identifiers.

# User-visible Outcome

No product UI change. Program tooling and governance consistently target the product-owner-approved V50 source.

# V50 Scope

- IDs: `OWN-001..OWN-023`, `CLN-001..CLN-007` source anchors only.
- Source: `prototype-v50/index.html`.
- Manifest: `prototype-v50/manifest.json`.

# Allowed Scope

V50 manifest/inventory tooling, `docs/v50/**`, compatibility note under `docs/v51/**`, current-state, registry, BASELINE-01/02 handoffs, and V50-SHELL-01 bootstrap.

# Non-goals

No runtime, API, UI, migration, feature-flag rename, visual acceptance, or V50-SHELL-01 implementation.

# Acceptance Criteria

- V50 inventory and manifest verification pass with exact source-derived counts.
- Old `--require-v51` fails with `UNSUPPORTED_TARGET_VERSION`.
- Required files exist and SHA-256 matches.
- Active program artifacts use V50; remaining V51 references are classified historical or runtime naming debt.
- BASELINE-01 and BASELINE-02 are complete; source gate is open.

# Required Validation

Use only the two focused Node commands, stale-reference audit, artifact/path gate, and `git diff --check`. Do not run product suites.

# Git Ownership

Owned: paths listed in the product-owner clarification.

Read-only: `apps/owner_mobile/**`, `apps/clinic-portal/**`, `backend/**`.

Forbidden: runtime behavior and identifiers, migrations, API/UI changes, legacy removal, commits, pushes.

# Handoff Contract

Write `docs/ai/handoffs/BASELINE-02.md`, close the source gate, and name exactly `V50-SHELL-01` as next.
