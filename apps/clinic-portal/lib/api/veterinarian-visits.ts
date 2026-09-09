export const VETERINARIAN_VISIT_STATUSES = ['CONFIRMED', 'COMPLETED'] as const;
export type VeterinarianVisitStatus = (typeof VETERINARIAN_VISIT_STATUSES)[number];

export type VeterinarianVisit = {
  holdId: string; clinicId: string; locationId: string; scheduledStart: string; scheduledEnd: string;
  status: VeterinarianVisitStatus; petDisplayName: string; species: string;
};

export type VeterinarianVisitDetail = VeterinarianVisit & {
  visitId: string | null;
};

export type ClinicalResult = {
  id: string;
  visitId: string;
  status: 'DRAFT' | 'PUBLISHED';
  clinicalSummary: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type ClinicalResultAmendment = {
  amendmentId: string;
  resultId: string;
  content: string;
  publishedAt: string;
};

export type VeterinarianVisitClinicalReadback = {
  visitId: string;
  result: ClinicalResult | null;
  amendments: ClinicalResultAmendment[];
};

const keys = ['clinicId', 'holdId', 'locationId', 'petDisplayName', 'scheduledEnd', 'scheduledStart', 'species', 'status'];
const detailKeys = [...keys, 'visitId'].sort();
const readbackKeys = ['amendments', 'result', 'visitId'];
const resultKeys = ['clinicalSummary', 'createdAt', 'id', 'publishedAt', 'status', 'updatedAt', 'version', 'visitId'];
const amendmentKeys = ['amendmentId', 'content', 'publishedAt', 'resultId'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

function isStatus(value: unknown): value is VeterinarianVisitStatus {
  return typeof value === 'string' && VETERINARIAN_VISIT_STATUSES.includes(value as VeterinarianVisitStatus);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = RFC3339.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); const hour = Number(match[4]); const minute = Number(match[5]); const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? undefined : Number(match[7]); const offsetMinute = match[8] === undefined ? undefined : Number(match[8]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return false;
  if (offsetHour !== undefined && offsetMinute !== undefined && (offsetHour > 23 || offsetMinute > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

export function parseVeterinarianVisit(value: unknown): VeterinarianVisit | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join('|') !== keys.join('|')) return null;
  const { holdId, clinicId, locationId, petDisplayName, species, status, scheduledStart, scheduledEnd } = row;
  if (typeof holdId !== 'string' || typeof clinicId !== 'string' || typeof locationId !== 'string' || typeof petDisplayName !== 'string' || typeof species !== 'string') return null;
  if (!isStatus(status) || !isTimestamp(scheduledStart) || !isTimestamp(scheduledEnd)) return null;
  return { holdId, clinicId, locationId, scheduledStart, scheduledEnd, status, petDisplayName, species };
}

export function parseVeterinarianVisits(value: unknown): VeterinarianVisit[] | null {
  return Array.isArray(value) ? value.map(parseVeterinarianVisit).every((row): row is VeterinarianVisit => row !== null) ? value as VeterinarianVisit[] : null : null;
}

export function parseVeterinarianVisitDetail(value: unknown): VeterinarianVisitDetail | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join('|') !== detailKeys.join('|')) return null;
  const base = parseVeterinarianVisit(Object.fromEntries(keys.map((key) => [key, row[key]])));
  if (!base) return null;
  if (row.visitId !== null && (typeof row.visitId !== 'string' || !UUID.test(row.visitId))) return null;
  return { ...base, visitId: row.visitId };
}

export async function loadVeterinarianVisitClinicalReadback(
  visit: VeterinarianVisitDetail,
): Promise<VeterinarianVisitClinicalReadback | null> {
  if (visit.visitId === null) return null;
  const response = await fetch(`/api/clinic/visits/${visit.visitId}/results`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Clinical readback unavailable');
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') throw new Error('Malformed clinical readback');
  const row = payload as Record<string, unknown>;
  const result = row.result === null ? null : parseClinicalResult(row.result, visit.visitId);
  const amendments = Array.isArray(row.amendments) ? row.amendments.map((item) => parseAmendment(item, result?.id)) : null;
  if (Object.keys(row).sort().join('|') !== readbackKeys.join('|') || row.visitId !== visit.visitId || row.result !== null && result === null || !amendments || amendments.some((item) => item === null)) {
    throw new Error('Malformed clinical readback');
  }
  return { visitId: row.visitId, result, amendments: amendments as ClinicalResultAmendment[] };
}

function parseClinicalResult(value: unknown, visitId: string): ClinicalResult | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join('|') !== resultKeys.join('|') || typeof row.id !== 'string' || !UUID.test(row.id) || row.visitId !== visitId) return null;
  if (row.status !== 'DRAFT' && row.status !== 'PUBLISHED') return null;
  if (typeof row.clinicalSummary !== 'string' || !Number.isSafeInteger(row.version) || Number(row.version) < 1 || !isTimestamp(row.createdAt) || !isTimestamp(row.updatedAt)) return null;
  if (row.publishedAt !== null && !isTimestamp(row.publishedAt)) return null;
  return row as ClinicalResult;
}

function parseAmendment(value: unknown, resultId?: string): ClinicalResultAmendment | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join('|') !== amendmentKeys.join('|') || typeof row.amendmentId !== 'string' || !UUID.test(row.amendmentId) || row.resultId !== resultId || typeof row.content !== 'string' || !isTimestamp(row.publishedAt)) return null;
  return row as ClinicalResultAmendment;
}
