import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { inspectPngTopBand } from './v50-owner03-capture-utils.mjs';

const root = process.env.V50_EVIDENCE_ROOT;
const runtimeCommit = process.env.V50_RUNTIME_COMMIT;
if (!root || !runtimeCommit) throw new Error('V50_EVIDENCE_ROOT and V50_RUNTIME_COMMIT are required');
const slice = process.env.V50_SLICE ?? 'V50-OWNER-05';
const owner06 = slice === 'V50-OWNER-06';
const owner07 = slice === 'V50-OWNER-07';

const viewports = [[375, 812], [412, 915], [768, 1024], [1440, 900]];
const states = owner07 ? [
  'ALTERNATIVE_READY', 'ALTERNATIVE_PRICE_CHANGED', 'ALTERNATIVE_EXPIRING',
  'ALTERNATIVE_EXPIRED', 'ALTERNATIVE_SUPERSEDED', 'ALTERNATIVE_SLOT_UNAVAILABLE',
  'ALTERNATIVE_ACCEPT_SUBMITTING', 'ALTERNATIVE_ACCEPTED',
  'ALTERNATIVE_DECLINE_CONFIRMATION', 'ALTERNATIVE_DECLINED',
  'ALTERNATIVE_OFFLINE_STALE', 'ALTERNATIVE_NETWORK_AMBIGUOUS',
] : owner06 ? [
  'BOOKINGS_REQUIRES_ACTION', 'BOOKINGS_ACTIVE', 'BOOKINGS_HISTORY',
  'BOOKINGS_EMPTY', 'BOOKINGS_OFFLINE_STALE', 'BOOKING_DETAIL_PENDING',
  'BOOKING_DETAIL_CONFIRMED', 'BOOKING_DETAIL_TERMINAL', 'CANCEL_CONFIRMATION',
  'CANCEL_SUBMITTING', 'CANCEL_PENDING', 'CANCELLED',
] : [
  'REVIEW_READY', 'CREATE_HOLD_SUBMITTING', 'CREATE_HOLD_SOFT_RETRY',
  'CREATE_HOLD_FINAL_CONFLICT', 'BOOKING_LOCAL_HOLD', 'BOOKING_MANUAL_PENDING',
  'BOOKING_MIS_PENDING', 'BOOKING_CONFIRMED', 'BOOKING_FAILED',
  'BOOKING_EXPIRED', 'BOOKING_RELEASED', 'BOOKING_OFFLINE_STALE',
];
const prototypeChecksum = '245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42';
const runtimeArtifacts = [];
const prototypeArtifacts = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of viewports) {
    for (const state of states) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await page.goto(`http://127.0.0.1:8765/?state=${state}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('flutter-view, flt-glass-pane', { timeout: 45000 });
      await page.waitForTimeout(1600);
      if (state === 'ALTERNATIVE_ACCEPT_SUBMITTING' || state === 'ALTERNATIVE_NETWORK_AMBIGUOUS') {
        await page.getByText('Принять новое время').click();
        await page.waitForTimeout(400);
      }
      if (state === 'ALTERNATIVE_DECLINE_CONFIRMATION') {
        await page.getByText('Не подходит').click();
        await page.waitForTimeout(300);
      }
      const path = `${root}/runtime/${width}x${height}/${state}.bmp`;
      await mkdir(`${root}/runtime/${width}x${height}`, { recursive: true });
      await captureCleanFrame(page, path);
      await page.close();
      const isReview = state === 'REVIEW_READY' || state.startsWith('CREATE_HOLD_');
      runtimeArtifacts.push({
        v50Id: owner07 ? 'OWN-020' : owner06 ? (state.startsWith('BOOKINGS_') ? 'OWN-007' : 'OWN-008') : (isReview ? 'OWN-006' : 'OWN-008'),
        prototypeAnchor: owner07 ? '#alternative-slot' : owner06 ? (state.startsWith('BOOKINGS_') ? '#appointments' : '#appointment-detail') : (isReview ? '#booking-review' : '#appointment-detail'),
        prototypeState: state === 'BOOKING_CONFIRMED' ? 'confirmed' : state === 'CREATE_HOLD_FINAL_CONFLICT' ? 'slot-taken' : null,
        runtimeRoute: owner07 ? '/owner/bookings/:holdId/alternative' : owner06 ? (state.startsWith('BOOKINGS_') ? '/owner/bookings' : '/owner/bookings/:holdId') : (isReview ? '/owner/booking/review' : '/owner/bookings/:holdId'),
        viewport: `${width}x${height}`,
        state,
        artifactLogicalPath: `${slice}/runtime/${width}x${height}/${state}.bmp`,
        sha256: sha(await readFile(path)),
      });
    }
  }
  for (const [width, height] of viewports) {
    for (const anchor of owner07 ? ['alternative-slot'] : owner06 ? ['appointments', 'appointment-detail'] : ['booking-review', 'appointment-detail']) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await page.goto(`http://127.0.0.1:8766/prototype-v50/index.html#${anchor}`, { waitUntil: 'load' });
      await page.addStyleTag({ content: '.skip-link:not(:focus){display:none!important}' });
      await page.waitForTimeout(500);
      const path = `${root}/prototype/${anchor}/${width}x${height}.png`;
      await mkdir(`${root}/prototype/${anchor}`, { recursive: true });
      await page.screenshot({ path });
      await page.close();
      prototypeArtifacts.push({
        prototypeAnchor: `#${anchor}`,
        viewport: `${width}x${height}`,
        artifactLogicalPath: `${slice}/prototype/${anchor}/${width}x${height}.png`,
        sha256: sha(await readFile(path)),
      });
    }
  }
} finally {
  await browser.close();
}

const all = [...runtimeArtifacts, ...prototypeArtifacts];
const artifactPackageSha256 = sha(Buffer.from(all.map((item) => item.sha256).sort().join('\n')));
await writeFile(`docs/ai/evidence/${slice}.json`, `${JSON.stringify({
  schemaVersion: 1,
  slice,
  status: 'CAPTURED_PENDING_VALIDATION',
  runtimeCommit,
  prototypeChecksum,
  artifactPackageId: `${slice.toLowerCase()}-${runtimeCommit}`,
  artifactPackageSha256,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  states,
  v50Ids: owner07 ? ['OWN-020'] : owner06 ? ['OWN-007', 'OWN-008'] : ['OWN-006', 'OWN-008'],
  prototypeAnchors: owner07 ? ['#alternative-slot'] : owner06 ? ['#appointments', '#appointment-detail'] : ['#booking-review', '#appointment-detail'],
  representativeGate: 'PENDING_VALIDATION',
  runtimeArtifacts,
  prototypeArtifacts,
  supplementalArtifacts: [],
}, null, 2)}\n`);

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function captureCleanFrame(page, path) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const pngCandidate = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    const inspection = inspectPngTopBand(pngCandidate, { rows: 5000, darkness: 48 });
    if (!inspection.hasBlackBand) {
      const opaque = await page.screenshot({ type: 'jpeg', quality: 95, animations: 'disabled', caret: 'hide' });
      const normalized = await normalizeOpaqueFrame(page, opaque);
      if (!normalized.hasDarkBand) {
        await writeFile(path, encodeBmp(normalized.width, normalized.height, normalized.rgba));
        return;
      }
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`No clean runtime frame: ${path}`);
}

async function normalizeOpaqueFrame(page, bytes) {
  const result = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const threshold = Math.max(40, Math.floor(canvas.width * 0.12));
    for (let y = 0; y < canvas.height; y += 1) {
      let run = 0;
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        if (data[offset] < 48 && data[offset + 1] < 48 && data[offset + 2] < 48) {
          run += 1;
          if (run >= threshold) return { hasDarkBand: true, width: 0, height: 0, rgba: '' };
        } else {
          run = 0;
        }
      }
    }
    let binary = '';
    for (let offset = 0; offset < data.length; offset += 0x8000) {
      binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
    }
    return {
      hasDarkBand: false,
      width: canvas.width,
      height: canvas.height,
      rgba: btoa(binary),
    };
  }, bytes.toString('base64'));
  return { ...result, rgba: Buffer.from(result.rgba, 'base64') };
}

function encodeBmp(width, height, rgba) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelsSize = rowSize * height;
  const output = Buffer.alloc(54 + pixelsSize);
  output.write('BM', 0, 2, 'ascii');
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(pixelsSize, 34);
  for (let y = 0; y < height; y += 1) {
    const sourceY = height - 1 - y;
    const targetRow = 54 + y * rowSize;
    for (let x = 0; x < width; x += 1) {
      const source = (sourceY * width + x) * 4;
      const target = targetRow + x * 3;
      output[target] = rgba[source + 2];
      output[target + 1] = rgba[source + 1];
      output[target + 2] = rgba[source];
    }
  }
  return output;
}
