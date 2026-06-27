import type { ClinicSession } from '@/lib/auth/clinic-session';

export type ManualConfirmationQueueItem = {
  holdId: string;
  version: number;
  holdExpiresAt: string;
  manualConfirmPendingAt: string;
  confirmationSlaExpiresAt: string;
  slot: {
    id: string;
    startsAt: string;
    endsAt: string;
  };
  pet: {
    id: string;
    name: string;
    species: string;
  };
  service: {
    displayName: string;
  } | null;
  latestAudit: {
    action: string;
    occurredAt: string;
    actorType: string;
  } | null;
};

export type ManualConfirmationQueue = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: ManualConfirmationQueueItem[];
};

export type HoldAuditTrailItem = {
  id: string;
  occurredAt: string;
  actorType: string;
  actorId: string | null;
  action: string;
  correlationId: string | null;
  payload: Record<string, unknown>;
};

export type HoldAuditTrail = {
  holdId: string;
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: HoldAuditTrailItem[];
};

export class ClinicBackendError extends Error {
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

export async function getManualConfirmationQueue(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
): Promise<ManualConfirmationQueue> {
  const url = new URL(
    `${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/booking-queue`,
  );
  url.searchParams.set('limit', '50');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ClinicBackendError(response.status, await parseErrorCode(response));
  }

  return response.json() as Promise<ManualConfirmationQueue>;
}
