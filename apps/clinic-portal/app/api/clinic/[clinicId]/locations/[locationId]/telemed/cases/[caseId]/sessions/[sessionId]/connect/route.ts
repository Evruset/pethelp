import { NextResponse } from 'next/server';
import { connectTelemedDoctor, TelemedVetBackendError } from '@/lib/api/telemed-vet';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';

type RouteContext = {
  params: Promise<{
    clinicId: string;
    locationId: string;
    caseId: string;
    sessionId: string;
  }>;
};

export async function POST(_: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId, caseId, sessionId } = await context.params;
  const session = await getClinicSession();
  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }
  try {
    return NextResponse.json(await connectTelemedDoctor(session, clinicId, locationId, caseId, sessionId));
  } catch (error) {
    if (error instanceof TelemedVetBackendError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503 });
  }
}
