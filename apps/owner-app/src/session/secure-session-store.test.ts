import * as SecureStore from 'expo-secure-store';

import { secureSessionStore } from './secure-session-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const secureStore = jest.mocked(SecureStore);

beforeEach(() => jest.clearAllMocks());

it('stores opaque session material only through SecureStore', async () => {
  const session = { opaqueCredential: 'opaque', cacheScope: 'scope', expiresAtEpochMs: 2_000 };
  await secureSessionStore.write(session);
  expect(secureStore.setItemAsync).toHaveBeenCalledWith('vethelp.owner.session.v1', JSON.stringify(session));
});

it.each(['not-json', JSON.stringify({ opaqueCredential: '', cacheScope: 'scope', expiresAtEpochMs: 2_000 })])(
  'deletes malformed or invalid stored session material',
  async (stored) => {
    secureStore.getItemAsync.mockResolvedValue(stored);
    await expect(secureSessionStore.read()).resolves.toBeNull();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('vethelp.owner.session.v1');
  },
);

it('clears the session storage key on logout', async () => {
  await secureSessionStore.clear();
  expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('vethelp.owner.session.v1');
});
