import { Text } from 'react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import PublicHomeScreen from '@/app/(public)';

jest.mock('@/session/secure-session-store', () => ({
  secureSessionStore: { read: jest.fn(async () => null), write: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));

function ProtectedSentinel() {
  return <Text>PROTECTED_OWNER_SENTINEL</Text>;
}

it('contains direct protected-route entry with the real Expo Router when no authoritative session exists', async () => {
  const router = renderRouter({
    _layout: RootLayout,
    '(public)/index': PublicHomeScreen,
    '(app)/index': ProtectedSentinel,
  }, { initialUrl: '/(app)' });

  await waitFor(() => expect(screen.getByLabelText('Публичный вход')).toBeTruthy());
  expect(screen.queryByText('PROTECTED_OWNER_SENTINEL')).toBeNull();
  expect(router.getPathname()).not.toBe('/(app)');
});
