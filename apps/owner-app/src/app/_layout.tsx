import { AppProviders } from '@/query/AppProviders';
import type { ReactNode } from 'react';
import { SessionNavigation } from '@/session/SessionNavigation';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { AuthJourneyProvider } from '@/auth/AuthJourneyProvider';
import { PetJourneyProvider } from '@/pets/PetJourneyProvider';
import Head from 'expo-router/head';
import { OWNER_WEB_DOCUMENT_TITLE } from './+html';

export function petAuthorityGeneration(status: string, session: { cacheScope: string; opaqueCredential: string } | null) {
  return status === 'authenticated' && session ? `${session.cacheScope}:${session.opaqueCredential}` : status;
}
export function AuthorityScopedPetJourney({ children }: { children: ReactNode }) {
  const { status, session } = useSession();
  const authorityGeneration = petAuthorityGeneration(status, session);
  return <PetJourneyProvider key={authorityGeneration}>{children}</PetJourneyProvider>;
}

export default function RootLayout() {
  return (
    <>
      <Head><title>{OWNER_WEB_DOCUMENT_TITLE}</title></Head>
      <AppProviders>
      <SessionProvider>
        <AuthJourneyProvider>
          <AuthorityScopedPetJourney><SessionNavigation /></AuthorityScopedPetJourney>
        </AuthJourneyProvider>
      </SessionProvider>
      </AppProviders>
    </>
  );
}
