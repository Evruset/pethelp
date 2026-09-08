import { Role, type JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { BookingEventReplayService } from './booking-event-replay.service';

const holdId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const occurredAt = new Date('2026-08-09T10:00:00.000Z');

function actor(sub: string, roles: Role[]): JwtPayload {
  return { sub, roles } as JwtPayload;
}

function harness(state = 'MANUAL_CONFIRM_PENDING', clinicDeclined = false) {
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('FROM booking_schema.booking_holds')) return { rows: [{
      owner_id: ownerId, clinic_location_id: '33333333-3333-4333-8333-333333333333',
      clinic_id: '44444444-4444-4444-8444-444444444444', state, clinic_declined: clinicDeclined,
      updated_at: occurredAt, server_now: new Date('2026-08-09T10:01:00.000Z'),
    }] };
    if (sql.includes('FROM audit_schema.audit_log')) return { rows: [
      { id: '55555555-5555-4555-8555-555555555555', action: 'booking.hold.created', actor_type: 'OWNER', occurred_at: occurredAt, correlation_id: '66666666-6666-4666-8666-666666666666', payload_json: { token: 'must-not-leak' } },
      { id: '77777777-7777-4777-8777-777777777777', action: clinicDeclined ? 'booking.declined' : 'booking.confirmed', actor_type: 'CLINIC_EMPLOYEE', occurred_at: occurredAt, correlation_id: null, payload_json: { actorId: 'must-not-leak' } },
    ] };
    return { rows: [] };
  });
  const database = { withTransaction: (callback: (client: { query: typeof query }) => unknown) => callback({ query }) };
  const clinicAccess = { assertBookingReplayReadAccess: jest.fn() };
  return { service: new BookingEventReplayService(database as never, clinicAccess as never), query, clinicAccess };
}

describe('BookingEventReplayService public history', () => {
  it.each([
    ['MANUAL_CONFIRM_PENDING', false, 'PENDING_CONFIRMATION'], ['CONFIRMED', false, 'CONFIRMED'],
    ['RELEASED', true, 'REJECTED'], ['RELEASED', false, 'CANCELLED'], ['EXPIRED', false, 'EXPIRED'],
  ])('projects %s to %s without raw state or payload leakage', async (state, declined, expected) => {
    const { service } = harness(state, declined);
    const result = await service.history(holdId, actor(ownerId, [Role.OWNER]));
    expect(result).toMatchObject({ bookingId: holdId, status: expected, lastUpdatedAt: occurredAt.toISOString() });
    expect(result.events.map((event) => event.eventType)).toEqual(['BOOKING_REQUESTED', declined ? 'BOOKING_REJECTED' : 'BOOKING_CONFIRMED']);
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(JSON.stringify(result)).not.toContain('payload');
    expect(JSON.stringify(result)).not.toContain('MANUAL_CONFIRM_PENDING');
  });

  it('normalizes a foreign Owner to not found before reading history', async () => {
    const { service, query } = harness();
    await expect(service.history(holdId, actor('99999999-9999-4999-8999-999999999999', [Role.OWNER])))
      .rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SELECT id::text, action'))).toBe(false);
  });

  it('delegates clinic tenant authority to the existing membership boundary', async () => {
    const { service, clinicAccess } = harness();
    await service.history(holdId, actor('88888888-8888-4888-8888-888888888888', [Role.CLINIC_RECEPTIONIST]));
    expect(clinicAccess.assertBookingReplayReadAccess).toHaveBeenCalledWith(
      expect.anything(), expect.anything(),
      '44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333',
    );
  });

  it('uses a stable timestamp/event-id cursor and never exposes correlation evidence', async () => {
    const { service, query } = harness();
    const first = await service.history(holdId, actor(ownerId, [Role.OWNER]), 1);
    expect(first.nextCursor).toEqual({ occurredAt: occurredAt.toISOString(), eventId: '55555555-5555-4555-8555-555555555555' });
    expect(first.events[0]).not.toHaveProperty('correlationId');
    await service.history(holdId, actor(ownerId, [Role.OWNER]), 1, first.nextCursor!);
    const historyCall = query.mock.calls.filter(([sql]) => String(sql).includes('SELECT id::text, action')).at(-1)!;
    expect(historyCall[1]).toEqual(expect.arrayContaining([first.nextCursor!.occurredAt, first.nextCursor!.eventId, 2]));
  });

  it('propagates a clinic tenant denial without reading history', async () => {
    const { service, query, clinicAccess } = harness();
    clinicAccess.assertBookingReplayReadAccess.mockRejectedValueOnce(DomainErrors.clinicScopeMismatch());
    await expect(service.history(holdId, actor('88888888-8888-4888-8888-888888888888', [Role.CLINIC_ADMIN])))
      .rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SELECT id::text, action'))).toBe(false);
  });

  it('scopes decline evidence to booking_hold aggregates', async () => {
    const { service, query } = harness('RELEASED', false);
    await service.history(holdId, actor(ownerId, [Role.OWNER]));
    expect(String(query.mock.calls.find(([sql]) => String(sql).includes('FROM booking_schema.booking_holds'))?.[0]))
      .toContain("a.aggregate_type = 'booking_hold'");
  });
});
