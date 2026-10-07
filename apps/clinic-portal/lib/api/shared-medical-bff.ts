import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';
import { MEDICAL_UUID, parseSharedList, parseSharedResource, type SharedRef } from './shared-medical';
const denied=()=>NextResponse.json({code:'MEDICAL_SHARE_NOT_FOUND'},{status:404,headers:{'Cache-Control':'private, no-store'}});
export async function sharedMedicalRead(appointmentId:string,resource?:SharedRef){
  const session=await getClinicSession();
  if(!session?.roles.includes('CLINIC_VETERINARIAN')||!MEDICAL_UUID.test(appointmentId)||resource&&(!MEDICAL_UUID.test(resource.id)||!['RESULT','AMENDMENT','DOCUMENT'].includes(resource.type)))return denied();
  const base=process.env.VETHELP_API_BASE_URL?.replace(/\/$/,'');
  if(!base)return NextResponse.json({code:'BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  try{
    const suffix=resource?`/resources/${resource.type}/${resource.id}`:'';
    const response=await fetch(`${base}/v1/clinic/appointments/${appointmentId}/medical-shares${suffix}`,{headers:{Authorization:`Bearer ${session.token}`,Accept:'application/json'},cache:'no-store'});
    if([401,403,404].includes(response.status))return denied();
    if(!response.ok)throw new Error('UPSTREAM_UNAVAILABLE');
    const value:unknown=await response.json();
    const payload=resource?parseSharedResource(value,resource):{appointmentId,status:parseSharedList(value,appointmentId).length?'SHARED':'NOT_SHARED',resources:parseSharedList(value,appointmentId)};
    return NextResponse.json(payload,{headers:{'Cache-Control':'private, no-store'}});
  }catch{return NextResponse.json({code:'BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
export async function sharedDocumentDownload(appointmentId:string,documentId:string){
  const session=await getClinicSession();
  if(!session?.roles.includes('CLINIC_VETERINARIAN')||!MEDICAL_UUID.test(appointmentId)||!MEDICAL_UUID.test(documentId))return denied();
  const base=process.env.VETHELP_API_BASE_URL?.replace(/\/$/,'');
  try{
    if(!base)throw new Error('UNAVAILABLE');
    const response=await fetch(`${base}/v1/clinic/appointments/${appointmentId}/medical-shares/resources/DOCUMENT/${documentId}/download`,{headers:{Authorization:`Bearer ${session.token}`},cache:'no-store',redirect:'error'});
    if([401,403,404].includes(response.status))return denied();
    if(response.status!==200||!response.body)throw new Error('UNAVAILABLE');
    const mime=response.headers.get('Content-Type'),length=response.headers.get('Content-Length'),disposition=response.headers.get('Content-Disposition');
    if(!mime||!length||!/^[1-9]\d*$/.test(length)||!Number.isSafeInteger(Number(length))||!disposition?.startsWith('attachment; filename="'))throw new Error('UNAVAILABLE');
    return new NextResponse(response.body,{headers:{'Content-Type':mime,'Content-Length':length,'Content-Disposition':disposition,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return NextResponse.json({code:'BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
