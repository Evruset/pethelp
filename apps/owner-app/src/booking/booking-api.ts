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
export const BOOKING_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];
type NamedSummary = Readonly<{ id: string; name: string }>;
export type BookingHoldSnapshot = Readonly<{
  holdId: string; slotId: string; status: BookingStatus; statusCode: BookingStatus;
  statusTitle: string; safeDescription: string;
  nextActionCode: 'WAIT' | 'VIEW_APPOINTMENT' | 'CHOOSE_ANOTHER_SLOT';
  confirmationMode: 'AUTOMATIC' | 'MANUAL' | 'MIS';
  expiresAt: string; serverNow: string; aggregateVersion: number; lastUpdatedAt: string;
  pet: NamedSummary & { species: string }; clinic: NamedSummary;
  location: { id: string; address: string }; service: NamedSummary; doctor: NamedSummary | null;
  slot: { startsAt: string; endsAt: string; timezone: string };
  clinicLocationId: string; startsAt: string; endsAt: string;
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

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' && value.length > 0;
const named = (value: unknown) => object(value) && exact(value, ['id', 'name']) && UUID.test(String(value.id)) && text(value.name);

export function parseBookingHoldSnapshot(raw: unknown): BookingHoldSnapshot {
  if (!object(raw)) throw new Error('INVALID_BOOKING_READ_RESPONSE');
  const keys = ['holdId','slotId','status','statusCode','statusTitle','safeDescription','nextActionCode','confirmationMode','expiresAt','serverNow','aggregateVersion','lastUpdatedAt','pet','clinic','location','service','doctor','slot','clinicLocationId','startsAt','endsAt'];
  const statuses: readonly unknown[] = BOOKING_STATUSES;
  const pet = raw.pet; const location = raw.location; const slot = raw.slot;
  if (!exact(raw, keys) || !UUID.test(String(raw.holdId)) || !UUID.test(String(raw.slotId)) ||
    !statuses.includes(raw.status) || raw.statusCode !== raw.status || !text(raw.statusTitle) || !text(raw.safeDescription) ||
    !['WAIT','VIEW_APPOINTMENT','CHOOSE_ANOTHER_SLOT'].includes(String(raw.nextActionCode)) ||
    !['AUTOMATIC','MANUAL','MIS'].includes(String(raw.confirmationMode)) || !instant(raw.expiresAt) || !instant(raw.serverNow) ||
    !Number.isInteger(raw.aggregateVersion) || Number(raw.aggregateVersion) < 1 || !instant(raw.lastUpdatedAt) ||
    !object(pet) || !exact(pet, ['id','name','species']) || !UUID.test(String(pet.id)) || !text(pet.name) || !text(pet.species) ||
    !named(raw.clinic) || !object(location) || !exact(location, ['id','address']) || !UUID.test(String(location.id)) || !text(location.address) ||
    !named(raw.service) || (raw.doctor !== null && !named(raw.doctor)) ||
    !object(slot) || !exact(slot, ['startsAt','endsAt','timezone']) || !instant(slot.startsAt) || !instant(slot.endsAt) || !text(slot.timezone) ||
    !UUID.test(String(raw.clinicLocationId)) || raw.clinicLocationId !== location.id || !instant(raw.startsAt) || !instant(raw.endsAt) ||
    raw.startsAt !== slot.startsAt || raw.endsAt !== slot.endsAt) throw new Error('INVALID_BOOKING_READ_RESPONSE');
  return raw as BookingHoldSnapshot;
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
    async read(credential: string, holdId: string, signal?: AbortSignal) {
      if (!UUID.test(holdId)) throw new Error('INVALID_BOOKING_READ_RESPONSE');
      const result = parseBookingHoldSnapshot(await client.request<unknown>(`v1/booking-holds/${holdId}`, {
        method: 'GET', signal, headers: { Authorization: `Bearer ${credential}` },
      }));
      if (result.holdId !== holdId) throw new Error('INVALID_BOOKING_READ_RESPONSE');
      return result;
    },
  };
}
export const bookingApi = createBookingApi();
