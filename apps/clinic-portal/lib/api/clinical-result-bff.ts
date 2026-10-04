import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';
export const CLINICAL_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const base=()=>{const value=process.env.VETHELP_API_BASE_URL;if(!value)throw new Error('VETHELP_API_BASE_URL is not configured');return value.replace(/\/$/,'');};
export async function clinicalMutation(request:Request,path:string,method:'POST'|'PATCH',body:Record<string,unknown>|undefined,headers:Record<string,string>={}){
 const session=await getClinicSession();if(!session?.roles.includes('CLINIC_VETERINARIAN'))return NextResponse.json({code:'CLINIC_SCOPE_MISMATCH'},{status:403,headers:{'Cache-Control':'no-store'}});
 const supplied=request.headers.get('X-Correlation-ID');const correlation=supplied&&CLINICAL_UUID.test(supplied)?supplied:randomUUID();
 try{const response=await fetch(`${base()}${path}`,{method,headers:{Authorization:`Bearer ${session.token}`,Accept:'application/json','Content-Type':'application/json','X-Correlation-ID':correlation,...headers},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const payload=await response.json().catch(()=>({code:'BACKEND_UNAVAILABLE'}));return NextResponse.json(payload,{status:response.status,headers:{'Cache-Control':'no-store','X-Correlation-ID':correlation}});}catch{return NextResponse.json({code:'BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store','X-Correlation-ID':correlation}});}
}
export async function boundedText(request:Request,field:string){const payload:unknown=await request.json().catch(()=>null);if(!payload||typeof payload!=='object')return null;const value=(payload as Record<string,unknown>)[field];return typeof value==='string'&&value.trim().length>=3&&value.trim().length<=8000?value:null;}
export const invalidClinicalRequest=()=>NextResponse.json({code:'INVALID_CLINICAL_CONTENT'},{status:400,headers:{'Cache-Control':'no-store'}});
export const idempotencyKey=(request:Request)=>{const value=request.headers.get('Idempotency-Key');return value&&CLINICAL_UUID.test(value)?value:randomUUID();};
