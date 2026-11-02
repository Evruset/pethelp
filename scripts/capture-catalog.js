import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL('../apps/owner-app/package.json', import.meta.url));
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const prototypeUrl = 'http://127.0.0.1:8766/prototype-v50/index.html#catalog';
const runtimeUrl = 'http://127.0.0.1:8081';
const ownerPhone = process.env.OWNER_CAPTURE_PHONE ?? '+79991234567';
const ownerOtp = process.env.OWNER_CAPTURE_OTP ?? '246810';

(async () => {
  const artifactDir = path.join(__dirname, '../docs/ai/artifacts/owner-v50-catalog-live-closure');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const runtimeErrors = [];
  let assertionCount = 0;
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/api/owner/')) {
      runtimeErrors.push(`request: ${response.status()} ${response.url()}`);
    }
  });

  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  try {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      console.log(`Capturing Prototype (${vp.name})...`);
      await page.goto(prototypeUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(artifactDir, `prototype_${vp.name}.png`),
        fullPage: true,
      });

      console.log(`Navigating to Runtime Auth (${vp.name})...`);
      await page.goto(runtimeUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('#root').waitFor({ state: 'attached', timeout: 15000 });

      const loginButton = page.getByRole('button', { name: 'Войти', exact: true });
      const clinicsButton = page.getByText('Клиники', { exact: true }).last();
      await loginButton.or(clinicsButton).first().waitFor({ state: 'visible', timeout: 20000 });
      if (await loginButton.isVisible().catch(() => false)) {
        console.log('Auth screen detected. Performing OTP login...');
        await loginButton.click();
        await page.getByLabel('Номер телефона').fill(ownerPhone);
        await page.getByRole('button', { name: 'Получить код', exact: true }).click();
        await page.getByLabel('Код из сообщения').waitFor({ state: 'visible', timeout: 10000 });
        await page.getByLabel('Код из сообщения').fill(ownerOtp);
        await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
        const authAlert = page.getByRole('alert');
        await clinicsButton.or(authAlert).first().waitFor({ state: 'visible', timeout: 20000 });
        if (await authAlert.isVisible().catch(() => false)) {
          throw new Error(`Runtime authentication failed: ${await authAlert.textContent()}`);
        }
      }

      console.log(`Navigating to Catalog Route (${vp.name})...`);
      await clinicsButton.click();

      console.log('Waiting for ClinicCatalogScreen...');
      await page.getByText('Клиники VetHelp', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText('Выберите подходящий филиал', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
      runtimeErrors.length = 0;
      await page.waitForTimeout(2000);

      console.log(`Verifying authoritative search (${vp.name})...`);
      const searchInput = page.getByLabel('Поиск по клинике или адресу');
      await searchInput.fill('Большая Полянка');
      const searchResponsePromise = page.waitForResponse((response) => response.url().includes('/api/owner/v1/owner/clinic-catalog?q=') && response.status() === 200);
      await page.getByRole('button', { name: 'Найти', exact: true }).click();
      const searchResponse = await searchResponsePromise;
      const searchPayload = await searchResponse.json();
      if (!Array.isArray(searchPayload.clinics) || searchPayload.clinics.length === 0 || !searchPayload.clinics.every((clinic) => clinic.address.includes('Большая Полянка'))) {
        throw new Error(`Authoritative search returned an unexpected payload (${vp.name}).`);
      }
      assertionCount += 1;
      await page.getByText('Филиал · Москва, ул. Большая Полянка, 18', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
      assertionCount += 1;
      const geometry = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        undersizedTargets: [...document.querySelectorAll('[role="button"], button')]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
          })
          .map((element) => element.textContent?.trim() || element.getAttribute('aria-label') || '<unnamed>'),
      }));
      if (geometry.documentWidth > geometry.viewportWidth) {
        throw new Error(`Horizontal overflow (${vp.name}): ${geometry.documentWidth} > ${geometry.viewportWidth}`);
      }
      assertionCount += 1;
      if (geometry.undersizedTargets.length > 0) {
        throw new Error(`Touch targets below 44px (${vp.name}): ${geometry.undersizedTargets.join(', ')}`);
      }
      assertionCount += 1;

      await page.addScriptTag({ content: axeSource });
      const seriousAxeViolations = await page.evaluate(async () => {
        const result = await window.axe.run(document, { resultTypes: ['violations'] });
        return result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
      });
      if (seriousAxeViolations.length > 0) {
        throw new Error(`Axe serious/critical violations (${vp.name}): ${seriousAxeViolations.map((violation) => violation.id).join(', ')}`);
      }
      assertionCount += 1;
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(100);

      await page.screenshot({
        path: path.join(artifactDir, `runtime_${vp.name}.png`),
        fullPage: true,
      });

      console.log(`Verifying clinic handoff (${vp.name})...`);
      await page.getByRole('button', { name: 'Посмотреть услуги', exact: true }).first().click();
      await page.getByText('Выберите услугу', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
      assertionCount += 1;
      if (runtimeErrors.length > 0) {
        throw new Error(`Runtime errors detected (${vp.name}):\n${runtimeErrors.join('\n')}`);
      }
    }
    if (assertionCount < viewports.length * 6) throw new Error(`Insufficient assertions executed: ${assertionCount}`);
    console.log(`ASSERTIONS_EXECUTED=${assertionCount}`);
    console.log('SEARCH_ASSERTIONS=2');
    console.log('RUNTIME_ERRORS=0');
    console.log('SUCCESS: All screenshots captured successfully.');
  } catch (error) {
    await page.screenshot({ path: path.join(artifactDir, 'runtime_capture_failure.png'), fullPage: true }).catch(() => {});
    console.error('FAILED during capture pipeline:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
