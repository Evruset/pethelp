import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';

const backend = (process.env.VETHELP_API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const otpCode = process.env.AUTH_DEV_OTP_CODE ?? '246810';
const jwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET ?? 'local-development-jwt-signing-key-not-for-shared-use';
const ownerWeb = `http://127.0.0.1:${Number(process.env.OWNER_EXPO_WEB_PORT ?? 8081)}`;
const clinicPortal = `http://127.0.0.1:${Number(process.env.CLINIC_PORTAL_LOCAL_STACK_PORT ?? 3213)}`;
const UUID = /^[0-9a-f-]{36}$/i;

type Hold = { holdId: string; status: string; aggregateVersion: number };
type Context = { clinicId: string; locationId: string; serviceId: string; petId: string; slotId: string; expectedSlotVersion: number };

const wave4Evidence = resolve(process.cwd(), '../../docs/testing/evidence/wave4-owner-discovery');

test('WAVE4_DISCOVERY_REAL_E2E closes specialty/service, map/list, stale and booking handoff', async ({ page, request }) => {
  test.setTimeout(300_000);
  await expect(request.get(`${backend}/v1/health`).then((response) => response.json())).resolves.toMatchObject({ status: 'ok', profile: 'PILOT_V1' });
  seedLocalWave3Fixtures();
  enableWave4Fixture();
  await createPublishedDoctorShiftThroughPortal(page);
  await resetLocalOtpLimit();
  await enterOwnerDiscovery(page);
  mkdirSync(wave4Evidence, { recursive: true });
  for(const file of readdirSync(wave4Evidence))if(/^\d{2}-[a-z0-9-]+-\d+x\d+\.png$/.test(file)||file==='capture-run.json')unlinkSync(resolve(wave4Evidence,file));
  const records: Array<{state:string;file:string;width:number;height:number;sha256?:string}> = [];
  const keyboardTargets:string[]=[];
  const capture = async (state:string,width:number,height:number,anchor?:ReturnType<Page['locator']>) => {
    await page.setViewportSize({width,height});
    if(anchor){await anchor.scrollIntoViewIfNeeded();await expect(anchor).toBeInViewport();}
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const axe = await new AxeBuilder({page}).analyze();
    expect(axe.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
    const file = `${String(records.length + 1).padStart(2,'0')}-${state}-${width}x${height}.png`;
    await page.screenshot({path:resolve(wave4Evidence,file),fullPage:true});
    records.push({state,file,width,height});
  };

  await tabTo(page,page.getByRole('radio',{name:'Wave 3 E2E'}));keyboardTargets.push('specialty-selector');
  await capture('specialty-entry',390,844);
  await page.route(/\/api\/owner\/v1\/owner\/clinic-catalog\/specialist-discovery\?/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({observedAt:new Date().toISOString(),limit:50,doctors:[]})}),{times:1});
  await page.getByText('Wave 3 E2E',{exact:true}).click();
  await expect(page.getByText('Свободных специалистов пока нет')).toBeVisible();
  await capture('empty',768,1024);
  await page.getByRole('button',{name:'По услуге'}).click();
  await capture('service-entry',430,932);
  const discoveryRoute=/\/api\/owner\/v1\/owner\/clinic-catalog\/specialist-discovery\?/;
  await page.route(discoveryRoute,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'TEMPORARY_UNAVAILABLE'})}));
  await page.getByText('Initial visit',{exact:true}).click();
  await expect(page.getByText('Не удалось обновить доступность')).toBeVisible({timeout:20_000});
  await tabTo(page,page.getByRole('button',{name:'Повторить'}));keyboardTargets.push('error-retry');
  await capture('error-retry',1440,900);
  await page.unroute(discoveryRoute);
  await page.route(discoveryRoute,async route=>{await new Promise(resolveDelay=>setTimeout(resolveDelay,700));await route.continue();},{times:1});
  const serviceResponse = page.waitForResponse(response => response.url().includes('/specialist-discovery?serviceCode=') && response.ok());
  await page.getByRole('button',{name:'Повторить'}).click();
  await expect(page.getByText('Ищем врачей со свободным временем')).toBeVisible();
  await capture('discovery-loading',390,844);
  const servicePayload = await projection<{doctors:Array<Record<string,unknown>>}>(await (await serviceResponse).json());
  expect(servicePayload.doctors.length).toBeGreaterThan(0);
  await expect(page.getByText('Wave 3 E2E Doctor',{exact:true})).toBeVisible();
  await capture('discovery-results-list',768,1024);

  await page.getByRole('button',{name:'По специальности'}).click();
  await page.getByText('Wave 3 E2E',{exact:true}).click();
  await page.getByRole('button',{name:'Обновить'}).click();
  await expect(page.getByText('Wave 3 E2E Doctor',{exact:true})).toBeVisible();
  await capture('discovery-results-list',390,844);
  await capture('discovery-results-list',1440,900);

  const specialtyPayload = await page.evaluate(async () => (await fetch('/api/owner/v1/owner/clinic-catalog/specialist-discovery?specialtyId=94000000-0000-4000-8000-000000000001')).json());
  const doctor = (await projection<{doctors:Array<{clinicId:string;locationId:string;doctorId:string;serviceId:string;latitude:number|null;longitude:number|null;slots:Array<{slotId:string;expectedVersion:number}>}>}>(specialtyPayload)).doctors.find(item=>item.doctorId==='94000000-0000-4000-8000-000000000002');
  expect(doctor).toBeTruthy();
  expect(doctor).toMatchObject({clinicId:localPilotIds().clinicId,locationId:localPilotIds().locationId,latitude:55.7558,longitude:37.6173});
  expect(isPublishedWave4Slot(doctor!.slots[0].slotId)).toBe(true);

  await page.getByRole('button',{name:'Карта'}).click();
  await expect(page.getByLabel('Карта доступных клиник')).toBeVisible();
  const mapPin=page.getByRole('button',{name:/Клиника на карте: VetHelp Pilot/});
  await tabTo(page,mapPin);keyboardTargets.push('map-pin');
  await capture('discovery-results-map',430,932);
  await capture('discovery-results-map',768,1024);
  await capture('discovery-results-map',1440,900);
  await mapPin.click();
  await capture('selected-map-pin',390,844);
  const firstTime = page.getByRole('radiogroup',{name:/Ближайшее время — Wave 3 E2E Doctor/}).getByRole('radio').first();
  await tabTo(page,firstTime);keyboardTargets.push('published-slot');
  await firstTime.click();
  await capture('selected-doctor',768,1024);

  unpublishSlot(doctor!.slots[0].slotId);
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  const staleMessage=page.getByText('Выбранное время больше недоступно');
  await expect(staleMessage).toBeVisible();
  await capture('stale-selection',390,844,staleMessage);
  await expect(page.getByText('Заявка отправлена')).toHaveCount(0);

  setLocationCoordinates(null,null);
  await page.getByRole('button',{name:'Обновить'}).click();
  await expect(page.getByText('Wave 3 E2E Doctor',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Карта'}).click();
  await expect(page.getByText('Для этих результатов нет координат')).toBeVisible();
  await capture('location-without-coordinates-list-fallback',430,932);
  await page.getByRole('button',{name:'Открыть список'}).click();
  setLocationCoordinates(55.7558,37.6173);

  const nextTime = page.getByRole('radiogroup',{name:/Ближайшее время — Wave 3 E2E Doctor/}).getByRole('radio').first();
  await nextTime.click();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Клиника и услуга'})).toBeVisible();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Доступное время'})).toBeVisible();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(page.getByText('Проверьте заявку')).toBeVisible();
  await tabTo(page,page.getByRole('button',{name:'Отправить заявку'}));keyboardTargets.push('booking-submit');
  await capture('booking-handoff',390,844);
  await capture('booking-handoff',768,1024);
  await capture('booking-handoff',1440,900);
  const created = page.waitForResponse(response=>response.url().endsWith('/api/owner/v1/booking-holds')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Отправить заявку'}).click();
  expect(await projection<Hold>(await (await created).json())).toMatchObject({status:'PENDING_CONFIRMATION'});
  await expect(page.getByText('Ожидает подтверждения')).toBeVisible();

  await page.getByRole('button',{name:'Открыть актуальный статус'}).click();
  await expect(page.getByText('Клиника подтверждает запись')).toBeVisible();
  await capture('pending-confirmation',1024,768);

  const sources=['apps/owner-app/src/discovery/SpecialistDiscoveryScreen.tsx','apps/owner-app/src/discovery/DiscoveryMapSurface.tsx','apps/owner-app/src/discovery/specialist-discovery-api.ts','apps/owner-app/src/clinics/ClinicServiceScreen.tsx','apps/owner-app/src/clinics/AvailabilityScreen.tsx','apps/owner-app/src/booking/BookingReviewScreen.tsx','apps/owner-app/src/ui/primitives.tsx','apps/owner-app/tests/e2e/owner-expo-web.real-stack.spec.ts'];
  for(const record of records)record.sha256=createHash('sha256').update(readFileSync(resolve(wave4Evidence,record.file))).digest('hex');
  writeFileSync(resolve(wave4Evidence,'capture-run.json'),JSON.stringify({status:'PASS',generatedAt:new Date().toISOString(),browser:await page.context().browser()?.version(),sources:Object.fromEntries(sources.map(source=>[source,createHash('sha256').update(readFileSync(resolve(process.cwd(),'../..',source))).digest('hex')])),checks:{screenshots:records.length,horizontalOverflow:records.length,axeSeriousCritical:records.length,keyboardFocus:{status:'PASS',targets:keyboardTargets}},states:[...new Set(records.map(record=>record.state))],viewports:[...new Set(records.map(record=>`${record.width}x${record.height}`))],cases:records},null,2)+'\n');
});

async function tabTo(page:Page,target:ReturnType<Page['locator']>,limit=50){
  for(let index=0;index<limit;index+=1){await page.keyboard.press('Tab');if(await target.evaluate(element=>element===document.activeElement).catch(()=>false)){await expect(target).toBeFocused();return;}}
  throw new Error('keyboard traversal did not reach required W4-C control');
}

test('OWNER_EXPO_WEB_RUNTIME covers auth, booking, confirm, reject, expire, refresh, deep link and session loss', async ({ page, request }) => {
  test.setTimeout(120_000);
  await expect(request.get(`${backend}/v1/health`).then((response) => response.json())).resolves.toMatchObject({ status: 'ok', profile: 'PILOT_V1' });
  const generated = await createPublishedDoctorShiftThroughPortal(page);
  await resetLocalOtpLimit();
  expireLocalPendingHolds();
  const initialExpiration = await request.post(`${backend}/internal/workers/expire-holds`, { headers: { Authorization: 'ServiceBearer local-development-worker-token-not-for-shared-use' } });
  expect(initialExpiration.ok()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?intent=book');
  await page.getByRole('button', { name: 'Начать запись' }).click();
  await page.getByLabel('Номер телефона').fill(`+7996${String(Date.now()).slice(-7)}`);
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из сообщения').fill(otpCode);
  await page.getByRole('button', { name: 'Подтвердить' }).click();
  await page.getByRole('button', { name: 'Продолжить запись' }).click();
  await page.getByRole('button', { name: 'Добавить питомца' }).click();
  await page.getByLabel('Имя питомца').fill('Expo Web E2E');
  await page.getByText('Кошка', { exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить питомца' }).click();
  await page.getByText('Expo Web E2E', { exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('button', { name: 'Выбрать клинику' }).click();
  await page.getByText('Initial visit', { exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const generatedContext = await browserContext(page, generated.slotIds[0]);
  const generatedTime = new Date(generated.startsAt[0]).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'});
  const generatedDate = new Date(generated.startsAt[0]).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'});
  await page.getByLabel(`Дата ${generatedDate}`).getByRole('radio',{name:generatedTime}).click();
  await expect(page.getByText('Выбрано', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByText('Проверьте заявку')).toBeVisible();
  const createdResponse = page.waitForResponse((response) => response.url().endsWith('/api/owner/v1/booking-holds') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  const first = await projection<Hold>(await (await createdResponse).json());
  expect(first).toMatchObject({ status: 'PENDING_CONFIRMATION', aggregateVersion: 1 });
  await page.getByRole('button', { name: 'Открыть актуальный статус' }).click();
  await expect(page).toHaveURL(new RegExp(`/booking/${first.holdId}$`));
  await expect(page.getByText('Клиника подтверждает запись')).toBeVisible();
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../../docs/testing/evidence/wave2-owner-expo-web/pending-${viewport.width}x${viewport.height}.png`, fullPage: true });
  }
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')).toEqual([]);

  const context = generatedContext;
  const clinicToken = clinicJwt(context);
  await page.goto(`${clinicPortal}/clinics/${context.clinicId}/locations/${context.locationId}/queue`);
  await expect(page.getByRole('heading',{name:/Очередь/}).first()).toBeVisible();
  await page.locator('button:enabled',{hasText:'Подтвердить'}).first().click();
  await expect(page.getByRole('status')).toContainText('Запись подтверждена');
  await page.goto(`${ownerWeb}/booking/${first.holdId}`);
  await expect(page.getByText('Запись подтверждена')).toBeVisible();
  await page.screenshot({ path: '../../docs/testing/evidence/wave2-owner-expo-web/confirmed-1440x900.png', fullPage: true });
  await page.reload();
  await expect(page.getByText('Запись подтверждена')).toBeVisible();

  const rejected = await createHold(page, await browserContext(page, generated.slotIds[1]));
  await clinicDecision(request, clinicToken, rejected, 'decline');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/booking/${rejected.holdId}`);
  await expect(page.getByText('Клиника не сможет принять в выбранное время')).toBeVisible();
  await page.screenshot({ path: '../../docs/testing/evidence/wave2-owner-expo-web/rejected-390x844.png', fullPage: true });

  const expired = await createHold(page, await browserContext(page, generated.slotIds[2]));
  expireLocalHold(expired.holdId);
  const worker = await request.post(`${backend}/internal/workers/expire-holds`, { headers: { Authorization: 'ServiceBearer local-development-worker-token-not-for-shared-use' } });
  expect(worker.ok()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/booking/${expired.holdId}`);
  await expect(page.getByText('Клиника не успела подтвердить запись')).toBeVisible();
  await page.screenshot({ path: '../../docs/testing/evidence/wave2-owner-expo-web/expired-390x844.png', fullPage: true });

  const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookie: document.cookie }));
  expect(storage).toEqual({ local: [], session: [], cookie: '' });
  await page.context().clearCookies();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'VetHelp' })).toBeVisible();
});

async function browserContext(page: Page, requiredSlotId?: string): Promise<Context> {
  return page.evaluate(async (required) => {
    const read = async (path: string) => (await fetch(`/api/owner/${path}`, { credentials: 'same-origin' })).json();
    const pets = await read('v1/owner/pets');
    const catalog = await read('v1/owner/clinic-catalog');
    const clinic = catalog.clinics.find((item: { name: string }) => item.name === 'VetHelp Pilot');
    const detail = await read(`v1/owner/clinic-catalog/${clinic.clinicId}/locations/${clinic.locationId}`);
    const service = detail.services[0];
    const availability = await read(`v1/owner/clinic-catalog/${clinic.clinicId}/locations/${clinic.locationId}/services/${service.serviceId}/availability`);
    const slot = required ? availability.slots.find((item: {slotId:string})=>item.slotId===required) : availability.slots[0];
    if (!slot) throw new Error(`required generated slot is not Owner-visible: ${required}`);
    return { clinicId: clinic.clinicId, locationId: clinic.locationId, serviceId: service.serviceId, petId: pets[0].petId, slotId: slot.slotId, expectedSlotVersion: slot.expectedVersion };
  }, requiredSlotId);
}

async function enterOwnerDiscovery(page: Page) {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?intent=book');
  await page.getByRole('button',{name:'Начать запись'}).click();
  await page.getByLabel('Номер телефона').fill(`+7995${String(Date.now()).slice(-7)}`);
  await page.getByRole('button',{name:'Получить код'}).click();
  await page.getByLabel('Код из сообщения').fill(otpCode);
  await page.getByRole('button',{name:'Подтвердить'}).click();
  await page.getByRole('button',{name:'Продолжить запись'}).click();
  await page.getByRole('button',{name:'Добавить питомца'}).click();
  await page.getByLabel('Имя питомца').fill('Expo Web W4C');
  await page.getByText('Кошка',{exact:true}).click();
  await page.getByRole('button',{name:'Сохранить питомца'}).click();
  await page.getByText('Expo Web W4C',{exact:true}).click();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Найти специалиста'})).toBeVisible();
  await expect(page.getByText('Wave 3 E2E',{exact:true})).toBeVisible();
}

function enableWave4Fixture() {
  const ids=localPilotIds();
  psql(`
    UPDATE clinic_schema.clinic_locations SET latitude=55.7558,longitude=37.6173 WHERE id='${ids.locationId}'::uuid;
    INSERT INTO clinic_schema.doctor_services(clinic_location_id,staff_id,doctor_id,service_id,resource_id,slot_capacity,active,created_by)
    VALUES('${ids.locationId}'::uuid,'94000000-0000-4000-8000-000000000003'::uuid,'94000000-0000-4000-8000-000000000002'::uuid,'${ids.serviceId}'::uuid,NULL,1,true,'33333333-3333-4333-8333-333333333333'::uuid)
    ON CONFLICT (clinic_location_id,doctor_id,service_id,resource_id) DO UPDATE SET active=true,updated_at=clock_timestamp();
  `);
}

function setLocationCoordinates(latitude:number|null,longitude:number|null) {
  const ids=localPilotIds();
  const value=(number:number|null)=>number===null?'NULL':String(number);
  psql(`UPDATE clinic_schema.clinic_locations SET latitude=${value(latitude)},longitude=${value(longitude)} WHERE id='${ids.locationId}'::uuid;`);
}

function unpublishSlot(slotId:string) {
  if(!UUID.test(slotId))throw new Error('invalid slot ID');
  psql(`UPDATE clinic_schema.appointment_slots SET publication_state='UNPUBLISHED',published_at=NULL,unpublished_at=clock_timestamp(),blocked_at=NULL,source_stale_at=NULL,version=version+1,updated_at=clock_timestamp() WHERE id='${slotId}'::uuid;`);
}

function isPublishedWave4Slot(slotId:string) {
  if(!UUID.test(slotId))return false;
  return psql(`SELECT count(*) FROM clinic_schema.appointment_slots slot JOIN clinic_schema.doctor_services ds ON ds.id=slot.doctor_service_id JOIN clinic_schema.inventory_generation_runs run ON run.id=slot.generation_run_id JOIN clinic_schema.doctor_shifts shift ON shift.id=slot.doctor_shift_id WHERE slot.id='${slotId}'::uuid AND ds.doctor_id='94000000-0000-4000-8000-000000000002'::uuid AND slot.source='DOCTOR_SHIFT' AND slot.state='OPEN' AND slot.publication_state='PUBLISHED' AND run.status='PUBLISHED' AND shift.status='PUBLISHED';`).trim()==='1';
}

async function createPublishedDoctorShiftThroughPortal(page: Page): Promise<{slotIds:string[];startsAt:string[]}> {
  seedLocalWave3Fixtures();
  const ids = localPilotIds();
  const existing=localPublishedWave4Slots(ids.locationId);
  if(existing.slotIds.length>=3)return existing;
  const token = clinicJwt({clinicId:ids.clinicId,locationId:ids.locationId,serviceId:ids.serviceId,petId:'00000000-0000-4000-8000-000000000000',slotId:'00000000-0000-4000-8000-000000000000',expectedSlotVersion:1});
  await page.context().addCookies([{name:'vethelp_clinic_session',value:token,url:clinicPortal,httpOnly:true,sameSite:'Lax'}]);
  await page.goto(`${clinicPortal}/clinics/${ids.clinicId}/locations/${ids.locationId}/schedule`);
  const panel=page.getByRole('heading',{name:'Смены врачей и публикация'}).locator('xpath=ancestor::section[1]');
  await expect(panel.getByLabel('Начало')).toBeVisible();
  const start=localNextShiftStart();
  const end=new Date(start.getTime()+90*60_000);
  const local=(value:Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value).replace(' ','T');
  await panel.getByLabel('Начало').fill(local(start));
  await panel.getByLabel('Конец').fill(local(end));
  const shiftResponse=page.waitForResponse((response)=>response.url().includes('/schedule/doctor-shift-inventory')&&response.request().method()==='POST');
  await panel.getByRole('button',{name:'Создать смену'}).click();
  const shiftResult=await shiftResponse;
  expect(shiftResult.ok(),await shiftResult.text()).toBe(true);
  const shiftDate=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow'}).format(start);
  const shiftCard=panel.locator('article').filter({hasText:shiftDate});
  await expect(shiftCard).toBeVisible();
  await expect(shiftCard).toContainText('DRAFT');
  await shiftCard.getByRole('button',{name:'Сгенерировать'}).click();
  await expect(shiftCard.getByRole('button',{name:/Опубликовать/})).toBeVisible();
  await shiftCard.getByRole('button',{name:/Опубликовать/}).click();
  await expect(shiftCard).toContainText('PUBLISHED');
  await page.screenshot({path:'../../docs/testing/evidence/wave3-doctor-shift-real-stack/portal-published.png',fullPage:true});
  const generated=localGeneratedSlots(ids.locationId,start.toISOString(),end.toISOString());
  expect(generated.slotIds.length).toBeGreaterThanOrEqual(3);
  return generated;
}

function localPublishedWave4Slots(locationId:string): {slotIds:string[];startsAt:string[]} {
  const output=psql(`SELECT slot.id::text||'|'||slot.starts_at::text FROM clinic_schema.appointment_slots slot JOIN clinic_schema.doctor_services ds ON ds.id=slot.doctor_service_id JOIN clinic_schema.inventory_generation_runs run ON run.id=slot.generation_run_id JOIN clinic_schema.doctor_shifts shift ON shift.id=slot.doctor_shift_id WHERE slot.clinic_location_id='${locationId}'::uuid AND ds.doctor_id='94000000-0000-4000-8000-000000000002'::uuid AND ds.active AND slot.source='DOCTOR_SHIFT' AND slot.state='OPEN' AND slot.publication_state='PUBLISHED' AND run.status='PUBLISHED' AND shift.status='PUBLISHED' AND slot.starts_at>clock_timestamp() ORDER BY slot.starts_at,slot.id LIMIT 3;`);
  const rows=output.trim().split('\n').filter(Boolean).map(line=>line.split('|'));
  return{slotIds:rows.map(([id])=>id),startsAt:rows.map(([,startsAt])=>new Date(startsAt).toISOString())};
}

async function createHold(page: Page, context: Context): Promise<Hold> {
  return page.evaluate(async (input) => {
    const response = await fetch('/api/owner/v1/booking-holds', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), 'x-correlation-id': crypto.randomUUID() }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error(`hold creation failed: ${response.status}`);
    return response.json();
  }, context);
}

async function clinicDecision(request: APIRequestContext, token: string, hold: Hold, action: 'confirm' | 'decline') {
  const response = await request.post(`${backend}/v1/clinic/booking-holds/${hold.holdId}/${action}`, { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': randomUUID(), 'If-Match': `"${hold.aggregateVersion}"`, 'X-Correlation-ID': randomUUID() }, data: {} });
  expect(response.ok(), await response.text()).toBe(true);
}

function clinicJwt(context: Context) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: '33333333-3333-4333-8333-333333333333', roles: ['CLINIC_ADMIN'], clinicIds: [context.clinicId], locationIds: [context.locationId], iss: 'vethelp-local', aud: 'vethelp-api', iat: now, exp: now + 3600 });
  return `${header}.${payload}.${createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url')}`;
}

function expireLocalHold(holdId: string) {
  if (!UUID.test(holdId)) throw new Error('invalid hold ID');
  execFileSync('docker', ['compose', '-p', 'vethelp-alpha', '-f', '../../docker-compose.local.yml', 'exec', '-T', 'postgres', 'psql', '-U', 'vethelp', '-d', 'vethelp', '-c', `UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at = clock_timestamp() - interval '1 second' WHERE id = '${holdId}'::uuid`], { cwd: process.cwd(), stdio: 'pipe' });
}

function expireLocalPendingHolds() {
  execFileSync('docker', ['compose', '-p', 'vethelp-alpha', '-f', '../../docker-compose.local.yml', 'exec', '-T', 'postgres', 'psql', '-U', 'vethelp', '-d', 'vethelp', '-c', "UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at = clock_timestamp() - interval '1 second' WHERE state = 'MANUAL_CONFIRM_PENDING'"], { cwd: process.cwd(), stdio: 'pipe' });
}

function seedLocalWave3Fixtures() {
  const compose=['compose','-p','vethelp-alpha','-f','../../docker-compose.local.yml','exec','-T','backend'];
  execFileSync('docker',[...compose,'npm','run','seed'],{cwd:process.cwd(),stdio:'pipe'});
  execFileSync('docker',[...compose,'npm','run','seed:local:owner-marketplace'],{cwd:process.cwd(),stdio:'pipe'});
  const sql=`
    INSERT INTO identity_schema.users(id) VALUES('33333333-3333-4333-8333-333333333333') ON CONFLICT DO NOTHING;
    INSERT INTO catalog_schema.specialties(id,name,code) VALUES('94000000-0000-4000-8000-000000000001','Wave 3 E2E','WAVE3_E2E') ON CONFLICT(id) DO NOTHING;
    INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled)
      SELECT '94000000-0000-4000-8000-000000000002',l.id,'Wave 3 E2E Doctor','94000000-0000-4000-8000-000000000001',true,true
      FROM clinic_schema.clinic_locations l JOIN clinic_schema.clinics c ON c.id=l.clinic_id WHERE c.public_name='VetHelp Pilot' LIMIT 1
      ON CONFLICT(id) DO UPDATE SET active=true,public_booking_enabled=true;
    INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active,catalog_doctor_id)
      SELECT '94000000-0000-4000-8000-000000000003',l.id,'WAVE3_E2E','Wave 3 E2E Doctor','VETERINARIAN',true,'94000000-0000-4000-8000-000000000002'
      FROM clinic_schema.clinic_locations l JOIN clinic_schema.clinics c ON c.id=l.clinic_id WHERE c.public_name='VetHelp Pilot' LIMIT 1
      ON CONFLICT(id) DO UPDATE SET active=true,catalog_doctor_id=EXCLUDED.catalog_doctor_id;
    INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active,revoked_at)
      SELECT '33333333-3333-4333-8333-333333333333',l.id,'CLINIC_ADMIN',true,NULL
      FROM clinic_schema.clinic_locations l JOIN clinic_schema.clinics c ON c.id=l.clinic_id WHERE c.public_name='VetHelp Pilot' LIMIT 1
      ON CONFLICT(employee_id,clinic_location_id) DO UPDATE SET role='CLINIC_ADMIN',active=true,revoked_at=NULL;
  `;
  psql(sql);
}

function localPilotIds(): {clinicId:string;locationId:string;serviceId:string} {
  const output=psql(`SELECT c.id::text||'|'||l.id::text||'|'||s.id::text FROM clinic_schema.clinics c JOIN clinic_schema.clinic_locations l ON l.clinic_id=c.id JOIN clinic_schema.clinic_services s ON s.clinic_location_id=l.id WHERE c.public_name='VetHelp Pilot' AND s.code='GENERAL_VISIT' LIMIT 1;`);
  const [clinicId,locationId,serviceId]=output.trim().split('|');
  if(!UUID.test(clinicId)||!UUID.test(locationId)||!UUID.test(serviceId))throw new Error(`invalid local Pilot fixture: ${output}`);
  return {clinicId,locationId,serviceId};
}

function localGeneratedSlots(locationId:string,from:string,to:string): {slotIds:string[];startsAt:string[]} {
  const output=psql(`SELECT id::text||'|'||starts_at::text FROM clinic_schema.appointment_slots WHERE clinic_location_id='${locationId}'::uuid AND source='DOCTOR_SHIFT' AND publication_state='PUBLISHED' AND starts_at>='${from}'::timestamptz AND starts_at<'${to}'::timestamptz ORDER BY starts_at,id;`);
  const rows=output.trim().split('\n').filter(Boolean).map((line)=>line.split('|'));
  return {slotIds:rows.map(([id])=>id),startsAt:rows.map(([,startsAt])=>new Date(startsAt).toISOString())};
}

function localNextShiftStart(): Date {
  for(let days=3;days<=10;days+=1){
    const candidate=new Date(Date.now()+days*86_400_000);candidate.setUTCMinutes(0,0,0);candidate.setUTCHours(8);
    const end=new Date(candidate.getTime()+90*60_000);
    const occupied=psql(`SELECT count(*) FROM clinic_schema.doctor_shifts WHERE doctor_id='94000000-0000-4000-8000-000000000002'::uuid AND status<>'CANCELLED' AND starts_at<'${end.toISOString()}'::timestamptz AND ends_at>'${candidate.toISOString()}'::timestamptz;`).trim();
    if(occupied==='0')return candidate;
  }
  throw new Error('no free deterministic Wave 4 shift window');
}

function psql(sql:string): string {
  return execFileSync('docker',['compose','-p','vethelp-alpha','-f','../../docker-compose.local.yml','exec','-T','postgres','psql','-At','-U','vethelp','-d','vethelp','-c',sql],{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']});
}

async function resetLocalOtpLimit() {
  execFileSync('docker', ['compose', '-p', 'vethelp-alpha', '-f', '../../docker-compose.local.yml', 'exec', '-T', 'postgres', 'psql', '-U', 'vethelp', '-d', 'vethelp', '-c', 'TRUNCATE identity_schema.otp_rate_limit_attempts, identity_schema.otp_rate_limit_blocks'], { cwd: process.cwd(), stdio: 'pipe' });
}

async function projection<T>(value: T | { data: T }): Promise<T> {
  return value && typeof value === 'object' && 'data' in value ? value.data : value;
}
