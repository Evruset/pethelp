import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../..');
const evidence=resolve(root,'docs/testing/evidence/wave4-owner-discovery');
const run=JSON.parse(await readFile(resolve(evidence,'capture-run.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const requiredStates=['specialty-entry','service-entry','discovery-loading','discovery-results-list','discovery-results-map','selected-doctor','selected-map-pin','location-without-coordinates-list-fallback','empty','error-retry','stale-selection','booking-handoff'];
const requiredViewports=['390x844','430x932','768x1024','1024x768','1440x900'];

if(run.status!=='PASS')throw new Error('W4-C capture did not pass');
if(run.cases?.length<18||run.cases.length>25)throw new Error(`W4-C screenshot count is outside 18-25: ${run.cases?.length}`);
if(!requiredStates.every(state=>run.states?.includes(state)))throw new Error('W4-C required visual state is missing');
if(!requiredViewports.every(viewport=>run.viewports?.includes(viewport)))throw new Error('W4-C required viewport is missing');
for(const width of [390,768,1440])for(const state of ['discovery-results-list','booking-handoff'])if(!run.cases.some(item=>item.state===state&&item.width===width))throw new Error(`critical flow missing ${state} at ${width}`);
const keyboardTargets=['specialty-selector','error-retry','map-pin','published-slot','booking-submit'];
if(run.checks?.horizontalOverflow!==run.cases.length||run.checks?.axeSeriousCritical!==run.cases.length||run.checks?.keyboardFocus?.status!=='PASS'||!keyboardTargets.every(target=>run.checks.keyboardFocus.targets?.includes(target)))throw new Error('W4-C capture gates are incomplete');
const actualPngs=(await readdir(evidence)).filter(file=>file.endsWith('.png')).sort();
const boundPngs=run.cases.map(item=>item.file).sort();
if(actualPngs.join('\n')!==boundPngs.join('\n'))throw new Error('W4-C evidence contains missing or unbound PNGs');
for(const [source,expected] of Object.entries(run.sources??{}))if(sha(await readFile(resolve(root,source)))!==expected)throw new Error(`W4-C source hash mismatch: ${source}`);
for(const item of run.cases){const bytes=await readFile(resolve(evidence,item.file));if(sha(bytes)!==item.sha256||bytes.toString('hex',1,4)!=='504e47'||bytes.readUInt32BE(16)!==item.width||bytes.readUInt32BE(20)!==item.height)throw new Error(`W4-C evidence mismatch: ${item.file}`);}
console.log(`Wave 4 Owner discovery evidence verified: ${run.states.length} states, ${run.cases.length} screenshots, ${run.viewports.length} viewports`);
