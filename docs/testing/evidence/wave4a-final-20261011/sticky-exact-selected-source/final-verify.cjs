const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const dir=__dirname, root='/Users/evrusetskiy/work/pethelp-v15-wave-01', candidate='/tmp/pethelp-t044-candidate.X05Hh7/candidate';
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(cwd,...args)=>cp.execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const snapshot=read(dir+'/snapshot.json');
assert.equal(git(candidate,'write-tree'),snapshot.gitTree);
git(candidate,'diff','--cached','--check');git(candidate,'diff','--check');
for(const [file,hash] of Object.entries(snapshot.selectedFileHashes)) assert.equal(sha(fs.readFileSync(candidate+'/'+file)),hash,file);
assert.equal(Object.keys(snapshot.selectedFileHashes).length,34);
assert(!fs.readFileSync(candidate+'/backend/test/booking-core-performance.integration-spec.ts','utf8').includes('diagnostics'));
const old=read(dir+'/../validation/original-preservation-before.json');
const permitted='docs/v15/13-wave4a-regression-reconciliation.md';
for(const f of old.files){const file=root+'/'+f.path,b=fs.readFileSync(file),s=fs.lstatSync(file);assert.equal(s.mode,f.mode,f.path);assert.equal(b.length,f.bytes-(f.path===permitted?1:0),f.path);assert.equal(sha(b),f.path===permitted?snapshot.newDocumentSha256:f.sha256,f.path);}
assert.equal(git(root,'diff','--cached','--binary'),old.index.trim());
assert.equal(cp.execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}),old.status);
const special=fs.lstatSync(root+'/....');assert(special.isFile()&&!special.isSymbolicLink());assert.equal(special.size,0);assert.equal(git(root,'ls-files','--','....'),'');
const local=git(root,'rev-parse','HEAD'),remote=git(root,'rev-parse','origin/agent/v15-transition-wave-01');assert.equal(local,remote);assert.equal(local,snapshot.sourceSnapshot.base);
const hist=read(dir+'/history-jest-results.json');assert.equal(hist.numPassedTests,5);assert.equal(hist.numFailedTests,0);assert.equal(hist.numPendingTests,0);
const runs=[];
const oldThresholds=read(root+'/docs/testing/evidence/wave4a-t044-20261011-4cpu/run-1/results.json').thresholds;
for(let n=1;n<=3;n++){
 const p=dir+'/run-'+n,r=read(p+'/results.json'),j=read(p+'/jest-results.json'),before=read(p+'/node-before.json'),after=read(p+'/node-after.json'),container=read(p+'/container.json');
 assert.equal(j.numTotalTests,9);assert.equal(j.numPassedTests,9);assert.equal(j.numFailedTests,0);assert.equal(j.numPendingTests,0);assert.equal(j.numTodoTests||0,0);
 assert(j.testResults.every(s=>s.assertionResults.every(t=>t.status==='passed')));
 assert.deepEqual(r.thresholds,oldThresholds);
 assert.equal(r.environment.poolMax,20);assert.equal(r.environment.cpuCount,4);assert.equal(r.environment.node,'v22.23.1');assert(r.environment.postgres.version.includes('16.14'));
 for(const [f,h] of Object.entries(r.sourceHashes))assert.equal(h,snapshot.sourceSnapshot.sourceHashes[f]);
 assert.equal(r.dirtySnapshotSha256,snapshot.selectionPatchSha256);
 for(const res of [before,after]){assert.equal(res.availableParallelism,4);assert.equal(res.cpuCount,4);assert.equal(res.node,'v22.23.1');assert.equal(res.memoryBytes,8221097984);assert.equal(res.cgroup['cpuset.cpus.effective'],'0-3');assert.equal(res.cgroup['cpu.max'],'max 100000');assert.equal(res.diagnosticsModule,null);assert.equal(res.diagnosticsDirectory,null);assert(res.cgroup['cpu.stat'].includes('nr_throttled 0'));assert(res.cgroup['memory.events'].includes('oom_kill 0'));}
 assert.equal(container.exitCode,0);assert.equal(container.restartCount,0);assert.equal(container.oomKilled,false);
 const b=r.profiles.find(x=>x.name==='multi-capacity-5-of-30'),d=r.profiles.find(x=>x.name==='idempotency-storm-100');
 assert.equal(b.requests,30);assert.equal(b.concurrency,30);assert.equal(b.successes,5);assert.equal(b.controlledConflicts,25);assert(b.p95Ms<=2000);
 for(const key of ['capacity','held','activeHolds','holds','createdEvents','createdAudits'])assert.equal(b.invariants[key],5);
 assert.equal(d.requests,100);assert.equal(d.concurrency,100);assert.equal(d.successes,100);assert.equal(d.controlledConflicts,0);
 for(const key of ['held','activeHolds','holds','createdEvents','createdAudits'])assert.equal(d.invariants[key],1);
 assert.equal(d.invariants.stableReplays,100);assert.equal(d.invariants.postBurstReplay,true);assert.equal(d.invariants.changedFingerprintCode,'IDEMPOTENCY_CONFLICT');
 for(const profile of r.profiles){assert.equal(profile.unexpectedFailures,0);for(const key of ['overbooked','counterDrift','poolInUseAfter','poolWaitingAfter'])assert.equal(profile.invariants[key],0,profile.name+':'+key);}
 const pg=fs.readFileSync(p+'/postgres-final-state.txt','utf8');assert(pg.includes('t044_exact_11c_run'+n+' |         0 |          0 |          0 |           1'));assert(!pg.includes('idle in transaction'));
 runs.push({run:n,passed:9,failed:0,skipped:0,Bp95Ms:b.p95Ms,DinitialSuccesses:d.successes,Dp95Ms:d.p95Ms,capacityAcquisitions:5,idempotentMutations:1,invariants:'PASS',deadlocks:0,poolLeaks:0,unexpectedFailures:0,cpu:4,cpuset:'0-3',node:before.node,postgres:'16.14'});
}
const retained=fs.readFileSync(dir+'/containers-before.jsonl','utf8').trim().split('\n').map(JSON.parse);
for(const r of retained){const current=JSON.parse(cp.execFileSync('docker',['inspect',r.ID],{encoding:'utf8'}))[0];assert(current.Id.startsWith(r.ID));assert.equal(current.State.Status,r.State,r.Names);}
const result={verdict:'EXACT_CANDIDATE_VALIDATED / READY_FOR_OWNER_SIGNOFF',local,remote,gitTree:snapshot.gitTree,sourceSnapshotSha256:snapshot.sourceSnapshotSha256,candidateSnapshotSha256:snapshot.candidateSnapshotSha256,originalPreservation:{filesChecked:old.files.length,otherFilesUnchanged:old.files.length-1,indexUnchanged:true,statusUnchanged:true,knownEmptyFilePreserved:true},selectedFileHashesUnchanged:true,retainedContainersPreserved:retained.length,historical:{passed:5,failed:0,skipped:0},runs,ownerApproval:'PENDING',workingTree:'DIRTY',wave4A:'PARTIAL',wave4B:'NOT STARTED',commitPush:'NOT PERFORMED'};
fs.writeFileSync(dir+'/summary.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
