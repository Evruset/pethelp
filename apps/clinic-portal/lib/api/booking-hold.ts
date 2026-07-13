export const BOOKING_HOLD_STATES = [
  'MANUAL_CONFIRM_PENDING', 'MIS_RESERVATION_PENDING', 'MIS_HELD',
  'CONFIRMED', 'EXPIRED', 'RELEASED', 'MIS_BOOKING_FAILED',
] as const;

export type BookingHoldState = typeof BOOKING_HOLD_STATES[number];
export type BookingHold = {
  holdId: string;
  slotId: string;
  state: BookingHoldState;
  expiresAt: string;
  clinicLocationId: string;
  startsAt: string;
  endsAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEYS = ['clinicLocationId', 'endsAt', 'expiresAt', 'holdId', 'slotId', 'startsAt', 'state'];

export class BookingHoldParseError extends Error {}

function isBookingHoldState(value: unknown): value is BookingHoldState {
  return typeof value === 'string' && BOOKING_HOLD_STATES.includes(value as BookingHoldState);
}

function isRfc3339(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return calendar.getUTCFullYear() === Number(year) && calendar.getUTCMonth() === Number(month) - 1 && calendar.getUTCDate() === Number(day) && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60 && Number.isFinite(Date.parse(value));
}

export function parseBookingHold(value: unknown): BookingHold {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BookingHoldParseError('INVALID_HOLD_RESPONSE');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join('|') !== KEYS.join('|')) throw new BookingHoldParseError('INVALID_HOLD_RESPONSE');
  const { holdId, slotId, state, expiresAt, clinicLocationId, startsAt, endsAt } = item;
  if (typeof holdId !== 'string' || !UUID.test(holdId) || typeof slotId !== 'string' || !UUID.test(slotId) || typeof clinicLocationId !== 'string' || !UUID.test(clinicLocationId)) throw new BookingHoldParseError('INVALID_HOLD_RESPONSE');
  if (!isBookingHoldState(state)) throw new BookingHoldParseError('INVALID_HOLD_RESPONSE');
  if (!isRfc3339(expiresAt) || !isRfc3339(startsAt) || !isRfc3339(endsAt)) throw new BookingHoldParseError('INVALID_HOLD_RESPONSE');
  return { holdId, slotId, state, expiresAt, clinicLocationId, startsAt, endsAt };
}
