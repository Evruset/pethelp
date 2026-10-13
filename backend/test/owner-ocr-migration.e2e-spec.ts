import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
jest.setTimeout(120000);
describe('OCR append-only populated legacy upgrade',()=>{
  it('preserves exact legacy rows and checksums, classifies old values unverified, and refuses destructive rollback',async()=>{
    const url=new URL(process.env.DATABASE_URL!);if(process.env.W4B_ACCEPTANCE!=='true'||url.hostname!=='postgres'||!url.pathname.startsWith('/vethelp_w4b_'))throw new Error('Test-owned DB required');
    const admin=new Client({connectionString:url.toString()});await admin.connect();const name='vethelp_w4b_upgrade_'+randomUUID().replace(/-/g,'');let db:Client|undefined;
    const migrate=(args:string[])=>execFileSync(process.execPath,['node_modules/node-pg-migrate/bin/node-pg-migrate.js',...args,'--migrations-dir','migrations/node-pg','--migrations-table','schema_migrations','--single-transaction'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe',timeout:60000});
    try{await admin.query(`CREATE DATABASE "${name}"`);url.pathname='/'+name;migrate(['up','1719730000000','--timestamp']);db=new Client({connectionString:url.toString()});await db.connect();
      const owner=randomUUID(),pet=randomUUID(),doc=randomUUID(),history={text:'legacy history',unknown:{retained:true}},ocr={text:'legacy raw',sourceUrl:'historic-value'};
      await db.query('INSERT INTO identity_schema.users(id) VALUES($1)',[owner]);await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species,medical_history_ocr) VALUES($1,$2,'Legacy','DOG',$3)`,[pet,owner,JSON.stringify(history)]);
      await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status,ocr_result) VALUES($1,$2,$3,'old-private-source','HISTORY','PROCESSED',$4)`,[doc,pet,owner,JSON.stringify(ocr)]);
      const before=(await db.query('SELECT row_to_json(p) pet,row_to_json(d) document FROM pet_schema.pets p JOIN pet_schema.pet_documents d ON d.pet_id=p.id WHERE p.id=$1',[pet])).rows;
      execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs','--write-missing'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
      const prior=(await db.query('SELECT * FROM public.schema_migration_checksums WHERE file_name NOT LIKE $1 ORDER BY file_name',['171974%'])).rows;
      migrate(['up']);execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs','--write-missing'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
      expect((await db.query('SELECT row_to_json(p) pet,row_to_json(d) document FROM pet_schema.pets p JOIN pet_schema.pet_documents d ON d.pet_id=p.id WHERE p.id=$1',[pet])).rows).toEqual(before);
      expect((await db.query("SELECT authority,raw_result FROM pet_schema.ocr_legacy_unverified ORDER BY source_kind")).rows).toEqual([{authority:'LEGACY_UNVERIFIED',raw_result:ocr},{authority:'LEGACY_UNVERIFIED',raw_result:history}]);
      expect((await db.query('SELECT count(*)::int n FROM pet_schema.ocr_jobs')).rows[0].n).toBe(0);
      expect((await db.query('SELECT * FROM public.schema_migration_checksums WHERE file_name NOT LIKE $1 ORDER BY file_name',['171974%'])).rows).toEqual(prior);
      expect(()=>migrate(['down','1'])).toThrow();expect((await db.query("SELECT * FROM schema_migrations WHERE name LIKE '171974%'")).rows).toHaveLength(1);
    }finally{await db?.end();await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();}
  });
});
