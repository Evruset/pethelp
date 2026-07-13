import type { ReactNode } from 'react';
import { EffectiveSessionProvider } from '@/components/auth/EffectiveSessionProvider';

export default function VeterinarianRoutesLayout({ children }: { children: ReactNode }) {
  return <EffectiveSessionProvider>{children}</EffectiveSessionProvider>;
}
