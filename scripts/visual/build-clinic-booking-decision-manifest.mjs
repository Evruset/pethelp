import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const dir = join(root, 'docs/testing/evidence/s14-clinic-booking-decision');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const sources = [
  'apps/clinic-portal/components/queue/ClinicQueueClientV2.tsx',
  'apps/clinic-portal/app/api/clinic/booking-holds/[holdId]/confirm/route.ts',
  'apps/clinic-portal/app/api/clinic/booking-holds/[holdId]/decline/route.ts',
  'apps/clinic-portal/tests/e2e/clinic-queue.spec.ts',
  'apps/clinic-portal/package-lock.json',
  'scripts/visual/build-clinic-booking-decision-manifest.mjs',
  'scripts/visual/capture-wave1-v50-references.mjs',
  'prototype-v50/manifest.json',
  'prototype-v50/clinic-booking-journal/manifest.json',
  'prototype-v50/clinic-booking-journal/booking-journal.css',
];
const cases = [
  ['normal', 1440, 900, 'portal-normal-1440x900.png'],
  ['sla-bands', 1024, 768, 'portal-sla-bands-1024x768.png'],
  ['expired-non-actionable', 390, 844, 'portal-expired-390x844.png'],
  ['confirm-readback', 768, 1024, 'portal-confirm-readback-768x1024.png'],
  ['decline-dialog', 1440, 900, 'portal-decline-dialog-1440x900.png'],
  ['reject-readback', 1440, 900, 'portal-reject-readback-1440x900.png'],
  ['stale-conflict', 1024, 768, 'portal-stale-conflict-1024x768.png'],
  ['degraded', 390, 844, 'portal-degraded-390x844.png'],
];
const records = [];
for (const [name, width, height, file] of cases) {
  const bytes = await readFile(join(dir, file));
  if (bytes.toString('hex', 1, 4) !== '504e47' || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) {
    throw new Error(`${file} viewport evidence mismatch`);
  }
  records.push({ name, width, height, file, sha256: digest(bytes) });
}
const buildId = (await readFile(join(root, 'apps/clinic-portal/.next/BUILD_ID'), 'utf8')).trim();
await writeFile(join(dir, 'manifest.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  productSemantics: 'MANUAL_CONFIRM → PENDING_CONFIRMATION → 15-minute PostgreSQL-authoritative deadline → CONFIRMED | REJECTED | EXPIRED',
  renderer: 'Clinic Portal production Next.js build; focused Chromium with controlled session/API seams',
  physicalDevice: false,
  runtimeBuild: { buildId, sha256: digest(buildId) },
  sources: Object.fromEntries(await Promise.all(sources.map(async (source) => [source, digest(await readFile(join(root, source)))]))),
  cases: records,
}, null, 2)}\n`);
console.log('Built Wave 1 Clinic booking decision manifest: 8/8');
