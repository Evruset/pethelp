import { NextResponse } from 'next/server';
import { connectTelemedDoctor } from '@/lib/api/telemed-vet';
import { backendErrorResponse, requireTelemedVeterinarian } from '../../../../../_shared';

type Context = { params: Promise<{ caseId: string; sessionId: string }> };

export async function POST(_: Request, context: Context): Promise<NextResponse> {
  const auth = await requireTelemedVeterinarian();
  if (!auth.ok) return auth.response;
  const { caseId, sessionId } = await context.params;
  try {
    return NextResponse.json(await connectTelemedDoctor(auth.session, caseId, sessionId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return backendErrorResponse(error);
  }
}
