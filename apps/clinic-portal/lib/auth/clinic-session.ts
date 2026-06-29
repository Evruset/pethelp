import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export const CLINIC_SESSION_COOKIE = 'vethelp_clinic_session';

export type ClinicSession = {
  token: string;
  userId: string;
  roles: string[];
  clinicIds: string[];
  locationIds: string[];
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function signingKey(): Uint8Array {
  const secret = process.env.VETHELP_CLINIC_JWT_SECRET;
  if (!secret) {
    throw new Error('VETHELP_CLINIC_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

export async function verifyClinicSessionToken(token: string): Promise<ClinicSession | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return {
      token,
      userId: payload.sub,
      roles: asStringArray(payload.roles),
      clinicIds: asStringArray(payload.clinicIds),
      locationIds: asStringArray(payload.locationIds),
    };
  } catch {
    return null;
  }
}

export async function getClinicSession(): Promise<ClinicSession | null> {
  const token = (await cookies()).get(CLINIC_SESSION_COOKIE)?.value;
  return token ? verifyClinicSessionToken(token) : null;
}

export function canAccessClinicLocation(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
): boolean {
  const hasRole = session.roles.includes('CLINIC_RECEPTIONIST') || session.roles.includes('CLINIC_ADMIN');
  return hasRole && session.clinicIds.includes(clinicId) && session.locationIds.includes(locationId);
}

export function canAccessOps(session: ClinicSession): boolean {
  return session.roles.includes('PLATFORM_ADMIN') || session.roles.includes('SECURITY_AUDITOR');
}
