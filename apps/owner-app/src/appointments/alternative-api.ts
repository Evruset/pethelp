import {apiClient,type ApiClient} from '@/api/client';
import type {AppointmentDetail} from './appointments-api';
export type Alternative={bookingId:string;proposalId:string;state:string;aggregateVersion:number;serverNow:string;deadline:string;originalSlot:{id:string;startsAt:string;endsAt:string};proposedSlot:{id:string;startsAt:string;endsAt:string};actions:{canAccept:boolean;canDecline:boolean};context:{petId:string;clinicId:string;locationId:string};priceCopy:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('INVALID_ALTERNATIVE');return v as Record<string,unknown>;};
const id=(v:unknown)=>{if(typeof v!=='string'||!uuid.test(v))throw Error('INVALID_ALTERNATIVE');return v;};
const instant=(v:unknown)=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw Error('INVALID_ALTERNATIVE');return v;};
const slot=(v:unknown)=>{const s=object(v);const startsAt=instant(s.startsAt),endsAt=instant(s.endsAt);if(Date.parse(endsAt)<=Date.parse(startsAt))throw Error('INVALID_ALTERNATIVE');return{id:id(s.id),startsAt,endsAt};};
export function parseAlternative(raw:unknown,detail:AppointmentDetail):Alternative{
 const v=object(raw),c=object(v.context),a=object(v.actions);
 if(v.bookingId!==detail.holdId||v.holdId!==detail.holdId||c.petId!==detail.pet.id||c.clinicId!==detail.clinic.id||(detail.location.id!==undefined&&c.locationId!==detail.location.id)||(detail.service.id!=null&&c.serviceId!==detail.service.id)||!['ALTERNATIVE_PENDING','ACCEPTED','DECLINED','EXPIRED','SUPERSEDED'].includes(String(v.state))||!Number.isSafeInteger(v.aggregateVersion)||Number(v.aggregateVersion)<1||typeof a.canAccept!=='boolean'||typeof a.canDecline!=='boolean'||typeof v.priceCopy!=='string')throw Error('INVALID_ALTERNATIVE');
 return{bookingId:id(v.bookingId),proposalId:id(v.proposalId),state:String(v.state),aggregateVersion:Number(v.aggregateVersion),serverNow:instant(v.serverNow),deadline:instant(v.deadline),originalSlot:slot(v.originalSlot),proposedSlot:slot(v.proposedSlot),actions:{canAccept:a.canAccept,canDecline:a.canDecline},context:{petId:id(c.petId),clinicId:id(c.clinicId),locationId:id(c.locationId)},priceCopy:v.priceCopy};
}
export function createAlternativeApi(client:ApiClient=apiClient){return{
 async read(token:string,detail:AppointmentDetail,signal?:AbortSignal){return parseAlternative(await client.request(`v1/owner/bookings/${detail.holdId}/alternative`,{headers:{Authorization:`Bearer ${token}`},signal}),detail);},
 async decide(token:string,snapshot:Alternative,decision:'accept'|'decline',key:string,correlation:string){
  const v=object(await client.request(`v1/owner/bookings/${snapshot.bookingId}/alternative/${snapshot.proposalId}/${decision}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Idempotency-Key':id(key),'X-Correlation-ID':id(correlation),'If-Match':String(snapshot.aggregateVersion)}}));
  if(v.bookingId!==snapshot.bookingId||v.proposalId!==snapshot.proposalId||v.decision!==decision.toUpperCase()||!['CONFIRMED','MIS_HELD','MANUAL_CONFIRM_PENDING'].includes(String(v.state))||!Number.isSafeInteger(v.aggregateVersion)||Number(v.aggregateVersion)<1)throw Error('INVALID_ALTERNATIVE');
  id(v.slotId);return{state:String(v.state)};
 }
};}
export const alternativeApi=createAlternativeApi();
