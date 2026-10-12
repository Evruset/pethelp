import { apiClient, type ApiClient } from '@/api/client';

export type Appointment = {
  holdId: string; appointmentId: string | null; state: string; bucket: 'REQUIRES_ACTION' | 'ACTIVE' | 'HISTORY';
  presentation: { label: string; description: string; tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral' };
  startsAt: string; endsAt: string;
  clinic: { id: string; name: string; address: string };
  pet: { id: string; name: string; species: string };
};
export type AppointmentDetail = Appointment & {
  actions: { canReviewAlternative: boolean };
  service: { id?:string|null; name: string | null }; location: { id?:string; address: string; phone: string | null };
  appointmentLifecycle?:{state:string|null;reasonText:string|null};
  timeline: { at: string; label: string; description: string }[];
  cancellation: { canCancel: boolean; cancellationPolicyCode: 'ACTIVE_HOLD_RELEASE_V1' | 'CLINIC_CONFIRMATION_REQUIRED_V1'; aggregateVersion: number };
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_APPOINTMENT_RESPONSE');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_APPOINTMENT_RESPONSE');
  return value;
}
function id(value: unknown): string {
  const result = text(value); if (!uuid.test(result)) throw new Error('INVALID_APPOINTMENT_ID'); return result;
}
function instant(value: unknown): string {
  const result = text(value); if (!Number.isFinite(Date.parse(result))) throw new Error('INVALID_APPOINTMENT_RESPONSE'); return result;
}
export function parseAppointment(raw: unknown): Appointment {
  const value = object(raw), clinic = object(value.clinic), pet = object(value.pet), presentation = object(value.presentation);
  if (!['info', 'success', 'warning', 'danger', 'neutral'].includes(String(presentation.tone))) throw new Error('INVALID_APPOINTMENT_RESPONSE');
  if (!['ACTIVE', 'REQUIRES_ACTION', 'HISTORY'].includes(String(value.bucket))) throw new Error('INVALID_APPOINTMENT_RESPONSE');
  return { holdId: id(value.holdId), appointmentId: value.appointmentId == null ? null : id(value.appointmentId), state: text(value.state), bucket: value.bucket as Appointment['bucket'],
    startsAt: instant(value.startsAt), endsAt: instant(value.endsAt),
    presentation: { label: text(presentation.label), description: text(presentation.description), tone: presentation.tone as Appointment['presentation']['tone'] },
    clinic: { id: id(clinic.id), name: text(clinic.name), address: text(clinic.address) },
    pet: { id: id(pet.id), name: text(pet.name), species: text(pet.species) } };
}
export function parseAppointmentDetail(raw: unknown, holdId: string): AppointmentDetail {
  const value = object(raw), summary = parseAppointment(value), actions = object(value.actions), service = object(value.service), location = object(value.location), cancellation = object(value.cancellation);
  if (typeof actions.canReviewAlternative !== 'boolean' || summary.holdId !== holdId || typeof cancellation.canCancel !== 'boolean' || !Number.isSafeInteger(cancellation.aggregateVersion) || Number(cancellation.aggregateVersion) < 1 || !['ACTIVE_HOLD_RELEASE_V1', 'CLINIC_CONFIRMATION_REQUIRED_V1'].includes(String(cancellation.cancellationPolicyCode)) || !Array.isArray(value.timeline)) throw new Error('INVALID_APPOINTMENT_RESPONSE');
  let lifecycle:AppointmentDetail['appointmentLifecycle'];if(value.appointmentLifecycle!==undefined){const raw=object(value.appointmentLifecycle);if(raw.state!==null&&!['CONFIRMED','CANCELLED_BY_USER','CANCELLED_BY_CLINIC','RESCHEDULE_PROPOSED','NO_SHOW'].includes(String(raw.state)))throw Error('INVALID_APPOINTMENT_RESPONSE');lifecycle={state:raw.state===null?null:text(raw.state),reasonText:raw.reasonText===null?null:text(raw.reasonText)};}
  return { ...summary, ...(lifecycle?{appointmentLifecycle:lifecycle}:{}), actions: { canReviewAlternative: actions.canReviewAlternative }, service: { ...(service.id===undefined?{}:{id:service.id===null?null:id(service.id)}),name: service.name === null ? null : text(service.name) },
    location: { ...(location.id===undefined?{}:{id:id(location.id)}),address: text(location.address), phone: location.phone === null ? null : text(location.phone) },
    cancellation: { canCancel: cancellation.canCancel, aggregateVersion: Number(cancellation.aggregateVersion), cancellationPolicyCode: cancellation.cancellationPolicyCode as AppointmentDetail['cancellation']['cancellationPolicyCode'] },
    timeline: value.timeline.map(rawEvent => { const event = object(rawEvent); return { at: instant(event.at), label: text(event.label), description: text(event.description) }; }) };
}
export function createAppointmentsApi(client: ApiClient = apiClient) {
  const headers = (credential: string) => ({ Authorization: `Bearer ${credential}` });
  return {
    async list(credential: string, signal?: AbortSignal): Promise<Appointment[]> {
      const raw = await client.request<unknown>('v1/owner/appointments', { headers: headers(credential), signal });
      if (!Array.isArray(raw)) throw new Error('INVALID_APPOINTMENT_RESPONSE');
      return raw.map(parseAppointment);
    },
    async read(credential: string, holdId: string, signal?: AbortSignal): Promise<AppointmentDetail> {
      id(holdId);
      return parseAppointmentDetail(await client.request<unknown>(`v1/owner/appointments/${holdId}`, { headers: headers(credential), signal }), holdId);
    },
    async cancel(credential: string, detail: AppointmentDetail, key: string): Promise<void> {
      id(detail.holdId); id(key);
      if (!detail.cancellation.canCancel) throw new Error('CANCELLATION_UNAVAILABLE');
      const release = detail.cancellation.cancellationPolicyCode === 'ACTIVE_HOLD_RELEASE_V1';
      if(!release)throw new Error('CONTACT_CLINIC_REQUIRED');
      await client.request(`v1/owner/bookings/${detail.holdId}/cancel`, {
        method: 'POST', body: {}, headers: { ...headers(credential), 'Idempotency-Key': key, 'If-Match': String(detail.cancellation.aggregateVersion) },
      });
    },
  };
}
export const appointmentsApi = createAppointmentsApi();
