import { NextResponse } from 'next/server';
import { isClinicPatientsRegistryEnabled } from '@/app/design-system/feature-flags';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability, hasClinicScope } from '@/lib/auth/effective-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ clinicId: string; locationId: string; patientId: string }> };
const safe = (code: string, status: number) => NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store, private' } });
function backend(): string {
  const value = process.env.VETHELP_API_BASE_URL;
  if (!value) throw new Error('VETHELP_API_BASE_URL is not configured');
  return value.replace(/\/$/, '');
}
export async function GET(request: Request, context: Context): Promise<NextResponse> {
  if (!isClinicPatientsRegistryEnabled()) return safe('NOT_FOUND', 404);
  if (request.headers.has('authorization')) return safe('AUTH_REQUIRED', 401);
  const { clinicId, locationId, patientId } = await context.params;
  const session = await getClinicSession();
  if (!session) return safe('AUTH_REQUIRED', 401);
  if (!UUID.test(clinicId) || !UUID.test(locationId) || !canAccessClinicLocation(session, clinicId, locationId)) return safe('LOCATION_SCOPE_DENIED', 403);
  if (!UUID.test(patientId)) return safe('PATIENT_UNAVAILABLE', 404);
  try {
    const effective = await getEffectiveSession(session);
    if (!hasCapability(effective, 'patient.admin.read') || !hasClinicScope(effective, clinicId, locationId)) return safe('LOCATION_SCOPE_DENIED', 403);
    const upstream = `${backend()}/v1/clinic/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/patients/${encodeURIComponent(patientId)}`;
    const response = await fetch(upstream, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
      cache: 'no-store', signal: request.signal,
    });
    if (!response.ok) {
      return safe(response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'LOCATION_SCOPE_DENIED'
        : response.status === 404 ? 'PATIENT_UNAVAILABLE' : response.status === 503 ? 'PATIENT_POLICY_UNAVAILABLE'
          : 'PATIENT_DETAIL_UNAVAILABLE', response.status);
    }
    const payload = await response.json().catch(() => null);
    return payload === null ? safe('PATIENT_DETAIL_UNAVAILABLE', 502)
      : NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return safe('PATIENT_DETAIL_UNAVAILABLE', 502);
  }
}
