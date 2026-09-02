import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

jest.setTimeout(180_000);

const I = {
  owner:'71000000-0000-4000-8000-000000000001', otherOwner:'71000000-0000-4000-8000-000000000002', vet:'71000000-0000-4000-8000-000000000003',
  clinic:'72000000-0000-4000-8000-000000000001', otherClinic:'72000000-0000-4000-8000-000000000002',
  location:'73000000-0000-4000-8000-000000000001', otherLocation:'73000000-0000-4000-8000-000000000002',
  pet:'74000000-0000-4000-8000-000000000001', otherPet:'74000000-0000-4000-8000-000000000002',
  service:'75000000-0000-4000-8000-000000000001', otherService:'75000000-0000-4000-8000-000000000002',
  slot:'76000000-0000-4000-8000-000000000001', otherSlot:'76000000-0000-4000-8000-000000000002',
  hold:'77000000-0000-4000-8000-000000000001', otherHold:'77000000-0000-4000-8000-000000000002',
  appointment:'78000000-0000-4000-8000-000000000001', otherAppointment:'78000000-0000-4000-8000-000000000002',
};

describe('W7-A clinical foundation migration', () => {
  it('proves lineage, lifecycle, immutability, projection coherence and populated DOWN fail-closed', async () => {
    const configured=process.env.DATABASE_URL;if(!configured)throw new Error('DATABASE_URL is required');
    const admin=new Client({connectionString:configured});const name=`vethelp_w7a_${process.pid}_${Date.now()}`;const target=new URL(configured);target.pathname=`/${name}`;let client:Client|null=null;
    const previous=join(process.cwd(),'migrations/node-pg/1719600000000_allow_terminal_reallocation_acceptance_lineage.js');const previousChecksum=sha(previous);
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${name}"`);run('up',target.toString());client=new Client({connectionString:target.toString()});await client.connect();
      expect((await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='clinical_schema' ORDER BY table_name`)).rows.map(r=>r.table_name)).toEqual(['diary_entries','visit_result_amendments','visit_results','visits']);
      run('down',target.toString());expect((await client.query(`SELECT to_regclass('clinical_schema.visits') value`)).rows[0].value).toBeNull();run('up',target.toString());
      await seed(client);

      const before=await client.query<{now:Date}>('SELECT clock_timestamp() now');
      const visit=(await client.query<{id:string;completed_at:Date}>(`INSERT INTO clinical_schema.visits(appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,completed_at`,[I.appointment,I.hold,I.owner,I.pet,I.clinic,I.location,I.slot,I.vet])).rows[0];
      const after=await client.query<{now:Date}>('SELECT clock_timestamp() now');expect(visit.completed_at.getTime()).toBeGreaterThanOrEqual(before.rows[0].now.getTime());expect(visit.completed_at.getTime()).toBeLessThanOrEqual(after.rows[0].now.getTime());
      await expect(client.query(`INSERT INTO clinical_schema.visits(appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[I.appointment,I.otherHold,I.owner,I.pet,I.clinic,I.location,I.otherSlot,I.vet])).rejects.toMatchObject({code:'23505'});
      await expect(client.query(`INSERT INTO clinical_schema.visits(appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[I.otherAppointment,I.hold,I.owner,I.pet,I.otherClinic,I.otherLocation,I.otherSlot,I.vet])).rejects.toMatchObject({code:expect.stringMatching(/23503|23505/)});
      await expect(client.query(`INSERT INTO clinical_schema.visits(appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[I.otherAppointment,I.otherHold,I.owner,I.otherPet,I.otherClinic,I.otherLocation,I.otherSlot,I.vet])).rejects.toMatchObject({code:'23503'});

      const draft=(await client.query<{id:string;clinical_summary:string}>(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'Initial draft',$7) RETURNING id,clinical_summary`,[visit.id,I.owner,I.pet,I.clinic,I.location,I.vet,randomUUID()])).rows[0];
      expect((await client.query(`UPDATE clinical_schema.visit_results SET clinical_summary='Edited draft',version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING published_at`,[draft.id])).rows[0].published_at).toBeNull();
      await expect(client.query(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,status,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'PUBLISHED','Bad tuple',$7)`,[visit.id,I.owner,I.pet,I.clinic,I.location,I.vet,randomUUID()])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'Bad context',$7)`,[visit.id,I.owner,I.pet,I.otherClinic,I.location,I.vet,randomUUID()])).rejects.toMatchObject({code:'23503'});
      await expect(client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,occurred_at) VALUES($1,$2,$3,$4,$5)`,[I.owner,I.pet,visit.id,draft.id,new Date()])).rejects.toMatchObject({code:'23514'});

      const publishBefore=(await client.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
      await client.query('BEGIN');await client.query(`UPDATE clinical_schema.visit_results SET status='PUBLISHED',published_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 WHERE id=$1`,[draft.id]);await client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,occurred_at) SELECT owner_id,pet_id,visit_id,id,published_at FROM clinical_schema.visit_results WHERE id=$1`,[draft.id]);await client.query('COMMIT');
      const published=(await client.query<{clinical_summary:string;published_at:Date}>(`SELECT clinical_summary,published_at FROM clinical_schema.visit_results WHERE id=$1`,[draft.id])).rows[0];expect(published.published_at.getTime()).toBeGreaterThanOrEqual(publishBefore.getTime());
      expect((await client.query(`SELECT count(*)::int count FROM clinical_schema.diary_entries WHERE source_result_id=$1`,[draft.id])).rows[0].count).toBe(1);
      await expect(client.query(`UPDATE clinical_schema.visit_results SET clinical_summary='Mutated' WHERE id=$1`,[draft.id])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinical_schema.visit_results SET pet_id=$2 WHERE id=$1`,[draft.id,I.otherPet])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinical_schema.visit_results SET id=$2 WHERE id=$1`,[draft.id,randomUUID()])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinical_schema.visit_results SET idempotency_key=$2 WHERE id=$1`,[draft.id,randomUUID()])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinical_schema.visit_results SET version=version+1 WHERE id=$1`,[draft.id])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinical_schema.visit_results SET created_at=created_at-interval '1 second' WHERE id=$1`,[draft.id])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinical_schema.visit_results SET updated_at=updated_at+interval '1 second' WHERE id=$1`,[draft.id])).rejects.toMatchObject({code:'23514'});
      expect((await client.query(`SELECT count(*)::int count FROM clinical_schema.diary_entries d JOIN clinical_schema.visit_results r ON r.id=d.source_result_id WHERE r.id=$1 AND r.status='PUBLISHED'`,[draft.id])).rows[0].count).toBe(1);

      const draft2=(await client.query<{id:string}>(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'Second draft',$7) RETURNING id`,[visit.id,I.owner,I.pet,I.clinic,I.location,I.vet,randomUUID()])).rows[0];
      await expect(client.query(`INSERT INTO clinical_schema.visit_result_amendments(result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,'Not allowed',$8)`,[draft2.id,visit.id,I.owner,I.pet,I.clinic,I.location,I.vet,randomUUID()])).rejects.toMatchObject({code:'23514'});
      const amendmentId=randomUUID();await client.query('BEGIN');await client.query(`INSERT INTO clinical_schema.visit_result_amendments(id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Published amendment',$9)`,[amendmentId,draft.id,visit.id,I.owner,I.pet,I.clinic,I.location,I.vet,randomUUID()]);await client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_amendment_id,occurred_at) SELECT owner_id,pet_id,visit_id,id,published_at FROM clinical_schema.visit_result_amendments WHERE id=$1`,[amendmentId]);await client.query('COMMIT');
      expect((await client.query(`SELECT clinical_summary FROM clinical_schema.visit_results WHERE id=$1`,[draft.id])).rows[0].clinical_summary).toBe('Edited draft');
      await expect(client.query(`UPDATE clinical_schema.visit_result_amendments SET amendment_content='Mutated' WHERE id=$1`,[amendmentId])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinical_schema.diary_entries SET owner_id=$2 WHERE source_result_id=$1`,[draft.id,I.otherOwner])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,occurred_at) VALUES($1,$2,$3,clock_timestamp())`,[I.owner,I.pet,visit.id])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,source_amendment_id,occurred_at) VALUES($1,$2,$3,$4,$5,clock_timestamp())`,[I.owner,I.pet,visit.id,draft.id,amendmentId])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,occurred_at) VALUES($1,$2,$3,$4,clock_timestamp())`,[I.owner,I.pet,visit.id,draft.id])).rejects.toMatchObject({code:'23505'});
      expect((await client.query(`SELECT COALESCE(source_result_id,source_amendment_id)::text source FROM clinical_schema.diary_entries ORDER BY occurred_at,id`)).rows.map(r=>r.source)).toEqual([draft.id,amendmentId]);

      let downError='';try{run('down',target.toString());}catch(error){downError=String((error as {stderr?:Buffer}).stderr??error);}expect(downError).toContain('W7A_DOWN_DATA_REMEDIATION_APPROVAL_REQUIRED');
      expect((await client.query(`SELECT (SELECT count(*) FROM clinical_schema.visits)::int visits,(SELECT count(*) FROM clinical_schema.visit_results)::int results,(SELECT count(*) FROM clinical_schema.diary_entries)::int diary`)).rows[0]).toEqual({visits:1,results:2,diary:2});
      expect(sha(previous)).toBe(previousChecksum);
    } finally {await client?.end();await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`,[name]);await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();}
  });
});

async function seed(c:Client){await c.query(`
  INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.otherOwner}'),('${I.vet}');
  INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.otherClinic}','Other','Other');
  INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,timezone) VALUES('${I.location}','${I.clinic}','A','Europe/Moscow'),('${I.otherLocation}','${I.otherClinic}','B','Europe/Moscow');
  INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30),('${I.otherService}','${I.otherLocation}','S','Service',30);
  INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp()),('${I.otherSlot}','${I.otherLocation}','${I.otherService}',clock_timestamp()-interval '1 hour',clock_timestamp());
  INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG'),('${I.otherPet}','${I.otherOwner}','Other','CAT');
  INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','COMPLETED',clock_timestamp()+interval '1 hour'),('${I.otherHold}','${I.otherSlot}','${I.otherOwner}','${I.otherPet}','COMPLETED',clock_timestamp()+interval '1 hour');
  INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','COMPLETED'),('${I.otherAppointment}','${I.otherHold}','${I.otherOwner}','${I.otherPet}','${I.otherLocation}','${I.otherSlot}','COMPLETED');
`);}
function sha(path:string){return createHash('sha256').update(readFileSync(path)).digest('hex');}
function run(direction:'up'|'down',url:string){execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),[direction,'--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url},stdio:'pipe'});}
