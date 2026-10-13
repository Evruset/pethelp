# V15-W4B-03A-04 — Active drain and deployment readiness evidence

Acceptedbase23653ebb69690171d27b7fdbbe9646a914b3c435; isolatedbranch agent/v15-w4b-03a-04-drain-wdlk821n. Rootsolewriter. Productioncode/migrations/deploymentconfig byte-identical tobase; no enablement/provider/import/UI/sharing/historychange. No commits/push.

## Executed checks

10 unique operational checks PASS,0unresolvedFAIL:5actualworker active-drain/recovery scenarios +5restore checks. Counts are scenarios, not sums of their many repeated assertions. Exact stage/output data in active-drain-results.json, restore-generation-results.json and shutdown-observations.json. OwnerCORRECT+CONFIRM fixture uses exactseededjob and preserves two exactrevisions, includedinrestoreverification rather than separatelydoublecounted.

| Active scenario | Observed outcome | Budget and qualification |
|---|---|---|
| SIGTERM activeprovider | Gracefulcompletion, exactlyoneimmutablepublication | Initialshutdown40s; signal-to-final3.979s |
| SIGTERM blockedprovider | Accepted30stimeout, FAILED→QUEUED→SUCCEEDEDretry | Initialshutdown40s PASS; separate recovery25s; combined45.729s, not40s |
| SIGTERM preCOMMIT | Zeroexternallyvisiblepartialrows, releasebarrier thenatomicresult | Initialshutdown40s; signal-to-final3.551s |
| Expiredlease withstalledoldprocess | Actual60sleaseexpiry; ABANDONED→newSUCCEEDED; oldprocessresumeswithoutoverwrite | After-expirysignal-to-final7.247s; freshstale-completionfenceNOT_PROVEN; accepted141fencing reused |
| SIGKILL incompletepreCOMMITdrain | Exit137, zero partialrows/audit, accepted60slease recovery toonepublication | Overallobservation80s; signal-to-final65.546s |

Allfinaljobs SUCCEEDED, one result/candidate/receipt/binding/successaudit each, legacyPet preserved. Gracefulinitial/recovery exits0 verifiedfromDockerstate. Testconsumer only; not productionOCR. Synchronizationusesactualprovider/preCOMMITmarkers in separatelyloadedtesthook; acceptedcompiledworker handles signals/claims/transactions. Hookdoesnot interceptNestshutdown or alterlease/retry/timeout. preCOMMITbarrier sits before actualCOMMITsend in anopenrealPGtransaction; it is not a servercrashduringWALflush test. Sourcecode and receiptprotocol unchanged.

Restorechecks: exact14tableDB/Objectgeneration, including73migrationchecksums; healthyfourversions withactualworkerrestart; missing and mismatch rejectedbyCLI and actualworkerstartup; controlledpersistentfilesystem/PGcontainerrestart withfourbytehashes/lengths and allprovenance unchanged. Fullpreflight onpersistentbindvolume DENIED becauseactualflags ro,relatime lacknosuid/nodev/noexec. A narrowerreadonlyrehash before/afterrestart PASS doesnot grant verifiedprocessingeligibility. No power-loss durability or productionrestore proof. Originalpublishedobjects retained; faultinjection usescopies only.

backendbuild PASS(build.log);3CJS syntax+2PythonAST PASS;gitdiffcheck PASS. Accepted31/141 and earliermigration/OpenAPI/protocolgates REUSED_STICKY_PASS whereunchanged, not rerun/countedasfresh.342trackedproduction/schema/deploymentfiles byte-identical tobase; no newmigration/API. Original674dirtyentriesbyte-identical, preserved digest inchecks.json.

## Readiness and decisions

Source-backed actualDocker/alphaKubernetes gapmatrix and targetsequence: docs/v15/23-wave4b-03a-04-active-drain-deployment-readiness.md. Missingseparateworkload/authority-scopedsecrets, privateimmutablevolume, workerreadiness, finitewholetransaction/close shutdown bound and targetrestoreproof. Existingalpha30sgrace isnot provenwhole-drainbudget; separatelyapproved targetprotocol required. Separatecontainers and samenumericUID do not proveprincipal separation.

Retention/backup/revocation/deletion/legaldependency worksheet and exactrealadapter checklist: docs/v15/24-wave4b-03a-04-retention-and-adapter-decision-pack.md. No retentionperiod, purgeapproval, legalcompliance or realprovideraccuracy invented.

OPERATIONAL_ACTIVE_DRAIN=PASS_ISOLATED_ONLY
DB_RECOVERY_ROLLBACK=PASS_ISOLATED_ONLY
RESTORE_DURABILITY=PASS_LOGICAL_RESTORE_ONLY
PERSISTENT_FILESYSTEM_RESTART=PASS_CONTROLLED_RESTART_REHASH_ONLY
PERSISTENT_VERIFIED_PROCESSING_RESUMPTION=DENIED_UNSAFE_MOUNT_PROFILE
PRODUCTION_STORAGE_ISOLATION=NOT_VERIFIED
PRODUCTION_WRITER_WORKER_SEPARATION=NOT_VERIFIED
PHYSICAL_DURABILITY_AND_PRODUCTION_RESTORE=NOT_VERIFIED
RETENTION_POLICY=PENDING_PRODUCT_OWNER_DECISION
REAL_OCR_ADAPTER_ACCEPTANCE=NOT_ACCEPTED
WAVE4B_03A_COMPLETE=NO
WAVE4B_03B_READY=NO
OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT

Humanacceptance NOT_RECORDED. FreshDB,Security andOperations NO VETO for isolatedscope.
WAVE4B_03A_04_MACHINE_CANDIDATE=YES
WAVE4B_03A_04_READY_FOR_PO_REVIEW=YES

## Reproduction and provenance

Set W4B04_TASK_ROOT to newlycreatedexclusive taskroot containingworktree, then run backend/test/operational/run-active-drain.py setup and drain; runrun-restore-generation.py. Neverreuseexistingresourceprefix exceptexplicitresumeofsameknownrun. Setupcopies previouslyaccepted syntheticbackup/objectarchive/deps fromtestowned03A03resources; hashes inresource-profile.json bind exactgeneration. No retainedacceptanceDBwrites. Newresourceprefix v15-w4b03a04-wdlk821n, PostgreSQL16/Node22/UID1000/private tmpfs/ROworker, syntheticcredentialsonly. Backups/objectpayloads/markercontroldirs/buildoutputs/deps remainoutsideevidence.

Initial persistentreconcile denial retained; initialhelper exitedthere afterfirstfourrestorechecks. --resume-persistent revalidatedexistingevidence anddidonlypersistenttail, withoutrepeatingpassedactive/restorechecks. Initialexecutedrunner/helper sources preservedseparately; finalhelper adds exitcodeassertion, exactjobreviewbinding andcoverage/commentclarification. Sourcecorrections test-only; no productionrepairs. SOURCE/evidence checksums inMANIFEST.json andSHA256SUMS.

Efficiency ACCEPTABLE: rootsolewriter,threefreshdistinctreviewdomains,zerochildwriters; twoboundedtest-harnesshardeningbatches (identity/exactfixture and deadlineassertions), oneevidence-drivenpersistentenvironmentresume. Noaccepted31/141reruns. Discoveryfrozen afterknownfiles; finalpackagingfromexecutedevidence. Exacttool/filetotals unavailable acrossgoalcontinuations, no inventedtoken/usagecount.

Operationsreview totalbudgetfinding repaired in test-onlyrunner: explicit40s initialdeadline and separate65sblocked/80slease-recovery totalassertions. Existingmeasurements independentlyPASS in total-budget-verification.json, no runtime replay. HistoricalJSON unchanged; originalshutdownBudgetSeconds40 doesnot includeblockedretry.
