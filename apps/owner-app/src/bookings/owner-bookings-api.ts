import { apiClient, type ApiClient } from '@/api/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRESENTATION_CODES = [
  'WAITING_FOR_CLINIC',
  'CHECKING_AVAILABILITY',
  'ALTERNATIVE_TIME_REQUIRED',
  'CONFIRMED_UPCOMING',
  'VISIT_TIME_PASSED',
  'NOT_CONFIRMED',
  'CANCELLED',
  'HISTORY_RECORDED',
  'STATUS_SYNCING',
] as const;
const TONES = ['info', 'success', 'warning', 'danger', 'neutral'] as const;
const SPECIES = ['DOG', 'CAT', 'OTHER'] as const;

export type OwnerBookingBucket = 'REQUIRES_ACTION' | 'ACTIVE' | 'HISTORY';
export type OwnerBookingTone = typeof TONES[number];
export type OwnerBookingSummary = Readonly<{
  holdId: string;
  appointmentId: string | null;
  state: string;
  bucket: OwnerBookingBucket;
  presentation: Readonly<{
    code: typeof PRESENTATION_CODES[number];
    label: string;
    description: string;
    tone: OwnerBookingTone;
  }>;
  startsAt: string;
  endsAt: string;
  clinic: Readonly<{ id: string; name: string; address: string }>;
  pet: Readonly<{ id: string; name: string; species: typeof SPECIES[number] }>;
}>;

export type OwnerBookingsPage = Readonly<{
  serverNow: string;
  requiresAction: OwnerBookingSummary[];
  active: OwnerBookingSummary[];
  history: OwnerBookingSummary[];
  nextCursor: string | null;
}>;

export type OwnerBookingsMerged = Readonly<{
  requiresAction: OwnerBookingSummary[];
  active: OwnerBookingSummary[];
  history: OwnerBookingSummary[];
}>;

const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && values.includes(value as T);

function parseSummary(value: unknown, expectedBucket: OwnerBookingBucket): OwnerBookingSummary {
  if (!value || typeof value !== 'object') throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  const row = value as Record<string, unknown>;
  if (!exact(row, ['holdId', 'appointmentId', 'state', 'bucket', 'presentation', 'startsAt', 'endsAt', 'clinic', 'pet'])) {
    throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  }
  if (!UUID.test(String(row.holdId)) || row.appointmentId !== null && !UUID.test(String(row.appointmentId)) || !text(row.state) || row.bucket !== expectedBucket || !instant(row.startsAt) || !instant(row.endsAt)) {
    throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  }

  if (!row.presentation || typeof row.presentation !== 'object') throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  const presentation = row.presentation as Record<string, unknown>;
  if (!exact(presentation, ['code', 'label', 'description', 'tone']) || !oneOf(presentation.code, PRESENTATION_CODES) || !text(presentation.label) || !text(presentation.description) || !oneOf(presentation.tone, TONES)) {
    throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  }

  if (!row.clinic || typeof row.clinic !== 'object') throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  const clinic = row.clinic as Record<string, unknown>;
  if (!exact(clinic, ['id', 'name', 'address']) || !UUID.test(String(clinic.id)) || !text(clinic.name) || !text(clinic.address)) {
    throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  }

  if (!row.pet || typeof row.pet !== 'object') throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  const pet = row.pet as Record<string, unknown>;
  if (!exact(pet, ['id', 'name', 'species']) || !UUID.test(String(pet.id)) || !text(pet.name) || !oneOf(pet.species, SPECIES)) {
    throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  }

  return row as OwnerBookingSummary;
}

function parseBucket(value: unknown, bucket: OwnerBookingBucket) {
  if (!Array.isArray(value)) throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  return value.map((row) => parseSummary(row, bucket));
}

export function parseOwnerBookingsPage(value: unknown): OwnerBookingsPage {
  if (!value || typeof value !== 'object') throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  const page = value as Record<string, unknown>;
  if (!exact(page, ['serverNow', 'requiresAction', 'active', 'history', 'nextCursor']) || !instant(page.serverNow) || page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !/^[A-Za-z0-9_-]+$/.test(page.nextCursor))) {
    throw new Error('INVALID_OWNER_BOOKINGS_RESPONSE');
  }
  return {
    serverNow: page.serverNow as string,
    requiresAction: parseBucket(page.requiresAction, 'REQUIRES_ACTION'),
    active: parseBucket(page.active, 'ACTIVE'),
    history: parseBucket(page.history, 'HISTORY'),
    nextCursor: page.nextCursor as string | null,
  };
}

export function mergeOwnerBookingsPages(pages: readonly OwnerBookingsPage[]): OwnerBookingsMerged {
  const merged: { requiresAction: OwnerBookingSummary[]; active: OwnerBookingSummary[]; history: OwnerBookingSummary[] } = {
    requiresAction: [],
    active: [],
    history: [],
  };
  const seen = new Set<string>();
  const orderedBuckets = ['requiresAction', 'active', 'history'] as const;
  for (const page of pages) {
    for (const bucket of orderedBuckets) {
      for (const row of page[bucket]) {
        if (seen.has(row.holdId)) continue;
        seen.add(row.holdId);
        merged[bucket].push(row);
      }
    }
  }
  return merged;
}

export function createOwnerBookingsApi(client: ApiClient = apiClient) {
  return {
    async list(credential: string, cursor?: string | null, signal?: AbortSignal): Promise<OwnerBookingsPage> {
      if (cursor != null && !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('INVALID_OWNER_BOOKINGS_CURSOR');
      const path = `v1/owner/bookings?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const value = await client.request<unknown>(path, {
        headers: { Authorization: `Bearer ${credential}` },
        signal,
      });
      return parseOwnerBookingsPage(value);
    },
  };
}

export const ownerBookingsApi = createOwnerBookingsApi();
