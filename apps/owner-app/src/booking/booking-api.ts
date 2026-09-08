import { apiClient, type ApiClient } from '@/api/client';
import type { AvailabilityHandoff } from '@/clinics/availability-api';

export type BookingCommand = Readonly<AvailabilityHandoff & { petId: string }>;
export type BookingResult = Readonly<{
  holdId: string;
  status: 'PENDING_CONFIRMATION';
  slotId: string;
  expiresAt: string;
  lastUpdatedAt: string;
  correlationId: string;
  serverNow: string;
  aggregateVersion: number;
  confirmationMode: 'MANUAL';
  nextAction: 'READ_STATUS';
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join() === keys.sort().join();
const instant = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value)!;
  const date = new Date(Date.parse(value));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) && date.getUTCHours() === Number(match[4]) && date.getUTCMinutes() === Number(match[5]) && date.getUTCSeconds() === Number(match[6]);
};

export function parseBookingResult(raw: unknown): BookingResult {
  if (!raw || typeof raw !== 'object') throw new Error('INVALID_BOOKING_RESPONSE');
  const value = raw as Record<string, unknown>;
  const keys = ['holdId','status','slotId','expiresAt','lastUpdatedAt','correlationId','serverNow','aggregateVersion','confirmationMode','nextAction'];
  if (!exact(value, keys) || !UUID.test(String(value.holdId)) || value.status !== 'PENDING_CONFIRMATION' || !UUID.test(String(value.slotId)) || !instant(value.expiresAt) || !instant(value.lastUpdatedAt) || !UUID.test(String(value.correlationId)) || !instant(value.serverNow) || !Number.isInteger(value.aggregateVersion) || Number(value.aggregateVersion) < 1 || value.confirmationMode !== 'MANUAL' || value.nextAction !== 'READ_STATUS') throw new Error('INVALID_BOOKING_RESPONSE');
  return value as BookingResult;
}

export function createBookingApi(client: ApiClient = apiClient) {
  return {
    async create(credential: string, command: BookingCommand, idempotencyKey: string, signal?: AbortSignal) {
      const result = parseBookingResult(await client.request<unknown, BookingCommand>('v1/booking-holds', {
        method: 'POST', body: command, signal,
        headers: { Authorization: `Bearer ${credential}`, 'Idempotency-Key': idempotencyKey },
      }));
      if (result.slotId !== command.slotId) throw new Error('INVALID_BOOKING_RESPONSE');
      return result;
    },
  };
}
export const bookingApi = createBookingApi();
