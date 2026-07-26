const assert = require('node:assert/strict');
const test = require('node:test');

const parserPath = process.env.PATIENT_DETAIL_PARSER_MODULE;
if (!parserPath) throw new Error('PATIENT_DETAIL_PARSER_MODULE is required');
const { parsePatientDetail, PatientDetailResponseError } = require(parserPath);

const clinicId = '81111111-1111-4111-8111-111111111111';
const locationId = '82222222-2222-4222-8222-222222222222';
const patientId = '83333333-3333-4333-8333-333333333333';
const expected = { clinicId, locationId, patientId };

test('E1-P01..P03 accepts authoritative absent, existing and cleared projections', () => {
  assert.deepEqual(
    parsePatientDetail(detail({ alias: null, aggregateVersion: 0, updatedAt: null }), expected).patient.localProfile,
    { alias: null, aggregateVersion: 0, updatedAt: null },
  );
  assert.deepEqual(
    parsePatientDetail(detail({
      alias: 'Барсик Петровых', aggregateVersion: 3, updatedAt: '2026-07-26T09:00:00.000Z',
    }), expected).patient.localProfile,
    { alias: 'Барсик Петровых', aggregateVersion: 3, updatedAt: '2026-07-26T09:00:00.000Z' },
  );
  assert.deepEqual(
    parsePatientDetail(detail({
      alias: null, aggregateVersion: 4, updatedAt: '2026-07-26T10:00:00.000Z',
    }), expected).patient.localProfile,
    { alias: null, aggregateVersion: 4, updatedAt: '2026-07-26T10:00:00.000Z' },
  );
});

test('E1-P04..P10 rejects missing fields, invalid versions/timestamps, unknown fields and guessed defaults', () => {
  const missingProfile = detail({ alias: null, aggregateVersion: 0, updatedAt: null });
  delete missingProfile.patient.localProfile;
  const missingVersion = detail({ alias: null, aggregateVersion: 0, updatedAt: null });
  delete missingVersion.patient.localProfile.aggregateVersion;
  const cases = [
    missingProfile,
    missingVersion,
    detail({ alias: null, aggregateVersion: -1, updatedAt: null }),
    detail({ alias: null, aggregateVersion: 1.5, updatedAt: '2026-07-26T09:00:00.000Z' }),
    detail({ alias: 'Alias', aggregateVersion: 1, updatedAt: '2026-02-30T09:00:00.000Z' }),
    detail({ alias: null, aggregateVersion: 0, updatedAt: null, internalId: 'forbidden' }),
    detail({ alias: 'Alias', aggregateVersion: 0, updatedAt: null }),
    detail({ alias: null, aggregateVersion: 2, updatedAt: null }),
  ];
  for (const payload of cases) {
    assert.throws(() => parsePatientDetail(payload, expected), PatientDetailResponseError);
  }
});

test('E1-P11 malformed local profile retains the existing safe malformed-response contract', () => {
  assert.throws(
    () => parsePatientDetail(detail({ alias: null, aggregateVersion: -1, updatedAt: null }), expected),
    (error) => error instanceof PatientDetailResponseError
      && error.kind === 'malformed'
      && error.message === 'INVALID_PATIENT_DETAIL_RESPONSE',
  );
});

function detail(localProfile) {
  return {
    clinicId, locationId, serverNow: '2026-07-26T08:00:00.000Z',
    patient: {
      patientId,
      pet: { displayName: 'Барсик', speciesLabel: 'Кошка', breed: null, sexCode: 'MALE', birthDate: '2020-02-29' },
      owner: { displayName: null },
      relationship: { firstSeenAt: '2025-01-01T08:00:00.000Z', lastSeenAt: '2026-07-25T08:00:00.000Z' },
      appointments: { last: null, next: null, recent: [] },
      localProfile,
    },
  };
}
