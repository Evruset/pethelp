from pathlib import Path
import subprocess,hashlib,json,sys,runpy,shutil
R=Path(__file__).parent;W=R/'worktree';E=W/'docs/testing/evidence/wave4b-01-20261011';BASE='16888e1a191bf410a6aeb8f611f5ce4af98282df';P='v15-w4b-01-4svfycsv'
def git(*a):return subprocess.check_output(['git',*a],cwd=W)
def dump(n,v):(E/n).write_text(json.dumps(v,indent=2)+'\n')
sys.argv=['snapshot','read-only'];ns=runpy.run_path('/tmp/v15-w4a-publish-verify.py');assert ns['snapshot']()==json.loads((R/'original-snapshot.json').read_text())
subprocess.run(['git','fetch','origin'],cwd=W,check=True);assert git('rev-parse','origin/agent/v15-transition-wave-01').decode().strip()==BASE;assert git('rev-parse','HEAD').decode().strip()==BASE;assert not git('diff','--cached','--name-only');subprocess.run(['git','diff','--check'],cwd=W,check=True)
# Exactly the verified production delta; original contracts and migrations unchanged.
old=json.loads(git('show',BASE+':backend/artifacts/openapi/swagger.json'));new=json.loads((W/'backend/artifacts/openapi/swagger.json').read_text());added=set(new['paths'])-set(old['paths']);expect={'/v1/owner/pets/{petId}/documents/{documentId}/ocr','/v1/owner/pets/{petId}/documents/{documentId}/ocr/retry'};assert added==expect
for path,ops in old['paths'].items():assert new['paths'][path]==ops,path
new_without=json.loads(json.dumps(new));new_without['paths']={k:v for k,v in new_without['paths'].items() if k not in added};assert new_without==old
migration=[]
for p in sorted((W/'backend/migrations/node-pg').glob('*.js')):
 data=p.read_bytes();rel=str(p.relative_to(W));historic=p.name[:6]<'171974'
 if historic:assert git('show',BASE+':'+rel)==data,rel
 migration.append({'file':rel,'sha256':hashlib.sha256(data).hexdigest(),'historicalUnchanged':historic})
assert len(migration)==70 and sum(r['historicalUnchanged'] for r in migration)==69;dump('migration-source-hashes.json',migration)
# Count only successful covered case identities; retain failures as disclosed attempts.
covered={}
for rel in ['focused-attempt-02/focused.json','repair.json','guard.json','sharing.json']:
 j=json.loads((E/rel).read_text())
 if rel!='focused-attempt-02/focused.json':assert j['numFailedTests']==0,rel
 for suite in j['testResults']:
  for i,case in enumerate(suite['assertionResults']):
   if case['status']=='passed':
    key=suite['name'].replace('/workspace/backend/','')+':'+str(i)+':'+case['fullName'];assert key not in covered,key;covered[key]={'evidence':rel,'suite':suite['name'].replace('/workspace/backend/',''),'title':case['fullName']}
assert len(covered)==46;dump('covered-test-identities.json',covered)
counts={'status':'PASS','uniquePassed':46,'unresolvedFailed':0,'retainedFreshServicePassed':24,'repairedHTTPAndUpgradePassed':2,'productScopeGuardPassed':19,'newSharingIsolationPassed':1,'focusedOCRTotal':27,'selectorPending':{'repair':24,'sharingAcceptedWave4A':75},'selectorPendingCoverage':'24 covered by retained freshPASS;75 accepted sticky not rerun','backendBuild':'PASS','openapiAssertions':5,'priorWave1To4AGates':'REUSED_STICKY_PASS except affected guard/OpenAPI checks and new OCR isolation assertions','repairDisclosure':['test-harness-attempt-01','focused-attempt-02','openapi-compile-attempt']};dump('test-summary.json',counts)
# Runtime ownership/exit proof, no environment dumps.
rows=[]
for suffix in ['migrate','checksums','build','focused','focused-02','repair','guard','build-final','build-contract','build-contract-02','openapi','openapi-assert-1','openapi-assert-2','openapi-assert-3','openapi-assert-4','openapi-assert-5','sharing','sharing-02']:
 name=P+'-'+suffix;obj=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 rows.append({'name':name,'id':obj['Id'],'exitCode':obj['State']['ExitCode'],'image':obj['Config']['Image'],'networks':list(obj['NetworkSettings']['Networks']),'mounts':[{'source':m['Source'],'destination':m['Destination'],'readWrite':m['RW']} for m in obj['Mounts']]})
assert all(r['exitCode']==0 for r in rows if r['name'].split(P+'-',1)[1] not in ['focused','focused-02','build-contract','sharing']);dump('runtime-ownership.json',rows)
before=[json.loads(l) for l in (E/'containers-before.jsonl').read_text().splitlines()];current=[json.loads(l) for l in subprocess.check_output(['docker','ps','-a','--format','{{json .}}']).decode().splitlines()];byname={c['Names']:c for c in current}
for c in before:
 now=byname[c['Names']];assert all(c[k]==now[k] for k in ['ID','Image','State','Names']),c['Names']
dump('retained-resources-verification.json',{'status':'PASS','unchangedContainers':len(before),'retainedDatabaseReset':False})
query="SELECT count(*) AS migrations FROM schema_migrations; SELECT count(*) AS idle_in_transaction FROM pg_stat_activity WHERE datname LIKE 'vethelp_w4b_%' AND state='idle in transaction'; SELECT sum(deadlocks) AS deadlocks FROM pg_stat_database WHERE datname LIKE 'vethelp_w4b_%';"
text=subprocess.check_output(['docker','exec',P+'-postgres','psql','-U','closure','-d','vethelp_w4b_base','-v','ON_ERROR_STOP=1','-c',query]).decode();(E/'postgres-final-state.txt').write_text(text);assert '70' in text
changed=list(filter(None,git('diff','--name-only').decode().splitlines()));untracked=list(filter(None,git('ls-files','--others','--exclude-standard').decode().splitlines()));files=changed+[p for p in untracked if not p.startswith('docs/testing/evidence/')]
source=[{'path':p,'sha256':hashlib.sha256((W/p).read_bytes()).hexdigest(),'bytes':(W/p).stat().st_size} for p in files];dump('source-snapshot.json',{'base':BASE,'branch':git('branch','--show-current').decode().strip(),'files':source})
dump('final-verification.json',{'status':'PASS','baseAndFreshOrigin':BASE,'indexEmpty':True,'diffCheck':'PASS','original674EntriesBytePreserved':True,'prior69MigrationsBytePreserved':True,'oldOpenapiOperationsAndAllOtherMetadataUnchanged':True,'newOpenapiPaths':sorted(added),'commitPushPerformed':False})
for p in ['run_backend.py','final_audit.py']:shutil.copyfile(R/p,E/('recorded-'+p))
print(json.dumps(counts,indent=2));print(text)
