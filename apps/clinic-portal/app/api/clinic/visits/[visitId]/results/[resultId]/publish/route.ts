import { NextResponse } from 'next/server';
import { CLINICAL_UUID, clinicalMutation } from '@/lib/api/clinical-result-bff';

type RouteContext = { params: Promise<{ visitId: string; resultId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { visitId, resultId } = await context.params;
  if (!CLINICAL_UUID.test(visitId) || !CLINICAL_UUID.test(resultId)) return NextResponse.json({ code: 'CLINIC_SCOPE_MISMATCH' }, { status: 403 });
  return clinicalMutation(request, `/v1/clinic/visits/${visitId}/results/${resultId}/publish`, 'POST', undefined);
}
