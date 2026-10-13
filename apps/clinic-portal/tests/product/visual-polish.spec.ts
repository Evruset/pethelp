import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve('../../dev/product-batch01');
const pictures = resolve(root, 'screenshots', `batch04-${process.env.PRODUCT_VISUAL_PHASE ?? 'after'}`);
async function shot(page: Page, name: string) {
 await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({ path: resolve(pictures, `${name}.png`), fullPage: true });
}
test('BATCH04 visual Owner routes at 375 and 430, real reads and labelled error state', async ({ browser, request }) => {
 test.setTimeout(120_000); mkdirSync(pictures, { recursive: true });
 const state = JSON.parse(readFileSync(resolve(root, 'demo-state.local.json'), 'utf8'));
 if ((await request.get('http://127.0.0.1:3308/v1/auth/session', { headers: { Authorization: `Bearer ${state.ownerSession.sessionToken}` } })).status() !== 200) {
  const challenge = await (await request.post('http://127.0.0.1:3308/v1/auth/otp/request', { data: { phone: state.phone } })).json();
  const verified = await request.post('http://127.0.0.1:3308/v1/auth/otp/verify', { data: { challengeId: challenge.challengeId, code: '123456' } });
  expect(verified.ok()).toBe(true); state.ownerSession = await verified.json(); writeFileSync(resolve(root, 'demo-state.local.json'), JSON.stringify(state, null, 2), { mode: 0o600 });
 }
 for (const width of [375, 430]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Europe/Moscow' });
  await context.addInitScript(s => sessionStorage.setItem('vethelp.owner.session.v1', JSON.stringify({ opaqueCredential: s.sessionToken, cacheScope: 'batch04-visual', expiresAtEpochMs: Date.parse(s.expiresAt) })), state.ownerSession);
  const page = await context.newPage(); const snap = (name: string) => shot(page, `owner-${name}-${width}`);
  await page.goto('http://localhost:8088'); await expect(page.getByRole('button', { name: 'Карточка и дневник: Барсик', exact: true })).toBeVisible(); await snap('home');
  await page.getByRole('button', { name: 'Карточка и дневник: Барсик', exact: true }).click(); await expect(page.getByText('Загружаем дневник')).toHaveCount(0); await snap('pet');
  await page.getByRole('button', { name: 'Назад', exact: true }).click(); await page.getByRole('button', { name: 'Записать питомца', exact: true }).click(); await snap('pet-picker');
  await page.getByRole('radio').filter({ hasText: 'Барсик' }).click(); await page.getByRole('button', { name: 'Продолжить', exact: true }).click(); await expect(page.getByText('ДЕМО · Забота', { exact: true })).toBeVisible(); await snap('catalog');
  await page.getByRole('textbox', { name: 'Название клиники или адрес' }).fill('none-synthetic'); await expect(page.getByText('По этому запросу клиник не найдено')).toBeVisible(); await snap('catalog-empty'); await page.getByRole('button', { name: 'Сбросить поиск' }).click();
  await page.getByText('ДЕМО · Забота', { exact: true }).locator('..').getByRole('button', { name: 'Открыть клинику' }).click(); await expect(page.getByRole('radio').filter({ hasText: 'Приём терапевта' })).toBeVisible(); await snap('services');
  await page.getByRole('radio').filter({ hasText: 'Приём терапевта' }).click(); await page.getByRole('button', { name: 'Продолжить', exact: true }).click(); await expect(page.getByRole('radio').first()).toBeVisible(); await snap('availability');
  await page.getByRole('radio').first().click(); await page.getByRole('button', { name: 'Продолжить', exact: true }).click(); await expect(page.getByRole('button', { name: 'Отправить заявку', exact: true })).toBeVisible(); await snap('booking-review');
  await page.goto('http://localhost:8088'); await page.getByRole('button', { name: 'Все мои записи', exact: true }).click(); await expect(page.getByRole('button', { name: /^Открыть запись:/ }).first()).toBeVisible(); await snap('appointments');
  await page.getByRole('button', { name: /^Открыть запись:/ }).first().click(); await expect(page.getByText('Загружаем запись')).toHaveCount(0); await snap('appointment-detail');
  await page.getByRole('button', { name: 'Назад к записям' }).click(); await page.getByRole('button', { name: 'История', exact: true }).click(); await snap('history');
  await page.goto('http://localhost:8088'); await page.getByRole('button', { name: 'Доступ клиник к медицинским данным' }).click(); await expect(page.getByText('Загружаем записи')).toHaveCount(0); await snap('sharing');
  // Explicit transport simulation, not real server evidence.
  await page.route('**/v1/owner/clinic-catalog', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('http://localhost:8088'); await page.getByRole('button', { name: 'Записать питомца', exact: true }).click(); await page.getByRole('radio').filter({ hasText: 'Барсик' }).click(); await page.getByRole('button', { name: 'Продолжить', exact: true }).click(); await expect(page.getByText('Не удалось загрузить клиники')).toBeVisible(); await snap('catalog-error-simulated');
  await context.close();
 }
});
test('BATCH04 visual Clinic and veterinarian major routes at desktop tablet mobile', async ({ browser, baseURL }) => {
 test.setTimeout(120_000); mkdirSync(pictures, { recursive: true }); const state = JSON.parse(readFileSync(resolve(root, 'demo-state.local.json'), 'utf8'));
 const base = `${baseURL}/clinics/${state.clinics[0].clinicId}/locations/${state.clinics[0].locationId}`;
 for (const width of [1440, 768, 390]) {
  const context = await browser.newContext({ storageState: resolve(root, 'clinic-auth.local.json'), viewport: { width, height: 900 }, timezoneId: 'Europe/Moscow' }); const page = await context.newPage();
  for (const [route, name, heading] of [['', 'workspace', 'Рабочее пространство'], ['/queue', 'queue', 'Очередь подтверждения'], ['/schedule', 'schedule', 'Расписание локации'], ['/patients', 'patients', 'Пациенты'], ['/appointments', 'appointments', 'Записи']] as const) {
   await page.goto(base + route); await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible(); if (name === 'patients') await expect(page.getByText('Барсик', { exact: true }).first()).toBeVisible(); await shot(page, `clinic-${name}-${width}`);
   if (name === 'schedule') { const table=page.getByRole('table',{name:'Приёмы и свободные окна'}); await expect(table).toBeVisible(); await table.scrollIntoViewIfNeeded(); await shot(page,`clinic-schedule-rows-${width}`); }
   if (name === 'patients') { await page.getByText('Барсик', { exact: true }).first().click(); await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/); await expect(page.getByRole('heading', { level:1,name:'Барсик',exact:true })).toBeVisible(); await shot(page, `clinic-patient-detail-${width}`); }
  }
  await page.route('**/api/clinic/**/workspace-home', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })); await page.goto(base); await expect(page.getByText('Нет доступа к этой локации.')).toBeVisible(); await shot(page, `clinic-forbidden-simulated-${width}`); await context.close();
  const vc = await browser.newContext({ storageState: resolve(root, 'vet-auth.local.json'), viewport: { width, height: 900 }, timezoneId: 'Europe/Moscow' }); const vet = await vc.newPage();
  await vet.goto(`${base}/vet/visits`); await expect(vet.getByRole('heading', { name: 'Приёмы филиала' })).toBeVisible(); await shot(vet, `vet-list-${width}`);
  const detail = vet.getByRole('link', { name: /^Открыть приём / }).first(); await expect(detail).toBeVisible(); await detail.click(); await expect(vet.getByRole('navigation', { name: 'Разделы приёма' })).toBeVisible(); await shot(vet, `vet-detail-${width}`); await vc.close();
 }
});


test('BATCH04 labelled loading and server-error UI simulations', async ({browser,baseURL}) => {
 mkdirSync(pictures,{recursive:true});const state=JSON.parse(readFileSync(resolve(root,'demo-state.local.json'),'utf8'));
 const context=await browser.newContext({viewport:{width:375,height:900}});
 await context.addInitScript(s=>sessionStorage.setItem('vethelp.owner.session.v1',JSON.stringify({opaqueCredential:s.sessionToken,cacheScope:'batch04-state',expiresAtEpochMs:Date.parse(s.expiresAt)})),state.ownerSession);
 const page=await context.newPage();let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/v1/owner/clinic-catalog',async route=>{await blocked;await route.continue();});
 try {
  await page.goto('http://localhost:8088');await page.getByRole('button',{name:'Записать питомца',exact:true}).click();await page.getByRole('radio').filter({hasText:'Барсик'}).click();await page.getByRole('button',{name:'Продолжить',exact:true}).click();await expect(page.getByText('Загружаем клиники')).toBeVisible();await shot(page,'owner-loading-simulated-375');
 } finally {release();}
 await expect(page.getByText('ДЕМО · Забота',{exact:true})).toBeVisible();await context.close();
 const cc=await browser.newContext({storageState:resolve(root,'clinic-auth.local.json'),viewport:{width:390,height:900}});const clinic=await cc.newPage();await clinic.route('**/api/clinic/**/workspace-home',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));await clinic.goto(`${baseURL}/clinics/${state.clinics[0].clinicId}/locations/${state.clinics[0].locationId}`);await expect(clinic.getByText('Рабочее пространство временно недоступно.')).toBeVisible();await shot(clinic,'clinic-error-simulated-390');await cc.close();
});
