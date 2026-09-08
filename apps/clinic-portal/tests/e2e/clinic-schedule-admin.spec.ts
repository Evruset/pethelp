import { expect, test } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { SignJWT } from 'jose';
import AxeBuilder from '@axe-core/playwright';
import { captureEvidence, uiStep } from './support/evidence';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const serviceId = '66666666-6666-4666-8666-666666666666';
const staffId = '77777777-7777-4777-8777-777777777777';
const resourceId = '88888888-8888-4888-8888-888888888888';
const bookedSlotId = '55555555-5555-4555-8555-555555555555';
const freeSlotId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const periodId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const newServiceId = '99999999-9999-4999-8999-999999999999';
const newStaffId = '10101010-1010-4010-8010-101010101010';
const newResourceId = '20202020-2020-4020-8020-202020202020';
const catalogDoctorId = '30303030-3030-4030-8030-303030303030';
const doctorShiftId = '40404040-4040-4040-8040-404040404040';
const generationRunId = '50505050-5050-4050-8050-505050505050';
const mockBackendPort = 3212;
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestRecord = {
  method: string;
  path: string;
  body: unknown;
  idempotencyKey?: string;
  ifMatch?: string;
  correlationId?: string;
  authorization?: string;
};

type BackendMode =
  | 'normal'
  | 'service-has-bookings'
  | 'staff-has-bookings'
  | 'resource-has-bookings'
  | 'capacity-stale'
  | 'blackout-stale'
  | 'period-stale'
  | 'period-has-bookings'
  | 'import-business-error'
  | 'doctor-unavailable'
  | 'doctor-stale';

type ServiceForm = {
  code: string;
  displayName: string;
  durationMinutes: number;
  priceAmount: string;
  currency: string;
  active: boolean;
};

type StaffForm = {
  code: string;
  displayName: string;
  role: string;
  active: boolean;
};

type ResourceForm = {
  code: string;
  displayName: string;
  resourceType: string;
  active: boolean;
};

let server: Server;
let schedule: any = makeSchedule();
let requests: RequestRecord[] = [];
let scheduleReads = 0;
let backendMode: BackendMode = 'normal';
let doctorInventory: any = makeDoctorInventory(false);

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  server = createServer(handleBackendRequest);
  await new Promise<void>((resolve) => server.listen(mockBackendPort, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test.beforeEach(() => {
  schedule = makeSchedule();
  requests = [];
  scheduleReads = 0;
  backendMode = 'normal';
  doctorInventory = makeDoctorInventory(false);
});

test('creates, previews and publishes DoctorShift inventory accessibly across the responsive matrix', async ({ page, context, baseURL },testInfo) => {
  doctorInventory = makeDoctorInventory(true);
  await addAdminSession(context, baseURL);
  await page.goto(route());
  const panel = section(page, 'Смены врачей и публикация');
  await panel.getByRole('button', { name: 'Создать смену' }).click();
  await expect(panel.getByRole('button', { name: 'Сгенерировать' })).toBeVisible();
  await panel.getByRole('button', { name: 'Сгенерировать' }).click();
  await expect(panel).toContainText('Предпросмотр · 2');
  await expect(panel).toContainText('Удерживается');
  await expect(panel.getByRole('button', { name: /Опубликовать 2/ })).toBeVisible();
  await panel.getByRole('button', { name: /Опубликовать 2/ }).click();
  await expect(panel).toContainText('PUBLISHED');
  const accessibility=await new AxeBuilder({page}).include('[aria-labelledby="doctor-shifts-heading"]').analyze();
  expect(accessibility.violations.filter((item)=>['serious','critical'].includes(item.impact??''))).toEqual([]);
  for(const viewport of [{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1024,height:768},{width:1280,height:800},{width:1440,height:900}]){
    await page.setViewportSize(viewport);await expect(panel).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    await captureEvidence(page,testInfo,`doctor-shift-published-${viewport.width}x${viewport.height}`);
  }
  expectRequest('POST', `${prefix()}/doctor-services`, expect.objectContaining({ doctorId: catalogDoctorId, serviceId }), 'idempotent');
  expectRequest('POST', `${prefix()}/doctor-shifts`, expect.objectContaining({ doctorId: catalogDoctorId }), 'idempotent');
  expectRequest('POST', `${prefix()}/doctor-shifts/${doctorShiftId}/generate`, expect.anything(), 'versioned');
  expectRequest('POST', `${prefix()}/inventory-runs/${generationRunId}/publish`, expect.anything(), 'idempotent');
});

test('renders the DoctorShift publication workspace fail-closed when no bridged doctor exists', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await page.goto(route());
  const panel = section(page, 'Смены врачей и публикация');
  await expect(panel).toContainText('Pilot capacity: 1');
  await expect(panel).toContainText('Нет активного врача со связью staff ↔ каталог.');
  await expect(panel.getByRole('button', { name: 'Создать смену' })).toHaveCount(0);
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await expect(panel).toBeVisible();
    await captureEvidence(page, testInfo, `doctor-shift-${viewport.width}`);
  }
  await panel.getByRole('button',{name:'Связать врача'}).click();
  await expect(panel.getByRole('button',{name:'Создать смену'})).toBeVisible();
  await panel.getByRole('button',{name:'Создать смену'}).click();
  await expect(panel).toContainText('Изменения сохранены в авторитетном расписании.');
  expectRequest('POST',`${prefix()}/doctor-mappings`,expect.objectContaining({staffId,doctorId:catalogDoctorId}),'idempotent');
  expectRequest('POST', `${prefix()}/doctor-services`, expect.objectContaining({ doctorId: catalogDoctorId, serviceId }), 'idempotent');
  expectRequest('POST', `${prefix()}/doctor-shifts`, expect.objectContaining({ doctorId: catalogDoctorId }), 'idempotent');
});

test('keeps the manual schedule usable when the DoctorShift projection is unavailable',async({page,context,baseURL})=>{
  backendMode='doctor-unavailable';await addAdminSession(context,baseURL);await page.goto(route());
  await expect(page.getByRole('heading',{name:'Услуги локации'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Смены врачей временно недоступны'})).toBeVisible();
  await expect(page.getByText('Ручное расписание продолжает работать.')).toBeVisible();
});

test('captures the final DoctorShift visual state and viewport matrix',async({page,context,baseURL,browser,browserName})=>{
  const viewports=[{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}];
  let overflowChecks=0;let axeScans=0;let screenshots=0;const semanticStates:string[]=[];
  const capture=async(name:string,roles:string[]= ['CLINIC_ADMIN'],action?:()=>Promise<void>)=>{
    await addClinicSession(context,baseURL,roles);
    await page.goto(route());
    if(action)await action();
    const target=backendMode==='doctor-unavailable'?page.getByRole('heading',{name:'Смены врачей временно недоступны'}).locator('xpath=ancestor::section[1]'):section(page,'Смены врачей и публикация');
    await expect(target).toBeVisible();
    const semantic:Record<string,string>={'vis-01-empty':'Связать врача','vis-02-doctor-selected':'Создать смену','vis-03-draft-shift':'DRAFT','vis-04-shift-editor':'Сохранить смену','vis-05-generated-preview':'Предпросмотр · 2','vis-06-published-inventory':'PUBLISHED','vis-07-blocked-inventory':'BLOCKED','vis-08-held-slot':'Удерживается','vis-09-booked-slot':'Записан','vis-10-stale-conflict':'Смена уже изменена другим пользователем','vis-11-technical-degraded':'Ручное расписание продолжает работать','vis-12-read-only-role':'Режим просмотра'};
    await expect(target).toContainText(semantic[name]);semanticStates.push(name);
    if(['vis-08-held-slot','vis-09-booked-slot'].includes(name)){await expect(target).toContainText('Смена защищена удержанием или записью');await expect(target.getByRole('button',{name:'Снять публикацию'})).toBeDisabled();await expect(target.getByRole('button',{name:'Заблокировать'})).toBeDisabled();await expect(target.getByRole('button',{name:'Отменить смену'})).toBeDisabled();}
    const accessibility=await new AxeBuilder({page}).include(backendMode==='doctor-unavailable'?'#doctor-shift-degraded':'[aria-labelledby="doctor-shifts-heading"]').analyze();
    expect(accessibility.violations.filter((item)=>['serious','critical'].includes(item.impact??'')),name).toEqual([]);
    axeScans+=1;
    for(const viewport of viewports){
      await page.setViewportSize(viewport);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`${name} ${viewport.width}`).toBe(true);
      overflowChecks+=1;
      if(['vis-03-draft-shift','vis-05-generated-preview','vis-06-published-inventory','vis-07-blocked-inventory','vis-08-held-slot','vis-09-booked-slot','vis-12-read-only-role'].includes(name))await target.locator('article').first().scrollIntoViewIfNeeded();
      await page.screenshot({path:`../../docs/testing/evidence/wave3-doctor-shift-inventory/${name}-${viewport.width}x${viewport.height}.png`,animations:'disabled'});
      screenshots+=1;
    }
  };

  doctorInventory=makeDoctorInventory(false);await capture('vis-01-empty');
  doctorInventory=makeDoctorInventory(true);await capture('vis-02-doctor-selected');
  doctorInventory=makeVisualDoctorInventory('DRAFT');await capture('vis-03-draft-shift');
  doctorInventory=makeVisualDoctorInventory('DRAFT');await capture('vis-04-shift-editor',['CLINIC_ADMIN'],async()=>{await section(page,'Смены врачей и публикация').getByRole('button',{name:'Изменить'}).click();await expect(section(page,'Смены врачей и публикация').getByRole('button',{name:'Сохранить смену'})).toBeVisible();});
  doctorInventory=makeVisualDoctorInventory('GENERATED');await capture('vis-05-generated-preview');
  doctorInventory=makeVisualDoctorInventory('PUBLISHED');await capture('vis-06-published-inventory');
  doctorInventory=makeVisualDoctorInventory('BLOCKED');await capture('vis-07-blocked-inventory');
  doctorInventory=makeVisualDoctorInventory('HELD');await capture('vis-08-held-slot');
  doctorInventory=makeVisualDoctorInventory('BOOKED');await capture('vis-09-booked-slot');
  doctorInventory=makeVisualDoctorInventory('DRAFT');backendMode='doctor-stale';await capture('vis-10-stale-conflict',['CLINIC_ADMIN'],async()=>{await section(page,'Смены врачей и публикация').getByRole('button',{name:'Сгенерировать'}).click();await expect(section(page,'Смены врачей и публикация').getByRole('status')).toContainText('Смена уже изменена другим пользователем');});
  doctorInventory=makeDoctorInventory(true);backendMode='doctor-unavailable';await capture('vis-11-technical-degraded');
  doctorInventory=makeVisualDoctorInventory('PUBLISHED');backendMode='normal';await capture('vis-12-read-only-role',['CLINIC_RECEPTIONIST'],async()=>{const panel=section(page,'Смены врачей и публикация');await expect(panel).toContainText('Режим просмотра');await expect(panel.getByRole('button')).toHaveCount(0);});
  const captureScript=await readFile('tests/e2e/clinic-schedule-admin.spec.ts');
  await writeFile('../../docs/testing/evidence/wave3-doctor-shift-inventory/capture-run.json',`${JSON.stringify({schemaVersion:1,test:'captures the final DoctorShift visual state and viewport matrix',status:'PASS',completedAt:new Date().toISOString(),browser:{name:browserName,version:browser.version()},captureScriptSha256:createHash('sha256').update(captureScript).digest('hex'),semanticStates,checks:{overflowChecks,axeScans,screenshots}},null,2)}\n`);
});

test('keeps receptionist and veterinarian DoctorShift views read-only and scopes preview to the published run',async({page,context,baseURL})=>{
  for(const role of ['CLINIC_RECEPTIONIST','CLINIC_VETERINARIAN']){
    doctorInventory=makeVisualDoctorInventory('PUBLISHED');backendMode='normal';
    await addClinicSession(context,baseURL,[role]);await page.goto(route());
    const panel=section(page,'Смены врачей и публикация');
    await expect(panel).toContainText('Режим просмотра');
    await expect(panel.getByRole('button')).toHaveCount(0);
    await context.clearCookies();
  }
  doctorInventory=makeVisualDoctorInventory('PUBLISHED');
  doctorInventory.runs.push({id:'70707070-7070-4070-8070-707070707070',doctor_shift_id:doctorShiftId,shift_version:2,generation_version:2,status:'GENERATED',slot_count:1,completed_at:'2026-08-28T09:00:00.000Z'});
  doctorInventory.generatedSlots.push({...doctorInventory.generatedSlots[0],id:'80808080-8080-4080-8080-808080808080',generation_run_id:'70707070-7070-4070-8070-707070707070',service_name:'Устаревший предпросмотр'});
  await addAdminSession(context,baseURL);await page.goto(route());
  const panel=section(page,'Смены врачей и публикация');
  await expect(panel).toContainText('Опубликован');
  await expect(panel).not.toContainText('Устаревший предпросмотр');
});

test.afterEach(async ({ page }, testInfo) => {
  await captureEvidence(page, testInfo, testInfo.status === 'passed' ? 'final-state' : 'failure-state');
});

test('creates a local service through the schedule UI', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание администратора', () => page.goto(route()));
  const serviceSection = section(page, 'Услуги локации');
  await uiStep(page, testInfo, 'Заполнить новую услугу', async () => {
    await serviceSection.getByPlaceholder('code').fill('VACCINE');
    await serviceSection.getByPlaceholder('Название').fill('Вакцинация');
    await serviceSection.getByLabel('Длительность услуги').fill('20');
    await serviceSection.getByPlaceholder('1000.00').fill('2200.00');
    await serviceSection.getByPlaceholder('RUB').fill('RUB');
  });
  await uiStep(page, testInfo, 'Создать услугу и дождаться authoritative refresh', async () => {
    await serviceSection.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByRole('status')).toContainText('Услуга создана и зафиксирована в audit.');
    await expect(serviceSection.locator('tbody tr').last().locator('input').nth(1)).toHaveValue('Вакцинация');
  });

  expectRequest('POST', `${prefix()}/services`, expect.objectContaining({ code: 'VACCINE', displayName: 'Вакцинация', durationMinutes: 20 }), 'idempotent');
  expect(scheduleReads).toBeGreaterThanOrEqual(2);
});

test('shows a business error for duplicate service code', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание', () => page.goto(route()));
  const serviceSection = section(page, 'Услуги локации');
  await uiStep(page, testInfo, 'Отправить существующий код услуги', async () => {
    await serviceSection.getByPlaceholder('code').fill('EXISTS');
    await serviceSection.getByPlaceholder('Название').fill('Повтор');
    await serviceSection.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByRole('status')).toContainText('Код услуги уже используется в этой локации.');
  });

  expectRequest('POST', `${prefix()}/services`, expect.objectContaining({ code: 'EXISTS' }), 'idempotent');
});

test('updates a service and blocks deactivation with dependent slots', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть услуги локации', () => page.goto(route()));
  const serviceSection = section(page, 'Услуги локации');
  await uiStep(page, testInfo, 'Переименовать услугу', async () => {
    const row = serviceSection.locator('tbody tr').first();
    await row.locator('input').nth(1).fill('Повторный приём');
    await row.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Услуга обновлена и зафиксирована в audit.');
    await expect(serviceSection.locator('tbody tr').first().locator('input').nth(1)).toHaveValue('Повторный приём');
  });

  backendMode = 'service-has-bookings';
  await uiStep(page, testInfo, 'Получить бизнес-ошибку при выключении услуги с зависимыми слотами', async () => {
    const row = serviceSection.locator('tbody tr').first();
    await row.getByRole('checkbox').setChecked(false);
    await row.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Нельзя выключить услугу с будущими удержаниями или записями.');
    await expect(serviceSection.locator('tbody tr').first().getByRole('checkbox')).toBeChecked();
  });

  expectRequest('POST', `${prefix()}/services/${serviceId}`, expect.objectContaining({ displayName: 'Повторный приём' }), 'versioned');
  expectRequest('POST', `${prefix()}/services/${serviceId}`, expect.objectContaining({ active: false }), 'versioned');
});

test('creates and updates staff, then blocks deactivation with dependent slots', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть специалистов', () => page.goto(route()));
  const staffSection = section(page, 'Специалисты');

  await uiStep(page, testInfo, 'Создать специалиста', async () => {
    await staffSection.getByPlaceholder('code').fill('VET-2');
    await staffSection.getByPlaceholder('ФИО').fill('Доктор Вторая');
    await staffSection.getByPlaceholder('VETERINARIAN').fill('VETERINARIAN');
    await staffSection.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByRole('status')).toContainText('Специалист создан и зафиксирован в audit.');
    await expect(staffSection.locator('tbody tr').last().locator('input').nth(1)).toHaveValue('Доктор Вторая');
  });

  await uiStep(page, testInfo, 'Проверить специалиста в форме ручного окна', async () => {
    await expect(section(page, 'Добавить ручное окно').getByLabel('Специалист')).toContainText('Доктор Вторая');
  });

  await uiStep(page, testInfo, 'Обновить специалиста', async () => {
    const row = staffSection.locator('tbody tr').last();
    await row.locator('input').nth(1).fill('Доктор Вторая Обновлена');
    await row.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Специалист обновлен и зафиксирован в audit.');
    await expect(staffSection.locator('tbody tr').last().locator('input').nth(1)).toHaveValue('Доктор Вторая Обновлена');
  });

  backendMode = 'staff-has-bookings';
  await uiStep(page, testInfo, 'Блокировать деактивацию специалиста с зависимыми слотами', async () => {
    const row = staffSection.locator('tbody tr').last();
    await row.getByRole('checkbox').setChecked(false);
    await row.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Нельзя выключить специалиста с будущими удержаниями или записями.');
    await expect(staffSection.locator('tbody tr').last().getByRole('checkbox')).toBeChecked();
  });

  expectRequest('POST', `${prefix()}/staff`, expect.objectContaining({ code: 'VET-2', displayName: 'Доктор Вторая' }), 'idempotent');
  expectRequest('POST', `${prefix()}/staff/${newStaffId}`, expect.objectContaining({ displayName: 'Доктор Вторая Обновлена' }), 'versioned');
  expectRequest('POST', `${prefix()}/staff/${newStaffId}`, expect.objectContaining({ active: false }), 'versioned');
});

test('creates and updates resources, then blocks deactivation with dependent slots', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть ресурсы', () => page.goto(route()));
  const resourceSection = section(page, 'Кабинеты и ресурсы');

  await uiStep(page, testInfo, 'Создать ресурс', async () => {
    await resourceSection.getByPlaceholder('code').fill('XRAY-1');
    await resourceSection.getByPlaceholder('Название').fill('Рентген');
    await resourceSection.getByPlaceholder('CABINET').fill('EQUIPMENT');
    await resourceSection.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByRole('status')).toContainText('Ресурс создан и зафиксирован в audit.');
    await expect(resourceSection.locator('tbody tr').last().locator('input').nth(1)).toHaveValue('Рентген');
  });

  await uiStep(page, testInfo, 'Проверить ресурс в форме ручного окна', async () => {
    await expect(section(page, 'Добавить ручное окно').getByLabel('Ресурс')).toContainText('Рентген');
  });

  await uiStep(page, testInfo, 'Обновить ресурс', async () => {
    const row = resourceSection.locator('tbody tr').last();
    await row.locator('input').nth(1).fill('Рентген кабинет');
    await row.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Ресурс обновлен и зафиксирован в audit.');
    await expect(resourceSection.locator('tbody tr').last().locator('input').nth(1)).toHaveValue('Рентген кабинет');
  });

  backendMode = 'resource-has-bookings';
  await uiStep(page, testInfo, 'Блокировать деактивацию ресурса с зависимыми слотами', async () => {
    const row = resourceSection.locator('tbody tr').last();
    await row.getByRole('checkbox').setChecked(false);
    await row.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Нельзя выключить ресурс с будущими удержаниями или записями.');
    await expect(resourceSection.locator('tbody tr').last().getByRole('checkbox')).toBeChecked();
  });

  expectRequest('POST', `${prefix()}/resources`, expect.objectContaining({ code: 'XRAY-1', resourceType: 'EQUIPMENT' }), 'idempotent');
  expectRequest('POST', `${prefix()}/resources/${newResourceId}`, expect.objectContaining({ displayName: 'Рентген кабинет' }), 'versioned');
  expectRequest('POST', `${prefix()}/resources/${newResourceId}`, expect.objectContaining({ active: false }), 'versioned');
});

test('creates a manual slot with selected staff and resource', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание', () => page.goto(route()));
  const form = section(page, 'Добавить ручное окно');
  await uiStep(page, testInfo, 'Задать сотрудника, ресурс и время ручного окна', async () => {
    await form.getByLabel('Специалист').selectOption(staffId);
    await form.getByLabel('Ресурс').selectOption(resourceId);
    await form.getByLabel('Начало').fill('2026-06-30T10:00');
    await form.getByLabel('Конец').fill('2026-06-30T10:30');
    await form.getByLabel('Capacity').fill('2');
  });
  await uiStep(page, testInfo, 'Создать ручное окно и проверить readback', async () => {
    await form.getByRole('button', { name: 'Создать окно' }).click();
    await expect(page.getByRole('status')).toContainText('Ручное окно создано и зафиксировано в audit.');
    const row = page.getByRole('row').filter({ hasText: '2 записей · 0 holds · cap 2' });
    await expect(row).toContainText('Доктор Айболит');
    await expect(row).toContainText('Кабинет 1');
  });

  expectRequest('POST', `${prefix()}/manual-slots`, expect.objectContaining({ serviceId, staffId, resourceId, capacity: 2 }), 'idempotent');
});

test('validates invalid JSON before schedule import request', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание', () => page.goto(route()));
  const importer = section(page, 'Импорт расписания');
  await uiStep(page, testInfo, 'Ввести повреждённый JSON', async () => {
    await importer.locator('textarea').fill('{not-json');
    await importer.getByRole('button', { name: 'Импортировать' }).click();
    await expect(page.getByRole('status')).toContainText('Не удалось прочитать JSON импорта.');
  });

  expect(requests.some((request) => request.path.endsWith('/schedule/import'))).toBeFalsy();
});

test('imports valid JSON and avoids partial UI changes on business validation error', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть импорт расписания', () => page.goto(route()));
  const importer = section(page, 'Импорт расписания');

  await uiStep(page, testInfo, 'Импортировать корректный JSON', async () => {
    await importer.locator('textarea').fill(JSON.stringify({
      slots: [{ serviceId, startsAt: '2026-07-01T10:00:00.000Z', endsAt: '2026-07-01T10:30:00.000Z', capacity: 3 }],
    }, null, 2));
    await importer.getByRole('button', { name: 'Импортировать' }).click();
    await expect(page.getByRole('status')).toContainText('Импортировано окон: 1.');
    await expect(page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 3' })).toBeVisible();
  });

  backendMode = 'import-business-error';
  await uiStep(page, testInfo, 'Получить server-side validation без частичного readback', async () => {
    await importer.locator('textarea').fill(JSON.stringify({
      slots: [{ serviceId, startsAt: '2026-07-01T10:15:00.000Z', endsAt: '2026-07-01T09:30:00.000Z', capacity: 1 }],
    }, null, 2));
    await importer.getByRole('button', { name: 'Импортировать' }).click();
    await expect(page.getByRole('status')).toContainText('Импорт не выполнен: SLOT_TIME_RANGE_INVALID.');
    await expect(page.getByRole('row').filter({ hasText: '10:15' })).toHaveCount(0);
  });

  expectRequest('POST', `${prefix()}/import`, expect.objectContaining({ slots: expect.any(Array) }), 'idempotent');
});

test('saves working-hours metadata through BFF', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание', () => page.goto(route()));
  const hours = section(page, 'Рабочие часы');
  await uiStep(page, testInfo, 'Изменить интервал рабочего дня и сохранить', async () => {
    const mondayCard = hours.getByText('Пн').locator('xpath=ancestor::div[1]');
    await mondayCard.locator('input[type="time"]').nth(0).fill('08:00');
    await mondayCard.locator('input[type="time"]').nth(1).fill('20:00');
    await hours.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Рабочие часы обновлены и зафиксированы в audit.');
  });

  expectRequest('POST', `${prefix()}/working-hours`, expect.objectContaining({
    days: expect.arrayContaining([expect.objectContaining({ weekday: 1, opensAt: '08:00', closesAt: '20:00' })]),
  }), 'idempotent');
});

test('updates free slot capacity, handles stale conflict and blocks booked slot actions', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание со свободным и занятым окном', () => page.goto(route()));

  await uiStep(page, testInfo, 'Изменить capacity свободного окна', async () => {
    await page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 1' }).getByRole('button', { name: 'Capacity' }).click();
    const dialog = page.getByRole('dialog', { name: 'Изменить capacity' });
    await dialog.getByLabel('Новая capacity').fill('4');
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Capacity обновлена. Расписание обновлено.' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 4' })).toBeVisible();
  });

  backendMode = 'capacity-stale';
  await uiStep(page, testInfo, 'Получить stale conflict и authoritative refresh', async () => {
    await page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 4' }).getByRole('button', { name: 'Capacity' }).click();
    const dialog = page.getByRole('dialog', { name: 'Изменить capacity' });
    await dialog.getByLabel('Новая capacity').fill('5');
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Окно уже изменилось. Расписание обновлено.' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 4' })).toBeVisible();
  });

  await uiStep(page, testInfo, 'Проверить запрет capacity/blackout у занятого окна', async () => {
    const row = page.getByRole('row').filter({ hasText: '1 записей · 0 holds · cap 1' });
    await expect(row.getByRole('button', { name: 'Capacity' })).toBeDisabled();
    await expect(row.getByRole('button', { name: 'Blackout' })).toBeDisabled();
  });

  expectRequest('POST', `${prefix()}/slots/${freeSlotId}/capacity`, expect.objectContaining({ capacity: 4 }), 'versioned');
});

test('creates blackout for a free slot and refreshes after stale conflict', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание со свободным окном', () => page.goto(route()));

  await uiStep(page, testInfo, 'Закрыть свободное окно через blackout', async () => {
    await page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 1' }).getByRole('button', { name: 'Blackout' }).click();
    await page.getByRole('dialog', { name: 'Закрыть окно' }).getByRole('button', { name: 'Закрыть окно' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Окно закрыто. Расписание обновлено.' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 1' })).toContainText('Закрыт');
  });

  schedule.slots = schedule.slots.map((slot: any) => slot.id === freeSlotId ? { ...slot, state: 'OPEN', version: 2 } : slot);
  backendMode = 'blackout-stale';
  await uiStep(page, testInfo, 'Обновить и получить stale conflict blackout', async () => {
    await page.getByRole('button', { name: 'Обновить' }).click();
    await page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 1' }).getByRole('button', { name: 'Blackout' }).click();
    await page.getByRole('dialog', { name: 'Закрыть окно' }).getByRole('button', { name: 'Закрыть окно' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Окно уже изменилось. Расписание обновлено.' })).toBeVisible();
  });

  expectRequest('POST', `${prefix()}/slots/${freeSlotId}/blackout`, expect.objectContaining({ reason: expect.stringContaining('Закрыто сотрудником') }), 'versioned');
});

test('creates and cancels schedule period with version fencing', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть периоды расписания', () => page.goto(route()));
  const periods = section(page, 'Периоды расписания');

  await uiStep(page, testInfo, 'Создать blackout period для специалиста и ресурса', async () => {
    await periods.locator('select').nth(0).selectOption('BLACKOUT');
    await periods.locator('input[type="datetime-local"]').nth(0).fill('2026-07-02T10:00');
    await periods.locator('input[type="datetime-local"]').nth(1).fill('2026-07-02T12:00');
    await periods.locator('select').nth(1).selectOption(staffId);
    await periods.locator('select').nth(2).selectOption(resourceId);
    await periods.getByPlaceholder('Причина').fill('Санитарная обработка');
    await periods.getByRole('button', { name: 'Создать' }).click();
    await expect(page.getByRole('status')).toContainText('Период расписания создан и зафиксирован в audit.');
    await expect(periods.getByRole('row').filter({ hasText: 'Санитарная обработка' })).toContainText('Активен · v1');
  });

  await uiStep(page, testInfo, 'Отменить period через If-Match', async () => {
    await periods.getByRole('row').filter({ hasText: 'Санитарная обработка' }).getByRole('button', { name: 'Отменить' }).click();
    await expect(page.getByRole('status')).toContainText('Период отменен. Закрытые ранее слоты не переоткрываются автоматически.');
    await expect(periods.getByRole('row').filter({ hasText: 'Санитарная обработка' })).toContainText('Отменен · v2');
  });

  schedule.periods = schedule.periods.map((period: any) => ({ ...period, active: true, version: 3 }));
  backendMode = 'period-stale';
  await uiStep(page, testInfo, 'Получить stale conflict при повторной отмене period', async () => {
    await page.getByRole('button', { name: 'Обновить' }).click();
    await periods.getByRole('row').filter({ hasText: 'Санитарная обработка' }).getByRole('button', { name: 'Отменить' }).click();
    await expect(page.getByRole('status')).toContainText('Период уже изменился. Данные обновлены.');
  });

  expectRequest('POST', `${prefix()}/periods`, expect.objectContaining({ periodType: 'BLACKOUT', staffId, resourceId, reason: 'Санитарная обработка' }), 'idempotent');
  expectRequest('POST', `${prefix()}/periods/${periodId}/cancel`, {}, 'versioned');
});

test('shows business error when period overlaps active bookings', async ({ page, context, baseURL }, testInfo) => {
  backendMode = 'period-has-bookings';
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть периоды расписания', () => page.goto(route()));
  const periods = section(page, 'Периоды расписания');

  await uiStep(page, testInfo, 'Создать конфликтующий period', async () => {
    await periods.locator('input[type="datetime-local"]').nth(0).fill('2026-07-02T10:00');
    await periods.locator('input[type="datetime-local"]').nth(1).fill('2026-07-02T12:00');
    await periods.getByPlaceholder('Причина').fill('Конфликт');
    await periods.getByRole('button', { name: 'Создать' }).click();
    await expect(page.getByRole('status')).toContainText('Период пересекается с активными удержаниями или записями.');
    await expect(periods.getByRole('row').filter({ hasText: 'Конфликт' })).toHaveCount(0);
  });
});

function route(): string {
  return `/clinics/${clinicId}/locations/${locationId}/schedule`;
}

function prefix(): string {
  return `/v1/clinic/${clinicId}/locations/${locationId}/schedule`;
}

function section(page: Page, heading: string): Locator {
  return page.getByRole('heading', { name: heading }).locator('xpath=ancestor::section[1]');
}

function expectRequest(method: string, path: string, body: unknown, headers: 'idempotent' | 'versioned'): void {
  const found = requests.find((request) => request.method === method && request.path === path && objectMatches(request.body, body));
  expect(found, `${method} ${path}`).toBeTruthy();
  if (!found) return;
  expect(found.authorization).toMatch(/^Bearer /);
  expect(found.idempotencyKey).toMatch(uuidPattern);
  expect(found.correlationId).toMatch(uuidPattern);
  if (headers === 'versioned') expect(found.ifMatch).toMatch(/^[1-9][0-9]*$/);
}

function objectMatches(actual: unknown, expected: unknown): boolean {
  try {
    expect(actual).toEqual(expected);
    return true;
  } catch {
    return false;
  }
}

async function addAdminSession(context: BrowserContext, baseURL: string | undefined): Promise<void> {
  return addClinicSession(context,baseURL,['CLINIC_ADMIN']);
}

async function addClinicSession(context: BrowserContext, baseURL: string | undefined, roles: string[]): Promise<void> {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({
    roles,
    clinicIds: [clinicId],
    locationIds: [locationId],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('clinic-schedule-admin-e2e')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(jwtSecret));

  await context.addCookies([{
    name: 'vethelp_clinic_session',
    value: token,
    url: baseURL,
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}

function handleBackendRequest(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${mockBackendPort}`}`);
  const path = url.pathname;

  if (request.method === 'GET' && path === '/v1/auth/session') {
    sendJson(response, 200, {
      subjectId: 'clinic-schedule-admin-e2e',
      roles: ['CLINIC_ADMIN'],
      effectiveCapabilities: ['schedule.read', 'schedule.manage'],
      clinicScopes: [{ clinicId, locationId }],
    });
    return;
  }

  if (request.method === 'GET' && path === `${prefix()}/slots`) {
    scheduleReads += 1;
    sendJson(response, 200, schedule);
    return;
  }

  if (request.method === 'GET' && path === `${prefix()}/doctor-shifts`) {
    if(backendMode==='doctor-unavailable'){sendJson(response,503,{code:'DOCTOR_SHIFT_INVENTORY_DISABLED'});return;}
    sendJson(response, 200, doctorInventory);
    return;
  }

  if (request.method === 'POST' && path.startsWith(prefix())) {
    void collectBody(request).then((body) => {
      recordRequest(request, path, body);

      if (path === `${prefix()}/services`) return handleCreateService(response, body);
      if (path === `${prefix()}/services/${serviceId}`) return handleSaveService(response, body);
      if (path === `${prefix()}/staff`) return handleCreateStaff(response, body);
      if (path === `${prefix()}/staff/${newStaffId}`) return handleSaveStaff(response, body);
      if (path === `${prefix()}/resources`) return handleCreateResource(response, body);
      if (path === `${prefix()}/resources/${newResourceId}`) return handleSaveResource(response, body);
      if (path === `${prefix()}/manual-slots`) return handleManualSlot(response, body);
      if (path === `${prefix()}/working-hours`) return handleWorkingHours(response, body);
      if (path === `${prefix()}/import`) return handleImport(response, body);
      if (path === `${prefix()}/slots/${freeSlotId}/capacity`) return handleCapacity(response, body);
      if (path === `${prefix()}/slots/${freeSlotId}/blackout`) return handleBlackout(response);
      if (path === `${prefix()}/periods`) return handleCreatePeriod(response, body);
      if (path === `${prefix()}/periods/${periodId}/cancel`) return handleCancelPeriod(response);
      if (path === `${prefix()}/doctor-mappings`) { doctorInventory.veterinarians[0].catalog_doctor_id=catalogDoctorId; doctorInventory.doctors=[{staff_id:staffId,doctor_id:catalogDoctorId,display_name:'Доктор Айболит',full_name:'Доктор Айболит'}]; return sendJson(response,201,{staff_id:staffId,doctor_id:catalogDoctorId,version:2}); }
      if (path === `${prefix()}/doctor-services`) { doctorInventory.doctorServices.push({id:newServiceId,staff_id:staffId,doctor_id:catalogDoctorId,service_id:serviceId,resource_id:null,slot_capacity:1,active:true,version:1,doctor_name:'Доктор Айболит',service_name:'Первичный приём',duration_minutes:30}); return sendJson(response,201,doctorInventory.doctorServices[0]); }
      if (path === `${prefix()}/doctor-shifts`) { doctorInventory.shifts.push({id:doctorShiftId,staffId,doctorId:catalogDoctorId,startsAt:(body as any).startsAt,endsAt:(body as any).endsAt,timezone:'Europe/Moscow',status:'DRAFT',version:1,generationVersion:0}); return sendJson(response,201,doctorInventory.shifts[0]); }
      if (path === `${prefix()}/doctor-shifts/${doctorShiftId}/generate`) { if(backendMode==='doctor-stale')return sendJson(response,409,{code:'DOCTOR_SHIFT_STALE'});doctorInventory.runs.unshift({id:generationRunId,doctor_shift_id:doctorShiftId,shift_version:1,generation_version:1,status:'GENERATED',slot_count:2,completed_at:new Date().toISOString()}); doctorInventory.shifts[0].generationVersion=1; doctorInventory.generatedSlots=[0,1].map((index:number)=>({id:`60606060-6060-4060-8060-60606060606${index}`,doctor_shift_id:doctorShiftId,generation_run_id:generationRunId,service_id:serviceId,service_name:'Первичный приём',starts_at:new Date(Date.now()+86400000+index*1800000).toISOString(),ends_at:new Date(Date.now()+86400000+(index+1)*1800000).toISOString(),capacity:1,held_count:index,booked_count:0,state:'CLOSED',status:index?'LOCKED_BY_HOLD':'AVAILABLE',publication_state:'DRAFT',version:1})); return sendJson(response,200,{id:generationRunId,status:'GENERATED',slotCount:2}); }
      if (path === `${prefix()}/inventory-runs/${generationRunId}/publish`) { doctorInventory.runs[0].status='PUBLISHED'; doctorInventory.shifts[0].status='PUBLISHED'; doctorInventory.generatedSlots.forEach((slot:any)=>{slot.publication_state='PUBLISHED';slot.state='OPEN';}); return sendJson(response,200,{runId:generationRunId,publicationState:'PUBLISHED',slotCount:2}); }

      sendJson(response, 404, { code: 'NOT_FOUND' });
    }).catch(() => sendJson(response, 400, { code: 'INVALID_REQUEST' }));
    return;
  }

  sendJson(response, 404, { code: 'NOT_FOUND' });
}

function recordRequest(request: IncomingMessage, path: string, body: unknown): void {
  requests.push({
    method: request.method ?? 'GET',
    path,
    body,
    idempotencyKey: headerValue(request, 'idempotency-key'),
    ifMatch: headerValue(request, 'if-match'),
    correlationId: headerValue(request, 'x-correlation-id'),
    authorization: headerValue(request, 'authorization'),
  });
}

function handleCreateService(response: ServerResponse, body: unknown): void {
  const service = body as Partial<ServiceForm>;
  if (service.code === 'EXISTS') {
    sendJson(response, 409, { code: 'SERVICE_CODE_EXISTS' });
    return;
  }
  schedule.services.push({
    id: newServiceId,
    code: service.code ?? '',
    displayName: service.displayName ?? '',
    durationMinutes: service.durationMinutes ?? 30,
    priceAmount: service.priceAmount ?? '0.00',
    currency: service.currency ?? 'RUB',
    active: true,
    version: 1,
    updatedAt: '2026-06-28T10:00:00.000Z',
  });
  sendJson(response, 201, { id: newServiceId });
}

function handleSaveService(response: ServerResponse, body: unknown): void {
  const patch = body as Partial<ServiceForm>;
  if (backendMode === 'service-has-bookings' && patch.active === false) {
    sendJson(response, 409, { code: 'SERVICE_HAS_ACTIVE_BOOKINGS' });
    return;
  }
  schedule.services = schedule.services.map((service: any) => service.id === serviceId ? { ...service, ...patch, version: service.version + 1 } : service);
  sendJson(response, 200, { id: serviceId });
}

function handleCreateStaff(response: ServerResponse, body: unknown): void {
  const staff = body as Partial<StaffForm>;
  schedule.staff.push({
    id: newStaffId,
    code: staff.code ?? '',
    displayName: staff.displayName ?? '',
    role: staff.role ?? 'VETERINARIAN',
    active: true,
    source: 'LOCAL',
    externalStaffId: null,
    version: 1,
    updatedAt: '2026-06-28T10:00:00.000Z',
  });
  sendJson(response, 201, { id: newStaffId });
}

function handleSaveStaff(response: ServerResponse, body: unknown): void {
  const patch = body as Partial<StaffForm>;
  if (backendMode === 'staff-has-bookings' && patch.active === false) {
    sendJson(response, 409, { code: 'STAFF_HAS_ACTIVE_BOOKINGS' });
    return;
  }
  schedule.staff = schedule.staff.map((staff: any) => staff.id === newStaffId ? { ...staff, ...patch, version: staff.version + 1 } : staff);
  sendJson(response, 200, { id: newStaffId });
}

function handleCreateResource(response: ServerResponse, body: unknown): void {
  const resource = body as Partial<ResourceForm>;
  schedule.resources.push({
    id: newResourceId,
    code: resource.code ?? '',
    displayName: resource.displayName ?? '',
    resourceType: resource.resourceType ?? 'CABINET',
    active: true,
    source: 'LOCAL',
    externalResourceId: null,
    version: 1,
    updatedAt: '2026-06-28T10:00:00.000Z',
  });
  sendJson(response, 201, { id: newResourceId });
}

function handleSaveResource(response: ServerResponse, body: unknown): void {
  const patch = body as Partial<ResourceForm>;
  if (backendMode === 'resource-has-bookings' && patch.active === false) {
    sendJson(response, 409, { code: 'RESOURCE_HAS_ACTIVE_BOOKINGS' });
    return;
  }
  schedule.resources = schedule.resources.map((resource: any) => resource.id === newResourceId ? { ...resource, ...patch, version: resource.version + 1 } : resource);
  sendJson(response, 200, { id: newResourceId });
}

function handleManualSlot(response: ServerResponse, body: unknown): void {
  const slot = body as { capacity?: number; staffId?: string | null; resourceId?: string | null };
  schedule.slots.push({
    ...baseSlot('cccccccc-cccc-4ccc-8ccc-cccccccccccc', schedule),
    startsAt: '2026-06-30T10:00:00.000Z',
    endsAt: '2026-06-30T10:30:00.000Z',
    capacity: slot.capacity ?? 1,
    bookedCount: 2,
    staff: schedule.staff.find((staff: any) => staff.id === slot.staffId) ?? null,
    resource: schedule.resources.find((resource: any) => resource.id === slot.resourceId) ?? null,
  });
  sendJson(response, 201, { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
}

function handleWorkingHours(response: ServerResponse, body: unknown): void {
  const payload = body as { days?: typeof schedule.workingHours };
  if (payload.days) schedule.workingHours = payload.days.map((day: any) => ({ ...day, source: 'LOCAL', updatedAt: '2026-06-28T11:00:00.000Z' }));
  sendJson(response, 200, { updated: true });
}

function handleImport(response: ServerResponse, body: unknown): void {
  if (backendMode === 'import-business-error') {
    sendJson(response, 422, { code: 'SLOT_TIME_RANGE_INVALID' });
    return;
  }
  const payload = body as { slots?: Array<{ capacity?: number }> };
  schedule.slots.push({
    ...baseSlot('dddddddd-dddd-4ddd-8ddd-dddddddddddd', schedule),
    startsAt: '2026-07-01T10:00:00.000Z',
    endsAt: '2026-07-01T10:30:00.000Z',
    capacity: payload.slots?.[0]?.capacity ?? 1,
  });
  sendJson(response, 200, { imported: payload.slots?.length ?? 0 });
}

function handleCapacity(response: ServerResponse, body: unknown): void {
  if (backendMode === 'capacity-stale') {
    sendJson(response, 409, { code: 'SLOT_VERSION_STALE' });
    return;
  }
  const payload = body as { capacity?: number };
  schedule.slots = schedule.slots.map((slot: any) => slot.id === freeSlotId ? { ...slot, capacity: payload.capacity ?? slot.capacity, version: slot.version + 1 } : slot);
  sendJson(response, 200, { id: freeSlotId });
}

function handleBlackout(response: ServerResponse): void {
  if (backendMode === 'blackout-stale') {
    sendJson(response, 409, { code: 'SLOT_VERSION_STALE' });
    return;
  }
  schedule.slots = schedule.slots.map((slot: any) => slot.id === freeSlotId ? { ...slot, state: 'CLOSED', version: slot.version + 1 } : slot);
  sendJson(response, 200, { id: freeSlotId });
}

function handleCreatePeriod(response: ServerResponse, body: unknown): void {
  if (backendMode === 'period-has-bookings') {
    sendJson(response, 409, { code: 'SCHEDULE_PERIOD_HAS_ACTIVE_BOOKINGS' });
    return;
  }
  const period = body as { periodType?: 'BLACKOUT' | 'VACATION' | 'EMERGENCY_DUTY'; startsAt?: string; endsAt?: string; staffId?: string | null; resourceId?: string | null; reason?: string | null };
  schedule.periods.push({
    id: periodId,
    periodType: period.periodType ?? 'BLACKOUT',
    startsAt: period.startsAt ?? '2026-07-02T10:00:00.000Z',
    endsAt: period.endsAt ?? '2026-07-02T12:00:00.000Z',
    staff: schedule.staff.find((staff: any) => staff.id === period.staffId) ?? null,
    resource: schedule.resources.find((resource: any) => resource.id === period.resourceId) ?? null,
    reason: period.reason ?? null,
    active: true,
    source: 'LOCAL',
    version: 1,
    updatedAt: '2026-06-28T10:00:00.000Z',
  });
  sendJson(response, 201, { id: periodId });
}

function handleCancelPeriod(response: ServerResponse): void {
  if (backendMode === 'period-stale') {
    sendJson(response, 409, { code: 'SCHEDULE_PERIOD_VERSION_STALE' });
    return;
  }
  schedule.periods = schedule.periods.map((period: any) => period.id === periodId ? { ...period, active: false, version: period.version + 1 } : period);
  sendJson(response, 200, { id: periodId });
}

async function collectBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function makeSchedule(): any {
  const staff = [{
    id: staffId,
    code: 'VET-1',
    displayName: 'Доктор Айболит',
    role: 'VETERINARIAN',
    active: true,
    source: 'LOCAL',
    externalStaffId: null,
    version: 1,
    updatedAt: '2026-06-28T10:00:00.000Z',
  }];
  const resources = [{
    id: resourceId,
    code: 'CAB-1',
    displayName: 'Кабинет 1',
    resourceType: 'CABINET',
    active: true,
    source: 'LOCAL',
    externalResourceId: null,
    version: 1,
    updatedAt: '2026-06-28T10:00:00.000Z',
  }];
  const snapshot = {
    clinicId,
    locationId,
    serverNow: '2026-06-28T12:00:00.000Z',
    services: [{
      id: serviceId,
      code: 'CONSULTATION',
      displayName: 'Первичный приём',
      durationMinutes: 30,
      active: true,
      priceAmount: '1500.00',
      currency: 'RUB',
      version: 1,
      updatedAt: '2026-06-28T10:00:00.000Z',
    }],
    staff,
    resources,
    periods: [] as Array<ReturnType<typeof basePeriod>>,
    workingHours: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      opensAt: '09:00',
      closesAt: '18:00',
      active: weekday > 0 && weekday < 6,
      source: 'LOCAL',
      updatedAt: '2026-06-28T10:00:00.000Z',
    })),
    slots: [] as any[],
  };
  snapshot.slots = [
    {
      ...baseSlot(bookedSlotId, snapshot),
      bookedCount: 1,
      status: 'BOOKED',
    },
    baseSlot(freeSlotId, snapshot),
  ];
  return snapshot;
}

function makeDoctorInventory(withDoctor: boolean): any {
  return { clinicId, locationId, timezone:'Europe/Moscow', mutationEnabled:true, doctors: withDoctor ? [{staff_id:staffId,doctor_id:catalogDoctorId,display_name:'Доктор Айболит',full_name:'Доктор Айболит'}] : [], veterinarians:[{id:staffId,display_name:'Доктор Айболит',catalog_doctor_id:withDoctor?catalogDoctorId:null}], catalogDoctors:[{id:catalogDoctorId,full_name:'Доктор Айболит'}], doctorServices: [], shifts: [], runs: [], generatedSlots:[] };
}

function makeVisualDoctorInventory(state:'DRAFT'|'GENERATED'|'PUBLISHED'|'BLOCKED'|'HELD'|'BOOKED'):any{
  const inventory=makeDoctorInventory(true);
  const published=['PUBLISHED','HELD','BOOKED'].includes(state);
  const generated=state!=='DRAFT';
  inventory.doctorServices=[{id:newServiceId,staff_id:staffId,doctor_id:catalogDoctorId,service_id:serviceId,resource_id:null,slot_capacity:1,active:true,version:1,doctor_name:'Доктор Айболит',service_name:'Первичный приём',duration_minutes:30}];
  inventory.shifts=[{id:doctorShiftId,staffId,doctorId:catalogDoctorId,startsAt:'2026-09-10T08:00:00.000Z',endsAt:'2026-09-10T09:00:00.000Z',timezone:'Europe/Moscow',status:state==='BLOCKED'?'BLOCKED':published?'PUBLISHED':'DRAFT',version:3,generationVersion:generated?1:0}];
  if(generated){
    inventory.runs=[{id:generationRunId,doctor_shift_id:doctorShiftId,shift_version:3,generation_version:1,status:published?'PUBLISHED':'GENERATED',slot_count:2,completed_at:'2026-08-28T10:00:00.000Z'}];
    inventory.generatedSlots=[0,1].map((index)=>{const startsAt=new Date(Date.parse('2026-09-10T08:00:00.000Z')+index*30*60_000);const endsAt=new Date(startsAt.getTime()+30*60_000);return {id:`60606060-6060-4060-8060-60606060606${index}`,doctor_shift_id:doctorShiftId,generation_run_id:generationRunId,service_id:serviceId,service_name:'Первичный приём',starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),capacity:1,held_count:state==='HELD'&&index===0?1:0,booked_count:state==='BOOKED'&&index===0?1:0,state:state==='BLOCKED'?'CLOSED':'OPEN',status:state==='BOOKED'&&index===0?'BOOKED':state==='HELD'&&index===0?'LOCKED_BY_HOLD':'AVAILABLE',publication_state:state==='BLOCKED'?'BLOCKED':published?'PUBLISHED':'DRAFT',version:2};});
  }
  return inventory;
}

function baseSlot(id: string, snapshot: any): any {
  return {
    id,
    service: { id: serviceId, displayName: 'Первичный приём' },
    staff: snapshot.staff[0],
    resource: snapshot.resources[0],
    startsAt: id === bookedSlotId ? '2026-06-29T10:00:00.000Z' : '2026-06-29T11:00:00.000Z',
    endsAt: id === bookedSlotId ? '2026-06-29T10:30:00.000Z' : '2026-06-29T11:30:00.000Z',
    capacity: 1,
    bookedCount: 0,
    heldCount: 0,
    state: 'OPEN',
    status: 'AVAILABLE',
    source: 'LOCAL',
    integrationMode: 'AUTONOMOUS',
    lastFreshnessSync: null,
    stale: false,
    version: 1,
    bookingHold: null,
  };
}

function basePeriod() {
  return {
    id: periodId,
    periodType: 'BLACKOUT' as const,
    startsAt: '2026-07-02T10:00:00.000Z',
    endsAt: '2026-07-02T12:00:00.000Z',
    staff: { id: staffId, displayName: 'Доктор Айболит' },
    resource: { id: resourceId, displayName: 'Кабинет 1' },
    reason: 'Санитарная обработка',
    active: true,
    source: 'LOCAL',
    version: 1,
    updatedAt: '2026-06-28T10:00:00.000Z',
  };
}
