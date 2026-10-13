import pathlib,subprocess,json,hashlib,runpy,sys
R=pathlib.Path('/var/folders/ys/ypbk3mr54jqcwm2520hzs0ph0000gn/T/v15-w4b-02-20261011-2ajw4xh6');W=R/'worktree';E=W/'docs/testing/evidence/wave4b-02-20261011';base='57f0a54d82df34322542c874f309bc687c66fb7b'
def git(*a):return subprocess.check_output(['git',*a],cwd=W)
sys.argv=['snapshot','read-only'];ns=runpy.run_path('/tmp/v15-w4a-publish-verify.py');snapshot=ns['snapshot']();expected=json.loads(pathlib.Path('/tmp/v15-w4a-publish-preservation.json').read_text());assert snapshot==expected
assert len(snapshot['files'])==674
assert git('rev-parse','HEAD').decode().strip()==base
assert not git('diff','--cached','--name-only').strip()
old=json.loads(git('show',base+':backend/artifacts/openapi/swagger.json'));new=json.loads((W/'backend/artifacts/openapi/swagger.json').read_text());prefix='/v1/owner/pets/{petId}/documents/{documentId}/ocr/candidates/{candidateId}/review'
added=[p for p in new['paths'] if p.startswith(prefix)];assert len(added)==5
for p in added:del new['paths'][p]
p='/v1/owner/pets/{petId}/documents/{documentId}/ocr';new['paths'][p]['get']['responses']['200']['content']['application/json']['schema']['properties']['result']['properties']['candidate']['properties']['reviewState']=old['paths'][p]['get']['responses']['200']['content']['application/json']['schema']['properties']['result']['properties']['candidate']['properties']['reviewState']
assert new==old,'unapproved OpenAPI delta'
assert git('diff','--name-only',base,'--','backend/migrations/node-pg').decode()==''
# Existing job mutation methods are byte-identical: only read projection changed.
oldcode=git('show',base+':backend/src/auth/owner-ocr.service.ts').decode();newcode=(W/'backend/src/auth/owner-ocr.service.ts').read_text()
assert oldcode[oldcode.index('  async retry'):]==newcode[newcode.index('  async retry'):]
subprocess.run(['git','diff','--check'],cwd=W,check=True)
summary={'originalWorktreeEntries':674,'originalSnapshotUnchanged':True,'originalSnapshotSha256':hashlib.sha256(json.dumps(snapshot,sort_keys=True).encode()).hexdigest(),'implementationHead':base,'indexEmpty':True,'historicalMigrationSourcesUnchanged':True,'jobRetryClaimFinishUnchanged':True,'openapiDelta':'5 new paths; raw candidate reviewState enum only; all other contracts identical','diffCheck':'PASS'}
(E/'preservation-contract-verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
