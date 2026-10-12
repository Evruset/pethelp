from pathlib import Path
import runpy,subprocess,json,hashlib,time,contextlib,io,sys
r=runpy.run_path('/tmp/w4b03a03-runner.py');R=r['R'];W=r['W'];E=r['E'];P=r['P'];PG=r['PG'];DB=r['DB'];node=r['node'];call=r['call'];checks=[]
assert P.startswith('v15-w4b03a03-') and DB.startswith('vethelp_w4b03a03_')
sha=lambda b:hashlib.sha256(b).hexdigest()
def psql(db,sql):return subprocess.check_output(['docker','exec',PG,'psql','-U','closure','-d',db,'-tA','-v','ON_ERROR_STOP=1','-c',sql],text=True).strip()
def snapshot(db):
 tables=['pets','pet_documents','document_byte_versions','document_byte_events','ocr_job_byte_sources','ocr_jobs','ocr_attempts','ocr_results','ocr_candidates','ocr_attempt_byte_receipts','ocr_result_byte_bindings','ocr_review_revisions','schema_migration_checksums']
 state={}
 for t in tables:
  schema='public' if t=='schema_migration_checksums' else 'pet_schema';raw=psql(db,f"SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM {schema}.{t} t")
  state[t]={'count':len(json.loads(raw)),'sha256':sha(raw.encode())}
 return state
node(['npm','run','build'],'backend-build-release.log','build-release',enabled='false',root=True)
# Execute actual dedicated worker entrypoint, then stop it before old-binary rollback probes/backup.
captured=[];g=node.__globals__;real=g['call'];g['call']=lambda args,log:captured.append(args)
try:node(['node','dist/src/ocr-byte-worker-main.js'],'worker-runtime.log','runtime-worker',role='worker',ro=True,extra={'WORKERS_ENABLED':'true'})
finally:g['call']=real
args=captured[0];args.insert(2,'-d');call(args,'worker-runtime-start.log')
ready=False
for _ in range(100):
 logs=subprocess.check_output(['docker','logs',P+'-runtime-worker'],stderr=subprocess.STDOUT,text=True)
 if 'OCR_WORKER_READY' in logs:ready=True;break
 time.sleep(.1)
assert ready,logs
call(['docker','stop','--time','40',P+'-runtime-worker'],'worker-runtime-stop.log');assert subprocess.check_output(['docker','inspect','--format','{{.State.Running}}',P+'-runtime-worker'],text=True).strip()=='false'
(E/'worker-runtime.log').write_text(logs);checks.append({'gate':'actual dedicated worker startup + SIGTERM drain before rollback/backup','status':'PASS'})
# Startup occurs on healthydata; all fixturesalreadyterminal, no consumerloop race duringdump.
before=snapshot(DB);assert before['ocr_results']['count']==3 and before['ocr_result_byte_bindings']['count']==2 and before['ocr_review_revisions']['count']==2
backup=subprocess.check_output(['docker','exec',PG,'pg_dump','-U','closure','-d',DB,'-Fc']);(R/'owned-db-backup.dump').write_bytes(backup)
archive=subprocess.check_output(['docker','run','--rm','--cap-drop=ALL','--security-opt=no-new-privileges','--user','1000:1000','-v',P+'-snapshots:/owned-snapshots:ro','node:22-bookworm','tar','-cf','-','-C','/owned-snapshots','.']);(R/'owned-snapshots.tar').write_bytes(archive)
restored='vethelp_w4b03a03_restored';psql('postgres','CREATE DATABASE '+restored)
subprocess.run(['docker','exec','-i',PG,'pg_restore','-U','closure','-d',restored,'--no-owner','--exit-on-error'],input=backup,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
after=snapshot(restored);assert after==before
checks.append({'gate':'DB backup/restore exact source/provenance/review rows/checksums','status':'PASS','tables':after})
objects=json.loads(psql(DB,"SELECT json_agg(storage_object_id ORDER BY storage_object_id) FROM pet_schema.document_byte_versions"));first=objects[0]
def restore_volume(name,variant='healthy'):
 r['snapshot_volume'](name)
 call(['docker','run','-d','--name',P+'-'+name+'-holder','--cap-drop=ALL','--user','1000:1000','-v',P+'-'+name+':/owned-snapshots','node:22-bookworm','sleep','86400'],name+'-holder.log')
 cmd=['docker','run','--rm','-i','--cap-drop=ALL','--security-opt=no-new-privileges','--user','1000:1000','-v',P+'-'+name+':/owned-snapshots','node:22-bookworm','tar','-xf','-','-C','/owned-snapshots','--no-same-owner']
 if variant=='missing':cmd+=['--exclude=./'+first+'.blob']
 if variant=='stale':cmd+=['--exclude=*.blob']
 if variant=='mismatch':cmd+=['--transform=s/'+first+'/00000000-0000-4000-8000-000000000001/']
 call(cmd,name+'-restore.log',input=archive)
 if variant in ['corrupt','wrong-length']:
  js="const fs=require('fs'),p='/owned-snapshots/"+first+".blob';let b=fs.readFileSync(p);"+("b[0]^=1;" if variant=='corrupt' else "b=b.subarray(0,1);")+"fs.chmodSync(p,0o600);fs.writeFileSync(p,b);fs.chmodSync(p,0o400);"
  call(['docker','run','--rm','--cap-drop=ALL','--user','1000:1000','-v',P+'-'+name+':/owned-snapshots','node:22-bookworm','node','-e',js],name+'-fault.log')
for variant in ['healthy','missing','stale','corrupt','mismatch','wrong-length']:
 name='restore-'+variant;restore_volume(name,variant)
 log=name+'-reconcile.log';denied=False
 try:
  with contextlib.redirect_stdout(io.StringIO()):node(['node','dist/scripts/ocr-source-reconcile.js'],log,name+'-reconcile',db=restored,role='worker',ro=True,volume=name)
 except SystemExit as error:assert error.code==1;denied=True
 assert denied==(variant!='healthy'),(variant,(E/log).read_text())
 if denied:assert 'OCR_SOURCE_RECONCILIATION_DENIED' in (E/log).read_text()
 else:assert json.loads((E/log).read_text())['verifiedEligible']==3
 checks.append({'gate':'restored snapshot '+variant,'status':'PASS','observed':'DENIED' if denied else 'ELIGIBLE_BYTES_REHASHED'})
# Quarantine is explicitnegativeevent, not retrospectiveverification; preservehistory and deny its eligibility.
version=json.loads(psql(restored,"SELECT row_to_json(t) FROM (SELECT version_id,owner_id FROM pet_schema.document_byte_versions WHERE storage_object_id='"+first+"') t"))
psql(restored,"INSERT INTO pet_schema.document_byte_events(version_id,event_type,actor_id,operation_id) VALUES('"+version['version_id']+"','UNAVAILABLE','"+version['owner_id']+"',gen_random_uuid())")
node(['node','dist/scripts/ocr-source-reconcile.js'],'restore-quarantine.log','restore-quarantine',db=restored,role='worker',ro=True,volume='restore-missing')
quarantine=json.loads((E/'restore-quarantine.log').read_text());assert quarantine['verifiedEligible']==2 and quarantine['quarantined']==1
checks.append({'gate':'knownnegative source quarantined without invalidating healthy archive or rewriting history','status':'PASS','quarantine':quarantine})
# Restore guards and retainedhistories survive refused destructive DOWN.
old=snapshot(restored);downDenied=False
try:
 with contextlib.redirect_stdout(io.StringIO()):node(['node','node_modules/node-pg-migrate/bin/node-pg-migrate.js','down','1','--migrations-dir','migrations/node-pg','--migrations-table','schema_migrations','--single-transaction'],'rollback-down.log','rollback-down',db=restored,enabled='false',root=True)
except SystemExit as error:assert error.code!=0;downDenied=True
assert downDenied and 'Destructive DOWN unsupported' in (E/'rollback-down.log').read_text() and snapshot(restored)==old
checks.append({'gate':'destructive migrationrollback denied; all provenance/decisions retained','status':'PASS'})
# Writableworker aliases and productionenablement are both denied by actualprocesspreflight.
for label,role,ro,extra,cmd in [('unsafe-worker-rw','worker',False,{'WORKERS_ENABLED':'true'},['node','dist/src/ocr-byte-worker-main.js']),('worker-disabled','worker',True,{'WORKERS_ENABLED':'false'},['node','dist/src/ocr-byte-worker-main.js']),('production-profile','worker',True,{'WORKERS_ENABLED':'true','NODE_ENV':'production'},['node','dist/src/ocr-byte-worker-main.js']),('worker-http','worker',True,{},['node','dist/src/main.js'])]:
 denied=False
 try:
  with contextlib.redirect_stdout(io.StringIO()):node(cmd,label+'.log',label,role=role,ro=ro,extra=extra)
 except SystemExit as error:assert error.code!=0;denied=True
 assert denied,(label,(E/(label+'.log')).read_text())
 checks.append({'gate':label+' actual entrypoint denial','status':'PASS'})
assert snapshot(DB)==before,'source DB changed by restore/rollback drill'
report={'passed':len(checks),'failed':0,'checks':checks,'testProfile':'exclusive Docker PostgreSQL16/Node22, UID1000, cap-dropALL, no-new-privileges, tmpfs private700 nosuid/nodev/noexec, separateROworker/RWpublisher namespaces','logicalBackupRestoreOnly':True,'powerLossDurability':'NOT_VERIFIED','productionStorageIsolation':'NOT_VERIFIED','publisherCreateOnlyOSGuarantee':'NOT_VERIFIED','originalDbUnchangedByDrills':True,'sourceBackupSha256':sha(backup),'snapshotArchiveSha256':sha(archive),'snapshotsPhysicallyDeleted':0,'backupPayloadExcludedFromEvidence':True,'retentionPolicy':'PENDING_PO_DECISION','realAdapter':'NOT_ACCEPTED'}
(E/'operational-drill-results.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'operationalDrillPASS':len(checks),'FAIL':0,'backupsOutsideEvidence':True,'productionReadiness':'NOT_VERIFIED'}))
