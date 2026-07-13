import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { captureEvidence, uiStep } from './support/evidence';
import type { BrowserContext, Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const forbiddenLocationId = '33333333-3333-4333-8333-333333333333';
const holdA = '44444444-4444-4444-8444-444444444444';
const holdB = '55555555-5555-4555-8555-555555555555';
const holdC = '66666666-6666-4666-8666-666666666666';
const alternativeSlotA = '77777777-7777-4777-8777-777777777777';
const alternativeSlotB = '88888888-8888-4888-8888-888888888888';
const alternativeSlotC = '99999999-9999-4999-8999-999999999999';
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
type AlternativeMode = 'success' | 'slot-locked-retry';

let server: Server;
let items: QueueItem[] = [];
let confirmMode: ConfirmMode = 'success';
let alternativeMode: AlternativeMode = 'success';
let sessionMode: 'allowed' | 'denied' | 'error' = 'allowed';
let queueReads = 0;
let confirmRequests: Array<{ holdId: string; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];
let alternativeRequests: Array<{ holdId: string; newSlotId: string; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];

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

test.afterEach(async ({ page }, testInfo) => {
  await captureEvidence(page, testInfo, testInfo.status === 'passed' ? 'final-state' : 'failure-state');
});

test('shows the queue navigation and content only after booking.queue.read is granted', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await expect(page.getByRole('link', { name: 'Открыть очередь записей' }).first()).toBeVisible();
  await expect(rowFor(page, 'Барс')).toBeVisible();
});

test('fails closed for a denied effective session and direct queue URL never renders protected data', async ({ page, context, baseURL }) => {
  sessionMode = 'denied';
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await expect(page.getByText('403 Access Denied').first()).toBeVisible();
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Открыть очередь записей' })).toHaveCount(0);
  expect(queueReads).toBe(0);
});

test('does not flash queue navigation while session capability loading and exposes an accessible retry on session error', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  let sessionRequestedResolve: (() => void) | undefined;
  const sessionRequested = new Promise<void>((resolve) => { sessionRequestedResolve = resolve; });
  let releaseSession: (() => void) | undefined;
  const sessionRelease = new Promise<void>((resolve) => { releaseSession = resolve; });
  await page.route('**/api/auth/session', async (route) => {
    sessionRequestedResolve?.();
    await sessionRelease;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'SESSION_UNAVAILABLE' }) });
  });
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await sessionRequested;

  await expect(page.getByText('Загрузка доступа…').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть очередь записей' })).toHaveCount(0);
  releaseSession?.();
  await expect(page.getByText('Доступ к capability-разделам недоступен. Повторить').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Повторить' }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.vh-clinic-nav').analyze()).violations).toEqual([]);
});

test('redirects unauthenticated clinic users to forbidden', async ({ page }, testInfo) => {
  await uiStep(page, testInfo, 'Открыть очередь без сессии', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Проверить запрет доступа без сессии', async () => {
    await expect(page).toHaveURL(/\/forbidden\?reason=session_required$/);
    await expect(page.getByText('403 Access Denied')).toBeVisible();
  });
});

test('blocks clinic location URL tampering before backend queue fetch', async ({ page, context, baseURL }, testInfo) => {
  await addClinicSession(context, baseURL);

  await uiStep(page, testInfo, 'Открыть очередь чужой локации', () => page.goto(`/clinics/${clinicId}/locations/${forbiddenLocationId}/queue`));

  await uiStep(page, testInfo, 'Проверить ABAC-блокировку до backend fetch', async () => {
    await expect(page.getByText('403 Access Denied')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Нет доступа к этой локации', exact: true }).first()).toBeVisible();
    expect(queueReads).toBe(0);
  });
});

test('renders backend FIFO order and SLA risk state from serverNow', async ({ page, context, baseURL }, testInfo) => {
  await addClinicSession(context, baseURL);

  await uiStep(page, testInfo, 'Открыть очередь подтверждений', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Проверить FIFO и SLA-риск', async () => {
    await expect(rowFor(page, 'Барс')).toContainText('1');
    await expect(rowFor(page, 'Шарик')).toContainText('2');
    await expect(rowFor(page, 'Марта')).toContainText('3');
    await expect(rowFor(page, 'Барс')).toContainText('Срок подтверждения истекает.');
    await expect(rowFor(page, 'Шарик')).toContainText('Сначала обработайте более раннюю заявку.');
    await expect(rowFor(page, 'Марта')).toContainText('Сначала обработайте более раннюю заявку.');
    await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
    await expect(rowFor(page, 'Шарик').getByRole('button', { name: 'Ожидает очередь' })).toBeDisabled();
  });
});

test('confirms the first actionable hold and refreshes authoritative queue', async ({ page, context, baseURL }, testInfo) => {
  await addClinicSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть очередь с первой actionable заявкой', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Подтвердить первую заявку', () => rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click());

  await uiStep(page, testInfo, 'Проверить обновлённую authoritative очередь', async () => {
    await expect(page.getByRole('status')).toContainText('Запись подтверждена. Очередь обновлена.');
    await expect(rowFor(page, 'Барс')).toHaveCount(0);
    await expect(rowFor(page, 'Шарик')).toContainText('1');
    expect(confirmRequests).toEqual([{ holdId: holdA, ifMatch: '1', idempotencyKey: expect.any(String) }]);
    expect(queueReads).toBeGreaterThanOrEqual(2);
  });
});

test('refreshes queue after retryable confirm conflict without fencing the row', async ({ page, context, baseURL }, testInfo) => {
  confirmMode = 'slot-locked-retry';
  await addClinicSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть очередь перед retryable conflict', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Получить retryable conflict при подтверждении', () => rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click());

  await uiStep(page, testInfo, 'Проверить refresh без fencing строки', async () => {
    await expect(page.getByRole('status')).toContainText('Обновляем состояние заявки.');
    await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
    expect(confirmRequests).toEqual([{ holdId: holdA, ifMatch: '1', idempotencyKey: expect.any(String) }]);
    expect(queueReads).toBeGreaterThanOrEqual(2);
  });
});

test('groups alternative slots by date and preserves selection after retryable conflict', async ({ page, context, baseURL }, testInfo) => {
  alternativeMode = 'slot-locked-retry';
  await addClinicSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть очередь для альтернативного времени', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Открыть drawer альтернативного времени', () => rowFor(page, 'Барс').getByRole('button', { name: 'Другое время' }).click());

  const dialog = page.getByRole('dialog', { name: 'Предложить другое время' });
  await uiStep(page, testInfo, 'Проверить группировку слотов по датам', async () => {
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Старое время')).toBeVisible();
    await expect(dialog.getByText('Новое время')).toBeVisible();
    await expect(dialog.getByRole('tab').filter({ hasText: '2 окон' })).toBeVisible();
    await expect(dialog.getByRole('tab').filter({ hasText: '1 окон' })).toBeVisible();
  });

  await uiStep(page, testInfo, 'Выбрать альтернативный слот и отправить', async () => {
    await expect(dialog.getByTestId(`alternative-slot-${alternativeSlotA}`)).toBeVisible();
    await dialog.getByTestId(`alternative-slot-${alternativeSlotA}`).click();
    await expect(dialog.getByText('Не выбрано')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Предложить' }).click();
  });

  await uiStep(page, testInfo, 'Проверить сохранение выбора после retryable conflict', async () => {
    await expect(dialog.getByRole('alert')).toContainText('Слот обновляется. Загружаем актуальный список.');
    await expect(dialog.getByText('Новое время')).toBeVisible();
    await expect(dialog.getByTestId(`alternative-slot-${alternativeSlotA}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('button', { name: 'Предложить' })).toBeEnabled();
    expect(alternativeRequests).toEqual([{
      holdId: holdA,
      newSlotId: alternativeSlotA,
      ifMatch: '1',
      idempotencyKey: expect.any(String),
    }]);
  });
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
  alternativeMode = 'success';
  sessionMode = 'allowed';
  queueReads = 0;
  confirmRequests = [];
  alternativeRequests = [];
}

function handleBackendRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${mockBackendPort}`}`);
  const queuePath = `/v1/clinic/${clinicId}/locations/${locationId}/booking-queue`;
  const slotsPath = `/v1/clinic-locations/${locationId}/slots`;
  if (request.method === 'GET' && url.pathname === '/v1/auth/session') {
    if (sessionMode === 'error') {
      sendJson(response, 503, { code: 'SESSION_UNAVAILABLE' });
      return;
    }
    sendJson(response, 200, {
      subjectId: 'clinic-user-e2e',
      roles: ['CLINIC_RECEPTIONIST'],
      effectiveCapabilities: sessionMode === 'allowed' ? ['booking.queue.read'] : [],
      clinicScopes: [{ clinicId, locationId }],
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === queuePath) {
    queueReads += 1;
    sendJson(response, 200, { clinicId, locationId, serverNow, items });
    return;
  }

  if (request.method === 'GET' && url.pathname === slotsPath) {
    sendJson(response, 200, makeAvailableSlots());
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

  const alternativeMatch = url.pathname.match(/^\/v1\/clinic\/booking-holds\/([^/]+)\/alternative-slot$/);
  if (request.method === 'POST' && alternativeMatch) {
    collectBody(request).then((rawBody) => {
      const body = rawBody ? JSON.parse(rawBody) as { newSlotId?: string } : {};
      alternativeRequests.push({
        holdId: alternativeMatch[1],
        newSlotId: body.newSlotId ?? '',
        ifMatch: headerValue(request, 'if-match'),
        idempotencyKey: headerValue(request, 'idempotency-key'),
      });
      if (alternativeMode === 'slot-locked-retry') {
        sendJson(response, 409, { code: 'SLOT_LOCKED_RETRY' });
        return;
      }
      items = items.filter((item) => item.holdId !== alternativeMatch[1]);
      sendJson(response, 200, { holdId: alternativeMatch[1], state: 'ALTERNATIVE_PENDING' });
    }).catch(() => sendJson(response, 400, { code: 'INVALID_REQUEST' }));
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

function makeAvailableSlots() {
  const base = Date.parse(serverNow);
  const slot = (id: string, minutes: number) => ({
    id,
    starts_at: new Date(base + minutes * 60_000).toISOString(),
    ends_at: new Date(base + (minutes + 30) * 60_000).toISOString(),
    capacity: 1,
    booked_count: 0,
    held_count: 0,
    remaining_capacity: '1',
  });
  return [
    slot(alternativeSlotA, 22 * 60),
    slot(alternativeSlotB, 23 * 60),
    slot(alternativeSlotC, 46 * 60),
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
