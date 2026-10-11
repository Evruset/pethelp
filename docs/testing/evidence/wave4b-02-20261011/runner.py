import pathlib,subprocess,json,time,sys,os
R=pathlib.Path(__file__).parent;W=R/'worktree';E=W/'docs/testing/evidence/wave4b-02-20261011';E.mkdir(parents=True,exist_ok=True)
P='v15-w4b02-2ajw4xh6';PG=P+'-postgres';NET=P+'-net';DEP=P+'-deps'
def call(args,log):
 with (E/log).open('w') as f:r=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT)
 if r.returncode: print('FAIL',log,r.returncode,flush=True);raise SystemExit(r.returncode)
def docker_node(cmd,log,db='vethelp_w4b02_base',profile='PILOT_V1',workers='false',name='setup'):
 env={'DATABASE_URL':f'postgres://closure:closure-test-only@postgres:5432/{db}','JWT_ISSUER':'vethelp-closure-test','JWT_AUDIENCE':'vethelp-closure-test','NODE_ENV':'test','MVP_SCOPE_PROFILE':profile,'WORKERS_ENABLED':workers,'WAVE4_ACCEPTANCE':'true','JWT_SECRET':'closure-jwt-synthetic-at-least-32-bytes','AUTH_OTP_PEPPER':'closure-otp-synthetic-distinct-32-bytes','AUTH_OTP_ANTI_FRAUD_PEPPER':'closure-antifraud-synthetic-distinct-32-bytes','OWNER_PET_IDEMPOTENCY_HMAC_KEY':'closure-pet-synthetic-distinct-32-bytes','WORKER_SERVICE_TOKEN':'closure-worker-synthetic-distinct-32-bytes'}
 args=['docker','run','--name',P+'-'+name,'--network',NET,'--cpuset-cpus','0-3','-v',str(W)+':/workspace','-v',DEP+':/workspace/backend/node_modules:ro','-w','/workspace/backend']
 for k,v in env.items():args+=['-e',k+'='+v]
 args+=['node:22-bookworm',*cmd];call(args,log)
if sys.argv[1]=='setup':
 call(['docker','ps','-a','--format','{{json .}}'],'containers-before.jsonl')
 call(['docker','network','create',NET],'network.log');call(['docker','volume','create',P+'-pgdata'],'pg-volume.log');call(['docker','volume','create',DEP],'dep-volume.log')
 call(['docker','run','--rm','-v','pethelp-wave4a_vethelp-backend-node-modules:/from:ro','-v',DEP+':/to','node:22-bookworm','cp','-a','/from/.','/to/'],'dep-copy.log')
 call(['docker','run','-d','--name',PG,'--network',NET,'--network-alias','postgres','--cpuset-cpus','0-3','-e','POSTGRES_USER=closure','-e','POSTGRES_PASSWORD=closure-test-only','-e','POSTGRES_DB=vethelp_w4b02_base','-v',P+'-pgdata:/var/lib/postgresql/data','postgres:16-alpine'],'postgres-create.log')
 for i in range(30):
  if subprocess.run(['docker','exec',PG,'pg_isready','-U','closure'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(1)
 else:raise SystemExit('POSTGRES_NOT_READY')
 docker_node(['npm','run','migrate:up'],'fresh-migrations.log',name='migrate')
 docker_node(['npm','run','migrate:verify'],'fresh-checksums.log',name='checksums')
 docker_node(['npm','run','build'],'backend-build.log',name='build')
 print('SETUP PASS',E,flush=True)

if sys.argv[1]=='continue':
 docker_node(['npm','run','migrate:up'],'fresh-migrations-repaired.log',name='migrate-repaired')
 docker_node(['npm','run','migrate:verify'],'fresh-checksums.log',name='checksums')
 docker_node(['npm','run','build'],'backend-build.log',name='build')
 print('FRESH/BUILD PASS',flush=True)
if sys.argv[1]=='focused':
 docker_node(['env','W4B02_ACCEPTANCE=true','npx','jest','--runInBand','--runTestsByPath','test/owner-ocr-review.e2e-spec.ts','test/owner-ocr-review-migration.e2e-spec.ts','src/config/mvp-product-scope.guard.spec.ts','--json','--outputFile=/workspace/docs/testing/evidence/wave4b-02-20261011/focused-results.json'],'focused-tests.log',name='focused')

if sys.argv[1]=='sharing':
 docker_node(['npx','jest','--runInBand','--runTestsByPath','test/appointment-medical-sharing-http.e2e-spec.ts','--testNamePattern=W4B02','--json','--outputFile=/workspace/docs/testing/evidence/wave4b-02-20261011/sharing-results.json'],'sharing-tests.log',name='sharing')
if sys.argv[1]=='openapi':
 docker_node(['npm','run','openapi:export'],'openapi-export.log',name='openapi')
 for script in ['assert-openapi','assert-appointment-minimum-openapi','assert-owner-medical-sharing-openapi','assert-clinic-medical-sharing-openapi','assert-owner-ocr-openapi','assert-owner-ocr-review-openapi']:
  docker_node(['node','scripts/'+script+'.cjs'],script+'.log',name=script)
 print('OPENAPI PASS',flush=True)

if sys.argv[1]=='review-tests':
 docker_node(['env','W4B02_ACCEPTANCE=true','npx','jest','--runInBand','--runTestsByPath','test/owner-ocr-review.e2e-spec.ts','--json','--outputFile=/workspace/docs/testing/evidence/wave4b-02-20261011/review-results.json'],'review-tests.log',name='review-tests')
