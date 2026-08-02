import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CHECKSUM_ALGORITHM,
  REQUIRED_ROLES,
  REQUIRED_STATES,
  REQUIRED_VIEWPORTS,
  inventoryPrototype,
} from './v50-booking-journal-prototype-inventory.mjs';

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'v50-booking-journal-inventory-'));
  await mkdir(path.join(root, 'assets'));
  const stateLabels = REQUIRED_STATES.map((state) => `<option value="${state}">${state}</option>`).join('');
  const html = overrides.html ?? `<!doctype html><html><head><link rel="stylesheet" href="booking-journal.css"></head><body><header>Header</header><nav>Nav</nav><main><select>${stateLabels}</select><img src="assets/mark.svg" alt=""></main><script src="booking-journal.js"></script></body></html>`;
  await writeFile(path.join(root, 'index.html'), html);
  await writeFile(path.join(root, 'booking-journal.css'), overrides.css ?? '@media (max-width: 768px) { main { display: block; } }');
  await writeFile(path.join(root, 'booking-journal.js'), overrides.js ?? "const state = new URLSearchParams(location.search).get('state');");
  await writeFile(path.join(root, 'assets/mark.svg'), '<svg xmlns="urn:local"><path d="M0 0"/></svg>');
  const requiredFiles = ['assets/mark.svg', 'booking-journal.css', 'booking-journal.js', 'index.html'];
  const baseManifest = {
    prototypeId: 'V50-CLINIC-MVP1-02', title: 'Clinic Booking Journal', version: 1,
    entrypoint: 'index.html', sourceContract: 'docs/v50/V50-CLINIC-MVP1-01-BOOKING-JOURNAL-CONTRACT.md',
    states: REQUIRED_STATES, roles: REQUIRED_ROLES, viewports: REQUIRED_VIEWPORTS,
    externalDependencies: [], requiredFiles, generatedAt: '2026-08-01T00:00:00.000Z',
    checksumAlgorithm: CHECKSUM_ALGORITHM, sha256: '',
  };
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ ...baseManifest, ...overrides.manifest }, null, 2));
  const first = await inventoryPrototype(root);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  manifest.sha256 = first.sha256;
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return root;
}

async function withFixture(overrides, callback) {
  const root = await fixture(overrides);
  try { await callback(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('valid fixture passes and checksum is reproducible across generatedAt changes', async () => {
  await withFixture({}, async (root) => {
    const first = await inventoryPrototype(root, { verifyManifest: true });
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.generatedAt = '2030-01-01T00:00:00.000Z';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const second = await inventoryPrototype(root, { verifyManifest: true });
    assert.equal(first.sha256, second.sha256);
    assert.equal(second.states.length, 30);
    assert.equal(second.roles.length, 4);
    assert.equal(second.viewports.length, 6);
    assert.equal(second.deterministicUrls.length, 30);
  });
});

test('reports missing local paths', async () => {
  await withFixture({}, async (root) => {
    await writeFile(path.join(root, 'index.html'), `<!doctype html><header></header><nav></nav><main>${REQUIRED_STATES.join(' ')}<img src="assets/missing.png"></main><link rel="stylesheet" href="booking-journal.css"><script src="booking-journal.js"></script>`);
    await assert.rejects(inventoryPrototype(root), /missing local path: assets\/missing\.png/);
  });
});

test('rejects external dependencies, iframe, inline handlers, and duplicate IDs', async () => {
  const unsafe = `<!doctype html><header></header><nav></nav><main>${REQUIRED_STATES.join(' ')}<div id="same" onclick="go()"></div><div id="same"></div><iframe src="https://example.com"></iframe></main><link rel="stylesheet" href="booking-journal.css"><script src="booking-journal.js"></script>`;
  await withFixture({}, async (root) => {
    await writeFile(path.join(root, 'index.html'), unsafe);
    await assert.rejects(inventoryPrototype(root), (error) => {
      assert.match(error.message, /external HTTP\(S\) dependencies/);
      assert.match(error.message, /unexpected iframe/);
      assert.match(error.message, /inline event handlers: onclick/);
      assert.match(error.message, /duplicate IDs: same/);
      return true;
    });
  });
});

test('rejects incomplete state inventory and missing landmarks', async () => {
  await withFixture({}, async (root) => {
    await writeFile(path.join(root, 'index.html'), `<link rel="stylesheet" href="booking-journal.css"><script src="booking-journal.js"></script>${REQUIRED_STATES.slice(0, -1).join(' ')}`);
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.states = REQUIRED_STATES.slice(0, -1);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await assert.rejects(inventoryPrototype(root), (error) => {
      assert.match(error.message, /state inventory mismatch/);
      assert.match(error.message, /required landmark missing: main/);
      assert.match(error.message, /required state labels missing.*mobile-manual-booking/);
      return true;
    });
  });
});

test('rejects a checksum mismatch', async () => {
  await withFixture({}, async (root) => {
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.sha256 = '0'.repeat(64);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await assert.rejects(inventoryPrototype(root, { verifyManifest: true }), /manifest checksum mismatch/);
  });
});

test('ignores template navigation hrefs while retaining true JavaScript static assets', async () => {
  await withFixture({}, async (root) => {
    await writeFile(path.join(root, 'assets/runtime.svg'), '<svg xmlns="urn:local"/>');
    await writeFile(path.join(root, 'booking-journal.js'), `
      const template = \`<a href="?state=confirmed-appointment&role=reception">Open</a>\`;
      const dynamic = \`<a href="\${appState.state}">State</a>\`;
      const icon = new URL('./assets/runtime.svg', import.meta.url);
    `);
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.requiredFiles.push('assets/runtime.svg');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const inventory = await inventoryPrototype(root);
    manifest.sha256 = inventory.sha256;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const verified = await inventoryPrototype(root, { verifyManifest: true });
    assert.deepEqual(verified.missingLocalPaths, []);
  });
});
