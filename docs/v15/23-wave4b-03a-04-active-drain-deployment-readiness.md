# W4B-03A-04 — Deployment readiness audit (isolated verification and target plan)

Accepted baseline23653ebb69690171d27b7fdbbe9646a914b3c435. This is repository-source audit, not target-environment acceptance. Full task continuation received. Executed evidence is scoped to isolated synthetic mechanics; production readiness remains NOT_VERIFIED. No production manifests/runtime/source implementation modified; explicit test-only harness files added. No credentials provisioned or production service restarted.

## Observed deployment versus required controls

| Item | Required target contract | Repository observation | Classification |
|---|---|---|---|
| Publisher UID/GID | Explicit nonroot identity and protected canonical root compatible with accepted file-owner checks | Dockerfile USERnode; alpha pod/container runAsUser1000/runAsGroup1000; no byte-storage mount | IMPLEMENTED for declaredalphaUID/GID; NOT_VERIFIED actualruntime; REQUIRES_INFRA_CHANGE storage |
| Separate worker identity | Dedicated non-HTTP process plus independent OS/storage/DB authorities; container separation alone insufficient | Image defaults HTTPmain; composeapi WORKERS_ENABLED=true; alpha one backend container | MISSING deployment; TESTED_ISOLATED03A03 process/mount split only |
| Private root and ancestors | Absolute canonical root; no symlink or group/world-writable ancestor; root0700/currentUID under accepted reader | document-byte-snapshots.ts enforces; alpha mounts only memory/tmp; no configured canonical snapshotvolume | IMPLEMENTED applicationchecks; MISSING targetstorage; NOT_VERIFIED hostACL |
| Immutable/create-only publication | Enforced append/version-preserving storage permission, no replace/chmod/delete capability for publisher | O_EXCL/fsync/readback/mode0400 application primitive; owner of RWstorage canchmod/replace | REQUIRES_INFRA_CHANGE; NOT_VERIFIED OSimmutability |
| Worker readonly source access | RO mount, no same-filesystemRWalias, capdropALL/noNewPrivs, protected root; independentprincipal policy | preflight.ts checksisolatedprofile; alpha capdropALL/noescalation/ROrootfs but hasno snapshotsmount | TESTED_ISOLATED03A03; MISSING workerdeployment; NOT_VERIFIED targetmounts |
| Trusted DBwriter | Dedicated NOINHERIT login, executor membershiponly, no directtablegrants or schemaCREATE; appmustnot beexecutor |171977executorprotocol+preflight implemented; targetmanifests reference oneDATABASE_URL only | IMPLEMENTED protocol; TESTED_ISOLATED03A03; REQUIRES_INFRA_CHANGE provisioning |
| Secrets | Worker receives dedicatedwriterURL and minimalreaderURL only; publishernever receives writersecret; rotate/revoke underseparatecontrol | alphaExternalSecret aggregatesbackendsecrets into one envFrom; no OCR_BYTE_DATABASE_URL or workersecret | MISSING role-scopeddistribution; NOT_VERIFIED externalstorepolicy; nosecretvalueaudit |
| Startup/readiness | Gate after schema/identity/mount/restore reconciliation; workerhealth must use non-HTTP contract without accidentalAPI | onModuleInitpreflight and fixedOCR_WORKER_READY; alpha probes HTTP/v1/health for combinedbackend | IMPLEMENTED isolatedstartup; MISSING workerreadinessprobe; NOT_VERIFIED orchestration |
| Shutdown budget | Stop newclaims immediately; awaitactive or enforce approvedcancellation/kill; budget covers provider+DBcommit+poolclose+margin | worker stopclearsinterval/awaitactive/close; provider default30000ms; DBcommit/poolclose not explicitlybounded; alpha grace30s | MISSING provenwhole-shutdownbudget; activejobtests TESTED_ISOLATED; targetgrace NOT_VERIFIED |
| Recoverable generation | Versionedconsistent DBbackup/objectinventory+digests/length/provenance/decisions; stoppedwriters or consistentcapture; reconcile before resume |03A03logicalrestore tested in tmpfs; alpha only/tmpmemory, no durablebytevolume/backupcontract | TESTED_ISOLATED logicalonly; REQUIRES_INFRA_CHANGE durability; NOT_VERIFIED physicalrestore |
| Production enablement | OFF until separateauthorizations and actualtargetevidence; never NODE_ENV=test asproductionworkaround | operationalRole accepts onlytest+ISOLATED_TEST_V1+explicitmarker; Docker/alphaNODE_ENVproduction | IMPLEMENTED failclosed; production remainsdisabled |

Distinct OSuserprincipals currently conflict with accepted snapshotreader's currentUID-owned file/root requirements; designing shared storage access for a different numericworkerUID requires separately reviewed compatibleauthority design, not merely changing runAsUser. SameUID in separate namespaces is not distinctprincipalproof.

Existing alpha30sgrace is not an approved OCRshutdownbudget: provider timeoutalone is30s, plus DBlocking/COMMIT/close and scheduling overhead. Do not increase acceptedlease60s, retrycap3 or provider30s solely to pass tests. Record measured behavior and safe forcedtermination/recovery under acceptedfencing. Any futuregrace value must derive from explicitboundeddependencies and executedtest evidence, not an invented constant.

## Executed active-drain verification matrix — TESTED_ISOLATED

Use actual compiled workerentrypoint with exclusivePG/storage and trusted testconsumer hooks outsideproductionprovider. Verify stage by externally observable synchronization, not sleeponly. Every case checks job/attemptstates, result/candidate/receipt/binding/audit counts and identities, originalPetmedicalhistory unchanged, terminalimmutability, no permanentstuckjob.

1. SIGTERM afterclaim duringactiveconsumer; releaseconsumer within declaredtestshutdownbudget. Expect gracefulexit and exactlyoneatomicacceptedresult.
2. SIGTERM withconsumerblocked; holdpastaccepted30stimeout. Expect boundedproviderfailure/cleanup, nofalseSUCCEEDED and lateracceptedretry/recovery.
3. SIGTERM whilepersistence approachesCOMMIT, with ownedDBbarrier. Verify beforeCOMMIT no externalpartialresult/receipt/binding/audit; afterrelease oneatomicresult, orkill+rollback followedbyboundedrecovery.
4. Secondworker eligibleafteractual60sleaseexpiry whilefirstworker remainsunfinished. Verify oldattempt cannot overwrite newerterminalresult. Do notedit timestamps orshortenlease tosimulateelapsedtime.
5. SIGKILL afterincompletedrain. Inspect connectiontermination rollback and nofalsepartialsuccess; subsequentworker usesacceptedlease/retryrules, no lostsuccessaudit orduplicateeffect.

Timeoutprovider alone doesnot bound DBcommitwait. Runtime outcome B may requireorchestratorexplicitSIGKILLbudget followedbyrealleaseexpiry/recovery. Testconsumerconsumption evidence must remain TEST_CONSUMER; simulation remains SIMULATED_METADATA_ONLY. No productionOCRproof.

## Deferred decisions

Targetcluster/storagebackend/ACLcapabilities and approval of productionprincipals remain unavailable. Retention duration/purge remains ProductOwnerdecision. Physicaldurability/productionrestore not verified. Activejobdrain now TESTED_ISOLATED only; humanacceptance NOT_RECORDED. Realadapter/import/clinicalvalidation/sharingeligibility remain separate.

OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT
WAVE4B_03A_COMPLETE=NO
WAVE4B_03B_READY=NO

## Executed outcomes and scope

Five actual workerprocess scenarios PASS (active, blocked, preCOMMIT, expired/stalled, SIGKILL). Each external observer saw zero partial result/candidate/receipt/binding/success-audit before publication and one of each after recovery. Pet legacy data remained unchanged. Active and preCOMMIT completion fit40s initial shutdown budget. Blocked provider respected accepted30s timeout, initial worker exited within40s, and total signal-to-recovered-result observation was45.729s under a separate25s recovery window. SIGKILL exit137 rolled back open transaction; accepted60s lease expired naturally and recovery completed in65.546s under80s observation budget. No lease/retry/provider threshold modified.

Expired SIGSTOP case observes actual60s lease, ABANDONED old attempt, one successful new attempt, then old-process resume with no overwrite. It does NOT newly prove an actual stale-completion request reached the DB fence: provider timeout can win on resume. Existing accepted141 fencing tests remain sticky. Historical outcome label FENCED_OLD_ATTEMPT in raw JSON must be read with this qualification.

Five restore checks PASS: recoverable generation manifest and exact14-table hashes; healthy worker eligibility; missing and mismatched object denial by reconciliation and actualstartup; persistent-filesystem controlledrestart rehash. Four document versions/objects, receipts/results/audit and exact Ownerdecisions survive. All testclaimers stopped beforecapture; private originalobjects retained; no purge.

Persistent namedvolume survives controlled PostgreSQLcontainer restart and a newreadonlyreaderprocess with allfour bytehashes/lengths/provenance preserved. Its actualmount flags were ro,relatime, missingnosuid/nodev/noexec; fulloperationalpreflight correctlydenied verifiedprocessing. Separate directread-only rehash observation is NOT workerprocessing eligibility. tmpfs restore and persistentcontainerrestart are neither power-loss nor realproductiondurability proof.

## Target implementation sequence (plan only)

1. Confirm actual targetcluster/storage/operator ownership and legal/privacy boundaries. Keep OCR_VERIFIED_BYTES_ENABLED absent/false and NODE_ENVproduction. Never set NODE_ENVtest to bypass current production denial.
2. Choose a storageauthority design with enforced create-only/immutable version protection, root/ancestor ACLs, encryption/backup generation and workerread-only capability. Currentacceptedpublisher/worker UID1000/GID1000 is an exact compatibilityrequirement, not securityprincipal separation. Different OSUID requires separately reviewed snapshot-access design; no numericnewUID is silently chosen here.
3. Provision independent application/reader/writer logins outsidethisgoal, matching171977 and preflight exactallowlists. Ordinary app/reader is notexecutor member; writerNOINHERIT has no directtable grants and only executor membership. Distribute writersecret solely to nonHTTPworker, publishernever receives it; remove unrelated applicationsecrets from worker. Validateactualcatalog using leastprivilege reader, never invent credentials inGit.
4. Prepare separatedeployment workload and runtimeidentity/mountadmission policy; do not use existing combinedAPI manifest asverifiedOCR readiness. Design nonHTTP readiness/heartbeat and stale-health failclosed checks around actualpreflight and loopstate. Current READYlog alone is not an orchestrator healthprotocol.
5. Target shutdown contract: stopclaims onSIGTERM; awaitactive;40s is the exercised isolated initialwaitbudget, not a production guarantee. At expiry enforce termination viaorchestrator with separatelyapprovedgrace/killsequence and verify boundedlease recovery. AcceptedDBCOMMIT/close has no explicitfinitecap, so no production terminationGracePeriod value can yet be approved from these tests. Existingalpha30s is insufficient as a whole-drain guarantee. No productionmanifest value changed.
6. Validate common DB/object generation restore, fullstartup reconciliation and immutableprovenance against actualpersistentstorage; execute separatelyapproved power-failure/storage/restore and processfailure drills. Retentionpolicy remainsPO/legal/privacy decision (doc24), not an implementationdefault.
7. Submit target-specific evidence and realadapter checklist (docs22/24) for separateapproval. Future productionprofile acceptance and validatedimport authority are independent; no readiness implied by thisplan.

OPERATIONAL_ACTIVE_DRAIN=PASS_ISOLATED_ONLY
RESTORE_DURABILITY=PASS_LOGICAL_RESTORE_ONLY
PERSISTENT_FILESYSTEM_RESTART=PASS_CONTROLLED_RESTART_REHASH_ONLY
PERSISTENT_VERIFIED_PROCESSING_RESUMPTION=DENIED_UNSAFE_MOUNT_PROFILE
PRODUCTION_STORAGE_ISOLATION=NOT_VERIFIED
PRODUCTION_WRITER_WORKER_SEPARATION=NOT_VERIFIED
PHYSICAL_DURABILITY_AND_PRODUCTION_RESTORE=NOT_VERIFIED
RETENTION_POLICY=PENDING_PRODUCT_OWNER_DECISION
REAL_OCR_ADAPTER_ACCEPTANCE=NOT_ACCEPTED

Evidence: docs/testing/evidence/wave4b-03a-04-20261012/REPORT.md and source/evidence manifest. No humanacceptance or deploymentauthorized by machinePASS.

FreshDB/DataAuthority,Security/Privacy andOperations/Architecture reviews: NO VETO for boundedisolatedscope. Explicitfutureharness totaldeadline assertions added; recordedtimings independentlyvalidated withoutreplayingpassedprocesses.
WAVE4B_03A_04_MACHINE_CANDIDATE=YES
WAVE4B_03A_04_READY_FOR_PO_REVIEW=YES
Humanacceptance NOT_RECORDED.
