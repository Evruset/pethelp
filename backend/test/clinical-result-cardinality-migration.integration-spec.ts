import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

jest.setTimeout(90_000);

describe('W7-B2 one Result per Visit migration', () => {
  it('adds a reversible unique Visit invariant without changing the W7-A migration', async () => {
    const configured=process.env.DATABASE_URL;if(!configured)throw new Error('DATABASE_URL is required');
    const admin=new Client({connectionString:configured});const name=`vethelp_w7b2_${process.pid}_${Date.now()}`;const target=new URL(configured);target.pathname=`/${name}`;let client:Client|null=null;
    const previous=join(process.cwd(),'migrations/node-pg/1719610000000_add_clinical_visit_result_foundation.js');const checksum=sha(previous);
    await admin.connect();
    try{
      await admin.query(`CREATE DATABASE "${name}"`);run('up',target.toString());client=new Client({connectionString:target.toString()});await client.connect();await seed(client);
      expect((await client.query(`SELECT count(*)::int count FROM clinical_schema.visit_results GROUP BY visit_id HAVING count(*)>1`)).rowCount).toBe(0);
      const first=await client.query(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'First result',$7) RETURNING id`,[I.visit,I.owner,I.pet,I.clinic,I.location,I.vet,randomUUID()]);expect(first.rowCount).toBe(1);
      await expect(client.query(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'Second result',$7)`,[I.visit,I.owner,I.pet,I.clinic,I.location,I.vet,randomUUID()])).rejects.toMatchObject({code:'23505'});
      run('down',target.toString(),'1719610000000');
      expect((await client.query(`SELECT count(*)::int count FROM clinical_schema.visit_results WHERE visit_id=$1`,[I.visit])).rows[0].count).toBe(1);
      run('up',target.toString());
      await expect(client.query(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'Still unique',$7)`,[I.visit,I.owner,I.pet,I.clinic,I.location,I.vet,randomUUID()])).rejects.toMatchObject({code:'23505'});
      expect(sha(previous)).toBe(checksum);
    }finally{await client?.end();await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`,[name]);await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();}
  });
});

const I={owner:'b1000000-0000-4000-8000-000000000001',vet:'b1000000-0000-4000-8000-000000000002',clinic:'b2000000-0000-4000-8000-000000000001',location:'b3000000-0000-4000-8000-000000000001',pet:'b4000000-0000-4000-8000-000000000001',service:'b5000000-0000-4000-8000-000000000001',slot:'b6000000-0000-4000-8000-000000000001',hold:'b7000000-0000-4000-8000-000000000001',appointment:'b8000000-0000-4000-8000-000000000001',visit:'b9000000-0000-4000-8000-000000000001'};
async function seed(c:Client){await c.query(`INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}');INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic');INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A');INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30);INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp());INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG');INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','COMPLETED',clock_timestamp()+interval '1 hour');INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','COMPLETED');INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES('${I.visit}','${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.clinic}','${I.location}','${I.slot}','${I.vet}')`);}
function sha(path:string){return createHash('sha256').update(readFileSync(path)).digest('hex');}
function run(direction:'up'|'down',url:string,to?:string){const args=[direction,'--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'];if(to)args.push('--to',to);execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),args,{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url},stdio:'pipe'});}
