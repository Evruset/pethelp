# Supplied25-clinic fixture, local PILOT_V1

Requires existing Node22 dependencies and Python3. Archive is the user's exact `~/Downloads/VetHelp_Synthetic_25_Clinics_Dataset.zip`, never regenerated. Use the existing isolated product worktree. No commit/push/deployment. OCR stays frozen.

The test-owned PG16 container `vethelp-product01-eg0mppwf-postgres` exposes55484. Default runnable DB: `synthetic_multiclinic_v4`. An explicitly selected reset generation uses `SYNTHETIC_DATABASE_NAME=synthetic_multiclinic_v4_r_<12 lowercase hex>` for every launch/auth/verify command; other database names are rejected. Original Batch01 DB and earlier incompatible diagnostic DB are retained. Do not use the default docker-compose local seed against a developer/acceptance DB. No external notification transport; WORKERS_ENABLED=false.

```sh
export PATH=/Users/evrusetskiy/.nvm/versions/node/v22.22.2/bin:$PATH
# From product worktree root. Select the verified retained reset generation.
export SYNTHETIC_DATABASE_NAME=synthetic_multiclinic_v4_r_4f809ec21a36
# Guarded wrapper supplies only public local demo settings.
node dev/synthetic-multi-clinic/run.mjs backend/scripts/seed-local-multi-clinic.cjs validate "$HOME/Downloads/VetHelp_Synthetic_25_Clinics_Dataset.zip"
node dev/synthetic-multi-clinic/run.mjs backend/scripts/seed-local-multi-clinic.cjs seed "$HOME/Downloads/VetHelp_Synthetic_25_Clinics_Dataset.zip"
node dev/synthetic-multi-clinic/run.mjs backend/scripts/seed-local-multi-clinic.cjs verify "$HOME/Downloads/VetHelp_Synthetic_25_Clinics_Dataset.zip"
node dev/synthetic-multi-clinic/start.mjs
# Separate terminal; read account registry for all620 choices.
node dev/synthetic-multi-clinic/inspect.mjs owner0001@example.test
node dev/synthetic-multi-clinic/inspect.mjs clinic_admin.clinic01@example.test
node dev/synthetic-multi-clinic/inspect.mjs receptionist.clinic01@example.test
# A veterinarian login is listed in docs/testing/DEMO-ACCOUNTS.md.
```

Owner: http://localhost:8090; Clinic: http://127.0.0.1:3320; actual Nest backend3310. `inspect.mjs` opens a real authorized browser; close it to end. Owner sessions are explicitly local fixture sessions, not claimed OTP/provider authentication. Staff JWT fixture tokens contain only one stored clinic/location; DB ABAC remains authoritative.

Fresh recreation uses the explicitly confirmed `reset-fixture` workflow below and the latest74 additive migrations. The original `synthetic_multiclinic_v4` is protected against seed writes. Existing DBs are never dropped, emptied or overwritten. Backend build must match current source; Clinic uses accepted Next build, Owner Expo web runs source. No alternate backend or fake JSON responses.

Replay reproduces260 source booking examples through real commands and accepted deadlines. Original476 events/timestamps remain restricted reference data; native events use actual DB time. On a fresh seeded fixture, stage expiry examples first, wait for the unchanged15minute DB TTL, then process terminal decisions before pending requests to respect FIFO:

```sh
node dev/synthetic-multi-clinic/replay.mjs --expired-stage
node dev/synthetic-multi-clinic/expire.mjs
node dev/synthetic-multi-clinic/replay.mjs --terminal-only
node dev/synthetic-multi-clinic/replay.mjs
node dev/synthetic-multi-clinic/history.mjs
# Mutating fresh acceptance harness, not a seed prerequisite:
node dev/synthetic-multi-clinic/verify.mjs
node dev/synthetic-multi-clinic/roles.mjs
node dev/synthetic-multi-clinic/run.mjs --test backend/scripts/synthetic/seed.test.cjs
```

Replay skips already mapped bookings and never restores original statuses. `history.mjs` reconciles initial replay against source decisions, exact Owner/Pet/location/service, terminal audit/outbox, appointments and slot counters; later intentional manual changes may correctly fail initial-state comparison. `expire.mjs` requires exactly43 staged examples and expires only eligible holds through the existing worker in the exclusive fixture DB. No forged deadlines. Pending requests continue to have normal lifetimes; workers are disabled by default, so run the existing expiry worker when testing later elapsed-state behavior.

The verifier performs real authorized mutations/QA bookings in this exclusive synthetic DB; it is not read-only. `snapshot.mjs` is read-only and supports before/after seed comparison. `reset-fixture` implements the Product Owner's explicitly chosen non-destructive reset: a **new empty database**, fresh migrations/checksums and seed/verify. All previous DB data, history and sessions remain in the previous DB. It does not clone unrelated data or sessions and does not switch running processes. Choose a unique12hex suffix (the example below is already used):

```sh
SYNTHETIC_DATABASE_NAME=synthetic_multiclinic_v4 node dev/synthetic-multi-clinic/run.mjs backend/scripts/seed-local-multi-clinic.cjs reset-fixture "$HOME/Downloads/VetHelp_Synthetic_25_Clinics_Dataset.zip" --confirm-namespace=VETHELP_SYNTHETIC_25_V1 --new-database=synthetic_multiclinic_v4_r_4f809ec21a36
# Only after PASS, stop the old synthetic demo processes if they occupy the same ports.
# The old database remains intact. Apply the selector to inspect/replay/verify commands too.
SYNTHETIC_DATABASE_NAME=synthetic_multiclinic_v4_r_4f809ec21a36 node dev/synthetic-multi-clinic/start.mjs
SYNTHETIC_DATABASE_NAME=synthetic_multiclinic_v4_r_4f809ec21a36 node dev/synthetic-multi-clinic/inspect.mjs owner0001@example.test
```

The operation requires the exact namespace flag and test-owned PostgreSQL55484/product_demo. Existing target names fail closed, including a repeat of the example. Failure retains the new DB for diagnosis and leaves the old DB active; there is no DROP/DELETE/TRUNCATE or automatic cleanup. No deletion/retention authority is inferred. Fresh seed retains260raw source bookings but creates no native booking history; use the separate real-command replay workflow if desired. Reset tests: `node dev/synthetic-multi-clinic/run.mjs --test backend/scripts/synthetic/reset.test.cjs`; fresh-generation API smoke: `SYNTHETIC_DATABASE_NAME=<new-generation> node dev/synthetic-multi-clinic/reset-smoke.mjs` (owns temporary backend3311, requires port free, mutates only the selected new fixture).

Rolling publication uses the PostgreSQL Moscow calendar tomorrow through14days. Canonical doctor+actual-start keys preserve existing slots on overlapping days, append only missing future days, retain old booked/history windows. Native3500 DoctorShift rows are published independently of slots through bounded internal Scheduling transactions; raw original source shifts are retained. Clinic Schedule displays read-only shifts and exact Moscow time, using its existing date/doctor filters and Admin/Reception permission. No new public shift mutation API, automatic slot generation, doctor assignment contract or clinical record is added. Migration171978 requires PostgreSQL btree_gist; doctor/staff location composite FKs and half-open overlap exclusions are enforced in DB. Populated schema rollback refuses data loss; roll back consumers and retain inventory.

Focused new-generation API/UI check: `node dev/synthetic-multi-clinic/shifts.mjs`. Actual screenshots: `dev/product-batch01/screenshots/synthetic-native-shifts-{desktop,mobile}.png`.
