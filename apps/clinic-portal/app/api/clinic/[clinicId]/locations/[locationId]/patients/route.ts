import { NextResponse } from 'next/server';
import {
  isClinicPatientAdminReferenceSearchEnabled,
  isClinicPatientsRegistryEnabled,
} from '@/app/design-system/feature-flags';
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
  const administrativeReference = incoming.searchParams.get('administrativeReference');
  const limit = incoming.searchParams.get('limit') ?? '50';
  const cursor = incoming.searchParams.get('cursor');
  const normalized = q?.normalize('NFKC').trim();
  const normalizedReference = administrativeReference?.normalize('NFC').trim().replace(/ {2,}/g, ' ');
  const qLength = normalized ? Array.from(normalized).length : 0;
  const referenceLength = normalizedReference ? Array.from(normalizedReference).length : 0;
  const referenceValid = normalizedReference !== undefined && normalizedReference !== null
    && referenceLength >= 1 && referenceLength <= 40
    && /^[\p{L}\p{Nd}._/ -]+$/u.test(normalizedReference)
    && !/[\u0000-\u001F\u007F]/u.test(normalizedReference);
  if (administrativeReference !== null && !isClinicPatientAdminReferenceSearchEnabled()) {
    return safe('ADMINISTRATIVE_REFERENCE_SEARCH_UNAVAILABLE', 404);
  }
  if (!/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit)
    || (q !== null && (qLength < 2 || qLength > 80))
    || (administrativeReference !== null && (!referenceValid || q !== null || cursor !== null))) {
    return safe(
      administrativeReference !== null ? 'INVALID_ADMINISTRATIVE_REFERENCE_QUERY' : 'INVALID_PATIENTS_REGISTRY_QUERY',
      400,
    );
  }

  const upstream = new URL(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/patients`);
  upstream.searchParams.set('limit', limit);
  if (normalized) upstream.searchParams.set('q', normalized);
  if (normalizedReference) upstream.searchParams.set('administrativeReference', normalizedReference);
  if (cursor) upstream.searchParams.set('cursor', cursor);
  try {
    const response = await fetch(upstream, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: request.signal,
    });
    if (!response.ok) {
      const retryAfter = response.headers.get('Retry-After');
      const body = await response.json().catch(() => null) as { code?: unknown } | null;
      const upstreamCode = typeof body?.code === 'string' ? body.code : undefined;
      return safe(
        response.status === 429 ? 'PATIENTS_SEARCH_RATE_LIMITED'
          : upstreamCode === 'SEARCH_INVARIANT_VIOLATION' ? 'SEARCH_INVARIANT_VIOLATION'
            : upstreamCode === 'INVALID_SEARCH_COMBINATION' ? 'INVALID_SEARCH_COMBINATION'
              : upstreamCode === 'INVALID_ADMINISTRATIVE_REFERENCE_QUERY' ? 'INVALID_ADMINISTRATIVE_REFERENCE_QUERY'
                : upstreamCode === 'ADMINISTRATIVE_REFERENCE_SEARCH_UNAVAILABLE' ? 'ADMINISTRATIVE_REFERENCE_SEARCH_UNAVAILABLE'
          : response.status === 503 && administrativeReference !== null
            ? 'PATIENTS_UNAVAILABLE'
            : response.status === 503 ? 'PATIENTS_UNAVAILABLE'
            : response.status === 400 && administrativeReference !== null ? 'INVALID_ADMINISTRATIVE_REFERENCE_QUERY'
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
