import { apiClient, type ApiClient } from '@/api/client';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join()===keys.sort().join();
const instant=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const timeZone=(value:unknown):value is string=>{if(!text(value)||String(value).length>64)return false;try{new Intl.DateTimeFormat('en-US',{timeZone:String(value)}).format(0);return true;}catch{return false;}};

export type SpecialistDiscoveryOption=Readonly<{kind:'SPECIALTY';specialtyId:string;name:string}|{kind:'SERVICE';serviceId:string;specialtyId:string;serviceCode:string;name:string}>;
export type SpecialistDiscoveryOptions=Readonly<{observedAt:string;specialties:readonly {specialtyId:string;name:string}[];services:readonly {serviceId:string;specialtyId:string;serviceCode:string;name:string}[]}>;
export type SpecialistDiscoverySlot=Readonly<{slotId:string;startsAt:string;endsAt:string;expectedVersion:number}>;
export type SpecialistDiscoveryDoctor=Readonly<{specialtyId:string;specialtyName:string;doctorId:string;doctorName:string;serviceId:string;serviceCode:string;serviceName:string;clinicId:string;clinicName:string;locationId:string;address:string;timezone:string;latitude:number|null;longitude:number|null;slots:SpecialistDiscoverySlot[]}>;
export type SpecialistDiscoverySnapshot=Readonly<{observedAt:string;limit:number;doctors:SpecialistDiscoveryDoctor[]}>;
export type SpecialistDiscoverySelection=Readonly<{specialtyId:string;doctorId:string;serviceId:string;clinicId:string;locationId:string;slotId:string;expectedSlotVersion:number}>;
export type SpecialistSelection=Readonly<{specialtyId:string;specialtyName:string;doctorId:string;doctorName:string;serviceId:string;clinicId:string;locationId:string;slots:readonly SpecialistDiscoverySlot[]}>;

function text(value:unknown){return typeof value==='string'&&value.trim().length>0&&value.length<=240;}
function parseOptions(raw:unknown):SpecialistDiscoveryOptions{
  if(!raw||typeof raw!=='object')throw new Error('INVALID_SPECIALIST_OPTIONS_RESPONSE');
  const value=raw as Record<string,unknown>;
  if(!exact(value,['observedAt','specialties','services'])||!instant(value.observedAt)||!Array.isArray(value.specialties)||!Array.isArray(value.services)||value.specialties.length>100||value.services.length>100)throw new Error('INVALID_SPECIALIST_OPTIONS_RESPONSE');
  const specialties=value.specialties.map(rawOption=>{if(!rawOption||typeof rawOption!=='object')throw new Error('INVALID_SPECIALIST_OPTIONS_RESPONSE');const option=rawOption as Record<string,unknown>;if(!exact(option,['specialtyId','name'])||typeof option.specialtyId!=='string'||!UUID.test(option.specialtyId)||!text(option.name))throw new Error('INVALID_SPECIALIST_OPTIONS_RESPONSE');return{specialtyId:option.specialtyId,name:option.name as string};});
  const services=value.services.map(rawOption=>{if(!rawOption||typeof rawOption!=='object')throw new Error('INVALID_SPECIALIST_OPTIONS_RESPONSE');const option=rawOption as Record<string,unknown>;if(!exact(option,['serviceId','specialtyId','serviceCode','name'])||typeof option.serviceId!=='string'||!UUID.test(option.serviceId)||typeof option.specialtyId!=='string'||!UUID.test(option.specialtyId)||typeof option.serviceCode!=='string'||!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(option.serviceCode)||!text(option.name))throw new Error('INVALID_SPECIALIST_OPTIONS_RESPONSE');return{serviceId:option.serviceId,specialtyId:option.specialtyId,serviceCode:option.serviceCode,name:option.name as string};});
  return{observedAt:value.observedAt,specialties,services};
}

export function parseSpecialistDiscovery(raw:unknown):SpecialistDiscoverySnapshot{
  if(!raw||typeof raw!=='object')throw new Error('INVALID_SPECIALIST_DISCOVERY_RESPONSE');
  const value=raw as Record<string,unknown>;
  if(!exact(value,['observedAt','limit','doctors'])||!instant(value.observedAt)||!Number.isInteger(value.limit)||Number(value.limit)<1||Number(value.limit)>50||!Array.isArray(value.doctors)||value.doctors.length>Number(value.limit))throw new Error('INVALID_SPECIALIST_DISCOVERY_RESPONSE');
  const doctors=value.doctors.map(rawDoctor=>{if(!rawDoctor||typeof rawDoctor!=='object')throw new Error('INVALID_SPECIALIST_DISCOVERY_RESPONSE');const doctor=rawDoctor as Record<string,unknown>;
    if(!exact(doctor,['specialtyId','specialtyName','doctorId','doctorName','serviceId','serviceCode','serviceName','clinicId','clinicName','locationId','address','timezone','latitude','longitude','slots'])||!['specialtyId','doctorId','serviceId','clinicId','locationId'].every(key=>typeof doctor[key]==='string'&&UUID.test(doctor[key] as string))||!['specialtyName','doctorName','serviceCode','serviceName','clinicName','address'].every(key=>text(doctor[key]))||!timeZone(doctor.timezone)||(doctor.latitude!==null&&(typeof doctor.latitude!=='number'||!Number.isFinite(doctor.latitude)||doctor.latitude< -90||doctor.latitude>90))||(doctor.longitude!==null&&(typeof doctor.longitude!=='number'||!Number.isFinite(doctor.longitude)||doctor.longitude< -180||doctor.longitude>180))||!Array.isArray(doctor.slots)||doctor.slots.length>5)throw new Error('INVALID_SPECIALIST_DISCOVERY_RESPONSE');
    const slots=doctor.slots.map(rawSlot=>{if(!rawSlot||typeof rawSlot!=='object')throw new Error('INVALID_SPECIALIST_DISCOVERY_RESPONSE');const slot=rawSlot as Record<string,unknown>;if(!exact(slot,['slotId','startsAt','endsAt','expectedVersion'])||typeof slot.slotId!=='string'||!UUID.test(slot.slotId)||!instant(slot.startsAt)||!instant(slot.endsAt)||Date.parse(slot.endsAt as string)<=Date.parse(slot.startsAt as string)||!Number.isInteger(slot.expectedVersion)||Number(slot.expectedVersion)<1)throw new Error('INVALID_SPECIALIST_DISCOVERY_RESPONSE');return slot as SpecialistDiscoverySlot;});
    return{...doctor,slots} as SpecialistDiscoveryDoctor;
  });
  return{observedAt:value.observedAt,limit:Number(value.limit),doctors};
}

export function createSpecialistDiscoveryApi(client:ApiClient=apiClient){return{
  async options(credential:string,signal?:AbortSignal){return parseOptions(await client.request<unknown>('v1/owner/clinic-catalog/specialist-discovery/options',{headers:{Authorization:`Bearer ${credential}`},signal}));},
  async search(credential:string,selection:SpecialistDiscoveryOption,signal?:AbortSignal){const query=selection.kind==='SPECIALTY'?`specialtyId=${encodeURIComponent(selection.specialtyId)}`:`serviceId=${encodeURIComponent(selection.serviceId)}`;return parseSpecialistDiscovery(await client.request<unknown>(`v1/owner/clinic-catalog/specialist-discovery?${query}&limit=50`,{headers:{Authorization:`Bearer ${credential}`},signal}));},
  async searchByServiceId(credential:string,serviceId:string,signal?:AbortSignal){if(!UUID.test(serviceId))throw new Error('INVALID_SPECIALIST_SERVICE_ID');return parseSpecialistDiscovery(await client.request<unknown>(`v1/owner/clinic-catalog/specialist-discovery?serviceId=${encodeURIComponent(serviceId)}&limit=50`,{headers:{Authorization:`Bearer ${credential}`},signal}));},
};}
export const specialistDiscoveryApi=createSpecialistDiscoveryApi();
