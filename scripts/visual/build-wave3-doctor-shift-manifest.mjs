import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const dir=join(root,'docs/testing/evidence/wave3-doctor-shift-inventory');
const states=['vis-01-empty','vis-02-doctor-selected','vis-03-draft-shift','vis-04-shift-editor','vis-05-generated-preview','vis-06-published-inventory','vis-07-blocked-inventory','vis-08-held-slot','vis-09-booked-slot','vis-10-stale-conflict','vis-11-technical-degraded','vis-12-read-only-role'];
const viewports=[[390,844],[430,932],[768,1024],[1024,768],[1440,900]];
const sourceFiles=[
  'apps/clinic-portal/app/(clinic)/clinics/[clinicId]/locations/[locationId]/schedule/page.tsx',
  'apps/clinic-portal/components/schedule/ClinicScheduleClient.tsx',
  'apps/clinic-portal/components/schedule/DoctorShiftPanel.tsx',
  'apps/clinic-portal/lib/api/clinic-schedule.ts',
];
const captureScript='apps/clinic-portal/tests/e2e/clinic-schedule-admin.spec.ts';
const v50Files=['prototype-v50/index.html','prototype-v50/manifest.json'];
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const dimensions=(bytes)=>({width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
const sources=Object.fromEntries(await Promise.all(sourceFiles.map(async(file)=>[file,sha(await readFile(join(root,file)))])));
const v50Sources=Object.fromEntries(await Promise.all(v50Files.map(async(file)=>[file,sha(await readFile(join(root,file)))])));
const captureBytes=await readFile(join(root,captureScript));
const captureRunBytes=await readFile(join(dir,'capture-run.json'));
const captureRun=JSON.parse(captureRunBytes);
if(captureRun.status!=='PASS'||captureRun.captureScriptSha256!==sha(captureBytes)||captureRun.checks?.overflowChecks!==60||captureRun.checks?.axeScans!==12||captureRun.checks?.screenshots!==60||captureRun.semanticStates?.length!==12)throw new Error('capture run is not a complete current-source PASS');
const artifacts=[];
for(const state of states)for(const [width,height] of viewports){
  const file=`${state}-${width}x${height}.png`;
  const bytes=await readFile(join(dir,file));
  artifacts.push({state,viewport:`${width}x${height}`,file,width,height,sha256:sha(bytes),bytes:bytes.length});
}
const buildId=(await readFile(join(root,'apps/clinic-portal/.next/BUILD_ID'),'utf8')).trim();
const runtimeHash=sha(Object.entries(sources).sort().map(([file,digest])=>`${file}:${digest}`).join('\n'));
const manifest={
  schemaVersion:1,
  wave:'WAVE_3_DOCTORSHIFT_INVENTORY',
  renderer:'Clinic Portal production Next.js build; Playwright Chromium',
  browser:captureRun.browser,
  physicalDevice:false,
  states,
  viewports:viewports.map(([width,height])=>({width,height})),
  runtimeBuild:{buildId,sha256:sha(buildId)},
  runtimeHash,
  v50Sources,
  v50SourceHash:sha(Object.entries(v50Sources).sort().map(([file,digest])=>`${file}:${digest}`).join('\n')),
  captureScript:{file:captureScript,sha256:sha(captureBytes)},
  captureRun:{file:'capture-run.json',sha256:sha(captureRunBytes),completedAt:captureRun.completedAt},
  sources,
  checks:{horizontalOverflow:`PASS_${captureRun.checks.overflowChecks}_OF_60`,axeSeriousCritical:`PASS_${captureRun.checks.axeScans}_OF_12`,semanticStates:`PASS_${captureRun.semanticStates.length}_OF_12`,machineIntegrity:'RUN_VERIFIER'},
  artifacts,
};
await writeFile(join(dir,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
const pngs=(await readdir(dir)).filter((file)=>file.endsWith('.png'));
if(pngs.length!==artifacts.length)throw new Error(`orphan PNG count: expected ${artifacts.length}, found ${pngs.length}`);
console.log(`Wave 3 DoctorShift manifest built: ${artifacts.length}/${states.length*viewports.length}`);
