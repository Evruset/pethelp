import { NextResponse } from 'next/server';
import { assignTelemedCase } from '@/lib/api/telemed-vet';
import { backendErrorResponse, requireTelemedVeterinarian } from '../../../_shared';

type Context = { params: Promise<{ caseId: string }> };

export async function POST(_: Request, context: Context): Promise<NextResponse> {
  const auth = await requireTelemedVeterinarian();
  if (!auth.ok) return auth.response;
  const { caseId } = await context.params;
  try {
    return NextResponse.json(await assignTelemedCase(auth.session, caseId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return backendErrorResponse(error);
  }
}
