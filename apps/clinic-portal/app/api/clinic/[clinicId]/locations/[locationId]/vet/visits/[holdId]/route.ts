import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ clinicId: string; locationId: string; holdId: string }> };

function backendBaseUrl(): string { return (process.env.VETHELP_API_BASE_URL ?? '').replace(/\/$/, ''); }
function denied() { return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403, headers: { 'Cache-Control': 'no-store' } }); }

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId, holdId } = await context.params;
  const session = await getClinicSession();
  if (!session || !UUID.test(clinicId) || !UUID.test(locationId) || !UUID.test(holdId)) return denied();
  try {
    const response = await fetch(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/vet/visits/${holdId}`, { headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));
    return NextResponse.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
