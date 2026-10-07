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

Owner sharing workflow, veterinarian shared-medical Portal flow, authorized document-byte delivery, additional authority races, consolidated acceptance and fresh Security/Privacy + Independent final reviews remain outstanding. Backend grant foundation evidence remains in `11-wave4a-backend-evidence.md`. This BP-11 slice is not a full Wave4A acceptance or human approval. Jira/Confluence unchanged; Wave5 not started. After an accepted commit, push and fresh HEAD equality are mandatory before the next substantial slice; stop on execution-policy push rejection.
