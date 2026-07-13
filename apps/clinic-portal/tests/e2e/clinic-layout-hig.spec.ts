import { expect, test } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const serviceId = '66666666-6666-4666-8666-666666666666';
const staffId = '77777777-7777-4777-8777-777777777777';
const resourceId = '88888888-8888-4888-8888-888888888888';
const slotId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const occupiedSlotId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const blackoutSlotId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const mockBackendPort = 3212;
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';

let server: Server;
type CapturedSlotRequest = {
  correlationId?: string;
  idempotencyKey?: string;
  requestedAt: number;
};

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

test('adapts clinic portal shell between desktop and iPad portrait', async ({ page, context, baseURL }) => {
  await addAdminSession(context, baseURL);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(route());

  await expect(page.getByTestId('clinic-portal-shell')).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: 'Навигация портала клиники' });
  const bottomNav = page.getByRole('navigation', { name: 'Быстрая навигация портала клиники' });

  await expect(sidebar).toBeVisible();
  await expect(bottomNav).toBeHidden();
  await expect(page.getByRole('link', { name: 'Открыть расписание' }).first()).toBeVisible();

  const desktopTarget = await page.getByRole('link', { name: 'Открыть расписание' }).first().boundingBox();
  expect(desktopTarget?.height).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 768, height: 1024 });

  await expect(sidebar).toBeHidden();
  await expect(bottomNav).toBeVisible();

  const portraitTarget = await page.getByRole('link', { name: 'Открыть расписание' }).last().boundingBox();
  expect(portraitTarget?.height).toBeGreaterThanOrEqual(44);
});

test('keeps correlation id stable and rotates idempotency key on slot retry', async ({ page, context, baseURL }) => {
  await addAdminSession(context, baseURL);
  const requests: CapturedSlotRequest[] = [];

  await page.route(slotActionRoute(), async (route) => {
    requests.push(capturedSlotRequest(route.request()));
    if (requests.length === 1) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'SLOT_LOCKED_RETRY' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: slotId }),
    });
  });

  await page.goto(route());
  await page.getByRole('button', { name: 'Blackout' }).click();
  await page.getByRole('dialog', { name: 'Закрыть окно' }).getByRole('button', { name: 'Закрыть окно' }).click();
  await expect(page.getByRole('status')).toContainText('Окно закрыто');

  expect(requests).toHaveLength(2);
  expect(requests[0].correlationId).toBeTruthy();
  expect(requests[1].correlationId).toBe(requests[0].correlationId);
  expect(requests[0].idempotencyKey).toBeTruthy();
  expect(requests[1].idempotencyKey).toBeTruthy();
  expect(requests[1].idempotencyKey).not.toBe(requests[0].idempotencyKey);
});

test('retries SLOT_LOCKED_RETRY three times with exponential backoff', async ({ page, context, baseURL }) => {
  await addAdminSession(context, baseURL);
  const requests: CapturedSlotRequest[] = [];

  await page.route(slotActionRoute(), async (route) => {
    requests.push(capturedSlotRequest(route.request()));
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SLOT_LOCKED_RETRY' }),
    });
  });

  await page.goto(route());
  await page.getByRole('button', { name: 'Blackout' }).click();
  await page.getByRole('dialog', { name: 'Закрыть окно' }).getByRole('button', { name: 'Закрыть окно' }).click();
  await expect(page.getByRole('dialog', { name: 'Слот недоступен' })).toBeVisible({ timeout: 12_000 });

  expect(requests).toHaveLength(4);
  const gaps = requests.slice(1).map((request, index) => request.requestedAt - requests[index].requestedAt);
  expect(gaps[0]).toBeGreaterThanOrEqual(900);
  expect(gaps[1]).toBeGreaterThanOrEqual(1900);
  expect(gaps[2]).toBeGreaterThanOrEqual(3900);
});

test('shows accessible slide-over when slot retry is exhausted', async ({ page, context, baseURL }) => {
  await addAdminSession(context, baseURL);

  await page.route(slotActionRoute(), async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SLOT_LOCKED_RETRY' }),
    });
  });

  await page.goto(route());
  await page.getByRole('button', { name: 'Blackout' }).click();
  await page.getByRole('dialog', { name: 'Закрыть окно' }).getByRole('button', { name: 'Закрыть окно' }).click();

  const dialog = page.getByRole('dialog', { name: 'Слот недоступен' });
  await expect(dialog).toBeVisible({ timeout: 12_000 });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByText('Это время уже занято другим процессом. Пожалуйста, обновите расписание')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Обновить расписание' })).toBeVisible();
});

test('captures schedule occupied and blackout visual baseline', async ({ page, context, baseURL }) => {
  await addAdminSession(context, baseURL);

  await page.goto(route());

  await expect(page.getByTestId(`schedule-slot-${occupiedSlotId}`)).toContainText('Заполнен');
  await expect(page.getByTestId(`schedule-slot-${blackoutSlotId}`)).toContainText('Закрыт');
  await expect(page.getByTestId(`schedule-slot-${occupiedSlotId}`).getByRole('button', { name: 'Blackout' })).toBeDisabled();
  await expect(page.getByTestId(`schedule-slot-${blackoutSlotId}`).getByRole('button', { name: 'Blackout' })).toBeDisabled();
  await expect(page).toHaveScreenshot('schedule-occupied-blackout.png', { fullPage: true });
});
function route(): string {
  return `/clinics/${clinicId}/locations/${locationId}/schedule`;
}

function slotActionRoute(): string {
  return `**/api/clinic/${clinicId}/locations/${locationId}/schedule/slots/${slotId}/blackout`;
}

function capturedSlotRequest(request: import('@playwright/test').Request): CapturedSlotRequest {
  const headers = request.headers();
  return {
    correlationId: headers['x-correlation-id'],
    idempotencyKey: headers['x-idempotency-key'],
    requestedAt: Date.now(),
  };
}

async function addAdminSession(context: BrowserContext, baseURL: string | undefined): Promise<void> {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({
    roles: ['CLINIC_ADMIN'],
    clinicIds: [clinicId],
    locationIds: [locationId],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('clinic-layout-hig-e2e')
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
  const schedulePath = `/v1/clinic/${clinicId}/locations/${locationId}/schedule/slots`;

  if (request.method === 'GET' && url.pathname === schedulePath) {
    sendJson(response, 200, makeSchedule());
    return;
  }

  sendJson(response, 404, { code: 'NOT_FOUND' });
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function makeSchedule() {
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
    staff,
    resources,
    periods: [],
    workingHours: [],
    slots: [
      makeSlot({
        id: slotId,
        startsAt: '2026-06-29T11:00:00.000Z',
        endsAt: '2026-06-29T11:30:00.000Z',
        staff: staff[0],
        resource: resources[0],
        bookedCount: 0,
        heldCount: 0,
        state: 'OPEN',
        status: 'AVAILABLE',
      }),
      makeSlot({
        id: occupiedSlotId,
        startsAt: '2026-06-29T12:00:00.000Z',
        endsAt: '2026-06-29T12:30:00.000Z',
        staff: staff[0],
        resource: resources[0],
        bookedCount: 1,
        heldCount: 0,
        state: 'OPEN',
        status: 'BOOKED',
      }),
      makeSlot({
        id: blackoutSlotId,
        startsAt: '2026-06-29T13:00:00.000Z',
        endsAt: '2026-06-29T13:30:00.000Z',
        staff: staff[0],
        resource: resources[0],
        bookedCount: 0,
        heldCount: 0,
        state: 'CLOSED',
        status: 'AVAILABLE',
      }),
    ],
  };
}

function makeSlot(input: {
  id: string;
  startsAt: string;
  endsAt: string;
  staff: { id: string; displayName: string };
  resource: { id: string; displayName: string };
  bookedCount: number;
  heldCount: number;
  state: string;
  status: string;
}) {
  return {
    id: input.id,
    service: { id: serviceId, displayName: 'Первичный приём' },
    staff: input.staff,
    resource: input.resource,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    capacity: 1,
    bookedCount: input.bookedCount,
    heldCount: input.heldCount,
    state: input.state,
    status: input.status,
    source: 'LOCAL',
    integrationMode: 'AUTONOMOUS',
    lastFreshnessSync: null,
    stale: false,
    version: 1,
    bookingHold: input.bookedCount > 0 ? {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      state: 'CONFIRMED',
      ownerId: 'owner-schedule-visual',
      petId: 'pet-schedule-visual',
    } : null,
  };
}
