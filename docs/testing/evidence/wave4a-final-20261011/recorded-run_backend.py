import pathlib,subprocess,json,time,sys,os
R=pathlib.Path(__file__).parent;W=R/'worktree';E=W/'docs/testing/evidence/wave4a-final-20261011';E.mkdir(parents=True,exist_ok=True)
P='v15-w4a-final-v88ucbla';PG=P+'-postgres';NET=P+'-net';DEP=P+'-deps'
def call(args,log):
 with (E/log).open('w') as f:r=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT)
 if r.returncode: print('FAIL',log,r.returncode,flush=True);raise SystemExit(r.returncode)
def docker_node(cmd,log,db='vethelp_wave3_final_base',profile='PILOT_V1',workers='false',name='setup'):
 env={'DATABASE_URL':f'postgres://closure:closure-test-only@postgres:5432/{db}','JWT_ISSUER':'vethelp-closure-test','JWT_AUDIENCE':'vethelp-closure-test','NODE_ENV':'test','MVP_SCOPE_PROFILE':profile,'WORKERS_ENABLED':workers,'WAVE4_ACCEPTANCE':'true','JWT_SECRET':'closure-jwt-synthetic-at-least-32-bytes','AUTH_OTP_PEPPER':'closure-otp-synthetic-distinct-32-bytes','AUTH_OTP_ANTI_FRAUD_PEPPER':'closure-antifraud-synthetic-distinct-32-bytes','OWNER_PET_IDEMPOTENCY_HMAC_KEY':'closure-pet-synthetic-distinct-32-bytes','WORKER_SERVICE_TOKEN':'closure-worker-synthetic-distinct-32-bytes'}
 args=['docker','run','--name',P+'-'+name,'--network',NET,'--cpuset-cpus','0-3','-v',str(W)+':/workspace','-v',DEP+':/workspace/backend/node_modules:ro','-w','/workspace/backend']
 for k,v in env.items():args+=['-e',k+'='+v]
 args+=['node:22-bookworm',*cmd];call(args,log)
if sys.argv[1]=='setup':
 (E/'task-brief.md').write_text('''# V15-W4A-FINAL-CLOSURE\nBase a1c092ec695d0fb9945e324c96db30914e131830. C3/R3 complex budget. Root sole writer; three read-only reviewers for distinct veto domains. Original worktree and674 snapshot entries immutable. Allowed: isolated test/evidence/current-state changes. No production repair, commit/push/OCR/Wave5/Jira/main. Verify remaining authority/client/migration/consolidated gaps. Reuse sticky PASS incl T044, accepted selected-source proof and focused delivery. Independent reviews must examine executed results. On failure classify and report exact reproduction/bounded repair; no broad repair loop.\n''')
 call(['docker','ps','-a','--format','{{json .}}'],'containers-before.jsonl')
 call(['docker','network','create',NET],'network.log');call(['docker','volume','create',P+'-pgdata'],'pg-volume.log');call(['docker','volume','create',DEP],'dep-volume.log')
 call(['docker','run','--rm','-v','pethelp-wave4a_vethelp-backend-node-modules:/from:ro','-v',DEP+':/to','node:22-bookworm','cp','-a','/from/.','/to/'],'dep-copy.log')
 call(['docker','run','-d','--name',PG,'--network',NET,'--network-alias','postgres','--cpuset-cpus','0-3','-e','POSTGRES_USER=closure','-e','POSTGRES_PASSWORD=closure-test-only','-e','POSTGRES_DB=vethelp_wave3_final_base','-v',P+'-pgdata:/var/lib/postgresql/data','postgres:16-alpine'],'postgres-create.log')
 for i in range(30):
  if subprocess.run(['docker','exec',PG,'pg_isready','-U','closure'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(1)
 else:raise SystemExit('POSTGRES_NOT_READY')
 docker_node(['npm','run','migrate:up'],'fresh-migrations.log',name='migrate')
 docker_node(['npm','run','migrate:verify'],'fresh-checksums.log',name='checksums')
 docker_node(['npm','run','build'],'backend-build.log',name='build')
 docker_node(['node','node_modules/jest/bin/jest.js','--listTests','--json','--runInBand','--testPathPatterns=src|test/(booking|v15|clinical|appointment-medical|clinic-(queue|appointment)|veterinarian|owner-(auth|pet|clinic))'],'suite-list.json',name='list')
 call(['docker','exec',PG,'psql','-U','closure','-d','vethelp_wave3_final_base','-c','SELECT name FROM schema_migrations ORDER BY name;'],'migration-ledger.txt')
 print('SETUP PASS',E,flush=True)
elif sys.argv[1]=='regression':
 suites=[x.replace('/workspace/backend/','') for x in json.loads((E/'suite-list.json').read_text())]
 sticky={'test/appointment-medical-sharing-http.e2e-spec.ts':71,'test/booking-core-performance.integration-spec.ts':9,'test/clinical-foundation-migration.integration-spec.ts':2,'test/v15-clinic-contract-profile-migration.integration-spec.ts':2,'test/clinical-result-cardinality-migration.integration-spec.ts':1,'test/appointment-medical-sharing-contract.spec.ts':26,'src/common/pet-document-storage.spec.ts':3,'src/auth/owner-pet.service.spec.ts':4}
 legacyTitles=['polls the authoritative version after a missed non-terminal update','proposes an alternative idempotently','denies clinic proposal across role','normalizes foreign owner read','accepts once, replays the same key','denies foreign-owner accept','rejects expired, stale and conflicted accepts','requires If-Match for propose-alternative','rejects impossible future version for propose-alternative','serializes request-notes-vs-propose']
 pattern='|'.join(legacyTitles);schedule=[]
 for s in suites:
  if s in sticky:continue
  lane='LEGACY_COMPAT' if s.startswith('src/') or s in ['test/clinic-queue.integration-spec.ts','test/booking-outbox-replay.integration-spec.ts','test/booking-history.integration-spec.ts'] else 'PILOT_V1'
  if s=='test/clinic-queue-http-authority.e2e-spec.ts':schedule.extend([(s,'PILOT_V1','^(?!.*('+pattern+'))'),(s,'LEGACY_COMPAT',pattern)])
  else:schedule.append((s,lane,None))
 (E/'regression-plan.json').write_text(json.dumps({'base':'a1c092ec695d0fb9945e324c96db30914e131830','sticky':sticky,'schedule':schedule},indent=2))
 results=[]
 for i,(s,lane,selector) in enumerate(schedule,1):
  db=f'vethelp_wave3_reconcile_final_03_{i:03d}';call(['docker','exec',PG,'psql','-U','closure','-d','postgres','-v','ON_ERROR_STOP=1','-c',f'CREATE DATABASE "{db}" TEMPLATE vethelp_wave3_final_base;'],f'regression-{i:03d}-db.log')
  workers='true' if s=='src/workers/hold-expiration.service.spec.ts' else 'false'
  cmd=['node','node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath',s,'--passWithNoTests=false','--json',f'--outputFile=/workspace/docs/testing/evidence/wave4a-final-20261011/regression-{i:03d}.json']
  if selector:cmd+=['--testNamePattern='+selector]
  # HTTP authentication suite imports fixed local verifier before beforeAll.
  if s=='test/owner-auth-http.e2e-spec.ts':cmd=['env','AUTH_DEV_OTP_CODE=246810',*cmd]
  start=time.time()
  try:docker_node(cmd,f'regression-{i:03d}.log',db,lane,workers,f'regression-03-{i:03d}')
  except SystemExit:
   results.append({'suite':s,'lane':lane,'db':db,'status':'FAIL','log':f'regression-{i:03d}.log','exitCode':1});(E/'regression-summary.json').write_text(json.dumps(results,indent=2));raise
  j=json.loads((E/f'regression-{i:03d}.json').read_text());row={'suite':s,'lane':lane,'db':db,'status':'PASS','exitCode':0,'passed':j['numPassedTests'],'failed':j['numFailedTests'],'pending':j['numPendingTests'],'durationSeconds':round(time.time()-start,2),'log':f'regression-{i:03d}.log','json':f'regression-{i:03d}.json'};results.append(row)
  (E/'regression-summary.json').write_text(json.dumps(results,indent=2));print(i,'/',len(schedule),s,row['passed'],'PASS',flush=True)
 print('CONSOLIDATED FRESH DONE',sum(x['passed'] for x in results),'tests;',len(results),'executions;',len(sticky),'sticky suites',flush=True)
