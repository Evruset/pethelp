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

export class ClinicAppointmentsResponseError extends Error {
  constructor(public readonly kind: 'malformed' | 'http', public readonly status?: number) {
    super(kind === 'malformed' ? 'INVALID_APPOINTMENTS_RESPONSE' : `APPOINTMENTS_HTTP_${status}`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));

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
