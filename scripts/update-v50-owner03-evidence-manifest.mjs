import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.env.V50_EVIDENCE_ROOT;
const runtimeCommit = process.env.V50_RUNTIME_COMMIT;
if (!root || !runtimeCommit) throw new Error('V50_EVIDENCE_ROOT and V50_RUNTIME_COMMIT are required');
const path = 'docs/ai/evidence/V50-OWNER-03.json';
const manifest = JSON.parse(readFileSync(path, 'utf8'));
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const stateMeta = (state) => state.startsWith('CATALOG_')
  ? ['OWN-002', '#catalog'] : state.startsWith('CLINIC_')
    ? ['OWN-004', '#clinic'] : state === 'DOCTOR_PROFILE'
      ? ['OWN-019', '#doctor-detail'] : ['OWN-018', '#doctor-select'];

manifest.status = 'FUNCTIONAL_PASS_VISUAL_FAIL';
manifest.runtimeCommit = runtimeCommit;
manifest.artifactPackageId = `v50-owner-03-${runtimeCommit}`;
manifest.localPathHint = root;
manifest.createdAt = '2026-07-15';
manifest.visuallyVerified = false;
manifest.artifacts = manifest.viewports.flatMap((viewport) => manifest.states.map((state) => {
  const [v50Id, prototypeAnchor] = stateMeta(state);
  const logical = `V50-OWNER-03/runtime/${viewport}/${state}.png`;
  return {
    v50Id, prototypeAnchor, prototypeChecksum: manifest.prototypeChecksum,
    runtimeCommit, viewport, state, artifactLogicalPath: logical,
    sha256: sha(join(root, 'runtime', viewport, `${state}.png`)),
    comparisonVerdict: 'FAIL_MATERIAL_COMPOSITION_DIFFERENCE',
    knownDifferences: ['Runtime composition and hierarchy are not yet aligned to the authoritative prototype.'],
  };
}));
manifest.prototypeReferences = manifest.viewports.flatMap((viewport) => [
  ['OWN-002', '#catalog', 'catalog'], ['OWN-004', '#clinic', 'clinic'],
  ['OWN-018', '#doctor-select', 'doctors'], ['OWN-019', '#doctor-detail', 'doctor'],
].map(([v50Id, prototypeAnchor, name]) => ({
  v50Id, prototypeAnchor, prototypeChecksum: manifest.prototypeChecksum,
  viewport, artifactLogicalPath: `V50-OWNER-03/prototype/${name}/${viewport}.png`,
  sha256: sha(join(root, 'prototype', name, `${viewport}.png`)),
})));
manifest.runtimeArtifactCount = manifest.artifacts.length;
manifest.prototypeReferenceCount = manifest.prototypeReferences.length;
manifest.knownDifferences = [
  'Veto: Catalog and Clinic runtime composition, controls, imagery and hierarchy materially differ from the authoritative prototype.',
  'The 375x812 Clinic capture includes a black top band absent from the prototype.',
  'Doctor biography, rating, photo and specialty are intentionally omitted because no approved public contract exists.',
];
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const files = walk(root).filter((file) => file.endsWith('.png')).sort();
const packageHash = createHash('sha256');
for (const file of files) {
  packageHash.update(relative(root, file)); packageHash.update('\0');
  packageHash.update(readFileSync(file)); packageHash.update('\0');
}
manifest.artifactPackageSha256 = packageHash.digest('hex');
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${manifest.artifactPackageId} ${manifest.artifactPackageSha256}`);
