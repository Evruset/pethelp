import { NextResponse } from 'next/server';
import type { ClinicSession } from '@/lib/auth/clinic-session';
import { getClinicSession } from '@/lib/auth/clinic-session';
import { isTelemedVeterinarian } from '@/lib/auth/telemed-vet-session';

type TelemedVetAuth =
  | { ok: true; session: ClinicSession }
  | { ok: false; response: NextResponse };

export async function requireTelemedVeterinarian(): Promise<TelemedVetAuth> {
  const session = await getClinicSession();

  if (!isTelemedVeterinarian(session)) {
    return {
      ok: false,
      response: NextResponse.json(
        { code: 'TELEMED_VET_ACCESS_DENIED' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, session };
}

export function backendErrorResponse(error: unknown): NextResponse {
  const candidate = error as { status?: unknown; code?: unknown };

  if (
    typeof candidate?.status === 'number' &&
    typeof candidate?.code === 'string'
  ) {
    return NextResponse.json(
      { code: candidate.code },
      {
        status: candidate.status,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  return NextResponse.json(
    { code: 'BACKEND_UNAVAILABLE' },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
