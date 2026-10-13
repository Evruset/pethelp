import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {SignJWT} from 'jose';
const base='http://127.0.0.1:3308',ownerUrl='http://localhost:8088';
const statePath=resolve('../../dev/product-batch01/demo-state.local.json');
const pictures=resolve('../../dev/product-batch01/screenshots');
const secret='product-batch01-demo-jwt-secret-at-least-32';
async function ownerSession(request:any,state:any){
 if(state.ownerSession){const r=await request.get(`${base}/v1/auth/session`,{headers:{Authorization:`Bearer ${state.ownerSession.sessionToken}`}});if(r.ok())return state.ownerSession;}
 const r=await request.post(`${base}/v1/auth/otp/request`,{data:{phone:state.phone}});expect(r.ok()).toBe(true);const challenge=await r.json();
 const v=await request.post(`${base}/v1/auth/otp/verify`,{data:{challengeId:challenge.challengeId,code:'123456'}});expect(v.ok()).toBe(true);state.ownerSession=await v.json();writeFileSync(statePath,JSON.stringify(state,null,2),{mode:0o600});return state.ownerSession;
}
async function book(page:Page,clinicName:string,petName='Барсик'){
 await page.getByRole('button',{name:'Записать питомца',exact:true}).click();
 await page.getByRole('radio').filter({hasText:petName}).click();await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 const card=page.getByText(clinicName,{exact:true}).locator('..');await card.getByRole('button',{name:'Открыть клинику'}).click();
 await page.getByRole('radio').filter({hasText:'Приём терапевта'}).click();await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Доступное время'})).toBeVisible();
 await page.getByRole('radio').first().click();await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 const response=page.waitForResponse(r=>r.url()===`${base}/v1/booking-holds` && r.request().method()==='POST');
 await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();const r=await response;expect(r.ok()).toBe(true);return r.json();
}
test('DEMO real API: Owner manual/automatic booking, Clinic confirmation/decline, Owner cancellation and multiple pets',async({page,browser,request,baseURL})=>{
 mkdirSync(pictures,{recursive:true});const state=JSON.parse(readFileSync(statePath,'utf8'));const session=await ownerSession(request,state);
 await page.addInitScript(({token,expires})=>sessionStorage.setItem('vethelp.owner.session.v1',JSON.stringify({opaqueCredential:token,cacheScope:'product-demo-owner',expiresAtEpochMs:Date.parse(expires)})),{token:session.sessionToken,expires:session.expiresAt});
 await page.goto(ownerUrl);await expect(page.getByRole('heading',{name:'Мои питомцы'})).toBeVisible();await expect(page.getByRole('button',{name:'Карточка и дневник: Барсик'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(pictures,'owner-home.png'),fullPage:true});
 const manual=await book(page,state.clinics[0].name);expect(manual.status).toBe('PENDING_CONFIRMATION');expect(manual.confirmationMode).toBe('MANUAL');await expect(page.getByText('Ожидает подтверждения клиникой',{exact:true})).toBeVisible();await page.screenshot({path:resolve(pictures,'owner-manual.png'),fullPage:true});
 await page.getByRole('button',{name:'Открыть запись',exact:true}).click();await expect(page.getByText('Ожидаем подтверждения',{exact:true})).toBeVisible();
 const token=await new SignJWT({roles:['CLINIC_ADMIN'],clinicIds:state.clinics.map((c:any)=>c.clinicId),locationIds:state.clinics.map((c:any)=>c.locationId)}).setProtectedHeader({alg:'HS256'}).setSubject(state.adminId).setIssuer('vethelp-product-demo').setAudience('vethelp-api').setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(secret));
 const clinicContext=await browser.newContext();await clinicContext.addCookies([{name:'vethelp_clinic_session',value:token,url:baseURL!,httpOnly:true,sameSite:'Lax'}]);const clinic=await clinicContext.newPage();const scope=`/clinics/${state.clinics[0].clinicId}/locations/${state.clinics[0].locationId}`;
 await clinic.goto(`${scope}/queue`);const row=clinic.getByRole('row').filter({hasText:'Барсик'}).first();await expect(row).toBeVisible();await clinic.screenshot({path:resolve(pictures,'clinic-incoming.png'),fullPage:true});
 // Retained DEMO database can contain earlier pending requests; honor the queue's FIFO authority.
 for(let remaining=20;remaining>0;remaining--){
  const current=await request.get(`${base}/v1/owner/appointments/${manual.holdId}`,{headers:{Authorization:`Bearer ${session.sessionToken}`}});
  if((await current.json()).state==='CONFIRMED')break;
  await clinic.getByRole('row').filter({hasText:'Барсик'}).first().getByRole('button',{name:'Подтвердить',exact:true}).click();
  await expect(clinic.getByRole('status')).toContainText('Запись подтверждена');
  await clinic.reload();
 }
 await page.getByRole('button',{name:'Обновить статус'}).click();await expect(page.getByText('Подтверждена',{exact:true})).toBeVisible();
 await (require(resolve('../../dev/product-batch01/patient-fixture.cjs')))(manual.holdId);
 await clinic.goto(`${scope}/patients`);await expect(clinic.getByText('Барсик',{exact:true}).first()).toBeVisible();await clinic.getByText('Барсик',{exact:true}).first().click();await expect(clinic).toHaveURL(/\/patients\/[0-9a-f-]+$/);await expect(clinic.getByRole('heading',{level:1,name:'Барсик',exact:true})).toBeVisible();await clinic.screenshot({path:resolve(pictures,'clinic-patient.png'),fullPage:true});
 await page.getByRole('button',{name:'Назад к записям'}).click();await page.getByRole('button',{name:'На главную'}).click();
 const pending=await book(page,state.clinics[0].name);await page.getByRole('button',{name:'Открыть запись',exact:true}).click();await page.getByRole('button',{name:'Отменить запись',exact:true}).click();await page.getByRole('button',{name:'Подтвердить отмену'}).click();await expect(page.getByText('Отменена',{exact:true})).toBeVisible();
 const reread=await request.get(`${base}/v1/owner/appointments/${pending.holdId}`,{headers:{Authorization:`Bearer ${session.sessionToken}`}});expect((await reread.json()).state).toBe('RELEASED');
 await page.getByRole('button',{name:'Назад к записям'}).click();await page.getByRole('button',{name:'На главную'}).click();
 const rejected=await book(page,state.clinics[0].name);await page.getByRole('button',{name:'Открыть запись',exact:true}).click();await clinic.goto(`${scope}/queue`);await clinic.getByRole('row').filter({hasText:'Барсик'}).first().getByRole('button',{name:'Отклонить',exact:true}).click();
 const dialog=clinic.getByRole('dialog',{name:'Отклонить заявку'});await dialog.getByLabel('Причина отклонения').fill('ДЕМО: врач недоступен');await dialog.getByRole('button',{name:'Отклонить заявку'}).click();await expect(clinic.getByRole('status')).toContainText('Заявка отклонена');await page.getByRole('button',{name:'Обновить статус'}).click();await expect(page.getByText('Отменена',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Назад к записям'}).click();await page.getByRole('button',{name:'На главную'}).click();
 await page.getByRole('button',{name:'Управлять питомцами'}).click();await page.getByRole('button',{name:'Добавить ещё'}).click();const petName=`Луна ${Date.now().toString().slice(-5)}`;await page.getByRole('textbox',{name:'Имя питомца'}).fill(petName);await page.getByRole('button',{name:'Сохранить питомца'}).click();await expect(page.getByRole('radio').filter({hasText:petName})).toBeVisible();await page.getByRole('button',{name:'На главную'}).click();
 const automatic=await book(page,state.clinics[1].name,petName);expect(automatic.status).toBe('CONFIRMED');expect(automatic.confirmationMode).toBe('AUTOMATIC');await expect(page.getByText('Запись подтверждена',{exact:true})).toBeVisible();await page.screenshot({path:resolve(pictures,'owner-automatic.png'),fullPage:true});
 await clinic.goto(`/clinics/${state.clinics[1].clinicId}/locations/${state.clinics[1].locationId}/schedule`);await expect(clinic.getByTestId(`schedule-slot-${automatic.slotId}`)).toContainText('Запись подтверждена');await clinic.screenshot({path:resolve(pictures,'clinic-schedule.png'),fullPage:true});
 // Cross-origin preflight is required by Owner cancellation's optimistic-concurrency header.
 const cors=await request.fetch(`${base}/v1/owner/bookings/${manual.holdId}/cancel`,{method:'OPTIONS',headers:{Origin:ownerUrl,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,idempotency-key,if-match'}});expect(cors.headers()['access-control-allow-headers'].toLowerCase()).toContain('if-match');
 const forbidden=await request.get(`${base}/v1/owner/appointments/${rejected.holdId}`,{headers:{Authorization:`Bearer ${token}`}});expect(forbidden.status()).toBe(403);
 await clinicContext.storageState({path:resolve('../../dev/product-batch01/clinic-auth.local.json')});
 await clinicContext.close();
});

// Reuse the persisted real-API demonstration; this check creates no booking or fixture.
test('DEMO PILOT_V1 schedule does not advertise the blocked clinical completion action',async({browser,baseURL})=>{
 const state=JSON.parse(readFileSync(statePath,'utf8'));
 const context=await browser.newContext({storageState:resolve('../../dev/product-batch01/clinic-auth.local.json')});
 const page=await context.newPage();
 await page.goto(`${baseURL}/clinics/${state.clinics[1].clinicId}/locations/${state.clinics[1].locationId}/schedule`);
 await expect(page.getByRole('heading',{name:'Расписание локации'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Закрыть приём',exact:true})).toHaveCount(0);
 await page.screenshot({path:resolve(pictures,'clinic-schedule.png'),fullPage:true});
 await context.close();
});
