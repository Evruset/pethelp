// Additional read-only actual UI acceptance; auth sessions use only fixture identities.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {syntheticEnv} from './env.mjs';
Object.assign(process.env,syntheticEnv);const require=createRequire(import.meta.url);
const {readDataset,nativeDataset}=require('../../backend/scripts/seed-local-multi-clinic.cjs');const {credential,api}=await import('./identity.mjs');
const d=nativeDataset(readDataset(`${process.env.HOME}/Downloads/VetHelp_Synthetic_25_Clinics_Dataset.zip`)),clinic=d.clinics.at(-1);
const {chromium,expect}=createRequire(new URL('../../apps/clinic-portal/package.json',import.meta.url))('@playwright/test');const browser=await chromium.launch();
try{
 for(const role of (process.argv.includes('--vet-only')?['VETERINARIAN']:['RECEPTIONIST','VETERINARIAN'])){
  const session=await credential(d.accounts.find(a=>a.role===role&&a.clinic_id===clinic.clinic_id));const context=await browser.newContext({viewport:{width:768,height:1024}});
  await context.addCookies([{name:'vethelp_clinic_session',value:session.token,url:'http://127.0.0.1:3320',httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();
  const path=`/clinics/${clinic.clinic_id}/locations/${clinic.location_id}`;
  if(role==='RECEPTIONIST'){
   await page.goto('http://127.0.0.1:3320'+path+'/queue');await expect(page.getByRole('heading',{name:'Очередь подтверждения'})).toBeVisible();
   assert.equal((await api(`/v1/clinic/${clinic.clinic_id}/locations/${clinic.location_id}/vet/visits`,session)).status,403);
   console.log('PASS Receptionist actual journal UI; veterinarian API denied');
  }else{
   await page.goto('http://127.0.0.1:3320'+path+'/vet/visits');await page.locator('main a[href*="/vet/visits/"]').first().click();
   await expect(page.getByRole('heading',{name:'Данные записи',exact:true})).toBeVisible();await expect(page.getByRole('navigation',{name:'Разделы приёма'})).toBeVisible();
   console.log('PASS Veterinarian actual visit detail and authorized patient context');
  }
  await page.screenshot({path:`dev/product-batch01/screenshots/synthetic-${role.toLowerCase()}-detail.png`,fullPage:true});await context.close();
 }
 console.log(JSON.stringify({PASS:process.argv.includes('--vet-only')?1:2,FAIL:0}));
}finally{await browser.close();}
