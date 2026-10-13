import {createRequire} from 'node:module';import {syntheticEnv} from './env.mjs';
Object.assign(process.env,syntheticEnv);const require=createRequire(import.meta.url);const {connect,NS,uid,externalId,nativeDataset}=require('../../backend/scripts/seed-local-multi-clinic.cjs');const {credential,api}=await import('./identity.mjs');
const expiredStage=process.argv.includes('--expired-stage'),terminalOnly=process.argv.includes('--terminal-only');
const c=await connect();let made=0,reused=0;const sessions=new Map();
try{
 const raw=async kind=>(await c.query('SELECT payload FROM synthetic_fixture.raw WHERE namespace=$1 AND kind=$2 ORDER BY external_id',[NS,kind])).rows.map(x=>nativeDataset({rows:[x.payload]}).rows[0]);
 const accounts=await raw('accounts'),bookings=await raw('bookings'),sourceSlots=new Map((await raw('appointment_slots')).map(s=>[s.slot_id,s]));
 const anchor=(await c.query("SELECT ((clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date+1)::text AS anchor")).rows[0].anchor;
 const getSession=async a=>{if(!sessions.has(a.account_id))sessions.set(a.account_id,await credential(a));return sessions.get(a.account_id);};
 for(const b of bookings.sort((a,b)=>(a.state==='PENDING_CONFIRMATION'?1:0)-(b.state==='PENDING_CONFIRMATION'?1:0))){
  if(expiredStage?b.state!=='EXPIRED':b.state==='EXPIRED'||(terminalOnly&&b.state==='PENDING_CONFIRMATION'))continue;
  const mappingKind=expiredStage?'awaiting_expiry':'booking';
  const sourceKey=externalId(b.booking_id);
  if((await c.query("SELECT 1 FROM synthetic_fixture.mapping WHERE namespace=$1 AND kind=$3 AND external_id=$2",[NS,sourceKey,mappingKind])).rowCount){reused++;continue;}
  const slot=(await c.query(`SELECT s.id,s.service_id,s.version,service.code FROM clinic_schema.appointment_slots s JOIN synthetic_fixture.mapping m ON m.internal_id=s.id AND m.namespace=$1 AND m.kind='slot' JOIN clinic_schema.clinic_services service ON service.id=s.service_id WHERE s.staff_id=$2::uuid AND s.starts_at=$3::timestamptz ORDER BY s.starts_at LIMIT 1`,[NS,b.doctor_id,new Date(Date.parse(sourceSlots.get(b.slot_id).start_at_local+'+03:00')+(Date.parse(anchor)-Date.parse('2026-10-13'))).toISOString()])).rows[0];
  if(!slot||slot.code!==b.service_code)throw Error('SOURCE_SERVICE_BINDING_MISMATCH');
  const owner=await getSession(accounts.find(a=>a.owner_id===b.owner_id));const admin=await getSession(accounts.find(a=>a.clinic_id===b.clinic_id&&a.role==='CLINIC_ADMIN'));
  const commandKey=uid('replay-create:'+sourceKey);const accepted=await c.query("SELECT response_body FROM booking_schema.idempotency_records WHERE scope=$1 AND idempotency_key=$2 AND status='COMPLETED'",['booking.create-local-hold:'+b.owner_id,commandKey]);
  const created=accepted.rowCount?{status:201,json:accepted.rows[0].response_body}:await api('/v1/booking-holds',owner,'POST',{petId:b.pet_id,clinicId:b.clinic_id,locationId:b.location_id,serviceId:slot.service_id,slotId:slot.id,expectedSlotVersion:slot.version},null,commandKey);
  if(created.status>=300)throw Error('REPLAY_CREATE:'+JSON.stringify(created));
  const id=created.json.holdId;
  let detail=await api(`/v1/owner/appointments/${id}`,owner);
  if(!expiredStage&&b.state!=='PENDING_CONFIRMATION'){
   const path=b.state==='CANCELLED'?`/v1/owner/bookings/${id}/cancel`:`/v1/clinic/booking-holds/${id}/${b.state==='CONFIRMED'?'confirm':'decline'}`;
   const expected=['REJECTED','CANCELLED'].includes(b.state)?'RELEASED':b.state;
   if(detail.json.state!==expected){const result=await api(path,b.state==='CANCELLED'?owner:admin,'POST',b.state==='REJECTED'?{declineReason:'СИНТЕТИЧЕСКИЙ replay исходного отказа'}:{},detail.json.version,uid('replay-decide:'+sourceKey));if(result.status>=300)throw Error('REPLAY_DECISION:'+JSON.stringify(result));}
  }
  await c.query("INSERT INTO synthetic_fixture.mapping VALUES($1,$4,$2,$3) ON CONFLICT DO NOTHING",[NS,sourceKey,id,mappingKind]);made++;
 }
 console.log(JSON.stringify({reproduced:made,reused,phase:expiredStage?'WAITING_REAL_DATABASE_TTL':terminalOnly?'TERMINALS':'PENDING_SOURCE',noBackdating:true}));
}finally{await c.end();}
