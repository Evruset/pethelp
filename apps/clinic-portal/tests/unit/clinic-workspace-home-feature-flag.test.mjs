import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../app/design-system/feature-flags.ts', import.meta.url), 'utf8');
const match = source.match(/export function resolveClinicWorkspaceHomeFlag[\s\S]*?\n}/);
assert.ok(match);
const js = match[0].replace(/export function /, 'function ').replace(/shellEnabled: boolean/, 'shellEnabled').replace(/homeValue\?: string/, 'homeValue').replace(/\): boolean/, ')');
const resolve = Function(`${js}; return resolveClinicWorkspaceHomeFlag;`)();

test('workspace home flag is default-off and depends on shell', () => {
  assert.equal(resolve(false, 'true'), false);
  assert.equal(resolve(true, undefined), false);
  assert.equal(resolve(true, 'false'), false);
  assert.equal(resolve(true, 'true'), true);
  for (const value of ['TRUE', '1', 'yes', ' true ']) assert.equal(resolve(true, value), false);
});
