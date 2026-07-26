export type PatientAppointment = {
  appointmentId: string; startsAt: string; endsAt: string;
  statusCode: 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'UNKNOWN';
  statusLabel: string;
  service: { displayName: string | null };
  veterinarian: { displayName: string | null };
};
export type PatientDetail = {
  clinicId: string; locationId: string; serverNow: string;
  patient: {
    patientId: string;
    pet: { displayName: string; speciesLabel: string; breed: string | null; sexCode: 'MALE' | 'FEMALE' | 'UNKNOWN' | null; birthDate: string | null };
    owner: { displayName: string | null };
    relationship: { firstSeenAt: string; lastSeenAt: string };
    appointments: { last: PatientAppointment | null; next: PatientAppointment | null; recent: PatientAppointment[] };
    localProfile: {
      alias: string | null; administrativeReference: string | null;
      aggregateVersion: number; updatedAt: string | null;
    };
  };
};
export class PatientDetailResponseError extends Error {
  constructor(public readonly kind: 'malformed' | 'http', public readonly status?: number) {
    super(kind === 'malformed' ? 'INVALID_PATIENT_DETAIL_RESPONSE' : `PATIENT_DETAIL_HTTP_${status}`);
  }
}
export type PatientLocalProfileMutation = {
  clinicId: string; locationId: string; patientId: string;
  alias: string | null; aggregateVersion: number; updatedAt: string;
};
export type PatientAdministrativeReferenceMutation = {
  clinicId: string; locationId: string; patientId: string;
  alias: string | null; administrativeReference: string | null;
  aggregateVersion: number; updatedAt: string;
};
export class PatientLocalProfileMutationError extends Error {
  constructor(public readonly kind: 'malformed' | 'http' | 'network', public readonly status?: number, public readonly code?: string) {
    super(kind === 'http' ? `PATIENT_LOCAL_PROFILE_HTTP_${status}` : `PATIENT_LOCAL_PROFILE_${kind.toUpperCase()}`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;
const SEX = new Set(['MALE', 'FEMALE', 'UNKNOWN']);
const STATUS = new Set(['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'UNKNOWN']);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|');

function calendar(value: unknown): value is string {
  if (!text(value)) return false;
  const match = DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function instant(value: unknown): value is string {
  if (!text(value)) return false;
  const match = INSTANT.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    && hour <= 23 && minute <= 59 && second <= 59 && Number.isFinite(Date.parse(value));
}
function display(value: unknown): { displayName: string | null } {
  if (!record(value) || !keys(value, ['displayName']) || !nullableText(value.displayName)) {
    throw new PatientDetailResponseError('malformed');
  }
  return { displayName: value.displayName };
}
function appointment(value: unknown): PatientAppointment {
  if (!record(value) || !keys(value, ['appointmentId', 'startsAt', 'endsAt', 'statusCode', 'statusLabel', 'service', 'veterinarian'])
    || typeof value.appointmentId !== 'string' || !UUID.test(value.appointmentId)
    || !instant(value.startsAt) || !instant(value.endsAt) || Date.parse(value.endsAt) < Date.parse(value.startsAt)
    || typeof value.statusCode !== 'string' || !STATUS.has(value.statusCode) || !text(value.statusLabel)) {
    throw new PatientDetailResponseError('malformed');
  }
  return {
    appointmentId: value.appointmentId, startsAt: value.startsAt, endsAt: value.endsAt,
    statusCode: value.statusCode as PatientAppointment['statusCode'], statusLabel: value.statusLabel,
    service: display(value.service), veterinarian: display(value.veterinarian),
  };
}

export function parsePatientDetail(payload: unknown, expected: { clinicId: string; locationId: string; patientId: string }): PatientDetail {
  if (!record(payload) || !keys(payload, ['clinicId', 'locationId', 'serverNow', 'patient'])
    || payload.clinicId !== expected.clinicId || payload.locationId !== expected.locationId || !instant(payload.serverNow)
    || !record(payload.patient) || !keys(payload.patient, ['patientId', 'pet', 'owner', 'relationship', 'appointments', 'localProfile'])
    || payload.patient.patientId !== expected.patientId || !UUID.test(expected.patientId)) throw new PatientDetailResponseError('malformed');
  const patient = payload.patient;
  if (!record(patient.pet) || !keys(patient.pet, ['displayName', 'speciesLabel', 'breed', 'sexCode', 'birthDate'])
    || !text(patient.pet.displayName) || !text(patient.pet.speciesLabel) || !nullableText(patient.pet.breed)
    || !(patient.pet.sexCode === null || (typeof patient.pet.sexCode === 'string' && SEX.has(patient.pet.sexCode)))
    || !(patient.pet.birthDate === null || calendar(patient.pet.birthDate))
    || !record(patient.relationship) || !keys(patient.relationship, ['firstSeenAt', 'lastSeenAt'])
    || !instant(patient.relationship.firstSeenAt) || !instant(patient.relationship.lastSeenAt)
    || !record(patient.appointments) || !keys(patient.appointments, ['last', 'next', 'recent'])
    || !Array.isArray(patient.appointments.recent) || patient.appointments.recent.length > 10
    || !record(patient.localProfile)
    || !keys(patient.localProfile, ['alias', 'administrativeReference', 'aggregateVersion', 'updatedAt'])
    || !nullableText(patient.localProfile.alias)
    || !nullableText(patient.localProfile.administrativeReference)
    || !Number.isInteger(patient.localProfile.aggregateVersion) || Number(patient.localProfile.aggregateVersion) < 0
    || !(patient.localProfile.updatedAt === null || instant(patient.localProfile.updatedAt))
    || (Number(patient.localProfile.aggregateVersion) === 0
      ? patient.localProfile.alias !== null || patient.localProfile.administrativeReference !== null
        || patient.localProfile.updatedAt !== null
      : patient.localProfile.updatedAt === null)) throw new PatientDetailResponseError('malformed');
  const recent = patient.appointments.recent.map(appointment);
  if (new Set(recent.map((item) => item.appointmentId)).size !== recent.length) throw new PatientDetailResponseError('malformed');
  for (let index = 1; index < recent.length; index += 1) {
    const previous = recent[index - 1], current = recent[index];
    const previousTime = Date.parse(previous.startsAt), currentTime = Date.parse(current.startsAt);
    if (previousTime < currentTime || (previousTime === currentTime && previous.appointmentId < current.appointmentId)) {
      throw new PatientDetailResponseError('malformed');
    }
  }
  return {
    clinicId: payload.clinicId, locationId: payload.locationId, serverNow: payload.serverNow,
    patient: {
      patientId: patient.patientId as string,
      pet: {
        displayName: patient.pet.displayName, speciesLabel: patient.pet.speciesLabel, breed: patient.pet.breed,
        sexCode: patient.pet.sexCode as PatientDetail['patient']['pet']['sexCode'],
        birthDate: patient.pet.birthDate as string | null,
      },
      owner: display(patient.owner),
      relationship: { firstSeenAt: patient.relationship.firstSeenAt, lastSeenAt: patient.relationship.lastSeenAt },
      appointments: {
        last: patient.appointments.last === null ? null : appointment(patient.appointments.last),
        next: patient.appointments.next === null ? null : appointment(patient.appointments.next),
        recent,
      },
      localProfile: {
        alias: patient.localProfile.alias,
        administrativeReference: patient.localProfile.administrativeReference,
        aggregateVersion: Number(patient.localProfile.aggregateVersion),
        updatedAt: patient.localProfile.updatedAt as string | null,
      },
    },
  };
}
export async function fetchPatientDetail(input: { clinicId: string; locationId: string; patientId: string; signal: AbortSignal }) {
  const response = await fetch(`/api/clinic/${encodeURIComponent(input.clinicId)}/locations/${encodeURIComponent(input.locationId)}/patients/${encodeURIComponent(input.patientId)}`, {
    cache: 'no-store', signal: input.signal, headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new PatientDetailResponseError('http', response.status);
  return parsePatientDetail(await response.json().catch(() => null), input);
}

export function normalizePatientAlias(value: string): { value?: string; error?: string } {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) return { error: 'Имя не может быть пустым.' };
  if (/[\r\n]/u.test(normalized)) return { error: 'Переносы строк не поддерживаются.' };
  if (/[\p{Cc}\p{Cf}]/u.test(normalized)) return { error: 'Некоторые символы не поддерживаются.' };
  if (Array.from(normalized).length > 80) return { error: 'Введите имя длиной до 80 символов.' };
  return { value: normalized };
}

export function normalizeAdministrativeReference(value: string): { value?: string; error?: string } {
  if (/[\r\n\t\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)) {
    return { error: 'Переносы строк и управляющие символы не поддерживаются.' };
  }
  const normalized = value.normalize('NFC').trim().replace(/ {2,}/g, ' ');
  if (!normalized) return { error: 'Внутренний номер не может быть пустым.' };
  if (Array.from(normalized).length > 40) return { error: 'Введите внутренний номер длиной до 40 символов.' };
  if (!/^[\p{L}\p{Nd}._/ -]+$/u.test(normalized)) {
    return { error: 'Используйте только буквы, цифры, пробел, -, _, / и точку.' };
  }
  return { value: normalized };
}

function parseMutation(payload: unknown, expected: { clinicId: string; locationId: string; patientId: string }): PatientLocalProfileMutation {
  if (!record(payload) || !keys(payload, ['clinicId', 'locationId', 'patientId', 'alias', 'aggregateVersion', 'updatedAt'])
    || payload.clinicId !== expected.clinicId || payload.locationId !== expected.locationId || payload.patientId !== expected.patientId
    || !nullableText(payload.alias) || !Number.isInteger(payload.aggregateVersion) || Number(payload.aggregateVersion) < 1
    || !instant(payload.updatedAt)) throw new PatientLocalProfileMutationError('malformed');
  return {
    clinicId: payload.clinicId, locationId: payload.locationId, patientId: payload.patientId,
    alias: payload.alias, aggregateVersion: Number(payload.aggregateVersion), updatedAt: payload.updatedAt,
  };
}

export async function mutatePatientLocalProfile(input: {
  clinicId: string; locationId: string; patientId: string; alias: string | null;
  aggregateVersion: number; idempotencyKey: string;
}): Promise<PatientLocalProfileMutation> {
  let response: Response;
  try {
    response = await fetch(`/api/clinic/${encodeURIComponent(input.clinicId)}/locations/${encodeURIComponent(input.locationId)}/patients/${encodeURIComponent(input.patientId)}/local-profile`, {
      method: 'PATCH', cache: 'no-store',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        'If-Match': `"${input.aggregateVersion}"`, 'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ alias: input.alias }),
    });
  } catch {
    throw new PatientLocalProfileMutationError('network');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = record(payload) && typeof payload.code === 'string' ? payload.code : undefined;
    throw new PatientLocalProfileMutationError('http', response.status, code);
  }
  return parseMutation(payload, input);
}

function parseReferenceMutation(
  payload: unknown,
  expected: { clinicId: string; locationId: string; patientId: string; currentAlias: string | null },
): PatientAdministrativeReferenceMutation {
  if (!record(payload)
    || !keys(payload, ['clinicId', 'locationId', 'patientId', 'alias', 'administrativeReference', 'aggregateVersion', 'updatedAt'])
    || payload.clinicId !== expected.clinicId || payload.locationId !== expected.locationId
    || payload.patientId !== expected.patientId || !nullableText(payload.alias) || payload.alias !== expected.currentAlias
    || !nullableText(payload.administrativeReference)
    || !Number.isInteger(payload.aggregateVersion) || Number(payload.aggregateVersion) < 1
    || !instant(payload.updatedAt)) throw new PatientLocalProfileMutationError('malformed');
  return {
    clinicId: payload.clinicId, locationId: payload.locationId, patientId: payload.patientId,
    alias: payload.alias, administrativeReference: payload.administrativeReference,
    aggregateVersion: Number(payload.aggregateVersion), updatedAt: payload.updatedAt,
  };
}

export async function mutatePatientAdministrativeReference(input: {
  clinicId: string; locationId: string; patientId: string; administrativeReference: string | null;
  aggregateVersion: number; idempotencyKey: string; currentAlias: string | null;
}): Promise<PatientAdministrativeReferenceMutation> {
  let response: Response;
  try {
    response = await fetch(`/api/clinic/${encodeURIComponent(input.clinicId)}/locations/${encodeURIComponent(input.locationId)}/patients/${encodeURIComponent(input.patientId)}/local-profile/reference`, {
      method: 'PATCH', cache: 'no-store',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        'If-Match': `"${input.aggregateVersion}"`, 'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ administrativeReference: input.administrativeReference }),
    });
  } catch {
    throw new PatientLocalProfileMutationError('network');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = record(payload) && typeof payload.code === 'string' ? payload.code : undefined;
    throw new PatientLocalProfileMutationError('http', response.status, code);
  }
  return parseReferenceMutation(payload, input);
}
