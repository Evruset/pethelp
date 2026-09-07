import { apiClient, type ApiClient } from '@/api/client';

export type ClinicCatalogItem = Readonly<{ clinicId: string; locationId: string; name: string; address: string; phone: string | null; decisionSummary: Readonly<{ nextAvailability: Readonly<{ startsAt: string; localDate: string; localTime: string; timezone: string }> | null; informationalPrice: Readonly<{ kind: 'FROM'; amount: string; currency: string }> | null; confirmation: Readonly<{ mode: 'MANUAL' }> }> }>;
export type ClinicCatalogHandoff = Readonly<{ clinicId: string; locationId: string }>;
export type ClinicCatalogSnapshot = Readonly<{ observedAt: string; clinics: ClinicCatalogItem[] }>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join()===keys.sort().join();
const calendarDate=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day;};
const instant=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))return false;return calendarDate(value.slice(0,10));};
const timezone=(value:unknown)=>{if(typeof value!=='string'||value.length>64)return false;try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format(0);return true;}catch{return false;}};

function decisionSummary(raw:unknown):ClinicCatalogItem['decisionSummary'] {
  if(!raw||typeof raw!=='object'||!exact(raw as Record<string,unknown>,['nextAvailability','informationalPrice','confirmation']))throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
  const value=raw as Record<string,unknown>,confirmation=value.confirmation as Record<string,unknown>;
  if(!confirmation||typeof confirmation!=='object'||!exact(confirmation,['mode'])||confirmation.mode!=='MANUAL')throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
  let nextAvailability:ClinicCatalogItem['decisionSummary']['nextAvailability']=null;
  if(value.nextAvailability!==null){const next=value.nextAvailability as Record<string,unknown>;if(!next||typeof next!=='object'||!exact(next,['startsAt','localDate','localTime','timezone'])||!instant(next.startsAt)||!calendarDate(next.localDate)||typeof next.localTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.localTime)||!timezone(next.timezone))throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');nextAvailability=next as ClinicCatalogItem['decisionSummary']['nextAvailability'];}
  let informationalPrice:ClinicCatalogItem['decisionSummary']['informationalPrice']=null;
  if(value.informationalPrice!==null){const price=value.informationalPrice as Record<string,unknown>;if(!price||typeof price!=='object'||!exact(price,['kind','amount','currency'])||price.kind!=='FROM'||typeof price.amount!=='string'||!/^\d{1,10}\.\d{2}$/.test(price.amount)||typeof price.currency!=='string'||!/^[A-Z]{3}$/.test(price.currency))throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');informationalPrice=price as ClinicCatalogItem['decisionSummary']['informationalPrice'];}
  return {nextAvailability,informationalPrice,confirmation:{mode:'MANUAL'}};
}

function parse(value:unknown):ClinicCatalogSnapshot {
  if(!value||typeof value!=='object')throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
  const v=value as Record<string,unknown>;
  if(Object.keys(v).sort().join()!=='clinics,observedAt'||typeof v.observedAt!=='string'||!Number.isFinite(Date.parse(v.observedAt))||!Array.isArray(v.clinics))throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
  return {observedAt:v.observedAt,clinics:v.clinics.map((raw)=>{
    if(!raw||typeof raw!=='object')throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
    const item=raw as Record<string,unknown>;
    if(Object.keys(item).sort().join()!=='address,clinicId,decisionSummary,locationId,name,phone'||typeof item.clinicId!=='string'||!UUID.test(item.clinicId)||typeof item.locationId!=='string'||!UUID.test(item.locationId)||typeof item.name!=='string'||typeof item.address!=='string'||!(item.phone===null||typeof item.phone==='string'))throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
    return {clinicId:item.clinicId,locationId:item.locationId,name:item.name,address:item.address,phone:item.phone,decisionSummary:decisionSummary(item.decisionSummary)};
  })};
}

export function createClinicCatalogApi(client:ApiClient=apiClient){return {async list(credential:string,signal?:AbortSignal){return parse(await client.request<unknown>('v1/owner/clinic-catalog',{headers:{Authorization:`Bearer ${credential}`},signal}));}};}
export const clinicCatalogApi=createClinicCatalogApi();
