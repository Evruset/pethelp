import { NextResponse } from 'next/server';
import { boundedText, CLINICAL_UUID, clinicalMutation, idempotencyKey, invalidClinicalRequest } from '@/lib/api/clinical-result-bff';

type RouteContext = { params: Promise<{ visitId: string; resultId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { visitId, resultId } = await context.params;
  if (!CLINICAL_UUID.test(visitId) || !CLINICAL_UUID.test(resultId)) return NextResponse.json({ code: 'CLINIC_SCOPE_MISMATCH' }, { status: 403 });
  const content = await boundedText(request, 'content');
  if (content === null) return invalidClinicalRequest();
  return clinicalMutation(request, `/v1/clinic/visits/${visitId}/results/${resultId}/amendments`, 'POST', { content }, { 'Idempotency-Key': idempotencyKey(request) });
}
