import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { JwtPayload, Role } from '../src/auth/auth.types';
import { OwnerOcrService } from '../src/auth/owner-ocr.service';
import { OcrDocumentWorker } from '../src/auth/ocr-document.worker';
import { OcrProvider } from '../src/auth/ocr-provider';
import { OwnerPetService } from '../src/auth/owner-pet.service';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(90000);
describe('Owner OCR foundation (real isolated PostgreSQL/Nest)', () => {
  let app: INestApplication, db: DatabaseService, jobs: OwnerOcrService, jwt: JwtService;
  const ownerId=randomUUID(), foreignOwner=randomUUID(), pet=randomUUID(), otherPet=randomUUID();
  const owner={sub:ownerId,roles:[Role.OWNER]};
  const raw={text:'LEGACY_PRIVATE_UNVERIFIED'};
  const path=(doc:string,p=pet)=>`/v1/owner/pets/${p}/documents/${doc}/ocr`;
  const token=(sub=ownerId,roles=[Role.OWNER])=>jwt.signAsync({sub,roles},{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
  const result={text:'Unconfirmed source text',provider:'SIMULATED_OCR'};
  async function document(type='HISTORY',p=pet,o=ownerId) {
    const id=randomUUID();
    await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status,ocr_result,storage_key,file_size_bytes)
      VALUES($1,$2,$3,'private-storage-marker',$4,'PROCESSED',$5,'private-storage-key',99)`,[id,p,o,type,JSON.stringify(raw)]);
    return id;
  }
  async function queued() { const doc=await document(); const job=await jobs.enqueue(owner,pet,doc); return {doc,job}; }
  async function ready(id:string) {await db.query(`UPDATE pet_schema.ocr_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE id=$1`,[id]);}
  beforeAll(async()=>{
    if(process.env.W4B_ACCEPTANCE!=='true'||new URL(config.databaseUrl).hostname!=='postgres'||!new URL(config.databaseUrl).pathname.startsWith('/vethelp_w4b_'))throw new Error('Requires test-owned Docker DB');
    app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();db=app.get(DatabaseService);jobs=app.get(OwnerOcrService);jwt=app.get(JwtService);
    await db.query(`INSERT INTO identity_schema.users(id) VALUES($1),($2)`,[ownerId,foreignOwner]);
    await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species,medical_history_ocr) VALUES($1,$2,'OCR','DOG',$3),($4,$5,'Foreign','CAT',NULL)`,[pet,ownerId,JSON.stringify(raw),otherPet,foreignOwner]);
  });
  afterEach(async()=>{
    await db.query(`UPDATE pet_schema.ocr_attempts SET status='FAILED',finished_at=clock_timestamp(),error_code='PROVIDER_FAILED' WHERE status='RUNNING'`);
    await db.query(`UPDATE pet_schema.ocr_jobs SET state='FAILED',claim_token=NULL,lease_until=NULL,error_code='PROVIDER_FAILED' WHERE state IN('QUEUED','RUNNING')`);
  });
  afterAll(async()=>{await app?.close();});

  it('explicit enqueue works with document PROCESSED and concurrent replay creates one durable job',async()=>{
    const doc=await document();const before=(await db.query(`SELECT row_to_json(d) row FROM pet_schema.pet_documents d WHERE id=$1`,[doc])).rows[0];
    const rows=await Promise.all(Array.from({length:8},()=>jobs.enqueue(owner,pet,doc)));
    expect(new Set(rows.map(r=>r.jobId)).size).toBe(1);expect(rows[0]).toMatchObject({state:'QUEUED',authority:'UNCONFIRMED',attemptCount:0});
    expect((await db.query(`SELECT row_to_json(d) row FROM pet_schema.pet_documents d WHERE id=$1`,[doc])).rows[0]).toEqual(before);
  });
  it.each(['enqueue','read','retry'] as const)('exact Owner/Pet/Document scope denies forged/missing/foreign references for %s',async method=>{
    const {doc}=await queued();const foreign=await document('HISTORY',otherPet,foreignOwner);
    for(const [actor,p,d] of [[{sub:foreignOwner,roles:[Role.OWNER]},pet,doc],[owner,pet,foreign],[owner,otherPet,doc],[owner,pet,randomUUID()]] as [JwtPayload,string,string][])await expect(jobs[method](actor,p,d)).rejects.toMatchObject({status:404});
    await expect(jobs[method]({sub:ownerId,roles:[Role.CLINIC_ADMIN]},pet,doc)).rejects.toMatchObject({status:403});
  });
  it('real HTTP rejects unauthenticated/non-Owner/malformed scopes and applies no-store',async()=>{
    const doc=await document();expect((await request(app.getHttpServer()).post(path(doc))).status).toBe(401);
    for(const roles of [[Role.CLINIC_ADMIN],[Role.CLINIC_RECEPTIONIST],[Role.CLINIC_VETERINARIAN]])expect((await request(app.getHttpServer()).post(path(doc)).set('Authorization',`Bearer ${await token(ownerId,roles)}`)).status).toBe(403);
    expect((await request(app.getHttpServer()).post(path('forged')).set('Authorization',`Bearer ${await token()}`)).status).toBe(400);
    expect((await request(app.getHttpServer()).post(path(doc)).set('Authorization',`Bearer ${await token()}`).send({ownerId:foreignOwner,petId:otherPet,documentId:randomUUID()})).status).toBe(400);
    const accepted=await request(app.getHttpServer()).post(path(doc)).set('Authorization',`Bearer ${await token()}`).send({});
    expect(accepted.status).toBe(201);expect(accepted.body).toMatchObject({documentId:doc,petId:pet});expect(accepted.headers['cache-control']).toBe('no-store');
    const denied=await request(app.getHttpServer()).get(path(doc)).set('Authorization',`Bearer ${await token(foreignOwner)}`);expect(denied.status).toBe(404);expect(JSON.stringify(denied.body)).not.toMatch(/private|LEGACY|Unconfirmed|storage/i);
  });
  it('parallel workers claim once and persist immutable text-only v1 provenance atomically without Pet writes',async()=>{
    const {doc,job}=await queued();const before=(await db.query(`SELECT row_to_json(p) row FROM pet_schema.pets p WHERE id=$1`,[pet])).rows[0];
    const claimed=(await Promise.all(Array.from({length:8},()=>jobs.claim()))).filter(c=>c!==null);expect(claimed).toHaveLength(1);
    expect(await jobs.finish(claimed[0]!,{...result,providerVersion:'v1'})).toBe(true);expect(await jobs.finish(claimed[0]!,result)).toBe(false);
    const read=await jobs.read(owner,pet,doc);expect(read.state).toBe('SUCCEEDED');expect(read.result).toMatchObject({authority:'UNCONFIRMED',provider:'SIMULATED_OCR',providerVersion:'v1',candidate:{schemaVersion:1,kind:'EXTRACTED_TEXT',reviewState:'PENDING_OWNER_REVIEW',text:result.text}});
    expect(read.result!.sourceIdentity).toMatch(/^[0-9a-f]{64}$/);expect(read.result!.resultIdentity).toMatch(/^[0-9a-f]{64}$/);expect(read.result!.startedAt).toBeInstanceOf(Date);expect(read.result!.finishedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(read)).not.toMatch(/private-storage|storage_key|claim_token|lease_until|diagnosis|drug|measurement/);
    expect((await db.query(`SELECT row_to_json(p) row FROM pet_schema.pets p WHERE id=$1`,[pet])).rows[0]).toEqual(before);
    expect((await db.query('SELECT ocr_result FROM pet_schema.pet_documents WHERE id=$1',[doc])).rows[0].ocr_result).toEqual(raw);
    expect((await db.query('SELECT count(*)::int n FROM pet_schema.ocr_results WHERE job_id=$1',[job.jobId])).rows[0].n).toBe(1);
    for(const [table,column] of [['ocr_jobs','source_identity'],['ocr_results','authority'],['ocr_candidates','review_state']])await expect(db.query(`UPDATE pet_schema.${table} SET ${column}='changed' WHERE ${table==='ocr_jobs'?'id':'job_id'}=$1`,[job.jobId])).rejects.toBeDefined();
  });
  it('nullable provider provenance remains unavailable rather than invented',async()=>{
    const {doc}=await queued();expect(await jobs.finish((await jobs.claim())!,{text:'Text only'})).toBe(true);
    const r=(await jobs.read(owner,pet,doc)).result!;expect(r.provider).toBeNull();expect(r.providerVersion).toBeNull();expect(r.extraction).toEqual({text:'Text only'});
  });
  it('lease recovery fences old execution, records abandonment and accepts only replacement result',async()=>{
    const {doc,job}=await queued();const first=(await jobs.claim())!;await db.query(`UPDATE pet_schema.ocr_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1`,[job.jobId]);
    expect(await jobs.finish(first,result)).toBe(false);const second=(await jobs.claim())!;expect(second.claim_token).not.toBe(first.claim_token);
    expect(await jobs.finish(first,{text:'STALE'})).toBe(false);expect(await jobs.finish(second,result)).toBe(true);
    expect((await jobs.read(owner,pet,doc)).attempts.map(a=>a.status)).toEqual(['ABANDONED','SUCCEEDED']);
  });
  it('three expired claims exhaust recovery budget without a fourth execution',async()=>{
    const {doc,job}=await queued();for(let i=0;i<3;i++){expect(await jobs.claim()).not.toBeNull();await db.query(`UPDATE pet_schema.ocr_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1`,[job.jobId]);}
    expect(await jobs.claim()).toBeNull();const read=await jobs.read(owner,pet,doc);expect(read).toMatchObject({state:'FAILED',attemptCount:3,errorCode:'LEASE_EXPIRED'});expect(read.attempts.map(a=>a.status)).toEqual(['ABANDONED','ABANDONED','ABANDONED']);await expect(jobs.retry(owner,pet,doc)).rejects.toMatchObject({status:409});
  });
  it('provider failure persists bounded backoff/history and exhausts lifetime budget',async()=>{
    const {doc,job}=await queued();for(let i=1;i<=3;i++){const c=(await jobs.claim())!;expect(c.attempt_count).toBe(i);await jobs.finish(c,undefined,'PROVIDER_FAILED');if(i<3){expect(await jobs.claim()).toBeNull();await ready(job.jobId);}}
    const read=await jobs.read(owner,pet,doc);expect(read).toMatchObject({state:'FAILED',attemptCount:3,errorCode:'PROVIDER_FAILED',result:null});expect(read.attempts).toHaveLength(3);await expect(jobs.retry(owner,pet,doc)).rejects.toMatchObject({status:409});
  });
  it.each([null,{text:''},{text:'x'.repeat(32769)},{text:'ok',diagnosis:'invented'},{text:'ok',provider:'secret https://credential'},{text:'\u0000'}])('invalid or oversized result is bounded and not persisted (%j)',async value=>{
    const {doc}=await queued();await jobs.finish((await jobs.claim())!,value as never);expect(await jobs.read(owner,pet,doc)).toMatchObject({state:'FAILED',errorCode:'INVALID_RESULT',result:null});
  });
  it('explicit Owner retry does not reset attempts; simultaneous retries permit one transition',async()=>{
    const {doc}=await queued();await jobs.finish((await jobs.claim())!,{text:''});
    const rs=await Promise.allSettled([jobs.retry(owner,pet,doc),jobs.retry(owner,pet,doc)]);expect(rs.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect((await jobs.read(owner,pet,doc)).attemptCount).toBe(1);await jobs.finish((await jobs.claim())!,result);await expect(jobs.retry(owner,pet,doc)).rejects.toMatchObject({status:409});
  });
  it('candidate persistence failure rolls back extraction, attempt and job success as one transaction',async()=>{
    const {doc,job}=await queued(),claim=(await jobs.claim())!;
    await db.query(`CREATE FUNCTION pet_schema.test_fail_ocr_candidate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test candidate failure'; END $$;CREATE TRIGGER test_fail_ocr_candidate BEFORE INSERT ON pet_schema.ocr_candidates FOR EACH ROW EXECUTE FUNCTION pet_schema.test_fail_ocr_candidate();`);
    try {await expect(jobs.finish(claim,result)).rejects.toThrow('test candidate failure');expect((await jobs.read(owner,pet,doc)).state).toBe('RUNNING');expect((await db.query('SELECT * FROM pet_schema.ocr_results WHERE job_id=$1',[job.jobId])).rows).toHaveLength(0);}
    finally {await db.query('DROP TRIGGER test_fail_ocr_candidate ON pet_schema.ocr_candidates;DROP FUNCTION pet_schema.test_fail_ocr_candidate();');}
    expect(await jobs.finish(claim,result)).toBe(true);
  });
  it('provider runs outside any transaction and unsafe provider errors are never persisted',async()=>{
    const {doc}=await queued();const provider=new OcrProvider();const extract=jest.spyOn(provider,'extract').mockImplementation(async()=>{
      expect((await db.query(`SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'`)).rows[0].n).toBe(0);
      expect((await db.query(`SELECT state FROM pet_schema.ocr_jobs WHERE document_id=$1`,[doc])).rows[0].state).toBe('RUNNING');throw new Error('MEDICAL_SECRET credential/path');
    });
    const prior=process.env.WORKERS_ENABLED;process.env.WORKERS_ENABLED='true';try{await new OcrDocumentWorker(jobs,provider).processDocuments();}finally{process.env.WORKERS_ENABLED=prior;extract.mockRestore();}
    const read=await jobs.read(owner,pet,doc);expect(read.errorCode).toBe('PROVIDER_FAILED');expect(JSON.stringify(read)).not.toMatch(/MEDICAL_SECRET|credential/);
  });
  it.each(['deleted','archived','ownerChanged','sourceChanged'])('concurrent source %s prevents persistence after provider execution',async mode=>{
    const {doc}=await queued(),claim=(await jobs.claim())!;
    if(mode==='deleted')await db.query('UPDATE pet_schema.pet_documents SET deleted_at=clock_timestamp() WHERE id=$1',[doc]);
    if(mode==='archived')await db.query('UPDATE pet_schema.pets SET archived_at=clock_timestamp() WHERE id=$1',[pet]);
    if(mode==='ownerChanged')await db.query('UPDATE pet_schema.pets SET owner_id=$2 WHERE id=$1',[pet,foreignOwner]);
    if(mode==='sourceChanged')await db.query("UPDATE pet_schema.pet_documents SET storage_key='changed' WHERE id=$1",[doc]);
    try {expect(await jobs.finish(claim,result)).toBe(true);expect((await db.query('SELECT state,error_code FROM pet_schema.ocr_jobs WHERE id=$1',[claim.id])).rows[0]).toEqual({state:'FAILED',error_code:mode==='sourceChanged'?'SOURCE_CHANGED':'SOURCE_UNAVAILABLE'});expect((await db.query('SELECT * FROM pet_schema.ocr_results WHERE job_id=$1',[claim.id])).rows).toHaveLength(0);}
    finally {if(mode==='archived')await db.query('UPDATE pet_schema.pets SET archived_at=NULL WHERE id=$1',[pet]);if(mode==='ownerChanged')await db.query('UPDATE pet_schema.pets SET owner_id=$2 WHERE id=$1',[pet,ownerId]);}
  });
  it('queued deleted source never invokes provider or creates a result',async()=>{
    const {doc,job}=await queued();await db.query('UPDATE pet_schema.pet_documents SET deleted_at=clock_timestamp() WHERE id=$1',[doc]);expect(await jobs.claim()).toBeNull();expect((await db.query('SELECT state,error_code FROM pet_schema.ocr_jobs WHERE id=$1',[job.jobId])).rows[0]).toEqual({state:'FAILED',error_code:'SOURCE_UNAVAILABLE'});
  });
  it('legacy values remain labelled unverified and absent from Pet and medical projections',async()=>{
    const doc=await document();const legacy=(await db.query(`SELECT source_kind,authority,raw_result FROM pet_schema.ocr_legacy_unverified WHERE pet_id=$1 AND (document_id=$2 OR document_id IS NULL) ORDER BY source_kind`,[pet,doc])).rows;
    expect(legacy).toEqual([{source_kind:'DOCUMENT',authority:'LEGACY_UNVERIFIED',raw_result:raw},{source_kind:'PET_HISTORY',authority:'LEGACY_UNVERIFIED',raw_result:raw}]);
    const profile=await app.get(OwnerPetService).readMvp(owner,pet);expect(JSON.stringify(profile)).not.toMatch(/LEGACY_PRIVATE|medicalHistoryOcr|ocr_result/);
    const worker=readFileSync('src/auth/ocr-document.worker.ts','utf8'),service=readFileSync('src/auth/owner-ocr.service.ts','utf8');expect(worker+service).not.toMatch(/UPDATE\s+pet_schema\.pets|SET\s+medical_history_ocr|SET\s+ocr_result/i);
  });
});
