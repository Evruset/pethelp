import pathlib,subprocess,json,time,sys,os
R=pathlib.Path(__file__).parent;W=R/'worktree';E=W/'docs/testing/evidence/wave4b-01-20261011';E.mkdir(parents=True,exist_ok=True)
P='v15-w4b-01-4svfycsv';PG=P+'-postgres';NET=P+'-net';DEP=P+'-deps'
def call(args,log):
 with (E/log).open('w') as f:r=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT)
 if r.returncode: print('FAIL',log,r.returncode,flush=True);raise SystemExit(r.returncode)
def docker_node(cmd,log,db='vethelp_w4b_base',profile='PILOT_V1',workers='false',name='setup'):
 env={'DATABASE_URL':f'postgres://closure:closure-test-only@postgres:5432/{db}','JWT_ISSUER':'vethelp-closure-test','JWT_AUDIENCE':'vethelp-closure-test','NODE_ENV':'test','MVP_SCOPE_PROFILE':profile,'WORKERS_ENABLED':workers,'WAVE4_ACCEPTANCE':'true','JWT_SECRET':'closure-jwt-synthetic-at-least-32-bytes','AUTH_OTP_PEPPER':'closure-otp-synthetic-distinct-32-bytes','AUTH_OTP_ANTI_FRAUD_PEPPER':'closure-antifraud-synthetic-distinct-32-bytes','OWNER_PET_IDEMPOTENCY_HMAC_KEY':'closure-pet-synthetic-distinct-32-bytes','WORKER_SERVICE_TOKEN':'closure-worker-synthetic-distinct-32-bytes'}
 args=['docker','run','--name',P+'-'+name,'--network',NET,'--cpuset-cpus','0-3','-v',str(W)+':/workspace','-v',DEP+':/workspace/backend/node_modules:ro','-w','/workspace/backend']
 for k,v in env.items():args+=['-e',k+'='+v]
 args+=['node:22-bookworm',*cmd];call(args,log)
if sys.argv[1]=='setup':
 call(['docker','ps','-a','--format','{{json .}}'],'containers-before.jsonl')
 call(['docker','network','create',NET],'network.log');call(['docker','volume','create',P+'-pgdata'],'pg-volume.log');call(['docker','volume','create',DEP],'dep-volume.log')
 call(['docker','run','--rm','-v','pethelp-wave4a_vethelp-backend-node-modules:/from:ro','-v',DEP+':/to','node:22-bookworm','cp','-a','/from/.','/to/'],'dep-copy.log')
 call(['docker','run','-d','--name',PG,'--network',NET,'--network-alias','postgres','--cpuset-cpus','0-3','-e','POSTGRES_USER=closure','-e','POSTGRES_PASSWORD=closure-test-only','-e','POSTGRES_DB=vethelp_w4b_base','-v',P+'-pgdata:/var/lib/postgresql/data','postgres:16-alpine'],'postgres-create.log')
 for i in range(30):
  if subprocess.run(['docker','exec',PG,'pg_isready','-U','closure'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(1)
 else:raise SystemExit('POSTGRES_NOT_READY')
 docker_node(['npm','run','migrate:up'],'fresh-migrations.log',name='migrate')
 docker_node(['npm','run','migrate:verify'],'fresh-checksums.log',name='checksums')
 docker_node(['npm','run','build'],'backend-build.log',name='build')
 print('SETUP PASS',E,flush=True)
elif sys.argv[1]=='focused':
 docker_node(['env','W4B_ACCEPTANCE=true','node','node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','test/owner-ocr-foundation.e2e-spec.ts','test/owner-ocr-migration.e2e-spec.ts','--json','--outputFile=/workspace/docs/testing/evidence/wave4b-01-20261011/focused.json'],'focused.log',name='focused-02')
 print('FOCUSED PASS',flush=True)
elif sys.argv[1]=='repair':
 docker_node(['env','W4B_ACCEPTANCE=true','node','node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','test/owner-ocr-foundation.e2e-spec.ts','test/owner-ocr-migration.e2e-spec.ts','--testNamePattern=real HTTP|preserves exact legacy','--json','--outputFile=/workspace/docs/testing/evidence/wave4b-01-20261011/repair.json'],'repair.log',name='repair')
 docker_node(['node','node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','src/config/mvp-product-scope.guard.spec.ts','--json','--outputFile=/workspace/docs/testing/evidence/wave4b-01-20261011/guard.json'],'guard.log',name='guard')
 docker_node(['npm','run','build'],'backend-build-final.log',name='build-final')
 print('REPAIR CHECKS PASS',flush=True)
elif sys.argv[1]=='contract':
 docker_node(['npm','run','build'],'backend-build-contract.log',name='build-contract-02')
 docker_node(['npm','run','openapi:export'],'openapi.log',name='openapi')
 for i,script in enumerate(['assert-openapi.cjs','assert-appointment-minimum-openapi.cjs','assert-owner-medical-sharing-openapi.cjs','assert-clinic-medical-sharing-openapi.cjs','assert-owner-ocr-openapi.cjs']):
  docker_node(['node','scripts/'+script],f'openapi-assert-{i+1}.log',name=f'openapi-assert-{i+1}')
 print('CONTRACT PASS',flush=True)
elif sys.argv[1]=='sharing':
 call(['docker','exec',PG,'psql','-U','closure','-d','postgres','-v','ON_ERROR_STOP=1','-c','CREATE DATABASE vethelp_w4b_sharing_02 TEMPLATE vethelp_w4b_base;'],'sharing-db.log')
 docker_node(['node','node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','test/appointment-medical-sharing-http.e2e-spec.ts','--testNamePattern=W4B unconfirmed OCR','--json','--outputFile=/workspace/docs/testing/evidence/wave4b-01-20261011/sharing.json'],'sharing.log',db='vethelp_w4b_sharing_02',name='sharing-02')
 print('SHARING ISOLATION PASS',flush=True)
