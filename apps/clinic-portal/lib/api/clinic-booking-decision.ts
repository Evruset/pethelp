const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_ERROR_CODES = new Set([
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'LOCATION_SCOPE_DENIED',
  'CLINIC_SCOPE_MISMATCH',
  'HOLD_NOT_FOUND',
  'BOOKING_STATE_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'SLOT_LOCKED_RETRY',
  'QUEUE_FIFO_VIOLATION',
  'HOLD_EXPIRED',
  'BOOKING_TEMPORARILY_UNAVAILABLE',
]);

export type BookingDecisionStatus = 'CONFIRMED' | 'REJECTED';

export type BookingDecisionResult = {
  holdId: string;
  slotId: string;
  status: BookingDecisionStatus;
  aggregateVersion: number;
  lastUpdatedAt: string;
  serverNow: string;
  correlationId: string;
  appointmentId?: string;
};

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth && Number.isFinite(Date.parse(value));
}

export function parseBookingDecisionResult(
  payload: unknown,
  expected: { holdId: string; slotId: string; status: BookingDecisionStatus },
): BookingDecisionResult | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  const allowed = new Set([
    'holdId',
    'slotId',
    'status',
    'aggregateVersion',
    'lastUpdatedAt',
    'serverNow',
    'correlationId',
    'appointmentId',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;
  if (
    value.holdId !== expected.holdId
    || value.slotId !== expected.slotId
    || value.status !== expected.status
    || !Number.isInteger(value.aggregateVersion)
    || (value.aggregateVersion as number) < 1
    || !timestamp(value.lastUpdatedAt)
    || !timestamp(value.serverNow)
    || typeof value.correlationId !== 'string'
    || !UUID.test(value.correlationId)
  ) return null;

  if (expected.status === 'CONFIRMED') {
    if (typeof value.appointmentId !== 'string' || !UUID.test(value.appointmentId)) return null;
  } else if ('appointmentId' in value) {
    return null;
  }

  return value as BookingDecisionResult;
}

export function safeBookingDecisionError(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'BACKEND_UNAVAILABLE';
  const code = (payload as Record<string, unknown>).code;
  return typeof code === 'string' && SAFE_ERROR_CODES.has(code) ? code : 'BACKEND_UNAVAILABLE';
}
