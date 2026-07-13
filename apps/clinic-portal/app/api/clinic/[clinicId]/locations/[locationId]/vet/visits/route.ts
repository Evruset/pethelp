import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';

type RouteContext = { params: Promise<{ clinicId: string; locationId: string }> };

function backendBaseUrl(): string { return (process.env.VETHELP_API_BASE_URL ?? '').replace(/\/$/, ''); }
function denied() { return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403, headers: { 'Cache-Control': 'no-store' } }); }

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId } = await context.params;
  const session = await getClinicSession();
  if (!session) return denied();
  try {
    const upstream = new URL(`/v1/clinic/${clinicId}/locations/${locationId}/vet/visits`, backendBaseUrl());
    const response = await fetch(upstream, { headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }, cache: 'no-store' });
    let payload: unknown;
    try { payload = await response.json(); } catch { return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
    return NextResponse.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
