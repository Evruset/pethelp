import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { inspectPngTopBand } from './v50-owner03-capture-utils.mjs';

const root = process.env.V50_EVIDENCE_ROOT;
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');
const slice = process.env.V50_SLICE ?? 'V50-OWNER-05';
const manifest = JSON.parse(await readFile(`docs/ai/evidence/${slice}.json`, 'utf8'));
if (manifest.runtimeArtifacts.length !== 48) throw new Error('expected 48 runtime artifacts');
const expectedPrototype = slice === 'V50-OWNER-07' ? 4 : 8;
if (manifest.prototypeArtifacts.length !== expectedPrototype) throw new Error(`expected ${expectedPrototype} prototype artifacts`);
const requiredStates = new Set(manifest.states);
const paths = new Set();
const all = [...manifest.runtimeArtifacts, ...manifest.prototypeArtifacts, ...manifest.supplementalArtifacts];
for (const item of all) {
  if (item.artifactLogicalPath.startsWith('/')) throw new Error(`absolute logical path: ${item.artifactLogicalPath}`);
  if (paths.has(item.artifactLogicalPath)) throw new Error(`duplicate logical path: ${item.artifactLogicalPath}`);
  paths.add(item.artifactLogicalPath);
  const relative = item.artifactLogicalPath.replace(`${slice}/`, '');
  const bytes = await readFile(`${root}/${relative}`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== item.sha256) throw new Error(`hash mismatch: ${relative}`);
  if (manifest.runtimeArtifacts.includes(item) && relative.endsWith('.png') && inspectPngTopBand(bytes, { rows: 5000, darkness: 48 }).hasBlackBand) {
    throw new Error(`black rectangle/band: ${relative}`);
  }
  if (manifest.runtimeArtifacts.includes(item) && relative.endsWith('.bmp') && bmpHasDarkBand(bytes)) {
    throw new Error(`black rectangle/band: ${relative}`);
  }
}
for (const viewport of manifest.viewports) {
  const actual = new Set(manifest.runtimeArtifacts.filter((item) => item.viewport === viewport).map((item) => item.state));
  for (const state of requiredStates) if (!actual.has(state)) throw new Error(`missing ${viewport}/${state}`);
}
const packageDigest = createHash('sha256').update(all.map((item) => item.sha256).sort().join('\n')).digest('hex');
if (packageDigest !== manifest.artifactPackageSha256) throw new Error('package checksum mismatch');
console.log(`PASS ${manifest.runtimeArtifacts.length}/48 runtime; ${manifest.prototypeArtifacts.length}/${expectedPrototype} prototype; hashes, paths, matrix, black-rectangle gate and package checksum`);

function bmpHasDarkBand(bytes) {
  if (bytes.subarray(0, 2).toString('ascii') !== 'BM' || bytes.readUInt16LE(28) !== 24) throw new Error('unsupported BMP');
  const offset = bytes.readUInt32LE(10);
  const width = bytes.readInt32LE(18);
  const height = Math.abs(bytes.readInt32LE(22));
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const threshold = Math.max(40, Math.floor(width * 0.12));
  for (let y = 0; y < height; y += 1) {
    let run = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = offset + y * rowSize + x * 3;
      if (bytes[pixel] < 48 && bytes[pixel + 1] < 48 && bytes[pixel + 2] < 48) {
        run += 1;
        if (run >= threshold) return true;
      } else run = 0;
    }
  }
  return false;
}
