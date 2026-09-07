import {
  ownerIntentCatalogMode,
  ownerIntentPetPurpose,
  ownerIntentRequiresPet,
} from './owner-home-intent';

describe('Owner V50 home intent routing', () => {
  it('opens Clinics without forcing the pet selector', () => {
    expect(ownerIntentRequiresPet('CLINICS')).toBe(false);
    expect(ownerIntentCatalogMode('CLINICS')).toBe('browse');
  });

  it('keeps booking, nearest-time and diary as distinct pet-scoped intents', () => {
    expect(ownerIntentRequiresPet('BOOKING')).toBe(true);
    expect(ownerIntentRequiresPet('TIME')).toBe(true);
    expect(ownerIntentRequiresPet('DIARY')).toBe(true);

    expect(ownerIntentPetPurpose('BOOKING')).toBe('booking');
    expect(ownerIntentPetPurpose('TIME')).toBe('time');
    expect(ownerIntentPetPurpose('DIARY')).toBe('diary');

    expect(ownerIntentCatalogMode('BOOKING')).toBe('booking');
    expect(ownerIntentCatalogMode('TIME')).toBe('time');
  });
});
