import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';

const backendBaseUrl = (process.env.VETHELP_API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const otpCode = process.env.AUTH_DEV_OTP_CODE ?? '246810';
const clinicJwtSecret = process.env.VETHELP_CLINIC_JWT_SECRET
  ?? 'local-development-jwt-signing-key-not-for-shared-use';
const jwtIssuer = process.env.JWT_ISSUER ?? 'vethelp-local';
const jwtAudience = process.env.JWT_AUDIENCE ?? 'vethelp-api';

type ContextBase = { clinicId: string; locationId: string; serviceId: string };
type Context = ContextBase & { slot: { slotId: string; expectedVersion: number } };
type Hold = { holdId: string; slotId: string; status: string; aggregateVersion: number };
type Snapshot = Hold & { statusCode: string };
type Queue = { items: Array<{ holdId: string }> };

test('real Pilot stack cancels pending and confirmed bookings and fences a concurrent Clinic confirm', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('baseURL is required');
  await expectPilotHealthy(request);
  const ownerToken = await createOwnerSession(request);
  const petId = await createPet(request, ownerToken);
  const initial = await selectContext(request, ownerToken);
  const clinicToken = await createClinicToken(initial);
  await page.context().addCookies([{ name: 'vethelp_clinic_session', value: clinicToken, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);

  // Journey A: pending request -> Owner cancel -> queue removal -> stale Clinic confirm denied.
  const pending = await createHold(request, ownerToken, petId, initial);
  const pendingCancel = await cancel(request, ownerToken, pending, randomUUID());
  expect(pendingCancel).toMatchObject({ holdId: pending.holdId, slotId: pending.slotId, status: 'CANCELLED' });
  await expect.poll(() => read(request, ownerToken, pending.holdId).then((value) => value.status)).toBe('CANCELLED');
  await expect.poll(() => queue(request, clinicToken, initial).then((value) => value.items.some((item) => item.holdId === pending.holdId))).toBe(false);
  const staleConfirm = await clinicConfirm(request, clinicToken, pending, randomUUID());
  expect([409, 422]).toContain(staleConfirm.status());
  expect((await read(request, ownerToken, pending.holdId)).status).toBe('CANCELLED');

  // Journey B: Clinic confirms through the real Portal, then Owner cancels the confirmed booking.
  const confirmedContext = await refreshSlot(request, ownerToken, initial);
  const confirmed = await createHold(request, ownerToken, petId, confirmedContext);
  await page.goto(`/clinics/${confirmedContext.clinicId}/locations/${confirmedContext.locationId}/queue`);
  await decideEarlierRequests(page, request, clinicToken, confirmedContext, confirmed.holdId);
  await page.locator('button:enabled', { hasText: 'Подтвердить' }).first().click();
  await expect(page.getByRole('status')).toContainText('Запись подтверждена');
  const confirmedSnapshot = await expectStatus(request, ownerToken, confirmed.holdId, 'CONFIRMED');
  const confirmedCancel = await cancel(request, ownerToken, confirmedSnapshot, randomUUID());
  expect(confirmedCancel).toMatchObject({ holdId: confirmed.holdId, status: 'CANCELLED' });
  await expectStatus(request, ownerToken, confirmed.holdId, 'CANCELLED');
  await expect.poll(() => availableSlotIds(request, ownerToken, confirmedContext).then((ids) => ids.includes(confirmed.slotId))).toBe(true);

  // Journey C: pending Owner cancel and Clinic confirm race; exactly one version-1 command wins.
  const raceContext = await refreshSlot(request, ownerToken, initial);
  const raced = await createHold(request, ownerToken, petId, raceContext);
  await page.goto(`/clinics/${raceContext.clinicId}/locations/${raceContext.locationId}/queue`);
  await decideEarlierRequests(page, request, clinicToken, raceContext, raced.holdId);
  const [ownerRace, clinicRace] = await Promise.all([
    cancelResponse(request, ownerToken, raced, randomUUID()),
    clinicConfirm(request, clinicToken, raced, randomUUID()),
  ]);
  expect([ownerRace.status(), clinicRace.status()].filter((status) => status === 200)).toHaveLength(1);
  const final = await read(request, ownerToken, raced.holdId);
  expect(['CANCELLED', 'CONFIRMED']).toContain(final.status);
  await expect.poll(() => queue(request, clinicToken, raceContext).then((value) => value.items.some((item) => item.holdId === raced.holdId))).toBe(false);
});

async function expectPilotHealthy(request: APIRequestContext) {
  await expect(apiData<{ status: string; profile: string }>(request, 'GET', `${backendBaseUrl}/v1/health`))
    .resolves.toMatchObject({ status: 'ok', profile: 'PILOT_V1' });
}

async function createOwnerSession(request: APIRequestContext): Promise<string> {
  const phone = `+7997${String(Date.now()).slice(-7)}`;
  const challenge = await apiData<{ challengeId: string }>(request, 'POST', `${backendBaseUrl}/v1/auth/otp/request`, { data: { phone } });
  const session = await apiData<{ sessionToken: string }>(request, 'POST', `${backendBaseUrl}/v1/auth/otp/verify`, {
    data: { challengeId: challenge.challengeId, code: otpCode, deviceName: 's16-local-stack' },
  });
  return session.sessionToken;
}

async function createPet(request: APIRequestContext, token: string): Promise<string> {
  const pet = await apiData<{ petId: string }>(request, 'POST', `${backendBaseUrl}/v1/owner/pets`, {
    headers: { ...auth(token), 'Idempotency-Key': randomUUID() }, data: { name: 'S16 Local Pet', species: 'DOG' },
  });
  return pet.petId;
}

async function selectContext(request: APIRequestContext, token: string): Promise<Context> {
  const catalog = await apiData<{ clinics: Array<{ clinicId: string; locationId: string; name: string }> }>(request, 'GET', `${backendBaseUrl}/v1/owner/clinic-catalog`, { headers: auth(token) });
  const clinic = catalog.clinics.find((item) => item.name === 'VetHelp Pilot');
  if (!clinic) throw new Error('VetHelp Pilot clinic is missing; run ./start-vethelp.sh seed all');
  const detail = await apiData<{ services: Array<{ serviceId: string }> }>(request, 'GET', `${backendBaseUrl}/v1/owner/clinic-catalog/${clinic.clinicId}/locations/${clinic.locationId}`, { headers: auth(token) });
  if (!detail.services[0]) throw new Error('Pilot service is missing');
  return refreshSlot(request, token, { ...clinic, serviceId: detail.services[0].serviceId });
}

async function refreshSlot(request: APIRequestContext, token: string, context: ContextBase | Context): Promise<Context> {
  const slots = await apiData<{ slots: Array<{ slotId: string; expectedVersion: number }> }>(request, 'GET', `${backendBaseUrl}/v1/owner/clinic-catalog/${context.clinicId}/locations/${context.locationId}/services/${context.serviceId}/availability`, { headers: auth(token) });
  if (!slots.slots[0]) throw new Error('Pilot availability is empty');
  return { ...context, slot: slots.slots[0] };
}

async function availableSlotIds(request: APIRequestContext, token: string, context: Context): Promise<string[]> {
  const refreshed = await apiData<{ slots: Array<{ slotId: string }> }>(request, 'GET', `${backendBaseUrl}/v1/owner/clinic-catalog/${context.clinicId}/locations/${context.locationId}/services/${context.serviceId}/availability`, { headers: auth(token) });
  return refreshed.slots.map((slot) => slot.slotId);
}

function createHold(request: APIRequestContext, token: string, petId: string, context: Context): Promise<Hold> {
  return apiData(request, 'POST', `${backendBaseUrl}/v1/booking-holds`, { headers: { ...auth(token), 'Idempotency-Key': randomUUID(), 'X-Correlation-ID': randomUUID() }, data: { petId, clinicId: context.clinicId, locationId: context.locationId, serviceId: context.serviceId, slotId: context.slot.slotId, expectedSlotVersion: context.slot.expectedVersion } });
}

async function cancel(request: APIRequestContext, token: string, hold: Hold, key: string): Promise<Hold> {
  const response = await cancelResponse(request, token, hold, key);
  const payload = await response.json() as Hold | { data: Hold };
  if (!response.ok()) throw new Error(`cancel failed ${response.status()}: ${JSON.stringify(payload)}`);
  return 'data' in payload ? payload.data : payload;
}

function cancelResponse(request: APIRequestContext, token: string, hold: Hold, key: string): Promise<APIResponse> {
  return request.post(`${backendBaseUrl}/v1/owner/bookings/${hold.holdId}/cancel`, { headers: { ...auth(token), 'Idempotency-Key': key, 'If-Match': `"${hold.aggregateVersion}"`, 'X-Correlation-ID': randomUUID() }, data: {} });
}

function clinicConfirm(request: APIRequestContext, token: string, hold: Hold, key: string): Promise<APIResponse> {
  return request.post(`${backendBaseUrl}/v1/clinic/booking-holds/${hold.holdId}/confirm`, { headers: { ...auth(token), 'Idempotency-Key': key, 'If-Match': `"${hold.aggregateVersion}"`, 'X-Correlation-ID': randomUUID() }, data: {} });
}

function read(request: APIRequestContext, token: string, holdId: string): Promise<Snapshot> {
  return apiData(request, 'GET', `${backendBaseUrl}/v1/booking-holds/${holdId}`, { headers: auth(token) });
}

async function expectStatus(request: APIRequestContext, token: string, holdId: string, status: string): Promise<Snapshot> {
  let snapshot: Snapshot | undefined;
  await expect.poll(async () => { snapshot = await read(request, token, holdId); return snapshot.status; }).toBe(status);
  return snapshot!;
}

async function decideEarlierRequests(page: Page, request: APIRequestContext, token: string, context: Context, target: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await queue(request, token, context);
    if (!current.items.some((item) => item.holdId === target)) throw new Error('Target hold is absent from queue');
    if (current.items[0]?.holdId === target) return;
    await page.locator('button:enabled', { hasText: 'Подтвердить' }).first().click();
    await expect.poll(() => queue(request, token, context).then((value) => value.items[0]?.holdId)).not.toBe(current.items[0]?.holdId);
  }
  throw new Error('Target hold did not become actionable');
}

function queue(request: APIRequestContext, token: string, context: Context): Promise<Queue> {
  return apiData(request, 'GET', `${backendBaseUrl}/v1/clinic/${context.clinicId}/locations/${context.locationId}/booking-queue`, { headers: auth(token) });
}

async function createClinicToken(context: Context): Promise<string> {
  return new SignJWT({ roles: ['CLINIC_ADMIN'], clinicIds: [context.clinicId], locationIds: [context.locationId] })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('33333333-3333-4333-8333-333333333333')
    .setIssuer(jwtIssuer).setAudience(jwtAudience).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(clinicJwtSecret));
}

function auth(token: string) { return { Authorization: `Bearer ${token}`, Accept: 'application/json' }; }

async function apiData<T>(request: APIRequestContext, method: 'GET' | 'POST', url: string, options: { headers?: Record<string, string>; data?: unknown } = {}): Promise<T> {
  const response = method === 'GET' ? await request.get(url, { headers: options.headers }) : await request.post(url, { headers: options.headers, data: options.data });
  const payload = await response.json().catch(() => null) as T | { data?: T } | null;
  if (!response.ok()) throw new Error(`${method} ${url} failed with ${response.status()}: ${JSON.stringify(payload)}`);
  return payload && typeof payload === 'object' && 'data' in payload ? payload.data as T : payload as T;
}
