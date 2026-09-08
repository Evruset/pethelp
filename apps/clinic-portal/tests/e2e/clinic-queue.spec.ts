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

type ConfirmMode = 'success' | 'slot-locked-retry' | 'state-conflict' | 'expired' | 'malformed-success' | 'denied-once' | 'server-error-once';
type AlternativeMode = 'success' | 'slot-locked-retry';
type DeclineMode = 'success' | 'slot-locked-retry' | 'delayed-success';

let server: Server;
let items: QueueItem[] = [];
let confirmMode: ConfirmMode = 'success';
let alternativeMode: AlternativeMode = 'success';
let declineMode: DeclineMode = 'success';
let sessionMode: 'allowed' | 'denied' | 'error' = 'allowed';
let queueFailures = 0;
let holdQueueResponse = false;
let releaseQueue: (() => void) | undefined;
let queueReads = 0;
let confirmRequests: Array<{ holdId: string; ifMatch: string | undefined; idempotencyKey: string | undefined; correlationId: string | undefined }> = [];
let alternativeRequests: Array<{ holdId: string; newSlotId: string; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];
let declineRequests: Array<{ holdId: string; declineReason: string; ifMatch: string | undefined; idempotencyKey: string | undefined; correlationId: string | undefined }> = [];
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
    await expect(page.getByText('403 Access Denied').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Нет доступа к этой локации', exact: true }).first()).toBeVisible();
    expect(queueReads).toBe(0);
  });
});

test('renders backend FIFO order and SLA risk state from serverNow', async ({ page, context, baseURL }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await addClinicSession(context, baseURL);

  await uiStep(page, testInfo, 'Открыть очередь подтверждений', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Проверить FIFO и SLA-риск', async () => {
    await expect(rowFor(page, 'Барс')).toContainText('1');
    await expect(rowFor(page, 'Шарик')).toContainText('2');
    await expect(rowFor(page, 'Марта')).toContainText('3');
    await expect(rowFor(page, 'Барс')).toContainText('SLA критично');
    await expect(rowFor(page, 'Барс')).toContainText('Статус: ожидает решения клиники');
    await expect(rowFor(page, 'Барс')).toContainText('Внимание: срок подтверждения истекает.');
    await expect(rowFor(page, 'Шарик')).toContainText('SLA в норме');
    await expect(rowFor(page, 'Шарик')).toContainText('Сначала обработайте более раннюю активную заявку.');
    await expect(rowFor(page, 'Марта')).toContainText('Сначала обработайте более раннюю активную заявку.');
    await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
    await expect(rowFor(page, 'Шарик').getByRole('button', { name: 'Ожидает очередь' })).toBeDisabled();
    if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-normal-1440x900.png`, fullPage: false });
  });
});

test('keeps an expired-but-not-transitioned MANUAL_CONFIRM_PENDING fixture in authoritative position', async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  items[0] = { ...items[0], confirmationSlaExpiresAt: '2026-06-25T11:59:59.000Z' };
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await expect(rowFor(page, 'Барс')).toContainText('1');
  await expect(rowFor(page, 'Барс')).toContainText('SLA просрочен');
  await expect(rowFor(page, 'Барс')).toContainText('Срок истёк: действия недоступны');
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Недоступно' })).toBeDisabled();
  await expect(rowFor(page, 'Шарик')).toContainText('2');
  await expect(rowFor(page, 'Шарик').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
  await rowFor(page, 'Барс').evaluate((element) => {
    const container = element.closest('table')?.parentElement;
    if (!container) throw new Error('QUEUE_SCROLL_CONTAINER_NOT_FOUND');
    container.scrollLeft = container.scrollWidth;
  });
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-expired-390x844.png`, fullPage: false });
});

test('renders warning, critical and urgent SLA bands from the calibrated server clock', async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  items = [
    { ...items[0], pet: { ...items[0].pet, name: 'Предупреждение' }, confirmationSlaExpiresAt: '2026-06-25T12:04:00.000Z' },
    { ...items[1], pet: { ...items[1].pet, name: 'Критично' }, confirmationSlaExpiresAt: '2026-06-25T12:02:00.000Z' },
    { ...items[2], pet: { ...items[2].pet, name: 'Срочно' }, confirmationSlaExpiresAt: '2026-06-25T12:00:30.000Z' },
  ];
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await expect(rowFor(page, 'Предупреждение')).toContainText('SLA скоро истечёт');
  await expect(rowFor(page, 'Критично')).toContainText('SLA критично');
  await expect(rowFor(page, 'Срочно')).toContainText('SLA срочно');
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-sla-bands-1024x768.png`, fullPage: false });
});

test('presents not-applicable and unknown SLA explicitly without relying on color', async ({ page, context, baseURL }) => {
  items = [
    { ...items[0], pet: { ...items[0].pet, name: 'Без SLA' }, confirmationSlaExpiresAt: null as unknown as string },
    { ...items[1], pet: { ...items[1].pet, name: 'Неизвестный SLA' }, confirmationSlaExpiresAt: 'not-a-timestamp' },
  ];
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await expect(rowFor(page, 'Без SLA')).toContainText('SLA не применим');
  await expect(rowFor(page, 'Неизвестный SLA')).toContainText('SLA неизвестен');
});

test('uses one shared UI clock, preserves row order locally and accepts authoritative clock correction', async ({ page, context, baseURL }) => {
  items[0] = { ...items[0], confirmationSlaExpiresAt: '2026-06-25T12:00:01.000Z' };
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);

  await page.waitForTimeout(2_100);
  await expect(rowFor(page, 'Барс')).toContainText('SLA просрочен');
  await expect(rowFor(page, 'Барс')).toContainText('1');
  await expect(rowFor(page, 'Шарик')).toContainText('2');

  let correctedReads = 0;
  await page.route('**/booking-queue', (route) => {
    correctedReads += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ clinicId, locationId, serverNow: '2026-06-25T12:09:00.000Z', items }),
    });
  });
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect.poll(() => correctedReads).toBe(1);
  await expect(rowFor(page, 'Шарик')).toContainText(/SLA (критично|срочно)/);
  await expect(rowFor(page, 'Барс')).toContainText('1');
});

test('recomputes SLA immediately when a hidden tab becomes visible', async ({ page, context, baseURL }) => {
  items[0] = { ...items[0], confirmationSlaExpiresAt: '2026-06-25T12:00:01.000Z' };
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window as any).__queueVisibility });
    (window as any).__queueVisibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(2_100);
  queueFailures = 1;
  await page.evaluate(() => {
    (window as any).__queueVisibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(rowFor(page, 'Барс')).toContainText('SLA просрочен');
});

test('confirms the first actionable hold and refreshes authoritative queue', async ({ page, context, baseURL }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await addClinicSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть очередь с первой actionable заявкой', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Подтвердить первую заявку', () => rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click());

  await uiStep(page, testInfo, 'Проверить обновлённую authoritative очередь', async () => {
    await expect(page.getByRole('status')).toContainText('Запись подтверждена. Очередь обновлена.');
    await expect(rowFor(page, 'Барс')).toHaveCount(0);
    await expect(rowFor(page, 'Шарик')).toContainText('1');
    expect(confirmRequests).toEqual([{ holdId: holdA, ifMatch: '1', idempotencyKey: expect.any(String), correlationId: expect.any(String) }]);
    expect(queueReads).toBeGreaterThanOrEqual(2);
    if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-confirm-readback-768x1024.png`, fullPage: false });
  });
});

test('declines after an explicit destructive confirmation without collecting free text', async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' }).click();
  const dialog = page.getByRole('dialog', { name: 'Отклонить заявку' });
  const submit = dialog.getByRole('button', { name: 'Отклонить заявку' });
  await expect(submit).toBeEnabled();
  await expect(submit).toBeFocused();
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(submit).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' })).toBeFocused();
  await rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' }).click();
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-decline-dialog-1440x900.png`, fullPage: false });
  await page.getByRole('dialog', { name: 'Отклонить заявку' }).getByRole('button', { name: 'Отклонить заявку' }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole('status')).toContainText('Заявка отклонена, слот освобождён. Очередь обновлена.');
  await expect(page.getByRole('status')).toBeFocused();
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-reject-readback-1440x900.png`, fullPage: false });
  expect(declineRequests).toEqual([{
    holdId: holdA,
    declineReason: '',
    ifMatch: '1',
    idempotencyKey: expect.any(String),
    correlationId: expect.any(String),
  }]);
});

test('keeps focus inside the decline dialog while the command is submitting', async ({ page, context, baseURL }) => {
  declineMode = 'delayed-success';
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' }).click();
  const dialog = page.getByRole('dialog', { name: 'Отклонить заявку' });
  await dialog.getByRole('button', { name: 'Отклонить заявку' }).click();
  await expect(dialog.locator('section')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('section')).toBeFocused();
  await expect(page.getByRole('status')).toBeFocused();
});

test('disables an open decline decision after authoritative deadline invalidation', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' }).click();
  items[0] = { ...items[0], confirmationSlaExpiresAt: '2026-06-25T11:59:59.000Z' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const dialog = page.getByRole('dialog', { name: 'Отклонить заявку' });
  await expect(dialog.getByRole('button', { name: 'Решение недоступно' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused();
  expect(declineRequests).toHaveLength(0);
});

test('keeps a pending row actionable after retryable decline lock conflict and authoritative refresh', async ({ page, context, baseURL }) => {
  declineMode = 'slot-locked-retry';
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' }).click();
  await page.getByRole('dialog', { name: 'Отклонить заявку' }).getByRole('button', { name: 'Отклонить заявку' }).click();
  await expect(page.getByRole('status')).toContainText('Обновляем состояние заявки. Отклонение можно повторить.');
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' })).toBeEnabled();
  expect(declineRequests).toHaveLength(1);

  declineMode = 'success';
  await rowFor(page, 'Барс').getByRole('button', { name: 'Отклонить' }).click();
  await page.getByRole('dialog', { name: 'Отклонить заявку' }).getByRole('button', { name: 'Отклонить заявку' }).click();
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  expect(declineRequests).toHaveLength(2);
  expect(declineRequests[1].idempotencyKey).not.toBe(declineRequests[0].idempotencyKey);
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
  await page.setViewportSize({ width: 390, height: 844 });
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  queueFailures = 1;
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByText(/Нет соединения · данные на/)).toBeVisible();
  await expect(rowFor(page, 'Барс')).toBeVisible();
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Ожидает очередь' })).toBeDisabled();
  await page.locator('table').locator('..').evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-degraded-390x844.png`, fullPage: false });
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
  releaseStale?.();
  await expect(page.getByRole('status')).toContainText('Запись подтверждена. Очередь обновлена.');
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
    { clinicId, locationId, serverNow, items: [{ ...items[0], confirmationSlaExpiresAt: '2026-02-30T12:00:00.000Z' }] },
  ];
  await page.route('**/api/clinic/**/booking-queue', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payloads.shift()) });
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.getByRole('button', { name: 'Обновить' }).click();
    await expect(page.getByText(/Нет соединения · данные на/)).toBeVisible();
    await expect(rowFor(page, 'Барс')).toBeVisible();
  }
  await page.unroute('**/api/clinic/**/booking-queue');
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByText('Синхронизировано')).toBeVisible();
});

test('fails closed when backend command authority is denied', async ({ page, context, baseURL }) => {
  confirmMode = 'denied-once';
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page).toHaveURL(/\/forbidden\?reason=scope_denied$/);
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  expect(confirmRequests).toHaveLength(1);
});

test('reuses the idempotency key when retrying a technical confirm failure', async ({ page, context, baseURL }) => {
  confirmMode = 'server-error-once';
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('status')).toContainText('Сервис временно недоступен. Очередь обновлена — действие можно повторить.');
  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  expect(confirmRequests).toHaveLength(2);
  expect(confirmRequests[1].idempotencyKey).toBe(confirmRequests[0].idempotencyKey);
});

test('recovers a fenced pending row only after a successful authoritative refresh', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.route('**/api/clinic/booking-holds/*/confirm', async (route) => route.abort('connectionfailed'));
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('status')).toContainText('Нет связи с VetHelp. Действия заблокированы до авторитетного обновления.');
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Недоступно' })).toBeDisabled();
  await page.unroute('**/api/clinic/booking-holds/*/confirm');
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByText('Синхронизировано')).toBeVisible();
  await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
});

test('submits only one confirm command for a rapid duplicate click', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  const confirm = rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' });
  await confirm.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(rowFor(page, 'Барс')).toHaveCount(0);
  expect(confirmRequests).toHaveLength(1);
});

for (const [mode, message] of [
  ['state-conflict', 'Другой сотрудник уже обработал заявку. Данные обновлены.'],
  ['expired', 'Срок заявки истёк. Решение больше недоступно.'],
] as const) {
  test(`fails closed for authoritative ${mode} and removes decision controls`, async ({ page, context, baseURL }) => {
    confirmMode = mode;
    await addClinicSession(context, baseURL);
    await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
    await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByRole('status')).toContainText(message);
    await expect(rowFor(page, 'Барс')).toHaveCount(0);
  });
}

test('rejects a malformed success response and preserves the last valid queue snapshot', async ({ page, context, baseURL }) => {
  confirmMode = 'malformed-success';
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('status')).toContainText('Сервис временно недоступен. Очередь обновлена — действие можно повторить.');
  await expect(rowFor(page, 'Барс')).toBeVisible();
});

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

test('keeps the queue contained at 390px with 200 percent root text', async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addClinicSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect(rowFor(page, 'Барс')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
  await page.setViewportSize({ width: 1024, height: 768 });
  confirmMode = 'slot-locked-retry';
  await addClinicSession(context, baseURL);
  await uiStep(page, testInfo, 'Открыть очередь перед retryable conflict', () => page.goto(`/clinics/${clinicId}/locations/${locationId}/queue`));

  await uiStep(page, testInfo, 'Получить retryable conflict при подтверждении', () => rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' }).click());

  await uiStep(page, testInfo, 'Проверить refresh без fencing строки', async () => {
    await expect(page.getByRole('status')).toContainText('Обновляем состояние заявки.');
    await expect(rowFor(page, 'Барс').getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
    expect(confirmRequests).toEqual([{ holdId: holdA, ifMatch: '1', idempotencyKey: expect.any(String), correlationId: expect.any(String) }]);
    expect(queueReads).toBeGreaterThanOrEqual(2);
    if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/portal-stale-conflict-1024x768.png`, fullPage: false });
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
  declineMode = 'success';
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
    const currentItem = items.find((queueItem) => queueItem.holdId === holdId);
    confirmRequests.push({
      holdId,
      ifMatch: headerValue(request, 'if-match'),
      idempotencyKey: headerValue(request, 'idempotency-key'),
      correlationId: headerValue(request, 'x-correlation-id'),
    });
    if (confirmMode === 'slot-locked-retry') {
      sendJson(response, 409, { code: 'SLOT_LOCKED_RETRY' });
      return;
    }
    if (confirmMode === 'state-conflict') {
      items = items.filter((item) => item.holdId !== holdId);
      sendJson(response, 409, { code: 'BOOKING_STATE_CONFLICT', detail: 'private' });
      return;
    }
    if (confirmMode === 'expired') {
      items = items.filter((item) => item.holdId !== holdId);
      sendJson(response, 422, { code: 'HOLD_EXPIRED', internalState: 'EXPIRED' });
      return;
    }
    if (confirmMode === 'malformed-success') {
      sendJson(response, 200, { ...decisionResult(holdId, currentItem?.slot.id ?? '', 'CONFIRMED'), lastUpdatedAt: '2026-02-30T12:00:00.000Z' });
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
    sendJson(response, 200, decisionResult(holdId, currentItem?.slot.id ?? '', 'CONFIRMED'));
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
      const currentItem = items.find((queueItem) => queueItem.holdId === declineMatch[1]);
      declineRequests.push({
        holdId: declineMatch[1],
        declineReason: body.declineReason ?? '',
        ifMatch: headerValue(request, 'if-match'),
        idempotencyKey: headerValue(request, 'idempotency-key'),
        correlationId: headerValue(request, 'x-correlation-id'),
      });
      if (declineMode === 'slot-locked-retry') {
        sendJson(response, 409, { code: 'SLOT_LOCKED_RETRY' });
        return;
      }
      const complete = () => {
        items = items.filter((item) => item.holdId !== declineMatch[1]);
        sendJson(response, 200, decisionResult(declineMatch[1], currentItem?.slot.id ?? '', 'REJECTED'));
      };
      if (declineMode === 'delayed-success') setTimeout(complete, 300);
      else complete();
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

function decisionResult(holdId: string, slotId: string, status: 'CONFIRMED' | 'REJECTED') {
  return {
    holdId,
    slotId,
    status,
    aggregateVersion: 2,
    lastUpdatedAt: serverNow,
    serverNow,
    correlationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ...(status === 'CONFIRMED' ? { appointmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } : {}),
  };
}
