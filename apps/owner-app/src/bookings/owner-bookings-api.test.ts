import type { ApiClient } from '@/api/client';
import {
  createOwnerBookingsApi,
  mergeOwnerBookingsPages,
  parseOwnerBookingsPage,
  type OwnerBookingsPage,
} from './owner-bookings-api';

const HOLD_1 = '11111111-1111-4111-8111-111111111111';
const HOLD_2 = '22222222-2222-4222-8222-222222222222';
const CLINIC = '33333333-3333-4333-8333-333333333333';
const PET = '44444444-4444-4444-8444-444444444444';

const summary = (holdId = HOLD_1, bucket: 'REQUIRES_ACTION' | 'ACTIVE' | 'HISTORY' = 'ACTIVE') => ({
  holdId,
  appointmentId: null,
  state: bucket === 'REQUIRES_ACTION' ? 'ALTERNATIVE_PENDING' : bucket === 'HISTORY' ? 'COMPLETED' : 'CONFIRMED',
  bucket,
  presentation: {
    code: bucket === 'REQUIRES_ACTION' ? 'ALTERNATIVE_TIME_REQUIRED' : bucket === 'HISTORY' ? 'HISTORY_RECORDED' : 'CONFIRMED_UPCOMING',
    label: bucket === 'REQUIRES_ACTION' ? 'Нужно выбрать время' : bucket === 'HISTORY' ? 'Приём завершён' : 'Подтверждена',
    description: 'Авторитетное описание статуса.',
    tone: bucket === 'REQUIRES_ACTION' ? 'warning' : 'success',
  },
  startsAt: '2026-09-20T09:00:00.000Z',
  endsAt: '2026-09-20T09:30:00.000Z',
  clinic: { id: CLINIC, name: 'VetHelp Demo', address: 'Москва, ул. Тестовая, 1' },
  pet: { id: PET, name: 'Жучка', species: 'DOG' },
});

const page = (overrides: Partial<OwnerBookingsPage> = {}) => ({
  serverNow: '2026-09-11T10:00:00.000Z',
  requiresAction: [],
  active: [summary()],
  history: [],
  nextCursor: null,
  ...overrides,
});

describe('owner bookings API', () => {
  it('strictly parses server-owned buckets and presentation', () => {
    expect(parseOwnerBookingsPage(page()).active[0].presentation.label).toBe('Подтверждена');
    expect(() => parseOwnerBookingsPage({ ...page(), unexpected: true })).toThrow('INVALID_OWNER_BOOKINGS_RESPONSE');
    expect(() => parseOwnerBookingsPage({ ...page(), active: [summary(HOLD_1, 'HISTORY')] })).toThrow('INVALID_OWNER_BOOKINGS_RESPONSE');
  });

  it('keeps nextCursor opaque and sends it back unchanged', async () => {
    const request = jest.fn().mockResolvedValue(page());
    const api = createOwnerBookingsApi({ request } as unknown as ApiClient);
    await api.list('opaque', 'eyJyYW5rIjoxfQ');
    expect(request).toHaveBeenCalledWith(
      'v1/owner/bookings?limit=20&cursor=eyJyYW5rIjoxfQ',
      expect.objectContaining({ headers: { Authorization: 'Bearer opaque' } }),
    );
  });

  it('preserves page and server bucket order while deduplicating hold ids', () => {
    const first = parseOwnerBookingsPage(page({
      requiresAction: [summary(HOLD_1, 'REQUIRES_ACTION')] as never,
      active: [summary(HOLD_2, 'ACTIVE')] as never,
      nextCursor: 'next',
    }));
    const second = parseOwnerBookingsPage(page({
      requiresAction: [],
      active: [summary(HOLD_1, 'ACTIVE')] as never,
      history: [summary('55555555-5555-4555-8555-555555555555', 'HISTORY')] as never,
    }));
    const merged = mergeOwnerBookingsPages([first, second]);
    expect(merged.requiresAction.map((item) => item.holdId)).toEqual([HOLD_1]);
    expect(merged.active.map((item) => item.holdId)).toEqual([HOLD_2]);
    expect(merged.history).toHaveLength(1);
  });
});
