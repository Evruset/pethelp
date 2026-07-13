import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const otherClinicId = '33333333-3333-4333-8333-333333333333';
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';
const port = 3212;
let server: Server;
let sessionMode: 'allowed' | 'denied' | 'wrong-clinic' = 'allowed';
let dashboardReads = 0;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { server = createServer(handleRequest); await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve)); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(() => { sessionMode = 'allowed'; dashboardReads = 0; });

test('allowed user sees quality navigation and dashboard', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/quality`);
  await expect(page.getByRole('link', { name: 'Открыть панель качества' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service Quality Dashboard' })).toBeVisible();
  expect(dashboardReads).toBe(1);
});

test('denied capability hides navigation and direct URL has no quality data', async ({ page, context, baseURL }) => {
  sessionMode = 'denied';
  await addSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/quality`);
  await expect(page.getByText('403 Access Denied').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть панель качества' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Service Quality Dashboard' })).toHaveCount(0);
  expect(dashboardReads).toBe(0);
});

test('mismatched clinic scope fails closed before dashboard loading', async ({ page, context, baseURL }) => {
  sessionMode = 'wrong-clinic';
  await addSession(context, baseURL);
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/quality`);
  await expect(page.getByText('403 Access Denied').first()).toBeVisible();
  expect(dashboardReads).toBe(0);
});

test('loading and session error never flash quality navigation and expose retry', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL);
  await page.route('**/api/auth/session', async (route) => { await new Promise((resolve) => setTimeout(resolve, 150)); await route.fulfill({ status: 503, body: '{"code":"SESSION_UNAVAILABLE"}' }); });
  await page.goto(`/clinics/${clinicId}/locations/${locationId}/quality`);
  await expect(page.getByText('Загрузка доступа…').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть панель качества' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Повторить' }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.vh-clinic-nav').analyze()).violations).toEqual([]);
});

async function addSession(context: BrowserContext, baseURL: string | undefined) {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({ roles: ['CLINIC_RECEPTIONIST'], clinicIds: [clinicId], locationIds: [locationId] }).setProtectedHeader({ alg: 'HS256' }).setSubject('quality-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(jwtSecret));
  await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}

function handleRequest(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${port}`}`);
  if (request.method === 'GET' && url.pathname === '/v1/auth/session') {
    const scopedClinicId = sessionMode === 'wrong-clinic' ? otherClinicId : clinicId;
    json(response, 200, { subjectId: 'quality-user', roles: ['CLINIC_RECEPTIONIST'], effectiveCapabilities: sessionMode === 'allowed' ? ['quality.read'] : [], clinicScopes: [{ clinicId: scopedClinicId, locationId }] });
    return;
  }
  if (request.method === 'GET' && url.pathname === `/v1/clinic/${clinicId}/locations/${locationId}/quality-dashboard`) {
    dashboardReads += 1;
    json(response, 200, dashboard());
    return;
  }
  json(response, 404, { code: 'NOT_FOUND' });
}

function json(response: import('node:http').ServerResponse, status: number, body: unknown) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); }
function metric(value: number, numerator = 1, denominator = 2) { return { value, numerator, denominator }; }
function dashboard() { return { clinicId, locationId, from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T00:00:00.000Z', generatedAt: '2026-01-31T00:00:00.000Z', metrics: { firstResponseSla: metric(.9), confirmRate: metric(.8), alternativeRate: metric(.1), cancellationRate: metric(.05), noShowRate: metric(.02), bookingConversion: metric(.7), telemedReferralConversion: metric(.2), ownerReturnRate: metric(.4), averageConfirmationMinutes: 5, staleAvailabilityIncidents: 0 } }; }
