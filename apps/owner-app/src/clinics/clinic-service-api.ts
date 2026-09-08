import { apiClient, type ApiClient } from '@/api/client';

export type ClinicServiceHandoff=Readonly<{clinicId:string;locationId:string;serviceId:string}>;
export type ClinicService=Readonly<{serviceId:string;name:string;price:Readonly<{kind:'INFORMATIONAL';amount:string;currency:string}>}>;
export type ClinicServiceSnapshot=Readonly<{observedAt:string;clinicId:string;locationId:string;name:string;address:string;phone:string|null;services:ClinicService[]}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join()===keys.sort().join();
export function parseClinicServiceSnapshot(raw:unknown):ClinicServiceSnapshot{
  if(!raw||typeof raw!=='object')throw new Error('INVALID_CLINIC_SERVICE_RESPONSE');
  const value=raw as Record<string,unknown>;
  if(!exact(value,['observedAt','clinicId','locationId','name','address','phone','services'])||typeof value.observedAt!=='string'||!Number.isFinite(Date.parse(value.observedAt))||typeof value.clinicId!=='string'||!UUID.test(value.clinicId)||typeof value.locationId!=='string'||!UUID.test(value.locationId)||typeof value.name!=='string'||typeof value.address!=='string'||!(value.phone===null||typeof value.phone==='string')||!Array.isArray(value.services))throw new Error('INVALID_CLINIC_SERVICE_RESPONSE');
  const services=value.services.map(rawService=>{if(!rawService||typeof rawService!=='object')throw new Error('INVALID_CLINIC_SERVICE_RESPONSE');const service=rawService as Record<string,unknown>;const price=service.price as Record<string,unknown>|null;if(!exact(service,['serviceId','name','price'])||typeof service.serviceId!=='string'||!UUID.test(service.serviceId)||typeof service.name!=='string'||!price||typeof price!=='object'||!exact(price,['kind','amount','currency'])||price.kind!=='INFORMATIONAL'||typeof price.amount!=='string'||!/^\d{1,10}\.\d{2}$/.test(price.amount)||typeof price.currency!=='string'||!/^[A-Z]{3}$/.test(price.currency))throw new Error('INVALID_CLINIC_SERVICE_RESPONSE');return {serviceId:service.serviceId,name:service.name,price:{kind:'INFORMATIONAL' as const,amount:price.amount,currency:price.currency}};});
  return {observedAt:value.observedAt,clinicId:value.clinicId,locationId:value.locationId,name:value.name,address:value.address,phone:value.phone,services};
}
export function createClinicServiceApi(client:ApiClient=apiClient){return{async read(credential:string,clinicId:string,locationId:string,signal?:AbortSignal){return parseClinicServiceSnapshot(await client.request<unknown>(`v1/owner/clinic-catalog/${clinicId}/locations/${locationId}`,{headers:{Authorization:`Bearer ${credential}`},signal}));}};}
export const clinicServiceApi=createClinicServiceApi();
