from pathlib import Path
import subprocess,sys,time,json,shutil
R=Path(Path('/tmp/v15-w4b-03a-03-path').read_text());W=R/'worktree';E=W/'docs/testing/evidence/wave4b-03a-03-20261012';P='v15-w4b03a03-x14iu6e1';DB='vethelp_w4b03a03_main';PG=P+'-postgres';NET=P+'-net'
def call(args,log,input=None):
 with (E/log).open('wb') as f:r=subprocess.run(args,input=input,stdout=f,stderr=subprocess.STDOUT)
 if r.returncode:print('FAIL',log,r.returncode,flush=True);raise SystemExit(r.returncode)
def node(cmd,log,name,db=DB,role='publisher',enabled='true',volume='snapshots',ro=False,root=False,extra={},result=None):
 env={'DATABASE_URL':f'postgres://ocr_api_test:api-test-only@postgres:5432/{db}' if role=='publisher' else f'postgres://ocr_reader_test:reader-test-only@postgres:5432/{db}','OCR_VERIFIED_BYTES_ENABLED':enabled,'OCR_OPERATIONAL_PROFILE':'ISOLATED_TEST_V1','OCR_PROCESS_ROLE':role,'PET_DOCUMENT_STORAGE_DIR':'/owned-snapshots','W4B03A03_ACCEPTANCE':'true','W4B03A02_ACCEPTANCE':'true','NODE_ENV':'test','MVP_SCOPE_PROFILE':'PILOT_V1','WORKERS_ENABLED':'false','JWT_ISSUER':'vethelp-closure-test','JWT_AUDIENCE':'vethelp-closure-test','JWT_SECRET':'closure-jwt-synthetic-at-least-32-bytes','AUTH_OTP_PEPPER':'closure-otp-synthetic-distinct-32-bytes','AUTH_OTP_ANTI_FRAUD_PEPPER':'closure-antifraud-synthetic-distinct-32-bytes','OWNER_PET_IDEMPOTENCY_HMAC_KEY':'closure-pet-synthetic-distinct-32-bytes','WORKER_SERVICE_TOKEN':'closure-worker-synthetic-distinct-32-bytes',**extra}
 if role=='worker':env.setdefault('OCR_BYTE_DATABASE_URL',f'postgres://ocr_byte_test:byte-test-only@postgres:5432/{db}')
 if root:env['DATABASE_URL']=f'postgres://closure:closure-test-only@postgres:5432/{db}'
 cmd=['/owned-results/results.json' if x=='/tmp/results.json' else x for x in cmd]
 args=['docker','run','--name',P+'-'+name,'--network',NET,'--cpuset-cpus','0-3','--cap-drop=ALL','--security-opt=no-new-privileges','-v',str(W)+':/workspace'+('' if root else ':ro'),'-v',P+'-deps:/workspace/backend/node_modules:ro','-v',P+'-'+volume+':/owned-snapshots'+(':ro' if ro else ''),'-w','/workspace/backend']
 if (R/'legacy').exists():args+=['-v',str(R/'legacy')+':/legacy:ro','-v',P+'-deps:/legacy/backend/node_modules:ro']
 args+=['-v',str(R/'test-results')+':/owned-results']
 if not root:args+=['--user','1000:1000','--read-only','--tmpfs','/tmp:rw,nosuid,nodev,noexec,mode=1777']
 for k,v in env.items():args+=['-e',k+'='+v]
 call(args+['node:22-bookworm',*cmd],log)
 if result:shutil.copyfile(R/'test-results/results.json',E/result)
def snapshot_volume(name):call(['docker','volume','create','--driver','local','--opt','type=tmpfs','--opt','device=tmpfs','--opt','o=uid=1000,gid=1000,mode=0700,size=64m,nosuid,nodev,noexec',P+'-'+name],name+'-volume.log')
if __name__=='__main__' and sys.argv[1]=='setup':
 call(['docker','volume','create',P+'-deps'],'deps-create.log');call(['docker','volume','create',P+'-pgdata'],'pgdata-create.log');snapshot_volume('snapshots')
 call(['docker','run','--rm','-v','v15-w4b03a02-i61r043p-deps:/from:ro','-v',P+'-deps:/to','node:22-bookworm','cp','-a','/from/.','/to/'],'deps-copy.log')
 # Keep owned tmpfs mounted throughout drill; only test-owned Docker resources affected.
 call(['docker','run','-d','--name',P+'-snapshot-holder','--cap-drop=ALL','--security-opt=no-new-privileges','--user','1000:1000','-v',P+'-snapshots:/owned-snapshots','node:22-bookworm','sleep','86400'],'snapshot-holder.log')
 call(['docker','network','create',NET],'network.log');call(['docker','run','-d','--name',PG,'--network',NET,'--network-alias','postgres','-e','POSTGRES_USER=closure','-e','POSTGRES_PASSWORD=closure-test-only','-e','POSTGRES_DB='+DB,'-v',P+'-pgdata:/var/lib/postgresql/data','postgres:16-alpine'],'pg-create.log')
 for _ in range(30):
  if subprocess.run(['docker','exec',PG,'pg_isready','-U','closure'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(1)
 node(['npm','run','migrate:up'],'fresh-migrations.log','migrate',enabled='false',root=True)
 sql="""CREATE ROLE ocr_api_test LOGIN NOINHERIT PASSWORD 'api-test-only';CREATE ROLE ocr_reader_test LOGIN NOINHERIT PASSWORD 'reader-test-only';CREATE ROLE ocr_byte_test LOGIN NOINHERIT PASSWORD 'byte-test-only';GRANT vethelp_ocr_byte_executor TO ocr_byte_test;
 GRANT USAGE ON SCHEMA pet_schema,identity_schema,audit_schema TO ocr_api_test,ocr_reader_test;GRANT SELECT ON ALL TABLES IN SCHEMA pet_schema,identity_schema,audit_schema TO ocr_api_test,ocr_reader_test;GRANT INSERT,UPDATE ON ALL TABLES IN SCHEMA pet_schema,identity_schema,audit_schema TO ocr_api_test;GRANT USAGE ON ALL SEQUENCES IN SCHEMA pet_schema,identity_schema,audit_schema TO ocr_api_test;"""
 call(['docker','exec',PG,'psql','-U','closure','-d',DB,'-v','ON_ERROR_STOP=1','-c',sql],'roles.log')
 node(['npm','run','build'],'backend-build.log','build',enabled='false',root=True)
