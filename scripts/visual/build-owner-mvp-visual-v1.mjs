import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const output=join(root,'docs/ux/owner-mvp-visual-baseline-v1');
const screenshots=join(output,'screenshots');
await mkdir(screenshots,{recursive:true});
for(const file of await readdir(screenshots))if(file.endsWith('.png'))await unlink(join(screenshots,file));
const manifests={foundation:'docs/testing/evidence/owner-mvp-foundation',availability:'docs/testing/evidence/s11-owner-availability',review:'docs/testing/evidence/s12-owner-booking-request',status:'docs/testing/evidence/s14-owner-booking-decision',cancellation:'docs/testing/evidence/s16-owner-cancellation'};
const loaded={};for(const [key,relative] of Object.entries(manifests))loaded[key]={relative,manifest:JSON.parse(await readFile(join(root,relative,'manifest.json'),'utf8'))};
const required=[
  ['01-welcome','foundation','01-welcome'],['02-phone-login','foundation','02-phone-login'],['03-otp','foundation','03-otp'],['04-home','foundation','04-home'],['05-pet-selection-or-empty','foundation','05-pet-selection'],['06-clinic-catalog','foundation','06-clinic-catalog'],['07-clinic-service','foundation','07-clinic-service'],
  ['08-availability','availability','standard-selected'],['09-booking-review','review','compact-review'],['10-pending','status','compact-pending'],['11-confirmed','status','compact-confirmed'],['12-rejected-or-expired','status','standard-rejected'],['13-cancel-confirmation','cancellation','compact-confirmation'],['14-cancelled','cancellation','compact-cancelled'],['15-loading','foundation','15-loading'],['16-error','review','wide-conflict'],
];
const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const sourceHashes={};
for(const {manifest} of Object.values(loaded)){if(manifest.source&&manifest.sourceSha256)sourceHashes[manifest.source]=manifest.sourceSha256;Object.assign(sourceHashes,manifest.sources??{});}
for(const relative of ['apps/owner-app/src/ui/tokens.ts','apps/owner-app/src/ui/primitives.tsx','apps/owner-app/src/app/_layout.tsx'])sourceHashes[relative]=createHash('sha256').update(await readFile(join(root,relative))).digest('hex');
const cases=[];for(const [id,group,state] of required){const {relative,manifest}=loaded[group];const item=manifest.cases.find(value=>value.name===state);if(!item)throw new Error(`Missing ${id}: ${group}/${state}`);const file=`${id}.png`;await copyFile(join(root,relative,item.file),join(screenshots,file));const bytes=await readFile(join(screenshots,file));cases.push({id,state,viewport:{width:item.width,height:item.height},file:`screenshots/${file}`,sha256:createHash('sha256').update(bytes).digest('hex'),mockLive:'MOCKED_STATE_REAL_PRODUCTION_COMPONENT',backendData:'CONTROLLED_FIXTURE_NO_LIVE_BACKEND',physicalDevice:false});}
const widths=new Set(cases.map(item=>item.viewport.width));for(const width of [320,375,390,430,768,1280,1440])if(!widths.has(width))throw new Error(`Required width missing: ${width}`);
await writeFile(join(output,'manifest.json'),JSON.stringify({id:'OWNER-MVP-VISUAL-V1',status:'CANDIDATE_READY_FOR_HUMAN_VISUAL_ACCEPTANCE',sourceRevision,workingTree:'DIRTY_PRESERVED_USER_AND_DELIVERY_CHANGES',sourceHashes,generatedAt:new Date().toISOString(),renderer:'React Native Web production component bundles with controlled seams',physicalDevice:false,cases},null,2)+'\n');console.log('OWNER-MVP-VISUAL-V1 built: required 16/16 states');
