export type ClinicPatient = {
  patientId: string;
  administrativeReference: string | null;
  pet: {
    displayName: string;
    speciesLabel: string;
    breed: string | null;
    sexCode: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
    birthDate: string | null;
  };
  owner: { displayName: string | null };
  relationship: { firstSeenAt: string; lastSeenAt: string };
  appointments: { lastVisitAt: string | null; nextAppointmentAt: string | null };
};

export type ClinicPatientsSnapshot = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: ClinicPatient[];
  nextCursor: string | null;
};

export class ClinicPatientsResponseError extends Error {
  constructor(
    public readonly kind: 'malformed' | 'http',
    public readonly status?: number,
    public readonly retryAfter?: number,
    public readonly code?: string,
  ) {
    super(kind === 'malformed' ? 'INVALID_PATIENTS_RESPONSE' : `PATIENTS_HTTP_${status}`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STRICT_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SEX = new Set(['MALE', 'FEMALE', 'UNKNOWN']);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|');

function calendarDate(value: unknown): value is string {
  if (!text(value)) return false;
  const match = DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function instant(value: unknown): value is string {
  if (!text(value)) return false;
  const match = STRICT_INSTANT.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    && hour <= 23 && minute <= 59 && second <= 59 && Number.isFinite(Date.parse(value));
}

const optionalInstant = (value: unknown): value is string | null => value === null || instant(value);

export function parseClinicPatientsSnapshot(
  payload: unknown,
  expected: { clinicId: string; locationId: string },
): ClinicPatientsSnapshot {
  if (!record(payload) || !keys(payload, ['clinicId', 'locationId', 'serverNow', 'items', 'nextCursor'])
    || payload.clinicId !== expected.clinicId || payload.locationId !== expected.locationId
    || !instant(payload.serverNow) || !Array.isArray(payload.items)
    || !(payload.nextCursor === null || text(payload.nextCursor))) {
    throw new ClinicPatientsResponseError('malformed');
  }
  const ids = new Set<string>();
  const items = payload.items.map((value): ClinicPatient => {
    if (!record(value)
      || !keys(value, ['patientId', 'administrativeReference', 'pet', 'owner', 'relationship', 'appointments'])
      || !UUID.test(String(value.patientId)) || !nullableText(value.administrativeReference) || !record(value.pet)
      || !record(value.owner) || !record(value.relationship) || !record(value.appointments)) {
      throw new ClinicPatientsResponseError('malformed');
    }
    const pet = value.pet, owner = value.owner, relationship = value.relationship, appointments = value.appointments;
    if (!keys(pet, ['displayName', 'speciesLabel', 'breed', 'sexCode', 'birthDate'])
      || !keys(owner, ['displayName'])
      || !keys(relationship, ['firstSeenAt', 'lastSeenAt'])
      || !keys(appointments, ['lastVisitAt', 'nextAppointmentAt'])
      || !text(pet.displayName) || !text(pet.speciesLabel) || !nullableText(pet.breed)
      || !(pet.sexCode === null || (typeof pet.sexCode === 'string' && SEX.has(pet.sexCode)))
      || !(pet.birthDate === null || calendarDate(pet.birthDate))
      || !nullableText(owner.displayName)
      || !instant(relationship.firstSeenAt) || !instant(relationship.lastSeenAt)
      || !optionalInstant(appointments.lastVisitAt) || !optionalInstant(appointments.nextAppointmentAt)) {
      throw new ClinicPatientsResponseError('malformed');
    }
    const patientId = String(value.patientId);
    if (ids.has(patientId)) throw new ClinicPatientsResponseError('malformed');
    ids.add(patientId);
    return {
      patientId,
      administrativeReference: value.administrativeReference,
      pet: {
        displayName: pet.displayName,
        speciesLabel: pet.speciesLabel,
        breed: pet.breed,
        sexCode: pet.sexCode as ClinicPatient['pet']['sexCode'],
        birthDate: pet.birthDate as string | null,
      },
      owner: { displayName: owner.displayName },
      relationship: { firstSeenAt: relationship.firstSeenAt, lastSeenAt: relationship.lastSeenAt },
      appointments: { lastVisitAt: appointments.lastVisitAt, nextAppointmentAt: appointments.nextAppointmentAt },
    };
  });
  return {
    clinicId: payload.clinicId,
    locationId: payload.locationId,
    serverNow: payload.serverNow,
    items,
    nextCursor: payload.nextCursor as string | null,
  };
}

export function normalizePatientSearch(value: string): string {
  return value.normalize('NFKC').trim();
}

export function normalizeAdministrativeReferenceSearch(value: string): string {
  return value.normalize('NFC').trim().replace(/ {2,}/g, ' ');
}

export async function fetchClinicPatients(input: {
  clinicId: string;
  locationId: string;
  q?: string;
  administrativeReference?: string;
  limit: number;
  cursor?: string;
  signal: AbortSignal;
}): Promise<ClinicPatientsSnapshot> {
  const query = new URLSearchParams({ limit: String(input.limit) });
  if (input.q) query.set('q', input.q);
  if (input.administrativeReference) query.set('administrativeReference', input.administrativeReference);
  if (input.cursor) query.set('cursor', input.cursor);
  const response = await fetch(
    `/api/clinic/${encodeURIComponent(input.clinicId)}/locations/${encodeURIComponent(input.locationId)}/patients?${query}`,
    { cache: 'no-store', signal: input.signal, headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const retry = Number(response.headers.get('Retry-After'));
    const body = await response.json().catch(() => null) as { code?: unknown } | null;
    throw new ClinicPatientsResponseError(
      'http',
      response.status,
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
      typeof body?.code === 'string' ? body.code : undefined,
    );
  }
  return parseClinicPatientsSnapshot(await response.json().catch(() => null), input);
}
