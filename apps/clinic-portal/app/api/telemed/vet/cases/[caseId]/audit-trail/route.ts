import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';
import { getTelemedVetAuditTrail } from '@/lib/api/telemed-vet';
import { backendErrorResponse } from '../../../_shared';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ caseId: string }> };
export async function GET(_: Request, context: Context): Promise<NextResponse> { const session = await getClinicSession(); const { caseId } = await context.params; if (!session || !UUID.test(caseId)) return NextResponse.json({ code: 'TELEMED_AUDIT_UNAVAILABLE' }, { status: 403, headers: { 'Cache-Control': 'no-store' } }); try { return NextResponse.json(await getTelemedVetAuditTrail(session, caseId), { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return backendErrorResponse(error); } }
