const test = require('node:test');
const assert = require('node:assert/strict');

const { parseClinicWorkspaceHome } = require(process.env.WORKSPACE_HOME_PARSER_MODULE);

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const LOCATION_ID = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-07-31T09:15:30.123Z';

const unavailable = (kind, availability = 'NOT_AUTHORIZED') => ({ kind, availability, generatedAt: NOW });
const queue = () => ({
  kind: 'QUEUE', availability: 'AVAILABLE', generatedAt: NOW,
  facts: { waitingCount: 4, requiresActionCount: 2, oldestWaitAgeBucket: '5_TO_10_MIN', slaRisk: 'DUE_SOON' },
  action: { route: 'queue', labelKey: 'WORKSPACE_OPEN_QUEUE' },
});
const appointments = () => ({
  kind: 'APPOINTMENTS', availability: 'AVAILABLE', generatedAt: NOW,
  facts: { todayCount: 9, requiresActionCount: 1, nextScheduledAt: '2026-07-31T10:00:00+03:00' },
  action: { route: 'appointments', labelKey: 'WORKSPACE_OPEN_APPOINTMENTS' },
});
const reception = () => ({
  clinicId: CLINIC_ID, locationId: LOCATION_ID, serverNow: NOW, generatedAt: NOW,
  freshness: { state: 'FRESH', maxAgeSeconds: 30 },
  sections: [queue(), unavailable('SCHEDULE', 'NOT_CONFIGURED'), appointments(), unavailable('VETERINARIAN'), unavailable('QUALITY')],
});
const clone = (value) => structuredClone(value);
const parse = (value) => parseClinicWorkspaceHome(value, { clinicId: CLINIC_ID, locationId: LOCATION_ID });
const rejects = (mutate) => {
  const value = reception();
  mutate(value);
  assert.throws(() => parse(value), /INVALID_WORKSPACE_HOME_RESPONSE/);
};

test('accepts valid reception, veterinarian and multi-role variants', () => {
  assert.deepEqual(parse(reception()), reception());
  const veterinarian = reception();
  veterinarian.sections = [unavailable('QUEUE'), unavailable('SCHEDULE', 'NOT_CONFIGURED'), unavailable('APPOINTMENTS'), unavailable('VETERINARIAN', 'NOT_CONFIGURED'), unavailable('QUALITY')];
  assert.equal(parse(veterinarian).sections[0].availability, 'NOT_AUTHORIZED');
  const multiRole = reception();
  multiRole.sections[4] = unavailable('QUALITY', 'NOT_CONFIGURED');
  assert.equal(parse(multiRole).sections[4].availability, 'NOT_CONFIGURED');
});

test('rejects incorrect, duplicate and missing section tuples', () => {
  rejects((value) => [value.sections[0], value.sections[1]] = [value.sections[1], value.sections[0]]);
  rejects((value) => value.sections[1] = clone(value.sections[0]));
  rejects((value) => value.sections.pop());
});

test('rejects AVAILABLE Schedule and unavailable variants carrying protected data or actions', () => {
  rejects((value) => value.sections[1] = { ...queue(), kind: 'SCHEDULE' });
  rejects((value) => value.sections[0] = { ...unavailable('QUEUE'), facts: queue().facts });
  rejects((value) => value.sections[0] = { ...unavailable('QUEUE'), action: queue().action });
});

test('rejects out-of-range and non-integer counts', () => {
  rejects((value) => value.sections[0].facts.waitingCount = 1000);
  rejects((value) => value.sections[0].facts.waitingCount = -1);
  rejects((value) => value.sections[2].facts.todayCount = 1.5);
});

test('rejects wrong action pairs and arbitrary URLs', () => {
  rejects((value) => value.sections[0].action = { route: 'appointments', labelKey: 'WORKSPACE_OPEN_QUEUE' });
  rejects((value) => value.sections[2].action.labelKey = 'WORKSPACE_OPEN_QUEUE');
  rejects((value) => value.sections[0].action.url = 'https://attacker.invalid');
});

test('rejects route scope mismatch', () => {
  rejects((value) => value.clinicId = '33333333-3333-4333-8333-333333333333');
  rejects((value) => value.locationId = '44444444-4444-4444-8444-444444444444');
});

test('rejects malformed and impossible timestamps', () => {
  rejects((value) => value.generatedAt = '31 July 2026');
  rejects((value) => value.serverNow = '2026-02-30T10:00:00Z');
  rejects((value) => value.sections[0].generatedAt = '2026-07-31T25:00:00Z');
  rejects((value) => value.sections[2].facts.nextScheduledAt = '2026-13-01T10:00:00Z');
});

test('rejects unknown availability, facts enums and keys', () => {
  rejects((value) => value.sections[0].availability = 'STALE');
  rejects((value) => value.sections[0].facts.slaRisk = 'CRITICAL');
  rejects((value) => value.freshness.extra = true);
  rejects((value) => value.sections[2].facts.patientId = 'private');
});

test('rejects non-canonical unavailable availability by section kind', () => {
  rejects((value) => value.sections[0] = unavailable('QUEUE', 'NOT_CONFIGURED'));
  rejects((value) => value.sections[1] = unavailable('SCHEDULE', 'TEMPORARILY_UNAVAILABLE'));
});

test('rejects payloads above 8 KiB', () => {
  const value = reception();
  value.padding = 'я'.repeat(5000);
  assert.throws(() => parse(value), (error) => error.kind === 'oversized');
});
