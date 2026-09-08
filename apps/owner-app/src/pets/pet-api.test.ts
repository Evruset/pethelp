import { createPetApi } from './pet-api';

const WIRE_PET = {
  petId: '11111111-1111-4111-8111-111111111111',
  name: 'Барсик',
  species: 'CAT',
  createdAt: '2026-08-12T10:00:00.000Z',
  updatedAt: '2026-08-12T10:00:00.000Z',
};

const PET = {
  petId: WIRE_PET.petId,
  name: WIRE_PET.name,
  species: WIRE_PET.species,
  createdAt: WIRE_PET.createdAt,
  updatedAt: WIRE_PET.updatedAt,
};

it('accepts authoritative backend petId on create', async () => {
  const request = jest.fn().mockResolvedValue(WIRE_PET);
  const api = createPetApi({ request });

  await expect(
    api.create(
      'vh_secret',
      { name: 'Барсик', species: 'CAT' },
      '22222222-2222-4222-8222-222222222222',
    ),
  ).resolves.toEqual(PET);

  expect(request).toHaveBeenCalledWith(
    'v1/owner/pets',
    expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer vh_secret',
        'Idempotency-Key': '22222222-2222-4222-8222-222222222222',
      },
    }),
  );
});

it('accepts authoritative backend petIds on list', async () => {
  const request = jest.fn().mockResolvedValue([WIRE_PET]);
  const api = createPetApi({ request });

  await expect(api.list('vh_secret')).resolves.toEqual([PET]);
});

it('rejects malformed backend petId', async () => {
  const api = createPetApi({
    request: jest.fn().mockResolvedValue([
      {
        ...WIRE_PET,
        petId: 'bad',
      },
    ]),
  });

  await expect(api.list('vh_secret')).rejects.toThrow(
    'INVALID_PET_RESPONSE',
  );
});

it('does not accept legacy id as a wire-contract substitute', async () => {
  const api = createPetApi({
    request: jest.fn().mockResolvedValue([
      {
        id: WIRE_PET.petId,
        name: WIRE_PET.name,
        species: WIRE_PET.species,
        createdAt: WIRE_PET.createdAt,
        updatedAt: WIRE_PET.updatedAt,
      },
    ]),
  });

  await expect(api.list('vh_secret')).rejects.toThrow(
    'INVALID_PET_RESPONSE',
  );
});
