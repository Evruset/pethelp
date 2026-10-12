// DEMO ONLY: explicit synthetic consent/registry association. A booking is NOT consent.
// Mirrors the existing registry test fixture; does not assert human/legal consent.
module.exports=async function patientFixture(holdId){
 const {Client}=require('../../backend/node_modules/pg');const {demoEnv}=await import('./demo-env.mjs');
 const client=new Client({connectionString:demoEnv.DATABASE_URL});await client.connect();
 try{
  const db=await client.query('SELECT current_database() AS name');if(db.rows[0].name!=='product_batch01')throw Error('DEMO_DATABASE_REQUIRED');
  await client.query('BEGIN');
  const r=await client.query("SELECT a.id, a.pet_id, a.owner_id, a.clinic_location_id, l.clinic_id FROM booking_schema.appointments a JOIN clinic_schema.clinic_locations l ON l.id=a.clinic_location_id WHERE a.hold_id=$1 AND a.owner_id='11111111-1111-4111-8111-111111111111' AND a.pet_id='22222222-2222-4222-8222-222222222222' AND l.clinic_id='90000000-0000-4000-8000-000000000001'",[holdId]);
  if(!r.rows[0])throw Error('DEMO_APPOINTMENT_REQUIRED');const a=r.rows[0];
  const consent='93000000-0000-4000-8000-000000000001',association='94000000-0000-4000-8000-000000000001';
  await client.query("INSERT INTO clinic_schema.clinic_patient_consents(id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,consent_version,source,actor_type,granted_at,expires_at) VALUES($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','v1','OWNER','OWNER',clock_timestamp()-interval '1 day',clock_timestamp()+interval '30 days') ON CONFLICT DO NOTHING",[consent,a.clinic_id,a.clinic_location_id,a.pet_id,a.owner_id]);
  const inserted=await client.query("INSERT INTO clinic_schema.clinic_patient_associations(id,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,visibility_policy_version,visibility_expires_at,first_qualified_at,last_qualified_at) VALUES($1,$2,$3,$4,'ACTIVE','APPOINTMENT',$5,$6,'registry-test-v1',clock_timestamp()+interval '30 days',clock_timestamp()-interval '1 day',clock_timestamp()) ON CONFLICT DO NOTHING RETURNING id",[association,a.clinic_id,a.clinic_location_id,a.pet_id,a.id,consent]);
  if(inserted.rowCount)await client.query("INSERT INTO clinic_schema.clinic_patient_association_revisions(association_id,association_version,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at) SELECT id,version,clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at FROM clinic_schema.clinic_patient_associations WHERE id=$1",[association]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
};
