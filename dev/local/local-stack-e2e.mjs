#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import playwright from '../../apps/clinic-portal/node_modules/playwright/index.js';

const { chromium } = playwright;

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const ownerAppDir = join(rootDir, 'apps/owner_mobile');
const portalDir = join(rootDir, 'apps/clinic-portal');
const outputDir = join(rootDir, '.dev-local/local-stack-e2e');
const screenshotsDir = join(outputDir, 'screenshots');
const ownerScreenshotsDir = join(screenshotsDir, 'owner');
const portalScreenshotsDir = join(screenshotsDir, 'portal');
const jsonDir = join(outputDir, 'json');
const videosDir = join(outputDir, 'videos');
const tracesDir = join(outputDir, 'traces');
const logsDir = join(outputDir, 'logs');
const networkSummaryPath = join(outputDir, 'network-summary.json');
const analysisPath = join(outputDir, 'analysis.json');
const backendUrl = (process.env.VETHELP_API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const mockMisUrl = (process.env.MOCK_MIS_BASE_URL ?? 'http://127.0.0.1:4101').replace(/\/$/, '');
const ownerPort = Number(process.env.LOCAL_STACK_OWNER_PORT ?? 3412);
const portalPort = Number(process.env.LOCAL_STACK_PORTAL_PORT ?? 3411);
const ownerBaseUrl = `http://127.0.0.1:${ownerPort}`;
const portalBaseUrl = `http://127.0.0.1:${portalPort}`;
const project = process.env.LOCAL_PROJECT ?? 'vethelp-alpha';
const composeFile = process.env.COMPOSE_FILE ?? 'docker-compose.local.yml';
const node20Path = process.env.NODE20_BIN ?? `${process.env.HOME}/.nvm/versions/node/v20.20.2/bin`;
const flutterBin =
  process.env.FLUTTER_BIN ??
  (existsSync(`${process.env.HOME}/develop/flutter-3.27.4/bin/flutter`)
    ? `${process.env.HOME}/develop/flutter-3.27.4/bin/flutter`
    : 'flutter');
const runId = process.env.LOCAL_STACK_E2E_RUN_ID ?? `lse2e-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const ownerViewport = { width: 390, height: 844 };

const ownerNetwork = [];
const portalNetwork = [];
const snapshots = [];
let ownerJwt = '';
let clinicAdminJwt = '';
let clinicSeed = null;
let localStackSlots = [];
let ownerServer = null;
let portalProcess = null;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: {
      ...process.env,
      PATH: `${node20Path}:${process.env.PATH ?? ''}`,
      ...(options.env ?? {}),
    },
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${command} ${args.join(' ')} failed`);
  }
  return result.stdout?.trim() ?? '';
}

function composeArgs(...args) {
  return ['compose', '-p', project, '-f', composeFile, ...args];
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function canFetch(url, init) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(url, { ...(init ?? {}), signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, label, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await canFetch(url)) return;
    await sleep(1000);
  }
  throw new Error(`${label} is not reachable at ${url}`);
}

function parseJsonFromOutput(output) {
  const trimmed = output.trim();
  const start = trimmed.lastIndexOf('{');
  if (start < 0) throw new Error(`Cannot find JSON in command output:\n${output}`);
  return JSON.parse(trimmed.slice(start));
}

function prepareOutput() {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(ownerScreenshotsDir, { recursive: true });
  mkdirSync(portalScreenshotsDir, { recursive: true });
  mkdirSync(jsonDir, { recursive: true });
  mkdirSync(videosDir, { recursive: true });
  mkdirSync(tracesDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
}

async function ensureBackend() {
  if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
    throw new Error('Docker daemon is not available. Start Docker Desktop first.');
  }
  if (!(await canFetch(`${backendUrl}/v1/health`))) {
    run('docker', composeArgs('up', '-d', '--build'));
  }
  await waitFor(`${backendUrl}/v1/health`, 'Backend');
}

function seedClinicAccess() {
  const output = run('docker', composeArgs(
    'exec',
    '-T',
    'backend',
    'npx',
    'ts-node',
    '/workspace/backend/scripts/seed-local-clinic-employee.ts',
  ), { capture: true });
  return parseJsonFromOutput(output);
}

function seedLocalStackSlots() {
  const source = `LOCAL_STACK_E2E_${runId}`.replace(/[^A-Z0-9_-]/gi, '_');
  const sql = `
    WITH target AS (
      SELECT location.id AS location_id, service.id AS service_id
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location
        ON location.clinic_id = clinic.id
       AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinic_services service
        ON service.clinic_location_id = location.id
       AND service.active = true
      WHERE clinic.public_name = 'VetHelp Pilot'
      ORDER BY service.code ASC
      LIMIT 1
    ),
    fixture(day_offset, hour) AS (
      VALUES
        (1, 10), (1, 12), (1, 14), (1, 16), (1, 18), (1, 20), (1, 22),
        (2, 10), (2, 12), (2, 14), (2, 16), (2, 18), (2, 20), (2, 22)
    ),
    inserted AS (
      INSERT INTO clinic_schema.appointment_slots (
        clinic_location_id,
        service_id,
        starts_at,
        ends_at,
        capacity,
        source,
        external_slot_id,
        integration_mode,
        last_freshness_sync
      )
      SELECT
        target.location_id,
        target.service_id,
        date_trunc('day', clock_timestamp()) + make_interval(days => fixture.day_offset, hours => fixture.hour),
        date_trunc('day', clock_timestamp()) + make_interval(days => fixture.day_offset, hours => fixture.hour) + interval '30 minutes',
        1,
        '${source}',
        '${source}-' || fixture.day_offset::text || '-' || fixture.hour::text,
        'LEVEL_A',
        clock_timestamp()
      FROM target
      CROSS JOIN fixture
      WHERE date_trunc('day', clock_timestamp()) + make_interval(days => fixture.day_offset, hours => fixture.hour) > clock_timestamp() + interval '30 minutes'
      RETURNING id, starts_at
    )
    SELECT COALESCE(
      json_agg(json_build_object('id', id::text, 'startsAt', starts_at) ORDER BY starts_at),
      '[]'::json
    )
    FROM inserted
  `;
  const output = run('docker', composeArgs(
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'vethelp',
    '-d',
    'vethelp',
    '-t',
    '-A',
    '-c',
    sql,
  ), { capture: true });
  return JSON.parse(output || '[]');
}

function tokenFromContainer(script, env = {}) {
  const envArgs = Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  return run('docker', composeArgs(
    'exec',
    '-T',
    ...envArgs,
    'backend',
    'node',
    `/workspace/dev/local/${script}`,
  ), { capture: true });
}

function buildOwnerWeb() {
  run(flutterBin, [
    'build',
    'web',
    '--no-web-resources-cdn',
    '-t',
    'lib/owner_journey_main.dart',
    `--dart-define=VETHELP_API_BASE_URL=${backendUrl}`,
    `--dart-define=VETHELP_OWNER_JWT=${ownerJwt}`,
  ], { cwd: ownerAppDir });
}

function startOwnerStaticServer() {
  const webDir = join(ownerAppDir, 'build/web');
  const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.wasm', 'application/wasm'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.ico', 'image/x-icon'],
    ['.ttf', 'font/ttf'],
  ]);
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', ownerBaseUrl);
    const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const requested = join(webDir, decodeURIComponent(pathname));
    const target = requested.startsWith(webDir) && existsSync(requested) ? requested : join(webDir, 'index.html');
    const extension = target.match(/\.[^.]+$/)?.[0] ?? '';
    response.writeHead(200, { 'Content-Type': mimeTypes.get(extension) ?? 'application/octet-stream' });
    response.end(readFileSync(target));
  });
  return new Promise((resolveStart, rejectStart) => {
    server.once('error', rejectStart);
    server.listen(ownerPort, '127.0.0.1', () => resolveStart(server));
  });
}

function startPortalServer() {
  const log = join(logsDir, 'clinic-portal.log');
  const child = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(portalPort)], {
    cwd: portalDir,
    env: {
      ...process.env,
      PATH: `${node20Path}:${process.env.PATH ?? ''}`,
      VETHELP_API_BASE_URL: backendUrl,
      VETHELP_CLINIC_JWT_SECRET: 'local-development-jwt-signing-key-not-for-shared-use',
      VETHELP_ALLOW_DEV_SESSION: 'true',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const append = (chunk) => {
    writeFileSync(log, chunk, { flag: 'a' });
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return child;
}

async function api(path, options = {}) {
  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  const name = `${String(snapshots.length + 1).padStart(2, '0')}-${snapshotName(options.method ?? 'GET', path)}.json`;
  const snapshotPath = join(jsonDir, name);
  writeFileSync(snapshotPath, `${JSON.stringify({ status: response.status, body }, null, 2)}\n`);
  snapshots.push({ path: snapshotPath, method: options.method ?? 'GET', url: path, status: response.status });
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function ownerApi(path, options = {}) {
  return api(path, {
    ...options,
    headers: { Authorization: `Bearer ${ownerJwt}`, ...(options.headers ?? {}) },
  });
}

function clinicApi(path, options = {}) {
  return api(path, {
    ...options,
    headers: { Authorization: `Bearer ${clinicAdminJwt}`, ...(options.headers ?? {}) },
  });
}

function snapshotName(method, path) {
  return `${method.toLowerCase()}-${path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 90)}`;
}

function sanitizeHeaders(headers) {
  const copy = { ...headers };
  if (copy.authorization) copy.authorization = 'Bearer <redacted>';
  return copy;
}

function watchNetwork(page, bucket, base) {
  page.on('request', (request) => {
    if (!request.url().startsWith(base)) return;
    bucket.push({
      type: 'request',
      method: request.method(),
      url: request.url(),
      headers: sanitizeHeaders(request.headers()),
      postData: request.postData(),
    });
  });
  page.on('response', (response) => {
    if (!response.url().startsWith(base)) return;
    bucket.push({
      type: 'response',
      method: response.request().method(),
      url: response.url(),
      status: response.status(),
    });
  });
}

async function capture(page, area, name) {
  const directory = area === 'owner' ? ownerScreenshotsDir : portalScreenshotsDir;
  const count = area === 'owner'
    ? ownerNetwork.filter((event) => event.type === 'screenshot').length + 1
    : portalNetwork.filter((event) => event.type === 'screenshot').length + 1;
  const path = join(directory, `${String(count).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  const marker = { type: 'screenshot', name, path };
  if (area === 'owner') ownerNetwork.push(marker);
  else portalNetwork.push(marker);
}

function successfulResponseFor(pathPart, method = 'GET') {
  return (response) => {
    const request = response.request();
    return request.method() === method &&
      response.url().startsWith(backendUrl) &&
      response.url().includes(pathPart) &&
      response.status() < 400;
  };
}

async function waitForRenderedFrame(page) {
  await page.waitForFunction(() => Boolean(document.body?.clientWidth && document.body?.clientHeight), null, { timeout: 30_000 });
}

async function clickOwner(page, name, x, y, afterClick) {
  await page.mouse.click(x, y);
  if (afterClick) await afterClick();
  await waitForRenderedFrame(page);
  await capture(page, 'owner', name);
}

async function dragOwnerScroll(page, fromY = 740, toY = 220) {
  await page.mouse.move(195, fromY);
  await page.mouse.down();
  await page.mouse.move(195, toY, { steps: 12 });
  await page.mouse.up();
  await waitForRenderedFrame(page);
}

async function ownerHome(page, name = 'owner-home') {
  await page.goto(ownerBaseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => !document.querySelector('.flutter-loader'), null, { timeout: 60_000 });
  await waitForRenderedFrame(page);
  await capture(page, 'owner', name);
}

async function openBookingFlowFromHome(
  page,
  prefix,
  { dayPoint = { x: 150, y: 260 }, slotPoint = { x: 105, y: 405 } } = {},
) {
  await page.mouse.wheel(0, -1200);
  await capture(page, 'owner', `${prefix}-home-ready`);
  const clinicsResponse = page.waitForResponse(successfulResponseFor('/v1/clinics?', 'GET'), { timeout: 30_000 });
  await clickOwner(page, `${prefix}-open-catalog`, 195, 392, async () => {
    await clinicsResponse;
  });

  const detailResponse = page.waitForResponse(successfulResponseFor('/v1/clinics/', 'GET'), { timeout: 30_000 });
  const servicesResponse = page.waitForResponse(successfulResponseFor('/services', 'GET'), { timeout: 30_000 });
  const availabilityResponse = page.waitForResponse(successfulResponseFor('/availability', 'GET'), { timeout: 30_000 });
  await clickOwner(page, `${prefix}-open-clinic`, 195, 430, async () => {
    await Promise.all([detailResponse, servicesResponse, availabilityResponse]);
  });

  await page.mouse.wheel(0, 1200);
  await capture(page, 'owner', `${prefix}-clinic-service-and-availability`);
  const slotsResponse = page.waitForResponse(successfulResponseFor('/slots?', 'GET'), { timeout: 30_000 });
  await clickOwner(page, `${prefix}-open-slot-picker`, 195, 535, async () => {
    await slotsResponse;
  });
  const nextDaySlotsResponse = page.waitForResponse(successfulResponseFor('/slots?', 'GET'), { timeout: 30_000 });
  await clickOwner(page, `${prefix}-select-next-booking-day`, dayPoint.x, dayPoint.y, async () => {
    await nextDaySlotsResponse;
  });
  await clickOwner(page, `${prefix}-select-slot`, slotPoint.x, slotPoint.y);
}

async function createBookingThroughOwnerUi(page, prefix, bookingOptions) {
  await ownerHome(page, `${prefix}-home`);
  await openBookingFlowFromHome(page, prefix, bookingOptions);
  const holdResponsePromise = page.waitForResponse(successfulResponseFor('/v1/booking-holds', 'POST'), { timeout: 30_000 });
  await clickOwner(page, `${prefix}-submit-booking`, 195, 817, async () => {
    await holdResponsePromise;
    await page.waitForResponse(successfulResponseFor('/v1/booking-holds/', 'GET'), { timeout: 30_000 });
  });
  const hold = await (await holdResponsePromise).json();
  await clickOwner(page, `${prefix}-return-home`, 195, 792);
  const appointmentsResponse = page.waitForResponse(successfulResponseFor('/v1/owner/appointments', 'GET'), { timeout: 30_000 });
  await clickOwner(page, `${prefix}-open-owner-appointments`, 145, 820, async () => {
    await appointmentsResponse;
  });
  const detail = await ownerApi(`/v1/owner/appointments/${hold.holdId}`);
  return { hold, detail };
}

async function openOwnerCare(page, petId, expectedSummary) {
  await page.setViewportSize({ width: ownerViewport.width, height: 1320 });
  try {
    await ownerHome(page, 'owner-open-home-for-pet-diary');
    await capture(page, 'owner', 'owner-home-care-card-visible');
    const careResponse = page.waitForResponse(successfulResponseFor(`/v1/owner/pets/${petId}/care-summary`, 'GET'), { timeout: 30_000 });
    await page.mouse.click(195, 990);
    await careResponse;
    await waitForRenderedFrame(page);
    await capture(page, 'owner', expectedSummary ? 'owner-pet-diary-summary-visible' : 'owner-pet-diary-no-summary');
  } finally {
    await page.setViewportSize(ownerViewport);
  }
}

async function requestCancellationThroughOwnerUi(page, holdId) {
  const detailResponse = page.waitForResponse(successfulResponseFor(`/v1/owner/appointments/${holdId}`, 'GET'), { timeout: 30_000 });
  await clickOwner(page, 'cancellation-open-appointment-detail', 195, 210, async () => {
    await detailResponse;
  });
  await page.mouse.wheel(0, 1200);
  await capture(page, 'owner', 'cancellation-detail-actions-visible');

  const cancellationResponse = page.waitForResponse(successfulResponseFor(`/v1/booking-holds/${holdId}/cancellation-requests`, 'POST'), { timeout: 30_000 });
  const cancelText = page.getByText('Запросить отмену').last();
  if (await cancelText.count()) {
    await cancelText.click();
  } else {
    await page.mouse.click(195, 780);
  }
  await waitForRenderedFrame(page);
  await capture(page, 'owner', 'cancellation-confirmation-dialog');
  const confirmText = page.getByText('Запросить отмену').last();
  if (await confirmText.count()) {
    await confirmText.click();
  } else {
    await page.mouse.click(245, 510);
  }
  await cancellationResponse;
  await waitForRenderedFrame(page);
  await capture(page, 'owner', 'cancellation-requested-state');
}

async function startPortalSession(page) {
  const params = new URLSearchParams({ token: clinicAdminJwt });
  await page.goto(`${portalBaseUrl}/api/dev/local-session?${params}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
}

async function openPortalSchedule(page, name) {
  await page.goto(`${portalBaseUrl}/clinics/${clinicSeed.clinicId}/locations/${clinicSeed.locationId}/schedule`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForSelector('text=Расписание', { timeout: 30_000 }).catch(() => undefined);
  await capture(page, 'portal', name);
}

async function completeAppointmentThroughPortalUi(page, holdId, slotId, summary) {
  await openPortalSchedule(page, 'portal-schedule-before-complete');
  const row = page.getByTestId(`schedule-slot-${slotId}`);
  await row.waitFor({ state: 'visible', timeout: 30_000 });
  await capture(page, 'portal', 'portal-created-booking-visible-in-schedule');
  const completeResponse = page.waitForResponse((response) => (
    response.url().includes(`/api/clinic/booking-holds/${holdId}/complete`) &&
    response.request().method() === 'POST' &&
    response.status() < 400
  ), { timeout: 30_000 });
  page.once('dialog', (dialog) => dialog.accept(summary));
  await row.getByRole('button', { name: 'Закрыть приём' }).click();
  await completeResponse;
  await page.getByText('Приём закрыт. Заключение отправлено владельцу.').waitFor({ state: 'visible', timeout: 30_000 });
  await capture(page, 'portal', 'portal-appointment-completed');
}

async function assertCancelledIsNonActionableInPortal(page, slotId) {
  await openPortalSchedule(page, 'portal-schedule-after-owner-cancellation');
  const row = page.getByTestId(`schedule-slot-${slotId}`);
  await row.waitFor({ state: 'visible', timeout: 30_000 });
  const complete = row.getByRole('button', { name: 'Закрыть приём' });
  const disabled = await complete.isDisabled();
  if (!disabled) throw new Error('Cancelled appointment can still be completed in Clinic Portal UI.');
  await capture(page, 'portal', 'portal-cancelled-appointment-non-actionable');
}

async function verifyOcrApiFlow(petId) {
  const upload = await ownerApi(`/v1/owner/pets/${petId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      fileUrl: `https://local.vethelp.test/e2e/${runId}/medical-history.jpg`,
      docType: 'HISTORY',
    }),
  });
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const summary = await ownerApi(`/v1/owner/pets/${petId}/care-summary`);
    const ocrDocument = summary.documents.find((document) => (
      document.type === 'OCR_MEDICAL_HISTORY' &&
      typeof document.value === 'string' &&
      document.value.includes(upload.documentId)
    ));
    if (ocrDocument) {
      return { upload, document: ocrDocument };
    }
    await sleep(2000);
  }
  throw new Error(`OCR API flow did not process document ${upload.documentId} within the local-stack timeout.`);
}

async function dbSnapshot(holdId) {
  const sql = `
    SELECT
      h.id::text AS "holdId",
      h.state,
      h.slot_id::text AS "slotId",
      h.pet_id::text AS "petId",
      h.clinical_summary AS "clinicalSummary",
      s.integration_mode AS "integrationMode",
      s.status AS "slotStatus",
      s.booked_count AS "bookedCount",
      COALESCE((
        SELECT count(*)::int
        FROM booking_schema.outbox_events event
        WHERE event.aggregate_id = h.id
          AND event.event_type LIKE 'mis.%'
      ), 0) AS "misOutboxEvents"
    FROM booking_schema.booking_holds h
    JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
    WHERE h.id = '${holdId}'::uuid
  `;
  const output = run('docker', composeArgs(
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'vethelp',
    '-d',
    'vethelp',
    '-t',
    '-A',
    '-F',
    '\t',
    '-c',
    sql,
  ), { capture: true });
  const [hold, state, slotId, petId, clinicalSummary, integrationMode, slotStatus, bookedCount, misOutboxEvents] = output.split('\t');
  return { holdId: hold, state, slotId, petId, clinicalSummary: clinicalSummary || null, integrationMode, slotStatus, bookedCount: Number(bookedCount), misOutboxEvents: Number(misOutboxEvents) };
}

async function mockMisState() {
  const response = await fetch(`${mockMisUrl}/__mock/state`);
  return response.json();
}

async function runJourney() {
  prepareOutput();
  await ensureBackend();
  clinicSeed = seedClinicAccess();
  localStackSlots = seedLocalStackSlots();
  if (localStackSlots.length < 2) {
    throw new Error('Local-stack E2E could not seed enough free appointment slots.');
  }
  ownerJwt = tokenFromContainer('create-owner-token.mjs');
  clinicAdminJwt = tokenFromContainer('create-clinic-token.mjs', {
    LOCAL_CLINIC_ID: clinicSeed.clinicId,
    LOCAL_CLINIC_LOCATION_ID: clinicSeed.locationId,
    LOCAL_CLINIC_ROLES: 'CLINIC_ADMIN',
  });
  buildOwnerWeb();
  ownerServer = await startOwnerStaticServer();
  portalProcess = startPortalServer();
  await waitFor(ownerBaseUrl, 'Owner web');
  await waitFor(portalBaseUrl, 'Clinic Portal');

  const browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext({
    viewport: ownerViewport,
    recordVideo: { dir: videosDir, size: ownerViewport },
    serviceWorkers: 'block',
  });
  const portalContext = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    recordVideo: { dir: videosDir, size: { width: 1440, height: 960 } },
    serviceWorkers: 'block',
  });
  await ownerContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await portalContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const ownerPage = await ownerContext.newPage();
  const portalPage = await portalContext.newPage();
  watchNetwork(ownerPage, ownerNetwork, backendUrl);
  watchNetwork(portalPage, portalNetwork, portalBaseUrl);

  try {
    const health = await api('/v1/health');
    const pets = await ownerApi('/v1/owner/pets');
    const selectedPet = pets[0];
    if (!selectedPet?.id) throw new Error('Owner has no seeded pet for local-stack E2E.');
    const misBefore = await mockMisState();

    const summary = `Local stack E2E clinical summary ${runId}`;
    const booking = await createBookingThroughOwnerUi(ownerPage, 'wave1-booking');
    if (booking.hold.state !== 'CONFIRMED') {
      throw new Error(`Autonomous booking must be CONFIRMED, got ${booking.hold.state}`);
    }
    const holdDbBefore = await dbSnapshot(booking.hold.holdId);
    if (holdDbBefore.misOutboxEvents !== 0) {
      throw new Error(`Autonomous booking emitted MIS outbox events for ${booking.hold.holdId}.`);
    }

    await startPortalSession(portalPage);
    await completeAppointmentThroughPortalUi(portalPage, booking.hold.holdId, booking.hold.slotId, summary);
    const completedDetail = await ownerApi(`/v1/owner/appointments/${booking.hold.holdId}`);
    if (completedDetail.state !== 'COMPLETED') {
      throw new Error(`Owner appointment readback expected COMPLETED, got ${completedDetail.state}`);
    }
    const careSummary = await ownerApi(`/v1/owner/pets/${selectedPet.id}/care-summary`);
    const completedVisit = careSummary.visits.find((visit) => visit.holdId === booking.hold.holdId);
    if (completedVisit?.clinicalSummary !== summary) {
      throw new Error('Pet Diary authoritative readback does not contain the clinical summary.');
    }
    await openOwnerCare(ownerPage, selectedPet.id, true);

    const cancellation = await createBookingThroughOwnerUi(ownerPage, 'wave2-cancellation', {
      dayPoint: { x: 265, y: 260 },
      slotPoint: { x: 105, y: 405 },
    });
    await requestCancellationThroughOwnerUi(ownerPage, cancellation.hold.holdId);
    const cancelledDetail = await ownerApi(`/v1/owner/appointments/${cancellation.hold.holdId}`);
    if (cancelledDetail.state !== 'CANCELLATION_REQUESTED') {
      throw new Error(`Cancellation readback expected CANCELLATION_REQUESTED, got ${cancelledDetail.state}`);
    }
    const duplicateCancellation = await ownerApi(`/v1/booking-holds/${cancellation.hold.holdId}/cancellation-requests`, {
      method: 'POST',
      headers: { 'X-Correlation-ID': randomUUID() },
    });
    if (duplicateCancellation.state !== 'CANCELLATION_REQUESTED') {
      throw new Error('Repeated cancellation did not return the authoritative cancellation-requested state.');
    }
    await assertCancelledIsNonActionableInPortal(portalPage, cancellation.hold.slotId);
    const cancellationCare = await ownerApi(`/v1/owner/pets/${selectedPet.id}/care-summary`);
    const cancelledVisit = cancellationCare.visits.find((visit) => visit.holdId === cancellation.hold.holdId);
    if (cancelledVisit?.clinicalSummary) {
      throw new Error('Cancelled appointment unexpectedly has a Pet Diary clinical summary.');
    }
    const ocr = await verifyOcrApiFlow(selectedPet.id);
    await openOwnerCare(ownerPage, selectedPet.id, false);

    const misAfter = await mockMisState();
    await ownerContext.tracing.stop({ path: join(tracesDir, 'owner-local-stack-trace.zip') });
    await portalContext.tracing.stop({ path: join(tracesDir, 'portal-local-stack-trace.zip') });
    const ownerVideo = ownerPage.video();
    const portalVideo = portalPage.video();
    await ownerContext.close();
    await portalContext.close();
    await browser.close();
    const report = {
      runId,
      health,
      featureFlags: {
        FEATURE_MIS_INTEGRATION: false,
        FEATURE_ONLINE_PAYMENTS: false,
      },
      clinicSeed,
      localStackSlots,
      selectedPet: { id: selectedPet.id, name: selectedPet.name },
      wave1: {
        holdId: booking.hold.holdId,
        slotId: booking.hold.slotId,
        ownerStateAfterCreate: booking.hold.state,
        ownerStateAfterComplete: completedDetail.state,
        clinicalSummary: summary,
        dbBeforeComplete: holdDbBefore,
      },
      wave2: {
        holdId: cancellation.hold.holdId,
        slotId: cancellation.hold.slotId,
        ownerStateAfterCancellation: cancelledDetail.state,
      },
      ocr: {
        uiSkipped: true,
        reason: 'Owner UI currently displays documents and care summary but has no visible document upload control.',
        apiVerified: true,
        upload: ocr.upload,
        document: ocr.document,
      },
      externalMocks: {
        mis: `${mockMisUrl}/__mock/state`,
        acquiring: 'local stack mock-acquiring is running but online payments are disabled for this journey',
        livekit: 'not used in this cross-channel booking journey',
      },
      misReservationCountBefore: misBefore.reservations?.length ?? null,
      misReservationCountAfter: misAfter.reservations?.length ?? null,
      evidence: {
        outputDir,
        screenshotsDir,
        videosDir,
        tracesDir,
        jsonDir,
      },
      videos: {
        owner: ownerVideo ? await ownerVideo.path() : null,
        portal: portalVideo ? await portalVideo.path() : null,
      },
      snapshots,
    };
    writeFileSync(networkSummaryPath, `${JSON.stringify({ ownerNetwork, portalNetwork }, null, 2)}\n`);
    writeFileSync(analysisPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await capture(ownerPage, 'owner', 'failure-final').catch(() => undefined);
    await capture(portalPage, 'portal', 'failure-final').catch(() => undefined);
    await ownerContext.tracing.stop({ path: join(tracesDir, 'owner-local-stack-failure-trace.zip') }).catch(() => undefined);
    await portalContext.tracing.stop({ path: join(tracesDir, 'portal-local-stack-failure-trace.zip') }).catch(() => undefined);
    await ownerContext.close().catch(() => undefined);
    await portalContext.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    writeFileSync(networkSummaryPath, `${JSON.stringify({ ownerNetwork, portalNetwork }, null, 2)}\n`);
    const backendLogs = run('docker', composeArgs('logs', '--no-color', '--tail', '300', 'backend'), { capture: true });
    writeFileSync(join(logsDir, 'backend-failure.log'), backendLogs);
    throw error;
  }
}

async function main() {
  try {
    await runJourney();
  } finally {
    if (ownerServer) ownerServer.close();
    if (portalProcess) portalProcess.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
