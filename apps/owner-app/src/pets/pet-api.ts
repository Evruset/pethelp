import { apiClient, type ApiClient } from '@/api/client';

export type PetSpecies = 'DOG' | 'CAT' | 'OTHER';

export type Pet = Readonly<{
  petId: string;
  name: string;
  species: PetSpecies;
  createdAt: string;
  updatedAt: string;
}>;

export type PetClinicalDiaryEntry = Readonly<{
  visit: { visitId: string; occurredAt: string; clinic: { name: string }; location: { address: string } | null; service: { name: string } | null; doctor: { name: string } | null };
  result: { resultId: string; publishedAt: string; content: string };
  amendments: readonly { amendmentId: string; publishedAt: string; content: string }[];
}>;

export type PetDiary = Readonly<{ petId: string; clinicalEntries: PetClinicalDiaryEntry[] }>;

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

function timestamp(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function named(value: unknown, field: 'name' | 'address'): boolean { return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)[field] === 'string'; }

function clinicalEntry(value: unknown): PetClinicalDiaryEntry {
  if (typeof value !== 'object' || value === null) throw new Error('INVALID_PET_DIARY_RESPONSE');
  const item = value as Record<string, unknown>; const visit = item.visit as Record<string, unknown>; const result = item.result as Record<string, unknown>;
  if (!visit || !result || !Array.isArray(item.amendments) || typeof visit.visitId !== 'string' || !UUID.test(visit.visitId) || !timestamp(visit.occurredAt) || !named(visit.clinic, 'name')) throw new Error('INVALID_PET_DIARY_RESPONSE');
  if (visit.location !== null && !named(visit.location, 'address') || visit.service !== null && !named(visit.service, 'name') || visit.doctor !== null && !named(visit.doctor, 'name')) throw new Error('INVALID_PET_DIARY_RESPONSE');
  if (typeof result.resultId !== 'string' || !UUID.test(result.resultId) || !timestamp(result.publishedAt) || typeof result.content !== 'string') throw new Error('INVALID_PET_DIARY_RESPONSE');
  const amendments = item.amendments.map((value) => { const amendment = value as Record<string, unknown>; if (!amendment || typeof amendment.amendmentId !== 'string' || !UUID.test(amendment.amendmentId) || !timestamp(amendment.publishedAt) || typeof amendment.content !== 'string') throw new Error('INVALID_PET_DIARY_RESPONSE'); return { amendmentId: amendment.amendmentId, publishedAt: amendment.publishedAt, content: amendment.content }; });
  return { visit: { visitId: visit.visitId, occurredAt: visit.occurredAt, clinic: visit.clinic as { name: string }, location: visit.location as { address: string } | null, service: visit.service as { name: string } | null, doctor: visit.doctor as { name: string } | null }, result: { resultId: result.resultId, publishedAt: result.publishedAt, content: result.content }, amendments };
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

export function createPetDiaryApi(client: ApiClient = apiClient) {
  return { async read(credential: string, petId: string, signal?: AbortSignal): Promise<PetDiary> {
    if (!UUID.test(petId)) throw new Error('INVALID_PET_ID');
    const value = await client.request<unknown>(`v1/owner/pets/${petId}/diary?limit=100&offset=0`, { headers: { Authorization: `Bearer ${credential}` }, signal });
    if (typeof value !== 'object' || value === null) throw new Error('INVALID_PET_DIARY_RESPONSE');
    const page = value as Record<string, unknown>;
    if (page.petId !== petId || !Array.isArray(page.entries) || !Array.isArray(page.clinicalEntries) || typeof page.page !== 'object' || page.page === null) throw new Error('INVALID_PET_DIARY_RESPONSE');
    return { petId, clinicalEntries: page.clinicalEntries.map(clinicalEntry) };
  } };
}

export const petDiaryApi = createPetDiaryApi();
