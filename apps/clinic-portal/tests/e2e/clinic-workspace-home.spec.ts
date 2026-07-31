import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const otherLocationId = '33333333-3333-4333-8333-333333333333';
const mockPort = 3212;
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';
const enabled = process.env.CLINIC_V50_WORKSPACE_HOME === 'true';
const evidenceDir = process.env.V50_WORKSPACE_EVIDENCE_DIR;
type Mode = 'ready' | 'empty' | 'overdue' | 'queue-degraded' | 'appointments-degraded' | 'all-degraded' | 'vet' | 'multi' | '503' | '401' | '403' | 'malformed' | 'oversized' | 'redirect' | 'timeout';
let mode: Mode = 'ready';
let server: Server;
let workspaceRequests = 0;
let upstreamAuthorization = '';
let redirectTargetRequests = 0;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === '/v1/auth/session') return json(response, 200, effectiveSession());
    if (request.url === `/v1/clinic/${clinicId}/locations/${locationId}/workspace-home`) {
      workspaceRequests += 1;
      upstreamAuthorization = String(request.headers.authorization ?? '');
      if (mode === '503') return json(response, 503, { code: 'PRIVATE_SQL_ERROR', message: 'secret' });
      if (mode === '401') return json(response, 401, { code: 'PRIVATE_AUTH' });
      if (mode === '403') return json(response, 403, { code: 'PRIVATE_SCOPE' });
      if (mode === 'malformed') return json(response, 200, { raw: 'ownerId', clinicId });
      if (mode === 'oversized') return json(response, 200, { padding: 'x'.repeat(9 * 1024) });
      if (mode === 'redirect') { response.writeHead(302, { Location: `http://127.0.0.1:${mockPort}/redirect-target` }); return response.end(); }
      if (mode === 'timeout') return setTimeout(() => { if (!response.destroyed) json(response, 200, snapshot()); }, 3_200);
      return json(response, 200, snapshot());
    }
    if (request.url === '/redirect-target') { redirectTargetRequests += 1; return json(response, 200, snapshot()); }
    return json(response, 404, { code: 'NOT_FOUND' });
  });
  await new Promise<void>((resolve) => server.listen(mockPort, '127.0.0.1', resolve));
});
test.afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
test.beforeEach(async ({ context, baseURL }) => { mode = 'ready'; workspaceRequests = 0; upstreamAuthorization = ''; redirectTargetRequests = 0; await addSession(context, baseURL!, locationId); });

test('flag disabled preserves absent root route and BFF', async ({ page }) => {
  test.skip(enabled, 'rollback-only run');
  const response = await page.goto(route());
  expect(response?.status()).toBe(404);
  expect((await page.request.get(bff())).status()).toBe(404);
});

test.describe('enabled workspace home', () => {
  test.skip(!enabled, 'enabled-only run');

  test('renders reception/admin-ready fixed tuple with secure same-origin BFF and exact actions', async ({ page }) => {
    await page.goto(route());
    await expect(page.getByRole('heading', { name: 'Рабочее пространство' })).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toBeVisible();
    await expect(page.getByText('SLA просрочен')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Открыть очередь', exact: true })).toHaveAttribute('href', `${route()}/queue`);
    await expect(page.getByRole('link', { name: 'Открыть приёмы', exact: true })).toHaveAttribute('href', `${route()}/appointments`);
    await expect(page.getByText('Сводка раздела пока не настроена.')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Открыть рабочее пространство' }).first()).toHaveAttribute('aria-current', 'page');
    expect(upstreamAuthorization).toMatch(/^Bearer /);
    expect(upstreamAuthorization).not.toContain('browser-token');
    expect(await page.locator('body').textContent()).not.toMatch(/ownerId|patientId|holdId|appointmentId|doctorId|PRIVATE_/i);
  });

  test('executes BFF authentication, bearer suppression, bounds, redirect and timeout normalization', async ({ page, context }) => {
    const withBrowserBearer = await page.request.get(bff(), { headers: { Authorization: 'Bearer browser-token' } });
    expect(withBrowserBearer.status()).toBe(200);
    expect(upstreamAuthorization).toMatch(/^Bearer /);
    expect(upstreamAuthorization).not.toContain('browser-token');
    expect(withBrowserBearer.headers()['cache-control']).toBe('private, no-store');
    expect(withBrowserBearer.headers().vary).toContain('Cookie');
    expect(withBrowserBearer.headers().etag).toBeUndefined();

    mode = 'oversized';
    expect((await page.request.get(bff())).status()).toBe(502);
    mode = 'redirect';
    expect((await page.request.get(bff())).status()).toBe(503);
    expect(redirectTargetRequests).toBe(0);
    mode = 'timeout';
    expect((await page.request.get(bff())).status()).toBe(503);
    expect((await page.request.get(`${bff()}?forward=forbidden`)).status()).toBe(400);

    await context.clearCookies();
    const missing = await page.request.get(bff(), { maxRedirects: 0 });
    expect(missing.status()).toBe(401);
    expect(await missing.json()).toEqual({ code: 'SESSION_REQUIRED' });
  });

  test('presents veterinarian-only and multi-role union without synthetic facts', async ({ page }) => {
    mode = 'vet'; await page.goto(route());
    await expect(page.getByText('Персональная сводка врача пока не подключена.')).toBeVisible();
    await expect(page.getByText('Ожидают')).toHaveCount(0);
    await captureAt(page, 'veterinarian', [{ width: 375, height: 812 }, { width: 1440, height: 900 }]);
    mode = 'multi'; await page.reload();
    await expect(page.getByRole('heading', { name: 'Очередь' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Работа врача' })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    const finalMobileDestination = page.getByRole('navigation', { name: 'Быстрая навигация портала клиники' }).getByRole('link', { name: 'Открыть приёмы врача' });
    await finalMobileDestination.focus();
    expect(await finalMobileDestination.evaluate((element) => {
      const item = element.getBoundingClientRect();
      const nav = element.closest('nav')!.getBoundingClientRect();
      return item.left >= nav.left && item.right <= nav.right;
    })).toBe(true);
    await captureAt(page, 'multi-role', [{ width: 375, height: 812 }, { width: 1440, height: 900 }]);
  });

  test('shows empty, textual SLA and bounded partial/all degradation states', async ({ page }) => {
    mode = 'empty'; await page.goto(route());
    await expect(page.getByText('Сейчас нет срочных операционных задач.')).toBeVisible();
    await captureAt(page, 'empty', [{ width: 1440, height: 900 }]);
    mode = 'overdue'; await page.reload(); await expect(page.getByText('SLA просрочен')).toBeVisible();
    for (const degraded of ['queue-degraded', 'appointments-degraded', 'all-degraded'] as Mode[]) {
      mode = degraded; await page.reload();
      await expect(page.getByText('Данные раздела временно недоступны.').first()).toBeVisible();
      const cards = page.locator('.vh-workspace-card--error');
      await expect(cards.getByRole('link')).toHaveCount(0);
      if (degraded === 'queue-degraded') await captureAt(page, 'partial-degradation', [{ width: 1440, height: 900 }]);
    }
  });

  test('retains stale snapshot only for technical refresh and purges it on authority loss', async ({ page }) => {
    await page.goto(route()); await expect(page.getByText('12', { exact: true })).toBeVisible();
    mode = '503'; await page.getByRole('button', { name: 'Обновить данные' }).click();
    await expect(page.getByText('Данные могут быть устаревшими.')).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toBeVisible();
    await captureAt(page, 'stale-retained', [{ width: 1440, height: 900 }]);
    mode = 'ready'; await page.getByRole('button', { name: 'Повторить обновление' }).click();
    await expect(page.getByRole('heading', { name: 'Рабочее пространство' })).toBeFocused();
    mode = '503'; await page.getByRole('button', { name: 'Обновить данные' }).click();
    await expect(page.getByText('Данные могут быть устаревшими.')).toBeVisible();
    mode = '401'; await page.getByRole('button', { name: 'Повторить обновление' }).click();
    await expect(page.getByText('Сессия не найдена. Войдите снова.')).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toHaveCount(0);
    mode = 'ready'; await page.reload(); await expect(page.getByText('12', { exact: true })).toBeVisible();
    mode = '403'; await page.getByRole('button', { name: 'Обновить данные' }).click();
    await expect(page.getByText('Нет доступа к этой локации.')).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toHaveCount(0);
    await captureAt(page, 'forbidden', [{ width: 1440, height: 900 }]);
  });

  test('fails closed for malformed/initial technical responses and retries without duplicate refresh', async ({ page }) => {
    mode = 'malformed'; await page.goto(route()); await expect(page.getByText('Рабочее пространство временно недоступно.')).toBeVisible();
    expect(await page.locator('body').textContent()).not.toContain('ownerId');
    mode = '503'; await page.reload(); await expect(page.getByRole('button', { name: 'Повторить загрузку' })).toBeVisible();
    mode = 'ready'; await page.getByRole('button', { name: 'Повторить загрузку' }).dblclick();
    await expect(page.getByRole('heading', { name: 'Рабочее пространство' })).toBeVisible();
    expect(workspaceRequests).toBeLessThanOrEqual(3);

    const beforeRestore = workspaceRequests;
    await page.clock.install();
    await page.clock.fastForward(31_000);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => workspaceRequests).toBeGreaterThan(beforeRestore);
  });

  test('clears protected facts after exact scope change', async ({ page, context, baseURL }) => {
    await page.goto(route()); await expect(page.getByText('12', { exact: true })).toBeVisible();
    await context.clearCookies(); await addSession(context, baseURL!, otherLocationId);
    await page.evaluate(() => window.dispatchEvent(new Event('vethelp:session-changed')));
    await expect(page.getByText('Нет доступа к этой локации.')).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toHaveCount(0);
  });

  test('passes keyboard, axe, responsive, 200% text, reduced-motion and bounded visual evidence', async ({ page }, testInfo) => {
    await page.goto(route());
    await page.locator('body').press('Tab');
    await expect(page.getByRole('link', { name: 'Перейти к содержимому' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#clinic-v50-content')).toBeFocused();
    await page.getByRole('button', { name: 'Обновить данные' }).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('p.sr-only[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    for (const viewport of [{ width: 375, height: 812 }, { width: 412, height: 915 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      if (viewport.width < 900) {
        expect(await page.evaluate(() => {
          const content = document.querySelector('.vh-clinic-content')?.getBoundingClientRect();
          const navElement = document.querySelector('.vh-clinic-bottom-nav');
          const nav = navElement?.getBoundingClientRect();
          return getComputedStyle(navElement!).display === 'none' || Boolean(content && nav && content.bottom <= nav.top + 1);
        })).toBe(true);
      }
      if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/reception-${viewport.width}x${viewport.height}.png`, fullPage: true });
    }
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await page.evaluate(() => {
      const content = document.querySelector('.vh-clinic-content')?.getBoundingClientRect();
      const navElement = document.querySelector('.vh-clinic-bottom-nav');
      const nav = navElement?.getBoundingClientRect();
      return getComputedStyle(navElement!).display === 'none' || Boolean(content && nav && content.bottom <= nav.top + 1);
    })).toBe(true);
    if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/text-200-percent.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/reduced-motion.png`, fullPage: true });
    await page.emulateMedia({ forcedColors: 'active' });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    await testInfo.attach('workspace-ready', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
});

function route() { return `/clinics/${clinicId}/locations/${locationId}`; }
function bff() { return `/api/clinic/${clinicId}/locations/${locationId}/workspace-home`; }
function effectiveSession() {
  const caps = mode === 'vet' ? ['clinical.visit.workspace.read'] : mode === 'multi' ? ['booking.queue.read','appointment.registry.read','schedule.read','clinical.visit.workspace.read','quality.read'] : ['booking.queue.read','appointment.registry.read','schedule.read','quality.read'];
  return { subjectId: 'employee-e2e', roles: mode === 'vet' ? ['CLINIC_VETERINARIAN'] : mode === 'multi' ? ['CLINIC_RECEPTIONIST','CLINIC_VETERINARIAN'] : ['CLINIC_RECEPTIONIST'], effectiveCapabilities: caps, clinicScopes: [{ clinicId, locationId }] };
}
function snapshot() {
  const at = '2026-07-31T10:00:00.000Z';
  const queue = mode === 'queue-degraded' || mode === 'all-degraded' ? unavailable('QUEUE','TEMPORARILY_UNAVAILABLE',at) : { kind:'QUEUE',availability:'AVAILABLE',generatedAt:at,facts:{waitingCount:mode==='empty'?0:12,requiresActionCount:mode==='empty'?0:3,oldestWaitAgeBucket:'5_TO_10_MIN',slaRisk:mode==='overdue'?'OVERDUE':'DUE_SOON'},action:{route:'queue',labelKey:'WORKSPACE_OPEN_QUEUE'} };
  const appointments = mode === 'appointments-degraded' || mode === 'all-degraded' ? unavailable('APPOINTMENTS','TEMPORARILY_UNAVAILABLE',at) : { kind:'APPOINTMENTS',availability:'AVAILABLE',generatedAt:at,facts:{todayCount:mode==='empty'?0:8,requiresActionCount:mode==='empty'?0:2,nextScheduledAt:'2026-07-31T12:00:00.000Z'},action:{route:'appointments',labelKey:'WORKSPACE_OPEN_APPOINTMENTS'} };
  const sections = mode === 'vet' ? [unavailable('QUEUE','NOT_AUTHORIZED',at),unavailable('SCHEDULE','NOT_AUTHORIZED',at),unavailable('APPOINTMENTS','NOT_AUTHORIZED',at),unavailable('VETERINARIAN','NOT_CONFIGURED',at),unavailable('QUALITY','NOT_AUTHORIZED',at)] : [queue,unavailable('SCHEDULE','NOT_CONFIGURED',at),appointments,mode==='multi'?unavailable('VETERINARIAN','NOT_CONFIGURED',at):unavailable('VETERINARIAN','NOT_AUTHORIZED',at),unavailable('QUALITY','NOT_CONFIGURED',at)];
  return { clinicId, locationId, serverNow:at, generatedAt:at, freshness:{state:'FRESH',maxAgeSeconds:30}, sections };
}
function unavailable(kind:string, availability:string, generatedAt:string) { return { kind, availability, generatedAt }; }
async function addSession(context: import('@playwright/test').BrowserContext, baseURL: string, scopedLocation: string) {
  const token = await new SignJWT({ roles:['CLINIC_RECEPTIONIST'],clinicIds:[clinicId],locationIds:[scopedLocation] }).setProtectedHeader({alg:'HS256'}).setSubject('employee-e2e').sign(new TextEncoder().encode(jwtSecret));
  await context.addCookies([{ name:'vethelp_clinic_session',value:token,url:baseURL,httpOnly:true,sameSite:'Lax' }]);
}
function json(response: ServerResponse, status: number, payload: unknown) { response.writeHead(status, {'Content-Type':'application/json'}); response.end(JSON.stringify(payload)); }
async function captureAt(page: import('@playwright/test').Page, name: string, viewports: Array<{ width: number; height: number }>) {
  if (!evidenceDir) return;
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: `${evidenceDir}/${name}-${viewport.width}x${viewport.height}.png`, fullPage: true });
  }
}
