import { createServer, type Server } from 'node:http';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { SignJWT } from 'jose';

const clinicId = '71111111-1111-4111-8111-111111111111';
const otherClinicId = '71111111-1111-4111-8111-111111111112';
const locationId = '72222222-2222-4222-8222-222222222222';
const otherLocationId = '72222222-2222-4222-8222-222222222223';
const patientA = '73333333-3333-4333-8333-333333333331';
const patientB = '73333333-3333-4333-8333-333333333332';
const jwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET ?? 'clinic-e2e-secret-at-least-32-bytes';
const rolloutEnabled = process.env.VETHELP_CLINIC_PATIENTS_REGISTRY === 'true';
const referenceSearchEnabled = process.env.VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH === 'true';
const mockPort = Number(process.env.CLINIC_PORTAL_MOCK_PORT ?? 3212);

type Mode = 'normal' | 'empty' | 'error' | 'malformed' | 'impossible-date' | 'duplicate'
  | 'wrong-scope' | 'page-malformed' | 'rate' | 'search-unavailable' | 'delayed'
  | 'reference-invalid' | 'reference-combination' | 'reference-invariant'
  | 'unauthenticated' | 'denied' | 'scope-unavailable';
let server: Server;
let mode: Mode = 'normal';
let authority: 'allowed' | 'denied' = 'allowed';
let requestedQ: string | null = null;
let requestedCursor: string | null = null;
let requestedReference: string | null = null;
let patientRequests = 0;
let releaseDelayed: (() => void) | null = null;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${mockPort}`);
    if (url.pathname === '/v1/auth/session') return json(response, 200, {
      subjectId: 'clinic-user',
      roles: ['CLINIC_RECEPTIONIST'],
      effectiveCapabilities: authority === 'allowed' ? ['patient.admin.read'] : [],
      clinicScopes: [{ clinicId, locationId }, { clinicId, locationId: otherLocationId }],
    });
    if (url.pathname.endsWith('/patients')) {
      patientRequests += 1;
      requestedQ = url.searchParams.get('q');
      requestedCursor = url.searchParams.get('cursor');
      requestedReference = url.searchParams.get('administrativeReference');
      if (mode === 'delayed') await new Promise<void>((resolve) => { releaseDelayed = resolve; });
      if (mode === 'error') return json(response, 500, { code: 'PRIVATE_SQL_DETAIL' });
      if (mode === 'reference-invalid' && requestedReference) return json(response, 400, { code: 'INVALID_ADMINISTRATIVE_REFERENCE_QUERY' });
      if (mode === 'reference-combination' && requestedReference) return json(response, 400, { code: 'INVALID_SEARCH_COMBINATION' });
      if (mode === 'reference-invariant' && requestedReference) return json(response, 503, { code: 'SEARCH_INVARIANT_VIOLATION' });
      if (mode === 'unauthenticated' && requestedReference) return json(response, 401, { code: 'AUTHENTICATION_REQUIRED' });
      if (mode === 'denied' && requestedReference) return json(response, 403, { code: 'ACTION_NOT_PERMITTED' });
      if (mode === 'scope-unavailable' && requestedReference) return json(response, 404, { code: 'REGISTRY_SCOPE_UNAVAILABLE' });
      if (mode === 'rate' && requestedQ) return json(response, 429, { code: 'PRIVATE_RATE' }, { 'Retry-After': '7' });
      if (mode === 'search-unavailable' && (requestedQ || requestedReference)) return json(response, 503, { code: 'PRIVATE_POLICY' });
      if (mode === 'malformed') return json(response, 200, { clinicId, locationId, items: 'raw-secret', nextCursor: null });
      if (mode === 'wrong-scope') return json(response, 200, snapshot(otherLocationId, []));
      if (mode === 'empty' || requestedQ === 'Нет' || requestedReference === 'NONE-1') return json(response, 200, snapshot(pathLocation(url), []));
      if (requestedCursor) {
        if (mode === 'page-malformed') return json(response, 200, { ...snapshot(pathLocation(url), []), items: [{ raw: 'secret' }] });
        return json(response, 200, snapshot(pathLocation(url), [patient(patientB, 'Луна')]));
      }
      const first = patient(patientA, requestedQ ? 'Барни' : 'Барни');
      if (requestedReference) first.administrativeReference = requestedReference;
      if (mode === 'impossible-date') first.pet.birthDate = '2026-02-30';
      const items = mode === 'duplicate' ? [first, first] : [first];
      return json(response, 200, {
        ...snapshot(pathLocation(url), items),
        nextCursor: mode === 'normal' || mode === 'page-malformed' ? 'opaque+/=patients.cursor' : null,
      });
    }
    return json(response, 404, { code: 'NOT_FOUND' });
  });
  await new Promise<void>((resolve) => server.listen(mockPort, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  releaseDelayed?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.beforeEach(async ({ context }) => {
  mode = 'normal';
  authority = 'allowed';
  requestedQ = null;
  requestedCursor = null;
  requestedReference = null;
  patientRequests = 0;
  releaseDelayed = null;
  await addSession(context, [locationId, otherLocationId]);
});

test('default-off route is absent', async ({ page }) => {
  test.skip(rolloutEnabled, 'rollback-only check');
  await page.goto(route(locationId));
  await expect(page.getByRole('heading', { name: 'Пациенты', exact: true })).toHaveCount(0);
  const bff = await page.request.get(`/api/clinic/${clinicId}/locations/${locationId}/patients`);
  expect(bff.status()).toBe(404);
});

test('L-01/L-02 independent reference flag keeps ordinary Registry as default', async ({ page }) => {
  test.skip(!rolloutEnabled || referenceSearchEnabled, 'reference rollback-only check');
  await open(page);
  await expect(page.getByRole('radio', { name: 'Внутренний номер' })).toHaveCount(0);
  await expect(page.getByLabel('Поиск по имени питомца')).toBeVisible();
  expect(requestedReference).toBeNull();
});

test.describe('enabled patients registry', () => {
  test.skip(!rolloutEnabled, 'enabled-only checks');

  test('renders only safe administrative fields and nullable owner', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    await expect(page.getByText('Владелец не указан')).toBeVisible();
    await expect(page.getByText('Сибирская')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Открыть реестр пациентов' }).first()).toBeVisible();
    await expect(page.getByText(/private|\\+7-private|diagnosis|ownerPhone|73333333/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Открыть карточку пациента Барни' })).toBeVisible();
  });

  test('denies missing capability and URL location tampering without rows', async ({ page, context }) => {
    authority = 'denied';
    await page.goto(route(locationId));
    await expect(page.getByRole('heading', { name: 'Нет доступа к пациентам этой локации' })).toBeVisible();
    await expect(page.getByText('Барни')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Открыть реестр пациентов' })).toHaveCount(0);
    await context.clearCookies();
    await addSession(context, [locationId]);
    await page.goto(route(otherLocationId));
    await expect(page.getByRole('heading', { name: 'Нет доступа к пациентам этой локации' })).toBeVisible();
    await page.goto(`/clinics/${otherClinicId}/locations/${locationId}/patients`);
    await expect(page.getByRole('heading', { name: 'Нет доступа к пациентам этой локации' })).toBeVisible();
  });

  test('distinguishes business empty, search no-results, and technical error', async ({ page }) => {
    mode = 'empty';
    await open(page);
    await expect(page.getByRole('heading', { name: 'В этой локации пока нет доступных пациентов.' })).toBeVisible();
    mode = 'normal';
    await page.getByLabel('Поиск по имени питомца').fill('Нет');
    await expect(page.getByRole('heading', { name: 'По этому имени пациенты не найдены.' })).toBeVisible();
    mode = 'error';
    await page.getByRole('button', { name: 'Обновить список' }).click();
    await expect(page.getByText('Обновление проверить не удалось')).toBeVisible();
    await expect(page.getByText(/PRIVATE_SQL_DETAIL/)).toHaveCount(0);
  });

  test('debounces normalized prefix search, clears it, and never sends invalid input', async ({ page }) => {
    await open(page);
    await page.getByLabel('Поиск по имени питомца').fill('  Ｂа  ');
    await expect.poll(() => requestedQ).toBe('Bа');
    await page.getByRole('button', { name: 'Очистить' }).click();
    await expect.poll(() => requestedQ).toBeNull();
    await page.getByLabel('Поиск по имени питомца').fill('x');
    await page.waitForTimeout(500);
    expect(requestedQ).toBeNull();
    await expect(page.getByText('Введите от 2 до 80 символов.')).toBeVisible();
  });

  test('preserves snapshot for search 503 and rate limit with Retry-After', async ({ page }) => {
    await open(page);
    mode = 'search-unavailable';
    await page.getByLabel('Поиск по имени питомца').fill('Ба');
    await expect(page.getByText('Поиск временно недоступен. Полный список пациентов можно просматривать и обновлять.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    mode = 'rate';
    await page.getByLabel('Поиск по имени питомца').fill('Лу');
    await expect(page.getByText(/примерно через 7 сек/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
  });

  test('uses opaque cursor, preserves ordering, prevents duplicate append request', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Показать ещё' }).dblclick();
    await expect(page.getByRole('listitem')).toHaveCount(2);
    expect(requestedCursor).toBe('opaque+/=patients.cursor');
    const rows = await page.getByRole('listitem').allTextContents();
    expect(rows[0]).toContain('Барни');
    expect(rows[1]).toContain('Луна');
  });

  test('malformed next page preserves snapshot; malformed initial payloads fail closed', async ({ page }) => {
    mode = 'page-malformed';
    await open(page);
    await page.getByRole('button', { name: 'Показать ещё' }).click();
    await expect(page.getByText('Следующую страницу проверить не удалось')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    for (const bad of ['malformed', 'impossible-date', 'duplicate', 'wrong-scope'] as Mode[]) {
      mode = bad;
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Не удалось загрузить пациентов' })).toBeVisible();
      await expect(page.getByText(/raw-secret/)).toHaveCount(0);
    }
  });

  test('manual refresh and generation fencing keep last valid snapshot', async ({ page }) => {
    await open(page);
    mode = 'delayed';
    await page.getByRole('button', { name: 'Обновить список' }).click();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    mode = 'normal';
    await page.getByLabel('Поиск по имени питомца').fill('Лу');
    releaseDelayed?.();
    await expect.poll(() => requestedQ).toBe('Лу');
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
  });

  test('supports keyboard, axe, 200% text and responsive screenshots', async ({ page }, testInfo) => {
    await open(page);
    await page.getByLabel('Поиск по имени питомца').focus();
    await page.keyboard.type('Ба');
    await expect.poll(() => requestedQ).toBe('Ба');
    await page.getByRole('button', { name: 'Обновить список' }).focus();
    await page.keyboard.press('Enter');
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    await attach(page, testInfo, 'patients-desktop');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('listitem')).toBeVisible();
    await attach(page, testInfo, 'patients-mobile');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('L-01..L-10/L-32 submit-only exact mode normalizes request and excludes cursor/q', async ({ page }) => {
    test.skip(!referenceSearchEnabled, 'reference-enabled check');
    await open(page);
    const baseline = patientRequests;
    await page.getByRole('radio', { name: 'Внутренний номер' }).click();
    const field = page.getByLabel('Внутренний номер', { exact: true });
    await expect(field).toBeFocused();
    await field.fill('  Pe\u0301T   004  ');
    expect(patientRequests).toBe(baseline);
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect.poll(() => requestedReference).toBe('PéT 004');
    expect(requestedQ).toBeNull();
    expect(requestedCursor).toBeNull();
    await expect(page.getByText('PéT 004', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    await expect(page.getByText('Сибирская')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Показать ещё' })).toHaveCount(0);
  });

  test('L-11..L-13 rejects blank, controls, invalid characters and over-40 without requests', async ({ page }) => {
    test.skip(!referenceSearchEnabled, 'reference-enabled check');
    await open(page);
    await page.getByRole('radio', { name: 'Внутренний номер' }).click();
    const field = page.getByLabel('Внутренний номер', { exact: true });
    const baseline = patientRequests;
    for (const [value, message] of [
      ['', 'Введите внутренний номер.'],
      ['PET*1', 'Используйте только буквы, цифры, пробел, -, _, / и точку.'],
      ['PET\u007f1', 'Переносы строк и управляющие символы не поддерживаются.'],
      ['Я'.repeat(41), 'Внутренний номер может содержать до 40 символов.'],
    ]) {
      await field.fill(value);
      await page.getByRole('button', { name: 'Найти' }).click();
      await expect(page.getByText(message)).toBeVisible();
    }
    expect(patientRequests).toBe(baseline);
  });

  test('L-14..L-19 exact item, neutral empty and clear restore ordinary pagination', async ({ page }) => {
    test.skip(!referenceSearchEnabled, 'reference-enabled check');
    await open(page);
    await page.getByRole('radio', { name: 'Внутренний номер' }).click();
    await page.getByLabel('Внутренний номер', { exact: true }).fill('NONE-1');
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByRole('heading', { name: 'Пациент с таким внутренним номером не найден в этой локации.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Пациент с таким внутренним номером не найден в этой локации.' })
      .locator('..')).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByText('Проверьте номер или выберите другую локацию.')).toBeVisible();
    await expect(page.getByText(/другой клинике|нет доступа|архивирован|согласие/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Очистить' }).click();
    await expect(page.getByLabel('Поиск по имени питомца')).toBeVisible();
    await expect(page.getByLabel('Поиск по имени питомца')).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Показать ещё' })).toBeVisible();
    expect(requestedReference).toBeNull();
  });

  test('L-20/L-21 pending fences duplicate submit and stale response after clear', async ({ page }) => {
    test.skip(!referenceSearchEnabled, 'reference-enabled check');
    await open(page);
    await page.getByRole('radio', { name: 'Внутренний номер' }).click();
    await page.getByLabel('Внутренний номер', { exact: true }).fill('PET-1');
    mode = 'delayed';
    const baseline = patientRequests;
    await page.getByRole('button', { name: 'Найти' }).dblclick();
    await expect(page.getByRole('button', { name: 'Ищем…' })).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('Выполняется поиск по внутреннему номеру.');
    expect(patientRequests).toBe(baseline + 1);
    await page.getByRole('button', { name: 'Очистить' }).click();
    mode = 'normal';
    releaseDelayed?.();
    await expect(page.getByLabel('Поиск по имени питомца')).toBeVisible();
    await expect(page.getByText('PET-1', { exact: true })).toHaveCount(0);
  });

  test('L-22 current location change clears reference state and does not replay query', async ({ page }) => {
    test.skip(!referenceSearchEnabled, 'reference-enabled check');
    await open(page);
    await page.getByRole('radio', { name: 'Внутренний номер' }).click();
    await page.getByLabel('Внутренний номер', { exact: true }).fill('PET-1');
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect.poll(() => requestedReference).toBe('PET-1');
    requestedReference = null;
    await page.goto(route(otherLocationId));
    await expect(page.getByLabel('Поиск по имени питомца')).toBeVisible();
    expect(requestedReference).toBeNull();
  });

  test('L-23..L-30 maps safe failures, preserves snapshot and retries exact query', async ({ page }) => {
    test.skip(!referenceSearchEnabled, 'reference-enabled check');
    await open(page);
    await page.getByRole('radio', { name: 'Внутренний номер' }).click();
    const field = page.getByLabel('Внутренний номер', { exact: true });
    await field.fill('PET-1');
    mode = 'reference-invalid';
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText('Используйте только буквы, цифры, пробел, -, _, / и точку.')).toBeVisible();
    mode = 'reference-combination';
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText(/текущими параметрами/)).toBeVisible();
    mode = 'reference-invariant';
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText('Поиск временно недоступен. Попробуйте позже.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Повторить поиск' })).toBeVisible();
    mode = 'search-unavailable';
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText('Не удалось проверить доступ к пациентам. Попробуйте ещё раз.')).toBeVisible();
    mode = 'error';
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText(/последний подтверждённый список/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    mode = 'malformed';
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText(/последний подтверждённый список/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
    mode = 'normal';
    await page.getByRole('button', { name: 'Повторить поиск' }).click();
    await expect.poll(() => requestedReference).toBe('PET-1');
  });

  test('L-25 authority errors remove query result without existence leakage', async ({ page }) => {
    test.skip(!referenceSearchEnabled, 'reference-enabled check');
    for (const failure of ['unauthenticated', 'denied', 'scope-unavailable'] as Mode[]) {
      mode = 'normal';
      await open(page);
      await page.getByRole('radio', { name: 'Внутренний номер' }).click();
      await page.getByLabel('Внутренний номер', { exact: true }).fill('PET-SECRET');
      mode = failure;
      await page.getByRole('button', { name: 'Найти' }).click();
      await expect(page.getByText(/PET-SECRET|Барни/)).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Не удалось загрузить пациентов' })).toBeVisible();
    }
  });

  test('L-33/L-34 keyboard, axe and 1440/1024/390 layouts remain accessible', async ({ page }) => {
    test.skip(!referenceSearchEnabled, 'reference-enabled check');
    await open(page);
    await page.getByRole('radio', { name: 'Внутренний номер' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Внутренний номер', { exact: true })).toBeFocused();
    await page.keyboard.type('PET-1');
    await page.keyboard.press('Enter');
    await expect.poll(() => requestedReference).toBe('PET-1');
    await page.getByRole('button', { name: 'Очистить' }).click();
    await expect(page.getByLabel('Поиск по имени питомца')).toBeFocused();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('heading', { name: 'Барни' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  });
});

async function addSession(context: BrowserContext, locations: string[]) {
  const token = await new SignJWT({
    roles: ['CLINIC_RECEPTIONIST'], clinicIds: [clinicId], locationIds: locations,
  }).setProtectedHeader({ alg: 'HS256' }).setSubject('clinic-user').setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(jwtSecret));
  await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: test.info().project.use.baseURL as string }]);
}

async function open(page: Page) {
  await page.goto(route(locationId));
  await expect(page.getByRole('heading', { name: 'Пациенты', exact: true })).toBeVisible();
  await expect(page.getByLabel('Загрузка пациентов')).toHaveCount(0);
}

const route = (location: string) => `/clinics/${clinicId}/locations/${location}/patients`;
const pathLocation = (url: URL) => url.pathname.split('/locations/')[1].split('/')[0];
function patient(patientId: string, displayName: string) {
  return {
    patientId,
    administrativeReference: null as string | null,
    pet: { displayName, speciesLabel: 'Собака', breed: 'Сибирская', sexCode: 'MALE', birthDate: '2020-02-29' },
    owner: { displayName: null },
    relationship: { firstSeenAt: '2025-01-10T09:00:00.000Z', lastSeenAt: '2026-07-20T09:00:00.000Z' },
    appointments: { lastVisitAt: '2026-07-20T09:00:00.000Z', nextAppointmentAt: null },
  };
}
function snapshot(location: string, items: unknown[]) {
  return { clinicId, locationId: location, serverNow: '2026-07-24T09:00:00.000Z', items, nextCursor: null };
}
function json(response: import('node:http').ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}
async function attach(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
