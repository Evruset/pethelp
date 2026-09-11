import { apiClient, type ApiClient } from '@/api/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SPECIES = ['DOG', 'CAT', 'OTHER'] as const;
const SELECTION_SOURCES = ['REQUESTED', 'DEFAULT', 'NONE'] as const;
const ACTION_TYPES = ['EMERGENCY_GUIDANCE_REQUIRED', 'ALTERNATIVE_SLOT_RESPONSE', 'TELEMED_DOCTOR_LATE', 'TELEMED_WAITING', 'BOOKING_REQUIRES_ACTION', 'UPCOMING_CONFIRMED_VISIT', 'START_PLANNED_CARE', 'NONE'] as const;
const PRIORITIES = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'] as const;
const SOURCE_TYPES = ['TELEMED_SESSION', 'BOOKING_HOLD', 'PET', 'NONE'] as const;
const ACTION_CODES = ['OPEN_EMERGENCY', 'OPEN_ALTERNATIVE_SLOT', 'OPEN_TELEMED', 'OPEN_APPOINTMENT', 'OPEN_CATALOG', 'ADD_PET', 'NONE'] as const;
const ACTIVE_STATUSES = ['SAFETY_ESCALATION', 'ALTERNATIVE_PROPOSED', 'OWNER_ACTION_REQUIRED', 'CONFIRMED', 'DOCTOR_LATE', 'WAITING_FOR_DOCTOR', 'CONNECTED'] as const;

type Species = typeof SPECIES[number];
export type OwnerHomeActionCode = typeof ACTION_CODES[number];
export type OwnerHomePet = Readonly<{ id: string; name: string; species: Species; breed: string | null; photoUrl: string | null }>;
export type OwnerHomeNextAction = Readonly<{
  type: typeof ACTION_TYPES[number]; priority: typeof PRIORITIES[number]; sourceType: typeof SOURCE_TYPES[number]; sourceId: string | null;
  title: string; description: string; deadlineAt: string | null; actionCode: OwnerHomeActionCode;
}>;
export type OwnerHomeActiveCare = Readonly<{
  sourceType: 'TELEMED_SESSION' | 'BOOKING_HOLD'; sourceId: string; statusCode: typeof ACTIVE_STATUSES[number]; title: string; description: string;
  startsAt: string | null; deadlineAt: string | null; clinicName: string | null; petId: string;
  actionCode: Exclude<OwnerHomeActionCode, 'OPEN_CATALOG' | 'ADD_PET'>;
}>;
export type OwnerHomeSnapshot = Readonly<{
  schemaVersion: 1; serverNow: string; pets: OwnerHomePet[]; selectedPet: OwnerHomePet | null;
  selectionSource: typeof SELECTION_SOURCES[number]; nextAction: OwnerHomeNextAction; activeCare: OwnerHomeActiveCare | null;
}>;

export const ownerHomeQueryKey = (cacheScope: string, selectedPetId?: string | null) =>
  ['owner', cacheScope, 'home', selectedPetId ?? 'default'] as const;

const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === 'string' && values.includes(value as T);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const optionalInstant = (value: unknown): value is string | null => value === null || instant(value);
const safePhoto = (value: unknown): value is string | null => value === null || typeof value === 'string' && /^https?:\/\//i.test(value);

function parsePet(value: unknown): OwnerHomePet {
  if (!value || typeof value !== 'object') throw new Error('INVALID_OWNER_HOME_RESPONSE');
  const pet = value as Record<string, unknown>;
  if (!exact(pet, ['id', 'name', 'species', 'breed', 'photoUrl']) || !UUID.test(String(pet.id)) || !text(pet.name) || !oneOf(pet.species, SPECIES) || pet.breed !== null && !text(pet.breed) || !safePhoto(pet.photoUrl)) throw new Error('INVALID_OWNER_HOME_RESPONSE');
  return pet as OwnerHomePet;
}

function parseAction(value: unknown): OwnerHomeNextAction {
  if (!value || typeof value !== 'object') throw new Error('INVALID_OWNER_HOME_RESPONSE');
  const action = value as Record<string, unknown>;
  if (!exact(action, ['type', 'priority', 'sourceType', 'sourceId', 'title', 'description', 'deadlineAt', 'actionCode']) || !oneOf(action.type, ACTION_TYPES) || !oneOf(action.priority, PRIORITIES) || !oneOf(action.sourceType, SOURCE_TYPES) || action.sourceId !== null && !UUID.test(String(action.sourceId)) || !text(action.title) || !text(action.description) || !optionalInstant(action.deadlineAt) || !oneOf(action.actionCode, ACTION_CODES)) throw new Error('INVALID_OWNER_HOME_RESPONSE');
  return action as OwnerHomeNextAction;
}

function parseActiveCare(value: unknown): OwnerHomeActiveCare | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('INVALID_OWNER_HOME_RESPONSE');
  const care = value as Record<string, unknown>;
  if (!exact(care, ['sourceType', 'sourceId', 'statusCode', 'title', 'description', 'startsAt', 'deadlineAt', 'clinicName', 'petId', 'actionCode']) || !oneOf(care.sourceType, ['TELEMED_SESSION', 'BOOKING_HOLD']) || !UUID.test(String(care.sourceId)) || !oneOf(care.statusCode, ACTIVE_STATUSES) || !text(care.title) || !text(care.description) || !optionalInstant(care.startsAt) || !optionalInstant(care.deadlineAt) || care.clinicName !== null && !text(care.clinicName) || !UUID.test(String(care.petId)) || !oneOf(care.actionCode, ACTION_CODES) || care.actionCode === 'OPEN_CATALOG' || care.actionCode === 'ADD_PET') throw new Error('INVALID_OWNER_HOME_RESPONSE');
  return care as OwnerHomeActiveCare;
}

export function parseOwnerHomeSnapshot(value: unknown): OwnerHomeSnapshot {
  if (!value || typeof value !== 'object') throw new Error('INVALID_OWNER_HOME_RESPONSE');
  const home = value as Record<string, unknown>;
  if (!exact(home, ['schemaVersion', 'serverNow', 'pets', 'selectedPet', 'selectionSource', 'nextAction', 'activeCare']) || home.schemaVersion !== 1 || !instant(home.serverNow) || !Array.isArray(home.pets) || !oneOf(home.selectionSource, SELECTION_SOURCES)) throw new Error('INVALID_OWNER_HOME_RESPONSE');
  const pets = home.pets.map(parsePet);
  const selectedPet = home.selectedPet === null ? null : parsePet(home.selectedPet);
  if (selectedPet && !pets.some((pet) => pet.id === selectedPet.id) || home.selectionSource === 'NONE' !== (selectedPet === null)) throw new Error('INVALID_OWNER_HOME_RESPONSE');
  const nextAction = parseAction(home.nextAction);
  const activeCare = parseActiveCare(home.activeCare);
  if (activeCare && !selectedPet || activeCare && activeCare.petId !== selectedPet?.id) throw new Error('INVALID_OWNER_HOME_RESPONSE');
  return { schemaVersion: 1, serverNow: home.serverNow, pets, selectedPet, selectionSource: home.selectionSource, nextAction, activeCare };
}

export function createOwnerHomeApi(client: ApiClient = apiClient) {
  return { async read(credential: string, selectedPetId?: string | null, signal?: AbortSignal): Promise<OwnerHomeSnapshot> {
    if (selectedPetId != null && !UUID.test(selectedPetId)) throw new Error('INVALID_SELECTED_PET_ID');
    const suffix = selectedPetId ? `?selectedPetId=${encodeURIComponent(selectedPetId)}` : '';
    return parseOwnerHomeSnapshot(await client.request<unknown>(`v1/owner/home${suffix}`, { headers: { Authorization: `Bearer ${credential}` }, signal }));
  } };
}

export const ownerHomeApi = createOwnerHomeApi();
