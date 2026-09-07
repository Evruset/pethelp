import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { BookingStatusScreen } from '@/booking/BookingStatusScreen';
import { useSession } from '@/session/SessionProvider';
import { StateMessage } from '@/ui/primitives';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function BookingStatusRoute() {
  const router = useRouter();
  const { holdId } = useLocalSearchParams<{ holdId?: string | string[] }>();
  const { session } = useSession();
  const resolved = Array.isArray(holdId) ? holdId[0] : holdId;
  if (!session) return <Redirect href="/(public)" />;
  if (!resolved || !UUID.test(resolved)) return <StateMessage kind="error" title="Ссылка на запись недействительна." />;
  return <BookingStatusScreen holdId={resolved} authorityGeneration={`${session.cacheScope}:${session.opaqueCredential}`} onClose={() => router.replace('/')} />;
}
