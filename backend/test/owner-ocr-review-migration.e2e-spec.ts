import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {Client} from 'pg';
jest.setTimeout(120000);
describe('Populated W4B01 -> W4B02 migration',()=>{
  it('preserves exact legacy/job/raw/candidate rows and70 migration hashes, initializes no Owner decisions',async()=>{
    const url=new URL(process.env.DATABASE_URL!);if(process.env.W4B02_ACCEPTANCE!=='true'||url.hostname!=='postgres'||!url.pathname.startsWith('/vethelp_w4b02_'))throw new Error('Owned Docker DB only');
    const admin=new Client({connectionString:url.toString()});await admin.connect();const name='vethelp_w4b02_upgrade_'+randomUUID().replace(/-/g,'');let db:Client|undefined;
    const migrate=(args:string[])=>execFileSync(process.execPath,['node_modules/node-pg-migrate/bin/node-pg-migrate.js',...args,'--migrations-dir','migrations/node-pg','--migrations-table','schema_migrations','--single-transaction'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe',timeout:60000});
    try{await admin.query(`CREATE DATABASE "${name}"`);url.pathname='/'+name;migrate(['up','1719740000000','--timestamp']);db=new Client({connectionString:url.toString()});await db.connect();
      const owner=randomUUID(),pet=randomUUID(),doc=randomUUID(),job=randomUUID(),attempt=randomUUID(),result=randomUUID(),candidate=randomUUID(),legacy={text:'Legacy value',unknown:{preserve:true}},extraction={text:'Original extracted text',provider:'SIMULATED_OCR'};
      const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
      await db.query('INSERT INTO identity_schema.users(id) VALUES($1)',[owner]);await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species,medical_history_ocr) VALUES($1,$2,'Legacy','DOG',$3)`,[pet,owner,JSON.stringify(legacy)]);await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status,ocr_result) VALUES($1,$2,$3,'source','HISTORY','PROCESSED',$4)`,[doc,pet,owner,JSON.stringify(legacy)]);
      await db.query(`INSERT INTO pet_schema.ocr_jobs(id,document_id,owner_id,pet_id,source_identity,source_snapshot,state,attempt_count) VALUES($1,$2,$3,$4,$5,$6,'SUCCEEDED',1)`,[job,doc,owner,pet,hash('source'),JSON.stringify({documentId:doc,documentType:'HISTORY'})]);
      await db.query(`INSERT INTO pet_schema.ocr_attempts(id,job_id,attempt_number,status,finished_at,provider_identity) VALUES($1,$2,1,'SUCCEEDED',clock_timestamp(),'SIMULATED_OCR')`,[attempt,job]);await db.query(`INSERT INTO pet_schema.ocr_results(id,job_id,attempt_id,document_id,owner_id,pet_id,source_identity,result_identity,extraction) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[result,job,attempt,doc,owner,pet,hash('source'),hash(JSON.stringify(extraction)),JSON.stringify(extraction)]);await db.query(`INSERT INTO pet_schema.ocr_candidates(id,result_id,job_id,extracted_text) VALUES($1,$2,$3,$4)`,[candidate,result,job,extraction.text]);
      const tables=['pets','pet_documents','ocr_jobs','ocr_attempts','ocr_results','ocr_candidates'];const before:Record<string,unknown>={};for(const t of tables)before[t]=(await db.query(`SELECT * FROM pet_schema.${t}`)).rows;
      execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs','--write-missing'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});const hashes=(await db.query('SELECT * FROM schema_migration_checksums WHERE file_name NOT LIKE $1 ORDER BY file_name',['171975%'])).rows;
      migrate(['up']);execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
      for(const t of tables)expect((await db.query(`SELECT * FROM pet_schema.${t}`)).rows).toEqual(before[t]);expect((await db.query('SELECT * FROM schema_migration_checksums WHERE file_name NOT LIKE $1 ORDER BY file_name',['171975%'])).rows).toEqual(hashes);expect(hashes).toHaveLength(70);expect((await db.query('SELECT * FROM pet_schema.ocr_review_revisions')).rows).toHaveLength(0);expect((await db.query('SELECT authority,raw_result FROM pet_schema.ocr_legacy_unverified')).rows).toEqual([{authority:'LEGACY_UNVERIFIED',raw_result:legacy},{authority:'LEGACY_UNVERIFIED',raw_result:legacy}]);expect(()=>migrate(['down','1'])).toThrow();
    }finally{await db?.end();await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();}
  });
});
