# V50 program current state

Updated: 2026-07-14

## Program status

- Result: `COMPLETED` for BASELINE-02.
- Integration status: `READY_FOR_COMMIT`.
- Canonical target version: `V50`.
- Authoritative product/visual source: `prototype-v50/index.html`.
- Decision source: product owner clarification; V51 was an erroneous target and does not exist.
- Program classification: `C3 / R3`; current documentation/tooling slice: `C2 / R1`, standard budget, continuation mode.
- Baseline commit: `4baf4e502e083fd6247f2dfe23626e546702fa1b`.
- Branch/worktree: historical `agent/v51-stage-01-architecture` / repository root; branch is not renamed in this slice.
- Protected dirty files: `.codex/ACTIVE_MODE`, `.codex/config.toml`; never modify them.

## Active task brief

- Selected slice: `BASELINE-02 / V50 Authoritative Source Registration`.
- Outcome: canonical V50 program paths, deterministic V50 inventory, checked-in manifest/checksum, corrected parity source anchors, naming-debt register, and closed source gate.
- Scope: `prototype-v50/manifest.json`, inventory tooling, `docs/v50/**`, V50 program/chat/handoff artifacts.
- Read-only: `apps/owner_mobile/**`, `apps/clinic-portal/**`, `backend/**`.
- Non-goals: runtime implementation, API/schema/migration/UI changes, runtime flag renames, legacy removal, `V50-SHELL-01` implementation.

## Source decision

```text
AUTHORITATIVE_SOURCE_CONFIRMED
targetVersion: V50
sourcePath: prototype-v50/index.html
decisionSource: product owner clarification
```

- BASELINE-01 source provenance verdict: `PASS`, status corrected to `COMPLETE`.
- Source confirmation does not prove implementation or visual fidelity.
- Visual fidelity remains `0/30 VISUALLY_VERIFIED`.
- Extracted inventory: 30 screens, 31 DOM screen nodes, 15 routes, 15 primary navigation anchors, 41 state tokens, roles `doctor/reception`, responsive desktop/tablet/mobile/reduced-motion.
- Source bundle manifest: `prototype-v50/manifest.json`; checksum and required-file verification are owned by the V50 inventory CLI.

## Runtime compatibility

- Existing V51-named runtime identifiers are naming debt, not product-target evidence.
- No runtime identifier, environment flag, CSS selector, test selector, branch, API, or migration is renamed in BASELINE-02.
- Compatibility inventory: `docs/v50/V50-NAMING-DEBT.md`.
- `docs/v51/design-tokens.json` remains temporarily at its compatibility path because a read-only portal test imports it.

## Chat orchestration

- `ROOT`: ACTIVE, V50 Program Coordinator.
- `BASELINE-01`: COMPLETE.
- `BASELINE-02`: COMPLETE; V50 source gate OPEN.
- Integration status: `READY_FOR_COMMIT`.
- `V50-SHELL-01`: PLANNED; next Work Chat only.
- Persistent user Work Chats are not exposed by this environment; bootstraps are repository artifacts.
- Parallel writers / ownership overlap: none.

## Validation state

- Focused V50 inventory tests: PASS 4/4, exit 0.
- `--require-v50 --verify-manifest`: PASS, exit 0; 108 required files and SHA-256 verified.
- Stale target-reference audit: PASS; 34 remaining occurrences classified as historical references or runtime naming debt, with 0 stale/invalid target references.
- Artifact/path/30-row/checksum-reference gate: PASS, exit 0.
- `git diff --check` and staged diff check: PASS, exit 0.
- Independent validator: PASS; no critical/high/medium findings and no veto.
- Deferred low risk: add focused negative tests for missing/corrupt/mismatched manifests when inventory tooling next changes.
- Product suites are intentionally not run because runtime code is read-only and unchanged.

## Continuation contract

For BASELINE-02, read only `git status --short`, this file, `prototype-v50/manifest.json`, the V50 source manifest, and the BASELINE-02 handoff. Do not repeat repository mapping, V50 screen extraction, migration review, or product suites unless source files change.

## Exactly one next slice

`V50-SHELL-01 / Shared Design Tokens and Application Shells`. Do not start it in BASELINE-02.
