import { Capability, effectiveCapabilities, hasCapability } from './capability';
import { JwtPayload, Role } from './auth.types';

function employee(...roles: Role[]): JwtPayload {
  return { sub: '00000000-0000-4000-8000-000000000001', roles };
}

describe('hasCapability', () => {
  it('grants clinical visit completion to clinic veterinarians', () => {
    expect(hasCapability(employee(Role.CLINIC_VETERINARIAN), Capability.CLINICAL_VISIT_COMPLETE)).toBe(true);
  });

  it('does not grant clinical visit completion to clinic administrators', () => {
    expect(hasCapability(employee(Role.CLINIC_ADMIN), Capability.CLINICAL_VISIT_COMPLETE)).toBe(false);
  });

  it('derives booking queue capability for clinic reception without trusting a JWT capability claim', () => {
    expect(effectiveCapabilities(employee(Role.CLINIC_RECEPTIONIST))).toEqual([
      Capability.BOOKING_QUEUE_READ,
      Capability.QUALITY_READ,
      Capability.SCHEDULE_READ,
      Capability.BOOKING_REPLAY_READ,
      Capability.BOOKING_HOLD_READ,
    ]);
  });
});
