import {NextResponse} from 'next/server';
import {isClinicAppointmentsRegistryEnabled} from '@/app/design-system/feature-flags';
import {getClinicSession,canAccessClinicLocation} from '@/lib/auth/clinic-session';
import {getEffectiveSession,hasCapability,hasClinicScope} from '@/lib/auth/effective-session';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(code:string,status:number)=>NextResponse.json({code},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request,context:{params:Promise<{clinicId:string;locationId:string;appointmentId:string;action:string}>}){
 const {clinicId,locationId,appointmentId,action}=await context.params;
 if(!isClinicAppointmentsRegistryEnabled()||!['cancel','reschedule-proposals'].includes(action))return reply('NOT_FOUND',404);
 const session=await getClinicSession();if(!session||![clinicId,locationId,appointmentId].every(id=>uuid.test(id))||!canAccessClinicLocation(session,clinicId,locationId)||!session.roles.some(role=>['CLINIC_ADMIN','CLINIC_RECEPTIONIST'].includes(role)))return reply('LOCATION_SCOPE_DENIED',403);
 const key=request.headers.get('Idempotency-Key'),match=request.headers.get('If-Match'),correlation=request.headers.get('X-Correlation-ID');
 if(!key||!uuid.test(key)||!match||!/^(?:[1-9]\d*|"[1-9]\d*")$/.test(match)||!correlation||!uuid.test(correlation))return reply('INVALID_REQUEST',400);
 if(Number(request.headers.get('Content-Length')??0)>4096)return reply('INVALID_REQUEST',400);
 const raw=await request.text();if(raw.length>4096)return reply('INVALID_REQUEST',400);
 let body:Record<string,unknown>;try{body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return reply('INVALID_REQUEST',400);}
 const permitted=action==='cancel'?['reasonCode','reasonText']:['targetSlotId','expectedTargetSlotVersion'];
 if(Object.keys(body).some(key=>!permitted.includes(key)))return reply('INVALID_REQUEST',400);
 if(action==='cancel' && !(typeof body.reasonText==='string'&&body.reasonText.trim().length>0&&body.reasonText.length<=500))return reply('INVALID_REQUEST',400);
 if(action==='reschedule-proposals' && !(typeof body.targetSlotId==='string'&&uuid.test(body.targetSlotId)&&Number.isSafeInteger(body.expectedTargetSlotVersion)&&Number(body.expectedTargetSlotVersion)>0))return reply('INVALID_REQUEST',400);
 try{
  const effective=await getEffectiveSession(session);if(!hasCapability(effective,'appointment.registry.read')||!hasClinicScope(effective,clinicId,locationId))return reply('LOCATION_SCOPE_DENIED',403);
  const upstream=await fetch(`${(process.env.VETHELP_API_BASE_URL??'').replace(/\/$/,'')}/v1/clinic/${clinicId}/locations/${locationId}/appointments/${appointmentId}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json','Idempotency-Key':key,'If-Match':match,'X-Correlation-ID':correlation},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!upstream.ok)return reply(upstream.status===409?'BOOKING_STATE_CONFLICT':upstream.status===422?'INVALID_STATE_TRANSITION':'COMMAND_UNAVAILABLE',upstream.status);
  const result=await upstream.json();if(result.appointmentId!==appointmentId||!Number.isSafeInteger(result.aggregateVersion)||result.aggregateVersion<=Number(match.replaceAll('"',''))||result.lifecycle!==(action==='cancel'?'CANCELLED_BY_CLINIC':'RESCHEDULE_PROPOSED')||(action==='reschedule-proposals'&&(result.targetSlotId!==body.targetSlotId||typeof result.proposalId!=='string'||!uuid.test(result.proposalId))))return reply('INVALID_RESPONSE',502);
  return NextResponse.json({appointmentId:result.appointmentId,aggregateVersion:result.aggregateVersion,lifecycle:result.lifecycle,...(action==='reschedule-proposals'?{proposalId:result.proposalId,targetSlotId:result.targetSlotId}:{})},{headers:{'Cache-Control':'no-store'}});
 }catch{return reply('BACKEND_UNAVAILABLE',503);}
}
