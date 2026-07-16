import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { inspectPngTopBand } from './v50-owner03-capture-utils.mjs';

const root = process.env.V50_EVIDENCE_ROOT;
const expectedCommit = process.env.V50_RUNTIME_COMMIT;
if (!root || !expectedCommit) throw new Error('V50_EVIDENCE_ROOT and V50_RUNTIME_COMMIT are required');
const manifest = JSON.parse(readFileSync('docs/ai/evidence/V50-OWNER-03.json', 'utf8'));
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
if (manifest.runtimeCommit !== expectedCommit) throw new Error('runtime commit mismatch');
if (manifest.status !== 'CERTIFIED_VISUAL_PASS' || manifest.visuallyVerified !== true) {
  throw new Error('visual certification status mismatch');
}
if (manifest.independentValidation?.verdict !== 'PASS' || manifest.independentValidation?.vetoes !== 0) {
  throw new Error('independent validation mismatch');
}
if (manifest.readiness?.integration !== 'PASS' ||
    manifest.readiness?.doctorProductionRollout !== 'BLOCKED' ||
    manifest.readiness?.blocker !== 'PUBLIC_DOCTOR_PROFILE_CONSENT_CONTRACT_MISSING') {
  throw new Error('integration or Doctor rollout readiness mismatch');
}
if (manifest.artifacts.length !== 48) throw new Error('runtime artifact count mismatch');
if (manifest.prototypeReferences.length !== 16) throw new Error('prototype reference count mismatch');
if (manifest.prototypeChecksum !== '245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42') {
  throw new Error('prototype checksum mismatch');
}
const expectedStates = new Set(manifest.states);
const expectedViewports = new Set(manifest.viewports);
const logicalPaths = new Set();
for (const item of [...manifest.artifacts, ...manifest.prototypeReferences]) {
  if (item.artifactLogicalPath.startsWith('/')) throw new Error('authoritative absolute path');
  if (logicalPaths.has(item.artifactLogicalPath)) throw new Error(`duplicate logical path: ${item.artifactLogicalPath}`);
  logicalPaths.add(item.artifactLogicalPath);
  if (!expectedViewports.has(item.viewport)) throw new Error(`unexpected viewport: ${item.viewport}`);
  if (item.prototypeChecksum !== manifest.prototypeChecksum) throw new Error(`artifact prototype checksum mismatch: ${item.artifactLogicalPath}`);
  if ('runtimeCommit' in item && item.runtimeCommit !== expectedCommit) {
    throw new Error(`artifact runtime commit mismatch: ${item.artifactLogicalPath}`);
  }
  const file = join(root, item.artifactLogicalPath.replace(/^V50-OWNER-03\//, ''));
  if (sha(file) !== item.sha256) throw new Error(`checksum mismatch: ${item.artifactLogicalPath}`);
  const band = inspectPngTopBand(readFileSync(file));
  if (band.hasBlackBand) {
    throw new Error(`black top band: ${item.artifactLogicalPath} (${band.longestDarkRun}px)`);
  }
}
for (const viewport of expectedViewports) {
  const states = new Set(manifest.artifacts.filter((item) => item.viewport === viewport).map((item) => item.state));
  for (const state of expectedStates) {
    if (!states.has(state)) throw new Error(`missing state ${state} at ${viewport}`);
  }
  const referenceCount = manifest.prototypeReferences.filter((item) => item.viewport === viewport).length;
  if (referenceCount !== 4) throw new Error(`missing prototype reference at ${viewport}`);
  const ready = manifest.artifacts.find((item) =>
    item.viewport === viewport && item.state === 'CATALOG_READY_LIST');
  const stale = manifest.artifacts.find((item) =>
    item.viewport === viewport && item.state === 'CATALOG_OFFLINE_STALE');
  if (!ready || !stale || ready.sha256 === stale.sha256) {
    throw new Error(`Catalog ready/stale visual state mismatch at ${viewport}`);
  }
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
