# V50-OWNER-02 bootstrap

Work Chat ID: `V50-OWNER-02`

Title: `V50 Pets, Pet Profile and Pet Diary`

Status: `PARTIALLY_COMPLETED / VISUAL_BLOCKER`

Persistent user Work Chats are not exposed by this environment. This self-contained bootstrap is the durable continuation context.

## Task Brief

- Goal: implement the owner journey Home → Pets → Profile → Diary → document preview → Home while preserving one owner-scoped selected-pet context.
- User-visible outcome: owners manage real owned pets, edit a versioned profile, see backend-authored warnings and authoritative care chronology, inspect safe document metadata/content, and return to Home with selection retained.
- Scope: `OWN-009` (`#pets` → `/owner/pets`, `REUSE`), `OWN-010` (`#pet-profile` → `/owner/pets/:petId`, `MODIFY`), `OWN-011` (`#diary` → `/owner/pets/:petId/diary`, `MODIFY`); required loading/empty/error/offline/conflict/document states and four viewport classes.
- Acceptance: exact default-off flags `OWNER_V50_PETS`, `OWNER_V50_PET_PROFILE`, `OWNER_V50_PET_DIARY`; JWT-owned resources only; no demo IDs; safe version conflict; server chronology; no storage/OCR internals; legacy rollback; focused/full Flutter, backend checks when changed, web build, evidence and independent validator.
- Source: `prototype-v50/index.html#pets`, `#pet-profile`, `#diary`; manifest SHA-256 `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`.
- Environment: branch `agent/v50-owner-02`, worktree `/Users/evrusetskiy/work/pethelp-alpha-v50-owner-02`, base/integrated Owner Home `2077b00`.
- Classification/budget: program `C3/R3`; slice raised from `C3/R2` to `C3/R3` after archive and authoritative diary read-model gaps were proven; complex context budget.
- Risks: cross-owner pet/document leakage, destructive archive semantics, stale selection, last-write-wins medical data, raw OCR/storage leakage, unsafe preview, client-reordered chronology and overclaimed visual parity.
- Non-goals: catalog/booking/appointments/telemed/insurance/emergency/notifications, Clinic/Vet Portal, OCR rewrite/ML, document sharing/editing, payment, MIS and realtime infrastructure.

## Ownership

- Owned: focused Flutter pets/care feature and tests, focused backend owner-pet/diary contract and tests, V50-OWNER-02 docs/evidence.
- Shared single-owner: Owner entrypoint/journey wiring, backend root/OpenAPI only if required.
- Forbidden: Portal, payment, MIS, telemed mutations, insurance provider, booking mutations, runtime V51 alias removal and unrelated refactors.

## Required result

One atomic local commit `feat(v50-owner): add pet profile and care diary`, no push. Then hand off exactly `V50-OWNER-03 / Clinic Catalog, Clinic Detail and Doctor Discovery` without starting it.
