const assert = require('node:assert/strict');
const test = require('node:test');

const parserPath = process.env.CLINIC_PATIENTS_PARSER_MODULE;
if (!parserPath) throw new Error('CLINIC_PATIENTS_PARSER_MODULE is required');
const { ClinicPatientsResponseError, parseClinicPatientsSnapshot } = require(parserPath);

const clinicId = '91111111-1111-4111-8111-111111111111';
const locationId = '92222222-2222-4222-8222-222222222222';
const patientId = '93333333-3333-4333-8333-333333333333';
const expected = { clinicId, locationId };

test('K-32 accepts required nullable administrativeReference', () => {
  assert.equal(parseClinicPatientsSnapshot(snapshot(null), expected).items[0].administrativeReference, null);
  assert.equal(parseClinicPatientsSnapshot(snapshot('PET-004281'), expected).items[0].administrativeReference, 'PET-004281');
});

test('K-32 rejects missing, wrong-type and unknown Registry fields', () => {
  const missing = snapshot(null);
  delete missing.items[0].administrativeReference;
  const wrong = snapshot(null);
  wrong.items[0].administrativeReference = 42;
  const extra = snapshot(null);
  extra.items[0].administrativeReferenceKey = 'private';
  for (const payload of [missing, wrong, extra]) {
    assert.throws(() => parseClinicPatientsSnapshot(payload, expected), ClinicPatientsResponseError);
  }
});

function snapshot(administrativeReference) {
  return {
    clinicId, locationId, serverNow: '2026-07-26T08:00:00.000Z', nextCursor: null,
    items: [{
      patientId, administrativeReference,
      pet: { displayName: 'Барсик', speciesLabel: 'Кошка', breed: null, sexCode: 'MALE', birthDate: '2020-02-29' },
      owner: { displayName: null },
      relationship: { firstSeenAt: '2025-01-01T08:00:00.000Z', lastSeenAt: '2026-07-25T08:00:00.000Z' },
      appointments: { lastVisitAt: null, nextAppointmentAt: null },
    }],
  };
}
