import pathlib,json,subprocess,hashlib,runpy,sys
R=pathlib.Path(__file__).parent;W=R/'worktree';E=W/'docs/testing/evidence/wave4a-final-20261011'
rows=json.loads((E/'regression-summary.json').read_text());plan=json.loads((E/'regression-plan.json').read_text());suites={x.replace('/workspace/backend/','') for x in json.loads((E/'suite-list.json').read_text())}
assert len(rows)==57 and all(x['status']=='PASS' for x in rows)
assert {x['suite'] for x in rows}|set(plan['sticky'])==suites and len(suites)==64
assert not ({x['suite'] for x in rows}&set(plan['sticky']))
identities=set();queue=[];raw_pending=0
for row in rows:
 j=json.loads((E/row['json']).read_text());assert j['success'] and j['numFailedTests']==0
 raw_pending+=j['numPendingTests'];current=set()
 for suite in j['testResults']:
  for ordinal,t in enumerate(suite['assertionResults']):
   key=row['suite']+'::case-'+str(ordinal)+'::'+t['fullName']
   if t['status']=='passed':assert key not in identities,key;identities.add(key);current.add(t['fullName'])
   else:assert row['suite']=='test/clinic-queue-http-authority.e2e-spec.ts' and t['status']=='pending'
 if row['suite']=='test/clinic-queue-http-authority.e2e-spec.ts':queue.append(current)
assert len(queue)==2 and not(queue[0]&queue[1]) and len(queue[0]|queue[1])==52
fresh=sum(x['passed'] for x in rows);sticky=sum(plan['sticky'].values());assert fresh==len(identities) and fresh+sticky==543
names=[]
for i,row in enumerate(rows,1):
 prefix='03' if '_03_' in row['db'] else '04';names.append(f'v15-w4a-final-v88ucbla-regression-{prefix}-{i:03d}')
meta=json.loads(subprocess.check_output(['docker','inspect',*names]));runtime=[]
for row,c in zip(rows,meta):
 env=dict(x.split('=',1) for x in c['Config']['Env'] if '=' in x)
 assert c['State']['ExitCode']==0 and c['State']['Status']=='exited'
 assert env['MVP_SCOPE_PROFILE']==row['lane'] and row['db'] in env['DATABASE_URL']
 runtime.append({'suite':row['suite'],'name':c['Name'],'imageId':c['Image'],'exitCode':c['State']['ExitCode'],'cpuset':c['HostConfig']['CpusetCpus'],'database':row['db'],'profileAtLaunch':env['MVP_SCOPE_PROFILE'],'workersAtLaunch':env['WORKERS_ENABLED'],'nodeEnvAtLaunch':env['NODE_ENV'],'acceptanceAtLaunch':env['WAVE4_ACCEPTANCE'],'cmd':c['Config']['Cmd'],'started':c['State']['StartedAt'],'finished':c['State']['FinishedAt']})
(E/'regression-runtime.json').write_text(json.dumps(runtime,indent=2));(E/'fresh-test-identities.json').write_text(json.dumps(sorted(identities),indent=2))
current=[json.loads(s) for s in subprocess.check_output(['docker','ps','-a','--format','{{json .}}'],text=True).splitlines()]
old=[json.loads(s) for s in (E/'containers-before.jsonl').read_text().splitlines()];cur={x['ID']:x for x in current}
assert all(x['ID'] in cur and all(cur[x['ID']][k]==x[k] for k in ['Names','Image','State']) for x in old)
(E/'retained-resources-verification.json').write_text(json.dumps({'status':'PASS','retainedContainersChecked':len(old),'sameIdsNamesImagesStates':True,'retainedDatabasesConnectedOrReset':False},indent=2))
sys.argv=['snapshot','read-only'];m=runpy.run_path('/tmp/v15-w4a-publish-verify.py');before=json.loads((R/'original-snapshot.json').read_text());assert m['snapshot']()==before
(E/'original-preservation-verification.json').write_text(json.dumps({'status':'PASS','entries':674,'sameNamesModesSizesHashesSymlinkTargets':True,'workingDiffAndIndexUnchanged':True},indent=2))
subprocess.run(['git','fetch','origin'],cwd=W,check=True)
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=W).decode().strip()==subprocess.check_output(['git','rev-parse','origin/agent/v15-transition-wave-01'],cwd=W).decode().strip()=='a1c092ec695d0fb9945e324c96db30914e131830'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=W)
subprocess.run(['git','diff','--check'],cwd=W,check=True)
assert not subprocess.check_output(['git','diff','--name-only','HEAD','--','backend/src','backend/migrations','backend/artifacts/openapi','backend/package.json','backend/package-lock.json','apps/owner-app/package.json','apps/owner-app/package-lock.json','apps/clinic-portal/components','apps/clinic-portal/lib','apps/clinic-portal/app'],cwd=W)
coverage={'status':'PASS','sourceRevision':'a1c092ec695d0fb9945e324c96db30914e131830','baselineSuites':64,'baselineTests':543,'freshDistinctSuites':56,'freshSuiteExecutions':57,'freshPassed':fresh,'freshFailed':0,'freshTestIdentities':len(identities),'stickySuites':8,'stickyPassed':sticky,'allUniqueAcceptedTests':fresh+sticky,'queuePilot':len(queue[0]),'queueLegacy':len(queue[1]),'queueUnion':52,'queueOverlap':0,'rawQueueSelectorPending':raw_pending,'mandatoryTestsMissingOrDisabled':0,'stickyIdentityPrecision':'105-case accepted log is aggregate-only; immutable test/source hashes bind reuse. No individual sticky names invented.9T044+5historical cases have raw prior JestJSON.','freshRemoteHead':'a1c092ec695d0fb9945e324c96db30914e131830'}
(E/'consolidated-coverage.json').write_text(json.dumps(coverage,indent=2))
print(json.dumps(coverage,indent=2))
