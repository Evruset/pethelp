import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';

const backendBaseUrl = (process.env.VETHELP_API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const otpCode = process.env.AUTH_DEV_OTP_CODE ?? '246810';
const clinicJwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET
  ?? 'local-development-jwt-signing-key-not-for-shared-use';
const jwtIssuer = process.env.JWT_ISSUER ?? 'vethelp-local';
const jwtAudience = process.env.JWT_AUDIENCE ?? 'vethelp-api';

type CatalogItem = { clinicId: string; locationId: string; name: string };
type ServiceItem = { serviceId: string; name: string };
type SlotItem = { slotId: string; expectedVersion: number };
type HoldResult = { holdId: string; status: string; aggregateVersion: number };
type QueueSnapshot = { items: Array<{ holdId: string }> };

test('real local Pilot stack confirms and rejects through Portal with Owner authoritative readback', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('baseURL is required');
  await expectPilotHealthy(request);

  const ownerToken = await createOwnerSession(request);
  const petId = await createPet(request, ownerToken);
  const context = await selectContext(request, ownerToken);
  const clinicToken = await createClinicToken(context);

  await page.context().addCookies([{
    name: 'vethelp_clinic_session',
    value: clinicToken,
    url: baseURL,
    httpOnly: true,
    sameSite: 'Lax',
  }]);

  const confirmed = await createHold(request, ownerToken, petId, context);
  expect(confirmed).toMatchObject({ status: 'PENDING_CONFIRMATION', aggregateVersion: 1 });
  await page.goto(`/clinics/${context.clinicId}/locations/${context.locationId}/queue`);
  await decideEarlierRequests(page, request, clinicToken, context, confirmed.holdId);
  await page.locator('button:enabled', { hasText: 'Подтвердить' }).first().click();
  await expect(page.getByRole('status')).toContainText('Запись подтверждена');
  await expect.poll(() => ownerStatus(request, ownerToken, confirmed.holdId)).toBe('CONFIRMED');

  const rejected = await createHold(request, ownerToken, petId, await refreshSlot(request, ownerToken, context));
  expect(rejected).toMatchObject({ status: 'PENDING_CONFIRMATION', aggregateVersion: 1 });
  await expect.poll(() => queue(request, clinicToken, context).then((value) => value.items.some((item) => item.holdId === rejected.holdId))).toBe(true);
  await decideEarlierRequests(page, request, clinicToken, context, rejected.holdId);
  await page.locator('button:enabled', { hasText: 'Отклонить' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Отклонить заявку' });
  await dialog.getByRole('button', { name: 'Отклонить заявку' }).click();
  await expect(page.getByRole('status')).toContainText('Заявка отклонена');
  await expect.poll(() => ownerStatus(request, ownerToken, rejected.holdId)).toBe('REJECTED');
});

async function expectPilotHealthy(request: APIRequestContext) {
  const health = await apiData<{ status: string; profile: string }>(request, 'GET', `${backendBaseUrl}/v1/health`);
  expect(health).toMatchObject({ status: 'ok', profile: 'PILOT_V1' });
}

async function createOwnerSession(request: APIRequestContext): Promise<string> {
  const phone = `+7998${String(Date.now()).slice(-7)}`;
  const challenge = await apiData<{ challengeId: string }>(request, 'POST', `${backendBaseUrl}/v1/auth/otp/request`, {
    data: { phone },
  });
  const session = await apiData<{ sessionToken: string }>(request, 'POST', `${backendBaseUrl}/v1/auth/otp/verify`, {
    data: { challengeId: challenge.challengeId, code: otpCode, deviceName: 's14-local-stack' },
  });
  return session.sessionToken;
}

async function createPet(request: APIRequestContext, ownerToken: string): Promise<string> {
  const pet = await apiData<{ petId: string }>(request, 'POST', `${backendBaseUrl}/v1/owner/pets`, {
    headers: { ...auth(ownerToken), 'Idempotency-Key': randomUUID() },
    data: { name: 'S14 Local Pet', species: 'DOG' },
  });
  return pet.petId;
}

async function selectContext(request: APIRequestContext, ownerToken: string) {
  const catalog = await apiData<{ clinics: CatalogItem[] }>(request, 'GET', `${backendBaseUrl}/v1/owner/clinic-catalog`, {
    headers: auth(ownerToken),
  });
  const clinic = catalog.clinics.find((item) => item.name === 'VetHelp Pilot');
  if (!clinic) throw new Error('VetHelp Pilot clinic is missing; run ./start-vethelp.sh seed all');
  const detail = await apiData<{ services: ServiceItem[] }>(
    request,
    'GET',
    `${backendBaseUrl}/v1/owner/clinic-catalog/${clinic.clinicId}/locations/${clinic.locationId}`,
    { headers: auth(ownerToken) },
  );
  const service = detail.services[0];
  if (!service) throw new Error('Pilot service is missing');
  return refreshSlot(request, ownerToken, { ...clinic, serviceId: service.serviceId });
}

async function refreshSlot(
  request: APIRequestContext,
  ownerToken: string,
  context: CatalogItem & { serviceId: string },
): Promise<CatalogItem & { serviceId: string; slot: SlotItem }> {
  const availability = await apiData<{ slots: SlotItem[] }>(
    request,
    'GET',
    `${backendBaseUrl}/v1/owner/clinic-catalog/${context.clinicId}/locations/${context.locationId}/services/${context.serviceId}/availability`,
    { headers: auth(ownerToken) },
  );
  const slot = availability.slots[0];
  if (!slot) throw new Error('Pilot availability is empty');
  return { ...context, slot };
}

async function createHold(
  request: APIRequestContext,
  ownerToken: string,
  petId: string,
  context: CatalogItem & { serviceId: string; slot: SlotItem },
): Promise<HoldResult> {
  return apiData(request, 'POST', `${backendBaseUrl}/v1/booking-holds`, {
    headers: { ...auth(ownerToken), 'Idempotency-Key': randomUUID(), 'X-Correlation-ID': randomUUID() },
    data: {
      petId,
      clinicId: context.clinicId,
      locationId: context.locationId,
      serviceId: context.serviceId,
      slotId: context.slot.slotId,
      expectedSlotVersion: context.slot.expectedVersion,
    },
  });
}

async function decideEarlierRequests(
  page: Page,
  request: APIRequestContext,
  clinicToken: string,
  context: CatalogItem,
  targetHoldId: string,
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await queue(request, clinicToken, context);
    expect(current.items.some((item) => item.holdId === targetHoldId)).toBe(true);
    if (current.items[0]?.holdId === targetHoldId) return;
    await page.locator('button:enabled', { hasText: 'Подтвердить' }).first().click();
    await expect.poll(() => queue(request, clinicToken, context).then((value) => value.items[0]?.holdId)).not.toBe(current.items[0]?.holdId);
  }
  throw new Error('Target hold did not become the first actionable queue item');
}

function queue(request: APIRequestContext, clinicToken: string, context: CatalogItem): Promise<QueueSnapshot> {
  return apiData(request, 'GET', `${backendBaseUrl}/v1/clinic/${context.clinicId}/locations/${context.locationId}/booking-queue`, {
    headers: auth(clinicToken),
  });
}

async function ownerStatus(request: APIRequestContext, ownerToken: string, holdId: string): Promise<string> {
  const result = await apiData<{ status: string }>(request, 'GET', `${backendBaseUrl}/v1/booking-holds/${holdId}`, {
    headers: auth(ownerToken),
  });
  return result.status;
}

async function createClinicToken(input: CatalogItem): Promise<string> {
  return new SignJWT({
    roles: ['CLINIC_ADMIN'],
    clinicIds: [input.clinicId],
    locationIds: [input.locationId],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('33333333-3333-4333-8333-333333333333')
    .setIssuer(jwtIssuer)
    .setAudience(jwtAudience)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(clinicJwtSecret));
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
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
  const payload = await response.json().catch(() => null) as T | { data?: T } | null;
  if (!response.ok()) throw new Error(`${method} ${url} failed with ${response.status()}: ${JSON.stringify(payload)}`);
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data as T;
  return payload as T;
}
