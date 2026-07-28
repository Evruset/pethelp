const { test } = require('node:test');
const assert = require('node:assert/strict');
const { json, validateBffPayload } = require('./verify-rich-demo-sessions.cjs');

const id1 = '90000000-0000-4000-8000-000000000001';
const id2 = '90000000-0000-4000-8000-000000000002';

test('rejects non-JSON HTTP 200 responses', async () => {
  for (const body of ['<html>login</html>', '<div id="app"></div>', '', '<html>error</html>']) {
    await assert.rejects(() => json(new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } })), /non-JSON/);
  }
});

test('rejects invalid JSON HTTP 200 responses', async () => {
  await assert.rejects(() => json(new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } })));
});

test('rejects malformed queue and visits DTOs', () => {
  assert.throws(() => validateBffPayload('queue', {}), /top-level/);
  assert.throws(() => validateBffPayload('visits', {}), /top-level/);
  assert.throws(() => validateBffPayload('queue', { items: [] }, { requireNonEmpty: true }), /empty seeded/);
  assert.throws(() => validateBffPayload('visits', [], { requireNonEmpty: true }), /empty seeded/);
  assert.doesNotThrow(() => validateBffPayload('queue', { items: [] }));
});

test('rejects secret fields, duplicate IDs and impossible calendar dates', () => {
  assert.throws(() => validateBffPayload('queue', { items: [{ holdId: id1 }, { holdId: id1 }] }), /duplicate/);
  assert.throws(() => validateBffPayload('visits', [{ holdId: id1, accessToken: 'redacted' }]), /secret-like/);
  assert.throws(() => validateBffPayload('queue', { items: [{ holdId: id2, startsAt: '2026-02-30T10:00:00.000Z' }] }), /timestamp/);
});

test('accepts bounded queue and visits shapes', () => {
  assert.doesNotThrow(() => validateBffPayload('queue', { items: [{ holdId: id1, ownerId: id2, startsAt: '2026-07-27T10:00:00.000Z' }] }));
  assert.doesNotThrow(() => validateBffPayload('visits', [{ holdId: id2, ownerId: id1, startsAt: '2026-07-27T10:00:00.000Z' }]));
});
