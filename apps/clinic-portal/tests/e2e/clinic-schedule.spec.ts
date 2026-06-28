import { expect, test } from '@playwright/test';
import { captureEvidence, uiStep } from './support/evidence';
import type { BrowserContext, Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const holdId = '44444444-4444-4444-8444-444444444444';
const slotId = '55555555-5555-4555-8555-555555555555';
const serviceId = '66666666-6666-4666-8666-666666666666';
const staffId = '77777777-7777-4777-8777-777777777777';
const resourceId = '88888888-8888-4888-8888-888888888888';
const mockBackendPort = 3212;
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';

type CompletionMode = 'success' | 'invalid-state';

type CompletionRequest = {
  holdId: string;
  summary: string;
  correlationId: string | undefined;
  authorization: string | undefined;
};

let server: Server;
let scheduleReads = 0;
let completionMode: CompletionMode = 'success';
let completionRequests: CompletionRequest[] = [];
let schedule = makeSchedule('CONFIRMED');

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
  scheduleReads = 0;
  completionMode = 'success';
  completionRequests = [];
  schedule = makeSchedule('CONFIRMED');
});

test.afterEach(async ({ page }, testInfo) => {
  await captureEvidence(page, testInfo, testInfo.status === 'passed' ? 'final-state' : 'failure-state');
});

test('denies the schedule page without an authenticated clinic session', async ({ page }, testInfo) => {
  await uiStep(page, testInfo, 'Открыть расписание без сессии', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/schedule`));

  await uiStep(page, testInfo, 'Проверить запрет доступа к расписанию', async () => {
    await expect(page).toHaveURL(/\/forbidden\?reason=session_required$/);
    await expect(page.getByText('403 Access Denied')).toBeVisible();
  });
});

test('does not render appointment completion action for a receptionist', async ({ page, context, baseURL }, testInfo) => {
  await addClinicSession(context, baseURL, ['CLINIC_RECEPTIONIST']);
  await uiStep(page, testInfo, 'Открыть расписание под ресепционистом', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/schedule`));

  await uiStep(page, testInfo, 'Проверить скрытие закрытия приёма для роли', async () => {
    await expect(slotRow(page)).toContainText('Заполнен');
    await expect(slotRow(page).getByRole('button', { name: 'Закрыть приём' })).toHaveCount(0);
    expect(completionRequests).toHaveLength(0);
  });
});

test('closes a confirmed appointment and refreshes the authoritative schedule', async ({ page, context, baseURL }, testInfo) => {
  await addClinicSession(context, baseURL, ['CLINIC_ADMIN']);
  await uiStep(page, testInfo, 'Открыть расписание администратора', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/schedule`));

  await uiStep(page, testInfo, 'Проверить доступность закрытия приёма', async () => {
    await expect(slotRow(page).getByRole('button', { name: 'Закрыть приём' })).toBeEnabled();
  });

  const summary = 'Состояние стабильное, назначена контрольная консультация.';
  await uiStep(page, testInfo, 'Отправить clinical summary', async () => {
    await slotRow(page).getByRole('button', { name: 'Закрыть приём' }).click();
    const dialog = page.getByRole('dialog', { name: 'Закрыть приём' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Заключение по приёму').fill(summary);
    await dialog.getByRole('button', { name: 'Закрыть приём' }).click();
  });

  await uiStep(page, testInfo, 'Проверить refresh после закрытия приёма', async () => {
    await expect(page.getByRole('status')).toContainText('Приём закрыт. Заключение отправлено владельцу.');
    await expect(slotRow(page).getByRole('button', { name: 'Закрыть приём' })).toBeDisabled();
    expect(completionRequests).toHaveLength(1);
    expect(completionRequests[0]).toMatchObject({
      holdId,
      summary: 'Состояние стабильное, назначена контрольная консультация.',
      authorization: expect.stringMatching(/^Bearer /),
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
    expect(scheduleReads).toBeGreaterThanOrEqual(2);
  });
});

test('shows an actionable message and refreshes when appointment state is no longer confirmable', async ({ page, context, baseURL }, testInfo) => {
  completionMode = 'invalid-state';
  await addClinicSession(context, baseURL, ['CLINIC_ADMIN']);
  await uiStep(page, testInfo, 'Открыть расписание перед stale-state закрытием', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/schedule`));

  await uiStep(page, testInfo, 'Получить stale-state при закрытии приёма', async () => {
    await slotRow(page).getByRole('button', { name: 'Закрыть приём' }).click();
    const dialog = page.getByRole('dialog', { name: 'Закрыть приём' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Заключение по приёму').fill('Заключение готово.');
    await dialog.getByRole('button', { name: 'Закрыть приём' }).click();
  });

  await uiStep(page, testInfo, 'Проверить сообщение и refresh после stale-state', async () => {
    await expect(page.getByRole('status')).toContainText('Эту запись уже нельзя закрыть из расписания.');
    await expect(slotRow(page).getByRole('button', { name: 'Закрыть приём' })).toBeDisabled();
    expect(completionRequests).toHaveLength(1);
    expect(scheduleReads).toBeGreaterThanOrEqual(2);
  });
});

function slotRow(page: Page) {
  return page.getByRole('row').filter({ hasText: '1 записей · 0 holds · cap 1' });
}

async function addClinicSession(
  context: BrowserContext,
  baseURL: string | undefined,
  roles: string[],
) {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({
    roles,
    clinicIds: [clinicId],
    locationIds: [locationId],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('clinic-schedule-e2e')
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

function handleBackendRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${mockBackendPort}`}`);
  const schedulePath = `/v1/clinic/${clinicId}/locations/${locationId}/schedule/slots`;
  const completePath = `/v1/clinic/booking-holds/${holdId}/complete`;

  if (request.method === 'GET' && url.pathname === schedulePath) {
    scheduleReads += 1;
    sendJson(response, 200, schedule);
    return;
  }

  if (request.method === 'POST' && url.pathname === completePath) {
    collectBody(request)
      .then((rawBody) => {
        const body = rawBody ? JSON.parse(rawBody) as { summary?: string } : {};
        completionRequests.push({
          holdId,
          summary: body.summary ?? '',
          correlationId: headerValue(request, 'x-correlation-id'),
          authorization: headerValue(request, 'authorization'),
        });

        schedule = makeSchedule('COMPLETED');
        if (completionMode === 'invalid-state') {
          sendJson(response, 422, { code: 'INVALID_STATE_TRANSITION' });
          return;
        }

        sendJson(response, 200, { holdId, state: 'COMPLETED' });
      })
      .catch(() => sendJson(response, 400, { code: 'INVALID_REQUEST' }));
    return;
  }

  sendJson(response, 404, { code: 'NOT_FOUND' });
}

async function collectBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function makeSchedule(holdState: 'CONFIRMED' | 'COMPLETED') {
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
    staff: [{
      id: staffId,
      code: 'VET-1',
      displayName: 'Доктор Айболит',
      role: 'VETERINARIAN',
      active: true,
      source: 'LOCAL',
      externalStaffId: null,
      version: 1,
      updatedAt: '2026-06-28T10:00:00.000Z',
    }],
    resources: [{
      id: resourceId,
      code: 'CAB-1',
      displayName: 'Кабинет 1',
      resourceType: 'CABINET',
      active: true,
      source: 'LOCAL',
      externalResourceId: null,
      version: 1,
      updatedAt: '2026-06-28T10:00:00.000Z',
    }],
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
      staff: { id: staffId, displayName: 'Доктор Айболит' },
      resource: { id: resourceId, displayName: 'Кабинет 1' },
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
      bookingHold: {
        id: holdId,
        state: holdState,
        ownerId: '99999999-9999-4999-8999-999999999999',
        petId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    }],
  };
}
