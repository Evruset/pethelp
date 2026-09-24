import { ApiError } from '@/api/errors';
import { createOwnerBookingDetailApi, isStaleCancellation, parseOwnerBookingDetail } from './owner-booking-detail-api';

const id = '11111111-1111-4111-8111-111111111111';
const detail = {
  holdId: id, appointmentId: null, state: 'CONFIRMED', bucket: 'ACTIVE', version: 2,
  expiresAt: '2026-09-20T08:00:00.000Z', latestStatusUpdateAt: '2026-09-19T08:00:00.000Z', serverNow: '2026-09-19T09:00:00.000Z',
  startsAt: '2026-09-20T09:00:00.000Z', endsAt: '2026-09-20T09:30:00.000Z',
  presentation: { code: 'CONFIRMED_UPCOMING', label: 'Запись подтверждена', description: 'Клиника ждёт вас.', tone: 'success' },
  clinic: { id, name: 'VetHelp', address: 'Москва' }, location: { id, address: 'Москва', phone: null, latitude: null, longitude: null },
  service: { id, code: 'CHECKUP', name: 'Осмотр', priceAmount: '1200.00', currency: 'RUB' }, pet: { id, name: 'Жучка', species: 'DOG' },
  timeline: [{ at: '2026-09-19T08:00:00.000Z', type: 'booking.confirmed', label: 'Запись подтверждена', occurredAt: '2026-09-19T08:00:00.000Z', code: 'CONFIRMED', title: 'Запись подтверждена', description: 'Клиника подтвердила запись.', isCurrent: true }],
  actions: { canRefresh: true, canRebook: true, canOpenRoute: true, canReviewAlternative: false, canCancel: true },
  cancellation: { canCancel: true, cancellationPolicyCode: 'CLINIC_CONFIRMATION_REQUIRED_V1', cancellationDeadlineAt: null, safeReason: null, aggregateVersion: 2 },
};

it('parses authoritative detail and rejects inconsistent cancellation authority', () => {
  expect(parseOwnerBookingDetail(detail).presentation.label).toBe('Запись подтверждена');
  expect(() => parseOwnerBookingDetail({ ...detail, actions: { ...detail.actions, canCancel: false } })).toThrow('INVALID_OWNER_BOOKING_DETAIL_RESPONSE');
});

it('uses canonical fenced cancel command and then leaves readback to the caller', async () => {
  const request = jest.fn().mockResolvedValue({});
  const api = createOwnerBookingDetailApi({ request });
  await api.cancel('credential', id, 2, '22222222-2222-4222-8222-222222222222');
  expect(request).toHaveBeenCalledWith(`v1/owner/bookings/${id}/cancel`, expect.objectContaining({ method: 'POST', body: { reasonCode: 'OTHER' }, headers: expect.objectContaining({ 'If-Match': '2', 'Idempotency-Key': '22222222-2222-4222-8222-222222222222' }) }));
});

it('classifies controlled conflict as stale without treating network failure as success', () => {
  expect(isStaleCancellation(new ApiError('CONFLICT', 'safe', 409))).toBe(true);
  expect(isStaleCancellation(new ApiError('NETWORK', 'offline'))).toBe(false);
});
