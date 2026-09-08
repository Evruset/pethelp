import { NextResponse } from 'next/server';
import { isClinicPatientsRegistryEnabled } from '@/app/design-system/feature-flags';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability, hasClinicScope } from '@/lib/auth/effective-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STRONG_VERSION = /^"(0|[1-9][0-9]*)"$/;
type Context = { params: Promise<{ clinicId: string; locationId: string; patientId: string }> };
const safe = (code: string, status: number) => NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store, private' } });
const backend = () => {
  const value = process.env.VETHELP_API_BASE_URL;
  if (!value) throw new Error('VETHELP_API_BASE_URL is not configured');
  return value.replace(/\/$/, '');
};
const bodyIsValid = (value: unknown): value is { administrativeReference: string | null } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 1 && Object.hasOwn(item, 'administrativeReference')
    && (item.administrativeReference === null || typeof item.administrativeReference === 'string');
};
const upstreamCode = (payload: unknown): string | null =>
  payload && typeof payload === 'object' && !Array.isArray(payload) && typeof (payload as Record<string, unknown>).code === 'string'
    ? (payload as Record<string, string>).code : null;

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  if (!isClinicPatientsRegistryEnabled() || process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS !== 'true') return safe('NOT_FOUND', 404);
  if (request.headers.has('authorization')) return safe('AUTH_REQUIRED', 401);
  const { clinicId, locationId, patientId } = await context.params;
  const session = await getClinicSession();
  if (!session) return safe('AUTH_REQUIRED', 401);
  if (!UUID.test(clinicId) || !UUID.test(locationId) || !UUID.test(patientId)
    || !canAccessClinicLocation(session, clinicId, locationId)) return safe('PATIENT_RESOURCE_UNAVAILABLE', 404);
  const idempotencyKey = request.headers.get('Idempotency-Key');
  const ifMatch = request.headers.get('If-Match');
  if (!idempotencyKey || !UUID.test(idempotencyKey)) return safe('INVALID_IDEMPOTENCY_KEY', 400);
  if (!ifMatch || !STRONG_VERSION.test(ifMatch)) return safe('PRECONDITION_REQUIRED', 428);
  const payload = await request.json().catch(() => null);
  if (!bodyIsValid(payload)) return safe('INVALID_ADMINISTRATIVE_REFERENCE', 422);
  try {
    const effective = await getEffectiveSession(session);
    if (!hasCapability(effective, 'patient.admin.local-profile.update') || !hasClinicScope(effective, clinicId, locationId)) {
      return safe('ACTION_NOT_PERMITTED', 403);
    }
    const response = await fetch(`${backend()}/v1/clinic/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/patients/${encodeURIComponent(patientId)}/local-profile/reference`, {
      method: 'PATCH', cache: 'no-store', signal: request.signal,
      headers: {
        Authorization: `Bearer ${session.token}`, Accept: 'application/json', 'Content-Type': 'application/json',
        'If-Match': ifMatch, 'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (response.ok) return result === null ? safe('PATIENT_LOCAL_PROFILE_UNAVAILABLE', 502)
      : NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, private' } });
    const code = upstreamCode(result);
    const allowed = new Set([
      'ACTION_NOT_PERMITTED', 'PATIENT_RESOURCE_UNAVAILABLE', 'PATIENT_VERSION_STALE',
      'PATIENT_ASSOCIATION_CHANGED', 'IDEMPOTENCY_KEY_REUSED', 'INVALID_ADMINISTRATIVE_REFERENCE',
      'ADMINISTRATIVE_REFERENCE_ALREADY_IN_USE', 'PRECONDITION_REQUIRED', 'POLICY_TEMPORARILY_UNAVAILABLE',
    ]);
    return safe(code && allowed.has(code) ? code : 'PATIENT_LOCAL_PROFILE_UNAVAILABLE', response.status);
  } catch {
    return safe('PATIENT_LOCAL_PROFILE_UNAVAILABLE', 503);
  }
}
