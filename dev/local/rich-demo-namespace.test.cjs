const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SOURCE,
  prefixes,
  uuid,
  owns,
  assertOwned,
  resetSql,
} = require('./rich-demo-namespace.cjs');

test('uses permanent source and disjoint deterministic namespaces', () => {
  assert.equal(SOURCE, 'LOCAL_RICH_DEMO_V1');
  assert.equal(new Set(Object.values(prefixes)).size, Object.keys(prefixes).length);
  for (const [kind, prefix] of Object.entries(prefixes)) {
    const id = uuid(prefix, 1);
    assert.equal(owns(kind, id), true);
    assert.equal(assertOwned(kind, id), id);
  }
});

test('rejects foreign IDs before membership mutation', () => {
  const foreignEmployee = '33333333-3333-4333-8333-333333333333';
  assert.equal(owns('employee', foreignEmployee), false);
  assert.throws(() => assertOwned('employee', foreignEmployee), /outside its reserved namespace/);
});

test('reset predicates preserve synthetic foreign rows', () => {
  const rows = [
    { kind: 'hold', id: uuid('97', 1), source: SOURCE },
    { kind: 'hold', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', source: 'FOREIGN' },
    { kind: 'slot', id: uuid('96', 1), source: SOURCE },
    { kind: 'slot', id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', source: 'FOREIGN' },
  ];
  const preserved = rows.filter((row) =>
    !((row.kind === 'hold' && owns('hold', row.id)) ||
      (row.kind === 'slot' && row.source === SOURCE)));
  assert.deepEqual(preserved.map((row) => row.source), ['FOREIGN', 'FOREIGN']);
  assert.match(resetSql.memberships, /WHERE employee_id = \$1::uuid$/);
  assert.doesNotMatch(resetSql.memberships, /LIKE|TRUNCATE/i);
  assert.match(resetSql.slots, /WHERE source=\$1$/);
});

test('seed preflights reserved collisions before reset or upsert', () => {
  const seed = fs.readFileSync(
    path.resolve(__dirname, '../../backend/scripts/seed-local-rich-demo.cjs'),
    'utf8',
  );
  const guard = seed.indexOf("await assertReservedSet('clinic_schema', 'clinics'");
  const reset = seed.indexOf('if (RESET)');
  assert.ok(guard > 0 && reset > guard);
  assert.match(seed, /ownershipKeys/);
  assert.match(seed, /ownership collision for/);
  assert.doesNotMatch(seed, /DELETE FROM clinic_schema\.employee_location_memberships(?![\\s\\S]*WHERE employee_id = \\$1::uuid)/);
});

test('identity source does not rewrite foreign base or queue slots', () => {
  const seed = fs.readFileSync(
    path.resolve(__dirname, '../../backend/scripts/seed-local-identities.ts'),
    'utf8',
  );
  assert.doesNotMatch(seed, /UPDATE clinic_schema\.appointment_slots/);
  assert.doesNotMatch(seed, /UPDATE clinic_schema\.clinics/);
  assert.match(seed, /ownership collision/);
});
