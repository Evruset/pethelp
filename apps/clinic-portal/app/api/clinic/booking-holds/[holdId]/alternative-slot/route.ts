import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ holdId: string }>;
};

function backendBaseUrl(): string {
  const baseUrl = process.env.VETHELP_API_BASE_URL;
  if (!baseUrl) throw new Error('VETHELP_API_BASE_URL is not configured');
  return baseUrl.replace(/\/$/, '');
}

function requestUuid(value: string | null): string {
  return value && UUID.test(value) ? value : randomUUID();
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { holdId } = await context.params;
  const session = await getClinicSession();
  const permitted = session?.roles.includes('CLINIC_RECEPTIONIST') || session?.roles.includes('CLINIC_ADMIN');

  if (!session || !permitted || !UUID.test(holdId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { newSlotId?: unknown } | null;
  if (typeof body?.newSlotId !== 'string' || !UUID.test(body.newSlotId)) {
    return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const correlationId = requestUuid(request.headers.get('X-Correlation-ID'));

  try {
    const upstream = await fetch(`${backendBaseUrl()}/v1/clinic/booking-holds/${holdId}/alternative-slot`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify({ newSlotId: body.newSlotId }),
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Correlation-ID': correlationId,
      },
    });
  } catch {
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Correlation-ID': correlationId,
        },
      },
    );
  }
}
