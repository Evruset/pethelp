import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ locationId: string }>;
};

function backendBaseUrl(): string {
  const baseUrl = process.env.VETHELP_API_BASE_URL;
  if (!baseUrl) throw new Error('VETHELP_API_BASE_URL is not configured');
  return baseUrl.replace(/\/$/, '');
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { locationId } = await context.params;
  const session = await getClinicSession();
  const permitted = session?.roles.includes('CLINIC_RECEPTIONIST') || session?.roles.includes('CLINIC_ADMIN');

  if (!session || !permitted || !session.locationIds.includes(locationId) || !UUID.test(locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const upstream = new URL(`${backendBaseUrl()}/v1/clinic-locations/${locationId}/slots`);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from) upstream.searchParams.set('from', from);
  if (to) upstream.searchParams.set('to', to);

  try {
    const response = await fetch(upstream, {
      headers: { Accept: 'application/json' },
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
