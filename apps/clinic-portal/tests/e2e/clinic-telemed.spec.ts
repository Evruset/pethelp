import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { decodeJwt, SignJWT } from 'jose';

const clinicId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const forbiddenLocationId = '33333333-3333-4333-8333-333333333333';
const vetA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const vetB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const receptionist = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const caseQueued = '44444444-4444-4444-8444-444444444444';
const caseAssignedA = '55555555-5555-4555-8555-555555555555';
const caseAssignedB = '66666666-6666-4666-8666-666666666666';
const caseCancelled = '77777777-7777-4777-8777-777777777777';
const sessionWaiting = '88888888-8888-4888-8888-888888888888';
const serverNow = '2026-07-01T10:00:00.000Z';
const jwtSecret = 'clinic-e2e-secret-at-least-32-bytes';
const mockBackendPort = 3212;

type StartMode = 'success' | 'conflict' | 'transport';
type ConnectMode = 'success' | 'transport';

type MockCase = {
  caseId: string;
  state: 'QUEUED' | 'ASSIGNED' | 'DOCTOR_JOINED' | 'IN_PROGRESS' | 'CANCELLED_BY_OWNER';
  queuePriority: number;
  urgencyBand: string;
  serviceLevel: string;
  safetyEscalation: boolean;
  recommendationText: string | null;
  followUpNotes: string | null;
  assignedEmployeeId: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  intake: {
    id: string;
    category: string;
    symptomDuration: string;
    priorClinicVisit: boolean;
    emergencyRedFlags: string[];
  };
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    birthDate: string | null;
    weightKg: string | null;
    allergies: string[];
    chronicConditions: string[];
  };
  latestEvent: { eventType: string; createdAt: string } | null;
  session: { id: string; state: string; expiresAt: string } | null;
};

let server: Server;
let cases: MockCase[] = [];
let queueReads = 0;
let startMode: StartMode = 'success';
let connectMode: ConnectMode = 'success';
let startRequests: Array<{ caseId: string; subject: string | null }> = [];
let connectRequests: Array<{ caseId: string; sessionId: string; subject: string | null }> = [];
let workspaceRequests: Array<{ caseId: string; subject: string | null; body: unknown }> = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  server = createServer(handleBackendRequest);
  await new Promise<void>((resolve) => server.listen(mockBackendPort, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test.beforeEach(() => {
  resetBackend();
});

test('blocks unauthenticated users before telemed backend access', async ({ page }) => {
  await uiStep(page, 'open telemed workspace without session', async () => {
    await page.goto('/telemed/vet');
    await expect(page.getByText('403 Access Denied')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Нет доступа к очереди телемедицины' })).toBeVisible();
  });

  expect(queueReads).toBe(0);
  await expect(page).toHaveScreenshot('telemed-forbidden.png', { fullPage: true });
});

test('blocks location-owned telemed route and URL tampering', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL, receptionist, ['CLINIC_RECEPTIONIST']);

  await uiStep(page, 'open legacy clinic telemed route with wrong location', async () => {
    await page.goto(`/clinics/${clinicId}/locations/${forbiddenLocationId}/telemed`);
    await expect(page.getByText('403 Access Denied')).toBeVisible();
    await expect(page.getByText('platform workspace')).toBeVisible();
  });

  expect(queueReads).toBe(0);
});

test('shows only the current veterinarian queue and assigned workspace', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL, vetA, ['TELEMED_VETERINARIAN']);

  await uiStep(page, 'open veterinarian queue', async () => {
    await page.goto('/telemed/vet');
    await expect(page.getByTestId('telemed-vet-workspace')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Открыть кейс Боня' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Открыть кейс Мила' })).toBeVisible();
    await expect(page.getByText('Чужой кейс')).toHaveCount(0);
  });

  await expectNoCriticalA11y(page);
  await expect(page).toHaveScreenshot('telemed-queue-waiting.png', { fullPage: true });
});

test('captures empty telemed queue visual baseline', async ({ page, context, baseURL }) => {
  cases = [];
  await addClinicSession(context, baseURL, vetA, ['TELEMED_VETERINARIAN']);

  await uiStep(page, 'open empty veterinarian queue', async () => {
    await page.goto('/telemed/vet');
    await expect(page.getByTestId('telemed-empty-state')).toContainText('Очередь пуста');
  });

  await expect(page).toHaveScreenshot('telemed-queue-empty.png', { fullPage: true });
});

test('keeps veterinarian workspaces isolated across users', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL, vetB, ['TELEMED_VETERINARIAN']);

  await uiStep(page, 'open second veterinarian queue', async () => {
    await page.goto('/telemed/vet');
    await expect(page.getByRole('button', { name: 'Открыть кейс Чужой кейс' })).toBeVisible();
    await expect(page.getByText('Мила')).toHaveCount(0);
  });

  const response = await page.request.post(`/api/telemed/vet/cases/${caseAssignedA}/start-session`);
  expect(response.status()).toBe(403);
  expect(startRequests).toEqual([{ caseId: caseAssignedA, subject: vetB }]);
});

test('starts a waiting room from the visible workspace CTA', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL, vetA, ['TELEMED_VETERINARIAN']);
  await page.goto('/telemed/vet');

  await uiStep(page, 'select assigned telemed case', async () => {
    await page.getByTestId(`telemed-case-${caseAssignedA}`).getByRole('button', { name: 'Открыть кейс Мила' }).click();
    await expect(page.getByTestId(`telemed-workspace-${caseAssignedA}`)).toBeVisible();
  });

  await uiStep(page, 'start waiting room from CTA', async () => {
    await page.getByRole('button', { name: 'Start waiting room' }).click();
    await expect(page.getByRole('status')).toContainText('Комната ожидания открыта');
    await expect(page.getByText('Session Ожидает врача')).toBeVisible();
  });

  expect(startRequests).toEqual([{ caseId: caseAssignedA, subject: vetA }]);
  await expect(page.getByRole('button', { name: 'Start waiting room' })).toBeDisabled();
});

test('connects a doctor with mocked LiveKit contract and no real WebRTC', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL, vetA, ['TELEMED_VETERINARIAN']);
  cases = cases.map((item) => item.caseId === caseAssignedA ? withWaitingSession(item) : item);
  await page.goto('/telemed/vet');

  await uiStep(page, 'select waiting telemed session', async () => {
    await page.getByTestId(`telemed-case-${caseAssignedA}`).getByRole('button', { name: 'Открыть кейс Мила' }).click();
    await expect(page.getByText('Session Ожидает врача')).toBeVisible();
  });

  await uiStep(page, 'connect doctor through visible CTA', async () => {
    await page.getByRole('button', { name: 'Connect doctor' }).click();
    await expect(page.getByRole('status')).toContainText('Ветеринар подключён к консультации.');
    await expect(page.getByText('Session Ветеринар подключён')).toBeVisible();
  });

  expect(connectRequests).toEqual([{ caseId: caseAssignedA, sessionId: sessionWaiting, subject: vetA }]);
  await expect(page).toHaveScreenshot('telemed-workspace-connected.png', { fullPage: true });
});

test('captures waiting workspace visual baseline before doctor connects', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL, vetA, ['TELEMED_VETERINARIAN']);
  cases = cases.map((item) => item.caseId === caseAssignedA ? withWaitingSession(item) : item);

  await uiStep(page, 'open waiting telemed workspace', async () => {
    await page.goto('/telemed/vet');
    await page.getByTestId(`telemed-case-${caseAssignedA}`).getByRole('button', { name: 'Открыть кейс Мила' }).click();
    await expect(page.getByText('Session Ожидает врача')).toBeVisible();
  });

  await expect(page).toHaveScreenshot('telemed-workspace-waiting.png', { fullPage: true });
});

test('renders owner-cancelled sessions as terminal and disables clinical actions', async ({ page, context, baseURL }) => {
  await addClinicSession(context, baseURL, vetA, ['TELEMED_VETERINARIAN']);
  await page.goto('/telemed/vet');

  await uiStep(page, 'open owner-cancelled telemed case', async () => {
    await page.getByTestId(`telemed-case-${caseCancelled}`).getByRole('button', { name: 'Открыть кейс Рыжик' }).click();
    await expect(page.getByRole('status')).toContainText('Консультация недоступна для действий: Отменено владельцем.');
    await expect(page.getByText('CANCELLED_BY_OWNER')).toHaveCount(0);
  });

  await expect(page.getByRole('button', { name: 'Start waiting room' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Connect doctor' })).toBeDisabled();
  await expect(page).toHaveScreenshot('telemed-workspace-cancelled.png', { fullPage: true });
});

test('refreshes authoritative state after stale start conflict without swapping the selected case', async ({ page, context, baseURL }) => {
  startMode = 'conflict';
  await addClinicSession(context, baseURL, vetA, ['TELEMED_VETERINARIAN']);
  await page.goto('/telemed/vet');

  await uiStep(page, 'select assigned case before stale conflict', async () => {
    await page.getByTestId(`telemed-case-${caseAssignedA}`).getByRole('button', { name: 'Открыть кейс Мила' }).click();
    await expect(page.getByTestId(`telemed-workspace-${caseAssignedA}`)).toBeVisible();
  });

  await uiStep(page, 'submit start and receive stale conflict', async () => {
    await page.getByRole('button', { name: 'Start waiting room' }).click();
    await expect(page.getByText('Состояние консультации обновилось. Обновите очередь и повторите действие вручную')).toBeVisible();
    await expect(page.getByTestId(`telemed-workspace-${caseAssignedA}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Открыть кейс Боня' })).toBeVisible();
  });

  expect(startRequests).toEqual([{ caseId: caseAssignedA, subject: vetA }]);
  expect(queueReads).toBeGreaterThanOrEqual(2);
});

test('keeps user selection after transport failure and retries only after explicit user action', async ({ page, context, baseURL }) => {
  startMode = 'transport';
  await addClinicSession(context, baseURL, vetA, ['TELEMED_VETERINARIAN']);
  await page.goto('/telemed/vet');

  await uiStep(page, 'select assigned case before transport failure', async () => {
    await page.getByTestId(`telemed-case-${caseAssignedA}`).getByRole('button', { name: 'Открыть кейс Мила' }).click();
  });

  await uiStep(page, 'submit start and receive transport failure', async () => {
    await page.getByRole('button', { name: 'Start waiting room' }).click();
    await expect(page.getByText('Связь с VetHelp временно недоступна. Повторите действие после обновления состояния.')).toBeVisible();
    await expect(page.getByTestId(`telemed-workspace-${caseAssignedA}`)).toBeVisible();
  });
  expect(startRequests).toEqual([{ caseId: caseAssignedA, subject: vetA }]);

  startMode = 'success';
  await uiStep(page, 'retry start explicitly after transport recovers', async () => {
    await page.getByRole('button', { name: 'Start waiting room' }).click();
    await expect(page.getByRole('status')).toContainText('Комната ожидания открыта');
  });
  expect(startRequests).toEqual([
    { caseId: caseAssignedA, subject: vetA },
    { caseId: caseAssignedA, subject: vetA },
  ]);
});

async function uiStep(page: Page, name: string, action: () => Promise<void>) {
  await test.step(name, async () => {
    await action();
    await captureEvidence(page, name);
  });
}

async function captureEvidence(page: Page, name: string) {
  const path = join('test-results', 'clinic-telemed-evidence', `${slug(name)}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: true });
  await test.info().attach(name, { path, contentType: 'image/png' });
}

async function expectNoCriticalA11y(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  expect(blocking).toEqual([]);
}

async function addClinicSession(
  context: BrowserContext,
  baseURL: string | undefined,
  subject: string,
  roles: string[],
) {
  if (!baseURL) throw new Error('baseURL is required');
  const token = await new SignJWT({
    roles,
    clinicIds: [clinicId],
    locationIds: [locationId],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(jwtSecret));

  await context.addCookies([{
    name: 'vethelp_clinic_session',
    value: token,
    url: baseURL,
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}

function resetBackend() {
  cases = makeCases();
  queueReads = 0;
  startMode = 'success';
  connectMode = 'success';
  startRequests = [];
  connectRequests = [];
  workspaceRequests = [];
}

function queueFor(subject: string | null) {
  return {
    serverNow,
    availableCases: cases.filter((item) => item.state === 'QUEUED'),
    assignedCases: cases.filter((item) => item.assignedEmployeeId === subject && item.state !== 'QUEUED'),
    restrictedOutputPolicy: {
      allowed: ['triage guidance', 'monitoring checklist', 'clinic follow-up routing'],
      forbidden: ['diagnosis without examination', 'controlled medication prescriptions'],
    },
  };
}

function handleBackendRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${mockBackendPort}`}`);
  const subject = subjectFromRequest(request);

  if (request.method === 'GET' && url.pathname === '/v1/telemed/vet/queue') {
    queueReads += 1;
    sendJson(response, 200, queueFor(subject));
    return;
  }

  const assignMatch = url.pathname.match(/^\/v1\/telemed\/vet\/cases\/([^/]+)\/assign$/);
  if (request.method === 'POST' && assignMatch) {
    const item = cases.find((candidate) => candidate.caseId === assignMatch[1]);
    if (!item || item.state !== 'QUEUED') {
      sendJson(response, 409, { code: 'TELEMED_CASE_STATE_CONFLICT' });
      return;
    }
    item.state = 'ASSIGNED';
    item.assignedEmployeeId = subject;
    item.assignedAt = serverNow;
    item.updatedAt = serverNow;
    sendJson(response, 200, item);
    return;
  }

  const workspaceMatch = url.pathname.match(/^\/v1\/telemed\/vet\/cases\/([^/]+)\/workspace$/);
  if (request.method === 'PATCH' && workspaceMatch) {
    collectBody(request).then((rawBody) => {
      const body = rawBody ? JSON.parse(rawBody) as Partial<MockCase> : {};
      const item = cases.find((candidate) => candidate.caseId === workspaceMatch[1]);
      workspaceRequests.push({ caseId: workspaceMatch[1], subject, body });
      if (!item || item.assignedEmployeeId !== subject) {
        sendJson(response, 403, { code: 'TELEMED_CASE_ACCESS_DENIED' });
        return;
      }
      item.safetyEscalation = body.safetyEscalation ?? item.safetyEscalation;
      item.recommendationText = body.recommendationText ?? item.recommendationText;
      item.followUpNotes = body.followUpNotes ?? item.followUpNotes;
      sendJson(response, 200, item);
    }).catch(() => sendJson(response, 400, { code: 'INVALID_REQUEST' }));
    return;
  }

  const startMatch = url.pathname.match(/^\/v1\/telemed\/vet\/cases\/([^/]+)\/start-session$/);
  if (request.method === 'POST' && startMatch) {
    const caseId = startMatch[1];
    startRequests.push({ caseId, subject });
    const item = cases.find((candidate) => candidate.caseId === caseId);
    if (!item || item.assignedEmployeeId !== subject) {
      sendJson(response, 403, { code: 'TELEMED_CASE_ACCESS_DENIED' });
      return;
    }
    if (startMode === 'conflict') {
      sendJson(response, 409, { code: 'TELEMED_CASE_WORKSPACE_CLOSED' });
      return;
    }
    if (startMode === 'transport') {
      sendJson(response, 503, { code: 'BACKEND_UNAVAILABLE' });
      return;
    }
    const updated = withWaitingSession(item);
    cases = cases.map((candidate) => candidate.caseId === caseId ? updated : candidate);
    sendJson(response, 200, updated.session);
    return;
  }

  const connectMatch = url.pathname.match(/^\/v1\/telemed\/vet\/cases\/([^/]+)\/sessions\/([^/]+)\/connect$/);
  if (request.method === 'POST' && connectMatch) {
    const [, caseId, sessionId] = connectMatch;
    connectRequests.push({ caseId, sessionId, subject });
    const item = cases.find((candidate) => candidate.caseId === caseId);
    if (!item || item.assignedEmployeeId !== subject) {
      sendJson(response, 403, { code: 'TELEMED_CASE_ACCESS_DENIED' });
      return;
    }
    if (connectMode === 'transport') {
      sendJson(response, 503, { code: 'BACKEND_UNAVAILABLE' });
      return;
    }
    const updated: MockCase = {
      ...item,
      state: 'DOCTOR_JOINED',
      updatedAt: serverNow,
      session: item.session ? { ...item.session, state: 'DOCTOR_JOINED' } : { id: sessionId, state: 'DOCTOR_JOINED', expiresAt: '2026-07-01T10:20:00.000Z' },
    };
    cases = cases.map((candidate) => candidate.caseId === caseId ? updated : candidate);
    sendJson(response, 200, {
      session: {
        id: sessionId,
        bookingHoldId: null,
        telemedCaseId: caseId,
        ownerId: 'owner-telemed-e2e',
        doctorId: subject,
        state: 'DOCTOR_JOINED',
        roomName: `telemed-${caseId}`,
        version: 2,
        expiresAt: '2026-07-01T10:20:00.000Z',
        createdAt: serverNow,
      },
      accessToken: 'mock-livekit-token',
      tokenExpiresAt: '2026-07-01T10:15:00.000Z',
      livekitUrl: 'wss://mock-livekit.local',
    });
    return;
  }

  sendJson(response, 404, { code: 'NOT_FOUND' });
}

function subjectFromRequest(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const payload = decodeJwt(header.slice('Bearer '.length));
  return typeof payload.sub === 'string' ? payload.sub : null;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function collectBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function withWaitingSession(item: MockCase): MockCase {
  return {
    ...item,
    state: 'ASSIGNED',
    updatedAt: serverNow,
    session: { id: sessionWaiting, state: 'WAITING_FOR_DOCTOR', expiresAt: '2026-07-01T10:20:00.000Z' },
    latestEvent: { eventType: 'TELEMED_SESSION_STARTED', createdAt: serverNow },
  };
}

function makeCases(): MockCase[] {
  return [
    makeCase({
      caseId: caseQueued,
      state: 'QUEUED',
      petName: 'Боня',
      category: 'SKIN_EAR_EYE',
      assignedEmployeeId: null,
      queuePriority: 1,
    }),
    makeCase({
      caseId: caseAssignedA,
      state: 'ASSIGNED',
      petName: 'Мила',
      category: 'NUTRITION',
      assignedEmployeeId: vetA,
      queuePriority: 2,
    }),
    makeCase({
      caseId: caseAssignedB,
      state: 'ASSIGNED',
      petName: 'Чужой кейс',
      category: 'BEHAVIOR',
      assignedEmployeeId: vetB,
      queuePriority: 3,
    }),
    makeCase({
      caseId: caseCancelled,
      state: 'CANCELLED_BY_OWNER',
      petName: 'Рыжик',
      category: 'GENERAL_QUESTION',
      assignedEmployeeId: vetA,
      queuePriority: 4,
      latestEvent: { eventType: 'TELEMED_SESSION_CANCELLED_BY_OWNER', createdAt: serverNow },
    }),
  ];
}

function makeCase(input: {
  caseId: string;
  state: MockCase['state'];
  petName: string;
  category: string;
  assignedEmployeeId: string | null;
  queuePriority: number;
  latestEvent?: MockCase['latestEvent'];
}): MockCase {
  return {
    caseId: input.caseId,
    state: input.state,
    queuePriority: input.queuePriority,
    urgencyBand: 'ROUTINE',
    serviceLevel: 'telemed-standard',
    safetyEscalation: false,
    recommendationText: null,
    followUpNotes: null,
    assignedEmployeeId: input.assignedEmployeeId,
    assignedAt: input.assignedEmployeeId ? '2026-07-01T09:50:00.000Z' : null,
    createdAt: '2026-07-01T09:40:00.000Z',
    updatedAt: '2026-07-01T09:55:00.000Z',
    intake: {
      id: `${input.caseId}-intake`,
      category: input.category,
      symptomDuration: '2 days',
      priorClinicVisit: false,
      emergencyRedFlags: [],
    },
    pet: {
      id: `${input.caseId}-pet`,
      name: input.petName,
      species: 'cat',
      breed: null,
      birthDate: null,
      weightKg: '4.8',
      allergies: [],
      chronicConditions: [],
    },
    latestEvent: input.latestEvent ?? null,
    session: null,
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9а-яё]+/giu, '-').replace(/^-|-$/g, '');
}
