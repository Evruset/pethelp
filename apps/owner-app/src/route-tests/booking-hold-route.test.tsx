import { render } from '@testing-library/react-native';

import BookingStatusRoute from '../app/(app)/booking/[holdId]';

const mockParams = jest.fn();
const mockReplace = jest.fn();
const mockSession = jest.fn();

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    useLocalSearchParams: () => mockParams(),
    useRouter: () => ({ replace: mockReplace }),
  };
});
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: mockSession() }) }));
jest.mock('@/booking/BookingStatusScreen', () => {
  const { Text } = jest.requireActual('react-native');
  return { BookingStatusScreen: ({ holdId }: { holdId: string }) => <Text>{`booking:${holdId}`}</Text> };
});

describe('shared booking deep-link route', () => {
  beforeEach(() => {
    mockParams.mockReturnValue({ holdId: '66666666-6666-4666-8666-666666666666' });
    mockSession.mockReturnValue({ cacheScope: 'owner-scope', opaqueCredential: 'opaque' });
    mockReplace.mockReset();
  });

  it('guards an unauthenticated Web or native deep link through the public journey', async () => {
    mockSession.mockReturnValue(null);
    const view = await render(<BookingStatusRoute />);
    expect(view.getByText('redirect:/(public)')).toBeTruthy();
  });

  it('resolves the same UUID route to the shared booking status screen when authenticated', async () => {
    const view = await render(<BookingStatusRoute />);
    expect(view.getByText('booking:66666666-6666-4666-8666-666666666666')).toBeTruthy();
  });

  it('rejects malformed identifiers before making an authoritative booking read', async () => {
    mockParams.mockReturnValue({ holdId: 'not-a-booking-id' });
    const view = await render(<BookingStatusRoute />);
    expect(view.getByText('Ссылка на запись недействительна.')).toBeTruthy();
  });
});
