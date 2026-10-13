# Wave4A regression reconciliation

## Status and provenance

### Acceptance reconciliation and commit preparation — 2026-10-11

Decision **RECOMMENDED_FOR_HUMAN_APPROVAL**,human resource-profile approval **PENDING_EXPLICIT_OWNER_SIGN_OFF**. No owner approval inferred from technical recommendation or machine PASS. Raw three full logs re-read:9/9 PASS each,zero skipped,B600.59/666.48/753.18ms,D100/100 initial successes; capacity/idempotency/audit/outbox/deadlock/pool/consistency PASS. Actual4CPU/8221097984bytes/Node22.23.1/PostgreSQL16.14,unchanged20/700/50/250 pool/timeouts; original1CPU failures separate/unresolved. No new test executions.

Durable candidate evidence: `docs/testing/evidence/wave4a-t044-20261011-4cpu/manifest.json`,SHA256SUMS,README,commit-plan.md and24 raw files. Three psql outputs use lossless UTF8 JSON wrappers retaining original text/checksums,not summaries,avoiding Git whitespace errors. All other selected raw bytes unchanged; per-file checksum/original mapping included. Legacy static oneCPU report prose superseded by actual structured CPU fields,not edited. Measured source base bd9d2c1/dirty SHA256889379032d8f2cd1b36bb2f3bdaa16f5771c1ce7b1b3bb6f90f586a7f21fff2f; all five source hashes match current tree.

Per-file pending classification in `.artifacts/wave4a-t044-commit-preparation/20261011-01/inventory.json`: four test files ACCEPTED_TEST_FIX (performance mixed with OPTIONAL_DIAGNOSTIC hunks),reconciliation/evidence DOCUMENTATION,profiler OPTIONAL_DIAGNOSTIC,./..../temporary artifacts/exports LOCAL_ARTIFACT,no UNEXPECTED. Propose3 bounded commits: historical cutoffs(3 tests),T044 identity assertions(partial-hunk patch),documentation/evidence. Exact34-file candidate/commands in commit-plan.md;index empty. All original dirty work/hooks/artifacts and approved empty untracked non-symlink ./.... preserved.

Scoped review retains historical DOWN/checksum fences,negative/cardinality checks,indexed authoritative identity semantics and performance assertions. No production/migration/threshold changes. Unset diagnostics loads no module/observer/wrapper/probe; optional awaits add microtasks outside measured path,not literal zero execution difference. Arbitrary module path requires trusted test configuration. Opt-in substring DB guard is not parsed fail-closed validation; failed start/finish may prevent cleanup; wrappers assume disposable process. Diagnostic outputs omit raw SQL parameters/business values/tokens. Targeted private-key/token/credential-URL/JWT/email scan of28 selected evidence/docs/hook inputs:0 matches,not final Security/Privacy review. Preserve diagnostics but exclude all hook hunks,profiler and exports from accepted commits; no fixes implemented to them.

Proposed accepted test SHA25602da614fbca7c34ed26d3494ab6640d5660a077dad3fd30d15ce6da48f1f9bbc differs from measured7cf3c680872f0493a6d429aa41a8395df73268c6fe2678d81f75d37f581d13d3. Selection patch --check applies to empty index only;not staged. Final selected-source isolated validation required before commit;not claimed from disabled-hook equivalence alone. Branch/local/remote bd9d2c1 equality;WORKING TREE DIRTY. No commit/push,production/released-migration/dependency changes,consolidated regression,OCR,final reviews,Jira/Confluence/main. Wave4A PARTIAL. STOP pending owner profile/scope sign-off. Root-only,no agents/parallel writers/test reruns;efficiency ACCEPTABLE (bounded evidence packaging corrections).

### T044 resource control resumed — 2026-10-11

Verdict **RESOURCE_PROFILE_PASS_PENDING_HUMAN_APPROVAL**. Three newly executed full suites in unique project `pethelp-wave4a-t044-control-20261011a`, new dedicated volume, migrated/checksummed fresh template through171973 and independent DBs `t044_control_11a_run1/2/3`. Actual Node22.23.1/PostgreSQL16.14 containers see4CPU/cpuset0-3,cpu.max=max100000,memory8221097984 bytes. Prior unavailable Docker preflight retained below as historical; current preflight operational with no competing T044. Retained services stayed stopped as found; original IDs/states and volumes preserved. Retained database health/content not tested while stopped; no connections or writes to them.

|New full run|B p95 ms (<=2000)|D initial successes|D p95 ms|PASS/FAIL/skipped|Correctness|
|---|---:|---:|---:|---|---|
|1|600.59|100/100|157.59|9/0/0|PASS|
|2|666.48|100/100|152.56|9/0/0|PASS|
|3|753.18|100/100|177.12|9/0/0|PASS|

All nine definitions each;27 passed executions of9 unique tests. Capacity B5 holds/audits/events,D1 mutation/audit/event,stable replay100/100,changed fingerprint IDEMPOTENCY_CONFLICT,drift/overbooking0,post-profile pool in-use/waiting0,global deadlock/leak/stuck/unexpected gates PASS. Final PostgreSQL deadlocks/temp bytes0,no idle-in-transaction clients; Node throttling/OOM/restarts0. Canonical pool20/connection700ms/lock50ms/statement250ms/B30-capacity5/D100 and assertions unchanged,no extra retries. Hooks retained but diagnostic module/directory unset; no in-process instrumentation. External separate PG observer500ms and Docker resource timeline only, bounded external observation load.

Baseline comparison: accepted2026-08-13 B1064.81ms/D100; latest current uninstrumented1CPU full B2049.60ms/D65,7/2/0; hash-matched historical source own171953 schema outcome-only B2386.61/2320.20/2841.18ms,D52/88/68. Historical latest-schema instrumented controls B3584.36/3323.08/3170.40,D57/54/70 remain diagnostic,not canonical acceptance. Previous2026-10-09 repaired4CPU3/3 PASS retained separately. All5 historical source hashes match76cfae,not proof full baseline dirty binary/environment reproduced.

Fresh active-PID samples most frequently see Slot tuple waits44/20/47,ungranted Slot tuple samples41/17/47; transactionid10/3/3,WALSync3/3/1 observed. These are sparse frequencies across whole suites,not wait durations or per-profile causal rankings. Full per-phase comparison in new baseline-comparison.md separates previous measured pool/transaction/idempotency/Pet/Slot/Clinic/Node timings from fresh uninstrumented limitations. IO and WAL timing off; zero recorded timings do not prove zero storage cost. No failing bottleneck on4CPU; original1CPU requirement and exact environmental-versus-implementation causal attribution remain unresolved. Not ENVIRONMENT_BLOCKER_PROVEN or PRODUCT_FIX_CANDIDATE,not1CPU acceptance restored.

Evidence `.artifacts/wave4a-t044-resource-control/20261011-4cpu-01/`: environment-manifest.json,source-hashes.json,dirty-source.sha256,preservation-verification.json,baseline-comparison.md,summary.json,final-classification.md; per-run full Jest JSON/logs,results/latency quantiles,PG waits/locks/WAL counters,Node cgroups and external resource timeline. Raw request latency arrays/per-phase durations not fabricated; latency distributions represented as canonical quantiles. Generated legacy one-CPU report prose is static; actual structured CPU fields authoritative.

Fresh fetch verifies branch/local/remote `agent/v15-transition-wave-01`/`bd9d2c1fab893c1bb7ee72de887fe82d826be38b`. WORKING TREE: DIRTY; approved0-byte untracked non-symlink ./.... preserved. Six dirty files and498 previous artifacts hash-verified before additive doc updates. No production/migration/dependency/commit/push/Jira/Confluence/main changes. Root-only continuation,0 agents/parallel writers/repair cycles; efficiency EFFICIENT. Next: human performance-gate decision on4CPU profile versus retained1CPU requirement. Consolidated regression/fresh Security/Independent reviews NOT RUN;Wave4A PARTIAL,Wave4B/OCR NOT STARTED. STOP.

### T044 controlled-resource continuation — 2026-10-11 preflight blocked

New request classification **UNDETERMINED**, execution state **BLOCKED_TOOLING**. Fresh fetch branch/local/remote verified at `agent/v15-transition-wave-01` / `bd9d2c1fab893c1bb7ee72de887fe82d826be38b`. WORKING TREE: DIRTY. Docker Engine cannot be reached: desktop-linux context socket `/Users/evrusetskiy/.docker/run/docker.sock` is missing. Actual entitlement/memory, competing container T044 runs and retained-container/database health cannot be verified; default zero values from failed docker info are not measured CPU entitlement. No Docker Desktop/service configuration changes, retained-service mutation or new Compose project/DB attempted. No competing host Jest/T044 command observed in targeted process check; this does not establish container-level absence.

Evidence `.artifacts/wave4a-t044-resource-control/20261011-preflight-01/` contains REPORT.md,environment-manifest.json,source-hashes.json,preserved-diagnostics-inventory.json,docker-info.log,docker-contexts.log and git status. Existing diagnostic files/hooks and six dirty files preserved; approved zero-byte regular non-symlink untracked `./....` preserved. No production/threshold/retry edits or commit/push. Three newly requested full suites **NOT RUN**; B/D distributions, PostgreSQL lock/wait and resource timeline **NOT COLLECTED** due unavailable runtime. Prior2026-10-09 full-series PASS and2026-08-13/1-CPU/hash-matched historical controls remain historical evidence below, not new results. No new dominant bottleneck or causal conclusion is established; original1-CPU acceptance remains unresolved.

Next minimum action: manually restore Docker, reverify4 CPUs/~8.2GB and retained-resource safety, then run three fresh canonical suites in unique test-owned Compose resources. If measured CPUs<4, return RESOURCE_CHANGE_REQUIRED without automatic configuration changes. Wave4A PARTIAL; Wave4B/OCR NOT STARTED. No consolidated regression or fresh final Security/Independent Review before human performance-gate decision.

### T044 Controlled Resource Acceptance — 2026-10-09

Verdict: **RESOURCE_PROFILE_PASS_PENDING_HUMAN_APPROVAL**. Wave4A remains PARTIAL; Wave4B/OCR NOT STARTED. No consolidated regression, Security/Privacy or Independent Review started. No commit/push, production/migration/dependency changes, Jira/Confluence or main mutation.

Branch/base/local/remote verified after fetch: `agent/v15-transition-wave-01` / `bd9d2c1fab893c1bb7ee72de887fe82d826be38b`. WORKING TREE: DIRTY. Explicit user exception `./....` verified as regular, non-symlink,0-byte,Git-untracked and outside tracked build/test/config references and configured backend input roots. Preserved unchanged, not ignored/staged. SHA-256 checks of all six pre-existing dirty files PASS before these additive documentation entries; diagnostic hooks and all previous artifacts retained.

New project `pethelp-wave4a-t044-4cpu-20261009e` owns a new PostgreSQL volume and fresh migrated/checksummed template `t044_4cpu_09e_base` through171973. Each full run uses an independent one-off Node container and fresh clone DB `t044_4cpu_09e_run1/2/3`. Dependency volume reused read-only. Developer/retained projects and DBs untouched. Actual PostgreSQL16.14 and Node22.23.1 containers report4 available CPU,cpuset0-3,cpu.max=max100000; no project CPU quota or memory cap. Diagnostic module/directory explicitly unset. Resource snapshots execute only before/after Jest, no observers or wrappers inside measured path. Exact test invocation: `npm test -- --runTestsByPath test/booking-core-performance.integration-spec.ts --passWithNoTests=false --json --outputFile="$T044_EVIDENCE_DIR/jest-results.json"`.

Canonical pool20,connection700ms,lock50ms,statement250ms; B30 contenders/capacity5,D100 same-key requests and every correctness/threshold assertion unchanged. No additional retries. All nine tests run without selectors/skips.

|Full run|B p95 ms (limit2000)|D initial successes|D p95 ms|Passed/failed/skipped|Correctness|
|---|---:|---:|---:|---|---|
|1|847.74|100/100|204.09|9/0/0|PASS|
|2|789.47|100/100|194.18|9/0/0|PASS|
|3|743.84|100/100|211.26|9/0/0|PASS|

All capacity,idempotency,audit,outbox,deadlock,pool,consistency assertions PASS. B exactly5 holds/events/audits,25 capacity conflicts; D exactly1 hold/event/audit,100 stable successful initial responses,exact post-burst replay,changed fingerprint IDEMPOTENCY_CONFLICT; overbooking/counter drift0,post-profile pool in-use/waiting0. Global hard gates PASS in each full suite. PostgreSQL final state confirms deadlocks0,temp_files/bytes0,no idle-in-transaction connections. Node cgroup throttle deltas0,OOM events0,containers restart0. Node cumulative CPU time31.138/28.473/27.987s over29.624/26.971/26.125s snapshot windows (105.11/105.57/107.13% of one CPU, not a peak or per-burst metric). Raw pressure,memory,IO and PostgreSQL before/after counters retained. No fabricated event-loop or peak measurements.

Historical2026-08-13 B1064.81ms,D100/100; latest current-source uninstrumented1-CPU full B2049.60ms,D65/100,7 PASS/2 FAIL/0 skipped. New4-CPU profile passes3/3. This is measured resource-sensitive recovery under the repaired environment, not proof CPU count alone explains every AVF/background/storage change, exact historical binary reproduction or production SLA. Generated per-run REPORT.md and results interpretation retain static old one-CPU prose; actual environment.cpuCount and snapshots are authoritative and prove4 CPU. Historical dirty-source provenance limitations remain as documented below.

Evidence root: `.artifacts/wave4a-t044-resource-acceptance/20261009-4cpu-01/`: PRECHECK.md,summary.json,preserved-files-before.sha256,dirty-snapshot.sha256,fresh-migrations.log,postgres-precheck.log,postgres-container.json,postgres.log; each run-N contains results.json,REPORT.md,jest-results.json,jest.log,exit-code.txt,container.json,node-resources-before/after.json,postgres-resources-before/after.txt,postgres-final-state.txt,database-create.log. Post-run summarize.cjs validates all nine results,canonical thresholds and recorded B/D effects; not a total test launcher. Root-only continuation,0 agents/parallel writers/repair cycles; efficiency EFFICIENT (three repeats explicitly required, no repeated unrelated sticky gates).

Next action: human performance-gate decision on the4-CPU resource profile; do not start consolidated regression/final reviews/OCR before that decision.

### T044 root-cause investigation — 2026-10-09

Precheck fresh fetch/branch/local=remote PASS at `bd9d2c1fab893c1bb7ee72de887fe82d826be38b`. All six existing dirty files preserved; no unexpected changes. Task brief: diagnostic-only timing/resource/blocking and historical source comparison, no threshold/timeout/retry relaxation or production fix. C3/R3 complex scope, root only writer; one read-only source/measurement specialist, no parallel writers. Historical5/5 migration evidence REUSED_STICKY_PASS, not reopened. Final classification **UNDETERMINED**; Wave4A PARTIAL/FIX_REQUIRED; Wave4B/OCR NOT STARTED.

Evidence root: `.artifacts/wave4a-t044-diagnostics/20261009-t044-01/`. Required environment/source/pool/transaction/wait/B/D/full-suite artifacts and `diagnosis.md` present; raw per-run logs/timelines preserved. Artifacts and exported historical source are test-owned, outside committed source. New repository changes in this task are opt-in hooks in the existing T044 test and additive documentation only. No production, migration, OpenAPI, dependencies, commit/push, total launcher, Jira/Confluence or main change.

Baseline provenance repaired: accepted2026-08-13 source evidence named cleanHEAD62efdc plus dirty hashf2dcf692. The T044 test is absent in clean62efdc. All five recorded source hashes exactly match76cfae8391bd5cf36df148bea1502b90209e6348, permitting isolated hash-matched source export, not recovery of the entire dirty binary/configuration/environment. Accepted B1064.81ms/D100-success values remain historical observations; reported CPUcount1 alone is not resource equivalence.

All runs use a new exclusive Docker project `pethelp-wave4a-t044-20261009d`, fresh databases with owned prefix `vethelp_wave3_t044_09d_`, serial heavy workloads, Node22.23.1/PostgreSQL16.14, PILOT_V1/test/workers disabled; canonical pool20/connection700ms/lock50ms/statement250ms and unchanged30-contender capacity5/100 same-key requirements. Latest template171973 and historical export's own58-migration schema through171953/checksums PASS are separate contexts. No developer/retained database or background service reset/stop/mutation.

|Experiment|B p95 ms|D successful /100|Result|
|---|---|---|---|
|B alone, instrumented three runs|3316.75 /4007.75 /4174.45|—|All FAIL; five holds/events/audits,25 capacity conflicts each|
|D alone, semantic-replay verified three runs|—|46 /53 /63|54 /47 /37 SLOT_LOCKED_RETRY; other errors0; all FAIL|
|Current instrumented B→D|3468.97|79|FAIL|
|Current normal full, instrumented|2287.61|75|7 PASS/2 FAIL/0 skipped,30.149s|
|Current uninstrumented B alone /D alone|2472.82|43|FAIL|
|Current uninstrumented B→D|3364.49|50|FAIL|
|Current normal full, uninstrumented|2049.60|65|7 PASS/2 FAIL/0 skipped,35.373s|
|Hash-matched historical source/latest schema, instrumented3|3584.36 /3323.08 /3170.40|57 /54 /70|All FAIL|
|Historical source/own171953 schema, outcome-only controls3|2386.61 /2320.20 /2841.18|52 /88 /68|All FAIL, no observer/query wrappers|
|Historical source/latest schema, outcome-only control|3384.05|100|B FAIL/D PASS; not current acceptance|

There were22 focused executions, not22 unique suites or consolidated regression. Raw repeated-case counts:15 passed/32 failed/151 selector-skipped entries (198 entries across22 nine-definition attempts). No test definitions disabled; both full current runs executed all9 without skips. Current full canonical uninstrumented run remains7/9 FAIL, not converted by later replay or a historical D success. Original historical matrices and543-test failure snapshot remain distinct.

Proximate failures are measured: B b3 requires409 attempts for30 calls (median16/max18),356 slot-lock55P03 plus one57014, pool acquisition p95=187.82ms, slot round-trip p95=136.22ms. D verified run1's54 public retries partition into20 INSERT55P03,20 replay SELECT55P03 and14 pool-acquisition timeouts. Pool acquisition p95=704.62ms; idempotency INSERT p95=97.11ms/SELECT p95=93.60ms; first-writer transaction443.72ms (other verified runs336.57/328.88ms). Blocking idempotency insertion until COMMIT, serialized replay FOR UPDATE, slot retries and pool backlog are observed. Pool max waiting B10/D80, final in-use/waiting0. PostgreSQL transactionid/tuple waits with up to17 blockers; deadlock deltas0. Identical post-burst retry returns semantically exact original response and still one hold/event/audit; original failed100 burst remains FAIL.

Resources: Docker VM1 CPU/8221847552 bytes; backend/PG cgroup cpu.max=max100000, quota-throttle counters0, no memory quota/OOM events, PG restarts0. Sampled burst Node CPU share~41.8–54.7%, CPU pressure~57.1–73.7%; D event-loop p95~24.84–31.46ms, maxima~78.58–225.97ms, session ELU~78.3–83.8%. Background consumers observed, untouched. PG data uses new local Docker volume; source bind mount/dependencies read-only. track_io_timing=off; WALSync/DataFileExtend observed, but exact storage contribution NOT MEASURED. Query timings include scheduling/waits;25ms server sampling is not exact per-query lock duration, stats include observer and IO stats are cluster-wide. Instrumented timings exceed some controls, but both gates fail without instrumentation.

Source comparison: compatible clinic/location SHARE locks, JS-only fail-closed policy and one extra exhausted-capacity active-hold SELECT versus hash-matched source; unchanged DatabaseService/pool/BookingRepository/retry helper. Current fixtures are ACTIVE/MVP_V1_MANUAL by canonical defaults; no auto-confirm work is attributed. Historical clinic phase is a plain SELECT, not a FOR SHARE lock. No causal proof links new locks/query reorder to the observed degradation: historical source also fails on its own schema under current resources. Conversely, missing historical quota/background/storage measurements and lack of a controlled resource correction prevent an ENVIRONMENT_CAPACITY_BLOCKER verdict. No original test-harness defect has been established.

Bounded diagnostic repairs only: initial JSON property-order replay flags were invalid and are superseded by three semantic d_verify checks; later pooled queries inheriting an ended async context are excluded from summaries by request bounds, final wrapper guards ended requests. Earlier raw files are preserved. Neither repair relaxes original assertions or explains the original B/D gate failures. Scoped read-only source and wrapper reviews PASS with these measurement caveats; not final Wave4A reviews.

STOP with UNDETERMINED. Prioritized next comparison: dedicated same1-CPU workload without competitors or separately provisioned>=2-vCPU runtime, retaining all canonical settings; then bounded server IO/statement timing to separate scheduler/storage cost; then source/protocol comparison if failures persist. Stopping retained services or altering Docker Desktop global resources requires separate authority and was not attempted. No production fix or threshold/timeout relaxation is justified. Consolidated Wave1–4A and fresh final Security/Independent gates remain NOT RUN; no remote-backed accepted performance checkpoint exists.

### Final regression corrections — 2026-10-09, remote-backed bd9d2c1

Fresh fetch and branch/equality precheck PASS: BASE/local/remote=`bd9d2c1fab893c1bb7ee72de887fe82d826be38b`, branch `agent/v15-transition-wave-01`. Exactly the two existing documentation changes were present and preserved. This continuation supersedes the earlier six remaining historical/index assertion failures below; it does not convert any historical diagnostic count into consolidated acceptance.

Four test-only corrections: foundation UP pins171972 and pre-Amendment UP pins171971; contract-profile copier ends171968; cardinality proves171968→171969+fixture→171970 before a separate latest upgrade; performance validates actual authoritative identity access using the constraint-backed unique B-tree catalog and raw EXPLAIN rather than a physical index name. The catalog returns `text[]` explicitly, and the unchanged all100-success assertion now reports failing codes/latencies. No production, generated contract or released migration diff. All immutable/negative/cardinality/checksum assertions, four historical DOWN calls and performance thresholds remain enforced. Read-only scoped four-file review and follow-up delta review PASS; these are not final Wave4A gate reviews.

Exclusive Docker project `pethelp-wave4a-final-reconcile-20261009c`, PostgreSQL16.14/Node22.23.1, container CPU count1, application pool20. Fresh empty latest/checksum template `vethelp_wave4a_reconcile_base_09c`; owned clones `vethelp_wave3_reconcile_09c_{history,performance,performance2,adjacent,perf_b,perf_d}`. Historical migration suites create/drop only their own random temporary DBs. Workers disabled; NODE_ENV=test, MVP_SCOPE_PROFILE=PILOT_V1, WAVE4_ACCEPTANCE=true. No developer/retained acceptance database reset, mutation or localhost fallback. Heavy acceptance runs serial. Existing dependency volume reused read-only only. Logs/evidence: `/tmp/pethelp-wave4a-final-reconcile-20261009c/`.

|Check / log|Actual result|Duration|
|---|---|---|
|Foundation independently, historical-1.log|1 suite;2 PASS/0 FAIL/0 skipped|44.357s|
|Clinic profile independently, historical-2.log|1 suite;2 PASS/0 FAIL/0 skipped|26.202s|
|Cardinality independently, historical-3.log|1 suite;1 PASS/0 FAIL/0 skipped|34.555s|
|All three historical suites, historical-combined.log|3 suites;5 PASS/0 FAIL/0 skipped|52.240s|
|First full performance, performance.log|1 suite;6 PASS/3 FAIL/0 skipped|48.763s|
|Corrected catalog full performance, performance2.log|1 suite;7 PASS/2 FAIL/0 skipped|50.227s|
|B standalone fresh DB, performance-b-isolated.log|0 PASS/1 FAIL;8 diagnostic-selection skips|26.700s|
|D standalone fresh DB, performance-d-isolated.log|0 PASS/1 FAIL;8 diagnostic-selection skips|22.645s|
|B/D on fresh pre-sharing171972, performance-171972.log|0 PASS/2 FAIL;7 diagnostic-selection skips|30.457s|
|Populated171972→171973 + closed sharing contract, adjacent.log|2 suites;27 PASS/0 FAIL/0 skipped|29.487s|
|Fresh latest/checksum verification; adjacent checksum verification|PASS|baseline.log;checksums.log|
|Backend build; OpenAPI export + canonical/BP-11/Owner/Clinic assertions|PASS; regenerated tracked artifact unchanged|build.log;openapi.log|

The first performance attempt had an additional new test-harness array-decoding defect (`name[]` produced string `{id}`); explicit `a.attname::text` fixed it. The second full run proves PK(id), valid/ready UNIQUE B-tree(id,clinic_location_id), actual Index Scan conditioned on the fixture id, one row/one loop. Slot plan uses `appointment_slots_clinical_location_key` (0.055ms), idempotency uses `idempotency_records_scope_idempotency_key_key` (0.093ms), expiry uses `booking_holds_manual_confirmation_sla_idx` (1.659ms). Raw JSON/catalog/source hashes retained in `performance2/results.json` and REPORT.md. These index checks PASS, not generic index existence.

Two engineering failures remain, not the previous stale-index assertion: B p95=2065.11ms then2454.57ms against unchanged2000ms; standalone B=5038.26ms. D violates unchanged100/100-success requirement:22 SLOT_LOCKED_RETRY responses in second full run,85 in standalone D. Full-run global hard gates for deadlocks, pool leaks, stuck transactions and unexpected failures PASS, but B/D abort before their later evidence assertions, so no complete D mutation/replay acceptance is claimed. Diagnostic selection skips8+8 are explicit, not disabled definitions or mandatory exclusions; two full9-test runs were executed without skips.

PostgreSQL server diagnostics in `postgres-timeouts.log` identify lock timeout while inserting an index tuple in `idempotency_records`, at the actual INSERT ... ON CONFLICT statement. Existing production interactive limits remain50ms lock/250ms statement. Both failures reproduce without preceding suites or reused populated fixture DBs. A fresh pre-sharing database `vethelp_wave3_reconcile_09c_perf_171972` was migrated explicitly through171972 with checksum write/verify PASS; ledger confirms171972 count1/171973 count0. Under the same source, project, profile and resources, B/D also fail before171973: B p95=4888.55ms; D28 SLOT_LOCKED_RETRY responses of100. Thus171973 is not necessary to reproduce either failure. This does not prove environment matched to the older successful T044 snapshot, a harmless variation, or a genuine Product regression. Cause remains UNDETERMINED; thresholds, retry behavior and all-success requirement are not relaxed.

Next bounded action: instrument the performance-only harness for pool acquisition/transaction timing and correlate PostgreSQL lock waits without changing product logic, then compare against the prior successful resource/source snapshot. If meeting the hard gates requires a production idempotency/timeout change, return an evidence-backed PRODUCT_REGRESSION/bounded-fix proposal before implementing it. No new total launcher or baseline relaxation is authorized. Diagnostic selectors above account for23 raw skipped entries across three runs; every test definition still ran in the two full9-test attempts. Consolidated counts/profiles/order-independent acceptance remain NOT RUN, not PASS.

Current verdict FIX_REQUIRED. No new commit/push: focused acceptance is not all PASS, so the conditional commit/remote gate is not satisfied. Full consolidated Wave1–4A regression NOT RUN; existing accepted client evidence remains sticky, not refreshed final acceptance; fresh final Security/Privacy and Independent Review NOT RUN. Wave4A PARTIAL; BP-11 MATCH_WITH_KNOWN_DATA_GAP (Owner displayName:null); BP-12 MATCH; Wave4 overall PARTIAL; Wave4B/OCR NOT STARTED. Jira/Confluence unchanged; no main merge or total launcher.

### Continuation at remote-backed 35d3b9f — 2026-10-08

Fresh fetch PASS; local=remote=`35d3b9f7471c5ff701b7fb2fa00d2a62b1640b4e`; exactly the two existing documentation changes preserved. This supersedes earlier pending recovery-push notes, without discarding historical evidence.

Task brief: reconcile original18 suites using supported profiles and owned Docker DB boundaries; preserve all Product/security assertions; make bounded test-only corrections, each accepted commit immediately push/fetch/equal; STOP on proven Product defect or rejected push. No total launcher, released migration changes, OCR, Jira/Confluence or main merge. Original543 is historical, not a new test count. C3/R3 complex budget, root only writer; bounded read-only migration/runtime audits reused for independent source diagnosis, not final gate reviews.

Exclusive project `pethelp-wave4a-reconcile-20261008b`: fresh empty latest/checksum baseline `vethelp_wave4a_reconcile_base_08b`, cloned to16 uniquely named `vethelp_wave3_reconcile_08b_N` databases before executing each suite. No developer or retained acceptance reset. Actual Nest profile PILOT_V1, NODE_ENV=test, WORKERS_ENABLED=false, WAVE4_ACCEPTANCE=true, AUTH_DEV_OTP_CODE empty (captured generated OTP). Migration suites additionally create/drop their own historical DBs. Heavy diagnostic suites serial in a one-off bounded command, not a repository total launcher. One initial lifecycle/performance overlap on separate DBs is recorded; subsequent suites serial. Logs preserved under `/tmp/pethelp-wave4a-reconcile-08b/` and `/tmp/pethelp-wave4a-reconcile-08b-{1,2}.log`.

Isolated lifecycle:13/13 PASS,37.405s, including proposal cancellation and terminal refusal. Source `booking-security.service.ts` branches legacy confirmed cancellation to CANCELLATION_REQUESTED, while Pilot locks authoritative Appointment and closes proposal/releases both capacities. The original two lifecycle failures are RUNTIME_PROFILE_MISMATCH, not a demonstrated Pilot Product regression.

Isolated performance:8 PASS/1 FAIL/9 total,44.11s. All capacity/throughput/latency/deadlock/pool/expiry gates pass. Remaining exact index-name assertion expected `appointment_slots_pkey`, actual `appointment_slots_clinical_location_key`; accepted171969 creates UNIQUE(id,clinic_location_id). This is a TEST_CONTRACT_STALE candidate pending equivalent bounded access verification and correction; do not weaken index or performance gates. The initial overlap does not establish canonical performance acceptance; final corrected run must be serial.

Isolated queue HTTP:51 FAIL/1 PASS/52 total,67.107s. First Pilot closed-route case passes; subsequent beforeEach fixture inserts fail audit PK. Repeated fixed clinic ID after parent TRUNCATE collides with immutable audit(clinic_id,version);171965 deliberately protects UPDATE/DELETE/TRUNCATE of audit. DATABASE_ISOLATION_DEFECT is reproduced within one fresh database, not merely cross-suite order. Correct fixture incarnation identity and enforce owned DB boundary; never remove audit protection.

Historical source audit: foundation sparse exclusion171972 admits171973 and fixed DOWN walks wrong latest chain; profile copier omits Wave1 while admitting downstream clinical migrations; cardinality sparse Wave2 exclusion admits sharing without clinical schema. Intended cutoffs are171971→171972, pre171963→171968,171968→171972 respectively. Four accepted sharing-upgrade fixture/cutoff tests already PASS; do not repeat them unnecessarily. Isolated historical reproductions and remaining runtime suites are in progress.

Worker host attempt was an invalid environment (JWT_SECRET missing;0 tests), not a replacement failure count. Valid Docker worker unit run explicitly enables WORKERS_ENABLED=true before import; pending result. Root-cause classification must use that configured run. No exclusions or assertion weakening.

Base/local/remote precheck: `1f4b145138a28a93dde1119d8afffd1159dada52`, branch `agent/v15-transition-wave-01`. Four existing test changes preserved. No production or released migration edits. Wave4A PARTIAL; Wave4B OCR NOT STARTED; Jira/Confluence unchanged.

Original canonical log: `/tmp/pethelp-wave4a-final-backend-valid.log`. 64 suites:46 passed/18 failed;543 tests:398 passed/145 failed;233.075s. This is a failure snapshot, not consolidated acceptance. Exact diagnostics below exclude duplicate Jest summary.

Recorded invocation: `npm test -- --testPathPatterns='src|test/(booking|v15|clinical|appointment-medical|clinic-(queue|appointment)|veterinarian|owner-(auth|pet|clinic))' --passWithNoTests=false --silent`. Execution provenance: NODE_ENV=test, MVP_SCOPE_PROFILE=LEGACY_COMPAT, WORKERS_ENABLED=false, WAVE4_ACCEPTANCE=true, AUTH_DEV_OTP_CODE=246810; Docker postgres, owned `vethelp_wave3_final_gate_20261007`. Log does not independently print environment; feature flags inherit Compose and require suite-specific reconciliation.


## Targeted reset/ownership audit (all backend/test spec files)

### Phase A completed — isolated matrix (continuation 2026-10-09)

All original18 suites accounted for.17 freshly executed diagnostic suites:10 PASS/7 FAIL;186 tests:91 PASS/95 FAIL/0 skipped. This is a diagnostic total, not consolidated acceptance and not a replacement for historical543. The18th sharing migration uses the accepted populated-upgrade PASS already contained in105/105; not unnecessarily repeated. AUTH_DEV_OTP_CODE must be truly unset, not empty: the initial empty-value core attempt failed11/11 with configuration validation; corrected fresh owned DB run passed11/11,16.156s. Worker valid Docker run passed5/5,30.835s; missing-secret host attempt is invalid environment, not acceptance.

|Original failed suite (backend/test unless src prefix)|Supported lane / schema|Isolated result|Root cause / order dependence|
|---|---|---|---|
|v15-appointment-lifecycle.integration-spec.ts|V15_ACCEPTANCE / latest171973|13/13 PASS|RUNTIME_PROFILE_MISMATCH. Original LEGACY cancellation branch differs; Pilot proposal cancellation/capacity release and terminal refusal all pass. No Product regression demonstrated.|
|booking-core-performance.integration-spec.ts|CURRENT_PILOT_RUNTIME / latest171973; manual clinic|8 PASS/1 FAIL of9|RUNTIME_PROFILE_MISMATCH for original capacity failures; remaining TEST_CONTRACT_STALE candidate exact PK index-name assertion. Actual accepted clinical unique index begins with id. All engineering hard gates pass; final corrected serial proof still pending.|
|clinic-queue-http-authority.e2e-spec.ts|CURRENT_PILOT_RUNTIME / latest171973|1 PASS/51 FAIL of52|RUNTIME_PROFILE_MISMATCH for original closed route; DATABASE_ISOLATION_DEFECT for subsequent fixed clinic IDs. Reproduces within one fresh DB beforeEach, not only between suites.|
|clinical-foundation-migration.integration-spec.ts|HISTORICAL_MIGRATION /171971→171972|0 PASS/2 FAIL|MIGRATION_CUTOFF_MISMATCH. Sparse exclusion admits171973; DOWN count targets wrong latest chain. Independent of other suites.|
|clinic-appointments-registry.e2e-spec.ts|CURRENT_PILOT_RUNTIME / latest171973|1 PASS/26 FAIL of27|DATABASE_ISOLATION_DEFECT. Repeated beforeEach clinic ID versus retained immutable audit; isolated reproduction.|
|owner-clinic-catalog-http.e2e-spec.ts|CURRENT_PILOT_RUNTIME / latest171973|6/6 PASS|RUNTIME_PROFILE_MISMATCH. Closed Pilot doctorId rejection proven; no DTO weakening required.|
|clinic-appointment-detail.e2e-spec.ts|CURRENT_PILOT_RUNTIME / latest171973; registry flag exercised by suite|1 PASS/12 FAIL of13|DATABASE_ISOLATION_DEFECT. Repeated fixed clinic IDs versus immutable audit; isolated reproduction.|
|clinical-visit-completion-evidence-http.e2e-spec.ts|V15_ACCEPTANCE / latest171973; owned wave3 DB|5/5 PASS|DATABASE_ISOLATION_DEFECT in original shared run. beforeAll fixed fixture succeeds in a fresh suite DB; no production correction.|
|clinic-appointments-registry-index.integration-spec.ts|CURRENT_PILOT_RUNTIME / latest171973 (assert171945 indexes)|6/6 PASS|DATABASE_ISOLATION_DEFECT in original shared run. Mutates own fixture/indexes; fixed beforeAll succeeds isolated.|
|veterinarian-visit-read.e2e-spec.ts|CURRENT_PILOT_RUNTIME / latest171973|21/21 PASS|DATABASE_ISOLATION_DEFECT in original shared run. Global parent TRUNCATE then fixed beforeAll IDs succeeds isolated.|
|clinical-result-readback-http.e2e-spec.ts|V15_ACCEPTANCE / latest171973; owned wave3 DB|1/1 PASS|DATABASE_ISOLATION_DEFECT in original shared run. Fixed INSERT-only beforeAll fixture needs fresh suite DB; don't reuse populated database.|
|v15-appointment-lifecycle-http.e2e-spec.ts|V15_ACCEPTANCE / latest171973|6/6 PASS|RUNTIME_PROFILE_MISMATCH. Both clinic contracts converge on Pilot API/lifecycle; no response assertions changed.|
|owner-auth-core.integration-spec.ts|CURRENT_PILOT_RUNTIME / latest171973; AUTH_DEV_OTP_CODE unset|11/11 PASS|RUNTIME_PROFILE_MISMATCH. Fixed development code defeats rotating-verifier fixture. Own rate-limit TRUNCATE and session/challenge deletes require DB isolation. Captured generated code used without weakening negatives.|
|clinic-queue.integration-spec.ts|CURRENT_PILOT_RUNTIME / latest171973|6/6 PASS|RUNTIME_PROFILE_MISMATCH, not a stale DTO assertion. Pilot read intentionally omits legacy state; before-import profile selection preserves original assertion. Own global fixture reset.|
|v15-clinic-contract-profile-migration.integration-spec.ts|HISTORICAL_MIGRATION / pre171963→171968|0 PASS/2 FAIL|MIGRATION_CUTOFF_MISMATCH. Copier admits later clinical chain; DOWN reaches empty sharing rather than171968 barrier. Own temporary DB/migration directory.|
|clinical-result-cardinality-migration.integration-spec.ts|HISTORICAL_MIGRATION /171968→171972|0 PASS/1 FAIL|MIGRATION_CUTOFF_MISMATCH. Sparse Wave2 exclusions admit171973 without clinical schema. Own temporary DB.|
|src/workers/hold-expiration.service.spec.ts|CURRENT_PILOT_RUNTIME unit / no SQL; WORKERS_ENABLED=true|5/5 PASS|RUNTIME_PROFILE_MISMATCH. Enabled worker interval expected; disabled HTTP-worker environment incompatible with timer test. No database mutation.|
|appointment-medical-sharing-migration.e2e-spec.ts|V15_ACCEPTANCE historical171972→latest171973|Accepted1/1 PASS retained|TEST_HARNESS_DEFECT already repaired in35d3b9f: publication+Amendment+Diary commit coherently. Enforcement retained; own random upgrade DB and checksums.|

The original audit-PK group spans seven suites (three repeated-reset suites plus four cross-suite fixtures), not eight. Earlier preliminary wording is historical; this table is the reconciled classification. No intentional suite exclusions. Correct-lane isolated PASS is not combined/order-independent acceptance; Phase C must still prove execution isolation and every required gate. No genuine Product defect established so far.

Actual Compose raw feature flags: FEATURE_MIS_INTEGRATION=false, FEATURE_ONLINE_PAYMENTS=false, FEATURE_EMERGENCY_OPS=true (Pilot disables emergency capability/modules). Registry flag remains default false except explicit registry/detail suite rollout cases reading the dynamic config accessor. No doctor-shift or other Product capability enabled by this task. Config freezes profile/workers at import; launch environment, not beforeAll, determines them. LEGACY_COMPAT remains a separate supported lane and is never counted as current Pilot acceptance.

Budget replan: diagnostics complete; freeze broader discovery and implement only the three proven repeated-clinic fixtures plus a test-only owned-DB/identity helper and negative unit coverage. Historical cutoffs and performance/runtime reconciliation are separate later commits. No production changes or migration history edits. Fresh final reviews remain deferred.

Static audit only; per-suite isolation reproduction pending. Line numbers below identify reset, own-database lifecycle and global environment mutation. Negative DELETE/TRUNCATE assertions are not cleanup permission. Shared fixture imports need transitive review.

|Suite|Reset/delete lines|Owned DB lifecycle lines|Environment mutation lines|
|---|---|---|---|
|`alert-forwarder.integration-spec.ts`|—|—|14, 15, 16, 17, 46, 47, 48, 49, 65, 84, 85, 86, 104|
|`appointment-medical-sharing-http.e2e-spec.ts`|204, 224|—|190, 203|
|`appointment-medical-sharing-migration.e2e-spec.ts`|—|15, 50|—|
|`booking-core-performance.integration-spec.ts`|768, 772, 776, 780, 784, 788, 792, 796, 800, 804, 808, 817, 821, 825, 828, 831, 835|—|—|
|`booking-history.integration-spec.ts`|14|—|—|
|`clinic-appointment-detail.e2e-spec.ts`|192|—|47, 48, 56, 114|
|`clinic-appointments-registry-index.integration-spec.ts`|180|—|—|
|`clinic-appointments-registry.e2e-spec.ts`|124, 235|—|38|
|`clinic-patient-administrative-reference.e2e-spec.ts`|322|—|50, 51, 52, 53, 54, 55, 64, 65, 66, 227|
|`clinic-patient-association-lifecycle.integration-spec.ts`|268|—|29, 30, 62, 109|
|`clinic-patient-association-producer.integration-spec.ts`|192|—|23, 24, 25, 82|
|`clinic-patient-association-schema.integration-spec.ts`|267, 268, 269, 270, 271, 272, 273, 274, 279|—|—|
|`clinic-patient-detail.e2e-spec.ts`|248, 250, 317|—|42, 43, 44, 45, 46, 54, 55, 56, 79, 81, 148, 189, 228, 230, 285|
|`clinic-patient-local-alias.e2e-spec.ts`|242|—|42, 43, 44, 45, 46, 47, 56, 57, 58, 175|
|`clinic-patients-registry.e2e-spec.ts`|592, 712|—|52, 53, 54, 55, 56, 57, 58, 76, 77, 125, 127, 168, 223, 300, 511, 514, 516, 518|
|`clinic-queue-http-authority.e2e-spec.ts`|757|—|53|
|`clinic-queue.integration-spec.ts`|175, 176|—|—|
|`clinic-sla-monitor.integration-spec.ts`|130, 131|—|25, 121|
|`clinic-workspace-home-performance.integration-spec.ts`|115|—|25|
|`clinic-workspace-home.e2e-spec.ts`|—|—|21|
|`clinic-workspace-home.integration-spec.ts`|45, 46|—|15|
|`clinical-foundation-migration.integration-spec.ts`|37|26, 41, 50, 103|—|
|`clinical-result-cardinality-migration.integration-spec.ts`|—|16, 23|—|
|`emergency-routing.integration-spec.ts`|75, 76|—|—|
|`livekit.integration-spec.ts`|131|—|27, 28, 29|
|`marketplace-alpha.integration-spec.ts`|119, 120|—|—|
|`mis-integration.integration-spec.ts`|243|—|48, 49, 50|
|`notification-foundation.integration-spec.ts`|16, 163|—|—|
|`observability-trace.integration-spec.ts`|88|—|36, 58|
|`otp-anti-fraud.integration-spec.ts`|14, 90, 101, 135|—|—|
|`owner-alternative-acceptance.integration-spec.ts`|56, 57|—|—|
|`owner-alternative-snapshot.integration-spec.ts`|72, 73|—|—|
|`owner-auth-core.integration-spec.ts`|39, 41, 42|—|—|
|`owner-auth-http.e2e-spec.ts`|31, 32, 33, 34|—|19, 20, 21, 75, 80|
|`owner-clinic-catalog-http.e2e-spec.ts`|51, 65, 118, 119, 120, 121, 122, 123|—|17|
|`owner-clinic-catalog.integration-spec.ts`|8, 44, 46, 55, 72|—|—|
|`owner-pet-mvp.integration-spec.ts`|19, 20, 23, 24, 25|—|—|
|`payment-refund.integration-spec.ts`|159|—|29, 30, 31|
|`payment-reliability.integration-spec.ts`|139|—|33, 34, 35, 36|
|`payment-remote-intent-capture.integration-spec.ts`|158|—|30, 31, 32|
|`payments-fencing.integration-spec.ts`|131|—|—|
|`platform-smoke.e2e-spec.ts`|1151, 1152, 1153, 1191, 1192, 1193|—|17, 18, 101, 102, 103, 104, 398, 402|
|`shared-rate-limit-foundation.integration-spec.ts`|370|—|282, 304, 321, 335|
|`telemed-engine.integration-spec.ts`|177|—|24, 25, 26, 27, 28|
|`telemed-owner-cancellation.integration-spec.ts`|192|—|7, 8, 9|
|`v15-appointment-lifecycle-http.e2e-spec.ts`|56, 59|—|16|
|`v15-appointment-lifecycle.integration-spec.ts`|56|—|—|
|`v15-clinic-contract-profile-migration.integration-spec.ts`|83, 85|132, 139|—|
|`v50-booking-hold-status.integration-spec.ts`|531|—|33, 41, 65, 85, 86, 99, 274, 301, 440, 472, 509|
|`v50-owner-alternative-resolution.integration-spec.ts`|140, 141|—|—|
|`v50-owner-bookings-cancellation.integration-spec.ts`|206|—|93, 95, 98|
|`veterinarian-visit-read.e2e-spec.ts`|101, 102|—|30|

Audited 64 spec files by targeted static scan. Absence of a direct reset match does not prove read-only behavior: helper-driven mutation and fixed UUID scope remain to be checked.

## Preliminary root-cause groups

- DATABASE_ISOLATION_DEFECT: registry/queue shared fixed-clinic fixtures truncate parents but retain immutable audit identity. Eight suites report audit-PK setup collisions; isolated proof and exact safe fixture correction pending. Assertions did not reach Product behavior.
- MIGRATION_CUTOFF_MISMATCH: foundation, contract-profile and cardinality helpers omit particular versions but admit downstream171973, or use stale latest rollback counts. Do not rewrite released migration history.
- RUNTIME_PROFILE_MISMATCH: PILOT route/request/result expectations invoked in LEGACY_COMPAT. Worker timer and fixed OTP expectations also require explicit environment proof.
- UNDETERMINED: lifecycle cancellation/terminal failures and performance capacity/plan assertions. Possible Product violation remains unresolved; STOP before production changes if established.
- TEST_CONTRACT_STALE candidate: Owner projection assertion excluding additive state; compare accepted ADR/OpenAPI before correction.
- TEST_HARNESS_DEFECT: sharing upgrade published fixture lacked coherent Diary in same commit; existing preserved test change repairs fixture, not production enforcement.

Original failures reproduced consolidated; isolated reproduction is PENDING except where focused evidence is recorded. No exclusions, skips, weaker assertions or fabricated PASS.

## Explicit runtime lanes (plan, not acceptance)

|Lane|Actual configuration|Boundary|
|---|---|---|
|CURRENT_PILOT_RUNTIME|MVP_SCOPE_PROFILE=PILOT_V1; NODE_ENV=test; workers disabled for Nest HTTP|Current closed API contracts; registry flags only explicitly accepted suite behavior.|
|V15_ACCEPTANCE|PILOT_V1; WAVE4_ACCEPTANCE=true; WORKERS_ENABLED=false; Docker postgres|Clinic contract is server-resolved, not an invented runtime selector.|
|LEGACY_COMPATIBILITY|MVP_SCOPE_PROFILE=LEGACY_COMPAT|Legacy-only evidence never counted as Pilot acceptance.|
|HISTORICAL_MIGRATION|Random owned database; explicit historical timestamp|Historical invariant, not latest schema; no sparse exclusion allowing downstream dependencies.|

Configuration freezes at import: beforeAll environment mutation cannot reliably choose profile. Every integration/E2E mapping, actual feature-flag audit and per-file ownership review remain pending. No artificial global profile accepted.

## Isolation and remaining work

### First correction checkpoint — precommit evidence, 2026-10-09

Scope: three repeated-reset fixtures renew clinic identities only after a fail-closed test-owned Docker database check (`NODE_ENV=test`, `WAVE4_ACCEPTANCE=true`, postgres hostname/protocol, reserved `vethelp_wave3_reconcile_*` name). Developer, retained acceptance and baseline-template databases are rejected before reset. Eleven unit cases cover distinct identity allocation and unsafe-target/env rejection. No production code, released migrations, append-only audit protections or original security assertions changed.

Scoped validator initially caught describe-time actor matrices retaining old clinic claims after renewal. All three matrices now evaluate actor factories after beforeEach reset, preserving intended role/membership/clinic/location negative gates. Scoped re-review PASS; not final Security/Independent review. One detail assertion reconciles accepted BP-11 `owner:{displayName:null,phone:null}` instead of obsolete `owner:null`; service/veterinarian/resource null checks remain. Authority: accepted runtime `clinic-appointments-registry.service.ts:204` and BP-11 checkpoint; no fabricated Owner name.

After clearing setup collisions, the first combined Pilot group had92 PASS/11 FAIL of103: ten legacy alternative-route cases plus the obsolete BP-11 null assertion. These are recorded, not hidden. A subsequent blanket Legacy queue partition had47 PASS/4 FAIL/1 not-selected: four cases assert Pilot-only status projection/race winner. This proves the queue file mixes contracts; neither single global profile is a valid gate.

Correct final queue partition (supersedes preliminary queue lane):42 Pilot cases and10 Legacy-only cases. Legacy selector is the union of these exact title fragments:

```text
polls the authoritative version after a missed non-terminal update
proposes an alternative idempotently
denies clinic proposal across role
normalizes foreign owner read
accepts once, replays the same key
denies foreign-owner accept
rejects expired, stale and conflicted accepts
requires If-Match for propose-alternative
rejects impossible future version for propose-alternative
serializes request-notes-vs-propose
```

Join with `|` for LEGACY_COMPAT `--testNamePattern`; use `^(?!.*(<same union>))` for PILOT_V1. Same file, complementary profile selection, all52 definitions retained. Each invocation uses a separate owned fresh database. Fresh before-import NODE_ENV=test, workers=false, WAVE4_ACCEPTANCE=true; existing raw feature flags unchanged. Legacy compatibility tests are not counted as Pilot runtime acceptance; current confirmed-Appointment rescheduling is separately covered by passing V15 lifecycle HTTP/integration suites.

Focused/adjacent PASS:

- Pilot full group:7 suites/84 tests/0 failures/0 skipped,75.381s. Includes registry27, detail13, guard11, clinical completion5, registry indexes6, vet read21, Result readback1. Log `/tmp/pethelp-wave4a-reconcile-08b-fixture-pilot-2.log` (its extra initial1-case queue selection is superseded by the complete final partition).
- Pilot queue:42 PASS/10 not-selected,62.562s; `/tmp/pethelp-wave4a-reconcile-08b/queue-pilot-3.log`.
- Legacy queue:10 PASS/42 not-selected,21.612s; `/tmp/pethelp-wave4a-reconcile-08b/queue-legacy-3.log`.
- Exact original-name comparison: baseline52, union52, missing0, extra0, overlap0. Therefore136 unique tests PASS across8 unique suites;9 profile-specific Jest suite executions. Jest reports52 selection-skipped entries across complementary queue runs; zero disabled definitions and zero mandatory cases excluded. Do not report raw skipped entries as absent or count tests twice.
- Read-only SQL retention: Pilot group90 audit rows/2 current clinics; final Pilot queue114/2, Legacy queue36/2. Row-mutation and TRUNCATE rejection triggers both enabled (`O`). Parent resets did not erase immutable policy audit.

This compatible-group stress proves current bounded fixture acceptance and preserves logs; it is NOT canonical complete per-suite-isolated Phase C acceptance. Every relevant full suite must still run under its documented lane with enforced ownership. Remaining corrections: foundation2 assertions, profile migration2, cardinality1, performance index-name1. No proven Product defect; no production remediation. Original543 consolidated matrix remains NOT RUN after reconciliation, clients retain unchanged accepted evidence, fresh final Security/Independent reviews NOT RUN.

Final root diff review PASS, scoped validator PASS, diff checks PASS. Planned sole bounded commit `test(db): isolate regression fixtures`; documentation stays uncommitted for final evidence reconciliation. Immediate push/fetch/equality required; stop on policy rejection. No next correction commit before remote-backed recovery point.

### Preserved four-file checkpoint acceptance — 2026-10-08

New project `pethelp-wave4a-reconcile-20261008a`, owned fresh DB `vethelp_wave4a_checkpoint_20261008`; existing dependency volume mounted read-only, no retained acceptance database reset. Actual NODE_ENV=test, PILOT_V1, WORKERS_ENABLED=false, WAVE4_ACCEPTANCE=true. Fresh full migration chain and migrate:verify PASS;171973 row count1. Docker Node22 PostgreSQL/Nest focused suite group:4/4 suites,105/105 tests,0 failed/0 skipped,64.908s. Includes32 authority races and populated historical171972 → latest upgrade preserving Visit/Result/Amendment/Diary and unvalidated legacy OCR. Backend log `/tmp/pethelp-wave4a-reconcile-checkpoint-backend.log`.

Portal Chromium changed suites:14/14 PASS,0 failed,27.5s; `/tmp/pethelp-wave4a-reconcile-checkpoint-portal.log`. Uses existing unchanged accepted production build. Prior unchanged Owner162/162,typecheck/lint, Portal27/27 contracts,typecheck/build and enabled registry/detail67 PASS retained as sticky evidence, not a fresh consolidated run.

Root final diff review PASS: only existing four test files selected for recovery commit; real SQL results/locks retained, negative authorization and no-storage assertions retained, populated upgrade fixture enforces publication/Diary coherence, browser negative POST/DTO/keyboard/axe checks retained. No released migration, runtime, API or UX changes. Deprecation warning from pg concurrent client.query retained in log; not suppressed or treated as a Product regression. This is not fresh final Security/Independent review.

Recovery commit/push pending. Diagnostic document remains separate from the four-file test commit. Previously failing18 suites are NOT yet reconciled or reaccepted; migration cutoff and cancellation diagnostics remain open. No next reconciliation commit before remote-backed checkpoint.

Exclusive new Compose project: `pethelp-wave4a-reconcile-20261008a`. PostgreSQL container: `pethelp-wave4a-reconcile-20261008a-postgres-1`. Do not reset developer or retained pethelp-wave4a DB. Use owned per-suite/group databases, serial heavy execution, and preserve immutable audit protections. No cleanup of shared evidence.

Retain full original diagnostic log above. Per-assertion sections below provide expected/actual and complete original stacks. Suite titles identify capability; all inherit recorded invocation unless source overrides it. Migration/ownership/dependency details and isolated proofs must be added, not inferred.


### Failure 1 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › blocks legacy cancellation mutations in PILOT before authentication or state change

    expected 404 "Not Found", got 401 "Unauthorized"

       96 |       .post(`/v1/booking-holds/${IDS.hold}/release`)
       97 |       .set('Idempotency-Key', randomUUID())
    >  98 |       .expect(404);
          |        ^
       99 |     await request(app.getHttpServer())
      100 |       .post(`/v1/booking-holds/${IDS.hold}/cancellation-requests`)
      101 |       .set('X-Correlation-ID', randomUUID())

      at Object.<anonymous> (test/clinic-queue-http-authority.e2e-spec.ts:98:8)
      ----
      at Test._assertStatus (node_modules/supertest/lib/test.js:309:14)
      at node_modules/supertest/lib/test.js:365:13
      at Test._assertFunction (node_modules/supertest/lib/test.js:342:13)
      at Test.assert (node_modules/supertest/lib/test.js:195:23)
      at localAssert (node_modules/supertest/lib/test.js:138:14)
      at Server.<anonymous> (node_modules/supertest/lib/test.js:152:11)
```

### Failure 2 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › allows the scoped receptionist to read only its queue

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 3 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › returns a repeatable authoritative FIFO snapshot with stable tie-breaker and no read side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 4 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › applies the documented default 50 and maximum 100 snapshot limits without duplicates

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 5 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › polls the authoritative version after a missed non-terminal update and converges after multiple missed updates

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 6 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › removes confirmed and declined terminal holds from the next poll and preserves owner readback

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 7 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › returns only a transactionally consistent snapshot during concurrent confirm

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 8 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › returns only a transactionally consistent snapshot during concurrent request-notes

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 9 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › does not normalize a technical read failure into a successful empty queue

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 10 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies queue read for role denied without leaking queue data

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 11 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies queue read for revoked membership without leaking queue data

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 12 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies queue read for claims without membership without leaking queue data

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 13 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies queue read for missing clinic scope without leaking queue data

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 14 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies queue read for incompatible clinic scope without leaking queue data

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 15 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies queue read for missing location scope without leaking queue data

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 16 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies queue read for incompatible location scope without leaking queue data

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 17 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies cross-clinic and cross-location queue reads without payload disclosure

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 18 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies confirm for role denied without state, appointment, audit or outbox effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 19 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies confirm for missing membership without state, appointment, audit or outbox effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 20 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies confirm for revoked membership without state, appointment, audit or outbox effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 21 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies confirm for missing clinic scope without state, appointment, audit or outbox effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 22 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies confirm for incompatible clinic scope without state, appointment, audit or outbox effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 23 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies confirm for missing location scope without state, appointment, audit or outbox effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 24 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies confirm for incompatible location scope without state, appointment, audit or outbox effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 25 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › confirms idempotently and publishes the authoritative owner readback

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 26 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies decline across the authority matrix without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 27 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies request-notes across the authority matrix without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 28 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › declines idempotently with authoritative release, reason, audit, outbox and owner readback

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 29 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › requests notes idempotently while preserving the pending hold and publishing the request text

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 30 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects decline from terminal CONFIRMED without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 31 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects request-notes from terminal CONFIRMED without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 32 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › proposes an alternative idempotently with exact clinic scope, reserved capacity and owner readback

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 33 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies clinic proposal across role, membership and exact scope without alternative effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 34 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › normalizes foreign owner read and rejects staff or unauthenticated access without disclosure

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 35 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › accepts once, replays the same key, and rejects a second key without duplicate effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 36 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › denies foreign-owner accept without proposal, capacity, appointment, audit or outbox effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 37 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects expired, stale and conflicted accepts while preserving capacity and effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 38 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › requires If-Match for confirm without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 39 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › requires If-Match for decline without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 40 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › requires If-Match for request-notes without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 41 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › requires If-Match for propose-alternative without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 42 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects impossible future version for confirm without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 43 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects impossible future version for decline without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 44 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects impossible future version for request-notes without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 45 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects impossible future version for propose-alternative without side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 46 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects a stale confirm after request-notes advances the authoritative version

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 47 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › replays the first request-notes result for the same key without overwriting a changed payload

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 48 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects a different-key replay after terminal confirm without duplicate effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 49 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › rejects a different-key replay after terminal decline without duplicate effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 50 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › serializes duplicate concurrent confirm delivery to one business transition

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```


### Failure 51 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › serializes confirm-vs-decline with one winner, controlled loser and one effect set

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 52 — test/clinic-queue-http-authority.e2e-spec.ts

```text
Clinic Queue HTTP authority matrix › serializes request-notes-vs-propose with one winner, controlled loser and one effect set

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      758 |   await resetBookingPersistence(database);
      759 |   await database.query(`INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])`, [[IDS.owner, IDS.otherOwner, IDS.allowed, IDS.revoked, IDS.noMembership, IDS.veterinarian]]);
    > 760 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Queue LLC', 'Queue clinic'), ($2::uuid, 'Other LLC', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      761 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'Queue address'), ($3::uuid, $2::uuid, 'Other location'), ($4::uuid, $5::uuid, 'Other clinic address')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      762 |   await database.query(`
      763 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-queue-http-authority.e2e-spec.ts:760:3)
```

### Failure 53 — test/booking-core-performance.integration-spec.ts

```text
T044 Booking Core engineering baseline (real PostgreSQL) › profile A: final-unit contention is reproducible at 50 and 100 contenders

    expect(received).toMatchObject(expected)

    - Expected  - 3
    + Received  + 3

      Object {
    -   "activeHolds": 1,
    -   "booked": 0,
    +   "activeHolds": 0,
    +   "booked": 1,
        "capacity": 1,
    -   "held": 1,
    +   "held": 0,
      }

      123 |       const effects = await aggregateEffects(fixture.slots[0]);
      124 |       expect(outcomes.filter((x) => x.ok)).toHaveLength(1);
    > 125 |       expect(invariant).toMatchObject({
          |                         ^
      126 |         held: 1,
      127 |         booked: 0,
      128 |         capacity: 1,

      at Object.<anonymous> (test/booking-core-performance.integration-spec.ts:125:25)
```

### Failure 54 — test/booking-core-performance.integration-spec.ts

```text
T044 Booking Core engineering baseline (real PostgreSQL) › profile B: multi-capacity contention conserves all five units

    expect(received).toHaveLength(expected)

    Expected length: 5
    Received length: 3
    Received array:  [{"code": "SUCCESS", "latencyMs": 116.64272899999924, "ok": true, "value": {"aggregateVersion": 1, "appointmentId": "0ff48cda-cd79-40cd-85f7-0e4da849a28a", "confirmationMode": "AUTOMATIC", "correlationId": "15cb6ffd-29aa-434f-9a87-cb9fab738779", "displayStatus": "CONFIRMED", "expiresAt": "2026-10-07T20:38:40.029Z", "holdId": "174b9b6b-9b14-4b97-ab08-e28f2377488e", "lastUpdatedAt": "2026-10-07T20:28:40.029Z", "nextAction": "READ_STATUS", "serverNow": "2026-10-07T20:28:40.015Z", "slotId": "4b8fe1e8-806f-48cb-b6f4-0f199e758e27", "state": "CONFIRMED"}}, {"code": "SUCCESS", "latencyMs": 453.9674490000034, "ok": true, "value": {"aggregateVersion": 1, "appointmentId": "08f15289-61d4-40a0-b8fe-7f06e9d02ef7", "confirmationMode": "AUTOMATIC", "correlationId": "b676210d-5ac1-4ec0-bf34-50fb7ea78b30", "displayStatus": "CONFIRMED", "expiresAt": "2026-10-07T20:38:40.354Z", "holdId": "ace7021a-33e3-4353-b3ba-574bb9ab6bda", "lastUpdatedAt": "2026-10-07T20:28:40.354Z", "nextAction": "READ_STATUS", "serverNow": "2026-10-07T20:28:40.347Z", "slotId": "4b8fe1e8-806f-48cb-b6f4-0f199e758e27", "state": "CONFIRMED"}}, {"code": "SUCCESS", "latencyMs": 385.9176920000027, "ok": true, "value": {"aggregateVersion": 1, "appointmentId": "130e0378-1c55-4ae3-8a75-6695083488c5", "confirmationMode": "AUTOMATIC", "correlationId": "7e836113-c3ac-40be-a67d-eb552624ab00", "displayStatus": "CONFIRMED", "expiresAt": "2026-10-07T20:38:40.219Z", "holdId": "7ae06550-047d-4542-816e-dab3fcdeb910", "lastUpdatedAt": "2026-10-07T20:28:40.219Z", "nextAction": "READ_STATUS", "serverNow": "2026-10-07T20:28:40.208Z", "slotId": "4b8fe1e8-806f-48cb-b6f4-0f199e758e27", "state": "CONFIRMED"}}]

      159 |     const invariant = await slotInvariant(fixture.slots[0]);
      160 |     const effects = await aggregateEffects(fixture.slots[0]);
    > 161 |     expect(outcomes.filter((x) => x.ok)).toHaveLength(5);
          |                                          ^
      162 |     expect(invariant).toMatchObject({
      163 |       held: 5,
      164 |       booked: 0,

      at Object.<anonymous> (test/booking-core-performance.integration-spec.ts:161:42)
```

### Failure 55 — test/booking-core-performance.integration-spec.ts

```text
T044 Booking Core engineering baseline (real PostgreSQL) › profile C: distributed create load establishes a bounded concurrency ramp

    expect(received).toMatchObject(expected)

    - Expected  - 1
    + Received  + 1

      Object {
    -   "activeHolds": 40,
    +   "activeHolds": 0,
        "counterDrift": 0,
        "overbooked": 0,
      }

      201 |       ).toEqual([]);
      202 |       const totals = await fixtureInvariant(fixture.slots);
    > 203 |       expect(totals).toMatchObject({
          |                      ^
      204 |         overbooked: 0,
      205 |         counterDrift: 0,
      206 |         activeHolds: outcomes.filter((x) => x.ok).length,

      at Object.<anonymous> (test/booking-core-performance.integration-spec.ts:203:22)
```


### Failure 56 — test/booking-core-performance.integration-spec.ts

```text
T044 Booking Core engineering baseline (real PostgreSQL) › profile D: idempotency storm creates exactly one mutation and rejects changed fingerprint

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      225 |       Array.from({ length: 100 }, () => () => create(fixture, 0, 0, key, 1)),
      226 |     );
    > 227 |     expect(outcomes.every((x) => x.ok)).toBe(true);
          |                                         ^
      228 |     const replay = await outcome(() => create(fixture, 0, 0, key, 1));
      229 |     expect(replay.ok).toBe(true);
      230 |     const changed = await outcome(() =>

      at Object.<anonymous> (test/booking-core-performance.integration-spec.ts:227:41)
```

### Failure 57 — test/booking-core-performance.integration-spec.ts

```text
T044 Booking Core engineering baseline (real PostgreSQL) › profile E: stale-version contention is side-effect free

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      274 |     expect(
      275 |       outcomes.every((x) => !x.ok && x.code === "BOOKING_STATE_CONFLICT"),
    > 276 |     ).toBe(true);
          |       ^
      277 |     const invariant = await slotInvariant(fixture.slots[0]);
      278 |     const effects = await aggregateEffects(fixture.slots[0]);
      279 |     expect(effects).toMatchObject({

      at Object.<anonymous> (test/booking-core-performance.integration-spec.ts:276:7)
```

### Failure 58 — test/booking-core-performance.integration-spec.ts

```text
T044 Booking Core engineering baseline (real PostgreSQL) › profile F: mixed confirm/decline/owner-cancel races converge without deadlock

    DomainException: Retry shortly

      11 |   holdNotFound: () => new DomainException(HttpStatus.NOT_FOUND, 'HOLD_NOT_FOUND', 'Hold not found'),
      12 |   slotAlreadyTaken: () => new DomainException(HttpStatus.CONFLICT, 'SLOT_ALREADY_TAKEN', 'Slot unavailable'),
    > 13 |   slotLockedRetry: () => new DomainException(HttpStatus.CONFLICT, 'SLOT_LOCKED_RETRY', 'Retry shortly'),
         |                          ^
      14 |   slotVersionStale: () => new DomainException(HttpStatus.CONFLICT, 'SLOT_VERSION_STALE', 'Slot version is stale'),
      15 |   bookingStateConflict: () => new DomainException(HttpStatus.CONFLICT, 'BOOKING_STATE_CONFLICT', 'Booking state or version is stale'),
      16 |   bookingVersionStale: () => new DomainException(HttpStatus.CONFLICT, 'BOOKING_VERSION_STALE', 'Booking version is stale'),

      at Object.slotLockedRetry (src/common/domain-error.ts:13:26)
      at BookingHoldCreationService.mapPgError (src/booking-core/booking-hold-creation.service.ts:543:73)
      at BookingHoldCreationService.createLocalHold (src/booking-core/booking-hold-creation.service.ts:331:18)
          at async Promise.all (index 5)
      at Object.<anonymous> (test/booking-core-performance.integration-spec.ts:294:21)
```

### Failure 59 — test/booking-core-performance.integration-spec.ts

```text
T044 Booking Core engineering baseline (real PostgreSQL) › profile G: bounded expiry backlog drains and cached health reflects recovery

    expect(received).toBe(expected) // Object.is equality

    Expected: 50
    Received: 0

      393 |     const health = worker.healthSnapshot();
      394 |     const totals = await fixtureInvariant(fixture.slots);
    > 395 |     expect(processed.expired).toBe(50);
          |                               ^
      396 |     expect(before.overdueCount).toBeGreaterThanOrEqual(50);
      397 |     expect(after.overdueCount).toBe(0);
      398 |     expect(totals).toMatchObject({

      at Object.<anonymous> (test/booking-core-performance.integration-spec.ts:395:31)
```

### Failure 60 — test/booking-core-performance.integration-spec.ts

```text
T044 Booking Core engineering baseline (real PostgreSQL) › captures representative PostgreSQL plans for slot, idempotency and expiry claims

    expect(received).toContain(expected) // indexOf

    Expected value: "appointment_slots_pkey"
    Received array: ["appointment_slots_clinical_location_key"]

      454 |       databasePlans[name] = planSummary(result.rows[0]["QUERY PLAN"][0]);
      455 |     }
    > 456 |     expect(databasePlans.slotLookup.indexes).toContain(
          |                                              ^
      457 |       "appointment_slots_pkey",
      458 |     );
      459 |     expect(

      at Object.<anonymous> (test/booking-core-performance.integration-spec.ts:456:46)
```


### Failure 61 — test/clinical-foundation-migration.integration-spec.ts

```text
Wave 3 clinical foundation migration › backfills deterministic Amendment versions on a populated 171971 database and preserves old-app inserts

    Command failed: /workspace/backend/node_modules/.bin/node-pg-migrate up --migrations-dir migrations/node-pg --migrations-schema public --migrations-table schema_migrations --single-transaction
    Error: Not run migration 1719720000000_add_clinical_amendment_version is preceding already run migration 1719730000000_add_appointment_medical_sharing

      116 | `);}
      117 | function sha(path:string){return createHash('sha256').update(readFileSync(path)).digest('hex');}
    > 118 | function run(direction:'up'|'down',url:string){execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),[direction,'--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url},stdio:'pipe'});}
          |                                                            ^
      119 | function runBeforeAmendmentVersion(url:string){execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),['up','--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--ignore-pattern','(?:\\..*|171972.*)','--single-transaction'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url},stdio:'pipe'});}
      120 |

      at checkOrder (file:/workspace/backend/node_modules/node-pg-migrate/dist/bundle/index.js:3718:13)
      at runner (file:/workspace/backend/node_modules/node-pg-migrate/dist/bundle/index.js:3786:7)
      at run (test/clinical-foundation-migration.integration-spec.ts:118:60)
      at Object.<anonymous> (test/clinical-foundation-migration.integration-spec.ts:33:38)
```

### Failure 62 — test/clinical-foundation-migration.integration-spec.ts

```text
Wave 3 clinical foundation migration › proves lineage, lifecycle, immutability, projection coherence and populated DOWN fail-closed

    expect(received).toBeNull()

    Received: "clinical_schema.visits"

      54 |       run('down',target.toString());
      55 |       run('down',target.toString());
    > 56 |       expect((await client.query(`SELECT to_regclass('clinical_schema.visits') value`)).rows[0].value).toBeNull();
         |                                                                                                        ^
      57 |       run('up',target.toString());
      58 |       await seed(client);
      59 |

      at Object.<anonymous> (test/clinical-foundation-migration.integration-spec.ts:56:104)
```

### Failure 63 — test/v15-appointment-lifecycle.integration-spec.ts

```text
v1.5 appointment lifecycle (real PostgreSQL) › Owner cancellation closes a pending proposal and releases both capacities

    expect(received).toEqual(expected) // deep equality

    - Expected  - 4
    + Received  + 4

      Object {
    -   "lifecycle_state": "CANCELLED_BY_USER",
    -   "proposal_state": "DECLINED",
    -   "source_booked": 0,
    -   "target_held": 0,
    +   "lifecycle_state": "RESCHEDULE_PROPOSED",
    +   "proposal_state": "PENDING",
    +   "source_booked": 1,
    +   "target_held": 1,
      }

      44 |  it('expires a confirmed proposal without losing the original booking or version fence',async()=>{const f=await fixture(db);const p=await lifecycle.propose({...command(f),targetSlotId:f.target,expectedTargetSlotVersion:1});await db.query("UPDATE booking_schema.alternative_swap_groups SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[p.proposalId]);await expect(lifecycle.expireRescheduleProposals(1)).resolves.toBe(1);const s=(await db.query<any>(`SELECT a.lifecycle_state,a.version,h.version hold_version,(SELECT state FROM booking_schema.alternative_swap_groups WHERE id=$2) proposal_state,(SELECT booked_count FROM clinic_schema.appointment_slots WHERE id=$3) source_booked,(SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$4) target_held FROM booking_schema.appointments a JOIN booking_schema.booking_holds h ON h.id=a.hold_id WHERE a.id=$1`,[f.appointment,p.proposalId,f.source,f.target])).rows[0];expect(s).toEqual({lifecycle_state:'CONFIRMED',version:3,hold_version:3,proposal_state:'EXPIRED',source_booked:1,target_held:0});await expect(security.releaseHold({holdId:f.hold,actor:{sub:f.owner,roles:[Role.OWNER]},expectedVersion:3,idempotencyKey:randomUUID(),correlationId:randomUUID(),normalizeOwnerNotFound:true})).resolves.toBeDefined();});
      45 |
    > 46 |  it('Owner cancellation closes a pending proposal and releases both capacities',async()=>{const f=await fixture(db);const p=await lifecycle.propose({...command(f),targetSlotId:f.target,expectedTargetSlotVersion:1});await security.releaseHold({holdId:f.hold,actor:{sub:f.owner,roles:[Role.OWNER]},expectedVersion:2,idempotencyKey:randomUUID(),correlationId:randomUUID(),normalizeOwnerNotFound:true});const s=(await db.query<any>(`SELECT a.lifecycle_state,(SELECT state FROM booking_schema.alternative_swap_groups WHERE id=$2) proposal_state,(SELECT booked_count FROM clinic_schema.appointment_slots WHERE id=$3) source_booked,(SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$4) target_held FROM booking_schema.appointments a WHERE a.id=$1`,[f.appointment,p.proposalId,f.source,f.target])).rows[0];expect(s).toEqual({lifecycle_state:'CANCELLED_BY_USER',proposal_state:'DECLINED',source_booked:0,target_held:0});});
         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        ^
      47 |
      48 |  it('terminal completed and no-show appointments cannot be owner-cancelled or rewritten',async()=>{let f=await fixture(db,-1);await lifecycle.markNoShow(command(f));await expect(security.releaseHold({holdId:f.hold,actor:{sub:f.owner,roles:[Role.OWNER]},expectedVersion:1,idempotencyKey:randomUUID(),correlationId:randomUUID(),normalizeOwnerNotFound:true})).rejects.toMatchObject({status:409});f=await fixture(db,-1);await db.query("UPDATE booking_schema.appointments SET status='COMPLETED',lifecycle_state=NULL WHERE id=$1",[f.appointment]);await db.query("UPDATE booking_schema.booking_holds SET state='COMPLETED' WHERE id=$1",[f.hold]);await expect(lifecycle.markNoShow(command(f))).rejects.toMatchObject({status:409});});
      49 |

      at Object.<anonymous> (test/v15-appointment-lifecycle.integration-spec.ts:46:824)
```

### Failure 64 — test/v15-appointment-lifecycle.integration-spec.ts

```text
v1.5 appointment lifecycle (real PostgreSQL) › terminal completed and no-show appointments cannot be owner-cancelled or rewritten

    expect(received).rejects.toMatchObject()

    Received promise resolved instead of rejected
    Resolved to value: {"correlationId": "90a6e1ec-3ab7-4626-8370-76b97838c68f", "holdId": "1cf5217c-ec71-4298-977e-471309e188fa", "slotId": "1af9df2e-be90-4dc3-b7ee-c7d38c7676c8", "state": "CANCELLATION_REQUESTED"}

      46 |  it('Owner cancellation closes a pending proposal and releases both capacities',async()=>{const f=await fixture(db);const p=await lifecycle.propose({...command(f),targetSlotId:f.target,expectedTargetSlotVersion:1});await security.releaseHold({holdId:f.hold,actor:{sub:f.owner,roles:[Role.OWNER]},expectedVersion:2,idempotencyKey:randomUUID(),correlationId:randomUUID(),normalizeOwnerNotFound:true});const s=(await db.query<any>(`SELECT a.lifecycle_state,(SELECT state FROM booking_schema.alternative_swap_groups WHERE id=$2) proposal_state,(SELECT booked_count FROM clinic_schema.appointment_slots WHERE id=$3) source_booked,(SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$4) target_held FROM booking_schema.appointments a WHERE a.id=$1`,[f.appointment,p.proposalId,f.source,f.target])).rows[0];expect(s).toEqual({lifecycle_state:'CANCELLED_BY_USER',proposal_state:'DECLINED',source_booked:0,target_held:0});});
      47 |
    > 48 |  it('terminal completed and no-show appointments cannot be owner-cancelled or rewritten',async()=>{let f=await fixture(db,-1);await lifecycle.markNoShow(command(f));await expect(security.releaseHold({holdId:f.hold,actor:{sub:f.owner,roles:[Role.OWNER]},expectedVersion:1,idempotencyKey:randomUUID(),correlationId:randomUUID(),normalizeOwnerNotFound:true})).rejects.toMatchObject({status:409});f=await fixture(db,-1);await db.query("UPDATE booking_schema.appointments SET status='COMPLETED',lifecycle_state=NULL WHERE id=$1",[f.appointment]);await db.query("UPDATE booking_schema.booking_holds SET state='COMPLETED' WHERE id=$1",[f.hold]);await expect(lifecycle.markNoShow(command(f))).rejects.toMatchObject({status:409});});
         |                                                                                                                                                                            ^
      49 |
      50 |  it('serializes Owner accept versus expiry and restores the original booking',async()=>{const f=await fixture(db);const p=await lifecycle.propose({...command(f),targetSlotId:f.target,expectedTargetSlotVersion:1});await db.query("UPDATE booking_schema.alternative_swap_groups SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[p.proposalId]);await Promise.allSettled([ownerResolution.resolve(p.proposalId as string,f.owner,'ACCEPT',{expectedVersion:2,idempotencyKey:randomUUID(),correlationId:randomUUID()},f.hold),lifecycle.expireRescheduleProposals(1)]);const s=(await db.query<any>(`SELECT a.lifecycle_state,(SELECT state FROM booking_schema.alternative_swap_groups WHERE id=$2) proposal_state,(SELECT booked_count FROM clinic_schema.appointment_slots WHERE id=$3) source_booked,(SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$4) target_held FROM booking_schema.appointments a WHERE a.id=$1`,[f.appointment,p.proposalId,f.source,f.target])).rows[0];expect(s).toEqual({lifecycle_state:'CONFIRMED',proposal_state:'EXPIRED',source_booked:1,target_held:0});});
      51 |

      at expect (node_modules/expect/build/index.js:2116:15)
      at Object.<anonymous> (test/v15-appointment-lifecycle.integration-spec.ts:48:172)
```

### Failure 65 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › uses stable keyset ties and a fixed snapshot without duplicates or inserted rows

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```


### Failure 66 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › keeps the exact end boundary in upcoming and excludes it from history for the cursor snapshot

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 67 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › returns authoritative empty output distinct from a technical failure

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 68 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › does not expose sensitive or internal fields anywhere in the response

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 69 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › is side-effect free across repeated reads

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 70 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › denies missing membership without projection leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```


### Failure 71 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › denies revoked membership without projection leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 72 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › denies role denied without projection leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 73 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › denies missing clinic scope without projection leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 74 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › denies incompatible clinic scope without projection leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 75 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › denies missing location scope without projection leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```


### Failure 76 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › denies incompatible location scope without projection leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 77 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › denies unauthenticated, cross-location and cross-clinic requests without leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 78 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects missing or invalid bucket undefined

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 79 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects missing or invalid bucket invalid

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 80 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit 0

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```


### Failure 81 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit -1

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 82 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit 1.5

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 83 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit 101

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 84 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit many

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 85 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit 1e2

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```


### Failure 86 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit 0x10

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 87 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit 01

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 88 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects invalid limit  1

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 89 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › uses default 50 and accepts maximum 100

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```

### Failure 90 — test/clinic-appointments-registry.e2e-spec.ts

```text
Clinic appointments registry HTTP authority and cursor matrix › rejects malformed, tampered, cross-bucket and cross-scope cursors uniformly

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      236 |   await resetBookingPersistence(database);
      237 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.allowed, IDS.admin, IDS.revoked, IDS.noMembership, IDS.vet]]);
    > 238 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Registry LLC', 'Registry'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      239 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Registry'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      240 |   await database.query(`
      241 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointments-registry.e2e-spec.ts:238:3)
```


### Failure 91 — test/owner-clinic-catalog-http.e2e-spec.ts

```text
Owner clinic catalog HTTP authority › protects and executes the closed PILOT booking request contract

    expected 400 "Bad Request", got 201 "Created"

      79 |       const extra=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',randomUUID()).send({...body,price:'1500.00'}).expect(400);
      80 |       expect(extra.body).toMatchObject({code:'INVALID_REQUEST'});
    > 81 |       const hiddenLegacy=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',randomUUID()).send({...body,doctorId:null}).expect(400);
         |                                                                                                                                                                                                     ^
      82 |       expect(hiddenLegacy.body).toMatchObject({code:'INVALID_REQUEST'});
      83 |       const first=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',key).send(body).expect(201);
      84 |       expect(Object.keys(first.body).sort()).toEqual(['aggregateVersion','confirmationMode','correlationId','expiresAt','holdId','lastUpdatedAt','nextAction','serverNow','slotId','status']);

      at Object.<anonymous> (test/owner-clinic-catalog-http.e2e-spec.ts:81:197)
      ----
      at Test._assertStatus (node_modules/supertest/lib/test.js:309:14)
      at node_modules/supertest/lib/test.js:365:13
      at Test._assertFunction (node_modules/supertest/lib/test.js:342:13)
      at Test.assert (node_modules/supertest/lib/test.js:195:23)
      at localAssert (node_modules/supertest/lib/test.js:138:14)
      at Server.<anonymous> (node_modules/supertest/lib/test.js:152:11)
```

### Failure 92 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › returns the exact administrative projection for CLINIC_ADMIN

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 93 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › is default-off and cannot be bypassed through the backend route

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 94 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › requires authentication, allowed role, exact claims and active membership

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 95 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › normalizes malformed, absent and foreign resources without data leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```


### Failure 96 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › normalizes malformed, absent and foreign resources without data leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 97 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › normalizes malformed, absent and foreign resources without data leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 98 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › normalizes malformed, absent and foreign resources without data leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 99 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › returns authoritative nulls for absent optional display projections

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 100 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › uses a safe presentation for unknown stored status without leaking the raw enum

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```


### Failure 101 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › strictly validates UTC, offset, microseconds and impossible calendar timestamps

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 102 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › is stable, reflects authoritative status/version changes and creates no side effects

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 103 — test/clinic-appointment-detail.e2e-spec.ts

```text
Clinic appointment detail HTTP authority and privacy › keeps technical failures distinct from empty, missing or successful reads

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      193 |   await resetBookingPersistence(database);
      194 |   await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[IDS.owner, IDS.employee, IDS.admin, IDS.revoked, IDS.missingMembership, IDS.veterinarian]]);
    > 195 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1, 'Detail LLC', 'Detail'), ($2, 'Other LLC', 'Other')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      196 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1, $2, 'Detail'), ($3, $2, 'Other location'), ($4, $5, 'Other clinic')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      197 |   await database.query(`
      198 |     INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/clinic-appointment-detail.e2e-spec.ts:195:3)
      at Object.<anonymous> (test/clinic-appointment-detail.e2e-spec.ts:57:5)
```

### Failure 104 — test/clinical-visit-completion-evidence-http.e2e-spec.ts

```text
Wave 3 Visit completion HTTP contract (real PostgreSQL) › commits exactly one visit-keyed clinical audit/outbox pair across replay and rejects failed/foreign attempts without evidence

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      83 | async function expectEvidence(db:DatabaseService,visitId:string,count:number){expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);}
      84 |
    > 85 | async function seed(db:DatabaseService){await db.query(`
         |                                         ^
      86 |  INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');
      87 |  INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');
      88 |  INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.foreignLocation}','${I.foreignClinic}','B');

      at node_modules/pg-pool/index.js:45:11
      at seed (test/clinical-visit-completion-evidence-http.e2e-spec.ts:85:41)
      at Object.<anonymous> (test/clinical-visit-completion-evidence-http.e2e-spec.ts:27:347)
```

### Failure 105 — test/clinical-visit-completion-evidence-http.e2e-spec.ts

```text
Wave 3 Visit completion HTTP contract (real PostgreSQL) › serializes completion when clinic deactivation wins first

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      83 | async function expectEvidence(db:DatabaseService,visitId:string,count:number){expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);}
      84 |
    > 85 | async function seed(db:DatabaseService){await db.query(`
         |                                         ^
      86 |  INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');
      87 |  INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');
      88 |  INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.foreignLocation}','${I.foreignClinic}','B');

      at node_modules/pg-pool/index.js:45:11
      at seed (test/clinical-visit-completion-evidence-http.e2e-spec.ts:85:41)
      at Object.<anonymous> (test/clinical-visit-completion-evidence-http.e2e-spec.ts:27:347)
```


### Failure 106 — test/clinical-visit-completion-evidence-http.e2e-spec.ts

```text
Wave 3 Visit completion HTTP contract (real PostgreSQL) › serializes completion when location deactivation wins first

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      83 | async function expectEvidence(db:DatabaseService,visitId:string,count:number){expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);}
      84 |
    > 85 | async function seed(db:DatabaseService){await db.query(`
         |                                         ^
      86 |  INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');
      87 |  INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');
      88 |  INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.foreignLocation}','${I.foreignClinic}','B');

      at node_modules/pg-pool/index.js:45:11
      at seed (test/clinical-visit-completion-evidence-http.e2e-spec.ts:85:41)
      at Object.<anonymous> (test/clinical-visit-completion-evidence-http.e2e-spec.ts:27:347)
```

### Failure 107 — test/clinical-visit-completion-evidence-http.e2e-spec.ts

```text
Wave 3 Visit completion HTTP contract (real PostgreSQL) › holds clinic authority until completion commits

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      83 | async function expectEvidence(db:DatabaseService,visitId:string,count:number){expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);}
      84 |
    > 85 | async function seed(db:DatabaseService){await db.query(`
         |                                         ^
      86 |  INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');
      87 |  INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');
      88 |  INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.foreignLocation}','${I.foreignClinic}','B');

      at node_modules/pg-pool/index.js:45:11
      at seed (test/clinical-visit-completion-evidence-http.e2e-spec.ts:85:41)
      at Object.<anonymous> (test/clinical-visit-completion-evidence-http.e2e-spec.ts:27:347)
```

### Failure 108 — test/clinical-visit-completion-evidence-http.e2e-spec.ts

```text
Wave 3 Visit completion HTTP contract (real PostgreSQL) › holds location authority until completion commits

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      83 | async function expectEvidence(db:DatabaseService,visitId:string,count:number){expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);}
      84 |
    > 85 | async function seed(db:DatabaseService){await db.query(`
         |                                         ^
      86 |  INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');
      87 |  INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');
      88 |  INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.foreignLocation}','${I.foreignClinic}','B');

      at node_modules/pg-pool/index.js:45:11
      at seed (test/clinical-visit-completion-evidence-http.e2e-spec.ts:85:41)
      at Object.<anonymous> (test/clinical-visit-completion-evidence-http.e2e-spec.ts:27:347)
```

### Failure 109 — test/clinic-appointments-registry-index.integration-spec.ts

```text
clinic appointments registry query indexes › applies the exact covering index definitions

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      181 |   await pool.query(`INSERT INTO identity_schema.users (id)
      182 |     VALUES ('86000000-0000-4000-8000-000000000001')`);
    > 183 |   await pool.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name)
          |   ^
      184 |     VALUES
      185 |       ('81000000-0000-4000-8000-000000000001', 'Registry Index LLC', 'Registry Index'),
      186 |       ('81000000-0000-4000-8000-000000000002', 'Noise LLC', 'Noise Clinic')`);

      at node_modules/pg-pool/index.js:45:11
      at resetAndSeed (test/clinic-appointments-registry-index.integration-spec.ts:183:3)
      at Object.<anonymous> (test/clinic-appointments-registry-index.integration-spec.ts:46:5)
```

### Failure 110 — test/clinic-appointments-registry-index.integration-spec.ts

```text
clinic appointments registry query indexes › uses bounded indexed access for upcoming

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      181 |   await pool.query(`INSERT INTO identity_schema.users (id)
      182 |     VALUES ('86000000-0000-4000-8000-000000000001')`);
    > 183 |   await pool.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name)
          |   ^
      184 |     VALUES
      185 |       ('81000000-0000-4000-8000-000000000001', 'Registry Index LLC', 'Registry Index'),
      186 |       ('81000000-0000-4000-8000-000000000002', 'Noise LLC', 'Noise Clinic')`);

      at node_modules/pg-pool/index.js:45:11
      at resetAndSeed (test/clinic-appointments-registry-index.integration-spec.ts:183:3)
      at Object.<anonymous> (test/clinic-appointments-registry-index.integration-spec.ts:46:5)
```


### Failure 111 — test/clinic-appointments-registry-index.integration-spec.ts

```text
clinic appointments registry query indexes › uses bounded indexed access for history

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      181 |   await pool.query(`INSERT INTO identity_schema.users (id)
      182 |     VALUES ('86000000-0000-4000-8000-000000000001')`);
    > 183 |   await pool.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name)
          |   ^
      184 |     VALUES
      185 |       ('81000000-0000-4000-8000-000000000001', 'Registry Index LLC', 'Registry Index'),
      186 |       ('81000000-0000-4000-8000-000000000002', 'Noise LLC', 'Noise Clinic')`);

      at node_modules/pg-pool/index.js:45:11
      at resetAndSeed (test/clinic-appointments-registry-index.integration-spec.ts:183:3)
      at Object.<anonymous> (test/clinic-appointments-registry-index.integration-spec.ts:46:5)
```

### Failure 112 — test/clinic-appointments-registry-index.integration-spec.ts

```text
clinic appointments registry query indexes › preserves keyset page two, ties, tenant isolation and output order for upcoming

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      181 |   await pool.query(`INSERT INTO identity_schema.users (id)
      182 |     VALUES ('86000000-0000-4000-8000-000000000001')`);
    > 183 |   await pool.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name)
          |   ^
      184 |     VALUES
      185 |       ('81000000-0000-4000-8000-000000000001', 'Registry Index LLC', 'Registry Index'),
      186 |       ('81000000-0000-4000-8000-000000000002', 'Noise LLC', 'Noise Clinic')`);

      at node_modules/pg-pool/index.js:45:11
      at resetAndSeed (test/clinic-appointments-registry-index.integration-spec.ts:183:3)
      at Object.<anonymous> (test/clinic-appointments-registry-index.integration-spec.ts:46:5)
```

### Failure 113 — test/clinic-appointments-registry-index.integration-spec.ts

```text
clinic appointments registry query indexes › preserves keyset page two, ties, tenant isolation and output order for history

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      181 |   await pool.query(`INSERT INTO identity_schema.users (id)
      182 |     VALUES ('86000000-0000-4000-8000-000000000001')`);
    > 183 |   await pool.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name)
          |   ^
      184 |     VALUES
      185 |       ('81000000-0000-4000-8000-000000000001', 'Registry Index LLC', 'Registry Index'),
      186 |       ('81000000-0000-4000-8000-000000000002', 'Noise LLC', 'Noise Clinic')`);

      at node_modules/pg-pool/index.js:45:11
      at resetAndSeed (test/clinic-appointments-registry-index.integration-spec.ts:183:3)
      at Object.<anonymous> (test/clinic-appointments-registry-index.integration-spec.ts:46:5)
```

### Failure 114 — test/clinic-appointments-registry-index.integration-spec.ts

```text
clinic appointments registry query indexes › supports rollback/reapply without data loss and keeps writes healthy

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      181 |   await pool.query(`INSERT INTO identity_schema.users (id)
      182 |     VALUES ('86000000-0000-4000-8000-000000000001')`);
    > 183 |   await pool.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name)
          |   ^
      184 |     VALUES
      185 |       ('81000000-0000-4000-8000-000000000001', 'Registry Index LLC', 'Registry Index'),
      186 |       ('81000000-0000-4000-8000-000000000002', 'Noise LLC', 'Noise Clinic')`);

      at node_modules/pg-pool/index.js:45:11
      at resetAndSeed (test/clinic-appointments-registry-index.integration-spec.ts:183:3)
      at Object.<anonymous> (test/clinic-appointments-registry-index.integration-spec.ts:46:5)
```

### Failure 115 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › lists only allowed scoped states with the eight-field projection

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```


### Failure 116 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes list denial for clinic admin

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 117 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes list denial for non-veterinarian

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 118 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes list denial for inactive membership

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 119 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes list denial for revoked membership

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 120 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes list denial for clinic scope mismatch

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```


### Failure 121 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes list denial for location scope mismatch

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 122 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes list denial for capability-shaped JWT claim without grant

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 123 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › returns allowed detail with the same projection

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 124 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes non-readable detail 70000000-0000-4000-8000-000000000006

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 125 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes non-readable detail 70000000-0000-4000-8000-000000000005

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```


### Failure 126 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes non-readable detail 70000000-0000-4000-8000-000000000007

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 127 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes non-readable detail 70000000-0000-4000-8000-000000000003

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 128 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes non-readable detail 70000000-0000-4000-8000-000000000004

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 129 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes detail denial for clinic admin

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 130 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes detail denial for non-veterinarian

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```


### Failure 131 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes detail denial for inactive membership

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 132 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes detail denial for revoked membership

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 133 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes detail denial for clinic scope mismatch

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 134 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes detail denial for location scope mismatch

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```

### Failure 135 — test/veterinarian-visit-read.e2e-spec.ts

```text
veterinarian visit read HTTP matrix › normalizes detail denial for capability-shaped JWT claim without grant

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      103 |   await database.query(`INSERT INTO identity_schema.users (id) VALUES ${[IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner].map((_, index) => `($${index + 1}::uuid)`).join(', ')}`, [IDS.vet, IDS.admin, IDS.receptionist, IDS.inactive, IDS.revoked, IDS.owner]);
      104 |   await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'Read pet', 'DOG')`, [IDS.pet, IDS.owner]);
    > 105 |   await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name) VALUES ($1::uuid, 'Read clinic', 'Read clinic'), ($2::uuid, 'Other clinic', 'Other clinic')`, [IDS.clinic, IDS.otherClinic]);
          |   ^
      106 |   await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1::uuid, $2::uuid, 'One'), ($3::uuid, $2::uuid, 'Two'), ($4::uuid, $5::uuid, 'Three')`, [IDS.location, IDS.clinic, IDS.otherLocation, IDS.otherClinicLocation, IDS.otherClinic]);
      107 |   await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at) VALUES ($1::uuid, $2::uuid, 'CLINIC_VETERINARIAN', true, NULL), ($3::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp()), ($4::uuid, $2::uuid, 'CLINIC_VETERINARIAN', false, clock_timestamp())`, [IDS.vet, IDS.location, IDS.inactive, IDS.revoked]);
      108 |   await database.query(`INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, $2::uuid, 'READ1', 'Read 1', 30), ($3::uuid, $4::uuid, 'READ2', 'Read 2', 30), ($5::uuid, $6::uuid, 'READ3', 'Read 3', 30)`, [IDS.service, IDS.location, IDS.otherService, IDS.otherLocation, IDS.otherClinicService, IDS.otherClinicLocation]);

      at node_modules/pg-pool/index.js:45:11
      at resetFixtures (test/veterinarian-visit-read.e2e-spec.ts:105:3)
      at Object.<anonymous> (test/veterinarian-visit-read.e2e-spec.ts:35:5)
```


### Failure 136 — test/clinical-result-readback-http.e2e-spec.ts

```text
Wave 3 canonical clinical Result readback (real PostgreSQL HTTP) › restores no Result, unique DRAFT, PUBLISHED Result and immutable Amendments without read mutation or scope leakage

    error: duplicate key value violates unique constraint "clinic_booking_contract_profile_audit_pkey"

      57 |
      58 | async function snapshot(db:DatabaseService,resultId:string){return(await db.query(`SELECT (SELECT row_to_json(r) FROM clinical_schema.visit_results r WHERE id=$1) result,(SELECT json_agg(row_to_json(a) ORDER BY created_at,id) FROM clinical_schema.visit_result_amendments a WHERE result_id=$1) amendments,(SELECT count(*)::int FROM clinical_schema.diary_entries WHERE source_result_id=$1 OR source_amendment_id IN(SELECT id FROM clinical_schema.visit_result_amendments WHERE result_id=$1)) diary,(SELECT count(*)::int FROM audit_schema.audit_log WHERE aggregate_id=$1 OR aggregate_id IN(SELECT id FROM clinical_schema.visit_result_amendments WHERE result_id=$1)) audit,(SELECT count(*)::int FROM booking_schema.outbox_events WHERE aggregate_id=$1 OR aggregate_id IN(SELECT id FROM clinical_schema.visit_result_amendments WHERE result_id=$1)) outbox`,[resultId])).rows[0];}
    > 59 | async function seed(db:DatabaseService){await db.query(`INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.foreignLocation}','${I.foreignClinic}','B');INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${I.vet}','${I.location}','CLINIC_VETERINARIAN'),('${I.admin}','${I.location}','CLINIC_ADMIN'),('${I.foreignVet}','${I.foreignLocation}','CLINIC_VETERINARIAN');INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30);INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp());INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG');INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','COMPLETED',clock_timestamp()+interval '1 hour');INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','COMPLETED');INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES('${I.visit}','${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.clinic}','${I.location}','${I.slot}','${I.vet}')`);}
         |                                         ^
      60 |

      at node_modules/pg-pool/index.js:45:11
      at seed (test/clinical-result-readback-http.e2e-spec.ts:59:41)
      at Object.<anonymous> (test/clinical-result-readback-http.e2e-spec.ts:18:342)
```

### Failure 137 — test/v15-appointment-lifecycle-http.e2e-spec.ts

```text
v1.5 appointment lifecycle real Nest runtime › converges V15_AUTO_CONFIRM create through the public runtime to authoritative Owner cancellation

    expect(received).toMatchObject(expected)

    - Expected  - 1
    + Received  + 0

      Object {
        "confirmationMode": "AUTOMATIC",
    -   "status": "CONFIRMED",
      }

      40 |   const f=await seedCreateProfile(db,profile),ownerToken=await token({sub:f.owner,roles:[Role.OWNER]}),clinicToken=await token(f.employee);
      41 |   const created=await request(app.getHttpServer()).post('/v1/booking-holds').set('Authorization',`Bearer ${ownerToken}`).set('Idempotency-Key',randomUUID()).send({petId:f.pet,clinicId:f.clinic,locationId:f.location,serviceId:f.service,slotId:f.slot,expectedSlotVersion:1}).expect(201);
    > 42 |   expect(created.body).toMatchObject({status:initialStatus,confirmationMode});
         |                        ^
      43 |   let aggregateVersion=created.body.aggregateVersion;
      44 |   if(profile==='MVP_V1_MANUAL'){
      45 |    const confirmed=await request(app.getHttpServer()).post(`/v1/clinic/booking-holds/${created.body.holdId}/confirm`).set('Authorization',`Bearer ${clinicToken}`).set('Idempotency-Key',randomUUID()).set('If-Match',String(aggregateVersion)).expect(200);

      at test/v15-appointment-lifecycle-http.e2e-spec.ts:42:24
```

### Failure 138 — test/v15-appointment-lifecycle-http.e2e-spec.ts

```text
v1.5 appointment lifecycle real Nest runtime › converges MVP_V1_MANUAL create through the public runtime to authoritative Owner cancellation

    expect(received).toMatchObject(expected)

    - Expected  - 2
    + Received  + 1

      Object {
    -   "confirmationMode": "MANUAL",
    -   "status": "PENDING_CONFIRMATION",
    +   "confirmationMode": "AUTOMATIC",
      }

      40 |   const f=await seedCreateProfile(db,profile),ownerToken=await token({sub:f.owner,roles:[Role.OWNER]}),clinicToken=await token(f.employee);
      41 |   const created=await request(app.getHttpServer()).post('/v1/booking-holds').set('Authorization',`Bearer ${ownerToken}`).set('Idempotency-Key',randomUUID()).send({petId:f.pet,clinicId:f.clinic,locationId:f.location,serviceId:f.service,slotId:f.slot,expectedSlotVersion:1}).expect(201);
    > 42 |   expect(created.body).toMatchObject({status:initialStatus,confirmationMode});
         |                        ^
      43 |   let aggregateVersion=created.body.aggregateVersion;
      44 |   if(profile==='MVP_V1_MANUAL'){
      45 |    const confirmed=await request(app.getHttpServer()).post(`/v1/clinic/booking-holds/${created.body.holdId}/confirm`).set('Authorization',`Bearer ${clinicToken}`).set('Idempotency-Key',randomUUID()).set('If-Match',String(aggregateVersion)).expect(200);

      at test/v15-appointment-lifecycle-http.e2e-spec.ts:42:24
```

### Failure 139 — test/owner-auth-core.integration-spec.ts

```text
T018 Owner OTP and opaque session core (PostgreSQL) › creates, cools down, resends and supersedes old verifier material

    expect(received).not.toBe(expected) // Object.is equality

    Expected: not "246810"

      56 |     const newCode = delivery.latestCode();
      57 |     expect(resent.challengeId).toBe(first.challengeId);
    > 58 |     expect(newCode).not.toBe(oldCode);
         |                         ^
      59 |     await expect(service.verifyOtp({ challengeId: first.challengeId, code: oldCode })).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
      60 |     await expect(service.verifyOtp({ challengeId: first.challengeId, code: newCode })).resolves.toMatchObject({ sessionToken: expect.stringMatching(/^vh_/), owner: { id: expect.any(String) } });
      61 |   });

      at Object.<anonymous> (test/owner-auth-core.integration-spec.ts:58:25)
```

### Failure 140 — test/clinic-queue.integration-spec.ts

```text
ClinicQueueService › publishes a manual clinic confirmation as the authoritative owner status

    expect(received).resolves.not.toHaveProperty(path)

    Expected path: not "state"

    Received value: "CONFIRMED"

      105 |       sub: fixture.ownerId,
      106 |       roles: [Role.OWNER],
    > 107 |     })).resolves.not.toHaveProperty('state');
          |                      ^
      108 |   });
      109 |
      110 |   it('allows the next actionable hold after the queue head SLA has expired', async () => {

      at Object.toHaveProperty (node_modules/expect/build/index.js:2140:20)
      at Object.<anonymous> (test/clinic-queue.integration-spec.ts:107:22)

[Nest] 34107  - 10/07/2026, 8:30:18 PM    WARN [CapabilityEvaluatorService] capability_denied reason=location-scope
```


### Failure 141 — test/v15-clinic-contract-profile-migration.integration-spec.ts

```text
v1.5 clinic contract profile migration (real PostgreSQL) › applies the complete canonical chain on a fresh database

    expect(received).toThrow()

    Received function did not throw

      35 |       expect(columns.rows.find((row) => row.column_name === 'booking_contract_profile')?.column_default)
      36 |         .toContain('MVP_V1_MANUAL');
    > 37 |       expect(() => migrate('down', databaseUrl, migrationDir)).toThrow();
         |                                                                ^
      38 |       const ledger = await client.query(`SELECT name FROM public.schema_migrations WHERE name='1719680000000_fence_reschedule_target_slot'`);
      39 |       expect(ledger.rows).toHaveLength(1);
      40 |       const retained = await client.query(`

      at test/v15-clinic-contract-profile-migration.integration-spec.ts:37:64
      at withDatabase (test/v15-clinic-contract-profile-migration.integration-spec.ts:135:5)
      at Object.<anonymous> (test/v15-clinic-contract-profile-migration.integration-spec.ts:20:5)
```

### Failure 142 — test/v15-clinic-contract-profile-migration.integration-spec.ts

```text
v1.5 clinic contract profile migration (real PostgreSQL) › upgrades populated current schema, audits policy changes and refuses destructive schema rollback

    Command failed: /workspace/backend/node_modules/.bin/node-pg-migrate up --migrations-dir /tmp/vethelp-v15-migrations-biIFFp --migrations-schema public --migrations-table schema_migrations --single-transaction
    Error: Not run migration 1719630000000_add_clinic_booking_contract_profile is preceding already run migration 1719690000000_add_clinical_visit_result_foundation

      110 |
      111 | function migrate(direction: 'up' | 'down', databaseUrl: string, migrationDir: string): void {
    > 112 |   execFileSync(join(process.cwd(), 'node_modules/.bin/node-pg-migrate'), [
          |               ^
      113 |     direction,
      114 |     '--migrations-dir', migrationDir,
      115 |     '--migrations-schema', 'public',

      at checkOrder (file:/workspace/backend/node_modules/node-pg-migrate/dist/bundle/index.js:3718:13)
      at runner (file:/workspace/backend/node_modules/node-pg-migrate/dist/bundle/index.js:3786:7)
      at migrate (test/v15-clinic-contract-profile-migration.integration-spec.ts:112:15)
      at test/v15-clinic-contract-profile-migration.integration-spec.ts:60:7
      at withDatabase (test/v15-clinic-contract-profile-migration.integration-spec.ts:135:5)
      at Object.<anonymous> (test/v15-clinic-contract-profile-migration.integration-spec.ts:50:5)
```

### Failure 143 — test/clinical-result-cardinality-migration.integration-spec.ts

```text
Wave 3 one Result per Visit migration › upgrades a real Wave 2 database and keeps the clinical foundation unchanged

    Command failed: /workspace/backend/node_modules/.bin/node-pg-migrate up --migrations-dir migrations/node-pg --migrations-schema public --migrations-table schema_migrations --single-transaction --ignore-pattern (\..*|1719(69|70|71|72).*)
    Error executing:

      CREATE SCHEMA medical_schema;
      ALTER TABLE booking_schema.appointments ADD CONSTRAINT appointments_medical_context_key UNIQUE(id,owner_id,pet_id,clinic_location_id);
      ALTER TABLE clinic_schema.clinic_locations ADD CONSTRAINT clinic_locations_medical_context_key UNIQUE(id,clinic_id);
      ALTER TABLE clinical_schema.visit_results ADD CONSTRAINT results_medical_owner_key UNIQUE(id,owner_id,pet_id);
      ALTER TABLE clinical_schema.visit_result_amendments ADD CONSTRAINT amendments_medical_owner_key UNIQUE(id,owner_id,pet_id);
      ALTER TABLE pet_schema.pet_documents ADD CONSTRAINT documents_medical_owner_key UNIQUE(id,owner_id,pet_id);
      CREATE TABLE medical_schema.appointment_data_shares (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id uuid NOT NULL, owner_id uuid NOT NULL, pet_id uuid NOT NULL,
        clinic_id uuid NOT NULL, location_id uuid NOT NULL,
        status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','REVOKED')),
        version integer NOT NULL DEFAULT 1 CHECK(version>0),
        idempotency_key uuid NOT NULL, request_json jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        correlation_id uuid NOT NULL,
        revoked_at timestamptz, revoke_idempotency_key uuid, revoke_expected_version integer,
        UNIQUE(owner_id,idempotency_key), UNIQUE(id,owner_id,pet_id),
        FOREIGN KEY(appointment_id,owner_id,pet_id,location_id) REFERENCES booking_schema.appointments(id,owner_id,pet_id,clinic_location_id),
        FOREIGN KEY(location_id,clinic_id) REFERENCES clinic_schema.clinic_locations(id,clinic_id),
        CHECK((status='ACTIVE' AND version=1 AND revoked_at IS NULL AND revoke_idempotency_key IS NULL AND revoke_expected_version IS NULL)
          OR (status='REVOKED' AND version=2 AND revoked_at IS NOT NULL AND revoked_at>=created_at AND revoke_idempotency_key IS NOT NULL AND revoke_expected_version=1))
      );
      CREATE TABLE medical_schema.appointment_data_share_resources (
        share_id uuid NOT NULL, owner_id uuid NOT NULL, pet_id uuid NOT NULL,
        resource_type text NOT NULL CHECK(resource_type IN('RESULT','AMENDMENT','DOCUMENT')),
        resource_id uuid NOT NULL,
        result_id uuid, amendment_id uuid, document_id uuid,
        PRIMARY KEY(share_id,resource_type,resource_id),
        FOREIGN KEY(share_id,owner_id,pet_id) REFERENCES medical_schema.appointment_data_shares(id,owner_id,pet_id),
        FOREIGN KEY(result_id,owner_id,pet_id) REFERENCES clinical_schema.visit_results(id,owner_id,pet_id),
        FOREIGN KEY(amendment_id,owner_id,pet_id) REFERENCES clinical_schema.visit_result_amendments(id,owner_id,pet_id),
        FOREIGN KEY(document_id,owner_id,pet_id) REFERENCES pet_schema.pet_documents(id,owner_id,pet_id),
        CHECK((resource_type='RESULT' AND result_id=resource_id AND result_id IS NOT NULL AND amendment_id IS NULL AND document_id IS NULL)
          OR (resource_type='AMENDMENT' AND amendment_id=resource_id AND amendment_id IS NOT NULL AND result_id IS NULL AND document_id IS NULL)
          OR (resource_type='DOCUMENT' AND document_id=resource_id AND document_id IS NOT NULL AND result_id IS NULL AND amendment_id IS NULL))
      );
      CREATE INDEX appointment_data_shares_read_idx ON medical_schema.appointment_data_shares(appointment_id,clinic_id,location_id) WHERE status='ACTIVE';
      CREATE TABLE medical_schema.share_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),share_id uuid NOT NULL REFERENCES medical_schema.appointment_data_shares(id),
        event_type text NOT NULL CHECK(event_type IN('medical.share.granted','medical.share.revoked')),
        actor_id uuid NOT NULL REFERENCES identity_schema.users(id),correlation_id uuid NOT NULL,
        resource_refs jsonb NOT NULL,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        UNIQUE(share_id,event_type)
      );
      CREATE FUNCTION medical_schema.protect_sharing_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'MEDICAL_SHARE_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
        IF TG_TABLE_NAME<>'appointment_data_shares' THEN RAISE EXCEPTION 'MEDICAL_SHARE_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
        IF OLD.status<>'ACTIVE' OR NEW.status<>'REVOKED' OR NEW.version<>OLD.version+1
          OR (to_jsonb(NEW)-ARRAY['status','version','revoked_at','revoke_idempotency_key','revoke_expected_version']) IS DISTINCT FROM
             (to_jsonb(OLD)-ARRAY['status','version','revoked_at','revoke_idempotency_key','revoke_expected_version'])
        THEN RAISE EXCEPTION 'MEDICAL_SHARE_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER shares_immutable BEFORE UPDATE OR DELETE ON medical_schema.appointment_data_shares FOR EACH ROW EXECUTE FUNCTION medical_schema.protect_sharing_evidence();
      CREATE TRIGGER share_resources_immutable BEFORE UPDATE OR DELETE ON medical_schema.appointment_data_share_resources FOR EACH ROW EXECUTE FUNCTION medical_schema.protect_sharing_evidence();
      CREATE TRIGGER share_events_immutable BEFORE UPDATE OR DELETE ON medical_schema.share_events FOR EACH ROW EXECUTE FUNCTION medical_schema.protect_sharing_evidence();
      CREATE FUNCTION medical_schema.validate_share_resource() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.resource_type='RESULT' AND NOT EXISTS(SELECT 1 FROM clinical_schema.visit_results WHERE id=NEW.result_id AND status='PUBLISHED')
          THEN RAISE EXCEPTION 'MEDICAL_RESOURCE_NOT_ELIGIBLE' USING ERRCODE='23514'; END IF;
        IF NEW.resource_type='DOCUMENT' AND NOT EXISTS(SELECT 1 FROM pet_schema.pet_documents WHERE id=NEW.document_id AND doc_type IN('PASSPORT','HISTORY'))
          THEN RAISE EXCEPTION 'MEDICAL_RESOURCE_NOT_ELIGIBLE' USING ERRCODE='23514'; END IF;
        IF NOT EXISTS(SELECT 1 FROM medical_schema.appointment_data_shares WHERE id=NEW.share_id AND status='ACTIVE')
          THEN RAISE EXCEPTION 'MEDICAL_SHARE_NOT_ACTIVE' USING ERRCODE='23514'; END IF;
        IF EXISTS(SELECT 1 FROM medical_schema.share_events WHERE share_id=NEW.share_id AND event_type='medical.share.granted')
          THEN RAISE EXCEPTION 'MEDICAL_SHARE_SNAPSHOT_SEALED' USING ERRCODE='23514'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER share_resources_validate BEFORE INSERT ON medical_schema.appointment_data_share_resources FOR EACH ROW EXECUTE FUNCTION medical_schema.validate_share_resource();
    ;
    error: schema "clinical_schema" does not exist

    > Rolling back attempted migration ...
    error: schema "clinical_schema" does not exist

      28 | async function seed(c:Client){await c.query(`INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}');INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic');INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A');INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30);INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp());INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG');INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','COMPLETED',clock_timestamp()+interval '1 hour');INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','COMPLETED');INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES('${I.visit}','${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.clinic}','${I.location}','${I.slot}','${I.vet}')`);}
      29 | function sha(path:string){return createHash('sha256').update(readFileSync(path)).digest('hex');}
    > 30 | function run(direction:'up'|'down',url:string,target?:string,wave2Only=false){const args:string[]=[direction];if(target)args.push(target);args.push('--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction');if(wave2Only)args.push('--ignore-pattern','(\\..*|1719(69|70|71|72).*)');execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),args,{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url},stdio:'pipe'});}
         |                                                                                                                                                                                                                                                                                                                                                                                  ^
      31 |

      at node_modules/pg/lib/client.js:652:17
      at async Object.query (file:/workspace/backend/node_modules/node-pg-migrate/dist/bundle/index.js:3499:14)
      at async runner (file:/workspace/backend/node_modules/node-pg-migrate/dist/bundle/index.js:3806:9) {
        length: 105,
        severity: 'ERROR',
        code: '3F000',
        detail: undefined,
        hint: undefined,
        position: undefined,
        internalPosition: undefined,
        internalQuery: undefined,
        where: undefined,
        schema: undefined,
        table: undefined,
        column: undefined,
        dataType: undefined,
        constraint: undefined,
        file: 'namespace.c',
        line: '3096',
        routine: 'get_namespace_oid'
      }
      at run (test/clinical-result-cardinality-migration.integration-spec.ts:30:370)
      at Object.<anonymous> (test/clinical-result-cardinality-migration.integration-spec.ts:16:54)
```

### Failure 144 — src/workers/hold-expiration.service.spec.ts

```text
HoldExpirationService lifecycle › runs one shared interval and retries after a failed scheduled cycle

    expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 0

      27 |     service.onModuleInit();
      28 |     service.onModuleInit();
    > 29 |     expect(jest.getTimerCount()).toBe(1);
         |                                  ^
      30 |
      31 |     await jest.advanceTimersByTimeAsync(15_000);
      32 |     expect(error).toHaveBeenCalledWith(

      at Object.<anonymous> (src/workers/hold-expiration.service.spec.ts:29:34)

[Nest] 34107  - 10/07/2026, 8:30:53 PM     LOG [HoldExpirationService] Expired 1 hold(s)
[Nest] 34107  - 10/07/2026, 8:30:53 PM     LOG [HoldExpirationService] Expired 2 hold(s)
```

### Failure 145 — test/appointment-medical-sharing-migration.e2e-spec.ts

```text
Wave4A additive migration on populated Wave3 (Docker PostgreSQL) › preserves previous records and creates empty sharing authority, with matching checksums

    error: W7A_RESULT_DIARY_COHERENCE_INVALID

      28 |       await upgraded.query(`INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES($1,$2,$3,$4,$5,$6,'COMPLETED')`,[appointment,hold,owner,pet,location,slot]);
      29 |       await upgraded.query(`INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$4)`,[visit,appointment,hold,owner,pet,clinic,location,slot]);
    > 30 |       await upgraded.query(`INSERT INTO clinical_schema.visit_results(id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,status,clinical_summary,idempotency_key,created_at,updated_at,published_at) VALUES($1,$2,$3,$4,$5,$6,$3,'PUBLISHED','Preserved Wave3 published result',$7,now(),now(),now())`,[result,visit,owner,pet,clinic,location,randomUUID()]);
         |       ^
      31 |       await upgraded.query(`INSERT INTO clinical_schema.visit_result_amendments(id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$4,'Preserved Wave3 amendment',$8)`,[amendment,result,visit,owner,pet,clinic,location,randomUUID()]);
      32 |       const clinicalBefore=(await upgraded.query(`SELECT row_to_json(v) visit,row_to_json(r) result,row_to_json(a) amendment FROM clinical_schema.visits v JOIN clinical_schema.visit_results r ON r.visit_id=v.id JOIN clinical_schema.visit_result_amendments a ON a.result_id=r.id WHERE v.id=$1`,[visit])).rows;
      33 |       const before=(await upgraded.query('SELECT row_to_json(p) pet FROM pet_schema.pets p WHERE id=$1',[pet])).rows[0];

      at node_modules/pg/lib/client.js:652:17
      at Object.<anonymous> (test/appointment-medical-sharing-migration.e2e-spec.ts:30:7)
```

Fresh reviews are deferred until mandatory regression and clients pass. BP-11 known gap: Owner displayName:null; BP-12 accepted MATCH. Current reconciliation verdict FIX_REQUIRED; no final Wave4A acceptance implied.
