import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.env.V50_EVIDENCE_ROOT;
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');
const manifest = JSON.parse(readFileSync('docs/ai/evidence/V50-OWNER-02.json', 'utf8'));
const prototype = JSON.parse(readFileSync('prototype-v50/manifest.json', 'utf8'));
const failures = [];
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

if (manifest.artifacts.length !== 48) failures.push(`runtime count ${manifest.artifacts.length}`);
if (manifest.prototypeReferences.length !== 12) failures.push(`prototype count ${manifest.prototypeReferences.length}`);
if (manifest.supplementalArtifacts?.length !== 8) {
  failures.push(`supplemental count ${manifest.supplementalArtifacts?.length ?? 0}`);
}
if (new Set(manifest.artifacts.map((item) => item.artifactLogicalPath)).size !== 48) {
  failures.push('duplicate runtime logical paths');
}
if (manifest.prototypeChecksum !== prototype.sha256) failures.push('prototype checksum mismatch');
const packageCommit = manifest.artifactPackageId.replace(/^v50-owner-02-/, '');
const expectedRuntimeCommit = process.env.V50_RUNTIME_COMMIT ?? packageCommit;
if (manifest.runtimeCommit !== expectedRuntimeCommit) failures.push('runtime commit mismatch');
if (manifest.artifacts.some((item) => item.comparisonResult !== 'PASS')) {
  failures.push('non-pass visual comparison');
}

const declaredArtifacts = [
  ...manifest.artifacts,
  ...manifest.prototypeReferences,
  ...(manifest.supplementalArtifacts ?? []),
];
for (const item of declaredArtifacts) {
  if (item.artifactLogicalPath.startsWith('/')) failures.push(`absolute logical path ${item.artifactLogicalPath}`);
  const relativePath = item.artifactLogicalPath.replace(/^V50-OWNER-02\//, '');
  const file = join(root, relativePath);
  if (!existsSync(file)) failures.push(`missing ${relativePath}`);
  else if (sha(file) !== item.sha256) failures.push(`checksum ${relativePath}`);
}
if (new Set(declaredArtifacts.map((item) => item.artifactLogicalPath)).size !== 68) {
  failures.push('duplicate package logical paths');
}
if ((manifest.supplementalArtifacts ?? []).some((item) =>
  item.viewport !== '375x812' || item.result !== 'PASS_BROWSER_SCREENSHOT')) {
  failures.push('invalid supplemental proof metadata');
}

const walk = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
const packageFiles = walk(root).filter((file) => file.endsWith('.png')).sort();
const packageHash = createHash('sha256');
for (const file of packageFiles) {
  packageHash.update(relative(root, file));
  packageHash.update('\0');
  packageHash.update(readFileSync(file));
  packageHash.update('\0');
}
if (packageHash.digest('hex') !== manifest.artifactPackageSha256) failures.push('package checksum mismatch');

const expectedStates = new Set(manifest.states);
const actualStates = new Set(manifest.artifacts.map((item) => item.state));
if ([...expectedStates].some((state) => !actualStates.has(state))) failures.push('required state missing');
const expectedViewports = new Set(manifest.viewports);
const actualViewports = new Set(manifest.artifacts.map((item) => item.viewport));
if ([...expectedViewports].some((viewport) => !actualViewports.has(viewport))) failures.push('required viewport missing');

if (failures.length) {
  console.error(`FAIL: ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`PASS: 48/48 runtime, ${manifest.prototypeReferences.length}/12 prototype, 8/8 supplemental, checksums/package/paths/states/viewports valid`);
