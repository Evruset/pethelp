export type AppointmentBucket = 'upcoming' | 'history';

export type ClinicAppointment = {
  appointmentId: string;
  aggregateVersion: number;
  statusCode: string;
  slot: { startsAt: string; endsAt: string };
  pet: { id: string; name: string; speciesLabel: string };
  service: { displayName: string } | null;
};

export type ClinicAppointmentsSnapshot = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: ClinicAppointment[];
  nextCursor: string | null;
};

export type ClinicAppointmentDetail = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  appointment: {
    appointmentId: string;
    aggregateVersion: number;
    statusCode: 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'UNKNOWN';
    createdAt: string;
  };
  schedule: {
    startsAt: string;
    endsAt: string;
    timezone: string;
    sourceLabel: string;
  };
  owner: { displayName: string } | null;
  pet: { id: string; displayName: string; speciesLabel: string };
  service: { displayName: string } | null;
  veterinarian: { displayName: string } | null;
  resource: { displayName: string } | null;
};

export class ClinicAppointmentsResponseError extends Error {
  constructor(public readonly kind: 'malformed' | 'http', public readonly status?: number) {
    super(kind === 'malformed' ? 'INVALID_APPOINTMENTS_RESPONSE' : `APPOINTMENTS_HTTP_${status}`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const STRICT_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;

function strictTimestamp(value: unknown): value is string {
  if (!text(value)) return false;
  const match = STRICT_INSTANT.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  if (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false;
  return Number.isFinite(Date.parse(value));
}

function display(value: unknown): { displayName: string } | null | undefined {
  if (value === null) return null;
  if (!record(value) || !text(value.displayName)) return undefined;
  return { displayName: value.displayName };
}

export function parseClinicAppointmentDetail(
  payload: unknown,
  expected: { clinicId: string; locationId: string; appointmentId: string },
): ClinicAppointmentDetail {
  if (!record(payload) || payload.clinicId !== expected.clinicId || payload.locationId !== expected.locationId
    || !strictTimestamp(payload.serverNow) || !record(payload.appointment) || !record(payload.schedule)
    || !record(payload.pet) || !Array.isArray(payload.availableActions) || payload.availableActions.length !== 0) {
    throw new ClinicAppointmentsResponseError('malformed');
  }
  const appointment = payload.appointment;
  const schedule = payload.schedule;
  const pet = payload.pet;
  const owner = display(payload.owner);
  const service = display(payload.service);
  const veterinarian = display(payload.veterinarian);
  const resource = display(payload.resource);
  if (appointment.appointmentId !== expected.appointmentId || !UUID.test(expected.appointmentId)
    || !Number.isInteger(appointment.aggregateVersion) || Number(appointment.aggregateVersion) < 1
    || !text(appointment.statusCode) || !strictTimestamp(appointment.createdAt)
    || !strictTimestamp(schedule.startsAt) || !strictTimestamp(schedule.endsAt)
    || Date.parse(schedule.endsAt) <= Date.parse(schedule.startsAt)
    || !text(schedule.timezone) || !text(schedule.sourceLabel)
    || !UUID.test(String(pet.id)) || !text(pet.displayName) || !text(pet.speciesLabel)
    || owner === undefined || service === undefined || veterinarian === undefined || resource === undefined) {
    throw new ClinicAppointmentsResponseError('malformed');
  }
  const known = new Set(['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'UNKNOWN']);
  const statusCode = known.has(appointment.statusCode) ? appointment.statusCode : 'UNKNOWN';
  return {
    clinicId: payload.clinicId,
    locationId: payload.locationId,
    serverNow: payload.serverNow,
    appointment: {
      appointmentId: appointment.appointmentId,
      aggregateVersion: Number(appointment.aggregateVersion),
      statusCode: statusCode as ClinicAppointmentDetail['appointment']['statusCode'],
      createdAt: appointment.createdAt,
    },
    schedule: {
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      timezone: schedule.timezone,
      sourceLabel: schedule.sourceLabel,
    },
    owner,
    pet: { id: String(pet.id), displayName: pet.displayName, speciesLabel: pet.speciesLabel },
    service,
    veterinarian,
    resource,
  };
}

export function parseClinicAppointmentsSnapshot(
  payload: unknown,
  expected: { clinicId: string; locationId: string },
): ClinicAppointmentsSnapshot {
  if (!record(payload) || payload.clinicId !== expected.clinicId || payload.locationId !== expected.locationId
    || !timestamp(payload.serverNow) || !Array.isArray(payload.items)
    || !(payload.nextCursor === null || text(payload.nextCursor))) {
    throw new ClinicAppointmentsResponseError('malformed');
  }

  const ids = new Set<string>();
  const items = payload.items.map((value): ClinicAppointment => {
    if (!record(value) || !UUID.test(String(value.appointmentId)) || !Number.isInteger(value.aggregateVersion)
      || Number(value.aggregateVersion) < 1 || !text(value.statusCode)
      || !record(value.slot) || !timestamp(value.slot.startsAt) || !timestamp(value.slot.endsAt)
      || Date.parse(value.slot.endsAt) <= Date.parse(value.slot.startsAt)
      || !record(value.pet) || !UUID.test(String(value.pet.id)) || !text(value.pet.name)
      || !text(value.pet.speciesLabel)
      || !(value.service === null || (record(value.service) && text(value.service.displayName)))) {
      throw new ClinicAppointmentsResponseError('malformed');
    }
    const appointmentId = String(value.appointmentId);
    if (ids.has(appointmentId)) throw new ClinicAppointmentsResponseError('malformed');
    ids.add(appointmentId);
    return {
      appointmentId,
      aggregateVersion: Number(value.aggregateVersion),
      statusCode: value.statusCode,
      slot: { startsAt: value.slot.startsAt, endsAt: value.slot.endsAt },
      pet: { id: String(value.pet.id), name: value.pet.name, speciesLabel: value.pet.speciesLabel },
      service: value.service === null ? null : { displayName: value.service.displayName as string },
    };
  });

  return {
    clinicId: payload.clinicId,
    locationId: payload.locationId,
    serverNow: payload.serverNow,
    items,
    nextCursor: payload.nextCursor,
  };
}

export async function fetchClinicAppointments(input: {
  clinicId: string;
  locationId: string;
  bucket: AppointmentBucket;
  limit: number;
  cursor?: string;
  signal: AbortSignal;
}): Promise<ClinicAppointmentsSnapshot> {
  const query = new URLSearchParams({ bucket: input.bucket, limit: String(input.limit) });
  if (input.cursor) query.set('cursor', input.cursor);
  const response = await fetch(
    `/api/clinic/${encodeURIComponent(input.clinicId)}/locations/${encodeURIComponent(input.locationId)}/appointments?${query}`,
    { cache: 'no-store', signal: input.signal, headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new ClinicAppointmentsResponseError('http', response.status);
  const payload: unknown = await response.json().catch(() => null);
  return parseClinicAppointmentsSnapshot(payload, input);
}

export async function getClinicAppointmentDetail(input: {
  clinicId: string;
  locationId: string;
  appointmentId: string;
  signal: AbortSignal;
}): Promise<ClinicAppointmentDetail> {
  const response = await fetch(
    `/api/clinic/${encodeURIComponent(input.clinicId)}/locations/${encodeURIComponent(input.locationId)}/appointments/${encodeURIComponent(input.appointmentId)}`,
    { cache: 'no-store', signal: input.signal, headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new ClinicAppointmentsResponseError('http', response.status);
  const payload: unknown = await response.json().catch(() => null);
  return parseClinicAppointmentDetail(payload, input);
}
