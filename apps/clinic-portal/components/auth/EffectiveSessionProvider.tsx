'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ClinicScope, EffectiveSession } from '@/lib/auth/effective-session';

type CapabilityState = {
  session: EffectiveSession | null;
  loading: boolean;
  error: boolean;
  hasCapability: (capability: string) => boolean;
  hasClinicScope: (clinicId: string, locationId: string) => boolean;
  clinicScopes: ClinicScope[];
  refresh: () => Promise<void>;
};

const CapabilityContext = createContext<CapabilityState | null>(null);

export function EffectiveSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<EffectiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      if (response.status === 403) {
        setSession(null);
        return;
      }
      if (!response.ok) throw new Error('SESSION_UNAVAILABLE');
      setSession(await response.json() as EffectiveSession);
    } catch {
      setSession(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const invalidate = () => void refresh();
    window.addEventListener('vethelp:session-changed', invalidate);
    return () => window.removeEventListener('vethelp:session-changed', invalidate);
  }, [refresh]);
  const value = useMemo<CapabilityState>(() => ({
    session, loading, error,
    hasCapability: (capability) => Boolean(session?.effectiveCapabilities.includes(capability)),
    hasClinicScope: (clinicId, locationId) => Boolean(session?.clinicScopes.some((scope) => scope.clinicId === clinicId && scope.locationId === locationId)),
    clinicScopes: session?.clinicScopes ?? [], refresh,
  }), [session, loading, error, refresh]);
  return <CapabilityContext.Provider value={value}>{children}</CapabilityContext.Provider>;
}

export function useEffectiveSession(): CapabilityState {
  const state = useContext(CapabilityContext);
  if (!state) throw new Error('useEffectiveSession must be used within EffectiveSessionProvider');
  return state;
}
