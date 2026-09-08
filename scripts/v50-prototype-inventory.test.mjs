import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { inventoryPrototype } from './v50-prototype-inventory.mjs';

test('inventories the authoritative V50 prototype and all required files', async () => {
  const inventory = await inventoryPrototype('prototype-v50/index.html');

  assert.equal(inventory.version, 'v50-clinic-role-workspaces');
  assert.equal(inventory.sourceClassification, 'AUTHORITATIVE_V50');
  assert.equal(inventory.screens.length, 30);
  assert.equal(inventory.screenNodes, 31);
  assert.deepEqual(inventory.duplicateScreenNodes, ['catalog']);
  assert.equal(inventory.routes.length, 15);
  assert.equal(inventory.primaryNavAnchors.length, 15);
  assert.equal(inventory.states.length, 41);
  assert.deepEqual(inventory.roles, ['doctor', 'reception']);
  assert.deepEqual(inventory.responsive.desktop, true);
  assert.deepEqual(inventory.responsive.tablet, true);
  assert.deepEqual(inventory.responsive.mobile, true);
  assert.deepEqual(inventory.responsive.reducedMotion, true);
  assert.ok(inventory.screens.includes('home'));
  assert.ok(inventory.screens.includes('clinic-telemed'));
  assert.ok(inventory.states.includes('MANUAL_CONFIRM_PENDING'));
  assert.ok(inventory.states.includes('offline'));
  assert.ok(inventory.requiredFiles.includes('index.html'));
  assert.ok(inventory.requiredFiles.includes('clinic-workspace.js'));
  assert.match(inventory.sha256, /^[a-f0-9]{64}$/);
});

test('inventory is deterministic for the same source', async () => {
  const first = await inventoryPrototype('prototype-v50/index.html');
  const second = await inventoryPrototype('prototype-v50/index.html');

  assert.deepEqual(second, first);
});

test('rejects the stale V51 target argument explicitly', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/v50-prototype-inventory.mjs', 'prototype-v50/index.html', '--require-v51'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /code=UNSUPPORTED_TARGET_VERSION/);
  assert.match(result.stderr, /Target V51 does not exist\. Canonical target is V50\./);
});

test('requires V50 and verifies the checked-in source manifest', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/v50-prototype-inventory.mjs', 'prototype-v50/index.html', '--require-v50', '--verify-manifest'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /manifest=verified/);
});
