import { createServer, type Server } from 'node:http';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { SignJWT } from 'jose';

const clinicId = '71111111-1111-4111-8111-111111111111';
const otherClinicId = '71111111-1111-4111-8111-111111111112';
const locationId = '72222222-2222-4222-8222-222222222222';
const otherLocationId = '72222222-2222-4222-8222-222222222223';
const patientId = '73333333-3333-4333-8333-333333333331';
const otherPatientId = '73333333-3333-4333-8333-333333333332';
const appointmentA = '74444444-4444-4444-8444-444444444441';
const appointmentB = '74444444-4444-4444-8444-444444444442';
const jwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET ?? 'clinic-e2e-secret-at-least-32-bytes';
const rolloutEnabled = process.env.VETHELP_CLINIC_PATIENTS_REGISTRY === 'true';
const mutationsEnabled = process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS === 'true';
const mockPort = Number(process.env.CLINIC_PORTAL_MOCK_PORT ?? 3212);
type Mode = 'normal' | 'not-found' | 'denied' | 'policy' | 'error' | 'malformed' | 'wrong-scope'
  | 'wrong-patient' | 'impossible-date' | 'duplicate' | 'unordered' | 'too-many' | 'extra' | 'delayed' | 'transport';
let server: Server;
let mode: Mode = 'normal';
let authority: 'allowed' | 'denied' = 'allowed';
let release: (() => void) | null = null;
let backendAuthorization: string | undefined;
type MutationMode = 'success' | 'stale' | 'denied' | 'not-found' | 'policy' | 'validation' | 'malformed' | 'transport' | 'delayed';
let mutationMode: MutationMode = 'success';
let writeAuthority = true;
let patchCalls: Array<{ ifMatch?: string; idempotencyKey?: string; body: unknown; path: string }> = [];
let releaseMutation: (() => void) | null = null;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${mockPort}`);
    if (url.pathname === '/v1/auth/session') return json(response, 200, {
      subjectId: 'clinic-user', roles: ['CLINIC_RECEPTIONIST'],
      effectiveCapabilities: authority === 'allowed'
        ? ['patient.admin.read', ...(writeAuthority ? ['patient.admin.local-profile.update'] : [])] : [],
      clinicScopes: [{ clinicId, locationId }, { clinicId, locationId: otherLocationId }],
    });
    if (url.pathname.endsWith('/patients')) return json(response, 200, registry());
    if (request.method === 'PATCH' && url.pathname.endsWith('/local-profile')) {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      patchCalls.push({
        ifMatch: String(request.headers['if-match'] ?? ''), idempotencyKey: String(request.headers['idempotency-key'] ?? ''),
        body, path: url.pathname,
      });
      if (mutationMode === 'delayed') await new Promise<void>((resolve) => { releaseMutation = resolve; });
      if (mutationMode === 'stale') return json(response, 409, { code: 'PATIENT_VERSION_STALE' });
      if (mutationMode === 'denied') return json(response, 403, { code: 'ACTION_NOT_PERMITTED' });
      if (mutationMode === 'not-found') return json(response, 404, { code: 'PATIENT_RESOURCE_UNAVAILABLE' });
      if (mutationMode === 'policy') return json(response, 503, { code: 'POLICY_TEMPORARILY_UNAVAILABLE' });
      if (mutationMode === 'validation') return json(response, 422, { code: 'INVALID_PATIENT_ALIAS', message: 'PRIVATE_RAW' });
      if (mutationMode === 'malformed') return json(response, 200, { aggregateVersion: 'PRIVATE_BAD' });
      if (mutationMode === 'transport') return request.socket.destroy();
      const nextAlias = body.alias as string | null;
      return json(response, 200, {
        clinicId, locationId, patientId, alias: nextAlias, aggregateVersion: 1, updatedAt: '2026-07-25T10:00:00.000Z',
      });
    }
    if (url.pathname.includes('/patients/')) {
      backendAuthorization = request.headers.authorization;
      if (mode === 'delayed') await new Promise<void>((resolve) => { release = resolve; });
      if (mode === 'not-found') return json(response, 404, { privatePatientName: 'Барни' });
      if (mode === 'denied') return json(response, 403, { privatePatientName: 'Барни' });
      if (mode === 'policy') return json(response, 503, { internalPolicy: 'secret' });
      if (mode === 'error') return json(response, 500, { sql: 'PRIVATE_SQL' });
      if (mode === 'transport') return request.socket.destroy();
      if (mode === 'malformed') return json(response, 200, { raw: 'PRIVATE_RAW' });
      const value = detail();
      if (mode === 'wrong-scope') value.locationId = otherLocationId;
      if (mode === 'wrong-patient') value.patient.patientId = otherPatientId;
      if (mode === 'impossible-date') value.patient.pet.birthDate = '2026-02-30';
      if (mode === 'duplicate') value.patient.appointments.recent = [summary(appointmentA, '2026-07-20T09:00:00.000Z'), summary(appointmentA, '2026-07-19T09:00:00.000Z')];
      if (mode === 'unordered') value.patient.appointments.recent = [summary(appointmentB, '2026-07-19T09:00:00.000Z'), summary(appointmentA, '2026-07-20T09:00:00.000Z')];
      if (mode === 'too-many') value.patient.appointments.recent = Array.from({ length: 11 }, (_, index) =>
        summary(`74444444-4444-4444-8444-${String(index + 10).padStart(12, '0')}`, `2026-07-${String(20 - index).padStart(2, '0')}T09:00:00.000Z`));
      if (mode === 'extra') Object.assign(value.patient.owner, { phone: '+7-private' });
      return json(response, 200, value, { 'Cache-Control': 'no-store, private' });
    }
    return json(response, 404, { code: 'NOT_FOUND' });
  });
  await new Promise<void>((resolve) => server.listen(mockPort, '127.0.0.1', resolve));
});
test.afterAll(async () => {
  release?.();
  releaseMutation?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
test.beforeEach(async ({ context }) => {
  mode = 'normal'; authority = 'allowed'; writeAuthority = true; mutationMode = 'success';
  release = null; releaseMutation = null; patchCalls = []; backendAuthorization = undefined;
  await addSession(context, [locationId, otherLocationId]);
});

test('default-off detail page and BFF are absent', async ({ page }) => {
  test.skip(rolloutEnabled, 'rollback-only check');
  await page.goto(route(patientId));
  await expect(page.getByRole('heading', { name: /Барни|Карточка пациента/ })).toHaveCount(0);
  expect((await page.request.get(bff(patientId))).status()).toBe(404);
});

test.describe('enabled patient detail', () => {
  test.skip(!rolloutEnabled, 'enabled-only checks');

  test('Registry navigation and direct deep link render only the administrative allowlist', async ({ page }) => {
    await page.goto(registryRoute());
    const link = page.getByRole('link', { name: 'Открыть карточку пациента Барни' });
    await expect(link).toBeVisible();
    await link.focus();
    await page.keyboard.press('Enter');
    await ready(page);
    await expect(page.getByText('Владелец не указан')).toBeVisible();
    await expect(page.getByText('Сибирская')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Административная связь' })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Открыть запись' })).toHaveCount(3);
    await expect(page.getByText(/73333333|owner|phone|email|diagnos|аллерг|медкарт|документ|payment|consent|revision/i)).toHaveCount(0);
    expect(backendAuthorization).toMatch(/^Bearer /);
  });

  test('rechecks capability and exact scope for deep links and bounds malformed patient IDs', async ({ page, context }) => {
    authority = 'denied';
    await page.goto(route(patientId));
    await expect(page.getByRole('heading', { name: 'Нет доступа к карточке пациента' })).toBeVisible();
    authority = 'allowed';
    await context.clearCookies();
    await addSession(context, [locationId]);
    await page.goto(`/clinics/${clinicId}/locations/${otherLocationId}/patients/${patientId}`);
    await expect(page.getByRole('heading', { name: 'Нет доступа к карточке пациента' })).toBeVisible();
    await page.goto(`/clinics/${otherClinicId}/locations/${locationId}/patients/${patientId}`);
    await expect(page.getByRole('heading', { name: 'Нет доступа к карточке пациента' })).toBeVisible();
    await page.goto(route('not-a-uuid'));
    await expect(page.getByRole('heading', { name: 'Карточка пациента' })).toBeVisible();
    await expect(page.getByText('Карточка недоступна или больше не существует.')).toBeVisible();
    expect((await page.request.get(bff('not-a-uuid'))).status()).toBe(404);
  });

  test('distinguishes no-leak, policy, technical and malformed states without raw payloads', async ({ page }) => {
    for (const value of ['not-found', 'denied', 'policy', 'error', 'transport', 'malformed'] as Mode[]) {
      mode = value;
      await page.goto(route(patientId));
      if (value === 'not-found') await expect(page.getByText('Карточка недоступна или больше не существует.')).toBeVisible();
      if (value === 'denied') await expect(page.getByText('Нет доступа к карточке пациента')).toBeVisible();
      if (value === 'policy') await expect(page.getByText('Карточка временно недоступна')).toBeVisible();
      if (value === 'error' || value === 'transport') await expect(page.getByText('Это техническая ошибка, а не отсутствие пациента.')).toBeVisible();
      if (value === 'malformed') await expect(page.getByText('Ответ сервиса имеет неподдерживаемый формат. Данные не показаны.')).toBeVisible();
      await expect(page.getByText(/PRIVATE_|privatePatientName|internalPolicy/i)).toHaveCount(0);
    }
  });

  test('strict parser rejects scope, identity, calendar, duplicate, order, bounds and forbidden nested fields', async ({ page }) => {
    for (const value of ['wrong-scope', 'wrong-patient', 'impossible-date', 'duplicate', 'unordered', 'too-many', 'extra'] as Mode[]) {
      mode = value;
      await page.goto(route(patientId));
      await expect(page.getByText('Не удалось проверить данные карточки')).toBeVisible();
      await expect(page.getByText('Барни')).toHaveCount(0);
      await expect(page.getByText(/\+7-private/)).toHaveCount(0);
    }
  });

  test('manual refresh preserves valid data on technical failure but removes it on revoke', async ({ page }) => {
    await open(page);
    const button = page.getByRole('button', { name: 'Обновить карточку' });
    await button.focus();
    mode = 'delayed';
    await button.click();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Обновляем…' })).toBeFocused();
    mode = 'normal';
    release?.();
    await expect(page.getByRole('button', { name: 'Обновить карточку' })).toBeEnabled();
    mode = 'error';
    await page.getByRole('button', { name: 'Обновить карточку' }).click();
    await expect(page.getByText('Обновление проверить не удалось')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    mode = 'not-found';
    await page.getByRole('button', { name: 'Обновить карточку' }).click();
    await expect(page.getByText('Карточка недоступна или больше не существует.')).toBeFocused();
    await expect(page.getByText('Барни')).toHaveCount(0);
  });

  test('back navigation works and browser bearer cannot replace the Clinic session', async ({ page }) => {
    await open(page);
    await page.getByRole('link', { name: 'Вернуться к пациентам' }).click();
    await expect(page.getByRole('heading', { name: 'Пациенты', exact: true })).toBeVisible();
    const response = await page.request.get(bff(patientId), {
      headers: { Authorization: 'Bearer browser-token' },
    });
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toMatch(/browser-token|VETHELP_API_BASE_URL/);
  });

  test('loading, keyboard, axe, reduced motion, 200% text and responsive screenshots pass', async ({ page }, testInfo) => {
    mode = 'delayed';
    await page.goto(route(patientId));
    await expect(page.getByLabel('Загрузка карточки пациента')).toBeVisible();
    mode = 'normal';
    release?.();
    await ready(page);
    await page.getByRole('link', { name: 'Вернуться к пациентам' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Обновить карточку' })).toBeFocused();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    await attach(page, testInfo, 'patient-detail-desktop');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { name: 'Записи', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await attach(page, testInfo, 'patient-detail-mobile');
  });
});

test.describe('local alias workflow', () => {
  test.skip(!rolloutEnabled, 'registry-enabled checks');

  test('shows alias separately and gates editing by flag and capability', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('heading', { name: 'Имя в клинике' })).toBeVisible();
    await expect(page.getByText('Не задано', { exact: true })).toBeVisible();
    await expect(page.getByText(/не изменяет официальное имя/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Изменить имя в клинике' })).toHaveCount(mutationsEnabled ? 1 : 0);
    const probe = await page.request.patch(
      `/api/clinic/${mutationsEnabled ? otherClinicId : clinicId}/locations/${locationId}/patients/${patientId}/local-profile`,
      { headers: { 'If-Match': '"0"', 'Idempotency-Key': '75555555-5555-4555-8555-555555555555' }, data: { alias: 'probe' } },
    );
    expect(probe.status()).toBe(404);
    expect(patchCalls).toHaveLength(0);
    if (mutationsEnabled) {
      writeAuthority = false;
      await page.reload();
      await ready(page);
      await expect(page.getByRole('button', { name: 'Изменить имя в клинике' })).toHaveCount(0);
      await expect(page.getByText('Не задано', { exact: true })).toBeVisible();
    }
  });

  test('sets, replaces and clears alias with authoritative versions and UUID intent keys', async ({ page }) => {
    test.skip(!mutationsEnabled, 'mutation-enabled check');
    await open(page);
    await editAlias(page, '  Ле\u0308ва  ');
    await expect(page.getByText('Лёва', { exact: true })).toBeVisible();
    await expect(page.getByText(/Обновлено:/)).toBeVisible();
    expect(patchCalls[0]).toMatchObject({ ifMatch: '"0"', body: { alias: 'Лёва' } });
    expect(patchCalls[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(patchCalls[0].path).toContain(`/${clinicId}/locations/${locationId}/patients/${patientId}/local-profile`);
    await editAlias(page, 'Бонни');
    expect(patchCalls[1]).toMatchObject({ ifMatch: '"1"', body: { alias: 'Бонни' } });
    expect(patchCalls[1].idempotencyKey).not.toBe(patchCalls[0].idempotencyKey);
    await page.getByRole('button', { name: 'Изменить имя в клинике' }).click();
    await page.getByRole('button', { name: 'Очистить имя в клинике' }).click();
    await expect(page.getByText('Имя в клинике удалено.')).toBeVisible();
    expect(patchCalls[2].body).toEqual({ alias: null });
  });

  test('validates blank, Unicode length, newline and controls before PATCH', async ({ page }) => {
    test.skip(!mutationsEnabled, 'mutation-enabled check');
    await open(page);
    await page.getByRole('button', { name: 'Изменить имя в клинике' }).click();
    const input = page.getByRole('textbox', { name: 'Имя в клинике' });
    for (const [value, message] of [
      ['   ', 'Имя не может быть пустым.'],
      ['я'.repeat(81), 'Введите имя длиной до 80 символов.'],
      ['строка\nдва', 'Переносы строк не поддерживаются.'],
      [`имя${String.fromCharCode(7)}`, 'Некоторые символы не поддерживаются.'],
    ]) {
      await input.fill(value);
      await page.getByRole('button', { name: 'Сохранить' }).click();
      await expect(page.getByText(message)).toBeVisible();
    }
    expect(patchCalls).toHaveLength(0);
  });

  test('blocks double submit and reuses one key for a technical retry', async ({ page }) => {
    test.skip(!mutationsEnabled, 'mutation-enabled check');
    await open(page);
    await page.getByRole('button', { name: 'Изменить имя в клинике' }).click();
    await page.getByRole('textbox', { name: 'Имя в клинике' }).fill('Кнопка');
    mutationMode = 'delayed';
    await page.getByRole('button', { name: 'Сохранить' }).dblclick();
    await expect(page.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled();
    expect(patchCalls).toHaveLength(1);
    mutationMode = 'transport';
    releaseMutation?.();
    await expect(page.getByText(/Последние подтверждённые данные не изменены/)).toBeVisible();
    const firstKey = patchCalls[0].idempotencyKey;
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect.poll(() => patchCalls.length).toBe(2);
    expect(patchCalls[1].idempotencyKey).toBe(firstKey);
    await page.getByRole('textbox', { name: 'Имя в клинике' }).fill('Новый payload');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect.poll(() => patchCalls.length).toBe(3);
    expect(patchCalls[2].idempotencyKey).not.toBe(firstKey);
  });

  test('refreshes without resubmit on stale and removes controls or data on authority changes', async ({ page }) => {
    test.skip(!mutationsEnabled, 'mutation-enabled check');
    await open(page);
    mutationMode = 'stale';
    await editAlias(page, 'Конфликт', false);
    await expect(page.getByText(/Карточка обновлена/)).toBeVisible();
    expect(patchCalls).toHaveLength(1);
    mutationMode = 'denied';
    await editAlias(page, 'Запрет', false);
    await expect(page.getByRole('button', { name: 'Изменить имя в клинике' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
  });

  test('preserves snapshot on policy, transport and malformed success, mapping validation to field', async ({ page }) => {
    test.skip(!mutationsEnabled, 'mutation-enabled check');
    await open(page);
    for (const [failure, message] of [
      ['policy', 'Не удалось проверить доступ к изменению. Попробуйте ещё раз.'],
      ['transport', 'Последние подтверждённые данные не изменены'],
      ['malformed', 'Последние подтверждённые данные не изменены'],
      ['validation', 'Не удалось сохранить имя. Проверьте значение'],
    ] as const) {
      mutationMode = failure;
      if (!(await page.getByRole('dialog').count())) {
        await page.getByRole('button', { name: 'Изменить имя в клинике' }).click();
      }
      await page.getByRole('textbox', { name: 'Имя в клинике' }).fill(`Проверка ${failure}`);
      await page.getByRole('button', { name: 'Сохранить' }).click();
      await expect(page.getByText(new RegExp(message))).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
      await expect(page.getByText('Не задано', { exact: true })).toBeVisible();
    }
    await expect(page.getByText('PRIVATE_RAW')).toHaveCount(0);
  });

  test('moves to no-leak state and supports focus, Escape, axe and narrow layout', async ({ page }) => {
    test.skip(!mutationsEnabled, 'mutation-enabled check');
    await open(page);
    const edit = page.getByRole('button', { name: 'Изменить имя в клинике' });
    await edit.click();
    await expect(page.getByRole('textbox', { name: 'Имя в клинике' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(edit).toBeFocused();
    await edit.click();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.setViewportSize({ width: 1024, height: 768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole('textbox', { name: 'Имя в клинике' }).fill('Недоступен');
    mutationMode = 'not-found';
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Карточка недоступна или больше не существует.')).toBeFocused();
    await expect(page.getByText('Барни')).toHaveCount(0);
  });
});

async function addSession(context: BrowserContext, locations: string[]) {
  const token = await new SignJWT({ roles: ['CLINIC_RECEPTIONIST'], clinicIds: [clinicId], locationIds: locations })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('clinic-user').setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(jwtSecret));
  await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: test.info().project.use.baseURL as string }]);
}
const route = (patient: string) => `/clinics/${clinicId}/locations/${locationId}/patients/${patient}`;
const registryRoute = () => `/clinics/${clinicId}/locations/${locationId}/patients`;
const bff = (patient: string) => `/api/clinic/${clinicId}/locations/${locationId}/patients/${patient}`;
async function editAlias(page: Page, value: string, expectSuccess = true) {
  await page.getByRole('button', { name: 'Изменить имя в клинике' }).click();
  await page.getByRole('textbox', { name: 'Имя в клинике' }).fill(value);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  if (expectSuccess) await expect(page.getByText(/Имя в клинике сохранено/)).toBeVisible();
}
async function open(page: Page) { await page.goto(route(patientId)); await ready(page); }
async function ready(page: Page) {
  await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
  await expect(page.getByLabel('Загрузка карточки пациента')).toHaveCount(0);
}
function registry() {
  return {
    clinicId, locationId, serverNow: '2026-07-25T09:00:00.000Z',
    items: [{
      patientId, pet: { displayName: 'Барни', speciesLabel: 'Собака', breed: 'Сибирская', sexCode: 'MALE', birthDate: '2020-02-29' },
      owner: { displayName: null }, relationship: { firstSeenAt: '2025-01-10T09:00:00.000Z', lastSeenAt: '2026-07-20T09:00:00.000Z' },
      appointments: { lastVisitAt: '2026-07-20T09:00:00.000Z', nextAppointmentAt: null },
    }], nextCursor: null,
  };
}
function summary(id: string, startsAt: string) {
  return {
    appointmentId: id, startsAt, endsAt: startsAt.replace('09:00', '09:30'), statusCode: 'COMPLETED',
    statusLabel: 'Завершена', service: { displayName: 'Приём' }, veterinarian: { displayName: null },
  };
}
function detail() {
  return {
    clinicId, locationId, serverNow: '2026-07-25T09:00:00.000Z',
    patient: {
      patientId, pet: { displayName: 'Барни', speciesLabel: 'Собака', breed: 'Сибирская', sexCode: 'MALE', birthDate: '2020-02-29' },
      owner: { displayName: null }, relationship: { firstSeenAt: '2025-01-10T09:00:00.000Z', lastSeenAt: '2026-07-20T09:00:00.000Z' },
      appointments: {
        last: summary(appointmentA, '2026-07-20T09:00:00.000Z'),
        next: summary(appointmentB, '2026-07-26T09:00:00.000Z'),
        recent: [summary(appointmentA, '2026-07-20T09:00:00.000Z')],
      },
      localProfile: { alias: null, aggregateVersion: 0, updatedAt: null },
    },
  };
}
function json(response: import('node:http').ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}
async function attach(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
