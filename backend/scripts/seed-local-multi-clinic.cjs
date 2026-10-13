#!/usr/bin/env node
// Local fixture tooling only; never imported by the application or exposed as HTTP.
const {spawnSync}=require('node:child_process');
const {resolve}=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {Client}=require('pg');
const {isFixtureDatabase}=require('./synthetic/fixture-database.cjs');
const NS='VETHELP_SYNTHETIC_25_V1';
const uid=value=>{const h=createHash('sha256').update(`${NS}:${value}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const nativeId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)?id.slice(0,14)+'4'+id.slice(15):id;
const externalId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)?id.slice(0,14)+'5'+id.slice(15):id;
function nativeDataset(source){return Object.fromEntries(Object.entries(source).map(([kind,rows])=>[kind,Array.isArray(rows)?rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,k.endsWith('_id')?nativeId(v):v]))):rows]));}
function readDataset(archive){
 const r=spawnSync('python3',[resolve(__dirname,'synthetic/read-dataset.py'),archive],{encoding:'utf8',maxBuffer:24*1024*1024});
 if(r.status!==0)throw Error(`DATASET_VALIDATION_FAILED: ${r.stderr.trim()}`);
 return JSON.parse(r.stdout);
}
function guard(){
 const u=new URL(process.env.DATABASE_URL||'');
 if(!['development','test'].includes(process.env.NODE_ENV)||!['127.0.0.1','localhost'].includes(u.hostname)||!isFixtureDatabase(u.pathname.slice(1))||process.env.SYNTHETIC_FIXTURE_ACK!==NS||process.env.MVP_SCOPE_PROFILE!=='PILOT_V1'||process.env.WORKERS_ENABLED!=='false'||process.env.OCR_VERIFIED_BYTES_ENABLED!=='false')throw Error('EXCLUSIVE_LOCAL_SYNTHETIC_DATABASE_REQUIRED');
 return u;
}
async function connect(){guard();const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query('SELECT current_database() name, inet_server_addr() address');if(r.rows[0].name!==new URL(process.env.DATABASE_URL).pathname.slice(1)){await c.end();throw Error('DATABASE_IDENTITY_MISMATCH');}return c;}
async function transaction(c,fn){await c.query('BEGIN');try{const result=await fn();await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}}
async function init(c){
 await c.query(`CREATE SCHEMA IF NOT EXISTS synthetic_fixture; REVOKE ALL ON SCHEMA synthetic_fixture FROM PUBLIC;
 CREATE TABLE IF NOT EXISTS synthetic_fixture.sources(namespace text PRIMARY KEY, archive_sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
 CREATE TABLE IF NOT EXISTS synthetic_fixture.raw(namespace text NOT NULL REFERENCES synthetic_fixture.sources,kind text NOT NULL,external_id text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(namespace,kind,external_id));
 CREATE TABLE IF NOT EXISTS synthetic_fixture.mapping(namespace text NOT NULL REFERENCES synthetic_fixture.sources,kind text NOT NULL,external_id text NOT NULL,internal_id uuid NOT NULL,PRIMARY KEY(namespace,kind,external_id));
 REVOKE ALL ON ALL TABLES IN SCHEMA synthetic_fixture FROM PUBLIC;`);
}
async function map(c,kind,key,id){await c.query('INSERT INTO synthetic_fixture.mapping VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[NS,kind,key,id]);}
async function ownedInsert(c,kind,key,id,table,columns,values){
 key=externalId(key);
 const exists=await c.query(`SELECT id FROM ${table} WHERE id=$1`,[id]);
 if(exists.rowCount){const owner=await c.query('SELECT 1 FROM synthetic_fixture.mapping WHERE namespace=$1 AND kind=$2 AND external_id=$3 AND internal_id=$4',[NS,kind,key,id]);if(!owner.rowCount)throw Error(`FOREIGN_FIXTURE_COLLISION:${kind}:${key}`);return false;}
 await c.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);await map(c,kind,key,id);return true;
}
async function seed(source){
 if(guard().pathname==='/synthetic_multiclinic_v4')throw Error('PROTECTED_SYNTHETIC_BASELINE_READ_ONLY: select a reset generation');
 const d=nativeDataset(source);
 const c=await connect();let db;const stats={created:{},reused:{}};
 const count=(kind,created)=>{const dest=created?stats.created:stats.reused;dest[kind]=(dest[kind]||0)+1;};
 try{
  await c.query("SELECT pg_advisory_lock(hashtext('VETHELP_SYNTHETIC_25_V1'))");await init(c);
  // Upgrade only local transport-map keys; native slots, counters and holds remain untouched.
  await c.query(`UPDATE synthetic_fixture.mapping m SET external_id=s.staff_id::text||':'||to_char(s.starts_at AT TIME ZONE 'Europe/Moscow','YYYY-MM-DD"T"HH24:MI')||'+03:00' FROM clinic_schema.appointment_slots s WHERE m.namespace=$1 AND m.kind='slot' AND m.internal_id=s.id AND m.external_id NOT LIKE '%T%'`,[NS]);
  await transaction(c,async()=>{
   await c.query('INSERT INTO synthetic_fixture.sources VALUES($1,$2) ON CONFLICT DO NOTHING',[NS,d._sha256]);
   if((await c.query('SELECT archive_sha256 FROM synthetic_fixture.sources WHERE namespace=$1',[NS])).rows[0].archive_sha256!==d._sha256)throw Error('SOURCE_CHANGED');
  });
  for(const [kind,rows] of Object.entries(source))if(Array.isArray(rows))for(let offset=0;offset<rows.length;offset+=250)await transaction(c,async()=>{
   const chunk=rows.slice(offset,offset+250).map(r=>({id:kind==='breed_risk_reference'?`${r.risk_code}:${r.breed}`:Object.values(r)[0],payload:r}));
   await c.query(`INSERT INTO synthetic_fixture.raw SELECT $1,$2,j.id,j.payload FROM jsonb_to_recordset($3::jsonb) j(id text,payload jsonb) ON CONFLICT DO NOTHING`,[NS,kind,JSON.stringify(chunk)]);
  });
  const accounts=d.accounts.map(a=>({...a,userId:a.role==='OWNER'?a.owner_id:a.account_id,backendRole:({VETERINARIAN:'CLINIC_VETERINARIAN',RECEPTIONIST:'CLINIC_RECEPTIONIST'})[a.role]||a.role}));
  for(let i=0;i<accounts.length;i+=100)await transaction(c,async()=>{for(const a of accounts.slice(i,i+100))count('accounts',await ownedInsert(c,'account',a.account_id,a.userId,'identity_schema.users',['id'],[a.userId]));});
  const definitions=new Map(d.service_catalog.map(s=>[s.service_code,s]));
  const bookingsBySlot=new Map(d.bookings.map(b=>[b.slot_id,b]));
  const doctors=new Map(d.staff_doctors.map(x=>[x.doctor_id,x]));
  const specialtyIds=new Map();
  await transaction(c,async()=>{
   for(const code of [...new Set(d.staff_doctors.map(x=>x.specialty_code))]){
    const id=uid('specialty:'+code);const old=await c.query('SELECT id FROM catalog_schema.specialties WHERE code=$1',[code]);
    if(old.rowCount)specialtyIds.set(code,old.rows[0].id);else{await ownedInsert(c,'specialty',code,id,'catalog_schema.specialties',['id','name','code'],[id,code,code]);specialtyIds.set(code,id);}
   }
  });
  for(const clinic of d.clinics)await transaction(c,async()=>{
   count('clinics',await ownedInsert(c,'clinic',clinic.clinic_id,clinic.clinic_id,'clinic_schema.clinics',['id','legal_name','public_name','status','timezone','booking_contract_profile'],[clinic.clinic_id,`СИНТЕТИКА · ${clinic.name}`,`СИНТЕТИКА · ${clinic.name}`,'ACTIVE','Europe/Moscow','MVP_V1_MANUAL']));
   count('locations',await ownedInsert(c,'location',clinic.location_id,clinic.location_id,'clinic_schema.clinic_locations',['id','clinic_id','address','phone','status'],[clinic.location_id,clinic.clinic_id,clinic.address_display,null,'ACTIVE']));
   for(const a of accounts.filter(a=>a.clinic_id===clinic.clinic_id))await c.query('INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active) VALUES($1,$2,$3,true) ON CONFLICT DO NOTHING',[a.userId,a.location_id,a.backendRole]);
   for(const doc of d.staff_doctors.filter(x=>x.clinic_id===clinic.clinic_id)){
    count('doctors',await ownedInsert(c,'doctor',doc.doctor_id,doc.doctor_id,'catalog_schema.doctors',['id','clinic_location_id','full_name','specialty_id','active','public_booking_enabled'],[doc.doctor_id,doc.location_id,doc.full_name,specialtyIds.get(doc.specialty_code),true,true]));
    await ownedInsert(c,'staff',doc.doctor_id,doc.doctor_id,'clinic_schema.clinic_staff',['id','clinic_location_id','code','display_name','role','active','source','external_staff_id'],[doc.doctor_id,doc.location_id,doc.doctor_id,doc.full_name,'VETERINARIAN',true,NS,doc.doctor_id]);
   }
   for(const offer of d.clinic_service_offers.filter(x=>x.clinic_id===clinic.clinic_id)){
    const definition=definitions.get(offer.service_code);const eligible=d.staff_doctors.filter(x=>x.location_id===clinic.location_id&&x.specialty_code===definition.specialty_code);
    const species=[...new Set(eligible.flatMap(x=>x.accepted_species.split('|').map(v=>['DOG','CAT'].includes(v)?v:'OTHER')))];
    count('offers',await ownedInsert(c,'offer',offer.offer_id,offer.offer_id,'clinic_schema.clinic_services',['id','clinic_location_id','code','display_name','duration_minutes','active','price_amount','currency','supported_species'],[offer.offer_id,offer.location_id,offer.service_code,`${definition.name} · СИНТЕТИКА · от ${offer.price_from_rub} ₽; ${offer.scope_included}`,Number(offer.duration_minutes),offer.active==='True',offer.price_from_rub,offer.currency,species]));
   }
  });
  for(let i=0;i<d.pets.length;i+=100)await transaction(c,async()=>{for(const p of d.pets.slice(i,i+100))count('pets',await ownedInsert(c,'pet',p.pet_id,p.pet_id,'pet_schema.pets',['id','owner_id','name','species','breed','birth_date','sex','weight_kg','sterilized','gender','is_sterilized'],[p.pet_id,p.owner_id,p.name,['DOG','CAT'].includes(p.species)?p.species:'OTHER',p.breed,p.birth_date,p.sex,p.weight_kg,p.neuter_status==='UNKNOWN'?null:p.neuter_status==='NEUTERED',p.sex==='UNKNOWN'?null:p.sex,p.neuter_status==='UNKNOWN'?null:p.neuter_status==='NEUTERED']));});
  // PostgreSQL supplies calendar authority. Never move an existing slot/date or reset its counters.
  const anchor=(await c.query("SELECT ((clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date+1)::text AS calendar_day")).rows[0].calendar_day;
  const reference='2026-10-13';const offset=(Date.parse(anchor)-Date.parse(reference))/86400000;
  const dateShift=value=>new Date(Date.parse(value.slice(0,10))+offset*86400000).toISOString().slice(0,10)+value.slice(10)+'+03:00';
  require('reflect-metadata');
  const {DatabaseService}=require('../dist/src/database/database.service');
  const {ClinicEmployeeAccessService}=require('../dist/src/booking-core/clinic-employee-access.service');
  const {ClinicScheduleService}=require('../dist/src/booking-core/clinic-schedule.service');
  db=new DatabaseService();const schedule=new ClinicScheduleService(db,new ClinicEmployeeAccessService());
  // Native shift publication is independent from slot/hold authority.
  for(const clinic of d.clinics){
   const admin=accounts.find(a=>a.clinic_id===clinic.clinic_id&&a.role==='CLINIC_ADMIN');
   const employee={sub:admin.userId,roles:['CLINIC_ADMIN'],clinicIds:[clinic.clinic_id],locationIds:[clinic.location_id]};
   const sourceShifts=d.doctor_shifts.filter(s=>s.clinic_id===clinic.clinic_id);
   for(let i=0;i<sourceShifts.length;i+=25){
    const pending=[];
    for(const shift of sourceShifts.slice(i,i+25)){
     const startsAt=dateShift(shift.work_date+'T'+shift.start_local),endsAt=dateShift(shift.work_date+'T'+shift.end_local);
     const key=shift.doctor_id+':'+startsAt,id=nativeId(uid('doctor-shift:'+key));
     const existing=await c.query('SELECT * FROM clinic_schema.doctor_shifts WHERE id=$1',[id]);
     if(existing.rowCount){const row=existing.rows[0];const owned=await c.query("SELECT internal_id FROM synthetic_fixture.mapping WHERE namespace=$1 AND kind='shift' AND external_id=$2",[NS,key]);
      if(row.clinic_location_id!==clinic.location_id||row.staff_id!==shift.doctor_id||row.doctor_id!==shift.doctor_id||row.source!==NS||row.status!=='PUBLISHED'||row.starts_at.toISOString()!==new Date(startsAt).toISOString()||row.ends_at.toISOString()!==new Date(endsAt).toISOString())throw Error('SHIFT_IDENTITY_OR_PAYLOAD_CHANGED');
      if(owned.rowCount&&owned.rows[0].internal_id!==id)throw Error('SHIFT_MAPPING_CONFLICT');
      // Rolling calendar reuse preserves the initial raw shift identity, never rewrites it.
      if(!sourceShifts.some(s=>s.doctor_id===shift.doctor_id&&externalId(s.shift_id)===row.external_shift_id))throw Error('SHIFT_SOURCE_PROVENANCE_CHANGED');
      if(!owned.rowCount){const proof=await c.query("SELECT 1 FROM booking_schema.idempotency_records WHERE scope=$1 AND status='COMPLETED' AND response_body->'result'->'shiftIds' @> $2::jsonb",['clinic.schedule.doctor_shifts.import:'+clinic.location_id+':'+admin.userId,JSON.stringify([id])]);if(!proof.rowCount)throw Error('FOREIGN_FIXTURE_COLLISION:shift');await map(c,'shift',key,id);}
      count('shifts',false);continue;
     }
     pending.push({key,id,doctorId:shift.doctor_id,staffId:shift.doctor_id,startsAt,endsAt,externalShiftId:externalId(shift.shift_id)});
    }
    if(!pending.length)continue;
    const key=uid('publish-shifts:'+pending.map(s=>s.key).join(','));
    const published=await schedule.importDoctorShifts({clinicId:clinic.clinic_id,locationId:clinic.location_id,employee,source:NS,idempotencyKey:key,correlationId:key,shifts:pending.map(({key,...shift})=>shift)});
    await transaction(c,async()=>{for(const shift of pending){if(!published.shiftIds.includes(shift.id))throw Error('SHIFT_PUBLICATION_IDENTITY_MISMATCH');await map(c,'shift',shift.key,shift.id);count('shifts',true);}});
   }
  }
  for(const clinic of d.clinics){
   const admin=accounts.find(a=>a.clinic_id===clinic.clinic_id&&a.role==='CLINIC_ADMIN');
   const employee={sub:admin.userId,roles:['CLINIC_ADMIN'],clinicIds:[clinic.clinic_id],locationIds:[clinic.location_id]};
   const source=d.appointment_slots.filter(s=>s.clinic_id===clinic.clinic_id);
   for(let i=0;i<source.length;i+=50){
    const chunk=source.slice(i,i+50);const mapped=[];
    for(const s of chunk){
     const key=`${s.doctor_id}:${dateShift(s.start_at_local)}`;
     const exists=await c.query('SELECT internal_id FROM synthetic_fixture.mapping WHERE namespace=$1 AND kind=$2 AND external_id=$3',[NS,'slot',key]);
     if(exists.rowCount){count('slots',false);continue;}
     const doc=doctors.get(s.doctor_id);
     const eligible=d.clinic_service_offers.filter(o=>o.location_id===s.location_id&&definitions.get(o.service_code).specialty_code===doc.specialty_code&&Number(o.duration_minutes)<=45);
     if(!eligible.length)throw Error(`NO_ELIGIBLE_SERVICE:${doc.doctor_id}`);
     const b=bookingsBySlot.get(s.slot_id);let service=eligible.find(o=>o.service_code===b?.service_code);
     service=service||eligible[Math.floor((Number(s.start_at_local.slice(11,13))*60+Number(s.start_at_local.slice(14,16))-540)/50)%eligible.length];
     mapped.push({source:s,key,slot:{serviceId:service.offer_id,staffId:s.doctor_id,startsAt:dateShift(s.start_at_local),endsAt:dateShift(s.end_at_local),capacity:1}});
    }
    if(!mapped.length)continue;
    const key=uid('publish:'+mapped.map(x=>x.key).join(','));
    const result=await schedule.importManualSlots({clinicId:clinic.clinic_id,locationId:clinic.location_id,employee,idempotencyKey:key,correlationId:key,slots:mapped.map(x=>x.slot)});
    await transaction(c,async()=>{for(let j=0;j<mapped.length;j++){
     const id=result.slots[j].id;await map(c,'slot',mapped[j].key,id);
     await c.query('UPDATE clinic_schema.appointment_slots SET doctor_id=$1,specialty_id=$2 WHERE id=$3 AND staff_id=$1',[mapped[j].source.doctor_id,specialtyIds.get(doctors.get(mapped[j].source.doctor_id).specialty_code),id]);count('slots',true);
    }});
   }
   console.log(JSON.stringify({publishedClinic:clinic.clinic_id,anchor}));
  }
  console.log(JSON.stringify({mode:'seed',namespace:NS,anchor,archiveSha256:d._sha256,...stats,shifts:'3500 NATIVE DoctorShift in the current window; history retained',medical:'RAW OWNER_REPORTED ONLY; no clinical authority promotion',bookingHistory:'RAW SOURCE PRESERVED; replay is separate'}));
 }finally{if(db)await db.onModuleDestroy();await c.end();}
}
async function verify(d){const c=await connect();try{
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const counts={};for(const [kind,n] of Object.entries(d._manifest.counts)){const rows=(await c.query('SELECT payload FROM synthetic_fixture.raw WHERE namespace=$1 AND kind=$2',[NS,kind])).rows;counts[kind]=rows.length;if(rows.length!==n)throw Error(`RAW_COUNT:${kind}`);const expected=new Set(d[kind].map(r=>JSON.stringify(canonical(r))));if(rows.some(r=>!expected.has(JSON.stringify(canonical(r.payload)))))throw Error(`RAW_SOURCE_CHANGED:${kind}`);} 
 const native={};for(const [kind,table] of [['clinic','clinic_schema.clinics'],['doctor','catalog_schema.doctors'],['pet','pet_schema.pets'],['account','identity_schema.users'],['offer','clinic_schema.clinic_services'],['slot','clinic_schema.appointment_slots'],['shift','clinic_schema.doctor_shifts']])native[kind]=Number((await c.query(`SELECT count(*) FROM ${table} n JOIN synthetic_fixture.mapping m ON m.internal_id=n.id AND m.namespace=$1 AND m.kind=$2`,[NS,kind])).rows[0].count);
 for(const [kind,expected] of Object.entries({clinic:25,doctor:250,pet:401,account:620,offer:455}))if(native[kind]!==expected)throw Error(`NATIVE_COUNT:${kind}:${native[kind]}`);
 const window=await c.query(`SELECT count(*)::int n FROM clinic_schema.appointment_slots s JOIN synthetic_fixture.mapping m ON m.internal_id=s.id AND m.namespace=$1 AND m.kind='slot' WHERE (s.starts_at AT TIME ZONE 'Europe/Moscow')::date BETWEEN (clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date+1 AND (clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date+14`,[NS]);
 if(window.rows[0].n!==35000)throw Error('ROLLING_WINDOW_COUNT:'+window.rows[0].n);
 const shiftWindow=await c.query(`SELECT count(*)::int n FROM clinic_schema.doctor_shifts s JOIN synthetic_fixture.mapping m ON m.internal_id=s.id AND m.namespace=$1 AND m.kind='shift' WHERE (s.starts_at AT TIME ZONE 'Europe/Moscow')::date BETWEEN (clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date+1 AND (clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date+14`,[NS]);
 if(shiftWindow.rows[0].n!==3500)throw Error('ROLLING_SHIFT_COUNT:'+shiftWindow.rows[0].n);
 const uncovered=await c.query(`SELECT count(*)::int n FROM clinic_schema.appointment_slots slot JOIN synthetic_fixture.mapping m ON m.internal_id=slot.id AND m.namespace=$1 AND m.kind='slot' WHERE (SELECT count(*) FROM clinic_schema.doctor_shifts shift WHERE shift.clinic_location_id=slot.clinic_location_id AND shift.staff_id=slot.staff_id AND shift.doctor_id=slot.doctor_id AND shift.status='PUBLISHED' AND shift.starts_at<=slot.starts_at AND shift.ends_at>=slot.ends_at)<>1`,[NS]);
 if(uncovered.rows[0].n)throw Error('SLOTS_WITHOUT_EXACT_SHIFT:'+uncovered.rows[0].n);
 const overlap=await c.query(`WITH w AS (SELECT s.staff_id,s.starts_at,lag(s.ends_at) OVER(PARTITION BY s.staff_id ORDER BY s.starts_at) previous_end FROM clinic_schema.appointment_slots s JOIN synthetic_fixture.mapping m ON m.internal_id=s.id AND m.namespace=$1 AND m.kind='slot') SELECT count(*)::int n FROM w WHERE starts_at<previous_end`,[NS]);if(overlap.rows[0].n)throw Error('OVERLAPPING_DOCTOR_WINDOWS');
 const bad=await c.query(`SELECT count(*) FROM clinic_schema.appointment_slots s JOIN synthetic_fixture.mapping m ON m.internal_id=s.id AND m.namespace=$1 AND m.kind='slot' WHERE s.capacity<>1 OR s.booked_count+s.held_count>s.capacity OR ends_at-starts_at<>interval '45 minutes'`,[NS]);if(Number(bad.rows[0].count))throw Error('SLOT_CARDINALITY');
 console.log(JSON.stringify({mode:'verify',counts,native,archiveSha256:d._sha256}));return {counts,native};
 }finally{await c.end();}}
async function main(){const [mode,archive]=process.argv.slice(2);if(!['validate','seed','verify','reset-fixture'].includes(mode)||!archive)throw Error('Usage: seed-local-multi-clinic.cjs validate|seed|verify|reset-fixture ARCHIVE');const d=readDataset(archive);if(mode==='validate'){console.log(JSON.stringify({DATASET_VALIDATION:'PASS',sha256:d._sha256,counts:d._manifest.counts}));return;}guard();if(mode==='reset-fixture'){await require('./synthetic/reset-fixture.cjs').resetFixture(archive,d,process.argv.slice(4),{NS,guard,connect});return;}if(mode==='seed')await seed(d);else await verify(d);}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={NS,uid,externalId,nativeId,nativeDataset,readDataset,guard,connect,verify};
