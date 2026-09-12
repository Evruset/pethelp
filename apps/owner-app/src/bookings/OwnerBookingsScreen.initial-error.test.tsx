import { fireEvent, render } from '@testing-library/react-native';

import { OwnerBookingsScreen } from './OwnerBookingsScreen';

const mockRefetch = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: () => ({
    data: undefined,
    isPending: false,
    isError: true,
    isRefetchError: false,
    isFetchNextPageError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isRefetching: false,
    refetch: mockRefetch,
    fetchNextPage: jest.fn(),
  }),
}));

jest.mock('@/session/SessionProvider', () => ({
  useSession: () => ({ session: { opaqueCredential: 'opaque-owner', cacheScope: 'owner-scope' } }),
}));

describe('OwnerBookingsScreen initial error', () => {
  beforeEach(() => mockRefetch.mockClear());

  it('shows a bounded retry without stale sections and retries explicitly', async () => {
    const screen = await render(<OwnerBookingsScreen onHome={jest.fn()} onClinics={jest.fn()} onPets={jest.fn()} />);

    expect(screen.getByText('Не удалось загрузить записи')).toBeTruthy();
    expect(screen.queryByText('Требуют внимания')).toBeNull();
    expect(screen.queryByText('Предстоящие')).toBeNull();
    expect(screen.queryByText('История')).toBeNull();

    fireEvent.press(screen.getByText('Повторить'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    await screen.unmount();
  });
});
