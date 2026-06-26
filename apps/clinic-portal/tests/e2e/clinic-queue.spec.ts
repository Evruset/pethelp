import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const forbiddenLocationId = '33333333-3333-4333-8333-333333333333';
const holdA = '44444444-4444-4444-8444-444444444444';
const holdB = '55555555-5555-4555-8555-555555555555';
const holdC = '66666666-6666-4666-8666-666666666666';
const serverNow = '2026-06-25T12:00:00.000Z';
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';
const mockBackendPort = 3212;

type QueueItem = {
  holdId: string;
  version: number;
  holdExpiresAt: string;
  manualConfirmPendingAt: string;
  confirmationSlaExpiresAt: string;
  slot: { id: string; startsAt: string; endsAt: string };
  pet: { id: string; name: string; species: string };
  service: { displayName: string } | null;
};

type ConfirmMode = 'success' | 'slot-locked-retry';

let server: Server;
let items: QueueItem[] = [];
let confirmMode: ConfirmMode = 'success';
let queueReads = 0;
let confirmRequests: Array<{ holdId: string; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];

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
  resetBackend();
});

test('redirects unauthenticated clinic users to forbidden', async ({ page }) => {
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await expect(page).toHaveURL(/\/forbidden\?reason=session_required$/);
  await expect(page.getByText('403 Access Denied')).toBeVisible();
});

test('blocks clinic location URL tampering before backend queue fetch', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);

  await page.goto(`/clinics/${clinicId}/locations/${forbiddenLocationId}/queue`);

  await expect(page.getByText('403 Access Denied')).toBeVisible();
  await expect(page.getByText('Нет доступа к этой локации')).toBeVisible();
  expect(queueReads).toBe(0);
});

test('renders backend FIFO order and SLA risk state from serverNow', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);

  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await expect(rowFor(page, 'Барс')).toContainText('1');
  await expect(rowFor(page, 'Шарик')).toContainText('2');
  await expect(rowFor(page, 'Марта')).toContainText('3');
  await expect(rowFor(page, 'Барс')).toContainText('Срок подтверждения истекает.');
  await expect(rowFor(page, 'Шарик')).toContainText('Сначала обработайте более раннюю заявку.');
  await expect(rowFor(page, 'Марта')).toContainText('Сначала обработайте более раннюю заявку.');
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
  await expect(rowFor(page, 'Шарик').getByRole('button', { name: 'Ожидает очередь' })).toBeDisabled();
});

test('confirms the first actionable hold and refreshes authoritative queue', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();

  await expect(page.getByRole('status')).toContainText('Запись подтверждена. Очередь обновлена.');
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  await expect(rowFor(page, 'Шарик')).toContainText('1');
  expect(confirmRequests).toEqual([{ holdId: holdA, ifMatch: '1', idempotencyKey: expect.any(String) }]);
  expect(queueReads).toBeGreaterThanOrEqual(2);
});

test('refreshes queue after retryable confirm conflict without fencing the row', async ({ page, context, baseURL }) => {
  confirmMode = 'slot-locked-retry';
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();

  await expect(page.getByRole('status')).toContainText('Обновляем состояние заявки.');
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
  expect(confirmRequests).toEqual([{ holdId: holdA, ifMatch: '1', idempotencyKey: expect.any(String) }]);
  expect(queueReads).toBeGreaterThanOrEqual(2);
});

function rowFor(page: Page, petName: string) {
  return page.getByRole('row').filter({ hasText: petName });
}

async function addClinicSession(
  context: BrowserContext,
  baseURL: string | undefined,
) {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({
    roles: ['CLINIC_RECEPTIONIST'],
    clinicIds: [clinicId],
    locationIds: [locationId],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('clinic-user-e2e')
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

function resetBackend() {
  items = makeQueueItems();
  confirmMode = 'success';
  queueReads = 0;
  confirmRequests = [];
}

function handleBackendRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${mockBackendPort}`}`);
  const queuePath = `/v1/clinic/${clinicId}/locations/${locationId}/booking-queue`;
  if (request.method === 'GET' && url.pathname === queuePath) {
    queueReads += 1;
    sendJson(response, 200, { clinicId, locationId, serverNow, items });
    return;
  }

  const confirmMatch = url.pathname.match(/^\/v1\/clinic\/booking-holds\/([^/]+)\/confirm$/);
  if (request.method === 'POST' && confirmMatch) {
    const holdId = confirmMatch[1];
    confirmRequests.push({
      holdId,
      ifMatch: headerValue(request, 'if-match'),
      idempotencyKey: headerValue(request, 'idempotency-key'),
    });
    if (confirmMode === 'slot-locked-retry') {
      sendJson(response, 409, { code: 'SLOT_LOCKED_RETRY' });
      return;
    }
    items = items.filter((item) => item.holdId !== holdId);
    sendJson(response, 200, { holdId, state: 'CONFIRMED' });
    return;
  }

  sendJson(response, 404, { code: 'NOT_FOUND' });
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

function makeQueueItems(): QueueItem[] {
  return [
    item({
      holdId: holdA,
      slotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      petId: 'aaaa1111-1111-4111-8111-111111111111',
      petName: 'Барс',
      species: 'cat',
      positionMinutes: 0,
      slaMinutes: 2,
    }),
    item({
      holdId: holdB,
      slotId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      petId: 'bbbb1111-1111-4111-8111-111111111111',
      petName: 'Шарик',
      species: 'dog',
      positionMinutes: 1,
      slaMinutes: 10,
    }),
    item({
      holdId: holdC,
      slotId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      petId: 'cccc1111-1111-4111-8111-111111111111',
      petName: 'Марта',
      species: 'cat',
      positionMinutes: 2,
      slaMinutes: 14,
    }),
  ];
}

function item(input: {
  holdId: string;
  slotId: string;
  petId: string;
  petName: string;
  species: string;
  positionMinutes: number;
  slaMinutes: number;
}): QueueItem {
  const base = Date.parse(serverNow);
  const visitStart = new Date(base + (24 * 60 + input.positionMinutes * 30) * 60_000);
  const visitEnd = new Date(visitStart.getTime() + 30 * 60_000);
  return {
    holdId: input.holdId,
    version: 1,
    holdExpiresAt: new Date(base + input.slaMinutes * 60_000).toISOString(),
    manualConfirmPendingAt: new Date(base - (3 - input.positionMinutes) * 60_000).toISOString(),
    confirmationSlaExpiresAt: new Date(base + input.slaMinutes * 60_000).toISOString(),
    slot: {
      id: input.slotId,
      startsAt: visitStart.toISOString(),
      endsAt: visitEnd.toISOString(),
    },
    pet: {
      id: input.petId,
      name: input.petName,
      species: input.species,
    },
    service: {
      displayName: 'Первичный приём',
    },
  };
}
