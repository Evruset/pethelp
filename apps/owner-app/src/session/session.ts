export type SessionMaterial = Readonly<{
  opaqueCredential: string;
  cacheScope: string;
  expiresAtEpochMs: number;
}>;

export type SessionStatus = 'bootstrapping' | 'recovering' | 'transitioning' | 'public' | 'authenticated';
export type SessionError = 'SESSION_CLEANUP_FAILED' | 'SESSION_VALIDATION_UNAVAILABLE' | 'SESSION_REVOKE_UNCONFIRMED' | null;

export function isSessionMaterial(value: unknown): value is SessionMaterial {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SessionMaterial>;
  return typeof candidate.opaqueCredential === 'string'
    && candidate.opaqueCredential.trim() !== ''
    && typeof candidate.cacheScope === 'string'
    && candidate.cacheScope.trim() !== ''
    && typeof candidate.expiresAtEpochMs === 'number'
    && Number.isSafeInteger(candidate.expiresAtEpochMs)
    && candidate.expiresAtEpochMs > 0;
}

export function isExpiredSession(session: SessionMaterial, nowEpochMs = Date.now()): boolean {
  return session.expiresAtEpochMs <= nowEpochMs;
}
