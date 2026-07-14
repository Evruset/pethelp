import { BadRequestException } from '@nestjs/common';
import { Role, type JwtPayload } from '../auth/auth.types';
import type { OwnerAppointmentSummary } from '../auth/owner-appointments.service';
import type { OwnerPet } from '../auth/owner-pet.service';
import type { OwnerTelemedSessionSummary } from '../modules/telemed/telemed-owner-session.service';
import { OwnerHomeService } from './owner-home.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const PET_ONE = '22222222-2222-4222-8222-222222222222';
const PET_TWO = '33333333-3333-4333-8333-333333333333';
const FOREIGN_PET = '44444444-4444-4444-8444-444444444444';
const owner: JwtPayload = { sub: OWNER_ID, roles: [Role.OWNER] };

describe('OwnerHomeService', () => {
  const pets = { list: jest.fn() };
  const appointments = { list: jest.fn() };
  const telemed = { list: jest.fn() };
  const service = new OwnerHomeService(pets as never, appointments as never, telemed as never);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T18:00:00.000Z'));
    jest.resetAllMocks();
    pets.list.mockResolvedValue([makePet(PET_ONE, 'Барсик', '2026-01-02T00:00:00.000Z')]);
    appointments.list.mockResolvedValue([]);
    telemed.list.mockResolvedValue([]);
  });

  afterAll(() => jest.useRealTimers());

  it('returns deterministic no-pet state without reading care aggregates', async () => {
    pets.list.mockResolvedValue([]);

    const result = await service.read(owner);

    expect(result).toEqual(expect.objectContaining({
      schemaVersion: 1,
      serverNow: '2026-07-14T18:00:00.000Z',
      pets: [],
      selectedPet: null,
      selectionSource: 'NONE',
      activeCare: null,
      nextAction: expect.objectContaining({ type: 'NONE', actionCode: 'ADD_PET' }),
    }));
    expect(appointments.list).not.toHaveBeenCalled();
    expect(telemed.list).not.toHaveBeenCalled();
  });

  it('selects the first pet deterministically and honors an owned requested hint', async () => {
    pets.list.mockResolvedValue([
      makePet(PET_TWO, 'Яша', '2026-01-02T00:00:00.000Z'),
      makePet(PET_ONE, 'Ася', '2026-01-01T00:00:00.000Z'),
    ]);

    const defaultHome = await service.read(owner);
    const requestedHome = await service.read(owner, PET_TWO);

    expect(defaultHome.selectedPet?.id).toBe(PET_ONE);
    expect(defaultHome.selectionSource).toBe('DEFAULT');
    expect(requestedHome.selectedPet?.id).toBe(PET_TWO);
    expect(requestedHome.selectionSource).toBe('REQUESTED');
  });

  it('rejects invalid syntax but treats a foreign or stale UUID only as a hint', async () => {
    await expect(service.read(owner, 'not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);

    const result = await service.read(owner, FOREIGN_PET);

    expect(result.selectedPet?.id).toBe(PET_ONE);
    expect(result.selectionSource).toBe('DEFAULT');
    expect(JSON.stringify(result)).not.toContain(FOREIGN_PET);
  });

  it('falls back to an active owned pet when a previously selected pet is archived', async () => {
    pets.list.mockResolvedValue([makePet(PET_ONE, 'Активный питомец', '2026-01-02T00:00:00.000Z')]);

    const result = await service.read(owner, PET_TWO);

    expect(pets.list).toHaveBeenCalledWith(owner);
    expect(result.selectedPet?.id).toBe(PET_ONE);
    expect(result.selectionSource).toBe('DEFAULT');
    expect(JSON.stringify(result)).not.toContain(PET_TWO);
  });

  it('uses owner authority for all sources and filters every aggregate to the selected pet', async () => {
    appointments.list.mockResolvedValue([
      makeAppointment('foreign-hold', FOREIGN_PET, 'ALTERNATIVE_PENDING'),
    ]);
    telemed.list.mockResolvedValue([
      makeTelemed('foreign-session', FOREIGN_PET, { safetyEscalation: true }),
    ]);

    const result = await service.read(owner);

    expect(pets.list).toHaveBeenCalledWith(owner);
    expect(appointments.list).toHaveBeenCalledWith(owner);
    expect(telemed.list).toHaveBeenCalledWith(OWNER_ID);
    expect(result.nextAction.actionCode).toBe('OPEN_CATALOG');
    expect(JSON.stringify(result)).not.toContain(FOREIGN_PET);
  });

  it('applies safety escalation then alternative-slot precedence', async () => {
    appointments.list.mockResolvedValue([makeAppointment('alternative', PET_ONE, 'ALTERNATIVE_PENDING')]);
    telemed.list.mockResolvedValue([makeTelemed('safety', PET_ONE, { safetyEscalation: true })]);

    const safety = await service.read(owner);
    expect(safety.nextAction).toEqual(expect.objectContaining({
      type: 'EMERGENCY_GUIDANCE_REQUIRED',
      priority: 'CRITICAL',
      sourceId: 'safety',
      actionCode: 'OPEN_EMERGENCY',
    }));

    telemed.list.mockResolvedValue([makeTelemed('waiting', PET_ONE)]);
    const alternative = await service.read(owner);
    expect(alternative.nextAction).toEqual(expect.objectContaining({
      type: 'ALTERNATIVE_SLOT_RESPONSE',
      sourceId: 'alternative',
      actionCode: 'OPEN_ALTERNATIVE_SLOT',
    }));
  });

  it('never promotes a historical telemed safety flag over current care', async () => {
    appointments.list.mockResolvedValue([makeAppointment('active-alternative', PET_ONE, 'ALTERNATIVE_PENDING')]);
    telemed.list.mockResolvedValue([makeTelemed('historical-safety', PET_ONE, {
      bucket: 'HISTORY',
      state: 'COMPLETED',
      safetyEscalation: true,
    })]);

    const result = await service.read(owner);

    expect(result.nextAction).toEqual(expect.objectContaining({
      type: 'ALTERNATIVE_SLOT_RESPONSE',
      sourceId: 'active-alternative',
      actionCode: 'OPEN_ALTERNATIVE_SLOT',
    }));
    expect(result.nextAction.actionCode).not.toBe('OPEN_EMERGENCY');
    expect(result.activeCare?.sourceId).toBe('active-alternative');
  });

  it('maps doctor-late telemed and returns one allow-listed active care object', async () => {
    telemed.list.mockResolvedValue([makeTelemed('late', PET_ONE, {
      doctorJoinDeadlineAt: '2026-07-14T17:59:00.000Z',
    })]);

    const result = await service.read(owner);

    expect(result.nextAction).toEqual(expect.objectContaining({
      type: 'TELEMED_DOCTOR_LATE',
      priority: 'HIGH',
      actionCode: 'OPEN_TELEMED',
    }));
    expect(Object.keys(result.activeCare ?? {}).sort()).toEqual([
      'actionCode', 'clinicName', 'deadlineAt', 'description', 'petId', 'sourceId',
      'sourceType', 'startsAt', 'statusCode', 'title',
    ].sort());
    expect(JSON.stringify(result)).not.toMatch(/paymentStatus|refundState|recommendationText|followUpNotes|telemedCaseId|version/);
  });

  it('maps owner-action and confirmed bookings, and ignores unknown source states', async () => {
    appointments.list.mockResolvedValue([
      makeAppointment('confirmed', PET_ONE, 'CONFIRMED'),
      makeAppointment('action', PET_ONE, 'RESCHEDULE_REQUESTED'),
    ]);
    expect((await service.read(owner)).nextAction).toEqual(expect.objectContaining({
      type: 'BOOKING_REQUIRES_ACTION', sourceId: 'action', actionCode: 'OPEN_APPOINTMENT',
    }));

    appointments.list.mockResolvedValue([makeAppointment('confirmed', PET_ONE, 'CONFIRMED')]);
    expect((await service.read(owner)).nextAction.type).toBe('UPCOMING_CONFIRMED_VISIT');

    appointments.list.mockResolvedValue([makeAppointment('unknown', PET_ONE, 'PRIVATE_INTERNAL_STATE')]);
    const fallback = await service.read(owner);
    expect(fallback.nextAction).toEqual(expect.objectContaining({
      type: 'START_PLANNED_CARE', sourceType: 'PET', sourceId: PET_ONE, actionCode: 'OPEN_CATALOG',
    }));
    expect(fallback.activeCare).toBeNull();
  });

  it('returns only the minimal pet projection', async () => {
    const result = await service.read(owner);
    expect(result.pets[0]).toEqual({
      id: PET_ONE,
      name: 'Барсик',
      species: 'CAT',
      breed: null,
      photoUrl: null,
    });
    expect(Object.keys(result).sort()).toEqual([
      'activeCare', 'nextAction', 'pets', 'schemaVersion', 'selectedPet', 'selectionSource', 'serverNow',
    ].sort());
  });
});

function makePet(id: string, name: string, createdAt: string): OwnerPet {
  return {
    id, name, species: 'CAT', breed: null, birthDate: null, ageMonths: null, sex: null,
    gender: null, weightKg: null, sterilized: null, isSterilized: null, chipNumber: null,
    allergies: [], chronicConditions: [], vaccinationNotes: null, photoUrl: null,
    insurancePolicyLinks: [], profileVersion: 1,
    createdAt, updatedAt: createdAt,
  };
}

function makeAppointment(holdId: string, petId: string, state: string): OwnerAppointmentSummary {
  return {
    holdId, appointmentId: null, state, bucket: 'ACTIVE',
    presentation: { code: 'STATUS_SYNCING', label: 'Статус', description: 'Проверьте запись.', tone: 'info' },
    startsAt: '2026-07-15T10:00:00.000Z', endsAt: '2026-07-15T10:30:00.000Z',
    clinic: { id: 'clinic', name: 'Добровет', address: 'Адрес' },
    pet: { id: petId, name: 'Питомец', species: 'CAT' },
  };
}

function makeTelemed(
  sessionId: string,
  petId: string,
  overrides: Partial<OwnerTelemedSessionSummary> = {},
): OwnerTelemedSessionSummary {
  return {
    sessionId, bookingHoldId: null, telemedCaseId: null, state: 'WAITING_FOR_DOCTOR',
    telemedCaseState: null, paymentStatus: null, refundState: null, recommendationText: null,
    followUpNotes: null, safetyEscalation: false, bucket: 'ACTIVE',
    startsAt: '2026-07-14T17:50:00.000Z', endsAt: '2026-07-14T18:30:00.000Z',
    doctorJoinDeadlineAt: '2026-07-14T18:10:00.000Z', serverNow: '2026-07-14T18:00:00.000Z',
    version: 1, clinic: { id: 'clinic', name: 'VetHelp', address: 'Онлайн' },
    pet: { id: petId, name: 'Питомец', species: 'CAT' }, service: { id: null, name: 'Консультация' },
    ...overrides,
  };
}
