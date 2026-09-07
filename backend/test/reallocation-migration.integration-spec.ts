import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';

jest.setTimeout(180_000);

describe('W6-A reallocation schema migration',()=>{
  it('adds exactly the approved tables with bounded integrity and reverses without removing W5',async()=>{
    const configured=process.env.DATABASE_URL;
    if(!configured)throw new Error('DATABASE_URL is required');
    const admin=new Client({connectionString:configured});
    const databaseName=`vethelp_w6a_${process.pid}_${Date.now()}`;
    const target=new URL(configured);target.pathname=`/${databaseName}`;
    let client:Client|null=null;
    await admin.connect();
    try{
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      run('up',target.toString());
      client=new Client({connectionString:target.toString()});await client.connect();
      expect((await client.query(`SELECT to_regclass('booking_schema.reallocation_cases') cases,to_regclass('booking_schema.reallocation_offers') offers`)).rows[0]).toEqual({cases:'booking_schema.reallocation_cases',offers:'booking_schema.reallocation_offers'});
      const definitions=(await client.query<{definition:string}>(`SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid IN ('booking_schema.reallocation_cases'::regclass,'booking_schema.reallocation_offers'::regclass) UNION ALL SELECT indexdef FROM pg_indexes WHERE schemaname='booking_schema' AND tablename IN ('reallocation_cases','reallocation_offers')`)).rows.map(row=>row.definition).join('\n');
      expect(definitions).toContain("rank >= 1");
      expect(definitions).toContain("rank <= 5");
      expect(definitions).toContain("expires_at = (created_at + '00:15:00'::interval)");
      expect(definitions).toContain('UNIQUE (reallocation_case_id, slot_id, slot_version)');
      expect(definitions).toContain("WHERE (status = 'OPEN'::text)");
      expect((await client.query(`SELECT count(*)::int count FROM pg_trigger WHERE tgrelid IN ('booking_schema.reallocation_cases'::regclass,'booking_schema.reallocation_offers'::regclass) AND NOT tgisinternal`)).rows[0].count).toBe(2);
      run('down',target.toString());
      expect((await client.query(`SELECT to_regclass('booking_schema.reallocation_cases') cases,to_regclass('booking_schema.reallocation_offers') offers,to_regclass('booking_schema.booking_change_requests') w5`)).rows[0]).toEqual({cases:null,offers:null,w5:'booking_schema.booking_change_requests'});
      run('up',target.toString());
      expect((await client.query(`SELECT count(*)::int count FROM public.schema_migrations WHERE name='1719580000000_add_reallocation_cases_and_offers'`)).rows[0].count).toBe(1);
    }finally{
      await client?.end();await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`,[databaseName]);await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);await admin.end();
    }
  });
});

function run(direction:'up'|'down',databaseUrl:string){execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),[direction,'--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:databaseUrl},stdio:'pipe'});}
