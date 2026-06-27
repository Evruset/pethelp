import type { ClinicSession } from '@/lib/auth/clinic-session';

export type QualityMetric = {
  value: number | null;
  numerator: number;
  denominator: number;
};

export type ClinicQualityDashboard = {
  clinicId: string;
  locationId: string;
  from: string;
  to: string;
  generatedAt: string;
  metrics: {
    firstResponseSla: QualityMetric;
    confirmRate: QualityMetric;
    alternativeRate: QualityMetric;
    cancellationRate: QualityMetric;
    noShowRate: QualityMetric;
    averageConfirmationMinutes: number | null;
    staleAvailabilityIncidents: number;
    bookingConversion: QualityMetric;
    telemedReferralConversion: QualityMetric;
    ownerReturnRate: QualityMetric;
  };
};

export class ClinicQualityBackendError extends Error {
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

export async function getClinicQualityDashboard(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<ClinicQualityDashboard> {
  const url = new URL(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/quality-dashboard`);
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
    throw new ClinicQualityBackendError(response.status, await parseErrorCode(response));
  }

  return response.json() as Promise<ClinicQualityDashboard>;
}
