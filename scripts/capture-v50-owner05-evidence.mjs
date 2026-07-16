import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = process.env.V50_EVIDENCE_ROOT;
const runtimeCommit = process.env.V50_RUNTIME_COMMIT;
if (!root || !runtimeCommit) throw new Error('V50_EVIDENCE_ROOT and V50_RUNTIME_COMMIT are required');

const viewports = [[375, 812], [412, 915], [768, 1024], [1440, 900]];
const states = [
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
      await page.waitForTimeout(700);
      const path = `${root}/runtime/${width}x${height}/${state}.png`;
      await mkdir(`${root}/runtime/${width}x${height}`, { recursive: true });
      await page.screenshot({ path });
      await page.close();
      const isReview = state === 'REVIEW_READY' || state.startsWith('CREATE_HOLD_');
      runtimeArtifacts.push({
        v50Id: isReview ? 'OWN-006' : 'OWN-008',
        prototypeAnchor: isReview ? '#booking-review' : '#appointment-detail',
        prototypeState: state === 'BOOKING_CONFIRMED' ? 'confirmed' : state === 'CREATE_HOLD_FINAL_CONFLICT' ? 'slot-taken' : null,
        runtimeRoute: isReview ? '/owner/booking/review' : '/owner/bookings/:holdId',
        viewport: `${width}x${height}`,
        state,
        artifactLogicalPath: `V50-OWNER-05/runtime/${width}x${height}/${state}.png`,
        sha256: sha(await readFile(path)),
      });
    }
  }
  for (const [width, height] of viewports) {
    for (const anchor of ['booking-review', 'appointment-detail']) {
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
        artifactLogicalPath: `V50-OWNER-05/prototype/${anchor}/${width}x${height}.png`,
        sha256: sha(await readFile(path)),
      });
    }
  }
} finally {
  await browser.close();
}

const all = [...runtimeArtifacts, ...prototypeArtifacts];
const artifactPackageSha256 = sha(Buffer.from(all.map((item) => item.sha256).sort().join('\n')));
await writeFile('docs/ai/evidence/V50-OWNER-05.json', `${JSON.stringify({
  schemaVersion: 1,
  slice: 'V50-OWNER-05',
  status: 'CAPTURED_PENDING_VALIDATION',
  runtimeCommit,
  prototypeChecksum,
  artifactPackageId: `v50-owner-05-${runtimeCommit}`,
  artifactPackageSha256,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  states,
  v50Ids: ['OWN-006', 'OWN-008'],
  prototypeAnchors: ['#booking-review', '#appointment-detail'],
  representativeGate: 'PENDING_VALIDATION',
  runtimeArtifacts,
  prototypeArtifacts,
  supplementalArtifacts: [],
}, null, 2)}\n`);

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}
