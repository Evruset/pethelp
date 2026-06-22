export const HOLD_STATES = [
  'MANUAL_CONFIRM_PENDING',
  'CONFIRMED',
  'EXPIRED',
  'RELEASED',
  'MIS_RESERVATION_PENDING',
  'MIS_HELD',
  'PAYMENT_PENDING',
  'PAYMENT_IN_PROGRESS',
  'PAYMENT_RECONCILIATION_PENDING',
  'MIS_BOOKING_FAILED',
] as const;

export type HoldState = (typeof HOLD_STATES)[number];
export type MvpHoldState = Extract<HoldState, 'MANUAL_CONFIRM_PENDING' | 'CONFIRMED' | 'EXPIRED' | 'RELEASED'>;

export interface SlotRow {
  id: string;
  clinic_location_id: string;
  starts_at: Date;
  ends_at: Date;
  capacity: number;
  booked_count: number;
  held_count: number;
  state: 'OPEN' | 'CLOSED' | 'CANCELLED';
  version: number;
}

export interface HoldRow {
  id: string;
  slot_id: string;
  owner_id: string;
  pet_id: string;
  state: HoldState;
  expires_at: Date;
  state_changed_at: Date;
  version: number;
  created_at: Date;
}

export interface CreateHoldResult {
  holdId: string;
  state: HoldState;
  slotId: string;
  expiresAt: string;
  correlationId: string;
}

export interface ConfirmHoldResult {
  holdId: string;
  appointmentId: string;
  state: 'CONFIRMED';
  slotId: string;
  correlationId: string;
}

export interface ReleaseHoldResult {
  holdId: string;
  state: 'RELEASED';
  slotId: string;
  correlationId: string;
}
