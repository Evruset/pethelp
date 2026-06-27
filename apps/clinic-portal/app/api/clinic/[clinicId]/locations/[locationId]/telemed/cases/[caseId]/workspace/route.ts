import { NextResponse } from 'next/server';
import { TelemedVetBackendError, updateTelemedCaseWorkspace } from '@/lib/api/telemed-vet';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';

type RouteContext = {
  params: Promise<{
    clinicId: string;
    locationId: string;
    caseId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId, caseId } = await context.params;
  const session = await getClinicSession();
  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(await updateTelemedCaseWorkspace(session, clinicId, locationId, caseId, {
      safetyEscalation: typeof body.safetyEscalation === 'boolean' ? body.safetyEscalation : undefined,
      recommendationText: typeof body.recommendationText === 'string' ? body.recommendationText : undefined,
      followUpNotes: typeof body.followUpNotes === 'string' ? body.followUpNotes : undefined,
    }));
  } catch (error) {
    if (error instanceof TelemedVetBackendError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503 });
  }
}
