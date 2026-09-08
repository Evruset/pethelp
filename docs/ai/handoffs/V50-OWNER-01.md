# V50-OWNER-01 handoff

## Result

`COMPLETE / READY_FOR_INTEGRATION / NOT_PUSHED`

## V50 IDs

- `OWN-001`: `prototype-v50/index.html#home` → `/owner/home`.
- Reused safety entry only: `OWN-017`, `#emergency` → existing emergency route.
- Source revision: `v50-clinic-role-workspaces`; manifest SHA-256: `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`.

## User-visible outcome

With the canonical V50 shell and default-off `OWNER_V50_HOME` enabled, an authenticated owner sees the authoritative selected pet, exactly one server-prioritized safe next action, at most one active-care summary, existing service destinations and an always-available emergency entry. The page has skeleton, no-pet, no-active-care, retryable error, offline/stale, session-expired and safe unknown-action behavior.

## Selected-pet behavior

- Source of authority: `GET /v1/owner/home`; local persistence is only an owner-keyed request hint.
- Selection order: valid requested owned pet, otherwise deterministic earliest owned pet, otherwise no pet.
- Foreign, deleted or malformed persisted values are never used as authority; valid foreign/stale UUIDs fall back without disclosing existence, malformed UUID syntax returns `INVALID_SELECTED_PET_ID`.
- Flutter validates the persisted value against the returned authoritative pet list, clears stale values and rewrites the server-selected pet.
- Successful auth increments an explicit owner session generation; owner/session changes invalidate retained state, while repository object replacement alone does not create a reload loop.

## Next-action authority

- The backend alone ranks active safety escalation, alternative-slot response, telemedicine wait/late state, booking attention, confirmed visit and planned-care fallback.
- History telemedicine rows are excluded before safety escalation ranking; only active rows can create an emergency action.
- Flutter accepts a closed action-code allowlist and maps it only to existing callbacks. Unknown/malformed action data uses exact appointments fallback copy and cannot execute an arbitrary route.
- Offline retained snapshots suppress the prior authoritative action and active-care CTA until a successful refresh.

## API contracts

- Additive read-only `GET /v1/owner/home?selectedPetId=<uuid>`.
- Guards: existing JWT and roles guards, `OWNER` only; owner identity is always JWT `sub`.
- Response schema version `1`: `serverNow`, minimal `pets`, `selectedPet`, `selectionSource`, one `nextAction`, and zero-or-one `activeCare`.
- Swagger decorators register the route, optional UUID query, bearer auth, success and bad-request responses. Detailed DTO/priority documentation is `docs/v50/V50-OWNER-HOME-CONTRACT.md`; route/API status is updated in `docs/v50/00-route-api-role-matrix.md`.
- No mutation, migration, payment, MIS or broader privilege is introduced.

## Feature flags and rollback

- `OWNER_V50_HOME` is exact-true and default off.
- It is effective only when `VETHELP_OWNER_V50_SHELL` is enabled; otherwise the legacy Home is retained and a once-only non-PII debug warning is emitted.
- Rollback: define the Home flag false, or independently disable the canonical V50 shell. No data/API downgrade is required.

## Changed files

- Backend: `backend/src/owner-home/**`, `backend/src/nest-root-full.ts`.
- Flutter: `apps/owner_mobile/lib/features/owner_journey/owner_home_*`, `owner_selected_pet_preference.dart`, `apps/owner_mobile/lib/owner_journey_main.dart`, focused tests and `pubspec.*` for `shared_preferences`.
- Delivery: current state, chat registry/bootstrap/handoff, evidence manifest, Owner Home contract, route/API matrix, parity register and program plan.

## Tests

- Backend focused controller/service specs: PASS 9/9 before repair; post-repair service spec PASS 9/9 in the implementer harness.
- Backend Docker build: PASS before the final repair. One later independent Docker Jest reproduction was blocked before Jest by npm `spawn EINVAL`; this is retained as an environment reproducibility risk, not reported as a test PASS.
- Flutter Home/shell affected tests: PASS 16/16 after repair.
- Flutter analyze: PASS.
- Full Flutter suite: PASS 164/164.
- Flagged Owner web build: PASS.
- Visual evidence harness: PASS 10/10; temporary harness removed.
- Independent post-repair review: PASS; vetoes `0`.

## Visual evidence and parity update

- Durable local package: `/Users/evrusetskiy/docs/ai/evidence/V50-OWNER-01/`.
- Versioned checksums/metadata: `docs/ai/evidence/V50-OWNER-01.json`.
- Viewports: `375x812`, `412x915`, `768x1024`, `1440x900`.
- States: ready/selected pet/attention, no active care, no pets, loading, retryable error, offline/stale, 200% text and reduced motion.
- The bounded functional, responsive and state slice is implemented/tested. These captures are deterministic widget evidence and are not a complete side-by-side prototype acceptance; prototype Home blocks outside this slice remain. `OWN-001` is not marked `VISUALLY_VERIFIED`, and the program count remains `0/30`.

## Known differences and residual risks

- Full prototype Home search/map/notification/profile content is outside this bounded slice.
- Evidence uses a deterministic local system text font; Material icon/button glyphs are limited by Flutter golden test-font rendering. Geometry, readable primary content, states and responsive behavior were inspected, but this does not certify pixel parity.
- The Docker npm `spawn EINVAL` anomaly prevents claiming a second independent post-repair Jest reproduction. The repaired ranking regression itself passed 9/9, and the independent validator returned PASS.

## Integration instructions

- Branch: `agent/v50-owner-01`.
- Worktree: `/Users/evrusetskiy/work/pethelp-alpha-v50-owner-01`.
- Integrated shell base: `1c58ad6`.
- Commit once as `feat(v50-owner): add care journey home`; do not push.
- Preserve root-worktree user changes in `.codex/ACTIVE_MODE` and `.codex/config.toml`.

## Last commit

Runtime commit reference: `8052ed5` before the evidence/status metadata amend. Runtime code is identical to final branch `HEAD`; the amend preserves one atomic commit with message `feat(v50-owner): add care journey home`. No push was performed.

## Exactly one next slice

`V50-OWNER-02 / Pets, Pet Profile and Pet Diary`. Do not start it in this session.
