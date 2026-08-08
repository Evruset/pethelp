import { expect, test } from '@playwright/test';
import { SignJWT } from 'jose';

const clinicId = '82000000-0000-4000-8000-000000000001';
const locationId = '83000000-0000-4000-8000-000000000001';
const receptionistId = '81000000-0000-4000-8000-000000000002';
const jwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET
  ?? 'local-development-jwt-signing-key-not-for-shared-use';
const jwtIssuer = process.env.JWT_ISSUER ?? 'vethelp-local';
const jwtAudience = process.env.JWT_AUDIENCE ?? 'vethelp-api';

test('real session crosses Portal BFF to the 05B backend and PostgreSQL', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({
    roles: ['CLINIC_RECEPTIONIST'],
    clinicIds: [clinicId],
    locationIds: [locationId],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(receptionistId)
    .setIssuer(jwtIssuer)
    .setAudience(jwtAudience)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(jwtSecret));

  await page.context().addCookies([{
    name: 'vethelp_clinic_session',
    value: token,
    url: baseURL,
    httpOnly: true,
    sameSite: 'Lax',
  }]);

  const browserAuthorization: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/workspace-home')) {
      browserAuthorization.push(request.headers().authorization ?? '');
    }
  });

  const responsePromise = page.waitForResponse((response) => response.url().includes('/workspace-home'));
  await page.goto(`/clinics/${clinicId}/locations/${locationId}`);
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('private, no-store');
  expect(response.headers().vary).toContain('Cookie');
  expect(response.headers().etag).toBeUndefined();
  expect(browserAuthorization).toEqual(['']);
  await expect(page.getByRole('heading', { name: 'Очередь' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Приёмы' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть очередь', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть приёмы', exact: true })).toBeVisible();
  expect(await page.locator('body').textContent()).not.toMatch(/ownerId|patientId|holdId|appointmentId|doctorId/i);
});
