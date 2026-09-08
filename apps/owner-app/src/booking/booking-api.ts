import { apiClient, type ApiClient } from '@/api/client';
import type { AvailabilityHandoff } from '@/clinics/availability-api';

export type BookingCommand = Readonly<AvailabilityHandoff & { petId: string }>;
export type BookingResult = Readonly<{
  holdId: string;
  status: 'PENDING_CONFIRMATION';
  slotId: string;
  expiresAt: string;
  lastUpdatedAt: string;
  correlationId: string;
  serverNow: string;
  aggregateVersion: number;
  confirmationMode: 'MANUAL';
  nextAction: 'READ_STATUS';
}>;

export type BookingPublicStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
type Summary = Readonly<{ id: string; name: string }>;
export type BookingSnapshot = Readonly<{
  holdId: string;
  slotId: string;
  status: BookingPublicStatus;
  statusCode: BookingPublicStatus;
  canCancel: boolean;
  statusTitle: string;
  safeDescription: string;
  nextActionCode: 'WAIT' | 'VIEW_APPOINTMENT' | 'CHOOSE_ANOTHER_SLOT';
  confirmationMode: 'MANUAL';
  expiresAt: string;
  serverNow: string;
  aggregateVersion: number;
  lastUpdatedAt: string;
  pet: Summary & Readonly<{ species: string }>;
  clinic: Summary;
  location: Readonly<{ id: string; address: string }>;
  service: Summary;
  doctor: Summary | null;
  slot: Readonly<{ startsAt: string; endsAt: string; timezone: string }>;
  clinicLocationId: string;
  startsAt: string;
  endsAt: string;
}>;

export type BookingCancellationResult = Readonly<{
  holdId: string;
  status: 'CANCELLED';
  slotId: string;
  correlationId: string;
  aggregateVersion: number;
  lastUpdatedAt: string;
  serverNow: string;
  appointmentId?: string;
}>;

export type BookingChangeRequestType = 'CANCEL' | 'RESCHEDULE';
export type BookingChangeRequestStatus = 'OPEN' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type BookingChangeRequest = Readonly<{
  requestId: string;
  requestType: BookingChangeRequestType;
  status: BookingChangeRequestStatus;
  bookingHoldId: string;
  appointmentId: string | null;
  clinicId: string;
  locationId: string;
  slotId: string;
  version: number;
  createdAt: string;
  stateChangedAt: string;
  updatedAt: string;
  terminalAt: string | null;
}>;
export type ReallocationOfferStatus='OFFERED'|'EXPIRED'|'INVALIDATED'|'ACCEPTED';
export type ReallocationOffer=Readonly<{offerId:string;version:number;rank:number;clinicId:string;clinicName:string;locationId:string;locationAddress:string;timezone:string;doctorId:string;doctorName:string|null;serviceId:string;serviceName:string;slotId:string;slotVersion:number;startsAt:string;endsAt:string;distanceMeters:number|null;priceAmount:number|null;priceCurrency:string|null;status:ReallocationOfferStatus;expiresAt:string}>;
export type ReplacementBooking=Readonly<{holdId:string;status:'PENDING_CONFIRMATION'|'CONFIRMED'|'REJECTED'|'EXPIRED';confirmationMode:'MANUAL';slotId:string;aggregateVersion:number;expiresAt:string}>;
export type ReallocationCase=Readonly<{caseId:string;bookingChangeRequestId:string;bookingHoldId:string;status:'OPEN'|'REPLACEMENT_PENDING_CONFIRMATION'|'CLOSED'|'CANCELLED';eligibility:'ACTIVE'|'BOOKING_INELIGIBLE';version:number;serverNow:string;createdAt:string;acceptedOfferId:string|null;replacementBooking:ReplacementBooking|null;offers:readonly ReallocationOffer[]}>;
export type ReallocationSelection=Readonly<{reallocationCaseId:string;caseVersion:number;offerId:string;offerVersion:number;bookingHoldId:string;clinicId:string;locationId:string;doctorId:string;serviceId:string;slotId:string;slotVersion:number;expiresAt:string}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join() === keys.sort().join();
const instant = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value)!;
  const date = new Date(Date.parse(value));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) && date.getUTCHours() === Number(match[4]) && date.getUTCMinutes() === Number(match[5]) && date.getUTCSeconds() === Number(match[6]);
};
const text = (value: unknown, max = 256) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const summary = (value: unknown) => object(value) && exact(value, ['id', 'name']) && UUID.test(String(value.id)) && text(value.name);
const timezone = (value: unknown) => {
  if (!text(value, 64)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value as string }).format(0); return true; } catch { return false; }
};

export function parseBookingResult(raw: unknown): BookingResult {
  if (!raw || typeof raw !== 'object') throw new Error('INVALID_BOOKING_RESPONSE');
  const value = raw as Record<string, unknown>;
  const keys = ['holdId','status','slotId','expiresAt','lastUpdatedAt','correlationId','serverNow','aggregateVersion','confirmationMode','nextAction'];
  if (!exact(value, keys) || !UUID.test(String(value.holdId)) || value.status !== 'PENDING_CONFIRMATION' || !UUID.test(String(value.slotId)) || !instant(value.expiresAt) || !instant(value.lastUpdatedAt) || !UUID.test(String(value.correlationId)) || !instant(value.serverNow) || !Number.isInteger(value.aggregateVersion) || Number(value.aggregateVersion) < 1 || value.confirmationMode !== 'MANUAL' || value.nextAction !== 'READ_STATUS') throw new Error('INVALID_BOOKING_RESPONSE');
  return value as BookingResult;
}

export function parseBookingSnapshot(raw: unknown): BookingSnapshot {
  if (!object(raw)) throw new Error('INVALID_BOOKING_SNAPSHOT');
  const keys = ['holdId','slotId','status','statusCode','canCancel','statusTitle','safeDescription','nextActionCode','confirmationMode','expiresAt','serverNow','aggregateVersion','lastUpdatedAt','pet','clinic','location','service','doctor','slot','clinicLocationId','startsAt','endsAt'];
  const statuses: BookingPublicStatus[] = ['PENDING_CONFIRMATION','CONFIRMED','REJECTED','CANCELLED','EXPIRED'];
  const expectedAction: Record<BookingPublicStatus, BookingSnapshot['nextActionCode']> = {
    PENDING_CONFIRMATION: 'WAIT', CONFIRMED: 'VIEW_APPOINTMENT', REJECTED: 'CHOOSE_ANOTHER_SLOT', CANCELLED: 'CHOOSE_ANOTHER_SLOT', EXPIRED: 'CHOOSE_ANOTHER_SLOT',
  };
  if (!exact(raw, keys) || !UUID.test(String(raw.holdId)) || !UUID.test(String(raw.slotId)) || !statuses.includes(raw.status as BookingPublicStatus) || raw.statusCode !== raw.status || typeof raw.canCancel !== 'boolean' || (raw.canCancel && raw.status !== 'PENDING_CONFIRMATION' && raw.status !== 'CONFIRMED') || !text(raw.statusTitle) || !text(raw.safeDescription, 512) || raw.nextActionCode !== expectedAction[raw.status as BookingPublicStatus] || raw.confirmationMode !== 'MANUAL' || !instant(raw.expiresAt) || !instant(raw.serverNow) || !Number.isInteger(raw.aggregateVersion) || Number(raw.aggregateVersion) < 1 || !instant(raw.lastUpdatedAt)) throw new Error('INVALID_BOOKING_SNAPSHOT');
  if (!object(raw.pet) || !exact(raw.pet, ['id','name','species']) || !UUID.test(String(raw.pet.id)) || !text(raw.pet.name) || !text(raw.pet.species, 64) || !summary(raw.clinic) || !summary(raw.service)) throw new Error('INVALID_BOOKING_SNAPSHOT');
  if (!object(raw.location) || !exact(raw.location, ['id','address']) || !UUID.test(String(raw.location.id)) || !text(raw.location.address, 512) || (raw.doctor !== null && !summary(raw.doctor))) throw new Error('INVALID_BOOKING_SNAPSHOT');
  if (!object(raw.slot) || !exact(raw.slot, ['startsAt','endsAt','timezone']) || !instant(raw.slot.startsAt) || !instant(raw.slot.endsAt) || !timezone(raw.slot.timezone) || Date.parse(String(raw.slot.endsAt)) <= Date.parse(String(raw.slot.startsAt))) throw new Error('INVALID_BOOKING_SNAPSHOT');
  if (!UUID.test(String(raw.clinicLocationId)) || raw.clinicLocationId !== raw.location.id || !instant(raw.startsAt) || !instant(raw.endsAt) || raw.startsAt !== raw.slot.startsAt || raw.endsAt !== raw.slot.endsAt) throw new Error('INVALID_BOOKING_SNAPSHOT');
  return raw as BookingSnapshot;
}

export function parseBookingCancellationResult(raw: unknown): BookingCancellationResult {
  if (!object(raw)) throw new Error('INVALID_BOOKING_CANCELLATION_RESPONSE');
  const keys = Object.keys(raw).sort().join();
  if ((keys !== 'aggregateVersion,correlationId,holdId,lastUpdatedAt,serverNow,slotId,status' && keys !== 'aggregateVersion,appointmentId,correlationId,holdId,lastUpdatedAt,serverNow,slotId,status')
    || !UUID.test(String(raw.holdId)) || raw.status !== 'CANCELLED' || !UUID.test(String(raw.slotId))
    || !UUID.test(String(raw.correlationId)) || !Number.isSafeInteger(raw.aggregateVersion) || Number(raw.aggregateVersion) < 1
    || !instant(raw.lastUpdatedAt) || !instant(raw.serverNow)
    || (raw.appointmentId !== undefined && !UUID.test(String(raw.appointmentId)))) {
    throw new Error('INVALID_BOOKING_CANCELLATION_RESPONSE');
  }
  return raw as BookingCancellationResult;
}

export function parseBookingChangeRequest(raw: unknown): BookingChangeRequest {
  if (!object(raw)) throw new Error('INVALID_BOOKING_CHANGE_REQUEST_RESPONSE');
  const keys=['requestId','requestType','status','bookingHoldId','appointmentId','clinicId','locationId','slotId','version','createdAt','stateChangedAt','updatedAt','terminalAt'];
  const types:BookingChangeRequestType[]=['CANCEL','RESCHEDULE'];
  const statuses:BookingChangeRequestStatus[]=['OPEN','PROCESSING','COMPLETED','REJECTED','CANCELLED'];
  const terminal=statuses.slice(2).includes(raw.status as BookingChangeRequestStatus);
  if(!exact(raw,keys)||!UUID.test(String(raw.requestId))||!types.includes(raw.requestType as BookingChangeRequestType)||!statuses.includes(raw.status as BookingChangeRequestStatus)
    ||!UUID.test(String(raw.bookingHoldId))||(raw.appointmentId!==null&&!UUID.test(String(raw.appointmentId)))||!UUID.test(String(raw.clinicId))||!UUID.test(String(raw.locationId))||!UUID.test(String(raw.slotId))
    ||!Number.isSafeInteger(raw.version)||Number(raw.version)<1||!instant(raw.createdAt)||!instant(raw.stateChangedAt)||!instant(raw.updatedAt)
    ||(terminal?!instant(raw.terminalAt):raw.terminalAt!==null)) throw new Error('INVALID_BOOKING_CHANGE_REQUEST_RESPONSE');
  return raw as BookingChangeRequest;
}

export function parseReallocationCase(raw:unknown):ReallocationCase{
  if(!object(raw)||!exact(raw,['caseId','bookingChangeRequestId','bookingHoldId','status','eligibility','version','serverNow','createdAt','acceptedOfferId','replacementBooking','offers']))throw new Error('INVALID_REALLOCATION_RESPONSE');
  if(!UUID.test(String(raw.caseId))||!UUID.test(String(raw.bookingChangeRequestId))||!UUID.test(String(raw.bookingHoldId))||!(['OPEN','REPLACEMENT_PENDING_CONFIRMATION','CLOSED','CANCELLED'] as const).includes(raw.status as never)||!(['ACTIVE','BOOKING_INELIGIBLE'] as const).includes(raw.eligibility as never)||!Number.isSafeInteger(raw.version)||Number(raw.version)<1||!instant(raw.serverNow)||!instant(raw.createdAt)||!Array.isArray(raw.offers)||raw.offers.length>5)throw new Error('INVALID_REALLOCATION_RESPONSE');
  const pending=raw.status==='REPLACEMENT_PENDING_CONFIRMATION';const acceptedTerminal=raw.status==='CLOSED'&&raw.acceptedOfferId!==null;
  if(pending||acceptedTerminal){const booking=raw.replacementBooking;const statuses=pending?['PENDING_CONFIRMATION']:['CONFIRMED','REJECTED','EXPIRED'];if(!UUID.test(String(raw.acceptedOfferId))||!object(booking)||!exact(booking,['holdId','status','confirmationMode','slotId','aggregateVersion','expiresAt'])||!UUID.test(String(booking.holdId))||!statuses.includes(String(booking.status))||booking.confirmationMode!=='MANUAL'||!UUID.test(String(booking.slotId))||!Number.isSafeInteger(booking.aggregateVersion)||Number(booking.aggregateVersion)<1||!instant(booking.expiresAt))throw new Error('INVALID_REALLOCATION_RESPONSE');}else if(raw.acceptedOfferId!==null||raw.replacementBooking!==null)throw new Error('INVALID_REALLOCATION_RESPONSE');
  let previousRank=0;
  const offers=raw.offers.map(item=>{
    if(!object(item)||!exact(item,['offerId','version','rank','clinicId','clinicName','locationId','locationAddress','timezone','doctorId','doctorName','serviceId','serviceName','slotId','slotVersion','startsAt','endsAt','distanceMeters','priceAmount','priceCurrency','status','expiresAt']))throw new Error('INVALID_REALLOCATION_RESPONSE');
    if(!UUID.test(String(item.offerId))||!Number.isSafeInteger(item.version)||Number(item.version)<1||!Number.isSafeInteger(item.rank)||Number(item.rank)<1||Number(item.rank)>5||Number(item.rank)<=previousRank
      ||![item.clinicId,item.locationId,item.doctorId,item.serviceId,item.slotId].every(value=>UUID.test(String(value)))||![item.clinicName,item.locationAddress,item.serviceName].every(value=>text(value,512))||(item.doctorName!==null&&!text(item.doctorName,512))||!timezone(item.timezone)
      ||!Number.isSafeInteger(item.slotVersion)||Number(item.slotVersion)<1||!instant(item.startsAt)||!instant(item.endsAt)||Date.parse(String(item.endsAt))<=Date.parse(String(item.startsAt))||!instant(item.expiresAt)
      ||(item.distanceMeters!==null&&(!Number.isFinite(item.distanceMeters)||Number(item.distanceMeters)<0))||(item.priceAmount!==null&&(!Number.isFinite(item.priceAmount)||Number(item.priceAmount)<=0))
      ||((item.priceAmount===null)!==(item.priceCurrency===null))||(item.priceCurrency!==null&&!/^[A-Z]{3}$/.test(String(item.priceCurrency)))||!(['OFFERED','EXPIRED','INVALIDATED','ACCEPTED'] as const).includes(item.status as never))throw new Error('INVALID_REALLOCATION_RESPONSE');
    previousRank=Number(item.rank);return item as ReallocationOffer;
  });
  if((pending||acceptedTerminal)&&(offers.filter(item=>item.status==='ACCEPTED').length!==1||!offers.some(item=>item.offerId===raw.acceptedOfferId&&item.status==='ACCEPTED'&&item.slotId===(raw.replacementBooking as Record<string,unknown>).slotId)))throw new Error('INVALID_REALLOCATION_RESPONSE');
  return{...(raw as Omit<ReallocationCase,'offers'>),offers};
}

export function createBookingApi(client: ApiClient = apiClient) {
  return {
    async create(credential: string, command: BookingCommand, idempotencyKey: string, signal?: AbortSignal) {
      const result = parseBookingResult(await client.request<unknown, BookingCommand>('v1/booking-holds', {
        method: 'POST', body: command, signal,
        headers: { Authorization: `Bearer ${credential}`, 'Idempotency-Key': idempotencyKey },
      }));
      if (result.slotId !== command.slotId) throw new Error('INVALID_BOOKING_RESPONSE');
      return result;
    },
    async read(credential: string, holdId: string, signal?: AbortSignal) {
      if (!UUID.test(holdId)) throw new Error('INVALID_BOOKING_REFERENCE');
      const result = parseBookingSnapshot(await client.request<unknown>(`v1/booking-holds/${holdId}`, {
        method: 'GET', signal, headers: { Authorization: `Bearer ${credential}` },
      }));
      if (result.holdId !== holdId) throw new Error('INVALID_BOOKING_SNAPSHOT');
      return result;
    },
    async cancel(credential: string, holdId: string, expectedVersion: number, idempotencyKey: string, correlationId: string, signal?: AbortSignal) {
      if (!UUID.test(holdId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || !UUID.test(idempotencyKey) || !UUID.test(correlationId)) {
        throw new Error('INVALID_BOOKING_CANCELLATION_REFERENCE');
      }
      const result = parseBookingCancellationResult(await client.request<unknown>(`v1/owner/bookings/${holdId}/cancel`, {
        method: 'POST', signal,
        headers: {
          Authorization: `Bearer ${credential}`,
          'Idempotency-Key': idempotencyKey,
          'If-Match': String(expectedVersion),
          'X-Correlation-ID': correlationId,
        },
      }));
      if (result.holdId !== holdId) throw new Error('INVALID_BOOKING_CANCELLATION_RESPONSE');
      return result;
    },
    async createChangeRequest(credential:string,holdId:string,requestType:BookingChangeRequestType,idempotencyKey:string,signal?:AbortSignal){
      if(!UUID.test(holdId)||!UUID.test(idempotencyKey)||!(['CANCEL','RESCHEDULE'] as const).includes(requestType))throw new Error('INVALID_BOOKING_CHANGE_REQUEST_REFERENCE');
      const result=parseBookingChangeRequest(await client.request<unknown,{requestType:BookingChangeRequestType}>(`v1/owner/bookings/${holdId}/change-requests`,{method:'POST',body:{requestType},signal,headers:{Authorization:`Bearer ${credential}`,'Idempotency-Key':idempotencyKey}}));
      if(result.bookingHoldId!==holdId)throw new Error('INVALID_BOOKING_CHANGE_REQUEST_RESPONSE');
      return result;
    },
    async readCurrentChangeRequest(credential:string,holdId:string,signal?:AbortSignal){
      if(!UUID.test(holdId))throw new Error('INVALID_BOOKING_CHANGE_REQUEST_REFERENCE');
      const result=parseBookingChangeRequest(await client.request<unknown>(`v1/owner/bookings/${holdId}/change-requests/current`,{method:'GET',signal,headers:{Authorization:`Bearer ${credential}`}}));
      if(result.bookingHoldId!==holdId)throw new Error('INVALID_BOOKING_CHANGE_REQUEST_RESPONSE');
      return result;
    },
    async openReallocationCase(credential:string,requestId:string,idempotencyKey:string,signal?:AbortSignal){
      if(!UUID.test(requestId)||!UUID.test(idempotencyKey))throw new Error('INVALID_REALLOCATION_REFERENCE');
      const result=parseReallocationCase(await client.request<unknown>(`v1/owner/booking-change-requests/${requestId}/reallocation`,{method:'POST',signal,headers:{Authorization:`Bearer ${credential}`,'Idempotency-Key':idempotencyKey}}));
      if(result.bookingChangeRequestId!==requestId)throw new Error('INVALID_REALLOCATION_RESPONSE');return result;
    },
    async readReallocationCase(credential:string,caseId:string,signal?:AbortSignal){
      if(!UUID.test(caseId))throw new Error('INVALID_REALLOCATION_REFERENCE');
      const result=parseReallocationCase(await client.request<unknown>(`v1/owner/reallocation-cases/${caseId}`,{method:'GET',signal,headers:{Authorization:`Bearer ${credential}`}}));
      if(result.caseId!==caseId)throw new Error('INVALID_REALLOCATION_RESPONSE');return result;
    },
    async acceptReallocationOffer(credential:string,selection:ReallocationSelection,idempotencyKey:string,signal?:AbortSignal){
      if(!UUID.test(selection.reallocationCaseId)||!UUID.test(selection.offerId)||!UUID.test(idempotencyKey))throw new Error('INVALID_REALLOCATION_REFERENCE');
      const result=parseReallocationCase(await client.request<unknown,{offerId:string;caseVersion:number;offerVersion:number;slotVersion:number}>(`v1/owner/reallocation-cases/${selection.reallocationCaseId}/accept`,{method:'POST',body:{offerId:selection.offerId,caseVersion:selection.caseVersion,offerVersion:selection.offerVersion,slotVersion:selection.slotVersion},signal,headers:{Authorization:`Bearer ${credential}`,'Idempotency-Key':idempotencyKey}}));
      if(result.caseId!==selection.reallocationCaseId||result.acceptedOfferId!==selection.offerId||result.replacementBooking?.slotId!==selection.slotId)throw new Error('INVALID_REALLOCATION_RESPONSE');return result;
    },
  };
}
export const bookingApi = createBookingApi();
