import { NextResponse } from 'next/server';
import { updateTelemedCaseWorkspace } from '@/lib/api/telemed-vet';
import { backendErrorResponse, requireTelemedVeterinarian } from '../../../_shared';

type Context = { params: Promise<{ caseId: string }> };

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const auth = await requireTelemedVeterinarian();
  if (!auth.ok) return auth.response;
  const { caseId } = await context.params;
  const body = await request.json().catch(() => null) as {
    safetyEscalation?: boolean;
    recommendationText?: string;
    followUpNotes?: string;
  } | null;
  if (!body) return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
  try {
    return NextResponse.json(await updateTelemedCaseWorkspace(auth.session, caseId, body), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return backendErrorResponse(error);
  }
}
