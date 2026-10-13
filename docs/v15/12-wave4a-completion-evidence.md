# Wave 4A completion — incremental evidence

Date: 2026-10-07. Wave4A: PARTIAL; Wave4B/OCR: NOT STARTED; Wave4 overall: PARTIAL.

## Task brief — BP-11 bounded slice

Base local/remote: `326ce34a7dc5d0975226836e54a5793ceb3bcb53`, verified by fresh fetch; clean tree and correct transition branch. Goal: truthful operational contact/breed in the existing administrative appointment detail, without automatic medical history. Scope: registry service/DTO/OpenAPI, directly affected Portal parser/card/tests and evidence. No migrations, dependencies, medical-grant redesign, OCR, Owner sharing UI or new routes. Product Wave4A Completion attachment is the active scope authority. Acceptance: real Docker PostgreSQL/Nest minimum without grant, null data gap, no medical fields, preserved administrative capabilities, Portal type/parser/workflow/accessibility and OpenAPI checks.

## BP-11 implemented projection

Existing `GET /v1/clinic/:clinicId/locations/:locationId/appointments/:appointmentId` retains administrative role/capability authority. Exact active clinic/location/membership is additionally checked and locked before reading contact. No medical capability is granted to admin/receptionist.

Exact response fields:

- `clinicId`, `locationId`, `serverNow`.
- `appointment.appointmentId`, `aggregateVersion`, `statusCode`, `statusLabel`, `createdAt`.
- `schedule.startsAt`, `endsAt`, `timezone`, `sourceLabel`.
- `owner.displayName`: null (no authoritative name source); `owner.phone`: authoritative `owner_identities.phone_e164`, null when unavailable.
- `pet.id`, `displayName`, `speciesLabel`, `breed` (authoritative Pet field, nullable).
- `service.displayName`, `veterinarian.displayName`, `resource.displayName` where existing authoritative slot relationships supply them, otherwise null.
- `availableActions`: existing empty list.

BP-11 Owner name: PARTIAL DATA GAP. No phone-derived name, invented profile or placeholder is emitted as authoritative data. Portal separates name/phone/breed facts and displays honest unavailable labels. Legacy nullable owner/breed payloads remain parseable. The response has no Results, Amendments, Diary, Documents, OCR or medical-history fields. All nested DTO OpenAPI schemas are closed.

## Focused acceptance

Docker Compose project `pethelp-wave4a`, accepted compose override, PostgreSQL service `postgres`, workers disabled. No localhost PostgreSQL. Commands execute through `docker compose -p pethelp-wave4a -f docker-compose.local.yml -f dev/wave4a-acceptance.compose.yml exec -T backend`:

- `npm test -- --runTestsByPath test/appointment-medical-sharing-http.e2e-spec.ts --testNamePattern=BP-11 --runInBand --silent --passWithNoTests=false`: PASS 3/3; 20 unrelated tests intentionally skipped. Real clinical publication fixture exists, medical data/resources are seeded, no grant exists, and neither admin nor receptionist sees medical content. Null identity/breed/name and inactive-clinic denial covered.
- `npm run build`: PASS.
- `npm run openapi:export`: PASS.
- `node scripts/assert-appointment-minimum-openapi.cjs`, `node scripts/assert-openapi.cjs`, `npm run migrate:verify`: PASS, exit 0. No migration edits.

Portal Node22:

- `npm run typecheck` and `npm run build`: PASS.
- Compile `lib/api/clinic-appointments.ts` to a mktemp directory using `--module commonjs --target ES2022 --esModuleInterop --skipLibCheck --strictNullChecks`; run `node --test tests/contract/clinic-appointment-detail-parser.test.cjs` with `APPOINTMENT_DETAIL_PARSER_MODULE`: PASS 4/4. First standalone compile lacked project null-check settings and was not counted as acceptance; corrected compile and tests exit 0.
- `VETHELP_CLINIC_APPOINTMENTS_REGISTRY=true playwright test tests/e2e/clinic-appointment-detail.spec.ts --project=chromium --grep 'BP-11|safe owner-null|nullable service|renders no raw|accessibility' --reporter=list`: PASS 4/4. This is a mock-backed Portal workflow, separately from real backend acceptance.
- Same focused Playwright file with `--grep 'keyboard flow'`: PASS 1/1, keyboard/focus and axe scan. No new modal/form introduced.

No previously accepted 82-test matrix was repeatedly rerun. Existing legacy detail test expectations were reconciled to nullable owner contact/breed; its destructive fixture-reset suite is deferred to isolated final regression, not executed against retained acceptance grants. Generated Next route-import edit was restored and is not part of the slice. Migration171973 and OCR files are unchanged. Root diff-first review verifies only authoritative phone join and breed projection, no medical joins/fields and no widened roles.

## Remaining Wave4A work

### Slice A — Owner sharing controls, local acceptance PASS

Base checkpoint: `518530d78726adb2ea27f67cf00fb4372700bc24`, verified by fresh fetch with clean local/remote equality before implementation on 2026-10-07. Delivery commit: `feat(owner): add appointment medical sharing controls`. This section records local machine acceptance only; push/fetch and clean local/remote equality must be verified separately at delivery before another slice. BP-11 remains accepted `MATCH_WITH_KNOWN_DATA_GAP`. BP-12/Wave4A overall remain PARTIAL.

Implemented locally: authenticated Owner appointment entry; exact clinic/address, appointment timezone/date and pet context; explicitly selected finite resource references; inline confirmation; server grant response/readback; explicit revoke with version and server revoked readback. Existing backend explicitly models RESULT, AMENDMENT and DOCUMENT as separate snapshot references; no automatic future inclusion. Terminal appointments show/revoke old grants without creation. Failed uncertain commands retain idempotency/correlation and immutable selected references for exact retries; selection/navigation are locked during uncertainty. Session remount and generation/abort guards discard stale responses. No optimistic grant/revoke claim, raw IDs in visible labels, new dependencies or OCR changes.

Existing Owner context GET gains closed additive presentation fields (`clinic`, `pet`, `appointment`, `resourceDetails`), bounded to the authoritative appointment Owner/Pet and current eligible or already-granted typed references. No medical content, storage URL or grant authority change. Generated OpenAPI is reconciled and protected by `scripts/assert-owner-medical-sharing-openapi.cjs`.

Checks:

- Owner `npm run typecheck`: PASS, exit 0.
- Owner `npx eslint src/medical-sharing 'src/app/(app)/index.tsx'`: PASS, exit 0.
- Owner focused Jest API/workflow/accessibility: PASS 24/24, two suites. Includes all three eligible states, all three terminal states, explicit confirmation/create/revoke, checkbox semantics/48px targets, cancellation via accessibility escape, single-flight/uncertain identical retry, controlled conflicts, foreign context rejection, future selectable resource not widening an old grant, session change/late-response isolation. Mock-backed acceptance, not real-device evidence.
- Docker recovery verified with healthy isolated `pethelp-wave4a` backend/PostgreSQL and matching corrected container test source. Previous bind/runtime blocker is resolved; retained PostgreSQL/data volumes were not cleared or recreated, and no localhost PostgreSQL fallback was used.
- Real Nest HTTP matrix `appointment-medical-sharing-http.e2e-spec.ts`: existing matrix PASS 24/24, plus new selected A/B→eligible C snapshot case PASS and DRAFT/foreign Owner/Pet case PASS on focused runs (26 unique HTTP scenarios). Existing six authoritative eligibility cases cover CONFIRMED/RESCHEDULE_PROPOSED/COMPLETED allowed; CANCELLED_BY_USER/CANCELLED_BY_CLINIC/NO_SHOW denied. Includes exact Owner/Pet scope, closed presentation without medical text/storage URL, create readback, explicit revoke/revoked readback, forged selection rejection, immutable resources and retained authority/revoke concurrency checks. First DRAFT fixture attempted a second Result on an already-published Visit and correctly received 409; repaired with an independent Visit, then PASS. Production authority was not changed.
- `appointment-medical-sharing-contract.spec.ts`: PASS 26/26. `appointment-medical-sharing-migration.e2e-spec.ts`: populated Wave3→Wave4A acceptance PASS 1/1, preserving previous records and verifying checksums. Retained acceptance DB `npm run migrate:verify`: PASS. Migration171973 and the entire migration chain remain unchanged; no schema changes require a new migration. Prior fresh-chain baseline evidence remains in `11-wave4a-backend-evidence.md`.
- Backend `npm run build`, `npm run openapi:export`, canonical `assert-openapi.cjs`, BP-11 assertion and new Owner closed-context/create/revoke assertion: PASS, exit 0. Generated artifact changes are limited to additive Owner context presentation.
- Independent read-only `owner_slice_acceptance_review` validator: PASS, no blocking defect in current Owner UI/metadata diff. This is bounded slice validation, not mandatory fresh final Wave4A Security/Privacy or Independent reviews. Those remain outstanding.
- `git diff --check`: PASS. Root final diff review is restricted to Owner-sharing, additive Owner metadata, tests, generated contract and evidence. No dependencies, Clinic Portal, OCR or migration changes. pg emits an existing concurrent-client-query deprecation warning; no pg9 migration is in scope and no acceptance failure resulted.

Delivery gate: final diff review → bounded commit → authorized push → fresh fetch → clean local/remote equality. Do not start slice B until this checkpoint is remote-backed. If push is policy-rejected, stop and return the accepted commit SHA/manual push command. Wave4B NOT STARTED; no Jira/Confluence or main changes. Efficiency: ACCEPTABLE — continuation used the existing harness, one bounded validator and one test-fixture repair; prior successful Owner checks were reused without redundant reruns. Extra test/assertion commands were required for the explicitly requested real-DB DRAFT/foreign resource and generated Owner-contract evidence.

### Clinic shared read-model slice — local acceptance PASS

Base `0dc14fad53d80b0a896faf0f2a7522319c866297` is remote-backed, proven by fresh fetch with clean branch/tree before modification. Delivery commit: `feat(clinic): expose explicitly shared medical resources`; accepted local capability must be pushed and HEAD equality verified before the next slice.

Existing veterinarian detail gains server-derived canonical `appointmentId` from the already-authorized Appointment relation. The list and clinical mutation authority remain unchanged. Generated detail schema is now closed. Client accepts only the old/new closed detail shapes during rollout; an old response without Appointment ID cannot start sharing reads. No migration or schema/history rewrite.

New medical section is independent of operational appointment content and existing own-Visit clinical work. Exact selected refs are read through a private/no-store, vet-role-gated BFF and the existing grant-gated backend. Missing/unshared/revoked/foreign denials remain bounded. Closed list/resource parsers reject substituted refs, private unexpected fields, raw URLs and malformed timestamps. Generic logs/audit/outbox receive no new payload writes. UI renders original published Result, chronologically ordered explicitly selected Amendments, document labels/timestamps and neutral no-grant wording. No UUID/author/storage IDs are visible. Accepted model requires separate Amendment selection; Result selection never silently includes them. Refresh clears previous content; authorization/unavailable errors do not break operational workspace. Session subject/scope remount and aborted obsolete requests preserve privacy boundaries.

Medical Documents are METADATA ONLY in this capability commit. UI truthfully says delivery is not available yet; it does not fabricate a working download or expose permanent source URLs. Byte authorization/streaming and download controls are the next bounded slice after remote recovery gate.

Executed acceptance (2026-10-07):

- Portal typecheck and production build: PASS. Final build follows the session-subject-key adjustment; generated `next-env.d.ts` route import was restored and is excluded from the diff.
- Standalone parser compile with strictNullChecks and node contract tests: PASS 3/3. Original output under test-results was cleared by Playwright; recompiled outside that directory before final PASS.
- Focused `shared-medical.spec.ts` Chromium: PASS 6/6, including no-grant operational separation, selected Result/ordered explicit Amendments/document metadata, revoked refresh, Admin/Receptionist BFF denial before upstream, malformed/error privacy, labeled refresh keyboard and scoped axe. Mock-backed Portal evidence, not a live device or real Clinic sign-off.
- Real Docker PostgreSQL/Nest focused sharing tests: PASS 6 HTTP checks across runs (canonical Appointment projection/no-medical operational read, selected Result+Document metadata, foreign/forged scope, veterinarian-only exact access, explicit Amendment authority, unselected future published Result substitution). Service projection unit tests PASS 2/2. Retained random-UUID fixture harness was used; destructive legacy reset fixture was not executed. Its expected detail keys were reconciled to the additive field.
- Backend build/export, canonical OpenAPI, Owner OpenAPI and new Clinic read-model OpenAPI assertion: PASS. New assertion initially used incorrect template parameter names; repaired against generated `resourceType/resourceId` names, then PASS. This changed only a test script, not the API.
- Retained DB migration checksums: PASS; migration171973 and chain unchanged. NO NEW MIGRATION. Fresh latest/Wave3→latest re-acceptance remains required at the final consolidated gate, not claimed executed in this slice.
- Independent read-only `clinic_shared_slice_review`: PASS for current capability; not final Security/Privacy/Independent Review. Nonblocking: all-or-nothing medical rendering hides all resource cards when one read fails; dedicated session-change/late-response coverage remains a final acceptance item.
- Diff check: PASS. Efficiency ACCEPTABLE: targeted continuation, one independent validator, no runtime restart; extra commands covered explicit Result substitution, script-only assertion repair and parser-artifact regeneration. No broad suite or OCR work.

Remaining: actual document bytes/download authorization; final no-leak and delivery snapshot proof; membership/clinic/location/revoke read races on final delivery; Owner regression; one consolidated Wave1–4A regression; fresh/upgrade migration acceptance; fresh Security/Privacy and Independent reviews. BP-11 MATCH_WITH_KNOWN_DATA_GAP (Owner displayName remains null); BP-12 PARTIAL; Wave4A PARTIAL; Wave4B NOT STARTED. Jira/Confluence unchanged. No main merge or full-Wave acceptance. Stop immediately if push is rejected; do not accumulate another accepted local-only capability.

### Authorized Document delivery — bounded local acceptance PASS

Base remote-backed checkpoint `7b0456381f2ae392bbaf2e55916b9c0c4df6af55`, fresh clean/equality fetch and Docker/Node22 preflight PASS. Implemented Clinic authenticated Document byte route using the extracted existing Owner storage primitive; no Owner impersonation, permanent URL, raw key/path exposure, migration or dependency addition. Exact active veterinarian membership/clinic/location -> active selected DOCUMENT grant -> exact Owner/Pet/nondeleted document are locked before descriptor opening. Canonical storage containment, regular-file descriptor and recorded-size verification precede identifier-only authorization audit and COMMIT. Audit or COMMIT failure destroys the unopened-to-client stream; no bytes are returned before successful commit. Committed audit proves authorization only, not complete network receipt. Accepted in-flight downloads may finish after subsequent revoke; new authorization after revoke fails. Final explicit authority-race matrix remains a separate slice.

Portal BFF privately streams authenticated bytes and whitelisted headers. UI downloads a bounded ephemeral Blob with single-flight/loading, keyboard control, bounded accessible errors, abort/session unmount cleanup and revoked-content removal. No raw storage address is presented. Owner service retains exact Owner/Pet authority and existing audit; Pilot's intentionally unavailable legacy download HTTP route is not introduced or exposed.

Executed on 2026-10-07:

- Real retained Docker PostgreSQL/Nest sharing HTTP: 37/37 PASS; added audit-insert failure and real deferred-constraint COMMIT failure: 2/2 PASS. Total 39 unique HTTP scenarios; storage unit 3/3 and Owner service unit 4/4 PASS (46 unique tests). Commands: `npm test -- --runTestsByPath src/common/pet-document-storage.spec.ts test/appointment-medical-sharing-http.e2e-spec.ts src/auth/owner-pet.service.spec.ts --passWithNoTests=false`, then focused `--testNamePattern='audit/COMMIT'` for the two subsequently added cases. Actual bytes and safe attachment/private/no-store/nosniff headers verified. Denials cover missing/unshared/foreign Owner/Pet/clinic/location, inactive authority, Admin/Reception, revoke, soft deletion and unavailable storage without success audit. Real existing external-file symlink escape/size mismatch/control-header denial verified at primitive level. Snapshot independently selects RESULT/AMENDMENT/DOCUMENT; all three future eligible types remain denied and original immutable grant/readback stays exact. DRAFT/forged selection and all six eligibility states also PASS.
- Owner primitive compatibility verified with real owned bytes via service because PILOT_V1 deliberately excludes the legacy Owner HTTP download controller. Initial test incorrectly expected that controller; fixed test, not scope. Three historical readback tests were corrected to locate their own grant and distinguish retained revoked history from active grants; no production semantics changed.
- Backend build/export PASS; canonical `assert-openapi.cjs`, `assert-owner-medical-sharing-openapi.cjs`, binary `assert-clinic-medical-sharing-openapi.cjs` PASS. Generated artifact changes add only the authenticated Document byte contract. Retained `npm run migrate:verify` PASS, no edits to171973 or other migrations. Fresh latest and Wave3 upgrade re-acceptance explicitly deferred to final remote-backed slice.
- Portal typecheck/build PASS. Chromium `shared-medical.spec.ts` PASS 8/8 (actual PDF bytes, loading, keyboard, selected Result/ordered explicit Amendments, neutral no grant, refresh/revoke, Admin/Reception metadata+download BFF denial before upstream, bounded error and scoped axe). Command used Node22, explicit `playwright.config.mjs` and isolated ports3311/3312; an occupied default mock port and ambiguous Next route-announcer alert selector were resolved in harness only. Generated Next route import restored, not included in commit.
- Scoped read-only architectural review PASS after required byte/deny/rollback/browser conditions were verified. Storage directory ancestors are assumed trusted against adversarial local replacement; no adversarial local-filesystem write capability is introduced. This is NOT final fresh Wave4A Security/Privacy or Independent Review.
- Final diff review limited to storage/authorized delivery, Owner extraction, Portal download, focused tests, generated contract and evidence. `git diff --check` PASS. Existing pg concurrent-query deprecation warning remains nonblocking. Efficiency ACCEPTABLE: reused accepted authority and retained DB; extra focused runs repaired harness assumptions and added real COMMIT-failure proof rather than changing the model.

Delivery gate: commit `feat(medical-sharing): authorize shared document delivery` -> immediate authorized push -> fresh fetch -> clean local/remote equality. If push policy rejects, STOP immediately before final races/reviews; return SHA and manual command. Wave4A PARTIAL/BP-12 PARTIAL; BP-11 remains MATCH_WITH_KNOWN_DATA_GAP. Final all-resource authority races, consolidated Wave1–4A regression, full affected client gates, fresh latest/populated Wave3 migrations, fresh Security/Privacy and Independent reviews remain outstanding. OCR/Wave4B NOT STARTED; Jira/Confluence unchanged; no main merge.
