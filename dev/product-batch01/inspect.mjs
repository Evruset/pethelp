// Opens the actual demo clients after the real-API walkthrough has authenticated them.
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(resolve(root,'apps/clinic-portal/package.json'));
const {chromium}=require('@playwright/test');
const state=JSON.parse(readFileSync(resolve(root,'dev/product-batch01/demo-state.local.json'),'utf8'));
if(!state.ownerSession)throw Error('Run the product Playwright walkthrough first.');
const browser=await chromium.launch({headless:false});
const owner=await browser.newContext({viewport:{width:390,height:844}});
await owner.addInitScript(({session})=>sessionStorage.setItem('vethelp.owner.session.v1',JSON.stringify({opaqueCredential:session.sessionToken,cacheScope:'product-demo-inspect',expiresAtEpochMs:Date.parse(session.expiresAt)})),{session:state.ownerSession});
await (await owner.newPage()).goto('http://localhost:8088');
const clinic=await browser.newContext({storageState:resolve(root,'dev/product-batch01/clinic-auth.local.json')});
await (await clinic.newPage()).goto(`http://127.0.0.1:3318/clinics/${state.clinics[0].clinicId}/locations/${state.clinics[0].locationId}`);
if(existsSync(resolve(root,'dev/product-batch01/vet-auth.local.json'))){const vet=await browser.newContext({storageState:resolve(root,'dev/product-batch01/vet-auth.local.json')});await(await vet.newPage()).goto(`http://127.0.0.1:3318/clinics/${state.clinics[0].clinicId}/locations/${state.clinics[0].locationId}/vet/visits`);}
await new Promise(resolve=>browser.on('disconnected',resolve));
