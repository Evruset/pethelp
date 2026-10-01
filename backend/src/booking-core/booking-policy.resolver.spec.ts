import { BookingPolicyResolver } from './booking-policy.resolver';

describe('BookingPolicyResolver', () => {
  const resolver = new BookingPolicyResolver();

  it('resolves both server-authoritative clinic contracts', () => {
    expect(resolver.resolve({ contractProfile: 'MVP_V1_MANUAL', clinicStatus: 'ACTIVE', locationStatus: 'ACTIVE' }))
      .toEqual({ contractProfile: 'MVP_V1_MANUAL', confirmationMode: 'MANUAL_REQUEST' });
    expect(resolver.resolve({ contractProfile: 'V15_AUTO_CONFIRM', clinicStatus: 'ACTIVE', locationStatus: 'ACTIVE' }))
      .toEqual({ contractProfile: 'V15_AUTO_CONFIRM', confirmationMode: 'AUTO_CONFIRM_PUBLISHED_SLOT' });
  });

  it.each([undefined, null, '', 'UNKNOWN'])('fails closed for missing or unknown profile %p', (contractProfile) => {
    expect(() => resolver.resolve({ contractProfile, clinicStatus: 'ACTIVE', locationStatus: 'ACTIVE' }))
      .toThrow(expect.objectContaining({ response: expect.objectContaining({ code: 'BOOKING_TEMPORARILY_UNAVAILABLE' }) }));
  });

  it.each(['INACTIVE', 'SUSPENDED', 'TERMINATED'])('rejects clinic status %s', (clinicStatus) => {
    expect(() => resolver.resolve({ contractProfile: 'V15_AUTO_CONFIRM', clinicStatus, locationStatus: 'ACTIVE' }))
      .toThrow(expect.objectContaining({ response: expect.objectContaining({ code: 'SLOT_UNAVAILABLE' }) }));
  });
});
