const fs = require('fs');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rfc3339 = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;

function exactStrings(actual, expected, name) {
  if (!Array.isArray(actual) || actual.some((x) => typeof x !== 'string') ||
      JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${name} mismatch`);
  }
}
function validateJson(value, depth = 0) {
  if (depth > 12) throw new Error('payload nesting exceeds limit');
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new Error('payload list exceeds limit');
    value.forEach((item) => validateJson(item, depth + 1));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/token|authorization|secret/i.test(key)) throw new Error(`secret-like field ${key}`);
      if (/At$|Date$|Now$|ExpiresAt$|startsAt$|endsAt$/.test(key) && item != null) {
        if (typeof item !== 'string' || !rfc3339.test(item) || Number.isNaN(Date.parse(item)) ||
            new Date(item).toISOString().slice(0, 10) !== item.slice(0, 10)) throw new Error(`invalid timestamp ${key}`);
      }
      if (/Id$/.test(key) && item != null && typeof item === 'string' && !uuid.test(item)) throw new Error(`invalid UUID ${key}`);
      validateJson(item, depth + 1);
    }
  }
}
function validateUniqueIds(items) {
  const ids = items.flatMap((item) => item && typeof item === 'object' && typeof item.holdId === 'string'
    ? [item.holdId]
    : []);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate resource IDs');
}
function validateBffPayload(kind, payload, options = {}) {
  const items = kind === 'visits'
    ? payload
    : payload && typeof payload === 'object' && Array.isArray(payload.items) ? payload.items : null;
  if (!Array.isArray(items)) throw new Error('invalid BFF top-level shape');
  if (options.requireNonEmpty && items.length === 0) throw new Error('empty seeded BFF payload');
  validateJson(payload);
  validateUniqueIds(items);
}
async function json(response) {
  if (!(response.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    throw new Error(`non-JSON response ${response.status}`);
  }
  return response.json();
}
async function post(body) {
  const data = loadData();
  return fetch(endpoint, {
    method: 'POST', redirect: 'manual',
    headers: { Origin: data.portal, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
}
let data;
let endpoint;
function loadData() {
  if (data) return data;
  const input = process.env.DEMO_SESSIONS_JSON;
  if (!input) throw new Error('DEMO_SESSIONS_JSON is required');
  data = JSON.parse(fs.readFileSync(input, 'utf8'));
  endpoint = `${data.portal}/api/dev/local-session`;
  return data;
}
function cookie(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] || null;
}
async function verify(session) {
  const data = loadData();
  const issued = await post({ action: 'issue', profileKey: session.key });
  const issueBody = await json(issued);
  if (issued.status !== 200 || typeof issueBody.code !== 'string') throw new Error(`issue HTTP ${issued.status}`);
  const exchanged = await post({ action: 'exchange', code: issueBody.code });
  const exchangeBody = await json(exchanged);
  if (!session.expectedAccess) {
    if (exchanged.status !== 401 || cookie(exchanged)) throw new Error(`expected bounded denial, got ${exchanged.status}`);
    return;
  }
  const sessionCookie = cookie(exchanged);
  if (exchanged.status !== 200 || !sessionCookie || !exchangeBody.startPath) throw new Error(`exchange HTTP ${exchanged.status}`);
  const replay = await post({ action: 'exchange', code: issueBody.code });
  if (replay.status !== 401 || cookie(replay)) throw new Error('one-time code replay accepted');
  const authorityResponse = await fetch(`${data.portal}/api/auth/session`, { headers: { Cookie: sessionCookie, Accept: 'application/json' } });
  const authority = await json(authorityResponse);
  if (authorityResponse.status !== 200 || authority.subjectId !== session.employeeId) throw new Error('wrong effective subject');
  exactStrings(authority.roles, session.tokenRoles, 'roles');
  const expectedScopes = session.clinicIds.flatMap((clinicId) => session.locationIds.map((locationId) => `${clinicId}:${locationId}`));
  exactStrings(authority.clinicScopes.map((scope) => `${scope.clinicId}:${scope.locationId}`), expectedScopes, 'scopes');
  if (!Array.isArray(authority.effectiveCapabilities) || authority.effectiveCapabilities.length === 0) throw new Error('missing effective capabilities');
  const clinicId = session.clinicIds[0], locationId = session.locationIds[0];
  const vetOnly = session.tokenRoles.includes('CLINIC_VETERINARIAN') && !session.tokenRoles.some((role) => ['CLINIC_ADMIN', 'CLINIC_RECEPTIONIST'].includes(role));
  const apiPath = vetOnly
    ? `/api/clinic/${clinicId}/locations/${locationId}/vet/visits`
    : `/api/clinic/${clinicId}/locations/${locationId}/booking-queue`;
  const apiResponse = await fetch(`${data.portal}${apiPath}`, { headers: { Cookie: sessionCookie, Accept: 'application/json' } });
  const payload = await json(apiResponse);
  if (apiResponse.status !== 200) throw new Error(`BFF HTTP ${apiResponse.status}`);
  validateBffPayload(vetOnly ? 'visits' : 'queue', payload, { requireNonEmpty: vetOnly });
}
async function main() {
  const data = loadData();
  let failed = 0;
  for (const session of data.sessions) {
    try { await verify(session); console.log(`[session-check] PASS ${session.key}`); }
    catch (error) { failed += 1; console.error(`[session-check] FAIL ${session.key}: ${error.message}`); }
  }
  console.log(`[session-check] total=${data.sessions.length} failed=${failed}`);
  if (failed) process.exitCode = 1;
}
if (require.main === module) {
  main().catch((error) => { console.error(`[session-check] FAILED: ${error.message}`); process.exit(1); });
}

module.exports = { json, validateBffPayload, validateJson };
