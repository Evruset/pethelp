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
      Capability.BOOKING_DECISION,
      Capability.APPOINTMENT_REGISTRY_READ,
      Capability.PATIENT_ADMIN_READ,
      Capability.PATIENT_ADMIN_LOCAL_PROFILE_UPDATE,
      Capability.QUALITY_READ,
      Capability.SCHEDULE_READ,
      Capability.BOOKING_REPLAY_READ,
      Capability.BOOKING_HOLD_READ,
    ]);
  });

  it('grants booking decisions only to the currently authorized clinic roles', () => {
    expect(hasCapability(employee(Role.CLINIC_RECEPTIONIST), Capability.BOOKING_DECISION)).toBe(true);
    expect(hasCapability(employee(Role.CLINIC_ADMIN), Capability.BOOKING_DECISION)).toBe(true);
    expect(hasCapability(employee(Role.CLINIC_VETERINARIAN), Capability.BOOKING_DECISION)).toBe(false);
    expect(hasCapability(employee(Role.OWNER), Capability.BOOKING_DECISION)).toBe(false);
  });

  it('grants patient.admin.read only to receptionist and clinic admin', () => {
    expect(hasCapability(employee(Role.CLINIC_RECEPTIONIST), Capability.PATIENT_ADMIN_READ)).toBe(true);
    expect(hasCapability(employee(Role.CLINIC_ADMIN), Capability.PATIENT_ADMIN_READ)).toBe(true);
    expect(hasCapability(employee(Role.CLINIC_VETERINARIAN), Capability.PATIENT_ADMIN_READ)).toBe(false);
  });

  it('grants local profile mutation separately from read and never to veterinarians', () => {
    expect(hasCapability(employee(Role.CLINIC_RECEPTIONIST), Capability.PATIENT_ADMIN_LOCAL_PROFILE_UPDATE)).toBe(true);
    expect(hasCapability(employee(Role.CLINIC_ADMIN), Capability.PATIENT_ADMIN_LOCAL_PROFILE_UPDATE)).toBe(true);
    expect(hasCapability(employee(Role.CLINIC_VETERINARIAN), Capability.PATIENT_ADMIN_LOCAL_PROFILE_UPDATE)).toBe(false);
  });

  it('grants schedule.manage only to clinic administrators', () => {
    expect(hasCapability(employee(Role.CLINIC_ADMIN), Capability.SCHEDULE_MANAGE)).toBe(true);
    expect(hasCapability(employee(Role.CLINIC_RECEPTIONIST), Capability.SCHEDULE_MANAGE)).toBe(false);
    expect(hasCapability(employee(Role.CLINIC_VETERINARIAN), Capability.SCHEDULE_MANAGE)).toBe(false);
    expect(hasCapability(employee(Role.OWNER), Capability.SCHEDULE_MANAGE)).toBe(false);
  });

  it('grants schedule.read to clinic veterinarians without schedule.manage', () => {
    expect(hasCapability(employee(Role.CLINIC_VETERINARIAN), Capability.SCHEDULE_READ)).toBe(true);
    expect(hasCapability(employee(Role.CLINIC_VETERINARIAN), Capability.SCHEDULE_MANAGE)).toBe(false);
  });
});
