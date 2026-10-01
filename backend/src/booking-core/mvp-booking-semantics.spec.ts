import { resolveOwnerCreateInitialState } from './booking-hold-creation.service';
import { projectMvpBookingStatus } from './booking.types';

describe('MVP booking semantics', () => {
  it('routes the manual clinic contract through manual confirmation', () => {
    expect(resolveOwnerCreateInitialState('MANUAL_REQUEST')).toBe('MANUAL_CONFIRM_PENDING');
  });

  it('routes the v1.5 clinic contract through automatic confirmation', () => {
    expect(resolveOwnerCreateInitialState('AUTO_CONFIRM_PUBLISHED_SLOT')).toBe('CONFIRMED');
  });

  it('projects internal states without renaming the state machine', () => {
    expect(projectMvpBookingStatus('MANUAL_CONFIRM_PENDING')).toBe('PENDING_CONFIRMATION');
    expect(projectMvpBookingStatus('CONFIRMED')).toBe('CONFIRMED');
    expect(projectMvpBookingStatus('RELEASED', true)).toBe('REJECTED');
    expect(projectMvpBookingStatus('RELEASED', false)).toBe('CANCELLED');
    expect(projectMvpBookingStatus('EXPIRED')).toBe('EXPIRED');
  });
});
