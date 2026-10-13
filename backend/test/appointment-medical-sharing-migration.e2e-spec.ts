import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

jest.setTimeout(120000);
describe('Wave4A additive migration on populated Wave3 (Docker PostgreSQL)',()=>{
  it('preserves previous records and creates empty sharing authority, with matching checksums',async()=>{
    const url=new URL(process.env.DATABASE_URL!);
    if(process.env.WAVE4_ACCEPTANCE!=='true'||url.hostname!=='postgres')throw new Error('Requires isolated Docker acceptance');
    const name=`vethelp_wave4a_upgrade_${randomUUID().replace(/-/g,'')}`;
    const admin=new Client({connectionString:url.toString()});await admin.connect();
    let upgraded:Client|undefined;
    const migrate=(args:string[])=>execFileSync(process.execPath,['node_modules/node-pg-migrate/bin/node-pg-migrate.js',...args,'--migrations-dir','migrations/node-pg','--migrations-table','schema_migrations','--single-transaction'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe',timeout:60000});
    try {
      await admin.query(`CREATE DATABASE "${name}"`);url.pathname=`/${name}`;
      migrate(['up','1719720000000','--timestamp']);
      upgraded=new Client({connectionString:url.toString()});await upgraded.connect();
      const owner=randomUUID(),pet=randomUUID(),document=randomUUID();
      await upgraded.query('INSERT INTO identity_schema.users(id) VALUES($1)',[owner]);
      await upgraded.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species,medical_history_ocr) VALUES($1,$2,'Legacy','DOG',$3)`,[pet,owner,JSON.stringify({text:'legacy unverified'})]);
      await upgraded.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status,ocr_result) VALUES($1,$2,$3,'source','HISTORY','PROCESSED',$4)`,[document,pet,owner,JSON.stringify({text:'legacy raw'})]);
      const clinic=randomUUID(),location=randomUUID(),service=randomUUID(),slot=randomUUID(),hold=randomUUID(),appointment=randomUUID(),visit=randomUUID(),result=randomUUID(),amendment=randomUUID();
      await upgraded.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES($1,'Wave3','Wave3')`,[clinic]);
      await upgraded.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES($1,$2,'Wave3')`,[location,clinic]);
      await upgraded.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES($1,$2,'W3','Wave3',30)`,[service,location]);
      await upgraded.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES($1,$2,$3,now()-interval '1 hour',now())`,[slot,location,service]);
      await upgraded.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$2,$3,$4,'COMPLETED',now()+interval '1 hour')`,[hold,slot,owner,pet]);
      await upgraded.query(`INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES($1,$2,$3,$4,$5,$6,'COMPLETED')`,[appointment,hold,owner,pet,location,slot]);
      await upgraded.query(`INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$4)`,[visit,appointment,hold,owner,pet,clinic,location,slot]);
      // Publication and Diary projection must be coherent at the real COMMIT boundary.
      await upgraded.query('BEGIN');
      await upgraded.query(`INSERT INTO clinical_schema.visit_results(id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,status,clinical_summary,idempotency_key,created_at,updated_at,published_at) VALUES($1,$2,$3,$4,$5,$6,$3,'PUBLISHED','Preserved Wave3 published result',$7,now(),now(),now())`,[result,visit,owner,pet,clinic,location,randomUUID()]);
      await upgraded.query(`INSERT INTO clinical_schema.visit_result_amendments(id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$4,'Preserved Wave3 amendment',$8)`,[amendment,result,visit,owner,pet,clinic,location,randomUUID()]);
      await upgraded.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,occurred_at) SELECT owner_id,pet_id,visit_id,id,published_at FROM clinical_schema.visit_results WHERE id=$1`,[result]);
      await upgraded.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_amendment_id,occurred_at) SELECT owner_id,pet_id,visit_id,id,published_at FROM clinical_schema.visit_result_amendments WHERE id=$1`,[amendment]);
      await upgraded.query('COMMIT');
      const diaryBefore=(await upgraded.query('SELECT * FROM clinical_schema.diary_entries WHERE visit_id=$1 ORDER BY id',[visit])).rows;
      const clinicalBefore=(await upgraded.query(`SELECT row_to_json(v) visit,row_to_json(r) result,row_to_json(a) amendment FROM clinical_schema.visits v JOIN clinical_schema.visit_results r ON r.visit_id=v.id JOIN clinical_schema.visit_result_amendments a ON a.result_id=r.id WHERE v.id=$1`,[visit])).rows;
      const before=(await upgraded.query('SELECT row_to_json(p) pet FROM pet_schema.pets p WHERE id=$1',[pet])).rows[0];
      migrate(['up']);
      execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs','--write-missing'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
      execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
      expect((await upgraded.query('SELECT row_to_json(p) pet FROM pet_schema.pets p WHERE id=$1',[pet])).rows[0]).toEqual(before);
      expect((await upgraded.query('SELECT ocr_result FROM pet_schema.pet_documents WHERE id=$1',[document])).rows[0].ocr_result).toEqual({text:'legacy raw'});
      expect((await upgraded.query('SELECT count(*)::int n FROM medical_schema.appointment_data_shares')).rows[0].n).toBe(0);
      expect((await upgraded.query('SELECT count(*)::int n FROM medical_schema.appointment_data_share_resources')).rows[0].n).toBe(0);
      expect((await upgraded.query(`SELECT row_to_json(v) visit,row_to_json(r) result,row_to_json(a) amendment FROM clinical_schema.visits v JOIN clinical_schema.visit_results r ON r.visit_id=v.id JOIN clinical_schema.visit_result_amendments a ON a.result_id=r.id WHERE v.id=$1`,[visit])).rows).toEqual(clinicalBefore);
      expect((await upgraded.query("SELECT name FROM schema_migrations WHERE name LIKE '171973%'" )).rows).toHaveLength(1);
      expect((await upgraded.query('SELECT * FROM clinical_schema.diary_entries WHERE visit_id=$1 ORDER BY id',[visit])).rows).toEqual(diaryBefore);
    }finally{await upgraded?.end();await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();}
  });
});
