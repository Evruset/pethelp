import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.env.V50_EVIDENCE_ROOT;
const expectedCommit = process.env.V50_RUNTIME_COMMIT;
if (!root || !expectedCommit) throw new Error('V50_EVIDENCE_ROOT and V50_RUNTIME_COMMIT are required');
const manifest = JSON.parse(readFileSync('docs/ai/evidence/V50-OWNER-03.json', 'utf8'));
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
if (manifest.runtimeCommit !== expectedCommit) throw new Error('runtime commit mismatch');
if (manifest.artifacts.length !== 48) throw new Error('runtime artifact count mismatch');
if (manifest.prototypeReferences.length !== 16) throw new Error('prototype reference count mismatch');
for (const item of [...manifest.artifacts, ...manifest.prototypeReferences]) {
  if (item.artifactLogicalPath.startsWith('/')) throw new Error('authoritative absolute path');
  const file = join(root, item.artifactLogicalPath.replace(/^V50-OWNER-03\//, ''));
  if (sha(file) !== item.sha256) throw new Error(`checksum mismatch: ${item.artifactLogicalPath}`);
}
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const files = walk(root).filter((file) => file.endsWith('.png')).sort();
const packageHash = createHash('sha256');
for (const file of files) {
  packageHash.update(relative(root, file)); packageHash.update('\0');
  packageHash.update(readFileSync(file)); packageHash.update('\0');
}
if (packageHash.digest('hex') !== manifest.artifactPackageSha256) throw new Error('package checksum mismatch');
console.log(`PASS ${manifest.artifacts.length}/48 runtime ${manifest.prototypeReferences.length}/16 prototype ${manifest.artifactPackageSha256}`);
