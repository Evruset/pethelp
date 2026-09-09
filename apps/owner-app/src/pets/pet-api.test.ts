import { createPetApi, createPetDiaryApi } from './pet-api';

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

it('normalizes the current backend id field for Owner runtime compatibility', async () => {
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

  await expect(api.list('vh_secret')).resolves.toEqual([PET]);
});

it('accepts the exact grouped published Result and oldest-first Amendment contract', async () => {
  const visitId = '22222222-2222-4222-8222-222222222222'; const resultId = '33333333-3333-4333-8333-333333333333';
  const request = jest.fn().mockResolvedValue({ petId: WIRE_PET.petId, entries: [], page: { limit: 100, offset: 0, nextOffset: null, total: 0 }, clinicalEntries: [{ visit: { visitId, occurredAt: '2026-08-12T09:00:00.000Z', clinic: { name: 'Добрый ветеринар' }, location: null, service: null, doctor: null }, result: { resultId, publishedAt: '2026-08-12T10:00:00.000Z', content: 'Результат приёма' }, amendments: [{ amendmentId: '44444444-4444-4444-8444-444444444441', publishedAt: '2026-08-12T11:00:00.000Z', content: 'Первое уточнение' }, { amendmentId: '44444444-4444-4444-8444-444444444442', publishedAt: '2026-08-12T12:00:00.000Z', content: 'Второе уточнение' }] }] });
  const value = await createPetDiaryApi({ request }).read('vh_secret', WIRE_PET.petId);
  expect(value.clinicalEntries[0].amendments.map((item) => item.content)).toEqual(['Первое уточнение', 'Второе уточнение']);
  expect(request).toHaveBeenCalledWith(`v1/owner/pets/${WIRE_PET.petId}/diary?limit=100&offset=0`, expect.objectContaining({ headers: { Authorization: 'Bearer vh_secret' } }));
});

it('rejects malformed or cross-Pet grouped Diary projection', async () => {
  const request = jest.fn().mockResolvedValue({ petId: '99999999-9999-4999-8999-999999999999', entries: [], clinicalEntries: [], page: {} });
  await expect(createPetDiaryApi({ request }).read('vh_secret', WIRE_PET.petId)).rejects.toThrow('INVALID_PET_DIARY_RESPONSE');
});
