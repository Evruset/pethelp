import { NextResponse } from 'next/server';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { isClinicAppointmentsRegistryEnabled } from '@/app/design-system/feature-flags';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ clinicId: string; locationId: string }> };

function backendBaseUrl(): string {
  const value = process.env.VETHELP_API_BASE_URL;
  if (!value) throw new Error('VETHELP_API_BASE_URL is not configured');
  return value.replace(/\/$/, '');
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!isClinicAppointmentsRegistryEnabled()) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  const { clinicId, locationId } = await context.params;
  const session = await getClinicSession();
  if (!session || !UUID.test(clinicId) || !UUID.test(locationId)
    || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const incoming = new URL(request.url);
  const bucket = incoming.searchParams.get('bucket');
  const limit = incoming.searchParams.get('limit') ?? '50';
  const cursor = incoming.searchParams.get('cursor');
  if ((bucket !== 'upcoming' && bucket !== 'history') || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit)) {
    return NextResponse.json({ code: 'INVALID_APPOINTMENT_REGISTRY_QUERY' }, { status: 400 });
  }

  const upstream = new URL(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/appointments`);
  upstream.searchParams.set('bucket', bucket);
  upstream.searchParams.set('limit', limit);
  if (cursor) upstream.searchParams.set('cursor', cursor);
  try {
    const response = await fetch(upstream, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));
    return NextResponse.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
