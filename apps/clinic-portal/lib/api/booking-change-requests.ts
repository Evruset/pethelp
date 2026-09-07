import type { ClinicSession } from '@/lib/auth/clinic-session';

export type ChangeRequestStatus='OPEN'|'PROCESSING'|'COMPLETED'|'REJECTED'|'CANCELLED';
export type ChangeRequest={requestId:string;requestType:'CANCEL'|'RESCHEDULE';status:ChangeRequestStatus;bookingHoldId:string;appointmentId:string|null;clinicId:string;locationId:string;slotId:string;version:number;createdAt:string;stateChangedAt:string;updatedAt:string;terminalAt:string|null};
export type ReplacementSlot={slotId:string;startsAt:string;endsAt:string;version:number};
export type ChangeRequestDetail=ChangeRequest&{serverNow:string;currentBookingStatus:string;currentAppointmentStatus:string|null;replacementSlots:ReplacementSlot[]};
export type ChangeRequestPage={observedAt:string;items:ChangeRequest[]};
export class ChangeRequestBackendError extends Error{constructor(public status:number,public code:string){super(code);}}
const base=()=>{const value=process.env.VETHELP_API_BASE_URL;if(!value)throw new Error('VETHELP_API_BASE_URL is not configured');return value.replace(/\/$/,'');};
const code=async(response:Response)=>{const payload=await response.json().catch(()=>null) as {code?:unknown}|null;return typeof payload?.code==='string'?payload.code:'BACKEND_UNAVAILABLE';};
async function call<T>(session:ClinicSession,path:string,init?:RequestInit):Promise<T>{const response=await fetch(`${base()}${path}`,{...init,headers:{Authorization:`Bearer ${session.token}`,Accept:'application/json',...init?.headers},cache:'no-store'});if(!response.ok)throw new ChangeRequestBackendError(response.status,await code(response));return response.json() as Promise<T>;}
export const getChangeRequests=(session:ClinicSession,locationId?:string)=>call<ChangeRequestPage>(session,`/v1/operations/booking-change-requests?limit=25${locationId?`&locationId=${encodeURIComponent(locationId)}`:''}`);
export const getChangeRequest=(session:ClinicSession,id:string)=>call<ChangeRequestDetail>(session,`/v1/operations/booking-change-requests/${encodeURIComponent(id)}`);
export const transitionChangeRequest=(session:ClinicSession,id:string,command:string,version:number,key:string,body:unknown={})=>call<ChangeRequestDetail>(session,`/v1/operations/booking-change-requests/${encodeURIComponent(id)}/${command}`,{method:'POST',headers:{'Idempotency-Key':key,'If-Match':String(version),'Content-Type':'application/json'},body:JSON.stringify(body)});
