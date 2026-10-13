import { apiClient, type ApiClient } from '@/api/client';

export type ResourceRef = Readonly<{type:'RESULT'|'AMENDMENT'|'DOCUMENT';id:string}>;
export type ResourceDetail = ResourceRef & Readonly<{label:string;createdAt:string}>;
export type MedicalShare = Readonly<{id:string;appointmentId:string;petId:string;clinicId:string;locationId:string;status:'ACTIVE'|'REVOKED';version:number;createdAt:string;revokedAt:string|null;resources:ResourceRef[]}>;
export type SharingContext = Readonly<{appointmentId:string;petId:string;clinicId:string;locationId:string;eligible:boolean;resources:ResourceRef[];resourcesTruncated:boolean;shares:MedicalShare[];clinic:{displayName:string;locationAddress:string};pet:{displayName:string};appointment:{startsAt:string;endsAt:string;timezone:string};resourceDetails:ResourceDetail[]}>;
export type OwnerAppointment = Readonly<{holdId:string;appointmentId:string|null;state:string;startsAt:string;endsAt:string;clinic:{id:string;name:string;address:string};pet:{id:string;name:string;species:string}}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid=()=>new Error('INVALID_MEDICAL_SHARING_RESPONSE');
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join()===keys.slice().sort().join();
const id=(value:unknown):value is string=>typeof value==='string'&&UUID.test(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
const date=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,19)===value.slice(0,19);
const resourceKey=(ref:ResourceRef)=>`${ref.type}:${ref.id}`;
function ref(value:unknown):ResourceRef{
  if(!record(value)||!exact(value,['type','id'])||!['RESULT','AMENDMENT','DOCUMENT'].includes(String(value.type))||!id(value.id))throw invalid();
  return {type:value.type as ResourceRef['type'],id:value.id};
}
function refs(value:unknown):ResourceRef[]{
  if(!Array.isArray(value))throw invalid();const parsed=value.map(ref);
  if(new Set(parsed.map(resourceKey)).size!==parsed.length)throw invalid();return parsed;
}
export function parseShare(raw:unknown,expected:{appointmentId:string;petId:string;clinicId:string;locationId:string}):MedicalShare{
  const scope={appointmentId:expected.appointmentId,petId:expected.petId,clinicId:expected.clinicId,locationId:expected.locationId};
  if(!record(raw)||!exact(raw,['id','appointmentId','petId','clinicId','locationId','status','version','createdAt','revokedAt','resources'])||!id(raw.id)||Object.entries(scope).some(([key,value])=>!id(value)||raw[key]!==value)||!date(raw.createdAt)||!['ACTIVE','REVOKED'].includes(String(raw.status))||!(raw.revokedAt===null||date(raw.revokedAt)))throw invalid();
  if(raw.status==='ACTIVE'&&(raw.version!==1||raw.revokedAt!==null)||raw.status==='REVOKED'&&(raw.version!==2||!date(raw.revokedAt)))throw invalid();
  const resources=refs(raw.resources);if(!resources.length||resources.length>200)throw invalid();
  return {...scope,id:raw.id,status:raw.status as MedicalShare['status'],version:Number(raw.version),createdAt:raw.createdAt,revokedAt:raw.revokedAt as string|null,resources};
}
export function parseSharingContext(raw:unknown,appointmentId:string):SharingContext{
  if(!record(raw)||!exact(raw,['appointmentId','petId','clinicId','locationId','eligible','resources','resourcesTruncated','shares','clinic','pet','appointment','resourceDetails'])||raw.appointmentId!==appointmentId||!id(raw.appointmentId)||!id(raw.petId)||!id(raw.clinicId)||!id(raw.locationId)||typeof raw.eligible!=='boolean'||typeof raw.resourcesTruncated!=='boolean'||!Array.isArray(raw.shares)||!Array.isArray(raw.resourceDetails))throw invalid();
  if(!record(raw.clinic)||!exact(raw.clinic,['displayName','locationAddress'])||!text(raw.clinic.displayName)||!text(raw.clinic.locationAddress)||!record(raw.pet)||!exact(raw.pet,['displayName'])||!text(raw.pet.displayName)||!record(raw.appointment)||!exact(raw.appointment,['startsAt','endsAt','timezone'])||!date(raw.appointment.startsAt)||!date(raw.appointment.endsAt)||Date.parse(raw.appointment.endsAt)<=Date.parse(raw.appointment.startsAt)||!text(raw.appointment.timezone))throw invalid();
  const scope={appointmentId,petId:raw.petId,clinicId:raw.clinicId,locationId:raw.locationId};
  const resources=refs(raw.resources);if(resources.length>200)throw invalid();
  const shares=raw.shares.map(value=>parseShare(value,scope));if(new Set(shares.map(value=>value.id)).size!==shares.length)throw invalid();
  const resourceDetails=raw.resourceDetails.map(value=>{
    if(!record(value)||!exact(value,['type','id','label','createdAt'])||!text(value.label)||!date(value.createdAt))throw invalid();
    return {...ref({type:value.type,id:value.id}),label:value.label,createdAt:value.createdAt};
  });
  const requested=new Set([...resources,...shares.flatMap(value=>value.resources)].map(resourceKey));
  if(resourceDetails.some(value=>!requested.has(resourceKey(value)))||new Set(resourceDetails.map(resourceKey)).size!==resourceDetails.length)throw invalid();
  return {...scope,eligible:raw.eligible,resources,resourcesTruncated:raw.resourcesTruncated,shares,resourceDetails,clinic:{displayName:raw.clinic.displayName,locationAddress:raw.clinic.locationAddress},pet:{displayName:raw.pet.displayName},appointment:{startsAt:raw.appointment.startsAt,endsAt:raw.appointment.endsAt,timezone:raw.appointment.timezone}};
}
export function parseAppointments(raw:unknown):OwnerAppointment[]{
  if(!Array.isArray(raw))throw invalid();
  return raw.map(value=>{
    if(!record(value)||!id(value.holdId)||!(value.appointmentId===null||id(value.appointmentId))||!text(value.state)||!date(value.startsAt)||!date(value.endsAt)||!record(value.clinic)||!id(value.clinic.id)||!text(value.clinic.name)||!text(value.clinic.address)||!record(value.pet)||!id(value.pet.id)||!text(value.pet.name)||!text(value.pet.species))throw invalid();
    return {holdId:value.holdId,appointmentId:value.appointmentId as string|null,state:value.state,startsAt:value.startsAt,endsAt:value.endsAt,clinic:{id:value.clinic.id,name:value.clinic.name,address:value.clinic.address},pet:{id:value.pet.id,name:value.pet.name,species:value.pet.species}};
  });
}
export function createMedicalSharingApi(client:ApiClient=apiClient){
  const path=(appointmentId:string)=>{if(!id(appointmentId))throw invalid();return `v1/owner/appointments/${appointmentId}/medical-shares`;};
  const headers=(credential:string,key?:string,correlation?:string)=>({Authorization:`Bearer ${credential}`,...(key?{'Idempotency-Key':key}:{}),...(correlation?{'X-Correlation-ID':correlation}:{})});
  return {
    async appointments(credential:string,signal?:AbortSignal){return parseAppointments(await client.request<unknown>('v1/owner/appointments',{headers:headers(credential),signal}));},
    async context(credential:string,appointmentId:string,signal?:AbortSignal){return parseSharingContext(await client.request<unknown>(path(appointmentId),{headers:headers(credential),signal}),appointmentId);},
    async create(credential:string,context:SharingContext,resources:ResourceRef[],key:string,correlation:string,signal?:AbortSignal){
      const body={mode:'SELECTED' as const,resources};
      const share=parseShare(await client.request<unknown,typeof body>(path(context.appointmentId),{method:'POST',body,headers:headers(credential,key,correlation),signal}),context);
      if(share.resources.map(resourceKey).sort().join()!==resources.map(resourceKey).sort().join())throw invalid();return share;
    },
    async revoke(credential:string,share:MedicalShare,key:string,correlation:string,signal?:AbortSignal){
      const revoked=parseShare(await client.request<unknown,Record<string,never>>(`${path(share.appointmentId)}/${share.id}/revoke`,{method:'POST',body:{},headers:{...headers(credential,key,correlation),'If-Match':`"${share.version}"`},signal}),share);
      if(revoked.id!==share.id||revoked.status!=='REVOKED'||revoked.resources.map(resourceKey).sort().join()!==share.resources.map(resourceKey).sort().join())throw invalid();return revoked;
    },
  };
}
export const medicalSharingApi=createMedicalSharingApi();
export type MedicalSharingApi=ReturnType<typeof createMedicalSharingApi>;
