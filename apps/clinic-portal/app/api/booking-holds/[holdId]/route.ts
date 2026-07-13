import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ holdId: string }> };

function backendBaseUrl(): string {
  const baseUrl = process.env.VETHELP_API_BASE_URL;
  if (!baseUrl) throw new Error('VETHELP_API_BASE_URL is not configured');
  return baseUrl.replace(/\/$/, '');
}

export async function GET(_: Request, context: RouteContext): Promise<NextResponse> {
  const { holdId } = await context.params;
  const session = await getClinicSession();
  if (!session || !UUID.test(holdId)) return NextResponse.json({ code: 'REQUEST_DENIED' }, { status: 403 });
  try {
    const upstream = await fetch(`${backendBaseUrl()}/v1/booking-holds/${holdId}`, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }, cache: 'no-store',
    });
    if (!upstream.ok) return NextResponse.json({ code: 'HOLD_UNAVAILABLE' }, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
    const payload: unknown = await upstream.json().catch(() => null);
    return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
