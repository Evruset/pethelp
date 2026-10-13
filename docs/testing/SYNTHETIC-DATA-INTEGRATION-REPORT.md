# Multi-clinic synthetic data integration

Local product worktree, checkpoint `b00b11764d7c49aa2cb37b068b206e0259b2635a`; Batch01–05 preserved. No commit/push/deployment/merge/Jira/Confluence. OCR_FROZEN=YES.

## Current approved continuation (2026-10-13)

Product Owner selected **non-destructive reset into a new isolated DB** and explicitly required **native DoctorShift with Clinic Portal display**. These decisions supersede all historical reset/shift blockers below. Root sole writer; original Batch01–05 work remains, no publication.

- Reset creates a fresh guarded generation from template0, migrates, seeds and verifies; source DB and history/sessions remain intact. Existing targets reject, failed generations remain for diagnosis, activation is explicit. Original `synthetic_multiclinic_v4` is now protected against seed writes.
- Native `clinic_schema.doctor_shifts` via additive171978: exact location/doctor/staff composite FKs, positive <=24h duration, half-open no-overlap exclusions for doctor and staff (`btree_gist` required). Bounded internal publication has atomic audit/outbox/idempotency and deterministic changed-payload409. No new public mutation API or shift CRUD; no slot regeneration or change in Booking authority.
- Existing authorized Schedule read adds safe `doctorShifts` and clinic `timezone`; unchanged Admin/Reception HTTP roles and authoritative membership. Read-only Portal section uses current period/doctor filter, Moscow time, window counts, responsive cards; unavailable/error/empty states hide stale inventory. Catalog and Staff remain distinct identities, with explicit fixture mapping only; no general doctor assignment contract.
- Source shifts/raw provenance remain intact. Reuse checks scope/interval/status/source identity; conflicting mappings fail, only absent mappings recover with completed actor-scoped publication proof. Rolling reuse preserves initial raw relative-day identity rather than rewriting provenance.
- Demo selects `synthetic_multiclinic_v4_r_4f809ec21a36`; previous original fixture with260replayed bookings is retained. The fresh generation contains the separate confirmed smoke booking, not a false claim to clone/replay all prior history. Backend3310, Clinic3320, Owner8090. Commands in README and account guide include the selector.

### Focused continuation verification

| Check | Actual evidence |
|---|---|
| Non-destructive reset guards | 5 unique PASS; `/tmp/synthetic-reset-unit.log` |
| New-generation real API catalog/authorization/booking-confirm-readback | 3 PASS; `/tmp/synthetic-reset-smoke.log` |
| Existing-target reset rejection | Expected exit1 `RESET_TARGET_ALREADY_EXISTS`; `/tmp/synthetic-reset-collision.log` |
| Original fixture preservation | All79table count/row digests equal before reset and final; `/tmp/synthetic-before-reset-all.json`, `/tmp/synthetic-original-final-all.json` |
| Fresh latest chain / populated73→74 upgrade | 74 migrations/checksums PASS; `/tmp/synthetic-shift-fresh74-final.log`, `/tmp/synthetic-shift-fresh74-checksum-final.log`, `/tmp/synthetic-shift-upgrade.log`, `/tmp/synthetic-shift-upgrade-checksum.log` |
| Real PostgreSQL DoctorShift integrity, idempotency, concurrency, rollback, scope and safe read DTO | 8 PASS; `/tmp/synthetic-doctor-shift-tests.log` |
| Rolling shift identities and protected old-baseline guard | 2 PASS; `/tmp/synthetic-shift-unit.log` |
| Shift publication preserves existing slots/holds/appointments/pets | Four exact row-SHA256 snapshots match; `/tmp/synthetic-before-shift-publication.json`, `/tmp/synthetic-after-shift-publication.json` |
| Repeat native seed | created={} reused3500shifts/35000slots; all80table count/row digests equal with exclusive run; `/tmp/synthetic-native-shift-seed3.log`, `/tmp/synthetic-native-shift-{before,after}-seed3.json` |
| Affected backend build / Portal typecheck and final build | PASS; `/tmp/synthetic-shift-backend-build.log`, `/tmp/synthetic-shift-portal-typecheck.log`, `/tmp/synthetic-shift-portal-build-final.log` |
| Existing Schedule/permission UI regressions | 12 unique PASS, overlap counted once: first6green +7final with one repeated prerequisite; `/tmp/synthetic-shift-schedule-regression.log`, `/tmp/synthetic-shift-schedule-regression-final.log` |
| Independent bounded architecture/security reviews | No remaining material findings, `/root/doctor_shift_architecture` and `/root/synthetic_review`; one mapping/provenance finding repaired and re-reviewed |

Initial setup/harness failures (UUID SQL inference, missing wrapper env, wrong route, reserved SQL alias) were corrected. New component live-status ambiguity and failed-refresh priority were real UI issues, fixed and affected checks rerun. Concurrent Owner session creation contaminated an early repeat-seed audit/session snapshot; exclusive seed3 proves all80tables unchanged. These attempts are not counted as extra PASS. No accepted OCR/T044 suites or unrelated broad regressions rerun.

Historical32unique checks below remain sticky where unchanged. Final native UI and calendar rollover results, current scope/hashes and classification follow at the end. Unsupported clinical fixture fields remain raw; no clinical-history exposure, personal veterinarian assignment, IdP/OTP, native-device/UAT or Pilot acceptance is inferred. OCR_FROZEN=YES.

## Initial implementation — historical before the approved continuation

- Exact supplied archive, SHA256 `83c6a71e8bd8c63c9c0ca1d2617aed5d0b2692898010da604b0ea81a48302640`; UTF-8 BOM parsing, source manifest/count/FK/UUID/calendar/doctor/species/service validation. No generated substitute.
- Guarded additive local importer, restricted fixture raw/map tables, stable sourceUUIDv5→internalUUIDv4 mapping, bounded transactions, native Schedule publication and transactional audit/outbox. Existing published slots/states/holds and user Pet edits remain untouched on rerun.
- Real Owner opaque sessions and scoped staff JWT fixtures through current auth primitives. No password, invented contact, production route/backdoor or master scope. Account registry620 entries, explicit local-only browser picker.
- Dedicated runnable DB `synthetic_multiclinic_v4`; original product_batch01 and incompatible first diagnostic attempt retained, no drops/deletes/resets. Separate Nest3310, Owner8090, Clinic3320; accepted app code/build, no fake API or parallel booking core.
- Native import's reproducible constant-version outbox collision repaired by actor-scoped command key. Previous working-hours repair preserved. No API validation weakening: CreateHold remains UUIDv4. No migration/dependency changes.

Mapping: [SYNTHETIC-DATA-MAPPING](SYNTHETIC-DATA-MAPPING.md). Accounts: [DEMO-ACCOUNTS](DEMO-ACCOUNTS.md). Commands: [local README](../../dev/synthetic-multi-clinic/README.md).

## Initial boundaries — superseded for native shifts/reset below

- Native DoctorShift/DoctorService do not exist in this baseline. All3500 source shifts retained/validated; native appointment slots use staff/catalog-doctor metadata. No invented ordinary-shift use of BLACKOUT/VACATION/EMERGENCY_DUTY.
- MVP species remain DOG/CAT/OTHER. Four exotic source species retained exactly raw and mapped OTHER; archive EXOTIC doctors accept all four. No production species API expansion.
- Anamnesis401/allergies139/conditions132 retained only in restricted fixture store, including UNKNOWN/SUSPECTED/OWNER_REPORTED/false confirmation.133 unknown sterilization→null. No diagnoses, prescriptions, Pet history/OCR promotion, sharing grant/consent fabrication. Exact medical fields are not claimed as exposed through unsupported MVP clinical APIs.
- Source price_from/scope/duration/profile differences retained. Native wire pricing stays INFORMATIONAL, display says synthetic/from; no invented distance/contact/rating/assets or comparison rules.
- Native replay uses real commands and DB timestamps. Original historical timestamps and476events remain immutable reference data;43EXPIRED examples use the unchanged15minute PostgreSQL TTL and existing expiry worker; no clock/deadline is fabricated.
- reset-fixture now implements the separately approved non-destructive fresh-DB generation; no authority to delete existing history. Real IdP/OTP, personal vet assignment, native-device/UAT/Pilot acceptance are not claimed.

## Initial verification — sticky evidence

| Fresh check | Actual result | Local execution evidence |
|---|---|---|
| Archive/relationships/calendar/medical source validation and seed guards | 9 unique PASS,0 FAIL | `/tmp/synthetic-unit-final.log` |
| Native Schedule publication/outbox/idempotency/forged tenant, real PostgreSQL rollback-isolated tests | 4 PASS,0 FAIL | `/tmp/synthetic-import-tests-v4.log` |
| Actual API/UI/data/RBAC/booking/performance acceptance | 17 unique PASS:12 retained green +5 remaining | `/tmp/synthetic-api-ui-positive.log`, `/tmp/synthetic-api-remaining.log` |
| Receptionist real journal and veterinarian denial | 1 PASS | `/tmp/synthetic-roles-ui-final.log` (subsequent unrelated test selector failed) |
| Veterinarian real visit detail/patient context | 1 PASS | `/tmp/synthetic-vet-ui-final.log` |
| Fresh migration chain/checksum | 73 migrations PASS; checksum command exit0 | `/tmp/synthetic-v4-prepare.log`, `/tmp/synthetic-v4-migration-verify.log` |
| Affected backend build | PASS | `/tmp/synthetic-prepare.log` |
| Initial seed and second full seed | PASS; second created={} and reused35000 slots,620accounts,25clinics,25locations,250doctors,455offers,401pets | `/tmp/synthetic-v4-seed-1.log`, `/tmp/synthetic-v4-seed-2.log` |
| Exact state before/after second seed | PASS, byte-identical JSON hashes for slots,holds,appointments,outbox,audit,pets; no concurrent mutations | `/tmp/synthetic-before-seed2.json`, `/tmp/synthetic-after-seed2.json` |
| Owner/Clinic typechecks/build | REUSED_STICKY_PASS from Batch05; frontend source unchanged | `docs/product/PRODUCT-BATCH-05.md` |
| Independent bounded review | No remaining material finding in mapping/auth/rolling-key/expiry/replay review; runtime totals separately required | reviewer `/root/synthetic_review` |

Fresh unit/integration/API/UI union: **32 unique checks PASS**, not a combined full-suite claim. Initial harness/environment failures are retained: unsupported sourceUUIDv5 caused CreateHold400 (fixed with fixture mapping, API unchanged), count scoping/race, wire status expectations, migration command cwd and UI locator selection. They are not counted as extra passing tests. FIFO replay initially returned409 behind pending expiry examples; it stopped correctly and was not bypassed.

Catalog/availability:15 actual HTTP samples on the35000slot database, p95/max10.653793ms. No production/load-SLO claim and no speculative index added. Rolling overlap32500/replacement2500 verified deterministically; actual next-calendar-day seed was not artificially time-travelled.

### Booking history final reconciliation

**PASS**:43 actual expired via accepted15minute PostgreSQL TTL and existing `BookingService.expireHolds(100)`, then173 terminal decisions and44 pending creations through real APIs. No deadline mutation/backdating. Native mapping260/260:44pending,44confirmed,86rejected,43cancelled,43expired. Owner/Pet/location/canonical service reconciled for every entry.216terminal entries have exactly one matching terminal audit and outbox;44confirmed have exactly one appointment. Slot held/booked counters match actual holds. Source476events remain exact raw references, not native historical claims.

Evidence: `/tmp/synthetic-expired-create.log`, `/tmp/synthetic-expired-finish.log`; command stdout captured from exec session73909 in `/tmp/synthetic-replay-final.log`; final native/source reconciliation `/tmp/synthetic-final-native.log`. The32unique checks above exclude this additional260row history reconciliation, two seed executions and migration/build gates.

## Local demo and screenshots

Runnable: Owner `http://localhost:8090`, Clinic `http://127.0.0.1:3320`, backend3310. Launch/auth commands: [README](../../dev/synthetic-multi-clinic/README.md); all620 identities: [DEMO-ACCOUNTS](DEMO-ACCOUNTS.md). Demo sessions are fixture-only, not accepted real OTP/IdP. Clinical mutations are not seeded or simulated.

Actual Playwright screenshots, intentionally ignored local outputs:
`dev/product-batch01/screenshots/synthetic-owner-catalog.png`, `synthetic-owner-confirmed.png` (390px); `synthetic-clinic-queue.png`, `synthetic-clinic-schedule.png` (1440px); `synthetic-receptionist-detail.png`, `synthetic-veterinarian-detail.png` (768px); `synthetic-veterinarian-visits.png`. Owner confirmed, Clinic schedule and veterinarian detail inspected visually. The schedule capture contains transient sidebar-access loading; not claimed a settled visual QA of every portal component.

## Initial scope gaps — native shifts/reset superseded below

- Destructive namespace purge remains unimplemented and unauthorized. Product Owner selected non-destructive reset into a fresh DB; that extension is documented below. Previous audit/history is retained.
- Native3500 shift objects and full clinical-history exposure are unavailable in the accepted MVP; validated source fixtures/native slot linkage are delivered instead. Native species remain DOG/CAT/OTHER. Source profiles retained raw, not exposed as a new production API.
- Historical476source events are reference-only; replay uses current causal domain events, not historical event injection. Replay initial-state verification is not a promise to undo subsequent manual edits or normal expiration.
- No native-device/UAT/Pilot/provider acceptance. OCR_FROZEN=YES. No new dependencies, migrations, API expansion, accepted sharing changes, commit/push/deploy/merge/Jira/Confluence.

## Initial preservation and hashes

Original674 dirty entries unchanged; aggregate SHA256 `f4fe840760b5c771ac774d252cea85b2303dc535872bf255450900dbbdb9fbb5`. Previous43 dirty/untracked product files compared against input snapshot; only intended Schedule import refinement/current-state append allowed. HEAD remainsb00b117, index empty. Source/evidence checksums and exact changed scope follow after final verification.

Efficiency: INEFFICIENT due avoidable harness/UUID/selector iterations; one bounded read-only reviewer, no parallel writers, no broad sticky-suite reruns. No fabricated elapsed time or test duplication.

## Initial classification (before reset clarification)

```text
DATASET_VALIDATION=PASS
CLINICS=25
DOCTORS=250
OWNERS=320
PETS=401
ACCOUNTS_MAPPED=620
SHIFTS=3500 (SOURCE_FIXTURES_ONLY; native slot linkage, no native shift entity)
SLOTS=35000
SERVICES=22 (455 native location offers)
BOOKING_HISTORY=PASS
SEED_IDEMPOTENCY=PASS
RBAC_ISOLATION=PASS
OWNER_API=PASS
CLINIC_PORTAL_API=PASS
BOOKING_E2E=PASS
MEDICAL_SEMANTICS=PASS
DEMO_READY=YES
OCR_FROZEN=YES
SYNTHETIC_DATA_INTEGRATION=PARTIAL
```

The principal delivery outcome is runnable and verified across real Owner/Clinic/Veterinarian APIs/UI. PARTIAL records the requested `reset-fixture` operation that remains fail-closed, and unavailable native DoctorShift management; neither was silently replaced by destructive deletion or new MVP scope. All imported source data is preserved; these gaps do not prevent the demonstrated booking journeys.

## Historical pre-reset task scope and SHA256

21task files: the19 below, this report and `docs/ai/current-state.md`. The Schedule service already contained Batch05 changes; only import event key/comment are new here. Prior dirty files are excluded from task scope.

Source/launch/mapping registry aggregate SHA256 `1fc811a4b1b184868eddd4b2f615305d5308c7902f2fcd52fea861ef8bb80559` (sorted lines below, final LF). Report/current-state excluded to avoid recursive hashes. Local logs include failed harness attempts as explicitly described; no claim that every line is green.

```text
8f13e54ee25133d9537ac5d894a5711d617d9faaaa663882826f53680ecd9405  backend/scripts/seed-local-multi-clinic.cjs
8c2671e0c79be1fc3b780897a33082a686100cd1007ac06bba4217fa010e8721  backend/scripts/synthetic/read-dataset.py
c0617ea35a12ae6aec03791e9330e4491b73b796b15c80cb3766d628e912499b  backend/scripts/synthetic/seed.test.cjs
f567789c13628fc02e9047182f22d5723a794df3810c85be9cbc05d8ba21f5e9  backend/src/booking-core/clinic-schedule.service.ts
f4a88a9f85cb546349c13a330b75b892d57edfa3bee288fe67a5ce6d19b1c976  backend/test/synthetic-schedule-import.integration-spec.ts
570a89f21338ac661d49a801ae5cf2b69fd9ea6e626fde35cef97f9f1a2c3656  dev/synthetic-multi-clinic/README.md
a637634412904b9f04a52f5cc531698950b26eea639206b13218c865ddc9351c  dev/synthetic-multi-clinic/env.mjs
e9ef2547e4b67a8157a578a3622374e489f9982a474f63d2b88931e926b19c9c  dev/synthetic-multi-clinic/expire.mjs
6bedf7b8f1c4674f05f8ba82a7d42c23c685a2a125cf2b45a9e1a03c9deca74b  dev/synthetic-multi-clinic/history.mjs
95ab3946eccdce80f5423e9b1d321bf2b46e4f0376229a1de85edd6b1d652a1b  dev/synthetic-multi-clinic/identity.mjs
149ade093fda780ac3293b59b30770eccb41b174cf7255176facfc25117f59d5  dev/synthetic-multi-clinic/inspect.mjs
2eae5fa4771c9b8452750ee43c020fe9f1d6560467c0594d2241b18e2fd1c57f  dev/synthetic-multi-clinic/replay.mjs
702adfcf0665db48f0fe277dd83030cb30160a9bb3a878f9090a4ce9f24a6a64  dev/synthetic-multi-clinic/roles.mjs
55e92b275e111fb6666a5e6635dc00e749ad198ecb205bbe1397122ea4590f7d  dev/synthetic-multi-clinic/run.mjs
2c61e3775bb2b04dd1a148421001f6938f5dbb26f3269507eef6e86d195aebb6  dev/synthetic-multi-clinic/snapshot.mjs
1b24d013ae24d39eb3ac3289650da4c675e825abc2ecfedfe11518dd6f90b636  dev/synthetic-multi-clinic/start.mjs
d2af601a9e4f4d5afbafd2dfc6b89ade502b139c5f63138bc680cfe5cd2cfea9  dev/synthetic-multi-clinic/verify.mjs
5aecef9c5a8f632fe48d3eb02f364ccbdec2473e6eb0b2e04ec55214de352313  docs/testing/DEMO-ACCOUNTS.md
faf6c20310304f8be40d2fc6971b393164c2c1de5ac42f71267f38890182184b  docs/testing/SYNTHETIC-DATA-MAPPING.md
```

Execution evidence SHA256:

```text
84a104614926afa547ae4f546cd77320b6bcc5a76298eb5f10bfa32ed8297424  /tmp/synthetic-unit-final.log
e6c73969e465041774b8b5c532536ec36d588ab81c1a6434b57f18cf71f6948d  /tmp/synthetic-import-tests-v4.log
b30917248ce1698598c5be49e2f5b5ce5df11128c29afc7f513f59abc2f6c597  /tmp/synthetic-api-ui-positive.log
0db850ced5424d0b65e2a4a5a74deac612a52e1fac4fc2c026cb3c196d0b7979  /tmp/synthetic-api-remaining.log
af9b61be8cc269389ed20ccbc7a00c02c79f938f07fb514e52e0a0782e011ef3  /tmp/synthetic-roles-ui-final.log
701911468fc3f9589087f72a0394b1cf242de2bd936c8c184217ca41818c987b  /tmp/synthetic-vet-ui-final.log
bbe74ded216eb3957789c42adaac51d62bd1599f236f39bd536fe9181ccb7fd9  /tmp/synthetic-v4-prepare.log
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  /tmp/synthetic-v4-migration-verify.log
d42f5b86e8577d6b2edfdce947ad9e790d7e443b41a63b48c1f70c19d45980d0  /tmp/synthetic-prepare.log
4c4ce80d49c02227de97cff29faab23406e21e60c377060216f5afed882a5029  /tmp/synthetic-v4-seed-1.log
ad088e2e3ced0719a3f4d439261110ed3524bb55d0ce2bc7ad07b5cbb7cde6b0  /tmp/synthetic-v4-seed-2.log
fa219d24192c9c06a9841075b77eccac0c34a0460538918b6ce10f51fc121be3  /tmp/synthetic-before-seed2.json
fa219d24192c9c06a9841075b77eccac0c34a0460538918b6ce10f51fc121be3  /tmp/synthetic-after-seed2.json
2732a87a6cbc2391f1d96ced23ab128f95a3bd6cf4d7904bd6957cc221972f7e  /tmp/synthetic-expired-create.log
1c99650255a1f998873334b480738cd6cf1e2962fde19f2b3ea3e1bc257d413e  /tmp/synthetic-expired-finish.log
4d46ac42d92212dcb72b3f501c121b2a3d860cf1cdc23f8618dfd8f18eff41e7  /tmp/synthetic-replay-final.log
82ff309d7595e6058bb72e50681bfcf5e4e57211349380fbd1189b5070acb5a3  /tmp/synthetic-final-native.log
```

### Historical completion audit — reset decision pending (superseded)

Current19source/launch/mapping file hashes rechecked against the recorded SHA256 list:PASS; original674 preservation rechecked:PASS. Accepted runtime gates were not rerun. The remaining reset requirement is blocked by the explicit request conflict: §4requires a separately confirmed namespace reset; §13says not to delete existing data. No delete/reset was executed or newly authorized. Product clarification requested: non-destructive fresh-DB generation retaining the prior DB, separately confirmed namespace-only deletion, or explicit acceptance of the reset gap. `SYNTHETIC_DATA_INTEGRATION=PARTIAL`; reset work item `BLOCKED_PRODUCT_DECISION`. No technical completion claim is added.

Reset blocker persists across three consecutive goal turns. Goal status:BLOCKED pending product clarification; integration classification remainsPARTIAL. No additional runtime tests or data mutations performed.

## Historical reset extension checkpoint — subsequently completed

Product Owner explicitly selected a new isolated database with complete retention of the prior database. `reset-fixture` now requires exact namespace confirmation and a distinct bounded generation name; it proves the old namespace/archive, restricts CREATE DATABASE to the existing test-owned resource, creates with template0, applies migrations/checksums and seed/verify. No copying of unrelated rows/sessions, destructive SQL, or automatic running-demo switch. Existing names fail closed; failed new generations are retained. Select an eligible generation with `SYNTHETIC_DATABASE_NAME` for every command. Prior nineteen-source-file hashes above describe the historical pre-reset snapshot; updated hashes follow after final verification.

Five new unit checks PASS; three directly affected existing environment/namespace guards rerun PASS (not additional unique tests). Bounded independent reviewer found no material defect. Actual reset execution and complete old-DB table snapshot comparison pending. Original sticky API/UI/history gates remain valid and are not rerun.

## Final continuation verdict (2026-10-13)

**SYNTHETIC_DATA_INTEGRATION=COMPLETE** within the requested local fixture/backend/API/UI scope. Reset and native-shift blockers are resolved by the explicit Product Owner decisions and executed evidence above. No further feature is started.

Final native API/UI: **6PASS,0FAIL** (`/tmp/synthetic-native-shift-ui-final.log`):140shifts per selected clinic/14days, exact safe DTO and Moscow time; Admin/Reception allowed, Owner/Vet/foreign clinic denied; actual desktop1440/mobile390 rendering, doctor/date filters, ten matching published windows, failed-refresh clearance and actual API empty period. Screenshots `synthetic-native-shifts-desktop.png` and `synthetic-native-shifts-mobile.png` captured and visually inspected; desktop section recaptured at1440viewport without business mutation. Owner/Clinic entry HTTP200; demo remains runnable using the selected new generation.

**Real midnight rollover verified**: anchor2026-10-13→2026-10-14 without clock manipulation. Seed appended250shifts/2500slots and reused3250shifts/32500slots; fresh native verification proves3500shifts/35000slots in the current14-day window,3750/37500 lifetime inventory retaining history. All original35000slot rows, holds, appointments and Pets remain byte-identical. Evidence `/tmp/synthetic-native-shift-nextday-seed.log`, `/tmp/synthetic-native-shift-nextday-verify.log`, `/tmp/synthetic-native-shift-rollover-preservation.log`.

Continuation union **36unique checks PASS** (5reset unit +3reset API +8DoctorShift PostgreSQL +2new unit +6native API/UI +12Schedule regression), plus32earlier scoped checks reused where unchanged = **68unique checks PASS**, no unresolved FAIL. The union is not a single full-suite run. Repeat prerequisites and3existing guard reruns are counted once; migration/build/snapshot/history gates are separate. Fresh74migration chain and populated upgrade PASS. Architecture and security bounded reviewers have no remaining material findings. Original674aggregate unchanged, index empty, checkpointb00b117 unchanged. Previous43product inputs remain exact except the authorized Schedule service/client and current-state refinements.

```text
DATASET_VALIDATION=PASS
CLINICS=25
DOCTORS=250
OWNERS=320
PETS=401
ACCOUNTS_MAPPED=620
SHIFTS=3500_NATIVE_CURRENT_WINDOW
SLOTS=35000_CURRENT_WINDOW
SERVICES=22
NATIVE_LOCATION_OFFERS=455
BOOKING_HISTORY=PASS_REUSED_260_IN_PRESERVED_PREVIOUS_DATABASE
RESET_FIXTURE=PASS_NON_DESTRUCTIVE
SEED_IDEMPOTENCY=PASS
RBAC_ISOLATION=PASS
OWNER_API=PASS
CLINIC_PORTAL_API=PASS
BOOKING_E2E=PASS
MEDICAL_SEMANTICS=PASS
DEMO_READY=YES
SYNTHETIC_DATA_INTEGRATION=COMPLETE
OCR_FROZEN=YES
```

Remaining limits: original476events/unsupported medical attributes remain immutable reference fixtures; no full clinical-record import. Fresh reset does not clone old260booking history. Native DoctorShift is read-only inventory, with no CRUD/recurrence/slot generator or general staff↔doctor assignment; no Veterinarian permission expansion. btree_gist deployment provisioning is required, populated rollback refuses deletion. Local fixture identities are not production OTP/IdP. No native-device/UAT/Pilot, external-provider or performance-SLO acceptance. OCR production isolation, real adapter, retention and physical restore remain frozen/unresolved. All changes local/uncommitted; no push/deployment/main/Jira/Confluence.

### Final exact task scope (32 files; prior Batch03–05 diffs retained)

- `apps/clinic-portal/components/schedule/ClinicScheduleClient.tsx`
- `apps/clinic-portal/components/schedule/DoctorShiftInventory.tsx`
- `apps/clinic-portal/lib/api/clinic-schedule.ts`
- `backend/migrations/node-pg/1719780000000_add_doctor_shift_inventory.js`
- `backend/scripts/seed-local-multi-clinic.cjs`
- `backend/scripts/synthetic/fixture-database.cjs`
- `backend/scripts/synthetic/read-dataset.py`
- `backend/scripts/synthetic/reset-fixture.cjs`
- `backend/scripts/synthetic/reset.test.cjs`
- `backend/scripts/synthetic/seed.test.cjs`
- `backend/src/booking-core/clinic-schedule.controller.ts`
- `backend/src/booking-core/clinic-schedule.service.ts`
- `backend/test/doctor-shift-inventory.integration-spec.ts`
- `backend/test/synthetic-schedule-import.integration-spec.ts`
- `dev/synthetic-multi-clinic/README.md`
- `dev/synthetic-multi-clinic/env.mjs`
- `dev/synthetic-multi-clinic/expire.mjs`
- `dev/synthetic-multi-clinic/history.mjs`
- `dev/synthetic-multi-clinic/identity.mjs`
- `dev/synthetic-multi-clinic/inspect.mjs`
- `dev/synthetic-multi-clinic/replay.mjs`
- `dev/synthetic-multi-clinic/reset-smoke.mjs`
- `dev/synthetic-multi-clinic/roles.mjs`
- `dev/synthetic-multi-clinic/run.mjs`
- `dev/synthetic-multi-clinic/shifts.mjs`
- `dev/synthetic-multi-clinic/snapshot.mjs`
- `dev/synthetic-multi-clinic/start.mjs`
- `dev/synthetic-multi-clinic/verify.mjs`
- `docs/ai/current-state.md`
- `docs/testing/DEMO-ACCOUNTS.md`
- `docs/testing/SYNTHETIC-DATA-INTEGRATION-REPORT.md`
- `docs/testing/SYNTHETIC-DATA-MAPPING.md`

### Final source SHA256

Report/current-state excluded from the embedded source hash list to avoid a self-reference cycle.

```text
1ba380f0fc9e27c175091997574d58adc38eae70cf37c7f38f34f74935ddbae8  apps/clinic-portal/components/schedule/ClinicScheduleClient.tsx
7807d95bc666b6f48caba23d037d7094e845a334796f8fbbbd1812b5ec2ea4f8  apps/clinic-portal/components/schedule/DoctorShiftInventory.tsx
2c9224ec2349b0e1f113604e2779d409247339ecc423f17755caabc632834130  apps/clinic-portal/lib/api/clinic-schedule.ts
38effa6d42e23439f228f6b73340f25e4f1f5f58ad72526f3d47dd5c568a957e  backend/migrations/node-pg/1719780000000_add_doctor_shift_inventory.js
8bec795a2c55952834bb7dcc67cbad24ea4847cb74ba02ce901e43522a61759b  backend/scripts/seed-local-multi-clinic.cjs
14c10454cb815251f13f952912eba5e0662033b15ee28329411834d0bf8049a3  backend/scripts/synthetic/fixture-database.cjs
8c2671e0c79be1fc3b780897a33082a686100cd1007ac06bba4217fa010e8721  backend/scripts/synthetic/read-dataset.py
21059f7274557169389235125a9fb0856961b85d0abdbe489e9ee9bd1d471650  backend/scripts/synthetic/reset-fixture.cjs
3c335fbb577bbcd13cba35de1ae559efb9da0296a2fc577f906a08edea658808  backend/scripts/synthetic/reset.test.cjs
19fbbad80c1fb0fa8c235de0941d07b394b6c3317dd83ca5ecbc8b79bc113403  backend/scripts/synthetic/seed.test.cjs
fa4faca95d6a4479602f306b6a14d4986b15a2c70c4b7a18e00e222dd8ca4f7a  backend/src/booking-core/clinic-schedule.controller.ts
749e0338876c5665024bf267c1171744b00ff9f43c3ccf37e90c9f4b9963344a  backend/src/booking-core/clinic-schedule.service.ts
6a89d20fbf3a3bd2d4f6bf4e9f26f1cc082662f4f2275cff849d2f3cf56dea19  backend/test/doctor-shift-inventory.integration-spec.ts
f4a88a9f85cb546349c13a330b75b892d57edfa3bee288fe67a5ce6d19b1c976  backend/test/synthetic-schedule-import.integration-spec.ts
f6e53b7363a3c6c7aacba3a1e82ed907b6c84bf8148b35304c5350576989c28f  dev/synthetic-multi-clinic/README.md
9c81c659e79095e8bd1785a4564e489f6df5534ad155d03e79af45ebfb3ac07d  dev/synthetic-multi-clinic/env.mjs
e9ef2547e4b67a8157a578a3622374e489f9982a474f63d2b88931e926b19c9c  dev/synthetic-multi-clinic/expire.mjs
6bedf7b8f1c4674f05f8ba82a7d42c23c685a2a125cf2b45a9e1a03c9deca74b  dev/synthetic-multi-clinic/history.mjs
95ab3946eccdce80f5423e9b1d321bf2b46e4f0376229a1de85edd6b1d652a1b  dev/synthetic-multi-clinic/identity.mjs
149ade093fda780ac3293b59b30770eccb41b174cf7255176facfc25117f59d5  dev/synthetic-multi-clinic/inspect.mjs
2eae5fa4771c9b8452750ee43c020fe9f1d6560467c0594d2241b18e2fd1c57f  dev/synthetic-multi-clinic/replay.mjs
df508d8eaa39256f47bcc2e05f941a2b2cba547c06684bc2e3f25fd21c5d3a5b  dev/synthetic-multi-clinic/reset-smoke.mjs
702adfcf0665db48f0fe277dd83030cb30160a9bb3a878f9090a4ce9f24a6a64  dev/synthetic-multi-clinic/roles.mjs
55e92b275e111fb6666a5e6635dc00e749ad198ecb205bbe1397122ea4590f7d  dev/synthetic-multi-clinic/run.mjs
3c0d5b2a3cc2a4ccdc54c97d3e68b6bd423a7e11ddf65402f4a4e6dff9bd92f9  dev/synthetic-multi-clinic/shifts.mjs
8b24ca07b3176823309ad89228f22eb89292d6ab384345e9bd2ce53dbc033c52  dev/synthetic-multi-clinic/snapshot.mjs
1b24d013ae24d39eb3ac3289650da4c675e825abc2ecfedfe11518dd6f90b636  dev/synthetic-multi-clinic/start.mjs
d2af601a9e4f4d5afbafd2dfc6b89ade502b139c5f63138bc680cfe5cd2cfea9  dev/synthetic-multi-clinic/verify.mjs
bd5c88aee78e66b2c85f2f760c0f71298e67c52f40abd12feea8f352cc38d9d4  docs/testing/DEMO-ACCOUNTS.md
b40731347af89e4d22ab06725f30995880e07c9d532d9a50fc75f37b37fe7dd8  docs/testing/SYNTHETIC-DATA-MAPPING.md
```

### Final local evidence SHA256

```text
ee1710e35f998eec32500d2a94d322798197c4907579fd928070e62c0d8292e7  /tmp/synthetic-reset-unit.log
1015f963823dbeafc20936394043bd4140ff75a4ff0db88f60e1540ed00544ee  /tmp/synthetic-reset-execution.log
9a34c5dd52f919fc51dceb4e011c750460370e7c1f6a9f82a79f5b7d5b5b26a8  /tmp/synthetic-reset-smoke.log
ea9272530fc384d7ec51294957878d3bb00249af0434a8d13c728f8ceb500661  /tmp/synthetic-reset-collision.log
5d2ff669a32e20ed9e5e4e20d7b4de4c457f0844f6c6f9956516a66673627045  /tmp/synthetic-before-reset-all.json
5d2ff669a32e20ed9e5e4e20d7b4de4c457f0844f6c6f9956516a66673627045  /tmp/synthetic-original-final-all.json
7777c5638a2ae4f567af2315d2b90ac8d8a77efe422e3619d48994ae2fb15373  /tmp/synthetic-shift-fresh74-final.log
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  /tmp/synthetic-shift-fresh74-checksum-final.log
cb3aafa1da41e4b3b7edb034095ce8b65b275a71a74867aad4bffe13d7818360  /tmp/synthetic-shift-upgrade.log
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  /tmp/synthetic-shift-upgrade-checksum.log
9d5587bbc3ca7365b7ffebe37a1322faab1a21589f04a53cfa6ca545f6fa7a70  /tmp/synthetic-doctor-shift-tests.log
6f28c5b1ee94438af260b8115b93eb077eba813f0ab56822f5ad75715365bb9e  /tmp/synthetic-shift-unit.log
dc9f63cbd86891fcaa9990c971d7030a102b87ac5f579d06dfff63c4a57536f9  /tmp/synthetic-before-shift-publication.json
7ee80fa5c09fde3076d8320f6524c3e87a9385fd71c0b2a40ec575d4bbdcf3c1  /tmp/synthetic-after-shift-publication.json
452006478f57be92403bdecf22b2080019fb76ec0e923f57e02d2b8207f6d393  /tmp/synthetic-native-shift-seed3.log
4fa0f064a5107c4e4682231a0f35c7333a6852e0c5cc3fa5aae30f2eea37fa99  /tmp/synthetic-native-shift-before-seed3.json
4fa0f064a5107c4e4682231a0f35c7333a6852e0c5cc3fa5aae30f2eea37fa99  /tmp/synthetic-native-shift-after-seed3.json
6341b8510470a76a679913316853bcae9abaa5acf594ad5bb153990578fc9eb1  /tmp/synthetic-shift-backend-build.log
b63eec194a44530b566744d75006cd73c9acf7a3aab2a51b83acab02e0778ce5  /tmp/synthetic-shift-portal-typecheck.log
2d457fdf4c62b68f07985aab314f903036ff1fe2c2082d23768ba82b58d7b2b5  /tmp/synthetic-shift-portal-build-final.log
77c583e1264b646ccbfa11c02d89759cab07dcf44325d29237ec24fec4180f7a  /tmp/synthetic-shift-schedule-regression.log
661b12e071e432fc05c8ae6bbf7c460c35f5b9b55acd210ee4c50ca1ae2d4cb1  /tmp/synthetic-shift-schedule-regression-final.log
ffa8407dc62b432b855c0c40d9e43917c70e16c35c97024ebcdf501cd81906d5  /tmp/synthetic-native-shift-ui-final.log
49b14166711ab9be497eec97a44225f30d7b1f81165b30718f8efa1b70695264  /tmp/synthetic-native-shift-nextday-seed.log
6c5321068122e86c5844424260a1df74247c845355c7fc655497f5ee180f8f74  /tmp/synthetic-native-shift-nextday-verify.log
effa3e16a6cf1bbd6d550791f888c3d450a66eb3cf77c2282edf1a7ac5eeebbc  /tmp/synthetic-native-shift-rollover-preservation.log
```

Final real UI screenshot SHA256 (local ignored outputs):

```text
1d034e4906ab38a1cf74f1f8efae9baee2cf2caf6c308583feff1eee9a1e6460  dev/product-batch01/screenshots/synthetic-native-shifts-desktop.png
99f8e38fb2191c232f873019d5ab6d7e53651417015bce09bc1472ecca677d6c  dev/product-batch01/screenshots/synthetic-native-shifts-mobile.png
```
