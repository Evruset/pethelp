import { apiClient, type ApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKETS = ['REQUIRES_ACTION', 'ACTIVE', 'HISTORY'] as const;
const TONES = ['info', 'success', 'warning', 'danger', 'neutral'] as const;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const instant = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));

export type OwnerBookingDetail = Readonly<{
  holdId: string;
  bucket: typeof BUCKETS[number];
  version: number;
  startsAt: string;
  endsAt: string;
  latestStatusUpdateAt: string;
  presentation: { label: string; description: string; tone: typeof TONES[number] };
  clinic: { name: string; address: string };
  location: { address: string };
  pet: { name: string; species: string };
  service: { name: string | null; priceAmount: string | null; currency: string | null };
  timeline: { occurredAt: string; title: string; description: string; isCurrent: boolean }[];
  actions: { canCancel: boolean };
  cancellation: { canCancel: boolean; aggregateVersion: number; safeReason: string | null };
}>;

export function parseOwnerBookingDetail(value: unknown): OwnerBookingDetail {
  if (!object(value) || !UUID.test(String(value.holdId)) || !BUCKETS.includes(value.bucket as never) ||
    !Number.isInteger(value.version) || Number(value.version) < 1 || !instant(value.startsAt) || !instant(value.endsAt) ||
    !instant(value.latestStatusUpdateAt) || !object(value.presentation) || !text(value.presentation.label) ||
    !text(value.presentation.description) || !TONES.includes(value.presentation.tone as never) || !object(value.clinic) ||
    !text(value.clinic.name) || !text(value.clinic.address) || !object(value.location) || !text(value.location.address) ||
    !object(value.pet) || !text(value.pet.name) || !text(value.pet.species) || !object(value.service) ||
    !(value.service.name === null || text(value.service.name)) || !(value.service.priceAmount === null || text(value.service.priceAmount)) ||
    !(value.service.currency === null || text(value.service.currency)) || !Array.isArray(value.timeline) || !object(value.actions) ||
    typeof value.actions.canCancel !== 'boolean' || !object(value.cancellation) || typeof value.cancellation.canCancel !== 'boolean' ||
    value.actions.canCancel !== value.cancellation.canCancel || !Number.isInteger(value.cancellation.aggregateVersion) ||
    value.cancellation.aggregateVersion !== value.version || !(value.cancellation.safeReason === null || text(value.cancellation.safeReason))) {
    throw new Error('INVALID_OWNER_BOOKING_DETAIL_RESPONSE');
  }
  for (const event of value.timeline) {
    if (!object(event) || !instant(event.occurredAt) || !text(event.title) || !text(event.description) || typeof event.isCurrent !== 'boolean') {
      throw new Error('INVALID_OWNER_BOOKING_DETAIL_RESPONSE');
    }
  }
  return value as unknown as OwnerBookingDetail;
}

export function createOwnerBookingDetailApi(client: ApiClient = apiClient) {
  return {
    async read(credential: string, bookingId: string, signal?: AbortSignal) {
      if (!UUID.test(bookingId)) throw new Error('INVALID_OWNER_BOOKING_ID');
      const result = parseOwnerBookingDetail(await client.request<unknown>(`v1/owner/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${credential}` }, signal,
      }));
      if (result.holdId !== bookingId) throw new Error('INVALID_OWNER_BOOKING_DETAIL_RESPONSE');
      return result;
    },
    async cancel(credential: string, bookingId: string, version: number, idempotencyKey: string) {
      if (!UUID.test(bookingId) || !UUID.test(idempotencyKey) || !Number.isInteger(version) || version < 1) throw new Error('INVALID_OWNER_CANCELLATION_COMMAND');
      await client.request<unknown, { reasonCode: 'OTHER' }>(`v1/owner/bookings/${bookingId}/cancel`, {
        method: 'POST', body: { reasonCode: 'OTHER' }, headers: {
          Authorization: `Bearer ${credential}`,
          'Idempotency-Key': idempotencyKey,
          'If-Match': String(version),
        },
      });
    },
  };
}

export const ownerBookingDetailApi = createOwnerBookingDetailApi();
export const isStaleCancellation = (error: unknown) => error instanceof ApiError && (error.kind === 'CONFLICT' || error.kind === 'VALIDATION');
