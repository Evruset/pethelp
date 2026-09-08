import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';

jest.setTimeout(240_000);
const PREDECESSOR = '1719630000000_add_doctor_public_profile_consent_events';

describe('service taxonomy authority migration (isolated PostgreSQL)', () => {
  it('creates an empty explicit authority on a clean database', async () => {
    await withDatabase('clean', async (target) => {
      migrate(target);
      const client = await connected(target);
      try {
        expect((await client.query(`SELECT to_regclass('catalog_schema.specialty_services') value`)).rows[0].value).toBe('catalog_schema.specialty_services');
        expect((await client.query(`SELECT count(*)::int count FROM catalog_schema.specialty_services`)).rows[0].count).toBe(0);
      } finally { await client.end(); }
    });
  });

  it('forwards legacy services without inventing mappings and enforces one explicit classification', async () => {
    await withDatabase('forward', async (target) => {
      migrate(target, PREDECESSOR);
      const client = await connected(target);
      const ids = { actor:'72000000-0000-4000-8000-000000000001', clinic:'72000000-0000-4000-8000-000000000002', location:'72000000-0000-4000-8000-000000000003', service:'72000000-0000-4000-8000-000000000004', specialty:'72000000-0000-4000-8000-000000000005', other:'72000000-0000-4000-8000-000000000006' };
      try {
        await client.query(`INSERT INTO identity_schema.users(id) VALUES($1)`,[ids.actor]);
        await client.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone) VALUES($1,'Legacy','Legacy','ACTIVE','Europe/Moscow')`,[ids.clinic]);
        await client.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'Legacy','ACTIVE','Europe/Moscow')`,[ids.location,ids.clinic]);
        await client.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,'LEGACY','Legacy service',30,true,1000,'RUB')`,[ids.service,ids.location]);
        await client.query(`INSERT INTO catalog_schema.specialties(id,name,code) VALUES($1,'Known','KNOWN'),($2,'Other','OTHER')`,[ids.specialty,ids.other]);
        migrate(target);
        expect((await client.query(`SELECT count(*)::int count FROM catalog_schema.specialty_services WHERE service_id=$1`,[ids.service])).rows[0].count).toBe(0);
        await client.query(`INSERT INTO catalog_schema.specialty_services(service_id,specialty_id,created_by) VALUES($1,$2,$3)`,[ids.service,ids.specialty,ids.actor]);
        await expect(client.query(`INSERT INTO catalog_schema.specialty_services(service_id,specialty_id,created_by) VALUES($1,$2,$3)`,[ids.service,ids.other,ids.actor])).rejects.toMatchObject({code:'23505'});
      } finally { await client.end(); }
    });
  });
});

async function connected(databaseUrl:string){const client=new Client({connectionString:databaseUrl});await client.connect();return client;}
async function withDatabase(label:string,body:(databaseUrl:string)=>Promise<void>){const configured=process.env.DATABASE_URL;if(!configured)throw new Error('DATABASE_URL is required');const admin=await connected(configured);const name=`vethelp_service_taxonomy_${label}_${process.pid}_${Date.now()}`,target=new URL(configured);target.pathname=`/${name}`;try{await admin.query(`CREATE DATABASE "${name}"`);await body(target.toString());}finally{await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`,[name]);await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();}}
function migrate(databaseUrl:string,to?:string){const args=['up','--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'];if(to)args.push('--to',to);execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),args,{cwd:process.cwd(),env:{...process.env,DATABASE_URL:databaseUrl},stdio:'pipe'});}
