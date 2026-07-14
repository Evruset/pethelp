# V50 Runtime Naming Debt

Canonical product target is V50. The identifiers below are intentionally unchanged in BASELINE-02 because they participate in imports, environment configuration, CSS/DOM selectors, tests, or Git history.

V50-SHELL-01 resolved the active shell names additively: canonical V50 identifiers are now primary, while V51 names remain compatibility aliases for one release window. No mass rename or legacy removal was performed.

| Identifier | File(s) | Runtime impact | Public/internal | Safe rename strategy | Compatibility requirement | Recommended target name |
|---|---|---|---|---|---|---|
| `VETHELP_OWNER_V51_SHELL` | Owner shell feature-flag adapter/tests | compile-time rollout alias | operational | canonical V50 string has priority; remove only after deployment audit | exact-true fallback only when V50 is absent | `VETHELP_OWNER_V50_SHELL` (implemented) |
| `ClinicPortalShellV51` | `apps/clinic-portal/components/layout/ClinicPortalShellV51.tsx`, location layout | React export/import and flagged shell selection | internal source API | add V50 export/wrapper, migrate imports, then remove old export after tests | old export works during rollout | `ClinicPortalShellV50` |
| `ClinicPortalShellV51Props` | `ClinicPortalShellV51.tsx` | TypeScript type name | internal | introduce alias, migrate consumers, remove alias later | compile compatibility | `ClinicPortalShellV50Props` |
| `ClinicPortalShellV51Client` | `ClinicPortalShellV51Client.tsx`, shell import | client component export/import | internal | additive V50 export followed by import migration | old export retained through one deprecation cycle | `ClinicPortalShellV50Client` |
| `isPortalV51ShellEnabled` | `app/design-system/feature-flags.ts`, location layout/index | server-side flag evaluation API | internal code, environment-facing behavior | add V50 function reading both keys with explicit precedence, migrate imports | old function and old env key remain valid during rollout | `isPortalV50ShellEnabled` |
| `PORTAL_V51_SHELL` | feature flags, Playwright config/tests, deployment environments | rollout environment variable and registry key | public operational contract | introduce `PORTAL_V50_SHELL`, dual-read old key, migrate CI/deploy config, deprecate old key | never silently invert precedence; rollback must honor old key | `PORTAL_V50_SHELL` |
| `DESIGN_SYSTEM_FEATURE_FLAGS.PORTAL_V51_SHELL` | feature flag registry/tests | typed registry key | internal/test contract | add target key and compatibility alias with explicit test matrix | preserve default false and exact-true behavior | `DESIGN_SYSTEM_FEATURE_FLAGS.PORTAL_V50_SHELL` |
| `.vh-v51-skip-link` | `apps/clinic-portal/app/globals.css`, shell client | CSS selector | internal styling contract | add grouped V50 selector, migrate class, remove old selector after visual regression | both selectors render identically during rollout | `.vh-v50-skip-link` |
| `#clinic-v51-content` | shell client and veterinarian completion test | DOM focus target and test selector | internal/test contract | introduce V50 id plus temporary compatibility locator or data-testid | keyboard focus/back behavior must remain covered | `#clinic-v50-content` |
| `clinic-portal-shell-v51` | shell client `data-testid` | Playwright selector | test contract | add V50 test id and migrate tests atomically | focused shell tests pass during transition | `clinic-portal-shell-v50` |
| `ClinicPortalShellV51.tsx` | component filename/import path | module resolution | internal | rename only with all imports in one runtime slice | production build and shell tests required | `ClinicPortalShellV50.tsx` |
| `ClinicPortalShellV51Client.tsx` | component filename/import path | module resolution | internal | rename with export/import migration | production build and shell tests required | `ClinicPortalShellV50Client.tsx` |
| `docs/v51/design-tokens.json` | portal design-system test import; globals comment | compatibility data path | internal/test path | move to canonical V50 path only when the read-only import is updated in a runtime-owned slice | retain one authoritative file; do not duplicate JSON | `docs/v50/design-tokens.json` |
| `agent/v51-stage-01-architecture` | current Git branch | Git history/worktree identity | historical | do not rename in this slice; create future V50 branches from integrated baseline | preserve history and remote coordination | future `agent/v50-*` branches |

No additional `OWNER_V51_*` or `CLINIC_V51_*` runtime identifiers were found by the focused audit. Re-run the naming audit before any removal slice because CI/environment configuration may contain values outside the repository.

## Remaining-reference classification

The required audit returned 34 occurrences outside this file. Every occurrence is classified below; there are zero stale program references and zero invalid target references.

| Match group | Classification | Reason / disposition |
|---|---|---|
| `agent/v51-stage-01-architecture` in current-state, registry, bootstraps, and Stage 1 architecture evidence | historical reference | Existing branch/Git history; never rename mechanically. |
| Product-owner correction statements saying the erroneous version does not exist | historical reference | Decision evidence, not an active target claim. |
| BASELINE-01 historical handoff statements | historical reference | Closed-slice evidence superseded by BASELINE-02. |
| Canonical master-prompt invariant | historical reference | Explicitly tells future runs how to interpret stale target instructions. |
| `--require-v51` in V50 CLI, tests, source manifest, and BASELINE-02 bootstrap | historical reference | Deliberate rejected compatibility input; exits 2 and is not an alias. |
| `PORTAL_V51_SHELL` in parity/ADR evidence | runtime naming debt | Live environment/flag contract; rename only through the compatibility plan above. |
| Generic “V51-named runtime identifiers” wording in current-state/bootstraps/handoffs | runtime naming debt | Points to this register and authorizes no rename. |
| `docs/v51/design-tokens.json` and `docs/v51/**` compatibility references | runtime naming debt | Existing read-only portal test import; one authoritative compatibility file remains. |
| `docs/v51/README.md` deprecated-path statement | historical reference | Prevents future product-target ambiguity. |
| Stale program reference | stale program reference | None. |
| Invalid target reference | invalid target reference | None. |
