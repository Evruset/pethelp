import {readFile,lstat} from 'node:fs/promises';
import {Pool} from 'pg';
import {protocolCatalogQuery,protocolCatalogAnchors,protocolMigrationHashes} from './ocr-db-protocol';
import {DatabaseService} from '../database/database.service';
import {protectedSnapshotRoot,readVerifiedSnapshot} from '../common/document-byte-snapshots';
export const operationalDenied=()=>new Error('OCR_OPERATIONAL_PREFLIGHT_DENIED');
export type OcrProcessRole='publisher'|'worker';
/** No production profile is accepted. An environment assertion alone is not production proof. */
export function operationalRole():OcrProcessRole {
 if(process.env.NODE_ENV!=='test'||process.env.W4B03A03_ACCEPTANCE!=='true'||process.env.OCR_OPERATIONAL_PROFILE!=='ISOLATED_TEST_V1')throw operationalDenied();
 const role=process.env.OCR_PROCESS_ROLE;if(role!=='publisher'&&role!=='worker')throw operationalDenied();
 if(role==='publisher'&&(process.env.WORKERS_ENABLED??'true').toLowerCase()!=='false')throw operationalDenied();
 return role;
}
/** Exact mount point, kernel RO worker, private root and protected ancestors; no filesystem mutation. */
export async function verifyOperationalMount(role:OcrProcessRole){
 if(process.platform!=='linux'||process.getuid?.()===0)throw operationalDenied();
 const status=await readFile('/proc/self/status','utf8');if(!/^NoNewPrivs:\s+1$/m.test(status)||!/^CapEff:\s+0+$/m.test(status)||!/^CapBnd:\s+0+$/m.test(status))throw operationalDenied();
 const root=await protectedSnapshotRoot();const stat=await lstat(root);
 const mountInfo=await readFile('/proc/self/mountinfo','utf8');
 const decode=(s:string)=>s.replace(/\\([0-7]{3})/g,(_,n)=>String.fromCharCode(parseInt(n,8)));
 const matches=mountInfo.trim().split('\n').map(s=>s.split(' ')).filter(p=>decode(p[4]??'')===root);
 if(matches.length!==1)throw operationalDenied();const opts=matches[0][5].split(',');
 if(!opts.includes('nosuid')||!opts.includes('nodev')||!opts.includes('noexec'))throw operationalDenied();
 if(role==='worker'?!opts.includes('ro'):!opts.includes('rw'))throw operationalDenied();
 if(role==='worker'&&mountInfo.trim().split('\n').map(s=>s.split(' ')).some(p=>p[2]===matches[0][2]&&p[5].split(',').includes('rw')))throw operationalDenied();
 if(stat.uid!==process.getuid?.()||(stat.mode&0o077)!==0)throw operationalDenied();
 return{role,readOnly:opts.includes('ro'),uid:stat.uid,gid:stat.gid,profile:'ISOLATED_TEST_V1'};
}
/** Bounded read-only reconciliation, no filesystem I/O while a DB transaction is held. */
export async function reconcileOperationalSources(db:DatabaseService){
 await verifyDatabaseProtocol(db);
 const versions=(await db.query(`SELECT v.version_id,v.storage_object_id,v.sha256,v.byte_length,EXISTS(SELECT 1 FROM pet_schema.document_byte_events e WHERE e.version_id=v.version_id AND e.event_type IN('CORRUPT','UNAVAILABLE','REPLACED','RETIRED')) quarantined FROM pet_schema.document_byte_versions v ORDER BY version_id LIMIT 1001`)).rows;
 if(versions.length>1000)throw operationalDenied();
 const invalid=(await db.query(`SELECT 1 FROM pet_schema.ocr_jobs j JOIN pet_schema.ocr_job_byte_sources s ON s.job_id=j.id LEFT JOIN pet_schema.ocr_results r ON r.job_id=j.id LEFT JOIN pet_schema.ocr_attempt_byte_receipts e ON e.job_id=j.id LEFT JOIN pet_schema.ocr_result_byte_bindings b ON b.job_id=j.id WHERE
 (j.state='SUCCEEDED' AND (r.id IS NULL OR e.attempt_id IS DISTINCT FROM r.attempt_id OR e.extraction_identity IS DISTINCT FROM r.result_identity OR NOT EXISTS(SELECT 1 FROM pet_schema.ocr_candidates c WHERE c.result_id=r.id AND c.job_id=j.id) OR NOT EXISTS(SELECT 1 FROM pet_schema.ocr_attempts a WHERE a.id=r.attempt_id AND a.job_id=j.id AND a.status='SUCCEEDED') OR
 (e.input_evidence_class='ACTUAL_BYTE_INPUT' AND (b.result_id IS DISTINCT FROM r.id OR NOT e.full_consumption OR e.consumed_sha256 IS DISTINCT FROM s.sha256 OR e.consumed_length IS DISTINCT FROM s.byte_length OR e.evidence_origin IS DISTINCT FROM 'TEST_CONSUMER')) OR
 (e.input_evidence_class='SIMULATED_METADATA_ONLY' AND (b.result_id IS NOT NULL OR e.full_consumption OR e.consumed_length<>0 OR e.consumed_sha256 IS NOT NULL OR e.evidence_origin IS DISTINCT FROM 'SIMULATED_PROVIDER')))) OR
 (j.state<>'SUCCEEDED' AND (r.id IS NOT NULL OR e.attempt_id IS NOT NULL OR b.result_id IS NOT NULL)) LIMIT 1`)).rowCount;
 if(invalid)throw operationalDenied();
 if((await db.query(`SELECT 1 FROM pet_schema.ocr_review_revisions rev JOIN pet_schema.ocr_candidates c ON c.id=rev.candidate_id WHERE rev.original_text_identity<>encode(digest(c.extracted_text,'sha256'),'hex') OR rev.text_identity<>encode(digest(rev.corrected_text,'sha256'),'hex') LIMIT 1`)).rowCount)throw operationalDenied();
 for(const v of versions){if(v.quarantined)continue;try{await readVerifiedSnapshot({storageObjectId:v.storage_object_id,sha256:v.sha256,byteLength:Number(v.byte_length)});}catch{throw operationalDenied();}}
 return{versions:versions.length,verifiedEligible:versions.filter(v=>!v.quarantined).length,quarantined:versions.filter(v=>v.quarantined).length,eligibleSourceBytesRehashed:true,provenanceReconciled:true,productionReadiness:'NOT_VERIFIED'};
}
export async function verifyDatabaseProtocol(db:DatabaseService){
 const actual=Object.fromEntries((await db.query(protocolCatalogQuery)).rows.map(r=>[r.key,r.value]));
 for(const [key,value] of Object.entries(protocolCatalogAnchors))if(actual[key]!==value)throw operationalDenied();
 const hashes=Object.fromEntries((await db.query('SELECT file_name,sha256 FROM public.schema_migration_checksums')).rows.map(r=>[r.file_name,r.sha256]));for(const [key,value] of Object.entries(protocolMigrationHashes))if(hashes[key]!==value)throw operationalDenied();
}
async function ordinaryIdentity(db:DatabaseService,role:OcrProcessRole){
 const r=(await db.query(`SELECT session_user name,r.rolsuper,r.rolcreaterole,r.rolcreatedb,r.rolbypassrls,r.rolreplication,pg_has_role(session_user,'vethelp_ocr_byte_executor','MEMBER') executor_member FROM pg_roles r WHERE rolname=session_user`)).rows[0];
 if(!r||r.rolsuper||r.rolcreaterole||r.rolcreatedb||r.rolbypassrls||r.rolreplication||r.executor_member)throw operationalDenied();
 if(role==='worker'&&(await db.query(`SELECT 1 FROM pg_roles WHERE rolname<>session_user AND pg_has_role(session_user,oid,'MEMBER') LIMIT 1`)).rowCount)throw operationalDenied();
 if(role==='worker')for(const table of ['pets','pet_documents','ocr_jobs','ocr_attempts','ocr_results','ocr_candidates','document_byte_versions','document_byte_events','ocr_job_byte_sources','ocr_attempt_byte_receipts','ocr_result_byte_bindings'])for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE'])if((await db.query('SELECT has_table_privilege(session_user,$1,$2) yes',['pet_schema.'+table,privilege])).rows[0].yes)throw operationalDenied();
 if(role==='worker')for(const table of ['pets','pet_documents','ocr_jobs','ocr_attempts','ocr_results','ocr_candidates','document_byte_versions','document_byte_events','ocr_job_byte_sources','ocr_attempt_byte_receipts','ocr_result_byte_bindings'])for(const privilege of ['INSERT','UPDATE'])if((await db.query('SELECT has_any_column_privilege(session_user,$1,$2) yes',['pet_schema.'+table,privilege])).rows[0].yes)throw operationalDenied();
 return r.name as string;
}
async function writerIdentity(pool:Pool,ordinary:string){const c=await pool.connect();try{
 const r=(await c.query(`SELECT session_user name,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls,rolreplication,rolinherit FROM pg_roles WHERE rolname=session_user`)).rows[0];
 if((await c.query(`SELECT 1 FROM pg_roles WHERE rolname NOT IN(session_user,'vethelp_ocr_byte_executor') AND pg_has_role(session_user,oid,'MEMBER') LIMIT 1`)).rowCount)throw operationalDenied();
 if(!r||r.name===ordinary||r.rolsuper||r.rolcreaterole||r.rolcreatedb||r.rolbypassrls||r.rolreplication||r.rolinherit)throw operationalDenied();
 if((await c.query(`SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relkind IN('r','p','v','m','f') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND (has_any_column_privilege(session_user,t.oid,'SELECT,INSERT,UPDATE') OR has_table_privilege(session_user,t.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER')) LIMIT 1`)).rowCount)throw operationalDenied();
 await c.query('BEGIN');await c.query('SET LOCAL ROLE vethelp_ocr_byte_executor');
 const group=(await c.query('SELECT rolcanlogin,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];if(!group||Object.values(group).some(Boolean))throw operationalDenied();
 for(const table of ['document_byte_versions','document_byte_events','ocr_job_byte_sources','ocr_attempt_byte_receipts','ocr_result_byte_bindings'])for(const privilege of ['DELETE','TRUNCATE'])if((await c.query('SELECT has_table_privilege(current_user,$1,$2) yes',['pet_schema.'+table,privilege])).rows[0].yes)throw operationalDenied();
 if((await c.query(`SELECT has_column_privilege(current_user,'pet_schema.pets','medical_history_ocr','UPDATE') yes`)).rows[0].yes)throw operationalDenied();
 for(const table of ['ocr_attempts','ocr_results','ocr_candidates','document_byte_events','ocr_attempt_byte_receipts','ocr_result_byte_bindings'])if(!(await c.query('SELECT has_table_privilege(current_user,$1,$2) yes',['pet_schema.'+table,'INSERT'])).rows[0].yes)throw operationalDenied();
 for(const table of ['ocr_jobs','ocr_attempts'])if(!(await c.query('SELECT has_table_privilege(current_user,$1,$2) yes',['pet_schema.'+table,'UPDATE'])).rows[0].yes)throw operationalDenied();
 if((await c.query(`SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' AND (has_schema_privilege(session_user,oid,'CREATE') OR has_schema_privilege(current_user,oid,'CREATE')) LIMIT 1`)).rowCount)throw operationalDenied();
 const selectAllowed=['pets','pet_documents','ocr_jobs','ocr_attempts','ocr_results','ocr_candidates','document_byte_versions','document_byte_events','ocr_job_byte_sources','ocr_attempt_byte_receipts','ocr_result_byte_bindings'];
 const insertAllowed=['ocr_attempts','ocr_results','ocr_candidates','document_byte_events','ocr_attempt_byte_receipts','ocr_result_byte_bindings'];
 const updateAllowed=['ocr_jobs','ocr_attempts'];
 const excessive=(await c.query(`SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relkind IN('r','p','v','m','f') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND (
 has_table_privilege(current_user,t.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
 (has_any_column_privilege(current_user,t.oid,'SELECT') AND NOT(n.nspname='pet_schema' AND t.relname=ANY($3::text[]))) OR
 (has_any_column_privilege(current_user,t.oid,'INSERT') AND NOT (n.nspname='pet_schema' AND t.relname=ANY($1::text[]) OR n.nspname='audit_schema' AND t.relname='audit_log')) OR
 EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(current_user,t.oid,a.attnum,'UPDATE') AND NOT (n.nspname='pet_schema' AND (t.relname=ANY($2::text[]) OR t.relname IN('pets','pet_documents') AND a.attname='id' OR t.relname='document_byte_versions' AND a.attname='version_id')))) LIMIT 1`,[insertAllowed,updateAllowed,selectAllowed])).rowCount;
 if(excessive)throw operationalDenied();
 await c.query('ROLLBACK');return r.name as string;
 }catch{await c.query('ROLLBACK').catch(()=>undefined);throw operationalDenied();}finally{c.release();}}
export async function operationalPreflight(db:DatabaseService,pool?:Pool){try{
 const role=operationalRole(),mount=await verifyOperationalMount(role),ordinary=await ordinaryIdentity(db,role);
 if(role==='publisher'&&(pool||process.env.OCR_BYTE_DATABASE_URL))throw operationalDenied();
 if(role==='worker'){if(!pool)throw operationalDenied();await writerIdentity(pool,ordinary);}
 const reconciliation=await reconcileOperationalSources(db);return{role,mount,reconciliation};
 }catch{throw operationalDenied();}}

export async function operationalReaderPreflight(db:DatabaseService){try{if(operationalRole()!=='worker')throw operationalDenied();await verifyOperationalMount('worker');await ordinaryIdentity(db,'worker');return await reconcileOperationalSources(db);}catch{throw operationalDenied();}}
