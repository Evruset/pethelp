import * as SecureStore from 'expo-secure-store';

import { isSessionMaterial, type SessionMaterial } from './session';

const SESSION_STORAGE_KEY = 'vethelp.owner.session.v1';

export type SessionStore = Readonly<{
  read(): Promise<SessionMaterial | null>;
  write(session: SessionMaterial): Promise<void>;
  clear(): Promise<void>;
}>;

async function readRaw(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_STORAGE_KEY);
}

async function writeRaw(value: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, value);
}

async function clearRaw(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

export const secureSessionStore: SessionStore = {
  async read() {
    const stored = await readRaw();

    if (stored === null) return null;

    try {
      const candidate: unknown = JSON.parse(stored);

      if (isSessionMaterial(candidate)) {
        return candidate;
      }
    } catch {
      // Malformed local session material is treated as an invalid session.
    }

    await clearRaw();
    return null;
  },

  async write(session) {
    if (!isSessionMaterial(session)) {
      throw new Error('INVALID_SESSION_MATERIAL');
    }

    await writeRaw(JSON.stringify(session));
  },

  async clear() {
    await clearRaw();
  },
};
