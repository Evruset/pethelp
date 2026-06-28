import { expect, test } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { SignJWT } from 'jose';
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
  | 'import-business-error';

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
    await expect(page.getByRole('status')).toContainText('Capacity обновлена. Расписание обновлено.');
    await expect(page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 4' })).toBeVisible();
  });

  backendMode = 'capacity-stale';
  await uiStep(page, testInfo, 'Получить stale conflict и authoritative refresh', async () => {
    await page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 4' }).getByRole('button', { name: 'Capacity' }).click();
    const dialog = page.getByRole('dialog', { name: 'Изменить capacity' });
    await dialog.getByLabel('Новая capacity').fill('5');
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Окно уже изменилось. Расписание обновлено.');
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
    await expect(page.getByRole('status')).toContainText('Окно закрыто. Расписание обновлено.');
    await expect(page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 1' })).toContainText('Закрыт');
  });

  schedule.slots = schedule.slots.map((slot: any) => slot.id === freeSlotId ? { ...slot, state: 'OPEN', version: 2 } : slot);
  backendMode = 'blackout-stale';
  await uiStep(page, testInfo, 'Обновить и получить stale conflict blackout', async () => {
    await page.getByRole('button', { name: 'Обновить' }).click();
    await page.getByRole('row').filter({ hasText: '0 записей · 0 holds · cap 1' }).getByRole('button', { name: 'Blackout' }).click();
    await page.getByRole('dialog', { name: 'Закрыть окно' }).getByRole('button', { name: 'Закрыть окно' }).click();
    await expect(page.getByRole('status')).toContainText('Окно уже изменилось. Расписание обновлено.');
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
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({
    roles: ['CLINIC_ADMIN'],
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

  if (request.method === 'GET' && path === `${prefix()}/slots`) {
    scheduleReads += 1;
    sendJson(response, 200, schedule);
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
