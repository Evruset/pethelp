import * as SecureStore from 'expo-secure-store';

const KEY = 'vethelp.owner.active-booking.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredBooking = Readonly<{ cacheScope: string; holdId: string }>;
type Store = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync'>;

const valid = (value: unknown): value is StoredBooking => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join() === 'cacheScope,holdId' && UUID.test(String(item.cacheScope)) && UUID.test(String(item.holdId));
};

export function createActiveBookingStore(store: Store = SecureStore) {
  return {
    async read(cacheScope: string): Promise<string | null> {
      if (!UUID.test(cacheScope)) return null;
      try {
        const raw = await store.getItemAsync(KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return valid(parsed) && parsed.cacheScope === cacheScope ? parsed.holdId : null;
      } catch {
        return null;
      }
    },
    async write(cacheScope: string, holdId: string): Promise<void> {
      if (!UUID.test(cacheScope) || !UUID.test(holdId)) throw new Error('INVALID_ACTIVE_BOOKING_REFERENCE');
      await store.setItemAsync(KEY, JSON.stringify({ cacheScope, holdId } satisfies StoredBooking));
    },
  };
}

export const activeBookingStore = createActiveBookingStore();
