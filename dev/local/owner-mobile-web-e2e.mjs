#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
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
const appDir = join(rootDir, 'apps/owner_mobile');
const outputDir = join(rootDir, '.dev-local/owner-mobile-web-e2e');
const screenshotsDir = join(outputDir, 'screenshots');
const videosDir = join(outputDir, 'videos');
const tracesDir = join(outputDir, 'traces');
const analysisPath = join(outputDir, 'analysis.json');
const networkSummaryPath = join(outputDir, 'network-summary.json');
const port = Number(process.env.OWNER_E2E_PORT ?? 3313);
const baseUrl = `http://127.0.0.1:${port}`;
const backendUrl = process.env.VETHELP_API_BASE_URL ?? 'http://127.0.0.1:3000';
const flutterBin =
  process.env.FLUTTER_BIN ??
  (existsSync(`${process.env.HOME}/develop/flutter-3.27.4/bin/flutter`)
    ? `${process.env.HOME}/develop/flutter-3.27.4/bin/flutter`
    : 'flutter');
const project = process.env.LOCAL_PROJECT ?? 'vethelp-alpha';
const composeFile = process.env.COMPOSE_FILE ?? 'docker-compose.local.yml';
const skipBuild = process.argv.includes('--skip-build');
const viewport = { width: 390, height: 844 };

const steps = [];
const networkEvents = [];
const requestBodies = [];
let ownerJwt = '';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${command} ${args.join(' ')} failed`);
  }
  return result.stdout?.trim() ?? '';
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
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

function composeArgs(...args) {
  return ['compose', '-p', project, '-f', composeFile, ...args];
}

async function waitFor(url, label, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await canFetch(url)) return;
    await sleep(1000);
  }
  throw new Error(`${label} is not reachable at ${url}`);
}

function prepareOutput() {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(screenshotsDir, { recursive: true });
  mkdirSync(videosDir, { recursive: true });
  mkdirSync(tracesDir, { recursive: true });
}

function ensureBackendAndSeed() {
  if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
    throw new Error('Docker daemon is not available. Start Docker Desktop first.');
  }
  run('docker', composeArgs('up', '-d', '--build'));
}

function ownerToken() {
  return run('docker', composeArgs(
    'exec',
    '-T',
    'backend',
    'node',
    '/workspace/dev/local/create-owner-token.mjs',
  ), { capture: true });
}

function flutterBuild(extraDefines = []) {
  if (skipBuild) return;
  run(flutterBin, [
    'build',
    'web',
    '--no-web-resources-cdn',
    '-t',
    'lib/owner_journey_main.dart',
    `--dart-define=VETHELP_API_BASE_URL=${backendUrl}`,
    `--dart-define=VETHELP_OWNER_JWT=${ownerJwt}`,
    ...extraDefines,
  ], { cwd: appDir });
}

function buildOwnerWebForE2E() {
  flutterBuild(['--dart-define=VETHELP_ENABLE_E2E_HOOKS=true']);
}

function verifyProductionBuildDoesNotExposeHooks() {
  if (skipBuild) {
    return {
      skipped: true,
      reason: '--skip-build was used',
    };
  }
  flutterBuild();
  const mainBundle = readFileSync(join(appDir, 'build/web/main.dart.js'), 'utf8');
  const leaked = mainBundle.includes('vethelpOwnerE2E');
  if (leaked) {
    throw new Error('Production owner web build leaks window.vethelpOwnerE2E.');
  }
  return {
    skipped: false,
    checkedBundle: 'apps/owner_mobile/build/web/main.dart.js',
    leaked,
  };
}

function startStaticServer() {
  const webDir = join(appDir, 'build/web');
  const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.mjs', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.wasm', 'application/wasm'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.svg', 'image/svg+xml'],
    ['.ico', 'image/x-icon'],
    ['.ttf', 'font/ttf'],
  ]);
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', baseUrl);
    const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const filePath = join(webDir, decodeURIComponent(pathname));
    const safePath = filePath.startsWith(webDir) ? filePath : join(webDir, 'index.html');
    const target = existsSync(safePath) ? safePath : join(webDir, 'index.html');
    const extensionMatch = target.match(/\.[^.]+$/);
    const contentType = mimeTypes.get(extensionMatch?.[0] ?? '') ?? 'application/octet-stream';
    const body = readFileSync(target);
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(body);
  });
  return new Promise((resolveStart, rejectStart) => {
    server.once('error', rejectStart);
    server.listen(port, '127.0.0.1', () => resolveStart(server));
  });
}

function analyzeScreenshot(path) {
  const script = `
from PIL import Image
import json, sys
img = Image.open(sys.argv[1]).convert("RGB")
pixels = list(img.getdata())
total = len(pixels)
non_white = sum(1 for r,g,b in pixels if (r, g, b) != (255, 255, 255))
dark = sum(1 for r,g,b in pixels if r < 245 or g < 245 or b < 245)
unique = len(set(pixels))
print(json.dumps({"nonWhiteRatio": non_white / total, "nonNearWhiteRatio": dark / total, "uniqueColors": unique}))
`;
  return JSON.parse(run('python3', ['-c', script, path], { capture: true }));
}

async function capture(page, name) {
  const screenshotPath = join(screenshotsDir, `${String(steps.length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const analysis = analyzeScreenshot(screenshotPath);
  if (analysis.nonNearWhiteRatio < 0.02 || analysis.uniqueColors < 20) {
    throw new Error(`Screenshot ${name} looks blank: ${JSON.stringify(analysis)}`);
  }
  steps.push({ name, screenshotPath, analysis });
}

async function waitForVisualReady(page) {
  const probePath = join(outputDir, 'visual-ready-probe.png');
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await page.screenshot({ path: probePath, fullPage: true });
    const analysis = analyzeScreenshot(probePath);
    if (analysis.nonNearWhiteRatio >= 0.02 && analysis.uniqueColors >= 20) {
      rmSync(probePath, { force: true });
      return;
    }
    await sleep(1000);
  }
  throw new Error('Owner web did not render a non-blank frame in time.');
}

async function clickUi(page, name, x, y, afterClick) {
  await page.mouse.click(x, y);
  if (afterClick) await afterClick();
  await waitForRenderedFrame(page);
  await capture(page, name);
}

async function dragScroll(page, fromY = 740, toY = 260) {
  await page.mouse.move(195, fromY);
  await page.mouse.down();
  await page.mouse.move(195, toY, { steps: 12 });
  await page.mouse.up();
  await waitForRenderedFrame(page);
}

async function waitForRenderedFrame(page) {
  await page.waitForFunction(() => {
    return Boolean(document.body && document.body.clientWidth > 0 && document.body.clientHeight > 0);
  }, null, { timeout: 20_000 });
}

function responseFor(pathPart, method = 'GET') {
  return (response) => {
    const request = response.request();
    return request.method() === method &&
      response.url().startsWith(backendUrl) &&
      response.url().includes(pathPart);
  };
}

function successfulResponseFor(pathPart, method = 'GET') {
  return (response) => responseFor(pathPart, method)(response) && response.status() < 400;
}

async function apiGet(path) {
  const response = await fetch(`${backendUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${ownerJwt}`,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function openBookingFlowFromHome(page, prefix) {
  await page.mouse.wheel(0, -1200);
  await capture(page, `${prefix}-home-ready`);
  const clinicsResponse = page.waitForResponse(successfulResponseFor('/v1/clinics?', 'GET'), { timeout: 30_000 });
  await clickUi(page, `${prefix}-open-catalog`, 195, 392, async () => {
    await clinicsResponse;
  });

  const detailResponse = page.waitForResponse(successfulResponseFor('/v1/clinics/', 'GET'), { timeout: 30_000 });
  const servicesResponse = page.waitForResponse(successfulResponseFor('/services', 'GET'), { timeout: 30_000 });
  const availabilityResponse = page.waitForResponse(successfulResponseFor('/availability', 'GET'), { timeout: 30_000 });
  await clickUi(page, `${prefix}-open-clinic`, 195, 430, async () => {
    await Promise.all([detailResponse, servicesResponse, availabilityResponse]);
  });

  await page.mouse.wheel(0, 1200);
  await capture(page, `${prefix}-clinic-service-and-availability`);
  const slotsResponse = page.waitForResponse(successfulResponseFor('/slots?', 'GET'), { timeout: 30_000 });
  await clickUi(page, `${prefix}-open-slot-picker`, 195, 535, async () => {
    await slotsResponse;
  });
  const nextDaySlotsResponse = page.waitForResponse(successfulResponseFor('/slots?', 'GET'), { timeout: 30_000 });
  await clickUi(page, `${prefix}-select-next-booking-day`, 150, 260, async () => {
    await nextDaySlotsResponse;
  });
  await clickUi(page, `${prefix}-select-slot`, 105, 405);
}

async function returnHomeFromHoldStatus(page, prefix) {
  await clickUi(page, `${prefix}-return-home`, 195, 792);
}

async function openAppointmentsFromHome(page, prefix) {
  const appointmentsResponse = page.waitForResponse(successfulResponseFor('/v1/owner/appointments', 'GET'), { timeout: 30_000 });
  await clickUi(page, `${prefix}-open-appointments`, 145, 820, async () => {
    await appointmentsResponse;
  });
}

async function runBookingHappyPath(page) {
  await openBookingFlowFromHome(page, 'booking-happy');
  const holdResponsePromise = page.waitForResponse(successfulResponseFor('/v1/booking-holds', 'POST'), { timeout: 30_000 });
  await clickUi(page, 'booking-happy-submit-hold', 195, 817, async () => {
    await holdResponsePromise;
    await page.waitForResponse(successfulResponseFor('/v1/booking-holds/', 'GET'), { timeout: 30_000 });
  });
  const holdResponse = await holdResponsePromise;
  const hold = await holdResponse.json();
  await returnHomeFromHoldStatus(page, 'booking-happy');
  await openAppointmentsFromHome(page, 'booking-happy');
  const appointments = await apiGet('/v1/owner/appointments');
  const appointment = appointments.find((item) => item.holdId === hold.holdId);
  if (!appointment) {
    throw new Error(`Created hold ${hold.holdId} is absent from owner appointments.`);
  }
  const detail = await apiGet(`/v1/owner/appointments/${hold.holdId}`);
  return {
    hold,
    appointment: {
      holdId: appointment.holdId,
      state: appointment.state,
      bucket: appointment.bucket,
      startsAt: appointment.startsAt,
      petName: appointment.pet?.name,
      clinicName: appointment.clinic?.name,
      clinicAddress: appointment.clinic?.address,
    },
    detail: {
      holdId: detail.holdId,
      state: detail.state,
      bucket: detail.bucket,
      startsAt: detail.startsAt,
      petName: detail.pet?.name,
      clinicName: detail.clinic?.name,
      clinicAddress: detail.location?.address,
    },
  };
}

async function runBookingConflictRetry(page) {
  await clickUi(page, 'booking-conflict-return-home-tab', 48, 820);
  await openBookingFlowFromHome(page, 'booking-conflict');
  const intercepted = [];
  let conflictInjected = false;
  await page.route(`${backendUrl}/v1/booking-holds`, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = JSON.parse(request.postData() ?? '{}');
    intercepted.push({
      slotId: body.slotId,
      idempotencyKey: request.headers()['idempotency-key'],
      correlationId: request.headers()['x-correlation-id'],
    });
    if (!conflictInjected) {
      conflictInjected = true;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 409,
          code: 'SLOT_ALREADY_TAKEN',
          message: 'Slot unavailable',
        }),
      });
      return;
    }
    await route.continue();
  });

  const refreshedSlots = page.waitForResponse(successfulResponseFor('/slots?', 'GET'), { timeout: 30_000 });
  await clickUi(page, 'booking-conflict-submit-conflicting-hold', 195, 817, async () => {
    await refreshedSlots;
  });

  const successfulHold = page.waitForResponse(successfulResponseFor('/v1/booking-holds', 'POST'), { timeout: 30_000 });
  await clickUi(page, 'booking-conflict-explicit-retry', 195, 817, async () => {
    await successfulHold;
    await page.waitForResponse(successfulResponseFor('/v1/booking-holds/', 'GET'), { timeout: 30_000 });
  });
  await page.unroute(`${backendUrl}/v1/booking-holds`);

  if (intercepted.length !== 2) {
    throw new Error(`Expected 2 visible submit attempts, got ${intercepted.length}.`);
  }
  if (intercepted[0].slotId !== intercepted[1].slotId) {
    throw new Error('Conflict retry changed slotId automatically.');
  }
  if (intercepted[0].idempotencyKey === intercepted[1].idempotencyKey) {
    throw new Error('Conflict retry reused Idempotency-Key.');
  }
  if (intercepted[0].correlationId !== intercepted[1].correlationId) {
    throw new Error('Conflict retry changed X-Correlation-ID.');
  }
  const response = await successfulHold;
  const hold = await response.json();
  await returnHomeFromHoldStatus(page, 'booking-conflict');
  return { hold, attempts: intercepted };
}

async function runInsuranceFlow(page) {
  await clickUi(page, 'insurance-home-tab', 48, 820);
  const profilesResponse = page.waitForResponse(successfulResponseFor('/v1/insurance/profiles', 'GET'), { timeout: 30_000 });
  await clickUi(page, 'insurance-open', 195, 535, async () => {
    await profilesResponse;
  });
  await dragScroll(page);
  await capture(page, 'insurance-consent-visible');

  const coverageRequests = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url() === `${backendUrl}/v1/insurance/coverage-checks`) {
      coverageRequests.push(request);
    }
  });

  await clickUi(page, 'insurance-submit-disabled-without-consent', 195, 520);
  if (coverageRequests.length !== 0) {
    throw new Error('Insurance coverage request was sent before consent.');
  }

  await clickUi(page, 'insurance-accept-consent', 36, 432);
  const coverageResponse = page.waitForResponse(successfulResponseFor('/v1/insurance/coverage-checks', 'POST'), { timeout: 30_000 });
  await clickUi(page, 'insurance-submit-result', 195, 520, async () => {
    await coverageResponse;
  });

  const request = coverageRequests[0];
  if (!request) throw new Error('Insurance submit did not send a coverage-check request.');
  const body = JSON.parse(request.postData() ?? '{}');
  const keys = Object.keys(body).sort();
  const allowed = ['consentVersion', 'partnerCode', 'petId'];
  if (JSON.stringify(keys) !== JSON.stringify(allowed)) {
    throw new Error(`Unexpected insurance request body keys: ${keys.join(', ')}`);
  }
  const correlationId = request.headers()['x-correlation-id'];
  if (!correlationId || !/^[0-9a-f-]{36}$/i.test(correlationId)) {
    throw new Error('Insurance request does not contain a UUID X-Correlation-ID.');
  }
  const response = await coverageResponse;
  return {
    status: response.status(),
    requestBody: body,
    correlationId,
  };
}

function verifyAccessibilitySourceContracts() {
  const files = [
    'apps/owner_mobile/lib/features/owner_journey/owner_journey_page.dart',
    'apps/owner_mobile/lib/features/catalog/public_catalog_page.dart',
    'apps/owner_mobile/lib/features/booking/marketplace/booking_marketplace_page.dart',
    'apps/owner_mobile/lib/features/booking/marketplace/booking_slot_grid.dart',
    'apps/owner_mobile/lib/features/insurance/coverage_check_page.dart',
  ];
  const joined = files.map((file) => readFileSync(join(rootDir, file), 'utf8')).join('\n');
  const checks = {
    semanticLabels: joined.includes('Semantics(') && joined.includes('label:'),
    bookingSlotHitTarget: joined.includes('AdaptiveHitTarget') && joined.includes('kVetHelpMinTapTarget'),
    ctaMinHeight: joined.includes('Size.fromHeight(52)'),
    statusHasText: joined.includes('Заявка отправлена в клинику') || joined.includes('Слот недоступен'),
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed);
  if (failed.length > 0) {
    throw new Error(`Accessibility source contract failed: ${failed.map(([name]) => name).join(', ')}`);
  }
  return checks;
}

function sanitizeHeaders(headers) {
  const copy = { ...headers };
  if (copy.authorization) copy.authorization = 'Bearer <redacted>';
  return copy;
}

async function runBrowserJourney() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: videosDir, size: viewport },
    serviceWorkers: 'block',
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(backendUrl)) return;
    const event = {
      type: 'request',
      method: request.method(),
      url: request.url(),
      headers: sanitizeHeaders(request.headers()),
    };
    networkEvents.push(event);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      requestBodies.push({
        method: request.method(),
        url: request.url(),
        postData: request.postData(),
      });
    }
  });
  page.on('response', (response) => {
    if (!response.url().startsWith(backendUrl)) return;
    networkEvents.push({
      type: 'response',
      method: response.request().method(),
      url: response.url(),
      status: response.status(),
    });
  });

  let report;
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => !document.querySelector('.flutter-loader'), null, { timeout: 60_000 });
    await waitForVisualReady(page);
    await waitForRenderedFrame(page);
    await capture(page, 'home');

    const happyPath = await runBookingHappyPath(page);
    const conflictRetry = await runBookingConflictRetry(page);
    const insurance = await runInsuranceFlow(page);
    const accessibility = verifyAccessibilitySourceContracts();

    const actionableConsoleMessages = consoleMessages.filter((message) => (
      !message.text.includes('WebGL') &&
      !message.text.includes('service worker') &&
      !message.text.includes('Service Worker registration blocked by Playwright') &&
      !message.text.includes('409 (Conflict)')
    ));
    const video = page.video();
    await context.tracing.stop({ path: join(tracesDir, 'owner-mobile-web-e2e-trace.zip') });
    await context.close();
    await browser.close();
    const videoPath = video ? await video.path() : null;

    report = {
      baseUrl,
      viewport,
      scenarios: {
        bookingHappyPath: happyPath,
        bookingConflictRetry: conflictRetry,
        insurance,
        accessibility,
      },
      steps,
      videoPath,
      tracePath: join(tracesDir, 'owner-mobile-web-e2e-trace.zip'),
      consoleMessages: actionableConsoleMessages,
      pageErrors,
      passed: actionableConsoleMessages.length === 0 && pageErrors.length === 0,
    };
  } catch (error) {
    await capture(page, 'failure-final').catch(() => {});
    await context.tracing.stop({ path: join(tracesDir, 'owner-mobile-web-e2e-failure-trace.zip') }).catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    writeFileSync(networkSummaryPath, `${JSON.stringify({ networkEvents, requestBodies }, null, 2)}\n`);
    throw error;
  }

  writeFileSync(networkSummaryPath, `${JSON.stringify({ networkEvents, requestBodies }, null, 2)}\n`);
  return report;
}

async function main() {
  prepareOutput();
  ensureBackendAndSeed();
  await waitFor(`${backendUrl}/v1/health`, 'Backend');
  run('make', ['local-seed']);
  ownerJwt = ownerToken();
  buildOwnerWebForE2E();
  const server = await startStaticServer();
  try {
    await waitFor(baseUrl, 'Owner web static server', 10);
    const report = await runBrowserJourney();
    const hookSafety = verifyProductionBuildDoesNotExposeHooks();
    report.hookSafety = hookSafety;
    writeFileSync(analysisPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    server.close();
  }
}

main().catch((error) => {
  writeFileSync(networkSummaryPath, `${JSON.stringify({ networkEvents, requestBodies }, null, 2)}\n`);
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
