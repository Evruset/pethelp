import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'vethelp_clinic_session';

export function proxy(request: NextRequest): NextResponse {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const forbidden = new URL('/forbidden', request.url);
  forbidden.searchParams.set('reason', 'session_required');
  return NextResponse.redirect(forbidden);
}

export const config = {
  matcher: [
    '/clinics/:path*',
    '/api/clinic/:path*',
  ],
};
