import { NextResponse } from 'next/server';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { ClinicBackendError, getManualConfirmationQueue } from '@/lib/api/clinic-queue';

type RouteContext = {
  params: Promise<{
    clinicId: string;
    locationId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId } = await context.params;
  const session = await getClinicSession();

  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  try {
    const queue = await getManualConfirmationQueue(session, clinicId, locationId);
    return NextResponse.json(queue, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof ClinicBackendError) {
      return NextResponse.json(
        { code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
