import { expect, test } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111'; const locationId = '22222222-2222-4222-8222-222222222222'; const holdId = '44444444-4444-4444-8444-444444444444'; const appointmentId = '55555555-5555-4555-8555-555555555555'; const petId = '66666666-6666-4666-8666-666666666666'; const visitId = '77777777-7777-4777-8777-777777777777'; const resultId = '88888888-8888-4888-8888-888888888888'; const firstAmendment = '99999999-9999-4999-8999-999999999991'; const secondAmendment = '99999999-9999-4999-8999-999999999992'; const port = 3212; const secret = 'clinic-e2e-secret-at-least-32-bytes';
type Phase = 'before' | 'empty' | 'draft' | 'published' | 'amended';
let server: Server; let phase: Phase = 'before'; let capabilities = ['clinical.visit.workspace.read', 'clinical.visit.complete']; let content = 'Existing draft'; let version = 1; let detailReads = 0; let resultReads = 0; let creates = 0; let saves = 0; let publishes = 0; let amendments = 0; let lastCreateKey = ''; let lastAmendmentKey = '';

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { server = createServer(handle); await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve)); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(() => { phase = 'before'; capabilities = ['clinical.visit.workspace.read', 'clinical.visit.complete']; content = 'Existing draft'; version = 1; detailReads = 0; resultReads = 0; creates = 0; saves = 0; publishes = 0; amendments = 0; lastCreateKey = ''; lastAmendmentKey = ''; });

test('reload restores every authoritative Visit and Result state without discovery mutations', async ({ page, context, baseURL }) => {
  await session(context, baseURL);
  await page.goto(route()); await expect(page.getByRole('button', { name: 'Завершить приём' })).toBeVisible(); expect(resultReads).toBe(0);
  phase = 'empty'; await page.reload(); await expect(page.getByRole('button', { name: 'Оформить результат' })).toBeVisible();
  phase = 'draft'; await page.reload(); await expect(page.getByText('Черновик', { exact: true })).toBeVisible(); await expect(page.getByText('Не виден владельцу питомца')).toBeVisible(); await expect(page.getByLabel('Текст результата')).toHaveValue('Existing draft');
  phase = 'published'; await page.reload(); await expect(page.getByText('Исходный результат')).toBeVisible(); await expect(page.getByLabel('Текст результата')).toHaveCount(0);
  phase = 'amended'; await page.reload(); const rows = page.locator('ol li'); await expect(rows).toHaveCount(2); await expect(rows.nth(0)).toContainText('Первое уточнение'); await expect(rows.nth(1)).toContainText('Второе уточнение');
  expect({ creates, saves, publishes, amendments }).toEqual({ creates: 0, saves: 0, publishes: 0, amendments: 0 });
  expect(detailReads).toBe(5); expect(resultReads).toBe(4);
});

test('completion and competing Result creation converge through authoritative reload', async ({ page, context, baseURL }) => {
  await session(context, baseURL); await page.goto(route()); await page.getByLabel('Клиническое заключение').fill('Visit complete'); await page.getByRole('button', { name: 'Завершить приём' }).dblclick();
  await expect(page.getByRole('button', { name: 'Оформить результат' })).toBeVisible();
  await page.getByRole('button', { name: 'Оформить результат' }).click(); await page.getByLabel('Текст результата').fill('Canonical draft');
  phase = 'draft'; await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByText('Черновик', { exact: true })).toBeVisible(); expect(creates).toBe(1); expect(lastCreateKey).toMatch(/^[0-9a-f-]{36}$/);
});

test('draft save, confirmed publication and immutable Amendment workflow reload canonically', async ({ page, context, baseURL }) => {
  phase = 'draft'; await session(context, baseURL); await page.goto(route()); const field = page.getByLabel('Текст результата'); await field.fill('Edited authoritative draft'); await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(field).toHaveValue('Edited authoritative draft'); expect(saves).toBe(1);
  await page.getByRole('button', { name: 'Опубликовать результат' }).click(); const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('станет доступен владельцу'); await expect(dialog).toContainText('Основной текст больше нельзя будет изменить'); await dialog.getByRole('button', { name: 'Опубликовать', exact: true }).dblclick();
  await expect(page.getByText('Исходный результат')).toBeVisible(); await expect(page.getByLabel('Текст результата')).toHaveCount(0); expect(publishes).toBe(1);
  await page.getByRole('button', { name: 'Добавить уточнение' }).click(); await page.getByLabel('Текст уточнения').fill('Новое уточнение'); await page.getByRole('button', { name: 'Добавить уточнение' }).click();
  await expect(page.locator('ol li').last()).toContainText('Новое уточнение'); expect(amendments).toBe(1); expect(lastAmendmentKey).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload(); await expect(page.locator('ol li').last()).toContainText('Новое уточнение'); expect(amendments).toBe(1);
});

test('read-only capability preserves authorized readback and removes all mutation actions', async ({ page, context, baseURL }) => {
  phase = 'amended'; capabilities = ['clinical.visit.workspace.read']; await session(context, baseURL); await page.goto(route()); await expect(page.getByText('Published result body')).toBeVisible(); await expect(page.getByText('Первое уточнение')).toBeVisible(); await expect(page.getByRole('button', { name: /Сохранить|Опубликовать|Добавить уточнение|Оформить результат|Завершить приём/ })).toHaveCount(0);
});

function route() { return `/clinics/${clinicId}/locations/${locationId}/vet/visits/${holdId}`; }
async function session(context: BrowserContext, baseURL: string | undefined) { if (!baseURL) throw new Error('baseURL required'); const token = await new SignJWT({ roles: ['CLINIC_VETERINARIAN'], clinicIds: [clinicId], locationIds: [locationId] }).setProtectedHeader({ alg: 'HS256' }).setSubject('vet-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret)); await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]); }
function result(status: 'DRAFT' | 'PUBLISHED') { return { id: resultId, visitId, status, clinicalSummary: status === 'DRAFT' ? content : content === 'Existing draft' ? 'Published result body' : content, version, createdAt: '2026-07-12T10:30:00.000Z', updatedAt: '2026-07-12T10:35:00.000Z', publishedAt: status === 'PUBLISHED' ? '2026-07-12T10:35:00.000Z' : null }; }
function readback() { const published = phase === 'published' || phase === 'amended'; const items = phase === 'amended' ? [{ amendmentId: firstAmendment, resultId, content: 'Первое уточнение', publishedAt: '2026-07-12T10:40:00.000Z' }, { amendmentId: secondAmendment, resultId, content: amendments ? 'Новое уточнение' : 'Второе уточнение', publishedAt: '2026-07-12T10:45:00.000Z' }] : []; return { visitId, result: phase === 'empty' ? null : result(published ? 'PUBLISHED' : 'DRAFT'), amendments: items }; }
function handle(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) { const path = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname; if (path === '/v1/auth/session') return json(response, 200, { subjectId: 'vet-user', roles: ['CLINIC_VETERINARIAN'], effectiveCapabilities: capabilities, clinicScopes: [{ clinicId, locationId }] }); if (path.endsWith(`/vet/visits/${holdId}`)) { detailReads += 1; return json(response, 200, { holdId, clinicId, locationId, scheduledStart: '2026-07-12T10:00:00.000Z', scheduledEnd: '2026-07-12T10:30:00.000Z', status: phase === 'before' ? 'CONFIRMED' : 'COMPLETED', petDisplayName: 'Milo', species: 'CAT', appointmentId, petId, visitId: phase === 'before' ? null : visitId }); } if (path === `/v1/clinic/booking-holds/${holdId}/complete`) { phase = 'empty'; return json(response, 200, { holdId, visitId }); } if (path === `/v1/clinic/visits/${visitId}/results` && request.method === 'GET') { resultReads += 1; return json(response, 200, readback()); } if (path === `/v1/clinic/visits/${visitId}/results` && request.method === 'POST') { creates += 1; lastCreateKey = String(request.headers['idempotency-key'] ?? ''); return json(response, 409, { code: 'CLINICAL_RESULT_ALREADY_EXISTS' }); } if (path === `/v1/clinic/visits/${visitId}/results/${resultId}` && request.method === 'PATCH') { saves += 1; version += 1; return readBody(request, (body) => { content = String(body.clinicalSummary); phase = 'draft'; json(response, 200, result('DRAFT')); }); } if (path.endsWith(`/${resultId}/publish`)) { publishes += 1; phase = 'published'; version += 1; return json(response, 200, result('PUBLISHED')); } if (path.endsWith(`/${resultId}/amendments`)) { amendments += 1; lastAmendmentKey = String(request.headers['idempotency-key'] ?? ''); phase = 'amended'; return json(response, 201, { id: secondAmendment, resultId, visitId, content: 'Новое уточнение', publishedAt: '2026-07-12T10:45:00.000Z' }); } return json(response, 404, { code: 'NOT_FOUND' }); }
function readBody(request: import('node:http').IncomingMessage, done: (body: Record<string, unknown>) => void) { let raw = ''; request.on('data', (chunk) => { raw += chunk; }); request.on('end', () => done(JSON.parse(raw) as Record<string, unknown>)); }
function json(response: import('node:http').ServerResponse, status: number, body: unknown) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); }
