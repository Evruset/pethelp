import { NextResponse } from 'next/server';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { ClinicBackendError } from '@/lib/api/clinic-queue';
import { getClinicAvailableSlots } from '@/lib/api/clinic-available-slots';

type RouteContext = {
  params: Promise<{ clinicId: string; locationId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { clinicId, locationId } = await context.params;
  const session = await getClinicSession();
  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) {
    return NextResponse.json({ code: 'LOCATION_SCOPE_DENIED' }, { status: 403 });
  }

  const excludeSlotId = new URL(request.url).searchParams.get('excludeSlotId');
  if (!excludeSlotId) {
    return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
  }

  try {
    const slots = await getClinicAvailableSlots(session, clinicId, locationId, excludeSlotId);
    return NextResponse.json(slots, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ClinicBackendError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE' }, { status: 503 });
  }
}
