import type { ClinicSession } from '@/lib/auth/clinic-session';

export type TelemedSessionSummary = {
  id: string;
  state: string;
  expiresAt: string;
};

export type DoctorConnectionResult = {
  session: {
    id: string;
    bookingHoldId: string | null;
    telemedCaseId: string | null;
    ownerId: string;
    doctorId: string | null;
    state: string;
    roomName: string;
    version: number;
    expiresAt: string;
    createdAt: string;
  };
  accessToken: string;
  tokenExpiresAt: string;
  livekitUrl: string;
};

export type TelemedVetCase = {
  caseId: string;
  state: 'QUEUED' | 'ASSIGNED' | 'DOCTOR_JOINED' | 'IN_PROGRESS';
  queuePriority: number;
  urgencyBand: string;
  serviceLevel: string;
  safetyEscalation: boolean;
  recommendationText: string | null;
  followUpNotes: string | null;
  assignedEmployeeId: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  intake: {
    id: string;
    category: string;
    symptomDuration: string;
    priorClinicVisit: boolean;
    emergencyRedFlags: string[];
  };
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    birthDate: string | null;
    weightKg: string | null;
    allergies: string[];
    chronicConditions: string[];
  };
  latestEvent: { eventType: string; createdAt: string } | null;
  session: TelemedSessionSummary | null;
};

export type TelemedVetQueue = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  availableCases: TelemedVetCase[];
  assignedCases: TelemedVetCase[];
  restrictedOutputPolicy: {
    allowed: string[];
    forbidden: string[];
  };
};

export class TelemedVetBackendError extends Error {
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

function authHeaders(session: ClinicSession): HeadersInit {
  return {
    Authorization: `Bearer ${session.token}`,
    Accept: 'application/json',
  };
}

export async function getTelemedVetQueue(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
): Promise<TelemedVetQueue> {
  const url = new URL(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/telemed/vet-queue`);
  url.searchParams.set('limit', '50');
  const response = await fetch(url, {
    headers: authHeaders(session),
    cache: 'no-store',
  });
  if (!response.ok) throw new TelemedVetBackendError(response.status, await parseErrorCode(response));
  return response.json() as Promise<TelemedVetQueue>;
}

export async function assignTelemedCase(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
  caseId: string,
): Promise<TelemedVetCase> {
  const response = await fetch(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/telemed/cases/${caseId}/assign`, {
    method: 'POST',
    headers: authHeaders(session),
    cache: 'no-store',
  });
  if (!response.ok) throw new TelemedVetBackendError(response.status, await parseErrorCode(response));
  return response.json() as Promise<TelemedVetCase>;
}

export async function updateTelemedCaseWorkspace(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
  caseId: string,
  body: {
    safetyEscalation?: boolean;
    recommendationText?: string;
    followUpNotes?: string;
  },
): Promise<TelemedVetCase> {
  const response = await fetch(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/telemed/cases/${caseId}/workspace`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new TelemedVetBackendError(response.status, await parseErrorCode(response));
  return response.json() as Promise<TelemedVetCase>;
}

export async function startTelemedCaseSession(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
  caseId: string,
): Promise<DoctorConnectionResult['session']> {
  const response = await fetch(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/telemed/cases/${caseId}/start-session`, {
    method: 'POST',
    headers: authHeaders(session),
    cache: 'no-store',
  });
  if (!response.ok) throw new TelemedVetBackendError(response.status, await parseErrorCode(response));
  return response.json() as Promise<DoctorConnectionResult['session']>;
}

export async function connectTelemedDoctor(
  session: ClinicSession,
  clinicId: string,
  locationId: string,
  caseId: string,
  sessionId: string,
): Promise<DoctorConnectionResult> {
  const response = await fetch(`${backendBaseUrl()}/v1/clinic/${clinicId}/locations/${locationId}/telemed/cases/${caseId}/sessions/${sessionId}/connect`, {
    method: 'POST',
    headers: authHeaders(session),
    cache: 'no-store',
  });
  if (!response.ok) throw new TelemedVetBackendError(response.status, await parseErrorCode(response));
  return response.json() as Promise<DoctorConnectionResult>;
}
