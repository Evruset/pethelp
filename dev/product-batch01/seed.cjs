// Fresh, test-owned product_batch01 database only. Additive fixture: no deletes/resets.
const {Client}=require('../../backend/node_modules/pg');
const {writeFileSync,readFileSync,existsSync}=require('node:fs');
const {resolve}=require('node:path');
const client=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{
 await client.connect();
 const db=await client.query('SELECT current_database() AS name');
 if(db.rows[0].name!=='product_batch01'||process.env.NODE_ENV!=='development')throw Error('DEMO_DATABASE_REQUIRED');
 await client.query('BEGIN');
 const ownerId='11111111-1111-4111-8111-111111111111',petId='22222222-2222-4222-8222-222222222222';
 await client.query('INSERT INTO identity_schema.users(id) VALUES($1) ON CONFLICT DO NOTHING',[ownerId]);
 await client.query('INSERT INTO identity_schema.owner_identities(user_id,phone_e164) VALUES($1,$2) ON CONFLICT DO NOTHING',[ownerId,'+79991234567']);
 await client.query("INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'Барсик','CAT') ON CONFLICT DO NOTHING",[petId,ownerId]);
 const adminId='33333333-3333-4333-8333-333333333333',vetId='44444444-4444-4444-8444-444444444444';
 await client.query('INSERT INTO identity_schema.users(id) VALUES($1) ON CONFLICT DO NOTHING',[vetId]);
 await client.query('INSERT INTO identity_schema.users(id) VALUES($1) ON CONFLICT DO NOTHING',[adminId]);
 const clinics=[];
 for(const [index,name,profile] of [[1,'ДЕМО · Забота','MVP_V1_MANUAL'],[2,'ДЕМО · ВетЛиния','V15_AUTO_CONFIRM']]){
  const clinicId=`90000000-0000-4000-8000-${String(index).padStart(12,'0')}`,locationId=`91000000-0000-4000-8000-${String(index).padStart(12,'0')}`,serviceId=`92000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
  await client.query("INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone,booking_contract_profile) VALUES($1,$2,$2,'ACTIVE','Europe/Moscow',$3) ON CONFLICT DO NOTHING",[clinicId,name,profile]);
  await client.query("INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,phone,status) VALUES($1,$2,$3,'+74950000000','ACTIVE') ON CONFLICT DO NOTHING",[locationId,clinicId,`Демо улица, ${index}`]);
  await client.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,'GENERAL_VISIT','Приём терапевта',30,true,1500,'RUB') ON CONFLICT DO NOTHING",[serviceId,locationId]);
  for(let n=1;n<=24;n++)await client.query("INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,source,external_slot_id,integration_mode,last_freshness_sync) VALUES($1,$2,date_trunc('hour',clock_timestamp())+make_interval(hours=>$3),date_trunc('hour',clock_timestamp())+make_interval(hours=>$3)+interval '30 minutes',1,'PRODUCT_BATCH01_DEMO',$4,'LEVEL_A',clock_timestamp()) ON CONFLICT(source,external_slot_id) DO NOTHING",[locationId,serviceId,24+n,`${index}-${new Date().toISOString().slice(0,10)}-${n}`]);
  await client.query("INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active) VALUES($1,$2,'CLINIC_ADMIN',true) ON CONFLICT DO NOTHING",[adminId,locationId]);
  await client.query("INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active) VALUES($1,$2,'CLINIC_VETERINARIAN',true) ON CONFLICT DO NOTHING",[vetId,locationId]);
  clinics.push({clinicId,locationId,serviceId,name,profile});
 }
 await client.query('COMMIT');
 const statePath=resolve(__dirname,'demo-state.local.json');
 const previous=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{};
 writeFileSync(statePath,JSON.stringify({ownerId,petId,adminId,vetId,phone:'+79991234567',clinics,...(previous.ownerSession?{ownerSession:previous.ownerSession}:{})},null,2),{mode:0o600});
 console.log('DEMO fixtures ready: one Owner, one pet, manual and automatic clinics. No real medical data.');
})().catch(async error=>{await client.query('ROLLBACK').catch(()=>{});console.error(error.message);process.exitCode=1;}).finally(()=>client.end());
