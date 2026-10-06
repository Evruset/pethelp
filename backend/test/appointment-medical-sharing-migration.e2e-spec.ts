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
      const before=(await upgraded.query('SELECT row_to_json(p) pet FROM pet_schema.pets p WHERE id=$1',[pet])).rows[0];
      migrate(['up']);
      execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs','--write-missing'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
      execFileSync(process.execPath,['scripts/verify-migration-checksums.cjs'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
      expect((await upgraded.query('SELECT row_to_json(p) pet FROM pet_schema.pets p WHERE id=$1',[pet])).rows[0]).toEqual(before);
      expect((await upgraded.query('SELECT ocr_result FROM pet_schema.pet_documents WHERE id=$1',[document])).rows[0].ocr_result).toEqual({text:'legacy raw'});
      expect((await upgraded.query('SELECT count(*)::int n FROM medical_schema.appointment_data_shares')).rows[0].n).toBe(0);
    }finally{await upgraded?.end();await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();}
  });
});
