import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { OwnerBookingsScreen } from './OwnerBookingsScreen';
import { ownerBookingsApi, type OwnerBookingSummary, type OwnerBookingsPage } from './owner-bookings-api';

jest.mock('@/session/SessionProvider', () => ({
  useSession: () => ({ session: { opaqueCredential: 'opaque-owner', cacheScope: 'owner-scope' } }),
}));

const CLINIC = '33333333-3333-4333-8333-333333333333';
const PET = '44444444-4444-4444-8444-444444444444';
const HOLD_ACTION = '11111111-1111-4111-8111-111111111111';
const HOLD_ACTIVE = '22222222-2222-4222-8222-222222222222';
const HOLD_HISTORY = '55555555-5555-4555-8555-555555555555';

const row = (holdId: string, bucket: 'REQUIRES_ACTION' | 'ACTIVE' | 'HISTORY', label: string): OwnerBookingSummary => ({
  holdId,
  appointmentId: null,
  state: bucket === 'REQUIRES_ACTION' ? 'ALTERNATIVE_PENDING' : bucket === 'ACTIVE' ? 'CONFIRMED' : 'COMPLETED',
  bucket,
  presentation: {
    code: bucket === 'REQUIRES_ACTION' ? 'ALTERNATIVE_TIME_REQUIRED' : bucket === 'ACTIVE' ? 'CONFIRMED_UPCOMING' : 'HISTORY_RECORDED',
    label,
    description: `${label}: описание от сервера`,
    tone: bucket === 'REQUIRES_ACTION' ? 'warning' : 'success',
  },
  startsAt: '2026-09-20T09:00:00.000Z',
  endsAt: '2026-09-20T09:30:00.000Z',
  clinic: { id: CLINIC, name: 'VetHelp Demo', address: 'Москва, ул. Тестовая, 1' },
  pet: { id: PET, name: 'Жучка', species: 'DOG' },
});

const firstPage: OwnerBookingsPage = {
  serverNow: '2026-09-11T10:00:00.000Z',
  requiresAction: [row(HOLD_ACTION, 'REQUIRES_ACTION', 'Нужно выбрать время')],
  active: [row(HOLD_ACTIVE, 'ACTIVE', 'Подтверждена')],
  history: [row(HOLD_HISTORY, 'HISTORY', 'Приём завершён')],
  nextCursor: null,
};

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function QueryHarness({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return QueryHarness;
}

describe('OwnerBookingsScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders server-owned sections in priority order without raw state or ids', async () => {
    jest.spyOn(ownerBookingsApi, 'list').mockResolvedValue(firstPage);
    const screen = await render(<OwnerBookingsScreen onHome={jest.fn()} onClinics={jest.fn()} onPets={jest.fn()} />, { wrapper: harness() });

    await screen.findByText('Нужно выбрать время');
    const action = screen.getByText('Требуют внимания');
    const active = screen.getByText('Предстоящие');
    const history = screen.getByText('История');
    expect(action).toBeTruthy();
    expect(active).toBeTruthy();
    expect(history).toBeTruthy();
    expect(screen.queryByText('ALTERNATIVE_PENDING')).toBeNull();
    expect(screen.queryByText(HOLD_ACTION)).toBeNull();
    await screen.unmount();
  });

  it('returns the opaque nextCursor unchanged when loading more', async () => {
    const second: OwnerBookingsPage = {
      serverNow: '2026-09-11T10:00:01.000Z',
      requiresAction: [], active: [], history: [row('66666666-6666-4666-8666-666666666666', 'HISTORY', 'Запись завершена')], nextCursor: null,
    };
    const list = jest.spyOn(ownerBookingsApi, 'list')
      .mockResolvedValueOnce({ ...firstPage, history: [], nextCursor: 'opaque_cursor_1' })
      .mockResolvedValueOnce(second);
    const screen = await render(<OwnerBookingsScreen onHome={jest.fn()} onClinics={jest.fn()} onPets={jest.fn()} />, { wrapper: harness() });

    const more = await screen.findByText('Показать ещё');
    fireEvent.press(more);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][1]).toBe('opaque_cursor_1');
    await screen.findByText('Запись завершена');
    await screen.unmount();
  });

  it('keeps the last successful snapshot visible when refresh fails', async () => {
    const list = jest.spyOn(ownerBookingsApi, 'list').mockResolvedValueOnce(firstPage);
    const screen = await render(<OwnerBookingsScreen onHome={jest.fn()} onClinics={jest.fn()} onPets={jest.fn()} />, { wrapper: harness() });
    await screen.findByText('Подтверждена');
    list.mockRejectedValueOnce(new Error('network'));
    fireEvent.press(screen.getByText('Обновить'));
    await screen.findByText('Не удалось обновить записи');
    expect(screen.getByText('Подтверждена')).toBeTruthy();
    await screen.unmount();
  });
});
