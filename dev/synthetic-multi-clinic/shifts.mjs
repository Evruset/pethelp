// Actual native DoctorShift API/UI acceptance against a selected new fixture generation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {syntheticEnv} from './env.mjs';
Object.assign(process.env,syntheticEnv);
assert.match(new URL(syntheticEnv.DATABASE_URL).pathname,/^\/synthetic_multiclinic_v4_r_[a-f0-9]{12}$/);
const require=createRequire(import.meta.url);
const {readDataset,nativeDataset,connect}=require('../../backend/scripts/seed-local-multi-clinic.cjs');
const {credential,api}=await import('./identity.mjs');
const d=nativeDataset(readDataset(`${process.env.HOME}/Downloads/VetHelp_Synthetic_25_Clinics_Dataset.zip`));
const clinic=d.clinics.at(-1),foreign=d.clinics[0];
const sessions={};for(const role of ['CLINIC_ADMIN','RECEPTIONIST','VETERINARIAN','OWNER'])sessions[role]=await credential(d.accounts.find(a=>a.role===role&&(role==='OWNER'||a.clinic_id===clinic.clinic_id)));
const c=await connect();let browser;const gates=[];const pass=s=>{gates.push(s);console.log('PASS '+s);};
try{
 const anchor=(await c.query("SELECT ((clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date+1)::text AS calendar_day")).rows[0].calendar_day;
 const from=anchor+'T00:00:00+03:00',to=new Date(Date.parse(from)+14*86400000).toISOString();
 const path=`/v1/clinic/${clinic.clinic_id}/locations/${clinic.location_id}/schedule/slots`,query=`?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
 const data=await api(path+query,sessions.CLINIC_ADMIN);assert.equal(data.status,200);assert.equal(data.json.doctorShifts.length,140);assert.equal(data.json.timezone,'Europe/Moscow');
 for(const s of data.json.doctorShifts){assert(d.staff_doctors.some(doc=>doc.doctor_id===s.doctor.id&&doc.clinic_id===clinic.clinic_id));assert.equal(s.endsAt&&Date.parse(s.endsAt)-Date.parse(s.startsAt),9*3600000);assert.deepEqual(Object.keys(s).sort(),['doctor','endsAt','id','staff','startsAt','status']);}
 pass('140 native shifts, exact doctor/location scope and safe DTO');
 assert.equal((await api(path+query,sessions.RECEPTIONIST)).status,200);
 for(const role of ['VETERINARIAN','OWNER'])assert.equal((await api(path+query,sessions[role])).status,403);
 assert.equal((await api(`/v1/clinic/${foreign.clinic_id}/locations/${foreign.location_id}/schedule/slots`+query,sessions.CLINIC_ADMIN)).status,403);
 pass('Reception allowed; Owner/Veterinarian and foreign clinic denied');
 const {chromium,expect}=createRequire(new URL('../../apps/clinic-portal/package.json',import.meta.url))('@playwright/test');browser=await chromium.launch();
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Europe/Moscow'});await context.addCookies([{name:'vethelp_clinic_session',value:sessions.CLINIC_ADMIN.token,url:'http://127.0.0.1:3320',httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();await page.goto(`http://127.0.0.1:3320/clinics/${clinic.clinic_id}/locations/${clinic.location_id}/schedule`);
 await expect(page.getByRole('heading',{name:'Смены врачей',exact:true})).toBeVisible();
 await page.getByLabel('Дата расписания',{exact:true}).fill(anchor);
 const section=page.locator('#schedule-shifts');await expect(section.getByText('Показано смен: 140',{exact:true})).toBeVisible();
 await expect(section.getByRole('cell',{name:'09:00–18:00',exact:true}).first()).toBeVisible();await section.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-90));
 await page.screenshot({path:'dev/product-batch01/screenshots/synthetic-native-shifts-desktop.png',fullPage:false});pass('Clinic desktop actual native shift table and Moscow times');
 const staff=data.json.doctorShifts[0].staff.id;
 await page.getByLabel('Фильтр по врачу',{exact:true}).selectOption(staff);await expect(section.getByText('Показано смен: 14',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'День',exact:true}).click();await expect(section.getByText('Показано смен: 1',{exact:true})).toBeVisible();await expect(section.getByRole('cell',{name:'10',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await section.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'dev/product-batch01/screenshots/synthetic-native-shifts-mobile.png',fullPage:false});pass('Doctor/date filters and 390px responsive shift cards with ten existing slots');
 // Real API response controls unavailable/empty states; no synthetic success data.
 await page.route('**/api/clinic/**/schedule/slots?**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"code":"TEST_UNAVAILABLE"}'}));
 await page.getByRole('button',{name:'Неделя',exact:true}).click();await expect(section.getByText('Данные о сменах сейчас недоступны.',{exact:true})).toBeVisible();pass('Failed refresh hides stale shifts');
 await page.unroute('**/api/clinic/**/schedule/slots?**');await page.getByLabel('Дата расписания',{exact:true}).fill('2099-01-01');await expect(section.getByText('В выбранном периоде и с этим фильтром смен нет.',{exact:true})).toBeVisible();pass('Actual API empty future period');
 console.log(JSON.stringify({PASS:gates.length,FAIL:0,gates}));
}finally{await browser?.close();await c.end();}
