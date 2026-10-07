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

Veterinarian shared-medical Portal flow, authorized document-byte delivery, additional authority races, consolidated acceptance and fresh Security/Privacy + Independent final reviews remain outstanding. Backend grant foundation evidence remains in `11-wave4a-backend-evidence.md`. These bounded slices are not full Wave4A acceptance or human approval. Jira/Confluence unchanged; Wave5 not started. After an accepted commit, push and fresh HEAD equality are mandatory before the next substantial slice; stop on execution-policy push rejection.
