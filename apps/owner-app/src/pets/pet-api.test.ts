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

it('reads only the owner pet published clinical projection in backend order', async () => {
  const request=jest.fn().mockResolvedValue({petId:WIRE_PET.petId,entries:[],clinicalEntries:[{visit:{visitId:'33333333-3333-4333-8333-333333333333',occurredAt:'2026-08-12T10:00:00.000Z',clinic:{name:'Clinic'},location:null,service:{name:'Exam'},doctor:null},result:{resultId:'44444444-4444-4444-8444-444444444444',publishedAt:'2026-08-12T11:00:00.000Z',content:'Original'},amendments:[{amendmentId:'55555555-5555-4555-8555-555555555555',authorId:'66666666-6666-4666-8666-666666666666',createdAt:'2026-08-12T12:00:00.000Z',publishedAt:'2026-08-12T12:00:00.000Z',content:'Correction'}]}],page:{limit:100,offset:0,nextOffset:null,total:2}});
  const api=createPetDiaryApi({request});
  await expect(api.read('vh_secret',WIRE_PET.petId)).resolves.toEqual({petId:WIRE_PET.petId,clinicalEntries:[expect.objectContaining({result:expect.objectContaining({content:'Original'}),amendments:[expect.objectContaining({content:'Correction'})]})]});
  expect(request).toHaveBeenCalledWith(`v1/owner/pets/${WIRE_PET.petId}/diary?limit=100&offset=0`,expect.objectContaining({headers:{Authorization:'Bearer vh_secret'}}));
});

it('fails closed on a foreign or malformed diary projection', async () => {
  const api=createPetDiaryApi({request:jest.fn().mockResolvedValue({petId:'22222222-2222-4222-8222-222222222222',entries:[],clinicalEntries:[],page:{}})});
  await expect(api.read('vh_secret',WIRE_PET.petId)).rejects.toThrow('INVALID_PET_DIARY_RESPONSE');
});
