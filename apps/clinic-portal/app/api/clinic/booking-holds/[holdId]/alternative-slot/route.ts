import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ holdId: string }> };

function baseUrl(): string {
  const value = process.env.VETHELP_API_BASE_URL;
  if (!value) throw new Error('VETHELP_API_BASE_URL is not configured');
  return value.replace(/\/$/, '');
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { holdId } = await context.params;
  const session = await getClinicSession();
  const allowed = session?.roles.includes('CLINIC_RECEPTIONIST') || session?.roles.includes('CLINIC_ADMIN');
  if (!session || !allowed || !UUID.test(holdId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null) as { newSlotId?: unknown } | null;
  if (!payload || typeof payload.newSlotId !== 'string' || !UUID.test(payload.newSlotId)) {
    return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const correlation = request.headers.get('X-Correlation-ID') ?? randomUUID();
  const idempotency = request.headers.get('Idempotency-Key') ?? randomUUID();
  try {
    const upstream = await fetch(`${baseUrl()}/v1/clinic/booking-holds/${holdId}/alternative-slot`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotency,
        'X-Correlation-ID': correlation,
      },
      body: JSON.stringify({ newSlotId: payload.newSlotId }),
      cache: 'no-store',
    });
    const body = await upstream.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));
    return NextResponse.json(body, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store', 'X-Correlation-ID': correlation },
    });
  } catch {
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503 });
  }
}
