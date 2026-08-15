import { apiClient, type ApiClient } from '@/api/client';

export type ClinicCatalogItem = Readonly<{ clinicId: string; locationId: string; name: string; address: string; phone: string | null }>;
export type ClinicCatalogHandoff = Readonly<{ clinicId: string; locationId: string }>;
export type ClinicCatalogSnapshot = Readonly<{ observedAt: string; clinics: ClinicCatalogItem[] }>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parse(value:unknown):ClinicCatalogSnapshot {
  if(!value||typeof value!=='object')throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
  const v=value as Record<string,unknown>;
  if(Object.keys(v).sort().join()!=='clinics,observedAt'||typeof v.observedAt!=='string'||!Number.isFinite(Date.parse(v.observedAt))||!Array.isArray(v.clinics))throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
  return {observedAt:v.observedAt,clinics:v.clinics.map((raw)=>{
    if(!raw||typeof raw!=='object')throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
    const item=raw as Record<string,unknown>;
    if(Object.keys(item).sort().join()!=='address,clinicId,locationId,name,phone'||typeof item.clinicId!=='string'||!UUID.test(item.clinicId)||typeof item.locationId!=='string'||!UUID.test(item.locationId)||typeof item.name!=='string'||typeof item.address!=='string'||!(item.phone===null||typeof item.phone==='string'))throw new Error('INVALID_CLINIC_CATALOG_RESPONSE');
    return {clinicId:item.clinicId,locationId:item.locationId,name:item.name,address:item.address,phone:item.phone};
  })};
}

export function createClinicCatalogApi(client:ApiClient=apiClient){return {async list(credential:string,signal?:AbortSignal){return parse(await client.request<unknown>('v1/owner/clinic-catalog',{headers:{Authorization:`Bearer ${credential}`},signal}));}};}
export const clinicCatalogApi=createClinicCatalogApi();
