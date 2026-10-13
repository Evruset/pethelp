# Reproduction and isolation

All execution used task-owned network/PG/dependency/snapshot volumes prefixed v15-w4b03a02-i61r043p, PostgreSQL16 and Node22, cpuset0–3. Dependencies copied read-only from accepted backend dependency volume into an exclusive owned volume. No developer or retained acceptance database was reset. Only temporary owned populated-upgrade databases were dropped by their harness.

Main DB vethelp_w4b03a02_main; distinct test byte-writer login is NOINHERIT member of NOLOGIN executor role. Ordinary old-test login is not a member. Snapshot volume mounted /owned-snapshots with private700 directory. OCR_VERIFIED_BYTES_ENABLED=true only in owned execution tests; regressions use false. NODE_ENV=test, W4B03A02_ACCEPTANCE=true, WORKERS_ENABLED=false. Synthetic credentials only. Production not activated.

Executed backend package scripts: npm run migrate:up; npm run migrate:verify; npm run build; npm run openapi:export. See fresh-migrations.log/fresh-checksums.log/backend-build-final-pass.log/openapi-export.log. Migration test invokes node-pg-migrate to171976, populates accepted rows, applies171977, verifies old rows/checksums and rejected DOWN. Final catalog-verdict.json records73 migrations/checksums.

Jest --runInBand --runTestsByPath:
- test/ocr-byte-execution.e2e-spec.ts: execution32, then newly added EXTRA7, then EXTRA CONFIG1, then GUARD2. Existing accepted assertions were not rerun.
- test/ocr-byte-execution-migration.e2e-spec.ts: initial populated upgrade1; later newly added EXTRA UPGRADE1.
- test/owner-ocr-foundation.e2e-spec.ts:25 on separate vethelp_w4b_03a02_regression with W4B_ACCEPTANCE=true.
- test/owner-ocr-review.e2e-spec.ts:45 on separate vethelp_w4b02_03a02_regression with W4B02_ACCEPTANCE=true.
- src/common/document-byte-snapshots.spec.ts + src/common/pet-document-storage.spec.ts:27 with W4B03A01_ACCEPTANCE=true, owned FS.

JSON output files and gate-ledger.json retain assertion identity, actual status and latest evidence. Initial focused run compiled execution suite unsuccessfully but ran upgrade1 successfully; successful execution32 supersedes compile-only failure. Config hardening occurred afterward and has its own targeted assertion/final build; no byte-transport behavior changed. OpenAPI7 assertions validate six authenticated accepted OCR/review operations and absence of exposed proof/execution route. Generated OpenAPI bytes retained outside candidate tree; SHA is recorded in openapi-assertions.json.

141 unique PASS, zero unresolved FAIL. No T044 or unrelated sticky reruns. No source commit/push. Root sole writer; three distinct read-only reviewer domains. Two bounded repair batches: typing/pool-client fixes and encoded-login hardening. Efficiency INEFFICIENT due avoidable initial compilation failures. Source/test/document count and exact evidence count/hashes are in MANIFEST.json; cross-compaction tool/search counters are not reconstructed or claimed.
