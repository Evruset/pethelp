import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { Role, JwtPayload } from '../src/auth/auth.types';
import { Capability, hasCapability } from '../src/auth/capability';
import { AppointmentMedicalSharingService, MedicalSelection } from '../src/booking-core/appointment-medical-sharing.service';
import { ClinicAppointmentMedicalSharingController, OwnerAppointmentMedicalSharingController } from '../src/booking-core/appointment-medical-sharing.controller';

describe('Wave 4A closed medical-sharing contract', () => {
  const actor = { sub: randomUUID(), roles: [Role.OWNER] } as JwtPayload;
  const appointment = randomUUID();
  const db = { withTransaction: jest.fn() };
  const service = new AppointmentMedicalSharingService(db as never, {} as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it.each(Object.values(Role))('medical capability is veterinarian-only: %s', role => {
    expect(hasCapability({ ...actor, roles: [role] }, Capability.MEDICAL_SHARED_DATA_READ))
      .toBe(role === Role.CLINIC_VETERINARIAN);
  });

  it.each([
    null, [], 'ALL_CURRENT', {}, { mode: 'ALL_CURRENT', resources: [] },
    { mode: 'ALL_CURRENT', clinicId: randomUUID() },
    { mode: 'SELECTED', resources: [] },
    { mode: 'SELECTED', resources: [{ type: 'DOCUMENT', id: randomUUID(), ownerId: randomUUID() }] },
    { mode: 'SELECTED', resources: [{ type: 'DOCUMENT', id: 123 }] },
    { mode: 'SELECTED', resources: [{ type: 'RAW_OCR', id: randomUUID() }] },
  ])('rejects malformed or authority-widening selection %# before opening a transaction', body => {
    expect(() => service.create(appointment, body as MedicalSelection, randomUUID(), actor, randomUUID()))
      .toThrow(BadRequestException);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate resources independent of UUID case', () => {
    const id = randomUUID();
    expect(() => service.create(appointment, { mode: 'SELECTED', resources: [
      { type: 'DOCUMENT', id }, { type: 'DOCUMENT', id: id.toUpperCase() },
    ] }, randomUUID(), actor, randomUUID())).toThrow(BadRequestException);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it('revoke rejects additional authority fields', () => {
    const revoke = jest.fn();
    const controller = new OwnerAppointmentMedicalSharingController({ revoke } as never);
    expect(() => controller.revoke(appointment, randomUUID(), { petId: randomUUID() }, '1', randomUUID(), randomUUID(), actor))
      .toThrow(BadRequestException);
    expect(revoke).not.toHaveBeenCalled();
  });

  it('clinic cannot request raw OCR as medical truth', () => {
    const clinicRead = jest.fn();
    const controller = new ClinicAppointmentMedicalSharingController({ clinicRead } as never);
    expect(() => controller.read(appointment, 'RAW_OCR', randomUUID(), actor)).toThrow(BadRequestException);
    expect(clinicRead).not.toHaveBeenCalled();
  });
});
