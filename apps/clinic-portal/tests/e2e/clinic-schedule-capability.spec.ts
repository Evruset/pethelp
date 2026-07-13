import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const otherClinicId = '33333333-3333-4333-8333-333333333333';
const port = 3212;
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';
let server: Server;
let sessionMode: 'allowed' | 'denied' | 'wrong-scope' = 'allowed';
let slotReads = 0;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { server = createServer(handleRequest); await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve)); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(() => { sessionMode = 'allowed'; slotReads = 0; });

test('allowed user sees schedule navigation and slots', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL);
  await page.goto(route());
  await expect(page.getByRole('link', { name: 'Открыть расписание' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Расписание локации' })).toBeVisible();
  expect(slotReads).toBe(1);
});

test('denied capability hides navigation and direct URL does not load slots', async ({ page, context, baseURL }) => {
  sessionMode = 'denied';
  await addSession(context, baseURL);
  await page.goto(route());
  await expect(page.getByText('403 Access Denied').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть расписание' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Расписание локации' })).toHaveCount(0);
  expect(slotReads).toBe(0);
});

test('clinic scope mismatch fails closed before the slots request', async ({ page, context, baseURL }) => {
  sessionMode = 'wrong-scope';
  await addSession(context, baseURL);
  await page.goto(route());
  await expect(page.getByText('403 Access Denied').first()).toBeVisible();
  expect(slotReads).toBe(0);
});

test('loading and session error do not flash schedule navigation and offer retry', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL);
  await page.route('**/api/auth/session', async (routeRequest) => { await new Promise((resolve) => setTimeout(resolve, 150)); await routeRequest.fulfill({ status: 503, body: '{"code":"SESSION_UNAVAILABLE"}' }); });
  await page.goto(route());
  await expect(page.getByText('Загрузка доступа…').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть расписание' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Повторить' }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.vh-clinic-nav').analyze()).violations).toEqual([]);
});

function route() { return `/clinics/${clinicId}/locations/${locationId}/schedule`; }
async function addSession(context: BrowserContext, baseURL: string | undefined) {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({ roles: ['CLINIC_ADMIN'], clinicIds: [clinicId], locationIds: [locationId] }).setProtectedHeader({ alg: 'HS256' }).setSubject('schedule-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(jwtSecret));
  await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}
function handleRequest(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${port}`}`);
  if (request.method === 'GET' && url.pathname === '/v1/auth/session') { json(response, 200, { subjectId: 'schedule-user', roles: ['CLINIC_ADMIN'], effectiveCapabilities: sessionMode === 'allowed' ? ['schedule.read'] : [], clinicScopes: [{ clinicId: sessionMode === 'wrong-scope' ? otherClinicId : clinicId, locationId }] }); return; }
  if (request.method === 'GET' && url.pathname === `/v1/clinic/${clinicId}/locations/${locationId}/schedule/slots`) { slotReads += 1; json(response, 200, schedule()); return; }
  json(response, 404, { code: 'NOT_FOUND' });
}
function json(response: import('node:http').ServerResponse, status: number, body: unknown) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); }
function schedule() { return { clinicId, locationId, serverNow: '2026-06-28T12:00:00.000Z', services: [], staff: [], resources: [], periods: [], workingHours: [], slots: [] }; }
