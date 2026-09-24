import { apiClient, type ApiClient } from '@/api/client';

export type ClinicDoctor = Readonly<{ id: string; displayName: string; title: 'Ветеринарный врач'; nextAvailableAt: string | null; freshness: 'CURRENT'|'AGING'|'STALE'|'UNAVAILABLE' }>;
export type ClinicDoctorsSnapshot = Readonly<{ observedAt: string; doctors: ClinicDoctor[] }>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join()===keys.sort().join();

function parse(raw:unknown):ClinicDoctorsSnapshot {
  if(!raw||typeof raw!=='object')throw new Error('INVALID_DOCTORS_RESPONSE');
  const value=raw as Record<string,unknown>;
  if(!exact(value,['observedAt','doctors','personalization'])||typeof value.observedAt!=='string'||!Number.isFinite(Date.parse(value.observedAt))||!Array.isArray(value.doctors))throw new Error('INVALID_DOCTORS_RESPONSE');
  return {observedAt:value.observedAt,doctors:value.doctors.map((rawDoctor)=>{
    if(!rawDoctor||typeof rawDoctor!=='object')throw new Error('INVALID_DOCTORS_RESPONSE');
    const doctor=rawDoctor as Record<string,unknown>;
    const clinic=doctor.clinic as Record<string,unknown>|null;
    const location=doctor.location as Record<string,unknown>|null;
    const availability=doctor.availability as Record<string,unknown>|null;
    if(!exact(doctor,['id','displayName','title','clinic','location','nextAvailableAt','availability'])||typeof doctor.id!=='string'||!UUID.test(doctor.id)||typeof doctor.displayName!=='string'||doctor.title!=='Ветеринарный врач'||!(doctor.nextAvailableAt===null||(typeof doctor.nextAvailableAt==='string'&&Number.isFinite(Date.parse(doctor.nextAvailableAt))))||!clinic||!exact(clinic,['id','name'])||!UUID.test(String(clinic.id))||typeof clinic.name!=='string'||!location||!exact(location,['id','address'])||!UUID.test(String(location.id))||typeof location.address!=='string'||!availability||!exact(availability,['sourceUpdatedAt','serverNow','freshness','confirmationMode'])||typeof availability.serverNow!=='string'||!Number.isFinite(Date.parse(availability.serverNow))||!(availability.sourceUpdatedAt===null||(typeof availability.sourceUpdatedAt==='string'&&Number.isFinite(Date.parse(availability.sourceUpdatedAt))))||!['CURRENT','AGING','STALE','UNAVAILABLE'].includes(String(availability.freshness))||availability.confirmationMode!=='CLINIC_CONFIRMATION')throw new Error('INVALID_DOCTORS_RESPONSE');
    return {id:doctor.id,displayName:doctor.displayName,title:doctor.title,nextAvailableAt:doctor.nextAvailableAt,freshness:availability.freshness as ClinicDoctor['freshness']};
  })};
}

export function createDoctorApi(client:ApiClient=apiClient){return{async list(credential:string,clinicId:string,locationId:string,signal?:AbortSignal){return parse(await client.request<unknown>(`v1/clinics/${clinicId}/doctors?locationId=${locationId}`,{headers:{Authorization:`Bearer ${credential}`},signal}));}};}
export const doctorApi=createDoctorApi();
