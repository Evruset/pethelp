import type { ClinicSession } from '@/lib/auth/clinic-session';

export type ClinicScheduleService = {
  id: string;
  code: string;
  displayName: string;
  durationMinutes: number;
  active: boolean;
  priceAmount: string;
  currency: string;
  version: number;
  updatedAt: string;
};

export type ClinicScheduleSlot = {
  id: string;
  service: { id: string; displayName: string } | null;
  staff: { id: string; displayName: string } | null;
  resource: { id: string; displayName: string } | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  heldCount: number;
  state: string;
  status: string;
  source: string;
  integrationMode: string;
  lastFreshnessSync: string | null;
  stale: boolean;
  version: number;
};

export type ClinicScheduleStaff = {
  id: string;
  code: string;
  displayName: string;
  role: string;
  active: boolean;
  source: string;
  externalStaffId: string | null;
  version: number;
  updatedAt: string;
};

export type ClinicScheduleResource = {
  id: string;
  code: string;
  displayName: string;
  resourceType: string;
  active: boolean;
  source: string;
  externalResourceId: string | null;
  version: number;
  updatedAt: string;
};

export type ClinicSchedulePeriod = {
  id: string;
  periodType: 'BLACKOUT' | 'VACATION' | 'EMERGENCY_DUTY';
  startsAt: string;
  endsAt: string;
  staff: { id: string; displayName: string } | null;
  resource: { id: string; displayName: string } | null;
  reason: string | null;
  active: boolean;
  source: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ClinicWorkingHoursDay = {
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  active: boolean;
  source: string;
  updatedAt: string | null;
};

export type ClinicSchedule = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  services: ClinicScheduleService[];
  staff: ClinicScheduleStaff[];
  resources: ClinicScheduleResource[];
  periods: ClinicSchedulePeriod[];
  workingHours: ClinicWorkingHoursDay[];
  slots: ClinicScheduleSlot[];
};

export class ClinicScheduleBackendError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

function backendBaseUrl(): string {
  const baseUrl = process.env.VETHELP_API_BASE_URL;
  if (!baseUrl) throw new Error('VETHELP_API_BASE_URL is not configured');
  return baseUrl.replace(/\/$/, '');
}

async function parseErrorCode(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { code?: unknown } | null;
  return typeof payload?.code === 'string' ? payload.code : 'BACKEND_UNAVAILABLE';
}

export async function getClinicSchedule(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<ClinicSchedule> {
  const url = new URL(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/schedule/slots`);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ClinicScheduleBackendError(response.status, await parseErrorCode(response));
  }

  return response.json() as Promise<ClinicSchedule>;
}
