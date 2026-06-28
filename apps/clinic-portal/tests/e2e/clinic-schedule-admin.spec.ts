import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { SignJWT } from 'jose';
import { captureEvidence, uiStep } from './support/evidence';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const serviceId = '66666666-6666-4666-8666-666666666666';
const slotId = '55555555-5555-4555-8555-555555555555';
const mockBackendPort = 3212;
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';

let server: Server;
let schedule = makeSchedule();
let requests: Array<{ method: string; path: string; body: unknown }> = [];

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
});

test.afterEach(async ({ page }, testInfo) => {
  await captureEvidence(page, testInfo, testInfo.status === 'passed' ? 'final-state' : 'failure-state');
});

test('creates a local service through the schedule UI', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание администратора', () => page.goto(route()));
  const serviceSection = page.getByRole('heading', { name: 'Услуги локации' }).locator('xpath=ancestor::section[1]');
  await uiStep(page, testInfo, 'Заполнить новую услугу', async () => {
    await serviceSection.getByPlaceholder('code').fill('VACCINE');
    await serviceSection.getByPlaceholder('Название').fill('Вакцинация');
    await serviceSection.getByLabel('Длительность услуги').fill('20');
    await serviceSection.getByPlaceholder('1000.00').fill('2200.00');
    await serviceSection.getByPlaceholder('RUB').fill('RUB');
  });
  await uiStep(page, testInfo, 'Создать услугу', async () => {
    await serviceSection.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByRole('status')).toContainText('Услуга создана и зафиксирована в audit.');
    await expect.poll(async () => serviceSection.locator('tbody tr').evaluateAll((rows) => {
      const row = rows.find((candidate) => {
        const inputs = Array.from(candidate.querySelectorAll('input'));
        return inputs.some((input) => input.value === 'VACCINE');
      });
      return row?.querySelectorAll('input')[1]?.value ?? '';
    })).toBe('Вакцинация');
  });

  expect(requests).toContainEqual(expect.objectContaining({
    method: 'POST',
    path: `/v1/clinic/${clinicId}/locations/${locationId}/schedule/services`,
    body: expect.objectContaining({ code: 'VACCINE', displayName: 'Вакцинация', durationMinutes: 20 }),
  }));
});

test('shows a business error for duplicate service code', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание', () => page.goto(route()));
  const serviceSection = page.getByRole('heading', { name: 'Услуги локации' }).locator('xpath=ancestor::section[1]');
  await uiStep(page, testInfo, 'Отправить существующий код услуги', async () => {
    await serviceSection.getByPlaceholder('code').fill('EXISTS');
    await serviceSection.getByPlaceholder('Название').fill('Повтор');
    await serviceSection.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByRole('status')).toContainText('Код услуги уже используется в этой локации.');
  });
});

test('creates a manual slot and refreshes schedule', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание', () => page.goto(route()));
  const form = page.getByRole('heading', { name: 'Добавить ручное окно' }).locator('xpath=ancestor::section[1]');
  await uiStep(page, testInfo, 'Задать время ручного окна', async () => {
    await form.locator('input[type="datetime-local"]').nth(0).fill('2026-06-30T10:00');
    await form.locator('input[type="datetime-local"]').nth(1).fill('2026-06-30T10:30');
    await form.locator('input[type="number"]').fill('2');
  });
  await uiStep(page, testInfo, 'Создать ручное окно', async () => {
    await form.getByRole('button', { name: 'Создать окно' }).click();
    await expect(page.getByRole('status')).toContainText('Ручное окно создано и зафиксировано в audit.');
    await expect(page.getByText('2 записей · 0 holds · cap 2')).toBeVisible();
  });

  expect(requests).toContainEqual(expect.objectContaining({
    method: 'POST',
    path: `/v1/clinic/${clinicId}/locations/${locationId}/schedule/manual-slots`,
    body: expect.objectContaining({ serviceId, capacity: 2 }),
  }));
});

test('validates invalid JSON before schedule import request', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание', () => page.goto(route()));
  const importer = page.getByRole('heading', { name: 'Импорт расписания' }).locator('xpath=ancestor::section[1]');
  await uiStep(page, testInfo, 'Ввести повреждённый JSON', async () => {
    await importer.locator('textarea').fill('{not-json');
    await importer.getByRole('button', { name: 'Импортировать' }).click();
    await expect(page.getByRole('status')).toContainText('Не удалось прочитать JSON импорта.');
  });

  expect(requests.some((request) => request.path.endsWith('/schedule/import'))).toBeFalsy();
});

test('saves working-hours metadata through BFF', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание', () => page.goto(route()));
  const section = page.getByRole('heading', { name: 'Рабочие часы' }).locator('xpath=ancestor::section[1]');
  await uiStep(page, testInfo, 'Сохранить рабочие часы', async () => {
    await section.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('status')).toContainText('Рабочие часы обновлены и зафиксированы в audit.');
  });

  expect(requests).toContainEqual(expect.objectContaining({
    method: 'POST',
    path: `/v1/clinic/${clinicId}/locations/${locationId}/schedule/working-hours`,
  }));
});

test('blocks blackout action while a slot has a confirmed booking', async ({ page, context, baseURL }, testInfo) => {
  await addAdminSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть расписание с подтверждённой записью', () => page.goto(route()));
  await uiStep(page, testInfo, 'Проверить блокировку blackout', async () => {
    const row = page.getByRole('row').filter({ hasText: '1 записей · 0 holds · cap 1' });
    await expect(row.getByRole('button', { name: 'Blackout' })).toBeDisabled();
    await expect(row.getByRole('button', { name: 'Capacity' })).toBeDisabled();
  });
});

function route(): string {
  return `/clinics/${clinicId}/locations/${locationId}/schedule`;
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
  const prefix = `/v1/clinic/${clinicId}/locations/${locationId}/schedule`;

  if (request.method === 'GET' && url.pathname === `${prefix}/slots`) {
    sendJson(response, 200, schedule);
    return;
  }

  if (request.method === 'POST' && [
    `${prefix}/services`,
    `${prefix}/manual-slots`,
    `${prefix}/working-hours`,
  ].includes(url.pathname)) {
    void collectBody(request).then((body) => {
      requests.push({ method: 'POST', path: url.pathname, body });
      if (url.pathname === `${prefix}/services`) {
        const service = body as { code?: string; displayName?: string; durationMinutes?: number; priceAmount?: string; currency?: string };
        if (service.code === 'EXISTS') {
          sendJson(response, 409, { code: 'SERVICE_CODE_EXISTS' });
          return;
        }
        schedule.services.push({
          id: '99999999-9999-4999-8999-999999999999',
          code: service.code ?? '',
          displayName: service.displayName ?? '',
          durationMinutes: service.durationMinutes ?? 30,
          priceAmount: service.priceAmount ?? '0.00',
          currency: service.currency ?? 'RUB',
          active: true,
          version: 1,
          updatedAt: '2026-06-28T10:00:00.000Z',
        });
        sendJson(response, 201, { id: '99999999-9999-4999-8999-999999999999' });
        return;
      }
      if (url.pathname === `${prefix}/manual-slots`) {
        const slot = body as { capacity?: number };
        schedule.slots.push({
          ...schedule.slots[0],
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          startsAt: '2026-06-30T10:00:00.000Z',
          endsAt: '2026-06-30T10:30:00.000Z',
          capacity: slot.capacity ?? 1,
          bookedCount: 2,
          bookingHold: null,
        });
        sendJson(response, 201, { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
        return;
      }
      sendJson(response, 200, { updated: true });
    }).catch(() => sendJson(response, 400, { code: 'INVALID_REQUEST' }));
    return;
  }

  sendJson(response, 404, { code: 'NOT_FOUND' });
}

async function collectBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function makeSchedule() {
  return {
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
    staff: [],
    resources: [],
    periods: [],
    workingHours: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      opensAt: '09:00',
      closesAt: '18:00',
      active: weekday > 0 && weekday < 6,
      source: 'LOCAL',
      updatedAt: '2026-06-28T10:00:00.000Z',
    })),
    slots: [{
      id: slotId,
      service: { id: serviceId, displayName: 'Первичный приём' },
      staff: null,
      resource: null,
      startsAt: '2026-06-29T10:00:00.000Z',
      endsAt: '2026-06-29T10:30:00.000Z',
      capacity: 1,
      bookedCount: 1,
      heldCount: 0,
      state: 'OPEN',
      status: 'BOOKED',
      source: 'LOCAL',
      integrationMode: 'AUTONOMOUS',
      lastFreshnessSync: null,
      stale: false,
      version: 1,
      bookingHold: null,
    }],
  };
}
