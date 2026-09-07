import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const candidate = normalize(join(root, pathname));
    if (!candidate.startsWith(`${root}/`) || !(await stat(candidate)).isFile()) throw new Error('not found');
    response.setHeader('content-type', ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' })[extname(candidate)] ?? 'application/octet-stream');
    response.end(await readFile(candidate));
  } catch {
    response.statusCode = 404;
    response.end('not found');
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const captures = [
  { manifest:'docs/testing/evidence/s14-owner-booking-decision/manifest.json', output:'docs/testing/evidence/s14-owner-booking-decision', name:'v50-manual-pending', file:'v50-reference-manual-pending-390x844.png', width:390, height:844, url:'/prototype-v50/index.html#appointment-detail', wait:'Клиника подтверждает время' },
  { manifest:'docs/testing/evidence/s14-owner-booking-decision/manifest.json', output:'docs/testing/evidence/s14-owner-booking-decision', name:'v50-confirmed', file:'v50-reference-confirmed-768x1024.png', width:768, height:1024, url:'/prototype-v50/index.html#appointment-detail', click:'[data-prototype-state="confirmed"]', wait:'Визит подтверждён клиникой' },
  { manifest:'docs/testing/evidence/s14-clinic-booking-decision/manifest.json', output:'docs/testing/evidence/s14-clinic-booking-decision', name:'v50-journal-due-soon', file:'v50-reference-journal-due-soon-1440x900.png', width:1440, height:900, url:'/prototype-v50/clinic-booking-journal/index.html?state=request-due-soon&role=reception&date=2026-08-01', wait:'Журнал записи' },
  { manifest:'docs/testing/evidence/s14-clinic-booking-decision/manifest.json', output:'docs/testing/evidence/s14-clinic-booking-decision', name:'v50-journal-mobile-overdue', file:'v50-reference-journal-mobile-overdue-390x844.png', width:390, height:844, url:'/prototype-v50/clinic-booking-journal/index.html?state=mobile-request-detail-overdue&role=reception&date=2026-08-01' },
];
const grouped = new Map();
try {
  for (const item of captures) {
    const page = await browser.newPage({ viewport: { width:item.width, height:item.height }, deviceScaleFactor:1 });
    await page.goto(`http://127.0.0.1:${port}${item.url}`, { waitUntil:'networkidle' });
    if (item.click) await page.locator(item.click).evaluate((element) => element.click());
    if (item.wait) await page.getByText(item.wait, { exact:false }).first().waitFor();
    const path = join(root, item.output, item.file);
    await page.screenshot({ path, fullPage:false });
    const bytes = await readFile(path);
    const record = { name:item.name, width:item.width, height:item.height, file:item.file, sha256:digest(bytes), sourceUrl:item.url };
    grouped.set(item.manifest, [...(grouped.get(item.manifest) ?? []), record]);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
for (const [manifestPath, references] of grouped) {
  const manifest = JSON.parse(await readFile(join(root, manifestPath), 'utf8'));
  manifest.sources ??= {};
  manifest.sources['scripts/visual/capture-wave1-v50-references.mjs'] = digest(await readFile(join(root, 'scripts/visual/capture-wave1-v50-references.mjs')));
  manifest.references = references;
  await writeFile(join(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log('Captured current V50 Wave 1 references: 4/4');
