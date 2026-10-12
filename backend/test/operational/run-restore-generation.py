"""Read-only generation reconciliation and labelled persistent container restart."""
from pathlib import Path
import sys
import importlib.util,json,subprocess,hashlib,time,os
spec=importlib.util.spec_from_file_location('drain',Path(__file__).with_name('run-active-drain.py'));h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
R=h.R;W=h.W;E=h.E;P=h.P;PG=h.PG;sql=h.sql;node=h.node;call=h.call;volume=h.volume;checks=[]
DB='vethelp_w4b03a04_commit';RESTORED='vethelp_w4b03a04_restored';job=(R/'fixture-job-id').read_text();sha=lambda b:hashlib.sha256(b).hexdigest()
def snapshot(db):
 tables=[('pet_schema',x) for x in ['pets','pet_documents','document_byte_versions','document_byte_events','ocr_job_byte_sources','ocr_jobs','ocr_attempts','ocr_results','ocr_candidates','ocr_attempt_byte_receipts','ocr_result_byte_bindings','ocr_review_revisions']]+[('audit_schema','audit_log'),('public','schema_migration_checksums')]
 out={}
 for schema,t in tables:
  raw=sql(db,f"SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM {schema}.{t} t");out[schema+'.'+t]={'count':len(json.loads(raw)),'sha256':sha(raw.encode())}
 return out
if '--resume-persistent' in sys.argv:
 generation=json.loads((E/'recoverable-generation.json').read_text());before=generation['tables'];inventory=generation['references'];archive=(R/'generation-objects.tar').read_bytes()
 assert snapshot(RESTORED)==before
 checks=[{'gate':'consistent DB/object manifest, exact14table restore inclreceipts/results/Ownerdecision/audit/checksum','PASS':True}]
 for variant in ['healthy','missing','mismatch']:
  log=(E/('generation-'+variant+'-reconcile.log')).read_text()
  assert (json.loads(log)['verifiedEligible']==4 if variant=='healthy' else 'OCR_SOURCE_RECONCILIATION_DENIED' in log)
  if variant!='healthy':assert 'OCR_WORKER_STARTUP_DENIED' in (E/('generation-'+variant+'-worker.log')).read_text()
  checks.append({'gate':variant+' restored bytes+actualworker restart eligibility','PASS':True,'eligible':variant=='healthy'})
else:
 # Confirm actual stopped claimers, no in-flight leases or mutable capture between DB/object backup.
 for case in ['active','blocked','commit','expired','kill']:
  assert not h.status(case+'-worker')['Running']
 for case in ['blocked','expired','kill']:assert h.status(case+'-recovery')['ExitCode']==0 and not h.status(case+'-recovery')['Running']
 node('confirm-exact-job',['node','test/operational/active-drain-fixture.cjs'],db=DB,extra={'DRAIN_FIXTURE_ACTION':'review','DRAIN_FIXTURE_JOB_ID':job})
 assert sql(DB,"SELECT count(*) FROM pet_schema.ocr_review_revisions rev JOIN pet_schema.ocr_candidates c ON c.id=rev.candidate_id WHERE c.job_id='"+job+"'")=='2'
 before=snapshot(DB)
 inventory=json.loads(sql(DB,"SELECT json_agg(json_build_object('jobId',s.job_id,'versionId',s.version_id,'documentId',s.document_id,'storageObjectId',v.storage_object_id,'sha256',v.sha256,'actualByteLength',v.byte_length) ORDER BY s.job_id) FROM pet_schema.ocr_job_byte_sources s JOIN pet_schema.document_byte_versions v ON v.version_id=s.version_id"))
 assert len(inventory)==4
 backup=subprocess.check_output(['docker','exec',PG,'pg_dump','-U','closure','-d',DB,'-Fc']);(R/'generation-db.dump').write_bytes(backup)
 archive=subprocess.check_output(['docker','run','--rm','--cap-drop=ALL','--security-opt=no-new-privileges','--user','1000:1000','-v',P+'-snapshots:/owned-snapshots:ro','node:22-bookworm','tar','-cf','-','-C','/owned-snapshots','.']);(R/'generation-objects.tar').write_bytes(archive)
 (E/'recoverable-generation.json').write_text(json.dumps({'capture':'alltestclaimers stopped, no source mutation duringcapture','dbSHA256':sha(backup),'objectArchiveSHA256':sha(archive),'references':inventory,'tables':before,'sourceDigestsProve':'current verified snapshot bytes, not retrospective OCRproof','payloadsExcludedFromEvidence':True},indent=2)+'\n')
 sql('postgres','CREATE DATABASE '+RESTORED)
 call(['docker','exec','-i',PG,'pg_restore','-U','closure','-d',RESTORED,'--no-owner','--exit-on-error'],'generation-restore-db.log',input=backup);assert snapshot(RESTORED)==before
 checks.append({'gate':'consistent DB/object manifest, exact14table restore inclreceipts/results/Ownerdecision/audit/checksum','PASS':True})
 first=inventory[0]['storageObjectId']
 for variant in ['healthy','missing','mismatch']:
  name='generation-'+variant;volume(name)
  cmd=['docker','run','--rm','-i','--cap-drop=ALL','--security-opt=no-new-privileges','--user','1000:1000','-v',P+'-'+name+':/owned-snapshots','node:22-bookworm','tar','-xf','-','-C','/owned-snapshots','--no-same-owner']
  if variant=='missing':cmd+=['--exclude=./'+first+'.blob']
  if variant=='mismatch':cmd+=['--transform=s/'+first+'/00000000-0000-4000-8000-000000000001/']
  call(cmd,name+'-restore.log',input=archive)
  # Reconciliation and actual worker entrypoint bothchecked; no instrumentation/provider needed onterminaldata.
  denied=False
  try:node(name+'-reconcile',['node','dist/scripts/ocr-source-reconcile.js'],db=RESTORED,role='worker',ro=True,volume=name)
  except RuntimeError:denied=True
  assert denied==(variant!='healthy')
  logs=(E/(name+'-reconcile.log')).read_text()
  if denied:assert 'OCR_SOURCE_RECONCILIATION_DENIED' in logs
  else:assert json.loads(logs)['verifiedEligible']==4
  if variant=='healthy':
   node(name+'-worker',['node','dist/src/ocr-byte-worker-main.js'],db=RESTORED,role='worker',ro=True,volume=name,detach=True,extra={'WORKERS_ENABLED':'true'})
   end=time.monotonic()+15
   while 'OCR_WORKER_READY' not in subprocess.check_output(['docker','logs',P+'-'+name+'-worker'],stderr=subprocess.STDOUT,text=True):assert time.monotonic()<end;time.sleep(.1)
   call(['docker','kill','--signal','SIGTERM',P+'-'+name+'-worker'],name+'-worker-stop.log');state,_=h.wait_exit(name+'-worker',10);assert state['ExitCode']==0
  else:
   try:node(name+'-worker',['node','dist/src/ocr-byte-worker-main.js'],db=RESTORED,role='worker',ro=True,volume=name,extra={'WORKERS_ENABLED':'true'});raise AssertionError('unsafe startup accepted')
   except RuntimeError:assert 'OCR_WORKER_STARTUP_DENIED' in (E/(name+'-worker.log')).read_text()
  assert snapshot(RESTORED)==before
  checks.append({'gate':variant+' restored bytes+actualworker restart eligibility','PASS':True,'eligible':not denied})
# Persistent test-owned backing volume with mount flags via local bindwrapper; no developerhost path writes.
if '--resume-persistent' not in sys.argv:
 call(['docker','volume','create',P+'-persistent-backing'],'persistent-backing.log')
 backing=subprocess.check_output(['docker','volume','inspect','--format','{{.Mountpoint}}',P+'-persistent-backing'],text=True).strip();assert backing.startswith('/var/lib/docker/volumes/'+P+'-persistent-backing/')
 call(['docker','volume','create','--driver','local','--opt','type=none','--opt','device='+backing,'--opt','o=bind,nosuid,nodev,noexec',P+'-persistent-snapshots'],'persistent-volume.log')
 # Owncontainer only: initialise ownvolume uid/mode; no permissions changed ondeveloper/productionhosts.
 call(['docker','run','--rm','-v',P+'-persistent-snapshots:/owned-snapshots','node:22-bookworm','sh','-c','chown 1000:1000 /owned-snapshots && chmod 700 /owned-snapshots'],'persistent-permissions.log')
 call(['docker','run','--rm','-i','--cap-drop=ALL','--user','1000:1000','-v',P+'-persistent-snapshots:/owned-snapshots','node:22-bookworm','tar','-xf','-','-C','/owned-snapshots','--no-same-owner'],'persistent-restore.log',input=archive)
# Retain full operational preflight denial; readonly rehash never grants worker eligibility.
if '--resume-persistent' not in sys.argv:
 try:node('persistent-reconcile-before',['node','dist/scripts/ocr-source-reconcile.js'],db=RESTORED,role='worker',ro=True,volume='persistent-snapshots');raise AssertionError('unsafe profile accepted')
 except RuntimeError:assert 'OCR_SOURCE_RECONCILIATION_DENIED' in (E/'persistent-reconcile-before.log').read_text()
node('persistent-rehash-before',['node','test/operational/persistent-rehash.cjs'],db=RESTORED,role='worker',ro=True,volume='persistent-snapshots');persistentBefore=json.loads((E/'persistent-rehash-before.log').read_text());assert persistentBefore['verifiedBytes']==4 and not persistentBefore['operationalMountAccepted']
# A controlled PGcontainerrestart with its own persistentpgdata and fresh readerprocess after allworkers stopped.
call(['docker','restart',PG],'persistent-postgres-restart.log')
for _ in range(100):
 if subprocess.run(['docker','exec',PG,'pg_isready','-U','closure'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
 time.sleep(.1)
node('persistent-rehash-after',['node','test/operational/persistent-rehash.cjs'],db=RESTORED,role='worker',ro=True,volume='persistent-snapshots');persistentAfter=json.loads((E/'persistent-rehash-after.log').read_text());assert persistentAfter==persistentBefore and snapshot(RESTORED)==before
checks.append({'gate':'persistenttestfilesystem + controlledPGcontainerrestart + newreaderprocess, exact bytes/length/provenance','PASS':True,'powerLossProof':False,'realEnvironmentProof':False,'verifiedProcessingEligibility':'DENIED_UNSAFE_MOUNT_PROFILE'})
assert snapshot(DB)==before
report={'uniqueChecks':len(checks),'PASS':len(checks),'FAIL':0,'checks':checks,'referenceManifest':'recoverable-generation.json','allOriginalClaimersStopped':True,'recoveryWorkerExitCodesAllZero':True,'sourceDbUnchangedByRestore':True,'persistentFilesystemRestart':'PASS_CONTROLLED_CONTAINER_RESTART_REHASH_ONLY','persistentVerifiedOcrResumption':'DENIED_UNSAFE_MOUNT_PROFILE','logicalRestore':'PASS_ISOLATED_ONLY','powerLossDurability':'NOT_VERIFIED','productionRestore':'NOT_VERIFIED','retention':'PENDING_PRODUCT_OWNER_DECISION','sourceSnapshotsDeleted':0,'productionProvider':'NOT_ACCEPTED','tableSnapshots':before}
(E/'restore-generation-results.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'restorePASS':len(checks),'FAIL':0,'persistentRestart':'CONTROLLED_NOT_POWER_LOSS'}))
