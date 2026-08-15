/* eslint-disable @typescript-eslint/no-require-imports, import/first -- Jest factory must load mocked runtime dependencies lazily. */
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const { useQueryClient } = require('@tanstack/react-query');
  function Stack({ children }: { children?: React.ReactNode }) {
      useQueryClient();
      return React.createElement(React.Fragment, null, children);
  }
  function Protected({ guard, children }: { guard: boolean; children?: React.ReactNode }) {
    return guard ? React.createElement(React.Fragment, null, children) : null;
  }
  function Screen({ name }: { name: string }) {
    return React.createElement(Text, null, `route:${name}`);
  }
  Stack.Protected = Protected;
  Stack.Screen = Screen;
  return { Stack };
});

jest.mock('@/session/secure-session-store', () => ({
  secureSessionStore: {
    read: jest.fn(async () => null),
    write: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));

import RootLayout, { petAuthorityGeneration } from '@/app/_layout';

it('mounts the router inside the application QueryClient provider', async () => {
  const view = await render(<RootLayout />);
  expect(await view.findByText('route:(public)')).toBeTruthy();
});

it('remounts Pet journey across logout and every authoritative session', () => {
  const a = { cacheScope: 'owner-a', opaqueCredential: 'vh_a' };
  const b = { cacheScope: 'owner-b', opaqueCredential: 'vh_b' };
  expect(petAuthorityGeneration('authenticated', a)).not.toBe(petAuthorityGeneration('public', null));
  expect(petAuthorityGeneration('authenticated', a)).not.toBe(petAuthorityGeneration('authenticated', b));
  expect(petAuthorityGeneration('authenticated', a)).not.toBe(petAuthorityGeneration('authenticated', { ...a, opaqueCredential: 'vh_a_new' }));
});
