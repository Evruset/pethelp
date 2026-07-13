export const VETERINARIAN_VISIT_STATUSES = ['CONFIRMED', 'COMPLETED'] as const;
export type VeterinarianVisitStatus = (typeof VETERINARIAN_VISIT_STATUSES)[number];

export type VeterinarianVisit = {
  holdId: string; clinicId: string; locationId: string; scheduledStart: string; scheduledEnd: string;
  status: VeterinarianVisitStatus; petDisplayName: string; species: string;
};

const keys = ['clinicId', 'holdId', 'locationId', 'petDisplayName', 'scheduledEnd', 'scheduledStart', 'species', 'status'];
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
