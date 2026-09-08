import { resolveOwnerCreateInitialState } from './booking-hold-creation.service';
import { projectMvpBookingStatus } from './booking.types';

describe('MVP booking semantics', () => {
  it('routes every PILOT_V1 owner create through manual confirmation', () => {
    expect(resolveOwnerCreateInitialState(true, false)).toBe('MANUAL_CONFIRM_PENDING');
    expect(resolveOwnerCreateInitialState(true, true)).toBe('MANUAL_CONFIRM_PENDING');
  });

  it('preserves legacy automatic and MIS decisions', () => {
    expect(resolveOwnerCreateInitialState(false, false)).toBe('CONFIRMED');
    expect(resolveOwnerCreateInitialState(false, true)).toBe('MIS_RESERVATION_PENDING');
  });

  it('projects internal states without renaming the state machine', () => {
    expect(projectMvpBookingStatus('MANUAL_CONFIRM_PENDING')).toBe('PENDING_CONFIRMATION');
    expect(projectMvpBookingStatus('CONFIRMED')).toBe('CONFIRMED');
    expect(projectMvpBookingStatus('RELEASED', true)).toBe('REJECTED');
    expect(projectMvpBookingStatus('RELEASED', false)).toBe('CANCELLED');
    expect(projectMvpBookingStatus('EXPIRED')).toBe('EXPIRED');
  });
});
