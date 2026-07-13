import type { ClinicSession } from '@/lib/auth/clinic-session';

export type ClinicScope = { clinicId: string; locationId: string };

export type EffectiveSession = {
  subjectId: string;
  roles: string[];
  effectiveCapabilities: string[];
  clinicScopes: ClinicScope[];
};

export class EffectiveSessionError extends Error {}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseEffectiveSession(payload: unknown): EffectiveSession {
  if (!payload || typeof payload !== 'object') throw new EffectiveSessionError('INVALID_SESSION_RESPONSE');
  const value = payload as Record<string, unknown>;
  const subjectId = asString(value.subjectId);
  if (!subjectId) throw new EffectiveSessionError('INVALID_SESSION_RESPONSE');
  const strings = (input: unknown) => Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : [];
  const clinicScopes = Array.isArray(value.clinicScopes)
    ? value.clinicScopes.flatMap((scope) => {
      if (!scope || typeof scope !== 'object') return [];
      const item = scope as Record<string, unknown>;
      const clinicId = asString(item.clinicId);
      const locationId = asString(item.locationId);
      return clinicId && locationId ? [{ clinicId, locationId }] : [];
    })
    : [];
  return { subjectId, roles: strings(value.roles), effectiveCapabilities: strings(value.effectiveCapabilities), clinicScopes };
}

function backendBaseUrl(): string {
  const baseUrl = process.env.VETHELP_API_BASE_URL;
  if (!baseUrl) throw new EffectiveSessionError('VETHELP_API_BASE_URL is not configured');
  return baseUrl.replace(/\/$/, '');
}

export async function getEffectiveSession(session: ClinicSession): Promise<EffectiveSession> {
  const response = await fetch(`${backendBaseUrl()}/v1/auth/session`, {
    headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new EffectiveSessionError(`SESSION_${response.status}`);
  return parseEffectiveSession(await response.json());
}

export function hasCapability(session: Pick<EffectiveSession, 'effectiveCapabilities'> | null, capability: string): boolean {
  return Boolean(session?.effectiveCapabilities.includes(capability));
}

export function hasClinicScope(session: Pick<EffectiveSession, 'clinicScopes'> | null, clinicId: string, locationId: string): boolean {
  return Boolean(session?.clinicScopes.some((scope) => scope.clinicId === clinicId && scope.locationId === locationId));
}
