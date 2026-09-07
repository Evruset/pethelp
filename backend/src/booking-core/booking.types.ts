export const HOLD_STATES = [
  'MANUAL_CONFIRM_PENDING',
  'ALTERNATIVE_PENDING',
  'CONFIRMED',
  'EXPIRED',
  'RELEASED',
  'SLA_BREACHED',
  'MIS_RESERVATION_PENDING',
  'MIS_RECONCILIATION_PENDING',
  'MIS_HELD',
  'PAYMENT_PENDING',
  'PAYMENT_IN_PROGRESS',
  'PAYMENT_RECONCILIATION_PENDING',
  'MIS_BOOKING_FAILED',
  'CANCELLATION_REQUESTED',
  'RESCHEDULE_REQUESTED',
  'COMPLETED',
] as const;

export type HoldState = (typeof HOLD_STATES)[number];
export type MvpHoldState = Extract<HoldState, 'MANUAL_CONFIRM_PENDING' | 'ALTERNATIVE_PENDING' | 'CONFIRMED' | 'EXPIRED' | 'RELEASED' | 'SLA_BREACHED'>;
export type MvpBookingStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export const CLINIC_DECLINE_REASON_CODES = [
  'CAPACITY_UNAVAILABLE',
  'STAFF_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
  'OTHER',
] as const;

export type ClinicDeclineReasonCode = (typeof CLINIC_DECLINE_REASON_CODES)[number];

export function projectMvpBookingStatus(state: HoldState, clinicDeclined = false): MvpBookingStatus | undefined {
  if (state === 'MANUAL_CONFIRM_PENDING' || state === 'ALTERNATIVE_PENDING') return 'PENDING_CONFIRMATION';
  if (state === 'CONFIRMED' || state === 'COMPLETED') return 'CONFIRMED';
  if (state === 'RELEASED') return clinicDeclined ? 'REJECTED' : 'CANCELLED';
  if (state === 'EXPIRED' || state === 'SLA_BREACHED') return 'EXPIRED';
  return undefined;
}

export interface SlotRow {
  id: string;
  clinic_location_id: string;
  service_id?: string | null;
  staff_id?: string | null;
  doctor_id?: string | null;
  doctor_shift_id?: string | null;
  doctor_service_id?: string | null;
  publication_state?: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'BLOCKED' | 'STALE_SOURCE';
  starts_at: Date;
  ends_at: Date;
  capacity: number;
  booked_count: number;
  held_count: number;
  state: 'OPEN' | 'CLOSED' | 'CANCELLED';
  status?: 'AVAILABLE' | 'LOCKED_BY_HOLD' | 'BOOKED';
  integration_mode?: 'LEVEL_A' | 'LEVEL_B' | 'LEVEL_C';
  last_freshness_sync?: Date;
  version: number;
}

export interface HoldRow {
  id: string;
  slot_id: string;
  owner_id: string;
  pet_id: string;
  state: HoldState;
  expires_at: Date;
  confirmation_sla_expires_at?: Date | null;
  alternative_slot_id?: string | null;
  alternative_expires_at?: Date | null;
  state_changed_at: Date;
  version: number;
  created_at: Date;
}

export interface CreateHoldResult {
  holdId: string;
  appointmentId?: string;
  state?: HoldState;
  status?: MvpBookingStatus;
  displayStatus?: MvpBookingStatus;
  slotId: string;
  expiresAt: string;
  lastUpdatedAt: string;
  correlationId: string;
  serverNow?: string;
  aggregateVersion?: number;
  confirmationMode?: 'AUTOMATIC' | 'MANUAL' | 'MIS';
  nextAction?: 'READ_STATUS';
}

export interface ConfirmHoldResult {
  holdId: string;
  appointmentId: string;
  state: 'CONFIRMED';
  slotId: string;
  correlationId: string;
  aggregateVersion?: number;
  lastUpdatedAt?: string;
  serverNow?: string;
}

export interface ReleaseHoldResult {
  holdId: string;
  state: 'RELEASED';
  slotId: string;
  correlationId: string;
  aggregateVersion?: number;
  lastUpdatedAt?: string;
  serverNow?: string;
  swapGroupId?: string | null;
  appointmentId?: string;
}

export interface OwnerCancellationResult extends ReleaseHoldResult {
  aggregateVersion: number;
  lastUpdatedAt: string;
  serverNow: string;
}

export interface RequestCancellationResult {
  holdId: string;
  state: 'CANCELLATION_REQUESTED';
  slotId: string;
  correlationId: string;
}

export interface CompleteAppointmentResult {
  visitId: string;
  holdId: string;
  state: 'COMPLETED';
  slotId: string;
  correlationId: string;
  clinicalSummary: string;
}

export interface RequestNotesResult {
  holdId: string;
  state: 'MANUAL_CONFIRM_PENDING';
  slotId: string;
  version: number;
  requestedNote: string;
  correlationId: string;
}
