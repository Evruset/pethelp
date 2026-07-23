import { createServer, type Server } from 'node:http';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const otherLocationId = '22222222-2222-4222-8222-222222222223';
const petId = '33333333-3333-4333-8333-333333333333';
const appointmentA = '44444444-4444-4444-8444-444444444441';
const appointmentB = '44444444-4444-4444-8444-444444444442';
const appointmentC = '44444444-4444-4444-8444-444444444443';
const jwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET ?? 'clinic-e2e-secret-at-least-32-bytes';
const rolloutEnabled = process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY === 'true';

type Mode = 'normal' | 'empty' | 'error' | 'malformed' | 'duplicate' | 'wrong-scope'
  | 'unknown' | 'second-malformed' | 'second-cursor-error' | 'forbidden' | 'delayed';

let server: Server;
let mode: Mode = 'normal';
let requestedBucket = '';
let requestedCursor: string | null = null;
let releaseDelayed: (() => void) | null = null;
let authorityMode: 'allowed' | 'missing-capability' | 'veterinarian' = 'allowed';

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:3212');
    if (url.pathname === '/v1/auth/session') {
      return json(response, 200, {
        subjectId: 'clinic-user',
        roles: authorityMode === 'veterinarian' ? ['CLINIC_VETERINARIAN'] : ['CLINIC_RECEPTIONIST'],
        effectiveCapabilities: authorityMode === 'allowed' ? ['appointment.registry.read'] : [],
        clinicScopes: [
          { clinicId, locationId },
          { clinicId, locationId: otherLocationId },
        ],
      });
    }
    if (url.pathname.endsWith('/appointments')) {
      requestedBucket = url.searchParams.get('bucket') ?? '';
      requestedCursor = url.searchParams.get('cursor');
      if (mode === 'delayed' && url.pathname.includes(locationId)) {
        await new Promise<void>((resolve) => { releaseDelayed = resolve; });
      }
      if (mode === 'error') return json(response, 500, { code: 'PRIVATE_SQL_DETAIL' });
      if (mode === 'forbidden') return json(response, 403, { code: 'CLINIC_SCOPE_MISMATCH', locationId: 'private' });
      if (mode === 'second-cursor-error' && requestedCursor) return json(response, 400, { code: 'INVALID_APPOINTMENT_REGISTRY_CURSOR', cursor: 'private' });
      if (mode === 'malformed') return json(response, 200, { clinicId, locationId, items: 'bad', nextCursor: null });
      if (mode === 'wrong-scope') return json(response, 200, snapshot(otherLocationId, []));
      if (mode === 'empty') return json(response, 200, snapshot(pathLocation(url), []));
      const first = requestedBucket === 'history'
        ? [item(appointmentC, '2026-07-20T09:00:00.123456Z', 'COMPLETED')]
        : [item(appointmentA, '2026-07-25T09:00:00.123456Z', mode === 'unknown' ? 'FUTURE_INTERNAL' : 'SCHEDULED')];
      if (mode === 'duplicate') return json(response, 200, snapshot(pathLocation(url), [first[0], first[0]]));
      if (requestedCursor) {
        if (mode === 'second-malformed') return json(response, 200, { ...snapshot(pathLocation(url), []), items: [{ id: 'raw-secret' }] });
        return json(response, 200, snapshot(pathLocation(url), [
          item(appointmentB, '2026-07-25T09:00:00.123456Z', 'SCHEDULED'),
        ]));
      }
      return json(response, 200, {
        ...snapshot(pathLocation(url), first),
        nextCursor: mode === 'normal' || mode === 'second-malformed' || mode === 'second-cursor-error'
          ? 'opaque+/=cursor.secret'
          : null,
        ownerPhone: '+7-private',
        diagnosis: 'private diagnosis',
      });
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
  requestedBucket = '';
  requestedCursor = null;
  releaseDelayed = null;
  authorityMode = 'allowed';
  await session(context);
});

test('rollout is default-off and route is absent', async ({ page }) => {
  test.skip(rolloutEnabled, 'rollback-only check');
  await page.goto(route(locationId));
  await expect(page.getByRole('heading', { name: 'Записи' })).toHaveCount(0);
  expect(page.url()).toContain('/appointments');
});

test.describe('enabled registry', () => {
  test.skip(!rolloutEnabled, 'enabled-only checks');

  test('authorized receptionist opens upcoming from backend contract', async ({ page }) => {
    await open(page);
    await expect(page.getByText('Барни')).toBeVisible();
    await expect(page.getByText('Запланирована')).toBeVisible();
    expect(requestedBucket).toBe('upcoming');
  });

  test('switches to authoritative history without client filtering', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: 'История' }).click();
    await expect(page.getByText('Завершена')).toBeVisible();
    await expect(page.getByText('Барни')).toBeVisible();
    expect(requestedBucket).toBe('history');
  });

  test('renders distinct upcoming empty', async ({ page }) => {
    mode = 'empty';
    await open(page);
    await expect(page.getByRole('heading', { name: 'Предстоящих записей нет' })).toBeVisible();
  });

  test('renders distinct history empty', async ({ page }) => {
    mode = 'empty';
    await open(page);
    await page.getByRole('tab', { name: 'История' }).click();
    await expect(page.getByRole('heading', { name: 'История записей пуста' })).toBeVisible();
  });

  test('technical failure is not an empty list', async ({ page }) => {
    mode = 'error';
    await open(page);
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить записи' })).toBeVisible();
    await expect(page.getByText(/записей нет|история записей пуста/i)).toHaveCount(0);
    await expect(page.getByText(/PRIVATE_SQL_DETAIL|private/i)).toHaveCount(0);
  });

  test('loads exact opaque cursor and appends backend order without duplicates', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Показать ещё' }).dblclick();
    await expect(page.getByRole('listitem')).toHaveCount(2);
    expect(requestedCursor).toBe('opaque+/=cursor.secret');
    const labels = await page.getByRole('listitem').allTextContents();
    expect(labels[0]).toContain('Барни');
    expect(labels[1]).toContain('Луна');
  });

  test('rejects malformed second page and preserves validated snapshot', async ({ page }) => {
    mode = 'second-malformed';
    await open(page);
    await page.getByRole('button', { name: 'Показать ещё' }).click();
    await expect(page.getByText('Следующую страницу проверить не удалось')).toBeVisible();
    await expect(page.getByText('Барни')).toBeVisible();
    await expect(page.getByText(/raw-secret/i)).toHaveCount(0);
  });

  test('cursor error offers a new refresh traversal', async ({ page }) => {
    mode = 'second-cursor-error';
    await open(page);
    await page.getByRole('button', { name: 'Показать ещё' }).click();
    await expect(page.getByText('Следующую страницу проверить не удалось')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Обновить список' })).toBeVisible();
    await expect(page.getByText(/INVALID_APPOINTMENT|cursor/i)).toHaveCount(0);
  });

  test('fences a stale old-location response after scope navigation', async ({ page }) => {
    mode = 'delayed';
    const first = page.goto(route(locationId));
    await page.waitForTimeout(100);
    mode = 'normal';
    await page.goto(route(otherLocationId));
    releaseDelayed?.();
    await first.catch(() => undefined);
    await expect(page.getByRole('heading', { name: 'Записи' })).toBeVisible();
    await expect(page.getByText('Барни')).toBeVisible();
    expect(page.url()).toContain(otherLocationId);
  });

  test('cross-location 403 is a technical denial without rows or count', async ({ page }) => {
    mode = 'forbidden';
    await open(page);
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить записи' })).toBeVisible();
    await expect(page.getByText('Барни')).toHaveCount(0);
    await expect(page.getByText(/CLINIC_SCOPE|private/i)).toHaveCount(0);
  });

  test('direct route denies a session without effective capability', async ({ page }) => {
    authorityMode = 'missing-capability';
    await page.goto(route(locationId));
    await expect(page.getByRole('heading', { name: 'Нет доступа к записям этой локации' })).toBeVisible();
    await expect(page.getByText('Барни')).toHaveCount(0);
  });

  test('veterinarian without capability does not receive the administrative registry', async ({ page }) => {
    authorityMode = 'veterinarian';
    await page.goto(route(locationId));
    await expect(page.getByRole('heading', { name: 'Нет доступа к записям этой локации' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Записи', exact: true })).toHaveCount(0);
  });

  test('unknown status is safe and raw enum is hidden', async ({ page }) => {
    mode = 'unknown';
    await open(page);
    await expect(page.getByText('Статус уточняется')).toBeVisible();
    await expect(page.getByText('FUTURE_INTERNAL')).toHaveCount(0);
  });

  test('malformed initial response fails closed', async ({ page }) => {
    mode = 'malformed';
    await open(page);
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить записи' })).toBeVisible();
  });

  test('duplicate initial IDs fail closed', async ({ page }) => {
    mode = 'duplicate';
    await open(page);
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить записи' })).toBeVisible();
    await expect(page.getByText('Барни')).toHaveCount(0);
  });

  test('wrong-scope payload cannot replace the current view', async ({ page }) => {
    mode = 'wrong-scope';
    await open(page);
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить записи' })).toBeVisible();
  });

  test('manual refresh starts a new first-page traversal', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Обновить список' }).click();
    await expect(page.getByText('Барни')).toBeVisible();
    expect(requestedCursor).toBeNull();
  });

  test('failed manual refresh preserves the last validated snapshot as degraded', async ({ page }) => {
    await open(page);
    mode = 'malformed';
    await page.getByRole('button', { name: 'Обновить список' }).click();
    await expect(page.getByText('Барни')).toBeVisible();
    await expect(page.getByText('Обновление списка проверить не удалось')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить записи' })).toHaveCount(0);
  });

  test('failed refresh preserves a validated business-empty snapshot with a degraded notice', async ({ page }) => {
    mode = 'empty';
    await open(page);
    await expect(page.getByRole('heading', { name: 'Предстоящих записей нет' })).toBeVisible();
    mode = 'malformed';
    await page.getByRole('button', { name: 'Обновить список' }).click();
    await expect(page.getByText('Обновление списка проверить не удалось')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Предстоящих записей нет' })).toBeVisible();
  });

  test('does not render unexpected sensitive projection fields', async ({ page }) => {
    await open(page);
    await expect(page.getByText(/\\+7-private|private diagnosis|ownerPhone|diagnosis/i)).toHaveCount(0);
  });

  test('supports keyboard tabs and has no focused accessibility violations', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Предстоящие' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'История' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'История' })).toHaveAttribute('aria-selected', 'true');
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  });

  test('keeps key fields visible at 200 percent text scale', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await open(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect(page.getByText('Барни')).toBeVisible();
    await expect(page.getByText('Запланирована')).toBeVisible();
    await expect(page.getByText('Терапевтический приём')).toBeVisible();
  });

  test('renders responsive mobile cards', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page);
    await expect(page.getByRole('listitem')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'История' })).toBeVisible();
  });

  test('captures desktop and mobile visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await attachScreenshot(page, testInfo, 'appointments-desktop');
    await page.setViewportSize({ width: 412, height: 915 });
    await attachScreenshot(page, testInfo, 'appointments-mobile');
  });
});

async function session(context: BrowserContext) {
  const token = await new SignJWT({
    roles: ['CLINIC_RECEPTIONIST'],
    clinicIds: [clinicId],
    locationIds: [locationId, otherLocationId],
  }).setProtectedHeader({ alg: 'HS256' }).setSubject('clinic-user').setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(jwtSecret));
  const baseURL = test.info().project.use.baseURL as string;
  await context.addCookies([{ name: 'vethelp_clinic_session', value: token, url: baseURL }]);
}

async function open(page: Page) {
  await page.goto(route(locationId));
  await expect(page.getByRole('heading', { name: 'Записи', exact: true })).toBeVisible();
  await expect(page.getByText('Загружаем записи…')).toHaveCount(0);
}

function route(location: string) {
  return `/clinics/${clinicId}/locations/${location}/appointments`;
}

function pathLocation(url: URL): string {
  return url.pathname.split('/locations/')[1].split('/')[0];
}

function item(id: string, startsAt: string, statusCode: string) {
  return {
    appointmentId: id,
    aggregateVersion: 3,
    statusCode,
    statusLabel: 'raw backend label',
    slot: { startsAt, endsAt: new Date(Date.parse(startsAt) + 30 * 60_000).toISOString() },
    pet: { id: petId, name: id === appointmentB ? 'Луна' : 'Барни', speciesLabel: 'Собака' },
    service: { displayName: 'Терапевтический приём' },
  };
}

function snapshot(location: string, items: unknown[]) {
  return {
    clinicId,
    locationId: location,
    serverNow: '2026-07-23T09:00:00.123456Z',
    items,
    nextCursor: null,
  };
}

function json(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
