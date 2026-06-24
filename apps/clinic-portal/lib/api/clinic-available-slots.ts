import type { ClinicSession } from '@/lib/auth/clinic-session';
import { ClinicBackendError } from '@/lib/api/clinic-queue';

export type ClinicAvailableSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  serviceName: string | null;
};

export type ClinicAvailableSlots = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: ClinicAvailableSlot[];
};

function backendBaseUrl(): string {
  const baseUrl = process.env.VETHELP_API_BASE_URL;
  if (!baseUrl) throw new Error('VETHELP_API_BASE_URL is not configured');
  return baseUrl.replace(/\/$/, '');
}

async function errorCode(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { code?: unknown } | null;
  return typeof payload?.code === 'string' ? payload.code : 'BACKEND_UNAVAILABLE';
}

export async function getClinicAvailableSlots(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
  excludeSlotId: string,
): Promise<ClinicAvailableSlots> {
  const url = new URL(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/available-slots`);
  url.searchParams.set('excludeSlotId', excludeSlotId);
  url.searchParams.set('limit', '50');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new ClinicBackendError(response.status, await errorCode(response));
  return response.json() as Promise<ClinicAvailableSlots>;
}
