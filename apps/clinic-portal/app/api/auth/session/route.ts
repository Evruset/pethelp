import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';
import { EffectiveSessionError, getEffectiveSession } from '@/lib/auth/effective-session';

export async function GET(): Promise<NextResponse> {
  const session = await getClinicSession();
  if (!session) return NextResponse.json({ code: 'SESSION_REQUIRED' }, { status: 401 });
  try {
    return NextResponse.json(await getEffectiveSession(session), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof EffectiveSessionError && error.message === 'SESSION_403' ? 403 : 503;
    return NextResponse.json({ code: status === 403 ? 'SESSION_DENIED' : 'SESSION_UNAVAILABLE' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
