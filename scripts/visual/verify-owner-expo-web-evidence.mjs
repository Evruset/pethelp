import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const evidence = join(root, 'docs/testing/evidence/wave2-owner-expo-web');
const manifest = JSON.parse(await readFile(join(evidence, 'manifest.json'), 'utf8'));
const digest = (value) => createHash('sha256').update(value).digest('hex');

if (manifest.label !== 'OWNER_EXPO_WEB_RUNTIME') throw new Error('runtime evidence label mismatch');
if (!String(manifest.runtime).includes('apps/owner-app')) throw new Error('canonical Owner runtime mismatch');
if (!String(manifest.browser).includes('Chromium')) throw new Error('browser identity missing');
if (!String(manifest.stack).includes('PILOT_V1')) throw new Error('real-stack identity missing');

for (const [relative, expected] of Object.entries({ ...manifest.sourceHashes, ...manifest.v50SourceHashes })) {
  const actual = digest(await readFile(join(root, relative)));
  if (actual !== expected) throw new Error(`SOURCE_HASH_MISMATCH:${relative}`);
}

const expectedArtifacts = new Set([
  'pending-390x844.png',
  'pending-430x932.png',
  'pending-768x1024.png',
  'pending-1024x768.png',
  'pending-1440x900.png',
  'confirmed-1440x900.png',
  'rejected-390x844.png',
  'expired-390x844.png',
]);

for (const [file, expected] of Object.entries(manifest.artifacts)) {
  if (!expectedArtifacts.delete(file)) throw new Error(`unexpected artifact:${file}`);
  const bytes = await readFile(join(evidence, file));
  if (digest(bytes) !== expected) throw new Error(`ARTIFACT_HASH_MISMATCH:${file}`);
  if (bytes.toString('hex', 1, 4) !== '504e47') throw new Error(`NOT_PNG:${file}`);
  const match = file.match(/-(\d+)x(\d+)\.png$/);
  if (!match || bytes.readUInt32BE(16) !== Number(match[1]) || bytes.readUInt32BE(20) !== Number(match[2])) {
    throw new Error(`ARTIFACT_DIMENSION_MISMATCH:${file}`);
  }
}

if (expectedArtifacts.size) throw new Error(`missing artifacts:${[...expectedArtifacts].join(',')}`);
if (manifest.gates?.horizontalOverflow !== 'PASS_5_OF_5') throw new Error('responsive gate mismatch');
if (manifest.gates?.axeCriticalSerious !== 'PASS_ZERO_VIOLATIONS') throw new Error('accessibility gate mismatch');
if (manifest.gates?.visualClassification !== 'MACHINE_VISUAL_REVIEW_PASS' || manifest.visualReview?.result !== 'PASS') {
  throw new Error('V50 machine visual-review gate mismatch');
}
if (manifest.gates?.physicalDevice !== false || manifest.gates?.deployment !== false) throw new Error('evidence boundary mismatch');

console.log('Owner Expo Web runtime evidence verified: 8/8');
