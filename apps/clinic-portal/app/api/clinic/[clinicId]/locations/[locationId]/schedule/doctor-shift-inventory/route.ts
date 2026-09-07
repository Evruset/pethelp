import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ clinicId: string; locationId: string }> };
const base = () => { const value=process.env.VETHELP_API_BASE_URL; if(!value) throw new Error('VETHELP_API_BASE_URL is not configured'); return value.replace(/\/$/,''); };

async function authority(context: Context) {
  const { clinicId, locationId } = await context.params; const session = await getClinicSession();
  return { clinicId, locationId, session, allowed: Boolean(session && UUID.test(clinicId) && UUID.test(locationId) && canAccessClinicLocation(session, clinicId, locationId)) };
}

export async function GET(request: Request, context: Context) {
  const auth=await authority(context); if(!auth.allowed||!auth.session) return NextResponse.json({code:'LOCATION_SCOPE_DENIED'},{status:403});
  const source=new URL(request.url); const upstream=new URL(`${base()}/v1/clinic/${auth.clinicId}/locations/${auth.locationId}/schedule/doctor-shifts`);
  upstream.searchParams.set('from',source.searchParams.get('from')??new Date().toISOString()); upstream.searchParams.set('to',source.searchParams.get('to')??new Date(Date.now()+14*86_400_000).toISOString());
  try { const response=await fetch(upstream,{headers:{Authorization:`Bearer ${auth.session.token}`,Accept:'application/json'},cache:'no-store'}); return NextResponse.json(await response.json(),{status:response.status,headers:{'Cache-Control':'no-store'}}); }
  catch { return NextResponse.json({code:'BACKEND_UNAVAILABLE'},{status:503}); }
}

export async function POST(request: Request, context: Context) {
  const auth=await authority(context); if(!auth.allowed||!auth.session||!auth.session.roles.includes('CLINIC_ADMIN')) return NextResponse.json({code:'LOCATION_SCOPE_DENIED'},{status:403});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null; const action=body?.action;
  const routes:Record<string,(body:Record<string,unknown>)=>string>={
    'map-doctor':()=>`doctor-mappings`, 'assign-service':()=>`doctor-services`, 'create-shift':()=>`doctor-shifts`,
    generate:(value)=>`doctor-shifts/${value.shiftId}/generate`, publish:(value)=>`inventory-runs/${value.runId}/publish`,
    unpublish:(value)=>`inventory-runs/${value.runId}/unpublish`, block:(value)=>`doctor-shifts/${value.shiftId}/block`,
    cancel:(value)=>`doctor-shifts/${value.shiftId}/cancel`, update:(value)=>`doctor-shifts/${value.shiftId}`,
  };
  if(typeof action!=='string'||!routes[action]||!body) return NextResponse.json({code:'INVALID_REQUEST'},{status:400});
  if(['generate','block','cancel','update'].includes(action)&&!UUID.test(String(body.shiftId??''))) return NextResponse.json({code:'INVALID_REQUEST'},{status:400});
  if(['publish','unpublish'].includes(action)&&!UUID.test(String(body.runId??''))) return NextResponse.json({code:'INVALID_REQUEST'},{status:400});
  const key=request.headers.get('Idempotency-Key'); if(!key||!UUID.test(key)) return NextResponse.json({code:'INVALID_REQUEST'},{status:400});
  const path=routes[action](body); if(path.includes('undefined')) return NextResponse.json({code:'INVALID_REQUEST'},{status:400});
  const payload={...body}; delete payload.action; const correlation=request.headers.get('X-Correlation-ID');
  try { const response=await fetch(`${base()}/v1/clinic/${auth.clinicId}/locations/${auth.locationId}/schedule/${path}`,{method:'POST',headers:{Authorization:`Bearer ${auth.session.token}`,Accept:'application/json','Content-Type':'application/json','Idempotency-Key':key,'X-Correlation-ID':correlation&&UUID.test(correlation)?correlation:randomUUID(),...(request.headers.get('If-Match')?{'If-Match':request.headers.get('If-Match')!}:{})},body:JSON.stringify(payload),cache:'no-store'}); return NextResponse.json(await response.json().catch(()=>({code:'BACKEND_UNAVAILABLE'})),{status:response.status,headers:{'Cache-Control':'no-store'}}); }
  catch { return NextResponse.json({code:'BACKEND_UNAVAILABLE'},{status:503}); }
}
