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

function requiredUuid(value: string | null): string | null {
  return value && UUID.test(value) ? value : null;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { holdId } = await context.params;
  const session = await getClinicSession();
  const permitted = session?.roles.includes('CLINIC_ADMIN') || session?.roles.includes('CLINIC_VETERINARIAN');

  if (!session || !permitted || !UUID.test(holdId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const correlationId = requiredUuid(request.headers.get('X-Correlation-ID')) ?? randomUUID();
  const payload = await request.json().catch(() => ({}));
  const summary = typeof payload.summary === 'string' ? payload.summary : '';
  if (summary.trim().length < 3) {
    return NextResponse.json({ code: 'INVALID_CLINICAL_SUMMARY' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${backendBaseUrl()}/v1/clinic/booking-holds/${holdId}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify({ summary }),
      cache: 'no-store',
    });
    const upstreamPayload = await upstream.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));

    return NextResponse.json(upstreamPayload, {
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
