import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const dir=join(root,'docs/testing/evidence/wave3-doctor-shift-inventory');
const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const expectedStates=['vis-01-empty','vis-02-doctor-selected','vis-03-draft-shift','vis-04-shift-editor','vis-05-generated-preview','vis-06-published-inventory','vis-07-blocked-inventory','vis-08-held-slot','vis-09-booked-slot','vis-10-stale-conflict','vis-11-technical-degraded','vis-12-read-only-role'];
const expectedViewports=['390x844','430x932','768x1024','1024x768','1440x900'];
if(manifest.schemaVersion!==1||manifest.physicalDevice!==false||manifest.artifacts?.length!==60)throw new Error('Wave 3 evidence metadata mismatch');
if([...manifest.states].sort().join()!==[...expectedStates].sort().join())throw new Error('Wave 3 state matrix mismatch');
if(manifest.viewports.map(({width,height})=>`${width}x${height}`).sort().join()!==[...expectedViewports].sort().join())throw new Error('Wave 3 viewport matrix mismatch');
for(const [file,expected] of Object.entries(manifest.sources)){if(sha(await readFile(join(root,file)))!==expected)throw new Error(`${file} source hash mismatch`);}
for(const [file,expected] of Object.entries(manifest.v50Sources??{})){if(sha(await readFile(join(root,file)))!==expected)throw new Error(`${file} V50 source hash mismatch`);}
const v50SourceHash=sha(Object.entries(manifest.v50Sources??{}).sort().map(([file,digest])=>`${file}:${digest}`).join('\n'));
if(!Object.keys(manifest.v50Sources??{}).some((file)=>file.startsWith('prototype-v50/'))||v50SourceHash!==manifest.v50SourceHash)throw new Error('V50 source binding mismatch');
const capture=await readFile(join(root,manifest.captureScript.file));
if(sha(capture)!==manifest.captureScript.sha256)throw new Error('capture script hash mismatch');
const captureRunBytes=await readFile(join(dir,manifest.captureRun.file));
if(sha(captureRunBytes)!==manifest.captureRun.sha256)throw new Error('capture run hash mismatch');
const captureRun=JSON.parse(captureRunBytes);
if(captureRun.status!=='PASS'||captureRun.captureScriptSha256!==manifest.captureScript.sha256||captureRun.browser?.name!==manifest.browser?.name||captureRun.browser?.version!==manifest.browser?.version||captureRun.checks?.overflowChecks!==60||captureRun.checks?.axeScans!==12||captureRun.checks?.screenshots!==60||[...captureRun.semanticStates].sort().join()!==[...expectedStates].sort().join())throw new Error('capture run assertions mismatch');
const runtimeHash=sha(Object.entries(manifest.sources).sort().map(([file,digest])=>`${file}:${digest}`).join('\n'));
if(runtimeHash!==manifest.runtimeHash)throw new Error('runtime source hash mismatch');
const buildId=(await readFile(join(root,'apps/clinic-portal/.next/BUILD_ID'),'utf8')).trim();
if(buildId!==manifest.runtimeBuild.buildId||sha(buildId)!==manifest.runtimeBuild.sha256)throw new Error('runtime build hash mismatch');
const keys=new Set();
for(const item of manifest.artifacts){
  const key=`${item.state}:${item.viewport}`;if(keys.has(key))throw new Error(`duplicate artifact ${key}`);keys.add(key);
  const bytes=await readFile(join(dir,item.file));
  if(bytes.toString('hex',1,4)!=='504e47'||bytes.readUInt32BE(16)!==item.width||bytes.readUInt32BE(20)!==item.height||sha(bytes)!==item.sha256||bytes.length!==item.bytes)throw new Error(`${item.file} integrity mismatch`);
}
for(const state of expectedStates)for(const viewport of expectedViewports)if(!keys.has(`${state}:${viewport}`))throw new Error(`missing ${state}:${viewport}`);
const actualPngs=(await readdir(dir)).filter((file)=>file.endsWith('.png')).sort();
const declaredPngs=manifest.artifacts.map(({file})=>file).sort();
if(actualPngs.join()!==declaredPngs.join())throw new Error('missing or orphan screenshots');
if(manifest.checks.horizontalOverflow!=='PASS_60_OF_60'||manifest.checks.axeSeriousCritical!=='PASS_12_OF_12'||manifest.checks.semanticStates!=='PASS_12_OF_12')throw new Error('capture checks are incomplete');
console.log('Wave 3 DoctorShift visual evidence verified: 12 states × 5 viewports = 60/60');
