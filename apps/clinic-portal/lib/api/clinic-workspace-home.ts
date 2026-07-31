export type WorkspaceAvailability =
  | 'AVAILABLE'
  | 'NOT_AUTHORIZED'
  | 'NOT_CONFIGURED'
  | 'TEMPORARILY_UNAVAILABLE';

export type WorkspaceAction =
  | { route: 'queue'; labelKey: 'WORKSPACE_OPEN_QUEUE' }
  | { route: 'appointments'; labelKey: 'WORKSPACE_OPEN_APPOINTMENTS' };

export type QueueWorkspaceFacts = {
  waitingCount: number;
  requiresActionCount: number;
  oldestWaitAgeBucket: 'NONE' | 'LT_5_MIN' | '5_TO_10_MIN' | '10_TO_30_MIN' | 'GT_30_MIN';
  slaRisk: 'NONE' | 'DUE_SOON' | 'OVERDUE' | 'UNKNOWN';
};

export type AppointmentsWorkspaceFacts = {
  todayCount: number;
  requiresActionCount: number;
  nextScheduledAt: string | null;
};

type UnavailableSection<K extends string> = {
  kind: K;
  availability: Exclude<WorkspaceAvailability, 'AVAILABLE'>;
  generatedAt: string;
};

export type WorkspaceSection =
  | { kind: 'QUEUE'; availability: 'AVAILABLE'; generatedAt: string; facts: QueueWorkspaceFacts; action: Extract<WorkspaceAction, { route: 'queue' }> }
  | UnavailableSection<'QUEUE'>
  | UnavailableSection<'SCHEDULE'>
  | { kind: 'APPOINTMENTS'; availability: 'AVAILABLE'; generatedAt: string; facts: AppointmentsWorkspaceFacts; action: Extract<WorkspaceAction, { route: 'appointments' }> }
  | UnavailableSection<'APPOINTMENTS'>
  | UnavailableSection<'VETERINARIAN'>
  | UnavailableSection<'QUALITY'>;

export type ClinicWorkspaceHome = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  generatedAt: string;
  freshness: { state: 'FRESH'; maxAgeSeconds: 30 };
  sections: [WorkspaceSection, WorkspaceSection, WorkspaceSection, WorkspaceSection, WorkspaceSection];
};

export class ClinicWorkspaceHomeResponseError extends Error {
  constructor(public readonly kind: 'malformed' | 'oversized' | 'http', public readonly status?: number) {
    super(kind === 'http' ? `WORKSPACE_HOME_HTTP_${status}` : 'INVALID_WORKSPACE_HOME_RESPONSE');
  }
}

const MAX_RESPONSE_BYTES = 8 * 1024;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;
const SECTION_ORDER = ['QUEUE', 'SCHEDULE', 'APPOINTMENTS', 'VETERINARIAN', 'QUALITY'] as const;
const AVAILABILITIES = new Set<WorkspaceAvailability>(['AVAILABLE', 'NOT_AUTHORIZED', 'NOT_CONFIGURED', 'TEMPORARILY_UNAVAILABLE']);
const WAIT_BUCKETS = new Set(['NONE', 'LT_5_MIN', '5_TO_10_MIN', '10_TO_30_MIN', 'GT_30_MIN']);
const SLA_RISKS = new Set(['NONE', 'DUE_SOON', 'OVERDUE', 'UNKNOWN']);

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = INSTANT.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[8];
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()
    || hour > 23 || minute > 59 || second > 59) return false;
  if (offset !== 'Z') {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function count(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 999;
}

function parseAction(value: unknown, kind: 'QUEUE' | 'APPOINTMENTS'): WorkspaceAction {
  if (!record(value) || !exactKeys(value, ['route', 'labelKey'])) throw new ClinicWorkspaceHomeResponseError('malformed');
  const valid = kind === 'QUEUE'
    ? value.route === 'queue' && value.labelKey === 'WORKSPACE_OPEN_QUEUE'
    : value.route === 'appointments' && value.labelKey === 'WORKSPACE_OPEN_APPOINTMENTS';
  if (!valid) throw new ClinicWorkspaceHomeResponseError('malformed');
  return value as WorkspaceAction;
}

function parseSection(value: unknown, expectedKind: typeof SECTION_ORDER[number]): WorkspaceSection {
  if (!record(value) || value.kind !== expectedKind || typeof value.availability !== 'string'
    || !AVAILABILITIES.has(value.availability as WorkspaceAvailability) || !instant(value.generatedAt)) {
    throw new ClinicWorkspaceHomeResponseError('malformed');
  }
  const availability = value.availability as WorkspaceAvailability;
  if (availability !== 'AVAILABLE') {
    if (!exactKeys(value, ['kind', 'availability', 'generatedAt'])) throw new ClinicWorkspaceHomeResponseError('malformed');
    const validUnavailable = expectedKind === 'QUEUE' || expectedKind === 'APPOINTMENTS'
      ? availability === 'NOT_AUTHORIZED' || availability === 'TEMPORARILY_UNAVAILABLE'
      : availability === 'NOT_AUTHORIZED' || availability === 'NOT_CONFIGURED';
    if (!validUnavailable) throw new ClinicWorkspaceHomeResponseError('malformed');
    return value as WorkspaceSection;
  }
  if (expectedKind !== 'QUEUE' && expectedKind !== 'APPOINTMENTS') throw new ClinicWorkspaceHomeResponseError('malformed');
  if (!exactKeys(value, ['kind', 'availability', 'generatedAt', 'facts', 'action']) || !record(value.facts)) {
    throw new ClinicWorkspaceHomeResponseError('malformed');
  }
  if (expectedKind === 'QUEUE') {
    if (!exactKeys(value.facts, ['waitingCount', 'requiresActionCount', 'oldestWaitAgeBucket', 'slaRisk'])
      || !count(value.facts.waitingCount) || !count(value.facts.requiresActionCount)
      || typeof value.facts.oldestWaitAgeBucket !== 'string' || !WAIT_BUCKETS.has(value.facts.oldestWaitAgeBucket)
      || typeof value.facts.slaRisk !== 'string' || !SLA_RISKS.has(value.facts.slaRisk)) {
      throw new ClinicWorkspaceHomeResponseError('malformed');
    }
  } else if (!exactKeys(value.facts, ['todayCount', 'requiresActionCount', 'nextScheduledAt'])
    || !count(value.facts.todayCount) || !count(value.facts.requiresActionCount)
    || !(value.facts.nextScheduledAt === null || instant(value.facts.nextScheduledAt))) {
    throw new ClinicWorkspaceHomeResponseError('malformed');
  }
  parseAction(value.action, expectedKind);
  return value as WorkspaceSection;
}

export function parseClinicWorkspaceHome(
  payload: unknown,
  expected: { clinicId: string; locationId: string },
): ClinicWorkspaceHome {
  let encoded: string;
  try {
    encoded = JSON.stringify(payload);
  } catch {
    throw new ClinicWorkspaceHomeResponseError('malformed');
  }
  if (typeof encoded !== 'string') throw new ClinicWorkspaceHomeResponseError('malformed');
  if (new TextEncoder().encode(encoded).byteLength > MAX_RESPONSE_BYTES) {
    throw new ClinicWorkspaceHomeResponseError('oversized');
  }
  if (!record(payload)
    || !exactKeys(payload, ['clinicId', 'locationId', 'serverNow', 'generatedAt', 'freshness', 'sections'])
    || payload.clinicId !== expected.clinicId || payload.locationId !== expected.locationId
    || !instant(payload.serverNow) || !instant(payload.generatedAt)
    || !record(payload.freshness) || !exactKeys(payload.freshness, ['state', 'maxAgeSeconds'])
    || payload.freshness.state !== 'FRESH' || payload.freshness.maxAgeSeconds !== 30
    || !Array.isArray(payload.sections) || payload.sections.length !== SECTION_ORDER.length) {
    throw new ClinicWorkspaceHomeResponseError('malformed');
  }
  const rawSections = payload.sections as unknown[];
  const sections = SECTION_ORDER.map((kind, index) => parseSection(rawSections[index], kind)) as ClinicWorkspaceHome['sections'];
  return {
    clinicId: payload.clinicId,
    locationId: payload.locationId,
    serverNow: payload.serverNow,
    generatedAt: payload.generatedAt,
    freshness: { state: 'FRESH', maxAgeSeconds: 30 },
    sections,
  };
}

export async function fetchClinicWorkspaceHome(input: { clinicId: string; locationId: string; signal: AbortSignal }): Promise<ClinicWorkspaceHome> {
  const response = await fetch(`/api/clinic/${encodeURIComponent(input.clinicId)}/locations/${encodeURIComponent(input.locationId)}/workspace-home`, {
    cache: 'no-store',
    credentials: 'same-origin',
    signal: input.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ClinicWorkspaceHomeResponseError('http', response.status);
  return parseClinicWorkspaceHome(await response.json().catch(() => null), input);
}
