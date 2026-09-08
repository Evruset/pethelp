import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { isExpiredSession, isSessionMaterial, type SessionError, type SessionMaterial, type SessionStatus } from './session';
import { removeOwnerSessionQueries } from './session-query-cache';
import { secureSessionStore, type SessionStore } from './secure-session-store';
import { sessionAuthority, type SessionAuthority } from './session-authority';
import { ApiError } from '@/api/errors';

type SessionContextValue = Readonly<{
  status: SessionStatus;
  session: SessionMaterial | null;
  error: SessionError;
  establishSession(session: SessionMaterial): Promise<void>;
  logout(): Promise<boolean>;
  retryValidation(): Promise<void>;
}>;

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionProviderProps = PropsWithChildren<{
  store?: SessionStore;
  now?: () => number;
  authority?: SessionAuthority;
}>;

export function SessionProvider({ children, store = secureSessionStore, now = Date.now, authority = sessionAuthority }: SessionProviderProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('bootstrapping');
  const [session, setSession] = useState<SessionMaterial | null>(null);
  const [error, setError] = useState<SessionError>(null);
  const transitionInProgress = useRef(false);
  const generation = useRef(0);
  const recoverySession = useRef<SessionMaterial|null>(null);

  const clearSession = useCallback(async (stored:SessionMaterial,expectedGeneration:number,errorValue:SessionError=null) => {
    if(generation.current!==expectedGeneration || transitionInProgress.current) return;
    transitionInProgress.current=true;
    try {
      try { await store.clear(); } catch { errorValue='SESSION_CLEANUP_FAILED'; }
      if(generation.current!==expectedGeneration) return;
      removeOwnerSessionQueries(queryClient,stored.cacheScope);
      setSession(null); setError(errorValue); setStatus('public');
    } finally {
      transitionInProgress.current=false;
    }
  },[queryClient,store]);

  const validateStored = useCallback(async(stored:SessionMaterial,expectedGeneration:number)=>{
    try {
      const effective=await authority.validate(stored.opaqueCredential);
      if(generation.current!==expectedGeneration) return;
      const validated={...stored,cacheScope:effective.subjectId};
      if(validated.cacheScope!==stored.cacheScope) removeOwnerSessionQueries(queryClient,stored.cacheScope);
      recoverySession.current=null; setSession(validated); setError(null); setStatus('authenticated');
    } catch(error) {
      if(generation.current!==expectedGeneration) return;
      if(error instanceof ApiError && error.kind==='UNAUTHORIZED') { recoverySession.current=null; await clearSession(stored,expectedGeneration); return; }
      recoverySession.current=stored; setSession(null); setError('SESSION_VALIDATION_UNAVAILABLE'); setStatus('recovering');
    }
  },[authority,clearSession,queryClient]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await store.read();
        if (!active) return;
        if (stored === null) {
          setSession(null);
          setStatus('public');
          return;
        }
        if (!isSessionMaterial(stored)) {
          await store.clear();
          if (!active) return;
          setSession(null);
          setStatus('public');
          return;
        }
        if (isExpiredSession(stored, now())) {
          try {
            await store.clear();
          } catch {
            if (active) setError('SESSION_CLEANUP_FAILED');
          } finally {
            if (active) {
              removeOwnerSessionQueries(queryClient, stored.cacheScope);
              setSession(null);
              setStatus('public');
            }
          }
          return;
        }
        const expected=++generation.current;
        await validateStored(stored,expected);
      } catch {
        if (!active) return;
        setSession(null);
        setStatus('public');
      }
    })();
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [clearSession, now, queryClient, store, validateStored]);

  const retryValidation=useCallback(async()=>{
    const stored=recoverySession.current; if(!stored||transitionInProgress.current)return;
    setStatus('bootstrapping'); const expected=++generation.current; await validateStored(stored,expected);
  },[validateStored]);

  const expireSession = useCallback(async (expiredSession: SessionMaterial) => {
    if (transitionInProgress.current) return;
    transitionInProgress.current = true;
    setStatus('transitioning');
    try {
      await store.clear();
      setError(null);
    } catch {
      setError('SESSION_CLEANUP_FAILED');
    } finally {
      removeOwnerSessionQueries(queryClient, expiredSession.cacheScope);
      transitionInProgress.current = false;
      setSession(null);
      setStatus('public');
    }
  }, [queryClient, store]);

  useEffect(() => {
    if (status !== 'authenticated' || session === null) return undefined;

    // Keep timer delays comfortably below the ~2^31-1 ms limit used by
    // JavaScript runtimes. Owner sessions may live longer than that.
    const MAX_EXPIRY_TIMER_MS = 24 * 60 * 60 * 1000;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const scheduleExpiryCheck = () => {
      if (!active) return;

      const remainingMs = session.expiresAtEpochMs - now();

      if (remainingMs <= 0) {
        void expireSession(session);
        return;
      }

      timeout = setTimeout(
        scheduleExpiryCheck,
        Math.min(remainingMs, MAX_EXPIRY_TIMER_MS),
      );
    };

    scheduleExpiryCheck();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        nextState === 'active'
        && isExpiredSession(session, now())
      ) {
        void expireSession(session);
      }
    });

    return () => {
      active = false;
      if (timeout !== undefined) clearTimeout(timeout);
      subscription.remove();
    };
  }, [expireSession, now, session, status]);

  const establishSession = useCallback(async (nextSession: SessionMaterial) => {
    if (transitionInProgress.current) throw new Error('SESSION_TRANSITION_IN_PROGRESS');
    transitionInProgress.current = true;
    if (!isSessionMaterial(nextSession) || isExpiredSession(nextSession, now())) {
      try {
        await store.clear();
        transitionInProgress.current = false;
        setSession(null);
        setStatus('public');
      } finally {
        transitionInProgress.current = false;
      }
      throw new Error('INVALID_SESSION_MATERIAL');
    }
    generation.current += 1;
    try {
      await store.write(nextSession);
      transitionInProgress.current = false;
      setSession(nextSession);
      setError(null);
      setStatus('authenticated');
    } finally {
      transitionInProgress.current = false;
    }
  }, [now, store]);

  const logout = useCallback(async () => {
    if (transitionInProgress.current || session === null) return false;
    transitionInProgress.current = true;
    const current=session; const cacheScope = current.cacheScope;
    generation.current+=1;
    setStatus('transitioning');
    try {
      let revokeUnconfirmed=false;
      try { await authority.revoke(current.opaqueCredential); } catch(error) {
        if(!(error instanceof ApiError&&error.kind==='UNAUTHORIZED')) revokeUnconfirmed=true;
      }
      await store.clear();
      if (cacheScope) removeOwnerSessionQueries(queryClient, cacheScope);
      transitionInProgress.current = false;
      setSession(null);
      setError(revokeUnconfirmed?'SESSION_REVOKE_UNCONFIRMED':null);
      setStatus('public');
      return true;
    } catch {
      transitionInProgress.current = false;
      setError('SESSION_CLEANUP_FAILED');
      removeOwnerSessionQueries(queryClient,cacheScope);
      setSession(null);
      setStatus('public');
      return false;
    }
  }, [authority, queryClient, session, store]);

  const value = useMemo<SessionContextValue>(() => ({ status, session, error, establishSession, logout, retryValidation }), [error, establishSession, logout, retryValidation, session, status]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) throw new Error('useSession must be used within SessionProvider');
  return context;
}
