// Compare seed reruns against authoritative current state, not initial CSV projection.
import {createRequire} from 'node:module';import {createHash} from 'node:crypto';import {syntheticEnv} from './env.mjs';Object.assign(process.env,syntheticEnv);
const require=createRequire(import.meta.url);const {connect,NS}=require('../../backend/scripts/seed-local-multi-clinic.cjs');const c=await connect();
try{if(process.argv.includes('--all-tables')){
 await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const tables=(await c.query("SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY n.nspname,c.relname")).rows;
 const result={};const quote=s=>'\"'+s.replaceAll('\"','\"\"')+'\"';
 for(const t of tables){const name=quote(t.schema)+'.'+quote(t.name);result[t.schema+'.'+t.name]=(await c.query(`SELECT count(*)::int count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) digest FROM ${name} t`)).rows[0];}
 await c.query('COMMIT');console.log(JSON.stringify(result));
 }else{const result={};for(const table of ['clinic_schema.appointment_slots','booking_schema.booking_holds','booking_schema.appointments','booking_schema.outbox_events','audit_schema.audit_log','pet_schema.pets']){
 const r=await c.query(`SELECT row_to_json(t) AS row FROM ${table} t ORDER BY id`);result[table]={count:r.rowCount,sha256:createHash('sha256').update(JSON.stringify(r.rows)).digest('hex')};}
 console.log(JSON.stringify(result));}
}finally{await c.end();}
