import {ConflictException,ForbiddenException,Injectable,NotFoundException,OnModuleDestroy} from '@nestjs/common';
import {Pool,PoolClient} from 'pg';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseService} from '../database/database.service';
import {config} from '../config';
import {readVerifiedSnapshot} from '../common/document-byte-snapshots';
import {JwtPayload,Role} from './auth.types';
import type {OcrClaim} from './owner-ocr.service';
import {ByteEvidenceError,ByteContext,OcrExecution,trustedExecutionReceipt,extractionHash,VerifiedByteInput} from './ocr-byte-adapter';
import type {OcrExtraction} from './ocr-provider';
type Job={id:string;document_id:string;owner_id:string;pet_id:string;state:string;claim_token:string|null;lease_until:Date|null;attempt_count:number;source_identity:string;source_snapshot:{documentId:string;documentType:'PASSPORT'|'HISTORY'}};
type Bound={job_id:string;version_id:string;sha256:string;byte_length:string;storage_object_id:string};
type Adapter={extractVerified(input:VerifiedByteInput,signal:AbortSignal):Promise<OcrExecution>};
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
@Injectable()
export class OcrByteExecutionService implements OnModuleDestroy {
 readonly enabled=process.env.OCR_VERIFIED_BYTES_ENABLED==='true';
 private readonly pool?:Pool;
 constructor(private readonly database:DatabaseService){
  if(this.enabled){const value=process.env.OCR_BYTE_DATABASE_URL;if(!value)throw new Error('OCR byte writer configuration required');const a=new URL(config.databaseUrl),b=new URL(value);if(a.host!==b.host||a.pathname!==b.pathname||decodeURIComponent(a.username)===decodeURIComponent(b.username))throw new Error('Separate same-database OCR writer identity required');this.pool=new Pool({connectionString:value,max:2,connectionTimeoutMillis:1000,idleTimeoutMillis:1000});}
 }
 async onModuleDestroy(){await this.pool?.end();}
 private unavailable():never{throw new NotFoundException({code:'OWNER_OCR_NOT_FOUND'});}
 private async writer<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{
  if(!this.enabled||!this.pool)throw new Error('OCR byte execution disabled');const c=await this.pool.connect();
  try{await c.query('BEGIN');await c.query('SET LOCAL ROLE vethelp_ocr_byte_executor');await c.query("SELECT set_config('app.ocr_byte_protocol','VERIFIED_BYTES_V1',true)");const value=await work(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK').catch(()=>undefined);throw e;}finally{c.release();}
 }
 async isBound(jobId:string,client?:PoolClient){const sql='SELECT 1 FROM pet_schema.ocr_job_byte_sources WHERE job_id=$1';const result=client?await client.query(sql,[jobId]):await this.database.query(sql,[jobId]);return result.rowCount!==0;}
 async attachNewSource(c:PoolClient,jobId:string){
  if(!this.enabled)return;const j=(await c.query<Job>('SELECT * FROM pet_schema.ocr_jobs WHERE id=$1',[jobId])).rows[0];
  const v=(await c.query(`SELECT * FROM pet_schema.document_byte_versions WHERE document_id=$1 AND capture_kind='UPLOAD_BYTES' ORDER BY captured_at DESC LIMIT 1`,[j.document_id])).rows[0];if(!v)return;
  await c.query(`INSERT INTO pet_schema.ocr_job_byte_sources(job_id,document_id,owner_id,pet_id,version_id,sha256,byte_length) VALUES($1,$2,$3,$4,$5,$6,$7)`,[j.id,j.document_id,j.owner_id,j.pet_id,v.version_id,v.sha256,v.byte_length]);
 }
 /** Locks always job -> Pet -> Document -> version. No filesystem/provider operation here. */
 async context(c:PoolClient,j:Job):Promise<Bound>{
  const pet=await c.query('SELECT id FROM pet_schema.pets WHERE id=$1 AND owner_id=$2 AND archived_at IS NULL FOR SHARE',[j.pet_id,j.owner_id]);if(!pet.rowCount)this.unavailable();
  const d=(await c.query(`SELECT * FROM pet_schema.pet_documents WHERE id=$1 AND owner_id=$2 AND pet_id=$3 AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') FOR SHARE`,[j.document_id,j.owner_id,j.pet_id])).rows[0];if(!d)this.unavailable();
  const identity=sha(JSON.stringify([d.id,d.owner_id,d.pet_id,d.doc_type,d.storage_key,d.file_size_bytes,d.created_at.toISOString()]));if(identity!==j.source_identity)this.unavailable();
  const b=(await c.query<Bound>(`SELECT s.job_id,s.version_id,s.sha256,s.byte_length,v.storage_object_id FROM pet_schema.ocr_job_byte_sources s JOIN pet_schema.document_byte_versions v ON v.version_id=s.version_id WHERE s.job_id=$1 AND s.document_id=$2 AND s.owner_id=$3 AND s.pet_id=$4 AND v.capture_coherence='UPLOAD_BUFFER' FOR UPDATE OF v`,[j.id,j.document_id,j.owner_id,j.pet_id])).rows[0];
  if(!b||d.storage_key!==b.storage_object_id+'.blob'||d.file_size_bytes!==Number(b.byte_length))this.unavailable();
  if((await c.query(`SELECT 1 FROM pet_schema.document_byte_events WHERE version_id=$1 AND event_type IN('UNAVAILABLE','CORRUPT','REPLACED','RETIRED')`,[b.version_id])).rowCount)this.unavailable();return b;
 }
 async claim():Promise<OcrClaim|null>{
  if(!this.enabled)return null;
  return this.writer(async c=>{
   const j=(await c.query<Job>(`SELECT j.* FROM pet_schema.ocr_jobs j WHERE EXISTS(SELECT 1 FROM pet_schema.ocr_job_byte_sources WHERE job_id=j.id) AND ((j.state='QUEUED' AND j.available_at<=clock_timestamp()) OR (j.state='RUNNING' AND j.lease_until<=clock_timestamp())) ORDER BY j.available_at,j.created_at,j.id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];if(!j)return null;
   if(j.state==='RUNNING'){await c.query(`UPDATE pet_schema.ocr_attempts SET status='ABANDONED',finished_at=clock_timestamp(),error_code='LEASE_EXPIRED' WHERE id=$1 AND status='RUNNING'`,[j.claim_token]);if(j.attempt_count>=3){await c.query(`UPDATE pet_schema.ocr_jobs SET state='FAILED',claim_token=NULL,lease_until=NULL,error_code='LEASE_EXPIRED' WHERE id=$1`,[j.id]);return null;}}
   try{await this.context(c,j);}catch(e){if(!(e instanceof NotFoundException))throw e;await c.query(`UPDATE pet_schema.ocr_jobs SET state='FAILED',claim_token=NULL,lease_until=NULL,error_code='SOURCE_CHANGED' WHERE id=$1`,[j.id]);return null;}
   const token=randomUUID();const claim=(await c.query<OcrClaim>(`UPDATE pet_schema.ocr_jobs SET state='RUNNING',attempt_count=attempt_count+1,claim_token=$2,lease_until=clock_timestamp()+interval '60 seconds',error_code=NULL,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,[j.id,token])).rows[0];
   await c.query(`INSERT INTO pet_schema.ocr_attempts(id,job_id,attempt_number,status) VALUES($1,$2,$3,'RUNNING')`,[token,j.id,claim.attempt_count]);return claim;
  });
 }
 private async live(c:PoolClient,claim:OcrClaim){const j=(await c.query<Job>('SELECT * FROM pet_schema.ocr_jobs WHERE id=$1 FOR UPDATE',[claim.id])).rows[0];if(!j||j.state!=='RUNNING'||j.claim_token!==claim.claim_token||!j.lease_until||(await c.query('SELECT $1::timestamptz>clock_timestamp() live',[j.lease_until])).rows[0].live!==true)return null;return j;}
 async prepare(claim:OcrClaim):Promise<ByteContext & {storageObjectId:string}>{return this.writer(async c=>{const j=await this.live(c,claim);if(!j)this.unavailable();const b=await this.context(c,j);return{jobId:j.id,attemptId:claim.claim_token,versionId:b.version_id,sha256:b.sha256,byteLength:Number(b.byte_length),storageObjectId:b.storage_object_id,source:j.source_snapshot};});}
 private async snapshot(value:ByteContext & {storageObjectId:string}){return readVerifiedSnapshot({storageObjectId:value.storageObjectId,sha256:value.sha256,byteLength:value.byteLength});}
 async execute(claim:OcrClaim,adapter:Adapter,timeoutMs=30000):Promise<boolean>{
  const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let prepared:Awaited<ReturnType<OcrByteExecutionService['prepare']>>|undefined;
  try{
   prepared=await this.prepare(claim);let bytes:Buffer;try{bytes=await this.snapshot(prepared);}catch{await this.fail(claim,'SOURCE_CHANGED',prepared.versionId);return true;}
   await this.prepare(claim); // Scope/negative-event recheck after filesystem I/O, before invocation.
   const {storageObjectId: _privateStorageId,...context}=prepared;const input=Object.freeze({...context,bytes});const execution=await Promise.race([adapter.extractVerified(input,abort.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(new Error('OCR_TIMEOUT'));},timeoutMs);})]);
   try{await this.snapshot(prepared);}catch{await this.fail(claim,'SOURCE_CHANGED',prepared.versionId);return true;}
   return await this.complete(claim,prepared,execution);
  }catch(e){await this.fail(claim,e instanceof ByteEvidenceError?'INVALID_RESULT':e instanceof NotFoundException?'SOURCE_CHANGED':'PROVIDER_FAILED');return true;}finally{abort.abort();if(timer)clearTimeout(timer);}
 }
 /** Only opaque evidence minted at the trusted adapter boundary is accepted. */
 async complete(claim:OcrClaim,expected:ByteContext,execution:OcrExecution):Promise<boolean>{
  const receipt=trustedExecutionReceipt(execution),value=execution.extraction;this.validateExtraction(value);
  if(receipt.jobId!==claim.id||receipt.attemptId!==claim.claim_token||receipt.versionId!==expected.versionId||receipt.sha256!==expected.sha256||receipt.byteLength!==expected.byteLength||receipt.extractionIdentity!==extractionHash(value))throw new ByteEvidenceError();
  return this.writer(async c=>{
   const j=await this.live(c,claim);if(!j)return false;const b=await this.context(c,j);
   if(b.version_id!==receipt.versionId||b.sha256!==receipt.sha256||Number(b.byte_length)!==receipt.byteLength)throw new ByteEvidenceError();
   const event=(await c.query(`INSERT INTO pet_schema.document_byte_events(version_id,event_type,actor_id,operation_id) VALUES($1,'VERIFIED_USE',$2,$3) RETURNING id`,[b.version_id,j.owner_id,randomUUID()])).rows[0];
   await c.query(`UPDATE pet_schema.ocr_attempts SET status='SUCCEEDED',finished_at=clock_timestamp(),provider_identity=$2,provider_version=$3 WHERE id=$1`,[claim.claim_token,receipt.adapterIdentity,receipt.adapterVersion??null]);
   const r=(await c.query(`INSERT INTO pet_schema.ocr_results(job_id,attempt_id,document_id,owner_id,pet_id,source_identity,result_identity,extraction) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[j.id,claim.claim_token,j.document_id,j.owner_id,j.pet_id,j.source_identity,receipt.extractionIdentity,JSON.stringify(value)])).rows[0];
   await c.query(`INSERT INTO pet_schema.ocr_candidates(result_id,job_id,extracted_text) VALUES($1,$2,$3)`,[r.id,j.id,value.text]);
   await c.query(`INSERT INTO pet_schema.ocr_attempt_byte_receipts(attempt_id,job_id,version_id,sha256,byte_length,invocation_id,verification_event_id,input_evidence_class,full_consumption,consumed_length,consumed_sha256,adapter_identity,adapter_version,started_at,finished_at,evidence_origin,extraction_identity) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,[claim.claim_token,j.id,b.version_id,b.sha256,b.byte_length,receipt.invocationId,event.id,receipt.evidenceClass,receipt.fullConsumption,receipt.consumedLength,receipt.consumedSha256,receipt.adapterIdentity,receipt.adapterVersion??null,receipt.startedAt,receipt.finishedAt,receipt.origin,receipt.extractionIdentity]);
   if(receipt.evidenceClass==='ACTUAL_BYTE_INPUT'){const identity=sha([j.id,claim.claim_token,b.version_id,b.sha256,b.byte_length,receipt.extractionIdentity,receipt.invocationId].join(':'));await c.query(`INSERT INTO pet_schema.ocr_result_byte_bindings(result_id,job_id,attempt_id,version_id,sha256,byte_length,source_binding_identity) VALUES($1,$2,$3,$4,$5,$6,$7)`,[r.id,j.id,claim.claim_token,b.version_id,b.sha256,b.byte_length,identity]);}
   await c.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,payload_json) VALUES('OWNER',$1,'ocr.byte_execution.succeeded','ocr_job',$2,$3)`,[j.owner_id,j.id,JSON.stringify({jobId:j.id,attemptId:claim.claim_token,evidenceClass:receipt.evidenceClass})]);
   await c.query(`UPDATE pet_schema.ocr_jobs SET state='SUCCEEDED',claim_token=NULL,lease_until=NULL,error_code=NULL,updated_at=clock_timestamp() WHERE id=$1`,[j.id]);return true;
  });
 }
 private validateExtraction(value:OcrExtraction){
  if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['text','provider','providerVersion'].includes(k))||typeof value.text!=='string'||!value.text.trim()||value.text.includes('\u0000')||Buffer.byteLength(value.text)>32768||Buffer.byteLength(JSON.stringify(value))>65000)throw new ByteEvidenceError();
  for(const [key,max] of [['provider',120],['providerVersion',80]] as const)if(value[key]!==undefined&&(typeof value[key]!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value[key]!)||value[key]!.length>max))throw new ByteEvidenceError();
 }
 async fail(claim:OcrClaim,code:'SOURCE_CHANGED'|'INVALID_RESULT'|'PROVIDER_FAILED',corruptVersion?:string){
  if(!this.enabled)return false;return this.writer(async c=>{const j=await this.live(c,claim);if(!j)return false;
   // Failure events lock the version only after job; never version -> upstream.
   if(corruptVersion){const own=(await c.query('SELECT version_id FROM pet_schema.ocr_job_byte_sources WHERE job_id=$1 AND version_id=$2',[j.id,corruptVersion])).rows[0];if(own)await c.query(`INSERT INTO pet_schema.document_byte_events(version_id,event_type,actor_id,operation_id,error_code) VALUES($1,'CORRUPT',$2,$3,'INTEGRITY_FAILED')`,[own.version_id,j.owner_id,randomUUID()]);}
   await c.query(`UPDATE pet_schema.ocr_attempts SET status='FAILED',finished_at=clock_timestamp(),error_code=$2 WHERE id=$1 AND status='RUNNING'`,[claim.claim_token,code]);
   await c.query(`UPDATE pet_schema.ocr_jobs SET state=$2,claim_token=NULL,lease_until=NULL,error_code=$3,available_at=clock_timestamp()+($4::integer*interval '5 seconds'),updated_at=clock_timestamp() WHERE id=$1`,[j.id,code==='PROVIDER_FAILED'&&j.attempt_count<3?'QUEUED':'FAILED',code,j.attempt_count]);return true;
  });
 }
 /** Internal read-only proof; no import eligibility or public API. */
 async confirmedProof(owner:JwtPayload,petId:string,documentId:string,candidateId:string){
  if(!owner.roles.includes(Role.OWNER))throw new ForbiddenException({code:'ROLE_FORBIDDEN'});
  const lookup=async(c:PoolClient)=>{const j=(await c.query<Job>('SELECT * FROM pet_schema.ocr_jobs WHERE document_id=$1 AND owner_id=$2 AND pet_id=$3 FOR SHARE',[documentId,owner.sub,petId])).rows[0];if(!j||j.state!=='SUCCEEDED')this.unavailable();const b=await this.context(c,j);
   const r=(await c.query(`SELECT c.id candidate_id,c.extracted_text,rb.result_id,e.evidence_origin,rev.revision,rev.expected_revision,rev.text_version,rev.corrected_text,rev.original_text_identity,rev.text_identity,rev.actor_id FROM pet_schema.ocr_candidates c JOIN pet_schema.ocr_result_byte_bindings rb ON rb.result_id=c.result_id AND rb.job_id=c.job_id JOIN pet_schema.ocr_attempt_byte_receipts e ON e.attempt_id=rb.attempt_id JOIN LATERAL(SELECT * FROM pet_schema.ocr_review_revisions WHERE candidate_id=c.id ORDER BY revision DESC LIMIT 1) rev ON true WHERE c.id=$1 AND c.job_id=$2 AND rev.action='CONFIRM' AND rev.review_state='CONFIRMED' AND rev.actor_id=$3`,[candidateId,j.id,owner.sub])).rows[0];if(!r||sha(r.extracted_text)!==r.original_text_identity||sha(r.corrected_text)!==r.text_identity)this.unavailable();return{j,b,r};};
  const before=await this.database.withTransaction(lookup);await this.snapshot({jobId:before.j.id,attemptId:'',versionId:before.b.version_id,sha256:before.b.sha256,byteLength:Number(before.b.byte_length),storageObjectId:before.b.storage_object_id,source:before.j.source_snapshot});
  const {b,r}=await this.database.withTransaction(lookup);return{versionId:b.version_id,resultId:r.result_id,candidateId:r.candidate_id,confirmedRevision:r.revision,expectedRevision:r.expected_revision,textVersion:r.text_version,textIdentity:r.text_identity,actorId:r.actor_id,sourceBytesVerified:true,inputEvidenceClass:'ACTUAL_BYTE_INPUT',evidenceOrigin:r.evidence_origin,ownerConfirmed:true,clinicallyValidated:false,validatedImport:'BLOCKED_SOURCE_BYTE_INTEGRITY'};
 }
}
