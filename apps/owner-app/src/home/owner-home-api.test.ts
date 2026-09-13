import { createOwnerHomeApi, ownerHomeQueryKey, parseOwnerHomeSnapshot } from './owner-home-api';

const PET = { id: '11111111-1111-4111-8111-111111111111', name: 'Рекс', species: 'DOG', breed: null, photoUrl: null };
const HOLD = '22222222-2222-4222-8222-222222222222';
const snapshot = { schemaVersion: 1, serverNow: '2026-09-10T08:00:00.000Z', pets: [PET], selectedPet: PET, selectionSource: 'DEFAULT', nextAction: { type: 'UPCOMING_CONFIRMED_VISIT', priority: 'LOW', sourceType: 'BOOKING_HOLD', sourceId: HOLD, title: 'Ближайший визит подтверждён', description: 'Добрый ветеринар: 2026-09-12T08:00:00.000Z', deadlineAt: '2026-09-12T08:00:00.000Z', actionCode: 'OPEN_APPOINTMENT' }, activeCare: { sourceType: 'BOOKING_HOLD', sourceId: HOLD, statusCode: 'CONFIRMED', title: 'Добрый ветеринар', description: 'Запись подтверждена', startsAt: '2026-09-12T08:00:00.000Z', deadlineAt: '2026-09-12T08:00:00.000Z', clinicName: 'Добрый ветеринар', petId: PET.id, actionCode: 'OPEN_APPOINTMENT' } } as const;

describe('Owner Home API', () => {
  it('accepts the exact authoritative snapshot and requests an owned selection through the existing path', async () => {
    const request = jest.fn().mockResolvedValue(snapshot);
    await expect(createOwnerHomeApi({ request }).read('credential', PET.id)).resolves.toEqual(snapshot);
    expect(request).toHaveBeenCalledWith(`v1/owner/home?selectedPetId=${PET.id}`, { headers: { Authorization: 'Bearer credential' }, signal: undefined });
  });

  it.each([
    { ...snapshot, schemaVersion: 2 },
    { ...snapshot, unknown: true },
    { ...snapshot, nextAction: { ...snapshot.nextAction, actionCode: 'OPEN_UNKNOWN' } },
    { ...snapshot, activeCare: { ...snapshot.activeCare, statusCode: 'RAW_INTERNAL' } },
    { ...snapshot, selectedPet: { ...PET, id: '33333333-3333-4333-8333-333333333333' } },
  ])('fails closed for malformed or unknown contract values', (value) => {
    expect(() => parseOwnerHomeSnapshot(value)).toThrow('INVALID_OWNER_HOME_RESPONSE');
  });

  it('rejects malformed selectedPetId before transport', async () => {
    const request = jest.fn();
    await expect(createOwnerHomeApi({ request }).read('credential', 'foreign')).rejects.toThrow('INVALID_SELECTED_PET_ID');
    expect(request).not.toHaveBeenCalled();
  });

  it('isolates Home cache state by session authority and selected pet', () => {
    expect(ownerHomeQueryKey('owner-a', PET.id)).not.toEqual(ownerHomeQueryKey('owner-b', PET.id));
    expect(ownerHomeQueryKey('owner-a', PET.id)).not.toEqual(ownerHomeQueryKey('owner-a', HOLD));
  });
});
