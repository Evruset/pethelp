import pathlib,subprocess,os,json,sys
R=pathlib.Path(__file__).parent;W=R/'worktree';E=W/'docs/testing/evidence/wave4a-final-20261011';NODE='/Users/evrusetskiy/.npm/_npx/56b7e88bf8a51914/node_modules/node/bin/node'
env=os.environ.copy();env['PATH']=str(pathlib.Path(NODE).parent)+':'+env['PATH'];env['NEXT_TELEMETRY_DISABLED']='1'
def call(cmd,cwd,log,extra={}):
 with (E/log).open('w') as f:r=subprocess.run(cmd,cwd=cwd,env={**env,**extra},stdout=f,stderr=subprocess.STDOUT)
 print(log,'PASS' if r.returncode==0 else 'FAIL',flush=True)
 if r.returncode:raise SystemExit(r.returncode)
if sys.argv[1]=='owner':
 call([NODE,'node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','src/medical-sharing/MedicalSharingScreen.test.tsx','--testNamePattern=closure:','--json',f'--outputFile={E}/owner-closure.json'],W/'apps/owner-app','owner-closure.log')
elif sys.argv[1]=='portal':
 call([NODE,'node_modules/next/dist/bin/next','build'],W/'apps/clinic-portal','portal-build.log')
 call([NODE,'node_modules/@playwright/test/cli.js','test','-c','playwright.config.mjs','tests/e2e/shared-medical.spec.ts','--grep','closure:','--reporter=list,json'],W/'apps/clinic-portal','portal-closure.log',{'CLINIC_PORTAL_E2E_PORT':'3411','CLINIC_PORTAL_MOCK_PORT':'3412','PLAYWRIGHT_JSON_OUTPUT_FILE':str(E/'portal-closure.json')})
