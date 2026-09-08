import { NextRequest, NextResponse } from 'next/server';
import { isPilotProductPath, resolveMvpProductScope } from '@/lib/config/mvp-product-scope';

const SESSION_COOKIE = 'vethelp_clinic_session';

export function proxy(request: NextRequest): NextResponse {
  if (resolveMvpProductScope() === 'PILOT_V1' && !isPilotProductPath(request.nextUrl.pathname)) {
    return new NextResponse('Not Found', { status: 404 });
  }
  if (!/^\/(?:clinics|api\/clinic)(?:\/|$)/.test(request.nextUrl.pathname)) return NextResponse.next();
  if (/^\/api\/clinic\/[0-9a-f-]+\/locations\/[0-9a-f-]+\/workspace-home$/i.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const forbidden = new URL('/forbidden', request.url);
  forbidden.searchParams.set('reason', 'session_required');
  return NextResponse.redirect(forbidden);
}

export const config = {
  matcher: ['/clinics/:path*', '/api/clinic/:path*', '/telemed/:path*', '/api/telemed/:path*'],
};
