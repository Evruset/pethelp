import { expect, test, type APIRequestContext } from '@playwright/test';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';

const backendBaseUrl = (process.env.VETHELP_API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const ownerPhone = process.env.VETHELP_LOCAL_STACK_OWNER_PHONE ?? '+79991234567';
const demoPetId = process.env.VETHELP_LOCAL_STACK_PET_ID ?? '22222222-2222-4222-8222-222222222222';
const clinicJwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET
  ?? 'local-development-jwt-signing-key-not-for-shared-use';
const jwtIssuer = process.env.JWT_ISSUER ?? 'vethelp-local';
const jwtAudience = process.env.JWT_AUDIENCE ?? 'vethelp-api';

test('local stack owner booking can be closed in portal and appears in pet diary', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('baseURL is required');

  await expectHealthy(request);
  const ownerToken = await loginOwner(request);
  const petId = await ensureDemoPet(request, ownerToken);
  const locationId = await findPilotLocation(request);
  const slot = await findAvailableSlot(request, locationId);
  const hold = await createOwnerHold(request, ownerToken, slot.id, petId);

  expect(hold.state).toBe('CONFIRMED');

  const adminToken = await clinicToken({
    clinicId: slot.clinicId,
    locationId,
    role: 'CLINIC_ADMIN',
  });
  await page.context().addCookies([{
    name: 'vethelp_clinic_session',
    value: adminToken,
    url: baseURL,
    httpOnly: true,
    sameSite: 'Lax',
  }]);

  await page.goto(`/clinics/${slot.clinicId}/locations/${locationId}/schedule`);
  const scheduleRow = page.getByRole('row').filter({
    hasText: scheduleDate(slot.startsAt),
  }).filter({
    hasText: '1 записей',
  }).first();
  await expect(scheduleRow.getByRole('button', { name: 'Закрыть приём' })).toBeEnabled();
  await scheduleRow.getByRole('button', { name: 'Закрыть приём' }).click();

  const summary = `Local stack clinical summary ${randomUUID()}`;
  const dialog = page.getByRole('dialog', { name: 'Закрыть приём' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Заключение по приёму').fill(summary);
  await dialog.getByRole('button', { name: 'Закрыть приём' }).click();

  await expect(page.getByRole('status')).toContainText('Приём закрыт. Заключение отправлено владельцу.');
  await expect(scheduleRow.getByRole('button', { name: 'Закрыть приём' })).toBeDisabled();

  const careSummary = await apiData<{ visits: Array<{ holdId: string; state: string; clinicalSummary?: string | null }> }>(
    request,
    'GET',
    `${backendBaseUrl}/v1/owner/pets/${petId}/care-summary`,
    { headers: auth(ownerToken) },
  );
  const visit = careSummary.visits.find((item) => item.holdId === hold.holdId);
  expect(visit).toMatchObject({
    state: 'COMPLETED',
    clinicalSummary: summary,
  });
});

async function expectHealthy(request: APIRequestContext) {
  const response = await request.get(`${backendBaseUrl}/v1/health`);
  expect(response.ok(), `Backend is not healthy at ${backendBaseUrl}/v1/health. Run make local-up && make local-seed first.`).toBe(true);
}

async function loginOwner(request: APIRequestContext): Promise<string> {
  const otp = await apiData<{ challengeId: string; developmentCode: string }>(
    request,
    'POST',
    `${backendBaseUrl}/v1/auth/otp/request`,
    { data: { phone: ownerPhone } },
  );
  const session = await apiData<{ accessToken: string }>(
    request,
    'POST',
    `${backendBaseUrl}/v1/auth/otp/verify`,
    {
      data: {
        phone: ownerPhone,
        challengeId: otp.challengeId,
        code: otp.developmentCode,
        deviceName: 'local-stack-e2e',
      },
    },
  );
  return session.accessToken;
}

async function ensureDemoPet(
  request: APIRequestContext,
  ownerToken: string,
): Promise<string> {
  const pets = await apiData<Array<{ id: string }>>(
    request,
    'GET',
    `${backendBaseUrl}/v1/owner/pets`,
    { headers: auth(ownerToken) },
  );
  return pets.find((pet) => pet.id === demoPetId)?.id ?? pets[0]?.id ?? demoPetId;
}

async function findPilotLocation(request: APIRequestContext): Promise<string> {
  const catalog = await apiData<{
    locations: Array<{ location: { id: string } }>;
  }>(request, 'GET', `${backendBaseUrl}/v1/catalog/clinic-locations?q=VetHelp%20Pilot&limit=10`);
  const locationId = catalog.locations[0]?.location.id;
  if (!locationId) throw new Error('VetHelp Pilot location was not found. Run make local-seed.');
  return locationId;
}

async function findAvailableSlot(
  request: APIRequestContext,
  locationId: string,
): Promise<{ id: string; clinicId: string; startsAt: string }> {
  const from = new Date(Date.now() + 45 * 60 * 1000).toISOString();
  type SlotPayload = {
    id: string;
    clinicId?: string;
    startsAt?: string;
    starts_at?: string;
  };
  const payload = await apiData<{ slots?: SlotPayload[] } | SlotPayload[]>(
    request,
    'GET',
    `${backendBaseUrl}/v1/clinic-locations/${locationId}/slots?from=${encodeURIComponent(from)}`,
  );
  const slots = Array.isArray(payload) ? payload : payload.slots ?? [];
  const slot = slots.find((candidate) => candidate.id && (candidate.startsAt ?? candidate.starts_at));
  const catalog = await apiData<{
    locations: Array<{ clinic: { id: string }; location: { id: string } }>;
  }>(request, 'GET', `${backendBaseUrl}/v1/catalog/clinic-locations?q=VetHelp%20Pilot&limit=10`);
  const clinicId = slot?.clinicId ?? catalog.locations.find((item) => item.location.id === locationId)?.clinic.id;
  const startsAt = slot?.startsAt ?? slot?.starts_at;
  if (!slot || !clinicId || !startsAt) throw new Error('Available slot was not found. Run make local-seed.');
  return { id: slot.id, clinicId, startsAt };
}

async function createOwnerHold(
  request: APIRequestContext,
  ownerToken: string,
  slotId: string,
  petId: string,
): Promise<{ holdId: string; state: string }> {
  return apiData(
    request,
    'POST',
    `${backendBaseUrl}/v1/booking-holds`,
    {
      headers: {
        ...auth(ownerToken),
        'Idempotency-Key': randomUUID(),
        'X-Correlation-ID': randomUUID(),
      },
      data: { slotId, petId },
    },
  );
}

async function clinicToken(input: { clinicId: string; locationId: string; role: 'CLINIC_ADMIN' | 'CLINIC_RECEPTIONIST' }): Promise<string> {
  return new SignJWT({
    roles: [input.role],
    clinicIds: [input.clinicId],
    locationIds: [input.locationId],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('33333333-3333-4333-8333-333333333333')
    .setIssuer(jwtIssuer)
    .setAudience(jwtAudience)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(new TextEncoder().encode(clinicJwtSecret));
}

function auth(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function apiData<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST',
  url: string,
  options: { headers?: Record<string, string>; data?: unknown } = {},
): Promise<T> {
  const response = method === 'GET'
    ? await request.get(url, { headers: options.headers })
    : await request.post(url, { headers: options.headers, data: options.data });
  const payload = await response.json().catch(() => null) as { data?: T; code?: string } | T | null;
  if (!response.ok()) {
    throw new Error(`${method} ${url} failed with ${response.status()}: ${JSON.stringify(payload)}`);
  }
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function scheduleDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
