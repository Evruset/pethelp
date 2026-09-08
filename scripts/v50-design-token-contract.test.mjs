import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const canonicalPath = new URL('../docs/v50/design-tokens.json', import.meta.url);
const compatibilityPath = new URL('../docs/v51/design-tokens.json', import.meta.url);
const manifestPath = new URL('../prototype-v50/manifest.json', import.meta.url);

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

test('canonical V50 contract parses and exposes every required semantic group', async () => {
  const contract = await readJson(canonicalPath);
  const required = [
    'color', 'spacing', 'typography', 'radius', 'shadow', 'motion',
    'z-index', 'layout', 'a11y', 'themes',
  ];
  assert.equal(contract.version, '2.0.0-v50');
  assert.deepEqual(required.filter((group) => !contract[group]), []);
  assert.equal(contract.a11y['min-target'], '44px');
  assert.equal(contract.layout['tablet-min'], '768px');
  assert.equal(contract.layout['desktop-min'], '1121px');
});

test('contract contains no unresolved token references', async () => {
  const contract = await readJson(canonicalPath);
  const references = [];
  const visit = (value, path = '$') => {
    if (typeof value === 'string' && /\{[^{}]+\}/.test(value)) references.push(path);
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${index}]`));
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => visit(item, `${path}.${key}`));
    }
  };
  visit(contract);
  assert.deepEqual(references, []);
});

test('V51 compatibility descriptor points to the one canonical source and checksum', async () => {
  const canonicalText = await readFile(canonicalPath, 'utf8');
  const compatibility = await readJson(compatibilityPath);
  const checksum = createHash('sha256').update(canonicalText).digest('hex');
  assert.equal(compatibility.canonical, '../v50/design-tokens.json');
  assert.equal(compatibility.canonicalSha256, checksum);
  assert.equal(compatibility.deprecated, true);
  assert.equal('color' in compatibility, false);
});

test('canonical source checksum remains bound to the verified prototype manifest', async () => {
  const contract = await readJson(canonicalPath);
  const compatibility = await readJson(compatibilityPath);
  const manifest = await readJson(manifestPath);
  assert.equal(contract.source.sha256, manifest.sha256);
  assert.equal(compatibility.sourceManifestSha256, manifest.sha256);
});
