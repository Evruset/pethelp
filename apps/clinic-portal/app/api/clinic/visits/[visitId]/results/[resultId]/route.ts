import { NextResponse } from 'next/server';
import { boundedText, CLINICAL_UUID, clinicalMutation, invalidClinicalRequest } from '@/lib/api/clinical-result-bff';

type RouteContext = { params: Promise<{ visitId: string; resultId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { visitId, resultId } = await context.params;
  if (!CLINICAL_UUID.test(visitId) || !CLINICAL_UUID.test(resultId)) return NextResponse.json({ code: 'CLINIC_SCOPE_MISMATCH' }, { status: 403 });
  const clinicalSummary = await boundedText(request, 'clinicalSummary');
  const version = request.headers.get('If-Match');
  if (clinicalSummary === null || !version || !/^\d+$/.test(version)) return invalidClinicalRequest();
  return clinicalMutation(request, `/v1/clinic/visits/${visitId}/results/${resultId}`, 'PATCH', { clinicalSummary }, { 'If-Match': version });
}
