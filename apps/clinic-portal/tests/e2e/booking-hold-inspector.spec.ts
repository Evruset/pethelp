import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const holdA = '44444444-4444-4444-8444-444444444444';
const holdB = '55555555-5555-4555-8555-555555555555';
const slotA = '66666666-6666-4666-8666-666666666666';
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';
const port = 3212;
const states = { MANUAL_CONFIRM_PENDING: 'Ожидает подтверждения клиникой', MIS_RESERVATION_PENDING: 'Ожидает подтверждения внешней системой', MIS_HELD: 'Слот удерживается', CONFIRMED: 'Запись подтверждена', EXPIRED: 'Срок удержания истёк', RELEASED: 'Удержание освобождено', MIS_BOOKING_FAILED: 'Внешнее бронирование не завершено' } as const;
type Mode = 'success' | 'deny' | 'missing' | 'bad' | 'retry' | 'pending';
let server: Server; let mode: Mode = 'success'; let holdReads = 0; let capabilities = ['booking.queue.read', 'booking.hold.read']; let scopes = [{ clinicId, locationId }]; let state = 'MANUAL_CONFIRM_PENDING'; let release: (() => void) | null = null;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { server = createServer(handle); await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve)); });
test.afterAll(async () => { if (release) release(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(() => { mode = 'success'; holdReads = 0; capabilities = ['booking.queue.read', 'booking.hold.read']; scopes = [{ clinicId, locationId }]; state = 'MANUAL_CONFIRM_PENDING'; release = null; });

test('renders the approved booking hold inspector for an allowed scoped user', async ({ page, context, baseURL }) => {
  await session(context, baseURL); await page.goto(queueUrl()); await page.getByRole('button', { name: 'Состояние удержания' }).first().click();
  await expect(page.getByRole('heading', { name: 'Состояние удержания слота' })).toBeVisible();
  await expect(page.getByText(states.MANUAL_CONFIRM_PENDING)).toBeVisible();
  await expect(page.locator('time[datetime="2026-07-20T10:00:00.000Z"]')).toBeVisible();
  await expect(page.getByText('owner@example.test')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Подтвердить' }).nth(1)).toHaveCount(0);
  expect(holdReads).toBe(1); expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
});

test('suppresses hold reads without capability or exact session scope', async ({ page, context, baseURL }) => {
  for (const setup of [() => { capabilities = ['booking.queue.read']; }, () => { scopes = []; }, () => { scopes = [{ clinicId, locationId: holdB }]; }]) {
    setup(); await session(context, baseURL); await page.goto(queueUrl()); await expect(page.getByRole('button', { name: 'Состояние удержания' })).toHaveCount(0); expect(holdReads).toBe(0); await context.clearCookies();
  }
});

test('maps every published hold state to text without mutation controls', async ({ page, context, baseURL }) => {
  await session(context, baseURL); for (const [value, label] of Object.entries(states)) { state = value; await page.goto(queueUrl()); await page.getByRole('button', { name: 'Состояние удержания' }).first().click(); await expect(page.getByText(label)).toBeVisible(); await expect(page.getByRole('button', { name: 'Повторить' })).toHaveCount(0); await page.getByRole('button', { name: 'Закрыть' }).last().click(); }
  expect(holdReads).toBe(Object.keys(states).length);
});

test('normalizes 401, 403 and 404 without an empty-hold claim', async ({ page, context, baseURL }) => {
  await session(context, baseURL); for (const status of [401, 403, 404]) { mode = status === 404 ? 'missing' : 'deny'; await page.goto(queueUrl()); await page.getByRole('button', { name: 'Состояние удержания' }).first().click(); await expect(page.getByText('Состояние удержания сейчас недоступно.')).toBeVisible(); await expect(page.getByText(/удержания нет/i)).toHaveCount(0); await page.getByRole('button', { name: 'Закрыть' }).last().click(); }
  expect(holdReads).toBe(3);
});

test('fails closed for malformed successful responses', async ({ page, context, baseURL }) => {
  await session(context, baseURL); for (const bad of ['unknown-state', 'bad-time', 'no-zone', 'impossible-date', 'missing', 'extra', 'wrong-type', 'array']) { mode = 'bad'; state = bad; await page.goto(queueUrl()); await page.getByRole('button', { name: 'Состояние удержания' }).first().click(); await expect(page.getByText('Состояние удержания сейчас недоступно.')).toBeVisible(); await expect(page.getByText('owner@example.test')).toHaveCount(0); await page.getByRole('button', { name: 'Закрыть' }).last().click(); }
  expect(holdReads).toBe(8);
});

test('retries a recoverable failure once and disables the pending retry', async ({ page, context, baseURL }) => {
  mode = 'retry'; await session(context, baseURL); await page.goto(queueUrl()); await page.getByRole('button', { name: 'Состояние удержания' }).first().click(); await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  let resolveFulfill: ((fulfill: () => Promise<void>) => void) | undefined; const pendingFulfill = new Promise<() => Promise<void>>((resolve) => { resolveFulfill = resolve; }); let proxyReads = 1;
  await page.route('**/api/booking-holds/**', async (route) => { proxyReads += 1; await new Promise<void>((resolve) => { resolveFulfill?.(async () => { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hold()) }); resolve(); }); }); });
  await page.getByRole('button', { name: 'Повторить' }).click(); await expect(page.getByRole('button', { name: 'Повторная попытка…' })).toBeDisabled(); await page.getByRole('button', { name: 'Повторная попытка…' }).press('Enter'); expect(proxyReads).toBe(2);
  await (await pendingFulfill)(); await expect(page.getByText(states.MANUAL_CONFIRM_PENDING)).toBeVisible();
});

test('aborts closed pending disclosure and keeps the inspector accessible on reopen', async ({ page, context, baseURL }) => {
  mode = 'pending'; await session(context, baseURL); await page.goto(queueUrl()); await page.getByRole('button', { name: 'Состояние удержания' }).first().click(); await expect(page.getByText('Загружаем состояние удержания…')).toBeVisible(); await page.getByRole('button', { name: 'Закрыть' }).last().click(); release?.(); release = null; await expect(page.getByRole('heading', { name: 'Состояние удержания слота' })).toHaveCount(0); mode = 'success'; await page.getByRole('button', { name: 'Состояние удержания' }).first().click(); await expect(page.getByText(states.MANUAL_CONFIRM_PENDING)).toBeVisible(); expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
});

function queueUrl() { return `/clinics/${clinicId}/locations/${locationId}/queue`; }
async function session(context: BrowserContext, baseURL: string | undefined) { if (!baseURL) throw new Error('baseURL required'); const token = await new SignJWT({ roles: ['CLINIC_RECEPTIONIST'], clinicIds: [clinicId], locationIds: [locationId] }).setProtectedHeader({ alg: 'HS256' }).setSubject('clinic-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(jwtSecret)); await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]); }
function hold() { return { holdId: holdA, slotId: slotA, state, expiresAt: '2026-07-20T09:00:00.000Z', clinicLocationId: locationId, startsAt: '2026-07-20T10:00:00.000Z', endsAt: '2026-07-20T10:30:00.000Z' }; }
function json(response: ServerResponse, status: number, body: unknown) { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); }
function handle(request: IncomingMessage, response: ServerResponse) { const path = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname; if (path === '/v1/auth/session') return json(response, 200, { subjectId: 'clinic-user', roles: ['CLINIC_RECEPTIONIST'], effectiveCapabilities: capabilities, clinicScopes: scopes }); if (path === `/v1/clinic/${clinicId}/locations/${locationId}/booking-queue`) return json(response, 200, { clinicId, locationId, serverNow: '2026-07-20T08:00:00.000Z', items: [{ holdId: holdA, version: 1, holdExpiresAt: '2026-07-20T09:00:00.000Z', manualConfirmPendingAt: '2026-07-20T08:00:00.000Z', confirmationSlaExpiresAt: '2026-07-20T09:00:00.000Z', slot: { id: slotA, startsAt: '2026-07-20T10:00:00.000Z', endsAt: '2026-07-20T10:30:00.000Z' }, pet: { id: holdB, name: 'Барс', species: 'cat' }, service: null, latestAudit: null }] }); if (path === `/v1/booking-holds/${holdA}`) { holdReads += 1; if (mode === 'deny') return json(response, 403, { code: 'PRIVATE_REASON' }); if (mode === 'missing') return json(response, 404, { code: 'PRIVATE_REASON' }); if (mode === 'retry') return json(response, 503, { code: 'PRIVATE_REASON' }); if (mode === 'pending') return new Promise<void>((resolve) => { release = () => { if (!response.headersSent && !response.writableEnded) json(response, 200, hold()); resolve(); }; }); if (mode === 'bad') { const value = hold() as Record<string, unknown>; if (state === 'unknown-state') value.state = 'UNKNOWN'; if (state === 'bad-time') value.startsAt = 'bad'; if (state === 'no-zone') value.startsAt = '2026-07-20T10:00:00'; if (state === 'impossible-date') value.startsAt = '2026-02-30T10:00:00.000Z'; if (state === 'missing') delete value.endsAt; if (state === 'extra') value.extra = true; if (state === 'wrong-type') value.holdId = 1; return json(response, 200, state === 'array' ? [value] : value); } return json(response, 200, hold()); } return json(response, 404, { code: 'NOT_FOUND' }); }
