import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ clinicId: string; locationId: string }>;
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
  const { clinicId, locationId } = await context.params;
  const session = await getClinicSession();
  if (!session || !UUID.test(clinicId) || !UUID.test(locationId) || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const idempotencyKey = requiredUuid(request.headers.get('Idempotency-Key'));
  const correlationId = requiredUuid(request.headers.get('X-Correlation-ID')) ?? randomUUID();
  if (!idempotencyKey) return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });

  const body = await request.json().catch(() => null) as { slots?: unknown } | null;
  if (!Array.isArray(body?.slots)) return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });

  try {
    const upstream = await fetch(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/schedule/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify({ slots: body.slots }),
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));
    return NextResponse.json(payload, { status: upstream.status, headers: { 'Cache-Control': 'no-store', 'X-Correlation-ID': correlationId } });
  } catch {
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Correlation-ID': correlationId } });
  }
}
