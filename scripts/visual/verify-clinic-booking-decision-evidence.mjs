import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const dir = join(root, 'docs/testing/evidence/s14-clinic-booking-decision');
const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
const digest = (value) => createHash('sha256').update(value).digest('hex');

if (manifest.physicalDevice !== false
  || manifest.cases?.length !== 8
  || manifest.references?.length !== 2
  || !manifest.renderer?.includes('production Next.js build')
  || manifest.runtimeBuild?.sha256 !== digest(manifest.runtimeBuild?.buildId ?? '')) {
  throw new Error('S14 Clinic evidence metadata mismatch');
}

for (const [source, expected] of Object.entries(manifest.sources ?? {})) {
  if (digest(await readFile(join(root, source))) !== expected) {
    throw new Error(`${source} source hash mismatch`);
  }
}

for (const item of [...manifest.cases, ...manifest.references]) {
  const bytes = await readFile(join(dir, item.file));
  if (digest(bytes) !== item.sha256
    || bytes.toString('hex', 1, 4) !== '504e47'
    || bytes.readUInt32BE(16) !== item.width
    || bytes.readUInt32BE(20) !== item.height) {
    throw new Error(`${item.file} evidence mismatch`);
  }
}

const expectedCases = 'confirm-readback,decline-dialog,degraded,expired-non-actionable,normal,reject-readback,sla-bands,stale-conflict';
if (manifest.cases.map((item) => item.name).sort().join() !== expectedCases) {
  throw new Error('S14 Clinic state matrix mismatch');
}

console.log('Clinic booking decision visual evidence verified: 8/8');
