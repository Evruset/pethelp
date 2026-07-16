import { access, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

import { inspectPngTopBand } from './v50-owner03-capture-utils.mjs';

const root = process.env.V50_EVIDENCE_ROOT;
const mode = process.env.V50_EVIDENCE_MODE ?? 'runtime';
const cdpEndpoint = process.env.V50_EVIDENCE_CDP ?? 'http://127.0.0.1:9222';
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');
if (!['runtime', 'prototype'].includes(mode)) {
  throw new Error(`Unsupported V50_EVIDENCE_MODE: ${mode}`);
}

const allViewports = [[375, 812], [412, 915], [768, 1024], [1440, 900]];
const allStates = [
  'CATALOG_READY_LIST', 'CATALOG_READY_MAP', 'CATALOG_FILTERED',
  'CATALOG_EMPTY', 'CATALOG_LOCATION_DENIED', 'CATALOG_OFFLINE_STALE',
  'CLINIC_READY', 'CLINIC_STALE_AVAILABILITY', 'CLINIC_NO_SLOTS',
  'DOCTORS_READY', 'DOCTORS_EMPTY', 'DOCTOR_PROFILE',
];
const requestedViewports = new Set((process.env.V50_EVIDENCE_VIEWPORTS ?? '')
  .split(',').map((value) => value.trim()).filter(Boolean));
const requestedStates = new Set((process.env.V50_EVIDENCE_STATES ?? '')
  .split(',').map((value) => value.trim()).filter(Boolean));
const viewports = requestedViewports.size === 0 ? allViewports
  : allViewports.filter(([w, h]) => requestedViewports.has(`${w}x${h}`));
const states = requestedStates.size === 0 ? allStates
  : allStates.filter((state) => requestedStates.has(state));
if (viewports.length === 0 || states.length === 0) {
  throw new Error('No supported evidence selection');
}

const browser = await chromium.connectOverCDP(cdpEndpoint);
const context = browser.contexts()[0];
if (!context) throw new Error(`No Chrome context available at ${cdpEndpoint}`);

try {
  for (const [width, height] of viewports) {
    if (mode === 'runtime') {
      for (const state of states) {
        await capture(`http://127.0.0.1:8765/?state=${state}`,
          `${root}/runtime/${width}x${height}/${state}.png`, width, height);
      }
    } else {
      for (const [name, anchor] of Object.entries({
        catalog: 'catalog', clinic: 'clinic', doctors: 'doctor-select', doctor: 'doctor-detail',
      })) {
        await capture(`http://127.0.0.1:8766/prototype-v50/index.html#${anchor}`,
          `${root}/prototype/${name}/${width}x${height}.png`, width, height);
      }
    }
  }
} finally {
  // Keep the externally managed Chrome process alive for the runtime/prototype pair.
  for (const page of context.pages()) {
    if (page.url() !== 'about:blank') await page.close();
  }
}
// connectOverCDP attaches to an externally managed browser; terminate only this
// capture process rather than closing the shared Chrome instance.
process.exit(0);

async function capture(url, file, width, height) {
  if (process.env.V50_EVIDENCE_RESUME === 'true') {
    try {
      await access(file);
      return;
    } catch {
      // Missing artifacts are captured below; existing commit-bound PNGs stay intact.
    }
  }
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  try {
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Network.setBypassServiceWorker', { bypass: true });
    await client.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 768,
      screenWidth: width, screenHeight: height,
    });
    await client.send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 246, g: 248, b: 251, a: 1 },
    });

    const target = new URL(url);
    target.searchParams.set('v50Evidence', `${Date.now()}-${Math.random()}`);
    await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });

    if (mode === 'runtime') {
      await page.waitForFunction(() => {
        const root = document.querySelector('flutter-view, flt-glass-pane');
        if (!root) return false;
        const rect = root.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }, null, { timeout: 45_000 });
    } else {
      await page.waitForLoadState('load', { timeout: 45_000 });
      // The prototype skip link is intentionally off-screen until focused. Its
      // translated edge must not become a screenshot band in an unfocused capture.
      await page.addStyleTag({ content: `
        html, body { background: #f6f8fb !important; }
        .skip-link:not(:focus) { display: none !important; }
      ` });
      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        document.body.style.scrollBehavior = 'auto';
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
      });
    }

    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))));
    });
    const settleMs = Number(process.env.V50_EVIDENCE_DELAY_MS ?? 500);
    if (settleMs > 0) await page.waitForTimeout(settleMs);
    if (mode === 'prototype') {
      await page.evaluate(() => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
      });
    }

    await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
    const screenshotOptions = {
      fullPage: false,
      animations: 'disabled',
      caret: 'hide',
      scale: 'device',
    };
    let previousClean;
    let stableCapture;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = await page.screenshot(screenshotOptions);
      const band = inspectPngTopBand(candidate);
      if (!band.hasBlackBand && previousClean?.equals(candidate)) {
        stableCapture = candidate;
        break;
      }
      previousClean = band.hasBlackBand ? undefined : candidate;
      await page.waitForTimeout(300);
    }
    if (!stableCapture) {
      throw new Error(`No clean stable screenshot frame: ${url}`);
    }
    await writeFile(file, stableCapture);
  } finally {
    await client.detach();
    await page.close();
  }
}
