import { HoldState } from './booking.types';

const transitions: Record<HoldState, readonly HoldState[]> = {
  MANUAL_CONFIRM_PENDING: ['ALTERNATIVE_PENDING', 'CONFIRMED', 'EXPIRED', 'RELEASED', 'SLA_BREACHED'],
  ALTERNATIVE_PENDING: ['MIS_HELD', 'EXPIRED', 'RELEASED'],
  CONFIRMED: [],
  EXPIRED: [],
  RELEASED: [],
  SLA_BREACHED: [],
  MIS_RESERVATION_PENDING: ['MIS_HELD', 'MIS_BOOKING_FAILED', 'RELEASED'],
  MIS_HELD: ['PAYMENT_PENDING', 'CONFIRMED', 'RELEASED'],
  PAYMENT_PENDING: ['PAYMENT_IN_PROGRESS', 'RELEASED'],
  PAYMENT_IN_PROGRESS: ['PAYMENT_RECONCILIATION_PENDING', 'CONFIRMED', 'RELEASED'],
  PAYMENT_RECONCILIATION_PENDING: ['CONFIRMED', 'RELEASED'],
  MIS_BOOKING_FAILED: ['RELEASED'],
};

export function canTransition(from: HoldState, to: HoldState): boolean {
  return transitions[from].includes(to);
}

export function isMvpTerminalState(state: HoldState): boolean {
  return state === 'CONFIRMED' || state === 'EXPIRED' || state === 'RELEASED' || state === 'SLA_BREACHED';
}
