import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = process.env.V50_EVIDENCE_ROOT;
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');
const manifest = JSON.parse(await readFile('docs/ai/evidence/V50-OWNER-05.json', 'utf8'));
if (manifest.runtimeArtifacts.length !== 48) throw new Error('expected 48 runtime artifacts');
if (manifest.prototypeArtifacts.length !== 8) throw new Error('expected 8 prototype artifacts');
const requiredStates = new Set(manifest.states);
const paths = new Set();
const all = [...manifest.runtimeArtifacts, ...manifest.prototypeArtifacts, ...manifest.supplementalArtifacts];
for (const item of all) {
  if (item.artifactLogicalPath.startsWith('/')) throw new Error(`absolute logical path: ${item.artifactLogicalPath}`);
  if (paths.has(item.artifactLogicalPath)) throw new Error(`duplicate logical path: ${item.artifactLogicalPath}`);
  paths.add(item.artifactLogicalPath);
  const relative = item.artifactLogicalPath.replace('V50-OWNER-05/', '');
  const digest = createHash('sha256').update(await readFile(`${root}/${relative}`)).digest('hex');
  if (digest !== item.sha256) throw new Error(`hash mismatch: ${relative}`);
}
for (const viewport of manifest.viewports) {
  const actual = new Set(manifest.runtimeArtifacts.filter((item) => item.viewport === viewport).map((item) => item.state));
  for (const state of requiredStates) if (!actual.has(state)) throw new Error(`missing ${viewport}/${state}`);
}
const packageDigest = createHash('sha256').update(all.map((item) => item.sha256).sort().join('\n')).digest('hex');
if (packageDigest !== manifest.artifactPackageSha256) throw new Error('package checksum mismatch');
console.log(`PASS ${manifest.runtimeArtifacts.length}/48 runtime; ${manifest.prototypeArtifacts.length}/8 prototype; hashes, paths, matrix and package checksum`);
