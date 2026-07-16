import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = process.env.V50_EVIDENCE_ROOT;
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');
const manifest = JSON.parse(await readFile('docs/ai/evidence/V50-OWNER-04.json', 'utf8'));
if (manifest.artifacts.length !== 48) throw new Error(`expected 48 artifacts, got ${manifest.artifacts.length}`);
if (manifest.representativeGate !== '8/8 PASS') throw new Error('representative gate missing');
for (const item of manifest.artifacts) {
  if (item.artifactLogicalPath.startsWith('/')) throw new Error('absolute logical path');
  const relative = item.artifactLogicalPath.replace('V50-OWNER-04/', '');
  const bytes = await readFile(`${root}/${relative}`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== item.sha256) throw new Error(`hash mismatch: ${relative}`);
  if (item.comparisonVerdict !== 'PASS') throw new Error(`non-pass: ${relative}`);
}
console.log(`PASS ${manifest.artifacts.length}/48 runtime; representative ${manifest.representativeGate}`);
