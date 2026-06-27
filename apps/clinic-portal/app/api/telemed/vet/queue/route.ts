import { NextResponse } from 'next/server';
import { getTelemedVetQueue } from '@/lib/api/telemed-vet';
import { backendErrorResponse, requireTelemedVeterinarian } from '../_shared';

export async function GET(): Promise<NextResponse> {
  const auth = await requireTelemedVeterinarian();
  if (!auth.ok) return auth.response;
  try {
    const queue = await getTelemedVetQueue(auth.session);
    return NextResponse.json(queue, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return backendErrorResponse(error);
  }
}
