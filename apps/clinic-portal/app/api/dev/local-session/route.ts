import { NextResponse } from 'next/server';
import { CLINIC_SESSION_COOKIE, verifyClinicSessionToken } from '@/lib/auth/clinic-session';

function devSessionEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.VETHELP_ALLOW_DEV_SESSION === 'true';
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!devSessionEnabled()) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  if (typeof body?.token !== 'string' || body.token.length < 32) {
    return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const session = await verifyClinicSessionToken(body.token);
  const hasStaffRole = session?.roles.includes('CLINIC_RECEPTIONIST') || session?.roles.includes('CLINIC_ADMIN');
  if (!session || !hasStaffRole || session.clinicIds.length === 0 || session.locationIds.length === 0) {
    return NextResponse.json({ code: 'INVALID_LOCAL_SESSION' }, { status: 401 });
  }

  const response = NextResponse.json({
    clinicId: session.clinicIds[0],
    locationId: session.locationIds[0],
  });
  response.cookies.set({
    name: CLINIC_SESSION_COOKIE,
    value: body.token,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  if (!devSessionEnabled()) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({ name: CLINIC_SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}
