const { test } = require('node:test');
const assert = require('node:assert/strict');

const modulePath = process.env.LOCAL_SESSION_POLICY_MODULE;
if (!modulePath) throw new Error('LOCAL_SESSION_POLICY_MODULE is required');
const { isDevLocalSessionEnabled } = require(modulePath);

test('local session is disabled in production even when explicitly enabled', () => {
  assert.equal(isDevLocalSessionEnabled('production', 'true'), false);
});

test('local session requires the explicit flag outside production', () => {
  assert.equal(isDevLocalSessionEnabled('development', undefined), false);
  assert.equal(isDevLocalSessionEnabled('test', 'false'), false);
  assert.equal(isDevLocalSessionEnabled('development', 'true'), true);
});
