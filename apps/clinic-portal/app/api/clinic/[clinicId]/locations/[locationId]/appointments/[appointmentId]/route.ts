import { NextResponse } from 'next/server';
import { isClinicAppointmentsRegistryEnabled } from '@/app/design-system/feature-flags';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability, hasClinicScope } from '@/lib/auth/effective-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ clinicId: string; locationId: string; appointmentId: string }> };

function backendBaseUrl(): string {
  const value = process.env.VETHELP_API_BASE_URL;
  if (!value) throw new Error('VETHELP_API_BASE_URL is not configured');
  return value.replace(/\/$/, '');
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  if (!isClinicAppointmentsRegistryEnabled()) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  const { clinicId, locationId, appointmentId } = await context.params;
  const session = await getClinicSession();
  if (!session || !UUID.test(clinicId) || !UUID.test(locationId) || !UUID.test(appointmentId)
    || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }
  try {
    const effective = await getEffectiveSession(session);
    if (!hasCapability(effective, 'appointment.registry.read') || !hasClinicScope(effective, clinicId, locationId)) {
      return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
    }
    const upstream = `${backendBaseUrl()}/v1/clinic/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/appointments/${encodeURIComponent(appointmentId)}`;
    const response = await fetch(upstream, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      const code = response.status === 403 || response.status === 404
        ? 'APPOINTMENT_UNAVAILABLE'
        : response.status >= 500 ? 'BACKEND_UNAVAILABLE' : 'UPSTREAM_ERROR';
      return NextResponse.json({ code }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
    }
    const payload = await response.json().catch(() => null);
    if (payload === null) {
      return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
