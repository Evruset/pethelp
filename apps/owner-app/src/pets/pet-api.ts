import { apiClient, type ApiClient } from '@/api/client';

export type PetSpecies = 'DOG' | 'CAT' | 'OTHER';

export type Pet = Readonly<{
  petId: string;
  name: string;
  species: PetSpecies;
  createdAt: string;
  updatedAt: string;
}>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SPECIES = new Set(['DOG', 'CAT', 'OTHER']);

function pet(value: unknown): Pet {
  if (typeof value !== 'object' || value === null) {
    throw new Error('INVALID_PET_RESPONSE');
  }

  const v = value as Record<string, unknown>;

  if (
    typeof v.petId !== 'string'
    || !UUID.test(v.petId)
    || typeof v.name !== 'string'
    || !SPECIES.has(String(v.species))
    || typeof v.createdAt !== 'string'
    || !Number.isFinite(Date.parse(v.createdAt))
    || typeof v.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(v.updatedAt))
  ) {
    throw new Error('INVALID_PET_RESPONSE');
  }

  return {
    petId: v.petId,
    name: v.name,
    species: v.species as PetSpecies,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

export type PetApi = ReturnType<typeof createPetApi>;

export function createPetApi(client: ApiClient = apiClient) {
  return {
    async list(
      credential: string,
      signal?: AbortSignal,
    ): Promise<Pet[]> {
      const value = await client.request<unknown>(
        'v1/owner/pets',
        {
          headers: {
            Authorization: `Bearer ${credential}`,
          },
          signal,
        },
      );

      if (!Array.isArray(value)) {
        throw new Error('INVALID_PET_RESPONSE');
      }

      return value.map(pet);
    },

    async create(
      credential: string,
      input: { name: string; species: PetSpecies },
      idempotencyKey: string,
    ): Promise<Pet> {
      const value = await client.request<unknown, typeof input>(
        'v1/owner/pets',
        {
          method: 'POST',
          body: input,
          headers: {
            Authorization: `Bearer ${credential}`,
            'Idempotency-Key': idempotencyKey,
          },
        },
      );

      return pet(value);
    },
  };
}

export const petApi = createPetApi();
