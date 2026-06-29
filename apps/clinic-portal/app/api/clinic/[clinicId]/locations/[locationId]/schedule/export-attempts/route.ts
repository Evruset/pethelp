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

function validBody(value: unknown): { format: 'JSON' | 'CSV'; scope: 'SCHEDULE' | 'SLOTS'; rowsCount: number } | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { format?: unknown; scope?: unknown; rowsCount?: unknown };
  const format = body.format === 'JSON' || body.format === 'CSV' ? body.format : null;
  const scope = body.scope === 'SCHEDULE' || body.scope === 'SLOTS' ? body.scope : null;
  const rowsCount = typeof body.rowsCount === 'number' ? body.rowsCount : Number(body.rowsCount);
  if (!format || !scope || !Number.isInteger(rowsCount) || rowsCount < 0 || rowsCount > 100_000) return null;
  return { format, scope, rowsCount };
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId } = await context.params;
  const session = await getClinicSession();
  if (!session || !UUID.test(clinicId) || !UUID.test(locationId) || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const body = validBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });

  const correlationId = request.headers.get('X-Correlation-ID')?.match(UUID)?.[0] ?? randomUUID();
  try {
    const upstream = await fetch(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/schedule/export-attempts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store', 'X-Correlation-ID': correlationId },
    });
  } catch {
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Correlation-ID': correlationId } },
    );
  }
}
