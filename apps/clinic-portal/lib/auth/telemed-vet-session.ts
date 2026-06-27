import type { ClinicSession } from './clinic-session';

export function isTelemedVeterinarian(session: ClinicSession | null): session is ClinicSession {
  return Boolean(session?.roles.includes('TELEMED_VETERINARIAN'));
}
