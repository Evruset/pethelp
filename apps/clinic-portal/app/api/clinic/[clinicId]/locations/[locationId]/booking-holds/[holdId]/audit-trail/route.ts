import { NextResponse } from 'next/server';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ clinicId: string; locationId: string; holdId: string }>;
};

function backendBaseUrl(): string {
  const baseUrl = process.env.VETHELP_API_BASE_URL;
  if (!baseUrl) throw new Error('VETHELP_API_BASE_URL is not configured');
  return baseUrl.replace(/\/$/, '');
}

function parseLimit(value: string | null): string {
  const parsed = value ? Number.parseInt(value, 10) : 50;
  if (!Number.isSafeInteger(parsed) || parsed < 1) return '50';
  return String(Math.min(parsed, 100));
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId, holdId } = await context.params;
  const session = await getClinicSession();

  if (!session || !UUID.test(clinicId) || !UUID.test(locationId) || !UUID.test(holdId) || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const url = new URL(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/booking-holds/${holdId}/audit-trail`);
  url.searchParams.set('limit', parseLimit(new URL(request.url).searchParams.get('limit')));

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
