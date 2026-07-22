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
const evidenceDir = process.env.V50_SHELL_EVIDENCE_DIR;
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
  latestAudit?: { action: string; occurredAt: string; actorType: string } | null;
};

type ConfirmMode = 'success' | 'slot-locked-retry' | 'denied-once' | 'server-error-once';
type AlternativeMode = 'success' | 'slot-locked-retry';

let server: Server;
let items: QueueItem[] = [];
let confirmMode: ConfirmMode = 'success';
let alternativeMode: AlternativeMode = 'success';
let sessionMode: 'allowed' | 'denied' | 'error' = 'allowed';
let queueFailures = 0;
let holdQueueResponse = false;
let releaseQueue: (() => void) | undefined;
let queueReads = 0;
let confirmRequests: Array<{ holdId: string; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];
let alternativeRequests: Array<{ holdId: string; newSlotId: string; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];
let declineRequests: Array<{ holdId: string; declineReason: string; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];
let notesRequests: Array<{ holdId: string; noteRequest: string; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];

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
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-loading.png`, fullPage: true });
  releaseSession?.();
  await expect(page.getByText('Доступ к capability-разделам недоступен. Повторить').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Повторить' }).first()).toBeVisible();
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-error-retry.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).include('.vh-clinic-nav').analyze()).violations).toEqual([]);
});

test('redirects unauthenticated clinic users to forbidden', async ({ page }, testInfo) => {
  await uiStep(page, testInfo, 'Открыть очередь без сессии', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Проверить запрет доступа без сессии', async () => {
    await expect(page).toHaveURL(/\/forbidden\?reason=session_required$/);
    await expect(page.getByText('403 Access Denied').first()).toBeVisible();
    if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-session-missing-forbidden.png`, fullPage: true });
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
    if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-queue-desktop.png`, fullPage: true });
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

test('declines with a required reason and refreshes the authoritative queue', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' }).click();
  const dialog = page.getByRole('dialog', { name: 'Отклонить заявку' });
  const submit = dialog.getByRole('button', { name: 'Отклонить заявку' });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('Причина отклонения').fill('Врач недоступен в выбранное время');
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-decline-dialog.png`, fullPage: true });
  await submit.click();
  await expect(page.getByRole('status')).toContainText('Заявка отклонена, слот освобождён. Очередь обновлена.');
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  expect(declineRequests).toEqual([{
    holdId: holdA,
    declineReason: 'Врач недоступен в выбранное время',
    ifMatch: '1',
    idempotencyKey: expect.any(String),
  }]);
});

test('requests notes once and keeps the authoritative updated row', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Уточнения' }).click();
  const dialog = page.getByRole('dialog', { name: 'Запросить уточнения' });
  await dialog.getByLabel('Что нужно уточнить у владельца').fill('Подтвердите дату вакцинации');
  await dialog.getByRole('button', { name: 'Запросить' }).click();
  await expect(page.getByRole('status')).toContainText('Запрос уточнений отправлен владельцу. Очередь обновлена.');
  await expect(rowFor(page, 'Барс')).toContainText('Запрошены уточнения');
  expect(notesRequests).toEqual([{
    holdId: holdA,
    noteRequest: 'Подтвердите дату вакцинации',
    ifMatch: '1',
    idempotencyKey: expect.any(String),
  }]);
});

test('keeps the last snapshot visibly degraded and recovers without overlapping refreshes', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  queueFailures = 1;
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByText(/Нет соединения · данные на/)).toBeVisible();
  await expect(rowFor(page, 'Барс')).toBeVisible();
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Ожидает очередь' })).toBeDisabled();
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-queue-degraded.png`, fullPage: true });
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByText('Синхронизировано')).toBeVisible();
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();

  const readsBeforePending = queueReads;
  holdQueueResponse = true;
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect.poll(() => queueReads).toBe(readsBeforePending + 1);
  await page.getByRole('button', { name: 'Обновить' }).click();
  await page.waitForTimeout(100);
  expect(queueReads).toBe(readsBeforePending + 1);
  releaseQueue?.();
  await expect(page.getByText('Синхронизировано')).toBeVisible();
});

test('queues an authoritative readback behind a stale in-flight poll after command success', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  const readsBefore = queueReads;
  let routeReads = 0;
  let releaseStale: (() => void) | undefined;
  const staleReleased = new Promise<void>((resolve) => { releaseStale = resolve; });
  await page.route('**/api/clinic/**/booking-queue', async (route) => {
    routeReads += 1;
    if (routeReads === 1) {
      await staleReleased;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clinicId, locationId, serverNow, items: makeQueueItems() }) });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect.poll(() => routeReads).toBe(1);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect.poll(() => confirmRequests.length).toBe(1);
  await expect(page.getByRole('status')).toContainText('Запись подтверждена. Очередь обновлена.');
  releaseStale?.();
  await expect.poll(() => routeReads).toBe(2);
  await expect.poll(() => queueReads).toBe(readsBefore + 1);
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
});

test('refreshes immediately on visibility recovery after a missed hidden-tab update', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  const readsBefore = queueReads;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window as any).__queueVisibility });
    (window as any).__queueVisibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  expect(queueReads).toBe(readsBefore);
  items = items.filter((item) => item.holdId !== holdA);
  await page.evaluate(() => {
    (window as any).__queueVisibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => queueReads).toBe(readsBefore + 1);
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
});

test('rejects malformed, wrong-scope and duplicate queue payloads without replacing the last snapshot', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  const payloads = [
    { clinicId, locationId, serverNow, items: [{ holdId: holdA }] },
    { clinicId: forbiddenLocationId, locationId, serverNow, items: [] },
    { clinicId, locationId, serverNow, items: [items[0], items[0]] },
  ];
  await page.route('**/api/clinic/**/booking-queue', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payloads.shift()) });
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole('button', { name: 'Обновить' }).click();
    await expect(page.getByText(/Нет соединения · данные на/)).toBeVisible();
    await expect(rowFor(page, 'Барс')).toBeVisible();
  }
  await page.unroute('**/api/clinic/**/booking-queue');
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByText('Синхронизировано')).toBeVisible();
});

for (const [mode, reusesKey, message] of [
  ['denied-once', false, 'Не удалось подтвердить запись.'],
  ['server-error-once', true, 'Не удалось подтвердить запись.'],
] as const) {
test(`handles ${mode} safely and applies the idempotency policy on explicit retry`, async ({ page, context, baseURL }) => {
  confirmMode = mode;
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('status')).toContainText(message);
  await expect(rowFor(page, 'Барс')).toBeVisible();
  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  expect(confirmRequests).toHaveLength(2);
  if (reusesKey) expect(confirmRequests[1].idempotencyKey).toBe(confirmRequests[0].idempotencyKey);
  else expect(confirmRequests[1].idempotencyKey).not.toBe(confirmRequests[0].idempotencyKey);
});
}

test('keeps critical queue actions keyboard-accessible at tablet width', async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  const confirm = rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' });
  await confirm.scrollIntoViewIfNeeded();
  await confirm.focus();
  await expect(confirm).toBeFocused();
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-queue-tablet.png`, fullPage: true });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Запись подтверждена. Очередь обновлена.');
  expect(confirmRequests).toHaveLength(1);
});

test('proposes an alternative with version fencing and removes the row after authoritative readback', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Другое время' }).click();
  const dialog = page.getByRole('dialog', { name: 'Предложить другое время' });
  await dialog.getByTestId(`alternative-slot-${alternativeSlotA}`).click();
  await dialog.getByRole('button', { name: 'Предложить' }).click();
  await expect(page.getByRole('status')).toContainText('Альтернативное время отправлено владельцу.');
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  expect(alternativeRequests).toEqual([{
    holdId: holdA,
    newSlotId: alternativeSlotA,
    ifMatch: '1',
    idempotencyKey: expect.any(String),
  }]);
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
    if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-stale-conflict.png`, fullPage: true });
  });

  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect.poll(() => confirmRequests.length).toBe(2);
  expect(confirmRequests[1].idempotencyKey).not.toBe(confirmRequests[0].idempotencyKey);
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
  queueFailures = 0;
  holdQueueResponse = false;
  releaseQueue = undefined;
  queueReads = 0;
  confirmRequests = [];
  alternativeRequests = [];
  declineRequests = [];
  notesRequests = [];
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
    if (queueFailures > 0) {
      queueFailures -= 1;
      sendJson(response, 503, { code: 'BACKEND_UNAVAILABLE' });
      return;
    }
    if (holdQueueResponse) {
      holdQueueResponse = false;
      const snapshot = items.map((queueItem) => ({ ...queueItem }));
      releaseQueue = () => sendJson(response, 200, { clinicId, locationId, serverNow, items: snapshot });
      return;
    }
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
    if (confirmMode === 'denied-once') {
      confirmMode = 'success';
      sendJson(response, 403, { code: 'LOCATION_SCOPE_DENIED', evaluator: 'private' });
      return;
    }
    if (confirmMode === 'server-error-once') {
      confirmMode = 'success';
      sendJson(response, 503, { code: 'BACKEND_UNAVAILABLE', detail: 'private' });
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

  const declineMatch = url.pathname.match(/^\/v1\/clinic\/booking-holds\/([^/]+)\/decline$/);
  if (request.method === 'POST' && declineMatch) {
    collectBody(request).then((rawBody) => {
      const body = rawBody ? JSON.parse(rawBody) as { declineReason?: string } : {};
      declineRequests.push({
        holdId: declineMatch[1],
        declineReason: body.declineReason ?? '',
        ifMatch: headerValue(request, 'if-match'),
        idempotencyKey: headerValue(request, 'idempotency-key'),
      });
      items = items.filter((item) => item.holdId !== declineMatch[1]);
      sendJson(response, 200, { holdId: declineMatch[1], state: 'RELEASED' });
    }).catch(() => sendJson(response, 400, { code: 'INVALID_REQUEST' }));
    return;
  }

  const notesMatch = url.pathname.match(/^\/v1\/clinic\/booking-holds\/([^/]+)\/request-notes$/);
  if (request.method === 'POST' && notesMatch) {
    collectBody(request).then((rawBody) => {
      const body = rawBody ? JSON.parse(rawBody) as { noteRequest?: string } : {};
      notesRequests.push({
        holdId: notesMatch[1],
        noteRequest: body.noteRequest ?? '',
        ifMatch: headerValue(request, 'if-match'),
        idempotencyKey: headerValue(request, 'idempotency-key'),
      });
      items = items.map((queueItem) => queueItem.holdId === notesMatch[1]
        ? { ...queueItem, version: 2, latestAudit: { action: 'booking.notes.requested', occurredAt: serverNow, actorType: 'CLINIC_EMPLOYEE' } }
        : queueItem);
      sendJson(response, 200, { holdId: notesMatch[1], state: 'MANUAL_CONFIRM_PENDING', version: 2 });
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
