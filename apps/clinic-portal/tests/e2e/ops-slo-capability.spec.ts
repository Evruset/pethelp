import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { SignJWT } from 'jose';

const port = 3212;
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';
let server: Server;
let capabilityMode: 'allowed' | 'denied' = 'allowed';
let snapshotMode: 'success' | 'denied' = 'success';
let snapshotReads = 0;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { server = createServer(handleRequest); await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve)); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(() => { capabilityMode = 'allowed'; snapshotMode = 'success'; snapshotReads = 0; });

test('allowed platform user loads the existing SLO dashboard despite incompatible clinic hints', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL, ['wrong-clinic'], ['wrong-location']);
  await page.goto('/ops/security');
  await expect(page.getByRole('heading', { name: 'Operational readiness' })).toBeVisible();
  expect(snapshotReads).toBe(1);
});

test('missing capability redirects before the SLO endpoint request', async ({ page, context, baseURL }) => {
  capabilityMode = 'denied';
  await addSession(context, baseURL);
  await page.goto('/ops/security');
  await expect(page).toHaveURL(/\/forbidden/);
  expect(snapshotReads).toBe(0);
});

test('session loading and error do not flash dashboard data and expose retry', async ({ page, context, baseURL }) => {
  await addSession(context, baseURL);
  await page.route('**/api/auth/session', async (route) => { await new Promise((resolve) => setTimeout(resolve, 150)); await route.fulfill({ status: 503, body: '{"code":"SESSION_UNAVAILABLE"}' }); });
  await page.goto('/ops/security');
  await expect(page.getByText('Загрузка доступа…')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operational readiness' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('backend SLO denial remains a normalized forbidden response', async ({ page, context, baseURL }) => {
  snapshotMode = 'denied';
  await addSession(context, baseURL);
  await page.goto('/ops/security');
  await expect(page).toHaveURL(/\/forbidden/);
  expect(snapshotReads).toBe(1);
});

async function addSession(context: BrowserContext, baseURL: string | undefined, clinicIds = ['clinic'], locationIds = ['location']) {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({ roles: ['PLATFORM_ADMIN'], clinicIds, locationIds }).setProtectedHeader({ alg: 'HS256' }).setSubject('ops-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(jwtSecret));
  await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}
function handleRequest(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${port}`}`);
  if (request.method === 'GET' && url.pathname === '/v1/auth/session') { json(response, 200, { subjectId: 'ops-user', roles: ['PLATFORM_ADMIN'], effectiveCapabilities: capabilityMode === 'allowed' ? ['ops.slo.snapshot.read'] : [], clinicScopes: [] }); return; }
  if (request.method === 'GET' && url.pathname === '/v1/ops/slo-snapshot') { snapshotReads += 1; if (snapshotMode === 'denied') { json(response, 403, { code: 'OPS_ACCESS_DENIED' }); return; } json(response, 200, snapshot()); return; }
  if (request.method === 'GET' && url.pathname === '/v1/ops/audit-events') { json(response, 200, { items: [] }); return; }
  json(response, 404, { code: 'NOT_FOUND' });
}
function json(response: import('node:http').ServerResponse, status: number, body: unknown) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); }
function snapshot() { return { serverNow: '2026-07-01T10:00:00.000Z', technical: { apiLatencyP95Ms: 100, apiErrorRate: .001, apiSamples: 10, connectionPoolInUse: 1, connectionPoolWaiting: 0, outboxLagSeconds: 1, outboxPendingCount: 0, outboxRetryCount: 0, misSyncLagSeconds: 1, misPendingCount: 0, paymentReconciliationCount: 0, telemedQueueWaitSeconds: 1 }, security: { permissionDeniedLastHour: 0 }, business: { clinicResponseSlaBreachesLast24h: 0 } }; }
