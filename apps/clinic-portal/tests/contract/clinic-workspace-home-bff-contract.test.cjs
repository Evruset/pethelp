const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const route = fs.readFileSync(path.resolve(__dirname, '../../app/api/clinic/[clinicId]/locations/[locationId]/workspace-home/route.ts'), 'utf8');

test('BFF uses only server session bearer and never reads browser Authorization', () => {
  assert.match(route, /Authorization: `Bearer \$\{session\.token\}`/);
  assert.doesNotMatch(route, /request\.headers|headers\.get\(['"]Authorization/i);
  assert.match(route, /Accept: 'application\/json'/);
  assert.match(route, /cache: 'no-store'/);
  assert.match(route, /redirect: 'manual'/);
});

test('BFF has closed normalized response taxonomy and safe headers', () => {
  for (const pair of [
    [400, 'INVALID_WORKSPACE_ROUTE'], [401, 'SESSION_REQUIRED'], [403, 'LOCATION_SCOPE_DENIED'],
    [404, 'NOT_FOUND'], [502, 'INVALID_BACKEND_RESPONSE'], [503, 'BACKEND_UNAVAILABLE'],
  ]) {
    assert.match(route, new RegExp(`safe\\('${pair[1]}'\\s*,\\s*${pair[0]}\\)`));
  }
  assert.match(route, /'Cache-Control': 'private, no-store'/);
  assert.match(route, /Vary: 'Cookie'/);
  assert.match(route, /headers\.delete\('ETag'\)/);
  assert.doesNotMatch(route, /response\.json\(/);
});

test('BFF bounds and parses successful backend responses before returning them', () => {
  assert.match(route, /MAX_RESPONSE_BYTES = 8 \* 1024/);
  assert.match(route, /new AbortController\(\)/);
  assert.match(route, /parseClinicWorkspaceHome\(payload, \{ clinicId, locationId \}\)/);
  assert.match(route, /new URL\(request\.url\)\.search\.length > 0/);
  assert.match(route, /VETHELP_API_BASE_URL/);
});
