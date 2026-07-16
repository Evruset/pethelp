import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = process.env.V50_EVIDENCE_ROOT;
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');
const manifest = JSON.parse(await readFile('docs/ai/evidence/V50-OWNER-04.json', 'utf8'));
if (manifest.artifacts.length !== 48) throw new Error(`expected 48 artifacts, got ${manifest.artifacts.length}`);
if (manifest.prototypeArtifacts.length !== 4) throw new Error(`expected 4 prototype artifacts, got ${manifest.prototypeArtifacts.length}`);
if (manifest.representativeGate !== '8/8 PASS') throw new Error('representative gate missing');
const allArtifacts = [...manifest.artifacts, ...manifest.prototypeArtifacts];
const logicalPaths = new Set();
for (const item of allArtifacts) {
  if (item.artifactLogicalPath.startsWith('/')) throw new Error('absolute logical path');
  if (logicalPaths.has(item.artifactLogicalPath)) throw new Error(`duplicate logical path: ${item.artifactLogicalPath}`);
  logicalPaths.add(item.artifactLogicalPath);
  const relative = item.artifactLogicalPath.replace('V50-OWNER-04/', '');
  const bytes = await readFile(`${root}/${relative}`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== item.sha256) throw new Error(`hash mismatch: ${relative}`);
  if (item.comparisonVerdict && item.comparisonVerdict !== 'PASS') throw new Error(`non-pass: ${relative}`);
}
const packageDigest = createHash('sha256')
  .update(allArtifacts.map((item) => item.sha256).sort().join('\n'))
  .digest('hex');
if (packageDigest !== manifest.artifactPackageSha256) throw new Error('package checksum mismatch');
console.log(`PASS ${manifest.artifacts.length}/48 runtime; ${manifest.prototypeArtifacts.length}/4 prototype; package checksum; representative ${manifest.representativeGate}`);
