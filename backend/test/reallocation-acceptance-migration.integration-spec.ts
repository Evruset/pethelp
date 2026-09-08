import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Client} from 'pg';

jest.setTimeout(180_000);

describe('W6-C1 acceptance lineage migration',()=>{
  it('upgrades additively and reverses only compatible pre-acceptance state',async()=>{
    const configured=process.env.DATABASE_URL;if(!configured)throw new Error('DATABASE_URL is required');
    const admin=new Client({connectionString:configured}),name=`vethelp_w6c1_${process.pid}_${Date.now()}`,target=new URL(configured);target.pathname=`/${name}`;let client:Client|null=null;
    const previous=join(process.cwd(),'migrations/node-pg/1719580000000_add_reallocation_cases_and_offers.js'),checksum=sha(previous);
    await admin.connect();
    try{
      await admin.query(`CREATE DATABASE "${name}"`);run('up',target.toString());client=new Client({connectionString:target.toString()});await client.connect();
      const columns=(await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='booking_schema' AND table_name='reallocation_cases' AND column_name IN ('accepted_offer_id','replacement_booking_hold_id','acceptance_idempotency_key','accepted_at') ORDER BY column_name`)).rows.map(row=>row.column_name);expect(columns).toEqual(['acceptance_idempotency_key','accepted_at','accepted_offer_id','replacement_booking_hold_id']);
      const definitions=(await client.query<{definition:string}>(`SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid IN ('booking_schema.reallocation_cases'::regclass,'booking_schema.reallocation_offers'::regclass,'booking_schema.booking_holds'::regclass)`)).rows.map(row=>row.definition).join('\n');expect(definitions).toContain('REPLACEMENT_PENDING_CONFIRMATION');expect(definitions).toContain('ACCEPTED');expect(definitions).toContain('FOREIGN KEY (accepted_offer_id, id)');expect(definitions).toContain('UNIQUE (replacement_booking_hold_id)');expect(definitions).toContain('UNIQUE (acceptance_idempotency_key)');
      run('down',target.toString());expect((await client.query(`SELECT count(*)::int count FROM information_schema.columns WHERE table_schema='booking_schema' AND table_name='reallocation_cases' AND column_name='accepted_offer_id'`)).rows[0].count).toBe(1);
      run('down',target.toString());expect((await client.query(`SELECT count(*)::int count FROM information_schema.columns WHERE table_schema='booking_schema' AND table_name='reallocation_cases' AND column_name='accepted_offer_id'`)).rows[0].count).toBe(0);
      run('up',target.toString());expect((await client.query(`SELECT count(*)::int count FROM public.schema_migrations WHERE name IN ('1719590000000_add_reallocation_acceptance_lineage','1719600000000_allow_terminal_reallocation_acceptance_lineage')`)).rows[0].count).toBe(2);expect(sha(previous)).toBe(checksum);
    }finally{await client?.end();await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`,[name]);await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();}
  });
});

function sha(path:string){return createHash('sha256').update(readFileSync(path)).digest('hex');}
function run(direction:'up'|'down',databaseUrl:string){execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),[direction,'--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:databaseUrl},stdio:'pipe'});}
