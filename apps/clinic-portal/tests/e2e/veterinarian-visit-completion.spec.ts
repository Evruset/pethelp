import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const holdId = '44444444-4444-4444-8444-444444444444';
const secret = 'clinic-e2e-secret-at-least-32-bytes'; const port = 3212;
type Mode = 'success' | 'pending' | 'idempotent' | 'validation' | 'forbidden' | 'conflict' | 'failure' | 'network' | 'session-error';
let server: Server; let mode: Mode = 'success'; let capabilities = ['clinical.visit.workspace.read', 'clinical.visit.complete']; let scope = { clinicId, locationId }; let status = 'CONFIRMED'; let detailReads = 0; let postReads = 0; let pendingResponse: (() => void) | undefined;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { server = createServer(handle); await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve)); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(() => { mode = 'success'; capabilities = ['clinical.visit.workspace.read', 'clinical.visit.complete']; scope = { clinicId, locationId }; status = 'CONFIRMED'; detailReads = 0; postReads = 0; pendingResponse = undefined; });

test('completes a confirmed visit', async ({ page, context, baseURL }) => {
  await open(page, context, baseURL); const form = page.getByRole('form', { name: 'Завершение приёма' });
  await expect(form).toBeVisible(); await form.getByLabel('Клиническое заключение').fill('OK!'); await form.getByRole('button', { name: 'Завершить приём' }).click();
  await expect(page.getByText('COMPLETED')).toBeVisible(); await expect(form).toHaveCount(0);
  expect(postReads).toBe(1); expect(detailReads).toBe(2);
});

test('capability, scope and state gates never post', async ({ page, context, baseURL }) => {
  for (const configuration of [
    { capabilities: ['clinical.visit.workspace.read'], scope: { clinicId, locationId }, status: 'CONFIRMED', unavailable: false },
    { capabilities: ['clinical.visit.workspace.read', 'clinical.visit.complete'], scope: { clinicId: otherId, locationId }, status: 'CONFIRMED', unavailable: true },
    { capabilities: ['clinical.visit.workspace.read', 'clinical.visit.complete'], scope: { clinicId, locationId: otherId }, status: 'CONFIRMED', unavailable: true },
    { capabilities: ['clinical.visit.workspace.read', 'clinical.visit.complete'], scope: { clinicId, locationId }, status: 'COMPLETED', unavailable: false },
  ]) { capabilities = configuration.capabilities; scope = configuration.scope; status = configuration.status; await session(context, baseURL); await page.goto(route()); if (configuration.unavailable) await expect(page.getByText('Раздел недоступен')).toBeVisible(); else await expect(page.getByRole('heading', { name: 'Milo' })).toBeVisible(); await expect(page.getByRole('form', { name: 'Завершение приёма' })).toHaveCount(0); expect(postReads).toBe(0); }
});

test('session loading and error are fail closed and retryable', async ({ page, context, baseURL }) => {
  const content = page.locator('#clinic-v51-content'); mode = 'session-error'; await session(context, baseURL); await page.goto(route()); await expect(content.getByText('Раздел временно недоступен')).toBeVisible(); await expect(content.getByRole('button', { name: 'Повторить' })).toBeVisible(); expect(postReads).toBe(0);
  mode = 'success'; await content.getByRole('button', { name: 'Повторить' }).click(); await expect(page.getByRole('form', { name: 'Завершение приёма' })).toBeVisible(); expect(postReads).toBe(0);
});

test('validates summary boundaries without posting', async ({ page, context, baseURL }) => {
  await open(page, context, baseURL); const field = page.getByLabel('Клиническое заключение'); const button = page.getByRole('button', { name: 'Завершить приём' });
  for (const value of ['', 'x', 'xx']) { await field.fill(value); await button.click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(field).toHaveValue(value); await expect(field).toBeFocused(); }
  const tooLong = 'x'.repeat(8001); await field.evaluate((element, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set; setter?.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); }, tooLong); await button.click(); await expect(page.locator('#clinical-summary-error')).toHaveText('Заключение не должно превышать 8000 символов.'); await expect(field).toHaveValue(tooLong); await expect(field).toBeFocused();
  expect(postReads).toBe(0);
});

test('accepts 3 and 8000 character summaries', async ({ page, context, baseURL }) => {
  await open(page, context, baseURL); await page.getByLabel('Клиническое заключение').fill('xyz'); await page.getByRole('button', { name: 'Завершить приём' }).click(); await expect(page.getByText('COMPLETED')).toBeVisible(); expect(postReads).toBe(1);
  status = 'CONFIRMED'; postReads = 0; detailReads = 0; await open(page, context, baseURL); await page.getByLabel('Клиническое заключение').fill('x'.repeat(8000)); await page.getByRole('button', { name: 'Завершить приём' }).click(); await expect(page.getByText('COMPLETED')).toBeVisible(); expect(postReads).toBe(1);
});

test('pending double click and Enter submit exactly once', async ({ page, context, baseURL }) => {
  mode = 'pending'; await open(page, context, baseURL); const field = page.getByLabel('Клиническое заключение'); await field.fill('pending'); const submit = page.getByRole('button', { name: 'Завершить приём' });
  try {
    await submit.dblclick();
    const pending = page.getByRole('button', { name: 'Завершение…' });
    await expect(pending).toBeDisabled();
    await page.keyboard.press('Enter');
    await expect.poll(() => postReads).toBe(1);
  } finally {
    pendingResponse?.();
  }
  await expect(page.getByText('COMPLETED')).toBeVisible();
  expect(postReads).toBe(1); expect(detailReads).toBe(2);
});

test('idempotent, validation, forbidden, conflict, failure and network responses are controlled', async ({ page, context, baseURL }) => {
  for (const responseMode of ['idempotent', 'validation', 'forbidden', 'conflict', 'failure', 'network'] as const) {
    mode = responseMode; status = 'CONFIRMED'; postReads = 0; detailReads = 0; await open(page, context, baseURL); const field = page.getByLabel('Клиническое заключение'); await field.fill('summary'); await page.getByRole('button', { name: 'Завершить приём' }).click();
    await expect.poll(() => postReads, { message: 'expected exactly one completion POST' }).toBe(1);
    if (responseMode === 'idempotent' || responseMode === 'conflict') { await expect(page.getByText('COMPLETED')).toBeVisible(); expect(detailReads).toBe(2); }
    else { await expect(page.locator('#clinical-summary-error')).toBeVisible(); await expect(field).toHaveValue('summary'); expect(detailReads).toBe(1); }
  }
});

test('completion states have labels, live errors and scoped axe coverage', async ({ page, context, baseURL }) => {
  await open(page, context, baseURL); const form = page.getByRole('form', { name: 'Завершение приёма' }); await expect(form.getByLabel('Клиническое заключение')).toBeVisible(); await expect((await new AxeBuilder({ page }).include('form[aria-label="Завершение приёма"]').analyze()).violations).toEqual([]);
  await form.getByRole('button', { name: 'Завершить приём' }).click(); await expect(page.getByRole('alert')).toBeVisible(); await expect((await new AxeBuilder({ page }).include('form[aria-label="Завершение приёма"]').analyze()).violations).toEqual([]);
  mode = 'success'; await open(page, context, baseURL); await page.getByLabel('Клиническое заключение').fill('done'); await page.getByRole('button', { name: 'Завершить приём' }).click(); await expect(page.getByText('COMPLETED')).toBeVisible(); await expect((await new AxeBuilder({ page }).include('[aria-labelledby="vet-visit-detail-title"]').analyze()).violations).toEqual([]);
});

function route() { return `/clinics/${clinicId}/locations/${locationId}/vet/visits/${holdId}`; }
async function open(page: import('@playwright/test').Page, context: BrowserContext, baseURL: string | undefined) { await session(context, baseURL); await page.goto(route()); await expect(page.getByRole('heading', { name: 'Milo' })).toBeVisible(); }
async function session(context: BrowserContext, baseURL: string | undefined) { if (!baseURL) throw new Error('baseURL required'); const token = await new SignJWT({ roles: ['CLINIC_VETERINARIAN'], clinicIds: [clinicId], locationIds: [locationId] }).setProtectedHeader({ alg: 'HS256' }).setSubject('vet-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret)); await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]); }
function visit() { return { holdId, clinicId, locationId, scheduledStart: '2026-07-12T10:00:00.000Z', scheduledEnd: '2026-07-12T10:30:00.000Z', status, petDisplayName: 'Milo', species: 'CAT' }; }
function json(response: import('node:http').ServerResponse, code: number, body: unknown) { response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); }
function handle(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) { const path = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname; if (path === '/v1/auth/session') return mode === 'session-error' ? json(response, 503, {}) : json(response, 200, { subjectId: 'vet-user', roles: ['CLINIC_VETERINARIAN'], effectiveCapabilities: capabilities, clinicScopes: [scope] }); if (path === `/v1/clinic/${clinicId}/locations/${locationId}/vet/visits/${holdId}`) { detailReads += 1; return json(response, 200, visit()); } if (path === `/v1/clinic/booking-holds/${holdId}/complete` && request.method === 'POST') { postReads += 1; if (mode === 'success') { status = 'COMPLETED'; return json(response, 200, { holdId }); } if (mode === 'pending') { status = 'COMPLETED'; return new Promise<void>((resolve) => { pendingResponse = () => { json(response, 200, { holdId }); resolve(); }; }); } if (mode === 'idempotent') { status = 'COMPLETED'; return json(response, 409, { code: 'ALREADY_COMPLETED' }); } if (mode === 'validation') return json(response, 400, { code: 'INVALID_CLINICAL_SUMMARY' }); if (mode === 'forbidden') return json(response, 403, { code: 'CLINIC_SCOPE_MISMATCH' }); if (mode === 'conflict') { status = 'COMPLETED'; return json(response, 409, { code: 'STATE_CONFLICT' }); } if (mode === 'network') return response.destroy(); return json(response, 500, { code: 'INTERNAL' }); } return json(response, 404, { code: 'NOT_FOUND' }); }
