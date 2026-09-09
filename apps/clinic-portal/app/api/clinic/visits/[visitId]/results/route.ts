import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';
import { boundedText, clinicalMutation, idempotencyKey, invalidClinicalRequest } from '@/lib/api/clinical-result-bff';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ visitId: string }> };

function backendBaseUrl(): string { return (process.env.VETHELP_API_BASE_URL ?? '').replace(/\/$/, ''); }
function denied() { return NextResponse.json({ code: 'CLINIC_SCOPE_MISMATCH' }, { status: 403, headers: { 'Cache-Control': 'no-store' } }); }

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { visitId } = await context.params;
  const session = await getClinicSession();
  if (!session || !session.roles.includes('CLINIC_VETERINARIAN') || !UUID.test(visitId)) return denied();
  try {
    const response = await fetch(`${backendBaseUrl()}/v1/clinic/visits/${visitId}/results`, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({ code: 'BACKEND_UNAVAILABLE' }));
    return NextResponse.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { visitId } = await context.params;
  if (!UUID.test(visitId)) return denied();
  const clinicalSummary = await boundedText(request, 'clinicalSummary');
  if (clinicalSummary === null) return invalidClinicalRequest();
  return clinicalMutation(request, `/v1/clinic/visits/${visitId}/results`, 'POST', { clinicalSummary }, { 'Idempotency-Key': idempotencyKey(request) });
}
