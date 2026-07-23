import { createServer, type Server } from 'node:http';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const otherClinicId = '11111111-1111-4111-8111-111111111112';
const locationId = '22222222-2222-4222-8222-222222222222';
const otherLocationId = '22222222-2222-4222-8222-222222222223';
const appointmentId = '44444444-4444-4444-8444-444444444441';
const otherAppointmentId = '44444444-4444-4444-8444-444444444442';
const petId = '33333333-3333-4333-8333-333333333333';
const jwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET ?? 'clinic-e2e-secret-at-least-32-bytes';
const rolloutEnabled = process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY === 'true';

type Mode = 'normal' | 'nullable' | 'unknown' | 'not-found' | 'forbidden' | 'error' | 'malformed'
  | 'impossible-date' | 'wrong-clinic' | 'wrong-location' | 'wrong-appointment' | 'actions' | 'delayed';

let server: Server;
let mode: Mode = 'normal';
let authority: 'allowed' | 'denied' = 'allowed';
let version = 7;
let statusCode = 'COMPLETED';
let releaseDelayed: (() => void) | null = null;
let detailRequests = 0;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:3212');
    if (url.pathname === '/v1/auth/session') {
      return json(response, 200, {
        subjectId: 'clinic-user',
        roles: ['CLINIC_RECEPTIONIST'],
        effectiveCapabilities: authority === 'allowed' ? ['appointment.registry.read'] : [],
        clinicScopes: [{ clinicId, locationId }],
      });
    }
    if (url.pathname.endsWith('/appointments')) {
      return json(response, 200, {
        clinicId, locationId, serverNow: '2026-07-23T09:00:00.123456Z', nextCursor: null,
        items: [{
          appointmentId, aggregateVersion: 1, statusCode: 'SCHEDULED', statusLabel: 'stale',
          slot: { startsAt: '2026-07-25T09:00:00.123456Z', endsAt: '2026-07-25T09:30:00.123456Z' },
          pet: { id: petId, name: 'Барни', speciesLabel: 'Собака' },
          service: { displayName: 'Терапевтический приём' },
        }],
      });
    }
    if (url.pathname.includes('/appointments/')) {
      detailRequests += 1;
      if (mode === 'delayed' && url.pathname.endsWith(appointmentId)) {
        await new Promise<void>((resolve) => { releaseDelayed = resolve; });
      }
      if (mode === 'not-found') return json(response, 404, { code: 'CLINIC_SCOPE_MISMATCH', appointmentId: 'private' });
      if (mode === 'forbidden') return json(response, 403, { code: 'CLINIC_SCOPE_MISMATCH', locationId: 'private' });
      if (mode === 'error') return json(response, 500, { code: 'PRIVATE_SQL_DETAIL', stack: 'private stack' });
      if (mode === 'malformed') return json(response, 200, { clinicId, locationId, appointment: null });
      const payload = detailPayload(url);
      if (mode === 'impossible-date') payload.schedule.startsAt = '2026-02-30T09:00:00Z';
      if (mode === 'wrong-clinic') payload.clinicId = otherClinicId;
      if (mode === 'wrong-location') payload.locationId = otherLocationId;
      if (mode === 'wrong-appointment') payload.appointment.appointmentId = otherAppointmentId;
      if (mode === 'actions') payload.availableActions = ['CANCEL'];
      return json(response, 200, payload);
    }
    json(response, 404, { code: 'NOT_FOUND' });
  });
  await new Promise<void>((resolve) => server.listen(3212, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  releaseDelayed?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.beforeEach(async ({ context }) => {
  mode = 'normal';
  authority = 'allowed';
  version = 7;
  statusCode = 'COMPLETED';
  releaseDelayed = null;
  detailRequests = 0;
  await session(context);
});

test('page and BFF are absent when rollout is disabled', async ({ page }) => {
  test.skip(rolloutEnabled, 'rollback-only check');
  await page.goto(route());
  await expect(page.getByRole('heading', { name: 'Карточка записи' })).toHaveCount(0);
  expect((await page.request.get(bff())).status()).toBe(404);
});

test.describe('enabled appointment detail', () => {
  test.skip(!rolloutEnabled, 'enabled-only checks');

  test('registry item opens the exact scoped detail route with authoritative detail', async ({ page }) => {
    await page.goto(registry());
    await page.getByRole('link', { name: 'Открыть запись' }).click();
    await ready(page);
    expect(page.url()).toContain(`/appointments/${appointmentId}`);
    await expect(page.getByText('Завершена').first()).toBeVisible();
    await expect(page.getByText('Запланирована')).toHaveCount(0);
  });

  test('supports direct URL and safe owner-null projection', async ({ page }) => {
    await open(page);
    await expect(page.getByText('Барни')).toBeVisible();
    await expect(page.getByText('Владелец не указан')).toBeVisible();
  });

  test('renders nullable service, veterinarian and resource placeholders', async ({ page }) => {
    mode = 'nullable';
    await open(page);
    await expect(page.getByText('Не указана', { exact: true })).toBeVisible();
    await expect(page.getByText('Не указан', { exact: true })).toHaveCount(2);
  });

  test('unknown backend and unexpected status are safe and textual', async ({ page }) => {
    mode = 'unknown';
    await open(page);
    await expect(page.getByText('Статус уточняется')).toHaveCount(2);
    await expect(page.getByText('FUTURE_PRIVATE_STATUS')).toHaveCount(0);
  });

  test('normalized 404 and 403 share a no-leak state', async ({ page }) => {
    for (const next of ['not-found', 'forbidden'] as const) {
      mode = next;
      await page.goto(`${route()}?case=${next}`);
      await expect(page.getByRole('heading', { name: 'Запись недоступна или не найдена' })).toBeVisible();
      await expect(page.getByText(/CLINIC_SCOPE|private/i)).toHaveCount(0);
      const direct = await page.request.get(bff());
      expect(direct.status()).toBe(next === 'not-found' ? 404 : 403);
      expect(await direct.text()).not.toMatch(/CLINIC_SCOPE|appointmentId|locationId|private/i);
    }
  });

  test('technical failure is distinct from no-leak and hides backend details', async ({ page }) => {
    mode = 'error';
    await page.goto(route());
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить запись' })).toBeVisible();
    await expect(page.getByText('Запись недоступна или не найдена')).toHaveCount(0);
    await expect(page.getByText(/PRIVATE_SQL|private stack/i)).toHaveCount(0);
    const direct = await page.request.get(bff());
    expect(direct.status()).toBe(500);
    expect(await direct.text()).not.toMatch(/PRIVATE_SQL|stack|SELECT|private/i);
  });

  for (const next of ['malformed', 'impossible-date', 'wrong-clinic', 'wrong-location', 'wrong-appointment', 'actions'] as const) {
    test(`malformed initial payload ${next} fails closed`, async ({ page }) => {
      mode = next;
      await page.goto(route());
      await expect(page.getByRole('heading', { name: 'Не удалось загрузить запись' })).toBeVisible();
      await expect(page.getByText('Барни')).toHaveCount(0);
    });
  }

  test('manual refresh replaces authoritative status while raw version stays hidden', async ({ page }) => {
    await open(page);
    version = 8;
    statusCode = 'NO_SHOW';
    await page.getByRole('button', { name: 'Обновить запись' }).click();
    await expect(page.getByText('Неявка').first()).toBeVisible();
    await expect(page.getByText(/version|aggregate|8/)).toHaveCount(0);
    expect(detailRequests).toBeGreaterThanOrEqual(2);
  });

  for (const next of ['error', 'malformed'] as const) {
    test(`failed ${next} refresh preserves last valid detail as degraded`, async ({ page }) => {
      await open(page);
      mode = next;
      await page.getByRole('button', { name: 'Обновить запись' }).click();
      await expect(page.getByText('Не удалось обновить запись')).toBeVisible();
      await expect(page.getByText('Барни')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Не удалось загрузить запись' })).toHaveCount(0);
    });
  }

  test('route change fences a delayed stale appointment response', async ({ page }) => {
    mode = 'delayed';
    const first = page.goto(route(appointmentId));
    await page.waitForTimeout(100);
    mode = 'normal';
    await page.goto(route(otherAppointmentId));
    releaseDelayed?.();
    await first.catch(() => undefined);
    await ready(page);
    expect(page.url()).toContain(otherAppointmentId);
    await expect(page.getByText('Луна')).toBeVisible();
    await expect(page.getByText('Барни')).toHaveCount(0);
  });

  test('page and BFF deny missing effective capability', async ({ page }) => {
    authority = 'denied';
    await page.goto(route());
    await expect(page.getByRole('heading', { name: 'Запись недоступна или не найдена' })).toBeVisible();
    expect((await page.request.get(bff())).status()).toBe(403);
  });

  test('cross-clinic and cross-location direct paths disclose no detail', async ({ page }) => {
    for (const path of [
      `/clinics/${otherClinicId}/locations/${locationId}/appointments/${appointmentId}`,
      `/clinics/${clinicId}/locations/${otherLocationId}/appointments/${appointmentId}`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Запись недоступна или не найдена' })).toBeVisible();
      await expect(page.getByText('Барни')).toHaveCount(0);
    }
  });

  test('renders no raw identifiers, enums, actions, clinical or financial fields', async ({ page }) => {
    await open(page);
    await expect(page.getByText(new RegExp(`${appointmentId}|${clinicId}|${locationId}|COMPLETED|private diagnosis|ownerPhone|payment|CANCEL`))).toHaveCount(0);
    await expect(page.getByRole('button', { name: /отменить|подтвердить|оплатить/i })).toHaveCount(0);
  });

  test('back navigation returns to registry', async ({ page }) => {
    await open(page);
    await page.getByRole('link', { name: 'Вернуться к записям' }).click();
    await expect(page.getByRole('heading', { name: 'Записи', exact: true })).toBeVisible();
  });

  test('keyboard flow and focused axe scan pass', async ({ page }) => {
    await open(page);
    await page.getByRole('link', { name: 'Вернуться к записям' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Обновить запись' })).toBeFocused();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  });

  test('keeps administrative facts visible at 200 percent text', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await open(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect(page.getByText('Барни')).toBeVisible();
    await expect(page.getByText('Завершена').first()).toBeVisible();
    await expect(page.getByText('Терапевтический приём')).toBeVisible();
  });

  test('captures desktop and mobile responsive evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await attachScreenshot(page, testInfo, 'appointment-detail-desktop');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { name: 'Карточка записи' })).toBeVisible();
    await expect(page.getByText('Владелец не указан')).toBeVisible();
    await attachScreenshot(page, testInfo, 'appointment-detail-mobile');
  });
});

function detailPayload(url: URL) {
  const currentAppointment = url.pathname.split('/appointments/')[1];
  const isOther = currentAppointment === otherAppointmentId;
  return {
    clinicId,
    locationId,
    serverNow: '2026-07-23T09:00:00.123456Z',
    appointment: {
      appointmentId: currentAppointment,
      aggregateVersion: version,
      statusCode: mode === 'unknown' ? 'FUTURE_PRIVATE_STATUS' : statusCode,
      statusLabel: 'raw backend label',
      createdAt: '2026-07-20T08:00:00.123456Z',
    },
    schedule: {
      startsAt: '2026-07-25T09:00:00.123456Z',
      endsAt: '2026-07-25T09:30:00.123456Z',
      timezone: 'Europe/Moscow',
      sourceLabel: 'Вручную',
    },
    owner: null,
    pet: { id: petId, displayName: isOther ? 'Луна' : 'Барни', speciesLabel: 'Собака' },
    service: mode === 'nullable' ? null : { displayName: 'Терапевтический приём' },
    veterinarian: mode === 'nullable' ? null : { displayName: 'Доктор Айболит' },
    resource: mode === 'nullable' ? null : { displayName: 'Кабинет 1' },
    availableActions: [] as string[],
    ownerPhone: '+7-private',
    clinicalSummary: 'private diagnosis',
    payment: { amount: 1000 },
  };
}

async function session(context: BrowserContext) {
  const token = await new SignJWT({
    roles: ['CLINIC_RECEPTIONIST'],
    clinicIds: [clinicId],
    locationIds: [locationId],
  }).setProtectedHeader({ alg: 'HS256' }).setSubject('clinic-user').setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(jwtSecret));
  const baseURL = test.info().project.use.baseURL as string;
  await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL }]);
}

async function open(page: Page) {
  await page.goto(route());
  await ready(page);
}

async function ready(page: Page) {
  await expect(page.getByRole('heading', { name: 'Карточка записи' })).toBeVisible();
  await expect(page.getByText('Загружаем запись…')).toHaveCount(0);
}

const route = (id = appointmentId) => `/clinics/${clinicId}/locations/${locationId}/appointments/${id}`;
const registry = () => `/clinics/${clinicId}/locations/${locationId}/appointments`;
const bff = () => `/api/clinic/${clinicId}/locations/${locationId}/appointments/${appointmentId}`;

function json(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
