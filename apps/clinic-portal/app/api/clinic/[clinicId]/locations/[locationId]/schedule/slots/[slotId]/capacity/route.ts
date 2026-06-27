import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ clinicId: string; locationId: string; slotId: string }>;
};

function backendBaseUrl(): string {
  const baseUrl = process.env.VETHELP_API_BASE_URL;
  if (!baseUrl) throw new Error('VETHELP_API_BASE_URL is not configured');
  return baseUrl.replace(/\/$/, '');
}

function requiredUuid(value: string | null): string | null {
  return value && UUID.test(value) ? value : null;
}

function requiredVersion(value: string | null): string | null {
  const normalized = value?.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  if (!normalized || !/^[1-9][0-9]*$/.test(normalized)) return null;
  return normalized;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId, slotId } = await context.params;
  const session = await getClinicSession();
  if (!session || !UUID.test(clinicId) || !UUID.test(locationId) || !UUID.test(slotId) || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const idempotencyKey = requiredUuid(request.headers.get('Idempotency-Key'));
  const correlationId = requiredUuid(request.headers.get('X-Correlation-ID')) ?? randomUUID();
  const ifMatch = requiredVersion(request.headers.get('If-Match'));
  if (!idempotencyKey || !ifMatch) {
    return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as { capacity?: unknown } | null;
  const capacity = typeof body?.capacity === 'number' ? body.capacity : Number(body?.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
    return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/schedule/slots/${slotId}/capacity`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'If-Match': ifMatch,
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify({ capacity }),
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
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Correlation-ID': correlationId } },
    );
  }
}
