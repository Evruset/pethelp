import type { ClinicSession } from '@/lib/auth/clinic-session';

export type OpsSloSnapshot = {
  serverNow: string;
  technical: {
    apiLatencyP95Ms: number;
    apiErrorRate: number;
    apiSamples: number;
    connectionPoolInUse: number;
    connectionPoolWaiting: number;
    outboxLagSeconds: number;
    outboxPendingCount: number;
    outboxRetryCount: number;
    misSyncLagSeconds: number;
    misPendingCount: number;
    paymentReconciliationCount: number;
    telemedQueueWaitSeconds: number;
  };
  security: {
    permissionDeniedLastHour: number;
  };
  business: {
    clinicResponseSlaBreachesLast24h: number;
  };
};

export type OpsAuditEvent = {
  id: string;
  eventRef: string;
  occurredAt: string;
  actorType: string;
  actorId: string | null;
  action: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string | null;
};

export type OpsAuditEvents = {
  items: OpsAuditEvent[];
};

export class OpsSloBackendError extends Error {
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

export async function getOpsSloSnapshot(session: ClinicSession): Promise<OpsSloSnapshot> {
  const response = await fetch(`${backendBaseUrl()}/v1/ops/slo-snapshot`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new OpsSloBackendError(response.status, await parseErrorCode(response));
  }

  return response.json() as Promise<OpsSloSnapshot>;
}

export async function getOpsAuditEvents(session: ClinicSession, limit = 25): Promise<OpsAuditEvents> {
  const url = new URL(`${backendBaseUrl()}/v1/ops/audit-events`);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new OpsSloBackendError(response.status, await parseErrorCode(response));
  }

  return response.json() as Promise<OpsAuditEvents>;
}
