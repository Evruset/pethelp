import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const clinicRequire = createRequire(join(repoRoot, 'apps/clinic-portal/package.json'));
const { chromium } = clinicRequire('@playwright/test');
const axeModule = clinicRequire('@axe-core/playwright');
const AxeBuilder = axeModule.default ?? axeModule.AxeBuilder ?? axeModule;

const baseUrl = required('OWNER_WEB_URL');
const phone = required('OWNER_PHONE');
const otp = required('OWNER_OTP');
const evidenceRoot = process.env.R2J_EVIDENCE_ROOT ?? '/tmp/pethelp-owner-r2j-live';
const viewports = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
const sections = [['requiresAction', 'Требуют внимания'], ['active', 'Предстоящие'], ['history', 'История']];
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const enumPattern = /\b(?:REQUIRES_ACTION|ACTIVE|HISTORY|ALTERNATIVE_PENDING|CONFIRMED|COMPLETED|CANCELLATION_REQUESTED|RESCHEDULE_REQUESTED|MANUAL_CONFIRM_PENDING|SLA_BREACHED|MIS_RESERVATION_PENDING|MIS_RECONCILIATION_PENDING|MIS_HELD|RELEASED|EXPIRED)\b/;

await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
let collectErrors = false;

page.on('console', m => { if (collectErrors && m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => { if (collectErrors) pageErrors.push(String(e)); });
page.on('response', r => {
  if (collectErrors && r.url().includes('/api/owner/') && r.status() >= 400) failedRequests.push({ url: r.url(), status: r.status() });
});
page.on('requestfailed', r => {
  if (collectErrors && r.url().includes('/api/owner/')) failedRequests.push({ url: r.url(), failure: r.failure()?.errorText ?? 'failed' });
});

const manifest = { schemaVersion: 1, goal: 'OWNER-V50-R2J', startedAt: new Date().toISOString(), bookings: null, selectedPetPreserved: null, viewports: [], runtime: null };

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await login(page);
  collectErrors = true;

  const homeBefore = await getJson(page, '/api/owner/v1/owner/home');
  const selectedBefore = homeBefore?.selectedPet?.id ?? null;

  await page.getByRole('button', { name: /Записи/ }).first().click();
  await page.getByText('Мои записи', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });

  const bookings = await getJson(page, '/api/owner/v1/owner/bookings?limit=20');
  validateBookings(bookings);
  const counts = Object.fromEntries(sections.map(([key]) => [key, bookings[key].length]));
  manifest.bookings = { counts, hasNextCursor: bookings.nextCursor !== null };

  for (const [key, heading] of sections) {
    const headingCount = await page.getByText(heading, { exact: true }).count();
    if (bookings[key].length > 0 && headingCount === 0) throw new Error(`Missing section ${heading}`);
    if (bookings[key].length === 0 && headingCount !== 0) throw new Error(`Unexpected empty section ${heading}`);
    for (const row of bookings[key]) {
      const label = row?.presentation?.label;
      if (typeof label !== 'string' || !label.trim()) throw new Error(`Missing server label in ${key}`);
      if ((await page.getByText(label, { exact: true }).count()) === 0) throw new Error(`Server label not rendered: ${label}`);
    }
  }

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const metrics = await inspect(page);
    const axe = await new AxeBuilder({ page }).analyze();
    const seriousCritical = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    const screenshot = join(evidenceRoot, `bookings-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    manifest.viewports.push({ ...viewport, screenshot, ...metrics, axeSeriousCritical: seriousCritical.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) });
    if (metrics.horizontalOverflow !== 0) throw new Error(`${viewport.width}x${viewport.height}: overflow=${metrics.horizontalOverflow}`);
    if (metrics.targetsBelow44.length !== 0) throw new Error(`${viewport.width}x${viewport.height}: targetsBelow44=${metrics.targetsBelow44.length}`);
    if (metrics.rawUuidCount !== 0 || metrics.rawEnumCount !== 0) throw new Error(`${viewport.width}x${viewport.height}: raw identifiers rendered`);
    if (seriousCritical.length !== 0) throw new Error(`${viewport.width}x${viewport.height}: axe serious/critical=${seriousCritical.length}`);
  }

  await page.getByRole('button', { name: /Главная/ }).first().click();
  await page.getByText('Здравствуйте!', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  const homeAfter = await getJson(page, '/api/owner/v1/owner/home');
  const selectedAfter = homeAfter?.selectedPet?.id ?? null;
  manifest.selectedPetPreserved = selectedBefore === selectedAfter;
  if (!manifest.selectedPetPreserved) throw new Error('Selected pet changed across Bookings navigation');

  manifest.runtime = { consoleErrors, pageErrors, failedRequests };
  if (consoleErrors.length || pageErrors.length || failedRequests.length) throw new Error(`Runtime errors console=${consoleErrors.length} page=${pageErrors.length} requests=${failedRequests.length}`);

  manifest.status = 'PASS';
  manifest.completedAt = new Date().toISOString();
  await save(manifest);
  console.log(`OWNER_BOOKINGS_COUNTS=${JSON.stringify(counts)}`);
  for (const v of manifest.viewports) console.log(`R2J_VIEWPORT_${v.width}x${v.height}=PASS overflow=${v.horizontalOverflow} targetsBelow44=${v.targetsBelow44.length} rawUuid=${v.rawUuidCount} rawEnum=${v.rawEnumCount} axeSeriousCritical=${v.axeSeriousCritical.length}`);
  console.log('OWNER_SELECTED_PET_PRESERVED=PASS');
  console.log('OWNER_RUNTIME_ERRORS=PASS console=0 page=0 requests=0');
  console.log(`R2J_EVIDENCE=${evidenceRoot}`);
  console.log('OWNER_V50_R2J_LIVE=PASS');
} catch (error) {
  manifest.status = 'FAIL';
  manifest.completedAt = new Date().toISOString();
  manifest.error = error instanceof Error ? error.message : String(error);
  manifest.runtime = { consoleErrors, pageErrors, failedRequests };
  await save(manifest);
  console.error(`OWNER_V50_R2J_LIVE=FAIL ${manifest.error}`);
  console.error(`R2J_EVIDENCE=${evidenceRoot}`);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function login(target) {
  if ((await target.getByText('Здравствуйте!', { exact: true }).count()) > 0) return;
  const start = target.getByRole('button', { name: 'Войти' });
  if ((await start.count()) > 0) await start.first().click();
  await target.getByLabel('Номер телефона').fill(phone);
  await target.getByRole('button', { name: 'Получить код' }).click();
  await target.getByText('Введите код', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await target.getByLabel('Код из сообщения').fill(otp);
  await target.getByRole('button', { name: 'Подтвердить' }).click();
  await target.getByText('Здравствуйте!', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
}

async function getJson(target, path) {
  return target.evaluate(async p => {
    const response = await fetch(p, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const text = await response.text();
    if (!response.ok) throw new Error(`${p} -> ${response.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }, path);
}

function validateBookings(value) {
  if (!value || typeof value !== 'object') throw new Error('Bookings response is not an object');
  for (const [key] of sections) if (!Array.isArray(value[key])) throw new Error(`Bookings response missing ${key}`);
  if (!(value.nextCursor === null || typeof value.nextCursor === 'string')) throw new Error('Invalid nextCursor');
}

async function inspect(target) {
  return target.evaluate(({ uuidSource, enumSource }) => {
    const body = document.body.innerText || '';
    const root = document.documentElement;
    const targetsBelow44 = [];
    for (const el of document.querySelectorAll('button,[role="button"],a[href],input,select,textarea')) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;
      if (rect.width < 44 || rect.height < 44) targetsBelow44.push({ text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80), width: Math.round(rect.width), height: Math.round(rect.height) });
    }
    return {
      horizontalOverflow: Math.max(0, Math.ceil(root.scrollWidth - root.clientWidth)),
      targetsBelow44,
      rawUuidCount: (body.match(new RegExp(uuidSource, 'ig')) || []).length,
      rawEnumCount: (body.match(new RegExp(enumSource, 'g')) || []).length,
    };
  }, { uuidSource: uuidPattern.source, enumSource: enumPattern.source });
}

async function save(value) {
  await writeFile(join(evidenceRoot, 'manifest.json'), `${JSON.stringify(value, null, 2)}\n`);
}
