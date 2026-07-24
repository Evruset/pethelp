import { NextResponse } from 'next/server';
import { isClinicPatientsRegistryEnabled } from '@/app/design-system/feature-flags';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability, hasClinicScope } from '@/lib/auth/effective-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ clinicId: string; locationId: string }> };
const safe = (code: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store, private', ...headers } });

function backendBaseUrl(): string {
  const value = process.env.VETHELP_API_BASE_URL;
  if (!value) throw new Error('VETHELP_API_BASE_URL is not configured');
  return value.replace(/\/$/, '');
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!isClinicPatientsRegistryEnabled()) return safe('NOT_FOUND', 404);
  const { clinicId, locationId } = await context.params;
  const session = await getClinicSession();
  if (!session || !UUID.test(clinicId) || !UUID.test(locationId)
    || !canAccessClinicLocation(session, clinicId, locationId)) return safe('LOCATION_SCOPE_DENIED', 403);
  try {
    const effective = await getEffectiveSession(session);
    if (!hasCapability(effective, 'patient.admin.read') || !hasClinicScope(effective, clinicId, locationId)) {
      return safe('LOCATION_SCOPE_DENIED', 403);
    }
  } catch {
    return safe('SESSION_UNAVAILABLE', 503);
  }

  const incoming = new URL(request.url);
  const q = incoming.searchParams.get('q');
  const limit = incoming.searchParams.get('limit') ?? '50';
  const cursor = incoming.searchParams.get('cursor');
  const normalized = q?.normalize('NFKC').trim();
  const qLength = normalized ? Array.from(normalized).length : 0;
  if (!/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit)
    || (q !== null && (qLength < 2 || qLength > 80))) return safe('INVALID_PATIENTS_REGISTRY_QUERY', 400);

  const upstream = new URL(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/patients`);
  upstream.searchParams.set('limit', limit);
  if (normalized) upstream.searchParams.set('q', normalized);
  if (cursor) upstream.searchParams.set('cursor', cursor);
  try {
    const response = await fetch(upstream, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: request.signal,
    });
    if (!response.ok) {
      const retryAfter = response.headers.get('Retry-After');
      return safe(
        response.status === 429 ? 'PATIENTS_SEARCH_RATE_LIMITED'
          : response.status === 503 ? 'PATIENTS_UNAVAILABLE'
            : response.status === 400 ? 'INVALID_PATIENTS_REGISTRY_QUERY'
              : response.status === 403 ? 'LOCATION_SCOPE_DENIED' : 'BACKEND_UNAVAILABLE',
        response.status,
        retryAfter ? { 'Retry-After': retryAfter } : undefined,
      );
    }
    return NextResponse.json(await response.json().catch(() => null), {
      status: 200,
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch {
    return safe('BACKEND_UNAVAILABLE', 503);
  }
}
