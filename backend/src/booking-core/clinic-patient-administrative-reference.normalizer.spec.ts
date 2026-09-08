import {
  normalizeAdministrativeReference,
  UNICODE_CASE_FOLDING_VERSION,
} from './clinic-patient-administrative-reference.normalizer';

describe('clinic patient administrative reference normalization', () => {
  it('pins Unicode 17 full case folding, including expansions and non-BMP letters', () => {
    expect(UNICODE_CASE_FOLDING_VERSION).toBe('17.0.0');
    expect(normalizeAdministrativeReference('Straße-1')?.comparisonKey).toBe('strasse-1');
    expect(normalizeAdministrativeReference('\u{10400}-1')?.comparisonKey).toBe('\u{10428}-1');
  });
});
