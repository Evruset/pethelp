import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const otherClinicId = '33333333-3333-4333-8333-333333333333';
const holdId = '44444444-4444-4444-8444-444444444444';
const port = 3212; const secret = 'clinic-e2e-secret-at-least-32-bytes';
let server: Server; let mode: 'allowed' | 'denied' | 'wrong-scope' | 'backend-deny' = 'allowed'; let reads = 0; let listReads = 0; let detailReads = 0; let payloadOverride: unknown;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { server = createServer(handle); await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve)); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(() => { mode = 'allowed'; reads = 0; listReads = 0; detailReads = 0; payloadOverride = undefined; });

test('allowed scope exposes navigation, list and keyboard detail/back flow', async ({ page, context, baseURL }) => {
  await session(context, baseURL); await page.goto(listRoute());
  await expect(page.getByRole('link', { name: 'Открыть приёмы врача' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Приёмы врача' })).toBeVisible();
  await expect(page.getByText('Milo · CAT')).toBeVisible();
  await page.getByRole('link', { name: 'Открыть приём Milo' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Milo' })).toBeVisible();
  await expect(page.getByText('Приём завершён или действие недоступно.')).toBeVisible();
  await expect(page.getByRole('button', { name: /заверш/i })).toHaveCount(0);
  await page.getByRole('link', { name: 'К списку приёмов' }).click(); await expect(page.getByRole('heading', { name: 'Приёмы врача' })).toBeVisible();
  expect(listReads).toBeGreaterThanOrEqual(2);
  expect(detailReads).toBe(1);
  expect((await new AxeBuilder({ page }).include('[aria-labelledby="vet-visits-title"]').analyze()).violations).toEqual([]);
});

async function expectFailClosed(sessionMode: 'denied' | 'wrong-scope', page: import('@playwright/test').Page, context: BrowserContext, baseURL: string | undefined) {
  mode = sessionMode; await session(context, baseURL); await page.goto(listRoute());
  await expect(page.getByRole('link', { name: 'Открыть приёмы врача' })).toHaveCount(0);
  await expect(page.getByText('Раздел недоступен').first()).toBeVisible(); expect(reads).toBe(0);
}
test('denied session hides navigation and makes no protected request', async ({ page, context, baseURL }) => expectFailClosed('denied', page, context, baseURL));
test('wrong-scope session hides navigation and makes no protected request', async ({ page, context, baseURL }) => expectFailClosed('wrong-scope', page, context, baseURL));

test('malformed holdId is rejected before the detail upstream request', async ({ page, context, baseURL }) => {
  await session(context, baseURL); await page.goto(`${listRoute()}/not-a-uuid`);
  await expect(page.getByRole('heading', { name: 'Приёмы сейчас недоступны' })).toBeVisible();
  expect(detailReads).toBe(0);
});

test('backend denial is normalized for list and detail', async ({ page, context, baseURL }) => {
  mode = 'backend-deny'; await session(context, baseURL); await page.goto(listRoute());
  await expect(page.getByRole('heading', { name: 'Приёмы сейчас недоступны' })).toBeVisible();
  await page.goto(detailRoute()); await expect(page.getByRole('heading', { name: 'Приёмы сейчас недоступны' })).toBeVisible();
  await expect(page.getByText(/capability|membership|CLINIC_SCOPE/i)).toHaveCount(0);
});

test('runtime parser accepts approved values and fails closed for malformed HTTP 200 DTOs', async ({ page, context, baseURL }) => {
  for (const valid of [visit({ status: 'CONFIRMED' }), visit({ status: 'COMPLETED', scheduledStart: '2026-07-12T13:00:00+03:00', scheduledEnd: '2026-07-12T13:30:00+03:00' })]) {
    payloadOverride = [valid]; await session(context, baseURL); await page.goto(listRoute()); await expect(page.getByText('Milo · CAT')).toBeVisible();
  }
  const missing = visit(); delete (missing as Record<string, unknown>).species;
  for (const invalid of [
    visit({ status: 'PENDING' }), visit({ status: 'confirmed' }), visit({ status: '' }), visit({ status: 'UNKNOWN' }),
    visit({ scheduledStart: 'not-a-date' }), visit({ scheduledStart: '2026-99-99T10:00:00Z' }), visit({ scheduledStart: '2026-07-12' }), visit({ scheduledStart: '2026-07-12T10:00:00' }), visit({ scheduledStart: '' }), visit({ scheduledStart: 123 }),
    { ...visit(), extra: 'unexpected' }, missing,
  ]) { payloadOverride = [invalid]; await session(context, baseURL); await page.goto(listRoute()); await expect(page.getByRole('heading', { name: 'Не удалось получить приёмы' })).toBeVisible(); await expect(page.getByText('Milo · CAT')).toHaveCount(0); }
  payloadOverride = visit({ status: 'PENDING' }); await session(context, baseURL); await page.goto(detailRoute()); await expect(page.getByRole('heading', { name: 'Не удалось получить приёмы' })).toBeVisible(); await expect(page.getByText('PENDING')).toHaveCount(0);
});

function listRoute() { return `/clinics/${clinicId}/locations/${locationId}/vet/visits`; }
function detailRoute() { return `${listRoute()}/${holdId}`; }
async function session(context: BrowserContext, baseURL: string | undefined) {
  if (!baseURL) throw new Error('baseURL required');
  const token = await new SignJWT({ roles: ['CLINIC_VETERINARIAN'], clinicIds: [clinicId], locationIds: [locationId] }).setProtectedHeader({ alg: 'HS256' }).setSubject('vet-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
  await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}
function handle(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${port}`}`);
  if (url.pathname === '/v1/auth/session') return json(response, 200, { subjectId: 'vet-user', roles: ['CLINIC_VETERINARIAN'], effectiveCapabilities: mode === 'allowed' || mode === 'backend-deny' ? ['clinical.visit.workspace.read'] : [], clinicScopes: [{ clinicId: mode === 'wrong-scope' ? otherClinicId : clinicId, locationId }] });
  if (url.pathname === `/v1/clinic/${clinicId}/locations/${locationId}/vet/visits` || url.pathname === `/v1/clinic/${clinicId}/locations/${locationId}/vet/visits/${holdId}`) { reads += 1; if (url.pathname.endsWith(holdId)) detailReads += 1; else listReads += 1; if (mode === 'backend-deny') return json(response, 403, { code: 'CLINIC_SCOPE_MISMATCH' }); return json(response, 200, payloadOverride ?? (url.pathname.endsWith(holdId) ? visit() : [visit()])); }
  return json(response, 404, { code: 'NOT_FOUND' });
}
function visit(overrides: Record<string, unknown> = {}) { return { holdId, clinicId, locationId, scheduledStart: '2026-07-12T10:00:00.000Z', scheduledEnd: '2026-07-12T10:30:00.000Z', status: 'CONFIRMED', petDisplayName: 'Milo', species: 'CAT', ...overrides }; }
function json(response: import('node:http').ServerResponse, status: number, body: unknown) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); }
