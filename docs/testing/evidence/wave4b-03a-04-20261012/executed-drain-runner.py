"""Exclusive Docker process tests; no production services, secrets or cleanup."""
from pathlib import Path
import subprocess,json,time,hashlib,os,sys,concurrent.futures
R=Path(os.environ['W4B04_TASK_ROOT']);W=R/'worktree';E=W/'docs/testing/evidence/wave4b-03a-04-20261012';P='v15-w4b03a04-'+R.name.rsplit('-',1)[-1];PG=P+'-postgres';NET=P+'-net';DB='vethelp_w4b03a04_seed'
CONTROL=R/'control';CONTROL.mkdir(exist_ok=True);CONTROL.chmod(0o777)
assert R.name.startswith('v15-w4b-03a-04-') and P.startswith('v15-w4b03a04-')
def call(args,log,input=None,check=True):
 p=subprocess.run(args,input=input,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);(E/log).write_bytes(p.stdout)
 if check and p.returncode:raise RuntimeError(f'{log}: exit{p.returncode}')
 return p

def sql(db,query):return subprocess.check_output(['docker','exec',PG,'psql','-U','closure','-d',db,'-tA','-v','ON_ERROR_STOP=1','-c',query],text=True).strip()
def js(db,query):return json.loads(sql(db,query))
def node(name,cmd,db=DB,role='publisher',ro=False,control=None,mode=None,detach=False,volume='snapshots',root=False,extra=None):
 env={'DATABASE_URL':f'postgres://ocr_api_test:api-test-only@postgres:5432/{db}' if role=='publisher' else f'postgres://ocr_reader_test:reader-test-only@postgres:5432/{db}','OCR_VERIFIED_BYTES_ENABLED':'true','OCR_OPERATIONAL_PROFILE':'ISOLATED_TEST_V1','OCR_PROCESS_ROLE':role,'PET_DOCUMENT_STORAGE_DIR':'/owned-snapshots','W4B03A03_ACCEPTANCE':'true','W4B03A02_ACCEPTANCE':'true','W4B03A04_ACCEPTANCE':'true','NODE_ENV':'test','MVP_SCOPE_PROFILE':'PILOT_V1','WORKERS_ENABLED':'false','JWT_ISSUER':'vethelp-drain-test','JWT_AUDIENCE':'vethelp-drain-test','JWT_SECRET':'synthetic-drain-jwt-at-least-32-bytes','AUTH_OTP_PEPPER':'synthetic-drain-otp-distinct-at-least-32','AUTH_OTP_ANTI_FRAUD_PEPPER':'synthetic-drain-antifraud-distinct-at-least-32','OWNER_PET_IDEMPOTENCY_HMAC_KEY':'synthetic-drain-pet-distinct-at-least-32','WORKER_SERVICE_TOKEN':'synthetic-drain-worker-distinct-at-least-32'}
 if role=='worker':env['OCR_BYTE_DATABASE_URL']=f'postgres://ocr_byte_test:byte-test-only@postgres:5432/{db}'
 if mode:env.update(DRAIN_TEST_MODE=mode,WORKERS_ENABLED='true')
 if root:env.update(OCR_VERIFIED_BYTES_ENABLED='false',DATABASE_URL=f'postgres://closure:closure-test-only@postgres:5432/{db}')
 env.update(extra or {})
 args=['docker','run','--name',P+'-'+name,'--network',NET,'--cpuset-cpus','0-3','--cap-drop=ALL','--security-opt=no-new-privileges','-v',str(W)+':/workspace'+('' if root else ':ro'),'-v',P+'-deps:/workspace/backend/node_modules:ro','-v',P+'-'+volume+':/owned-snapshots'+(':ro' if ro else ''),'-w','/workspace/backend']
 if detach:args.insert(2,'-d')
 if not root:args+=['--user','1000:1000','--read-only','--tmpfs','/tmp:rw,nosuid,nodev,noexec,mode=1777']
 if control:args+=['-v',str(control)+':/owned-control']
 for k,v in env.items():args+=['-e',k+'='+v]
 return call(args+['node:22-bookworm',*cmd],name+'.log')
def volume(name):
 call(['docker','volume','create','--driver','local','--opt','type=tmpfs','--opt','device=tmpfs','--opt','o=uid=1000,gid=1000,mode=0700,size=64m,nosuid,nodev,noexec',P+'-'+name],name+'-create.log')
 call(['docker','run','-d','--name',P+'-'+name+'-holder','--cap-drop=ALL','--security-opt=no-new-privileges','--user','1000:1000','-v',P+'-'+name+':/owned-snapshots','node:22-bookworm','sleep','86400'],name+'-holder.log')
def status(name):return json.loads(subprocess.check_output(['docker','inspect','--format','{{json .State}}',P+'-'+name],text=True))
def wait_marker(control,marker,name,seconds=20):
 end=time.monotonic()+seconds
 while time.monotonic()<end:
  if (control/(marker+'.json')).exists():return json.loads((control/(marker+'.json')).read_text())
  if not status(name)['Running']:raise RuntimeError('worker exited before '+marker)
  time.sleep(.1)
 raise RuntimeError('marker timeout '+marker)
def wait_exit(name,budget):
 start=time.monotonic()
 while time.monotonic()-start<budget:
  s=status(name)
  if not s['Running']:
   call(['docker','logs',P+'-'+name],name+'-runtime.log');return s,time.monotonic()-start
  time.sleep(.1)
 raise RuntimeError(name+' shutdown budget exceeded')
def success(db,job):
 return js(db,"SELECT json_build_object('state',state,'attemptCount',attempt_count,'results',(SELECT count(*) FROM pet_schema.ocr_results WHERE job_id=j.id),'candidates',(SELECT count(*) FROM pet_schema.ocr_candidates WHERE job_id=j.id),'receipts',(SELECT count(*) FROM pet_schema.ocr_attempt_byte_receipts WHERE job_id=j.id),'bindings',(SELECT count(*) FROM pet_schema.ocr_result_byte_bindings WHERE job_id=j.id),'successAudits',(SELECT count(*) FROM audit_schema.audit_log WHERE action='ocr.byte_execution.succeeded' AND aggregate_id=j.id),'legacyPreserved',(SELECT medical_history_ocr='{" + '"legacy":"PRESERVE"' + "}'::jsonb FROM pet_schema.pets WHERE id=j.pet_id),'receiptOrigin',(SELECT evidence_origin FROM pet_schema.ocr_attempt_byte_receipts WHERE job_id=j.id),'resultIdentity',(SELECT result_identity FROM pet_schema.ocr_results WHERE job_id=j.id)) FROM pet_schema.ocr_jobs j WHERE j.id='"+job+"'")
def assert_empty(db,job):
 s=success(db,job);assert s['state']!='SUCCEEDED' and all(s[k]==0 for k in ['results','candidates','receipts','bindings','successAudits']),s
 return s
def assert_success(db,job):
 s=success(db,job);assert s['state']=='SUCCEEDED' and all(s[k]==1 for k in ['results','candidates','receipts','bindings','successAudits']) and s['legacyPreserved'] and s['receiptOrigin']=='TEST_CONSUMER',s
 return s
def setup():
 call(['docker','network','create',NET],'network.log');call(['docker','volume','create',P+'-pgdata'],'pgdata.log');call(['docker','volume','create',P+'-deps'],'deps.log')
 call(['docker','run','--rm','-v','v15-w4b03a03-x14iu6e1-deps:/from:ro','-v',P+'-deps:/to','node:22-bookworm','cp','-a','/from/.','/to/'],'deps-copy.log');volume('snapshots')
 call(['docker','run','-d','--name',PG,'--network',NET,'--network-alias','postgres','-e','POSTGRES_USER=closure','-e','POSTGRES_PASSWORD=closure-test-only','-e','POSTGRES_DB='+DB,'-v',P+'-pgdata:/var/lib/postgresql/data','postgres:16-alpine'],'postgres.log')
 for _ in range(50):
  if subprocess.run(['docker','exec',PG,'pg_isready','-U','closure'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(.2)
 sql(DB,"CREATE ROLE vethelp_ocr_byte_executor NOLOGIN;CREATE ROLE ocr_api_test LOGIN NOINHERIT PASSWORD 'api-test-only';CREATE ROLE ocr_reader_test LOGIN NOINHERIT PASSWORD 'reader-test-only';CREATE ROLE ocr_byte_test LOGIN NOINHERIT PASSWORD 'byte-test-only';GRANT vethelp_ocr_byte_executor TO ocr_byte_test;")
 # Reuse frozen accepted synthetic generation, copy into exclusive resources; never mutate retained DB.
 prior=Path('/var/folders/ys/ypbk3mr54jqcwm2520hzs0ph0000gn/T/v15-w4b-03a-03-x14iu6e1');backup=(prior/'owned-db-backup.dump').read_bytes();archive=(prior/'owned-snapshots.tar').read_bytes()
 call(['docker','exec','-i',PG,'pg_restore','-U','closure','-d',DB,'--no-owner','--exit-on-error'],'seed-restore.log',input=backup)
 call(['docker','run','--rm','-i','--cap-drop=ALL','--user','1000:1000','-v',P+'-snapshots:/owned-snapshots','node:22-bookworm','tar','-xf','-','-C','/owned-snapshots','--no-same-owner'],'seed-snapshots.log',input=archive)
 node('build',['npm','run','build'],root=True)
 node('seed-new-job',['node','test/operational/active-drain-fixture.cjs'])
 job=sql(DB,"SELECT id FROM pet_schema.ocr_jobs WHERE state='QUEUED'");assert len(job)==36
 (R/'fixture-job-id').write_text(job)
 for case in ['active','blocked','commit','expired','kill']:sql('postgres','CREATE DATABASE vethelp_w4b03a04_'+case+' TEMPLATE '+DB)
 (E/'resource-profile.json').write_text(json.dumps({'prefix':P,'postgres':'16-alpine','node':'22-bookworm','uid':1000,'gid':1000,'cpuset':'0-3','storage':'private tmpfs nosuid/nodev/noexec; workerRO/publisherRW','priorBackupSHA256':hashlib.sha256(backup).hexdigest(),'priorSnapshotsSHA256':hashlib.sha256(archive).hexdigest(),'acceptedRuntimeGates':'REUSED_STICKY_PASS','newFixtureJobs':1,'productionProvider':False},indent=2)+'\n')
def drain_case(case):
 db='vethelp_w4b03a04_'+case;job=(R/'fixture-job-id').read_text();control=CONTROL/case;control.mkdir();control.chmod(0o777)
 mode={'active':'provider-gated','blocked':'provider-blocked','commit':'commit-gated','expired':'expired-stalled','kill':'commit-kill'}[case];name=case+'-worker'
 node(name,['node','-r','./test/operational/active-drain-preload.cjs','dist/src/ocr-byte-worker-main.js'],db=db,role='worker',ro=True,control=control,mode=mode,detach=True)
 stage='PRE_COMMIT' if case in ['commit','kill'] else 'PROVIDER_ACTIVE';marker=wait_marker(control,stage,name)
 before=assert_empty(db,job)
 if case=='expired':
  call(['docker','kill','--signal','SIGSTOP',P+'-'+name],case+'-stop.log')
  # Actual accepted60-second lease expires; no clock/timestamp or threshold changes.
  end=time.monotonic()+70
  while sql(db,"SELECT lease_until<=clock_timestamp() FROM pet_schema.ocr_jobs WHERE id='"+job+"'")!='t':
   assert time.monotonic()<end;time.sleep(.25)
 start=time.monotonic();call(['docker','kill','--signal','SIGTERM',P+'-'+name],case+'-sigterm.log')
 if case in ['active','commit']:
  assert status(name)['Running'];time.sleep(.3);assert_empty(db,job)
  (control/('release-provider' if case=='active' else 'release-commit')).touch()
  state,elapsed=wait_exit(name,40);assert state['ExitCode']==0,state;final=assert_success(db,job);outcome='A_GRACEFUL_COMPLETION';budget=40
 elif case=='blocked':
  state,elapsed=wait_exit(name,40);assert state['ExitCode']==0 and (control/'PROVIDER_ABORTED.json').exists(),state;failed=assert_empty(db,job);assert failed['state']=='QUEUED'
  recovery=CONTROL/(case+'-recovery');recovery.mkdir();recovery.chmod(0o777)
  node(case+'-recovery',['node','-r','./test/operational/active-drain-preload.cjs','dist/src/ocr-byte-worker-main.js'],db=db,role='worker',ro=True,control=recovery,mode='immediate',detach=True)
  end=time.monotonic()+25
  while success(db,job)['state']!='SUCCEEDED':assert time.monotonic()<end;time.sleep(.15)
  final=assert_success(db,job);call(['docker','kill','--signal','SIGTERM',P+'-'+case+'-recovery'],case+'-recovery-stop.log');wait_exit(case+'-recovery',10);outcome='B_PROVIDER_TIMEOUT_THEN_BOUNDED_RETRY';budget=40
 else:
  if case=='kill':
   time.sleep(.5);assert status(name)['Running'];assert_empty(db,job);call(['docker','kill','--signal','SIGKILL',P+'-'+name],case+'-sigkill.log');state,elapsed=wait_exit(name,10);assert state['ExitCode']==137,state;assert_empty(db,job)
   end=time.monotonic()+70
   while sql(db,"SELECT lease_until<=clock_timestamp() FROM pet_schema.ocr_jobs WHERE id='"+job+"'")!='t':assert time.monotonic()<end;time.sleep(.25)
  recovery=CONTROL/(case+'-recovery');recovery.mkdir();recovery.chmod(0o777)
  node(case+'-recovery',['node','-r','./test/operational/active-drain-preload.cjs','dist/src/ocr-byte-worker-main.js'],db=db,role='worker',ro=True,control=recovery,mode='immediate',detach=True)
  end=time.monotonic()+25
  while success(db,job)['state']!='SUCCEEDED':assert time.monotonic()<end;time.sleep(.15)
  final=assert_success(db,job)
  if case=='expired':
   (control/'release-provider').touch();call(['docker','kill','--signal','SIGCONT',P+'-'+name],case+'-resume.log');state,elapsed=wait_exit(name,40);assert state['ExitCode']==0,state;assert assert_success(db,job)==final
  call(['docker','kill','--signal','SIGTERM',P+'-'+case+'-recovery'],case+'-recovery-stop.log');wait_exit(case+'-recovery',10);outcome='B_REAL_LEASE_RECOVERY_FENCED_OLD_ATTEMPT';budget=80
 final=assert_success(db,job)
 attempts=js(db,"SELECT json_agg(json_build_object('status',status,'error',error_code,'startedAt',started_at,'finishedAt',finished_at) ORDER BY started_at) FROM pet_schema.ocr_attempts WHERE job_id='"+job+"'")
 report={'case':case,'PASS':True,'syncStage':stage,'observedStageAt':marker['at'],'beforeSignal':before,'outcome':outcome,'signalToFinalObservationSeconds':round(time.monotonic()-start,3),'shutdownBudgetSeconds':budget,'initialExit':state['ExitCode'],'final':final,'attemptHistory':attempts,'acceptedLeaseSeconds':60,'acceptedProviderTimeoutMs':30000,'acceptedRetryCap':3,'testConsumerOnly':True,'injectedProductionChanges':False}
 (E/(case+'-results.json')).write_text(json.dumps(report,indent=2)+'\n');return report
if __name__=='__main__':
 if sys.argv[1]=='setup':setup()
 elif sys.argv[1]=='drain':
  with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:results=list(ex.map(drain_case,['active','blocked','commit','expired','kill']))
  (E/'active-drain-results.json').write_text(json.dumps({'uniqueScenarios':5,'PASS':5,'FAIL':0,'cases':results},indent=2)+'\n');print(json.dumps({'activeDrainPASS':5,'FAIL':0}))
