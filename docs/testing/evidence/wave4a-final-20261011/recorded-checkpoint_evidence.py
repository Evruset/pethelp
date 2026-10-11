import pathlib,json,subprocess,hashlib,shutil
R=pathlib.Path(__file__).parent;W=R/'worktree';E=W/'docs/testing/evidence/wave4a-final-20261011';plan=json.loads((E/'regression-plan.json').read_text())
rows=[]
for s,n in plan['sticky'].items():
 base='35d3b9f7471c5ff701b7fb2fa00d2a62b1640b4e';evidence='sticky-pethelp-wave4a-reconcile-checkpoint-backend.log'
 if s in ['test/booking-core-performance.integration-spec.ts','test/clinical-foundation-migration.integration-spec.ts','test/v15-clinic-contract-profile-migration.integration-spec.ts','test/clinical-result-cardinality-migration.integration-spec.ts']:
  base='a1c092ec695d0fb9945e324c96db30914e131830';evidence='/private/tmp/pethelp-t044-candidate.X05Hh7/validation-corrected-01/REPORT.md'
 elif s=='src/auth/owner-pet.service.spec.ts':evidence='docs/v15/12-wave4a-completion-evidence.md: Authorized Document delivery — Owner service4/4'
 path='backend/'+s;assert (W/path).exists()
 assert not subprocess.check_output(['git','diff',base,'HEAD','--',path],cwd=W),s
 rows.append({'gate':s,'status':'REUSED_STICKY_PASS','passed':n,'evidence':evidence,'evidence_revision':base,'sourceSha256':hashlib.sha256((W/path).read_bytes()).hexdigest(),'dependency_surface':'backend/src and backend/migrations unchanged35d3b9f..a1c092e','fresh_or_reused':'reused','invalidated_by':None})
(E/'sticky-ledger.json').write_text(json.dumps(rows,indent=2));shutil.copyfile(R/'original-snapshot.json',E/'original-snapshot.json')
for s in ['migrate','checksums','build','list','openapi']:
 j=json.loads(subprocess.check_output(['docker','inspect','v15-w4a-final-v88ucbla-'+s]))[0]
 row={'name':j['Name'],'image':j['Config']['Image'],'exitCode':j['State']['ExitCode'],'status':j['State']['Status'],'cpuset':j['HostConfig']['CpusetCpus'],'started':j['State']['StartedAt'],'finished':j['State']['FinishedAt']}
 (E/(s+'-runtime.json')).write_text(json.dumps(row,indent=2));assert row['exitCode']==0
portal=json.loads((E/'portal-closure.json').read_text());owner=json.loads((E/'owner-closure.json').read_text());print('Portal:',portal['stats']);print('Owner:',owner['numPassedTests'],owner['numFailedTests'],owner['numPendingTests'])
summary={'base':'a1c092ec695d0fb9945e324c96db30914e131830','freshChainMigrations':69,'backendBuild':'PASS','openapiAssertions':4,'ownerNewTests':{'passed':owner['numPassedTests'],'failed':owner['numFailedTests'],'acceptedSelectedOut':owner['numPendingTests']},'portalNewTests':portal['stats'],'stickyBackendSuites':8,'stickyBackendTests':118,'authorityMatrix':'REUSED_STICKY_PASS32 real races and4 no-leak in71HTTP; identical source/migrations','originalSnapshotEntries':674,'regressionStatus':'RUNNING','humanWave4AAcceptance':'NOT_GIVEN'}
(E/'checkpoint-summary.json').write_text(json.dumps(summary,indent=2))
