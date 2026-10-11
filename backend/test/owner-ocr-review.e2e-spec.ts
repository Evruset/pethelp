import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { Role, JwtPayload } from '../src/auth/auth.types';
import { OwnerOcrService } from '../src/auth/owner-ocr.service';
import { OwnerOcrReviewService } from '../src/auth/owner-ocr-review.service';
import { OwnerPetService } from '../src/auth/owner-pet.service';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { DatabaseService } from '../src/database/database.service';
import { config } from '../src/config';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(90000);
describe('Owner OCR review authority (real PostgreSQL/Nest)',()=>{
  let app:INestApplication,db:DatabaseService,jobs:OwnerOcrService,reviews:OwnerOcrReviewService,jwt:JwtService;
  const ownerId=randomUUID(),foreignId=randomUUID(),pet=randomUUID(),foreignPet=randomUUID();
  const owner:JwtPayload={sub:ownerId,roles:[Role.OWNER]},foreign:JwtPayload={sub:foreignId,roles:[Role.OWNER]};
  const legacy={text:'LEGACY_UNVERIFIED_PRIVATE'},original='ORIGINAL_PRIVATE_EXTRACTION';
  const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
  const token=(sub=ownerId,roles=[Role.OWNER])=>jwt.signAsync({sub,roles},{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
  type Fixture={doc:string,candidate:string,job:string,result:string};
  const path=(f:Fixture,p=pet)=>`/v1/owner/pets/${p}/documents/${f.doc}/ocr/candidates/${f.candidate}/review`;
  async function document(p:string=pet,o:string=ownerId){const id=randomUUID();await db.query(`INSERT INTO pet_schema.pet_documents(id,owner_id,pet_id,file_url,doc_type,status,ocr_result,storage_key) VALUES($1,$2,$3,'PRIVATE_STORAGE_URL','HISTORY','PROCESSED',$4,'PRIVATE_STORAGE_KEY')`,[id,o,p,JSON.stringify(legacy)]);return id;}
  async function fixture(p=pet,actor=owner):Promise<Fixture>{const doc=await document(p,actor.sub),job=await jobs.enqueue(actor,p,doc),claim=await jobs.claim();expect(claim?.document_id).toBe(doc);expect(await jobs.finish(claim!,{text:original,provider:'SIMULATED_OCR'})).toBe(true);const raw=await jobs.read(actor,p,doc);return{doc,candidate:raw.result!.candidate.candidateId,job:job.jobId,result:raw.result!.resultId};}
  const mutate=(f:Fixture,action:'START'|'CORRECT'|'CONFIRM'|'REJECT',revision=0,body:unknown={},key=randomUUID())=>reviews.mutate(owner,pet,f.doc,f.candidate,action,body,`"${revision}"`,key);
  const read=(f:Fixture)=>reviews.read(owner,pet,f.doc,f.candidate);
  const snapshot=async(f:Fixture)=>(await db.query(`SELECT row_to_json(p) pet,row_to_json(d) document,row_to_json(j) job,row_to_json(r) raw,row_to_json(c) candidate
    FROM pet_schema.pets p JOIN pet_schema.pet_documents d ON d.pet_id=p.id JOIN pet_schema.ocr_jobs j ON j.document_id=d.id JOIN pet_schema.ocr_results r ON r.job_id=j.id JOIN pet_schema.ocr_candidates c ON c.result_id=r.id WHERE c.id=$1`,[f.candidate])).rows[0];
  beforeAll(async()=>{
    if(process.env.W4B02_ACCEPTANCE!=='true'||new URL(config.databaseUrl).hostname!=='postgres'||!new URL(config.databaseUrl).pathname.startsWith('/vethelp_w4b02_'))throw new Error('Exclusive test-owned Docker required');
    app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();db=app.get(DatabaseService);jobs=app.get(OwnerOcrService);reviews=app.get(OwnerOcrReviewService);jwt=app.get(JwtService);
    await db.query('INSERT INTO identity_schema.users(id) VALUES($1),($2)',[ownerId,foreignId]);
    await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species,medical_history_ocr) VALUES($1,$2,'Review','DOG',$3),($4,$5,'Foreign','CAT',NULL)`,[pet,ownerId,JSON.stringify(legacy),foreignPet,foreignId]);
  });
  afterEach(async()=>{await db.query(`UPDATE pet_schema.ocr_attempts SET status='FAILED',finished_at=clock_timestamp(),error_code='PROVIDER_FAILED' WHERE status='RUNNING'`);await db.query(`UPDATE pet_schema.ocr_jobs SET state='FAILED',claim_token=NULL,lease_until=NULL,error_code='PROVIDER_FAILED' WHERE state IN('QUEUED','RUNNING')`);});
  afterAll(async()=>{await app?.close();});

  it.each(['','   '])('historically permitted blank raw text %j can be started and rejected unchanged',async raw=>{
    const doc=await document(),job=randomUUID(),attempt=randomUUID(),result=randomUUID(),candidate=randomUUID(),source=digest('metadata'),extraction={text:raw};
    await db.query(`INSERT INTO pet_schema.ocr_jobs(id,document_id,owner_id,pet_id,source_identity,source_snapshot,state,attempt_count) VALUES($1,$2,$3,$4,$5,'{}','SUCCEEDED',1)`,[job,doc,ownerId,pet,source]);
    await db.query(`INSERT INTO pet_schema.ocr_attempts(id,job_id,attempt_number,status,finished_at) VALUES($1,$2,1,'SUCCEEDED',clock_timestamp())`,[attempt,job]);
    await db.query(`INSERT INTO pet_schema.ocr_results(id,job_id,attempt_id,document_id,owner_id,pet_id,source_identity,result_identity,extraction) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[result,job,attempt,doc,ownerId,pet,source,digest(JSON.stringify(extraction)),JSON.stringify(extraction)]);
    await db.query(`INSERT INTO pet_schema.ocr_candidates(id,result_id,job_id,extracted_text) VALUES($1,$2,$3,$4)`,[candidate,result,job,raw]);
    const f={doc,job,result,candidate};expect(await mutate(f,'START')).toMatchObject({revision:1,text:raw,textVersion:0});expect(await mutate(f,'REJECT',1)).toMatchObject({revision:2,text:raw,textVersion:0,reviewState:'REJECTED'});expect((await read(f)).originalText).toBe(raw);
  });
  it('GET is side-effect free virtual revision0/PENDING with original text and no-store ETag',async()=>{
    const f=await fixture(),response=await request(app.getHttpServer()).get(path(f)).set('Authorization',`Bearer ${await token()}`);
    expect(response.status).toBe(200);expect(response.headers.etag).toBe('"0"');expect(response.headers['cache-control']).toBe('no-store');expect(response.body).toMatchObject({reviewState:'PENDING_OWNER_REVIEW',revision:0,textVersion:0,text:original,originalText:original,authority:'OWNER_DECISION_ONLY',sourceByteIntegrity:'DEFERRED_BLOCKING_VALIDATED_IMPORT',history:[],decision:null});expect((await db.query('SELECT * FROM pet_schema.ocr_review_revisions WHERE candidate_id=$1',[f.candidate])).rows).toHaveLength(0);expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_STORAGE|claim_token|lease_until|payload_identity|corrected_text|owner_id/);
  });
  it('start/correct/confirm records exact text revision and leaves raw/provenance/Pet/job untouched',async()=>{
    const f=await fixture(),before=await snapshot(f);expect(await mutate(f,'START')).toMatchObject({reviewState:'IN_REVIEW',revision:1,textVersion:0});
    expect(await mutate(f,'CORRECT',1,{text:'Owner corrected text'})).toMatchObject({revision:2,textVersion:2,text:'Owner corrected text'});
    expect(await mutate(f,'CONFIRM',2)).toMatchObject({revision:3,reviewState:'CONFIRMED',textVersion:2,originalText:original,text:'Owner corrected text',authority:'OWNER_DECISION_ONLY',decision:{expectedRevision:2,actorId:ownerId,action:'CONFIRM'}});
    const final=await read(f);expect(final.history.map(r=>[r.revision,r.action,r.textVersion])).toEqual([[1,'START',0],[2,'CORRECT',2],[3,'CONFIRM',2]]);expect(final.originalTextIdentity).toBe(digest(original));expect(final.textIdentity).toBe(digest('Owner corrected text'));
    const raw=await jobs.read(owner,pet,f.doc);expect(raw.state).toBe('SUCCEEDED');expect(raw.result).toMatchObject({authority:'UNCONFIRMED',extraction:{text:original},candidate:{text:original,reviewState:'CONFIRMED'}});expect(await snapshot(f)).toEqual(before);
  });
  it('multiple corrections retain every version and rejection is terminal',async()=>{
    const f=await fixture();await mutate(f,'CORRECT',0,{text:'first'});await mutate(f,'CORRECT',1,{text:'second'});await mutate(f,'REJECT',2);const final=await read(f);expect(final).toMatchObject({reviewState:'REJECTED',revision:3,textVersion:2,text:'second'});expect(final.history.map(r=>r.text)).toEqual(['first','second','second']);await expect(mutate(f,'CONFIRM',3)).rejects.toMatchObject({status:409});await expect(mutate(f,'CORRECT',3,{text:'third'})).rejects.toMatchObject({status:409});
  });
  it('explicit confirmation of original revision0 is non-authoritative and double confirmation conflicts',async()=>{
    const f=await fixture();expect(await mutate(f,'CONFIRM')).toMatchObject({revision:1,textVersion:0,reviewState:'CONFIRMED',text:original,authority:'OWNER_DECISION_ONLY'});await expect(mutate(f,'CONFIRM',1)).rejects.toMatchObject({status:409});await expect(mutate(f,'REJECT',1)).rejects.toMatchObject({status:409});
  });
  it('stale revision and repeated START cannot create a hidden version',async()=>{const f=await fixture();await mutate(f,'START');await expect(mutate(f,'START',1)).rejects.toMatchObject({status:409});await expect(mutate(f,'CONFIRM',0)).rejects.toMatchObject({status:409});expect((await read(f)).revision).toBe(1);});
  it.each(['CONFIRM','REJECT'] as const)('concurrent correction versus %s accepts exactly one revision',async action=>{
    const f=await fixture(),rs=await Promise.allSettled([mutate(f,'CORRECT',0,{text:'RACE_PRIVATE_CORRECTION'}),mutate(f,action)]);expect(rs.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(rs.filter(r=>r.status==='rejected')).toHaveLength(1);expect((rs.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.status).toBe(409);expect((await read(f)).history).toHaveLength(1);
  });
  it('simultaneous confirm/reject yields one terminal decision',async()=>{const f=await fixture();const rs=await Promise.allSettled([mutate(f,'CONFIRM'),mutate(f,'REJECT')]);expect(rs.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await read(f)).history).toHaveLength(1);});
  it('concurrent identical idempotency replay writes once and returns original response after newer decision',async()=>{
    const f=await fixture(),key=randomUUID(),rs=await Promise.all(Array.from({length:6},()=>mutate(f,'CORRECT',0,{text:'stable'},key)));for(const r of rs)expect(r).toEqual(rs[0]);await mutate(f,'CONFIRM',1);expect(await mutate(f,'CORRECT',0,{text:'stable'},key)).toEqual(rs[0]);expect((await read(f)).reviewState).toBe('CONFIRMED');expect((await read(f)).history).toHaveLength(2);
  });
  it('same idempotency key with changed text, action, revision or candidate conflicts',async()=>{
    const f=await fixture(),g=await fixture(),key=randomUUID();await mutate(f,'CORRECT',0,{text:'one'},key);
    for(const request of [()=>mutate(f,'CORRECT',0,{text:'two'},key),()=>mutate(f,'CONFIRM',0,{},key),()=>mutate(f,'CORRECT',1,{text:'one'},key),()=>mutate(g,'CORRECT',0,{text:'one'},key)])await expect(request()).rejects.toMatchObject({status:409});
  });
  it('same Owner idempotency key concurrently used on different candidates rolls back losing revision',async()=>{
    const f=await fixture(),g=await fixture(),key=randomUUID(),rs=await Promise.allSettled([mutate(f,'CONFIRM',0,{},key),mutate(g,'CONFIRM',0,{},key)]);expect(rs.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await read(f)).revision+(await read(g)).revision).toBe(1);
  });
  it.each([Role.CLINIC_ADMIN,Role.CLINIC_RECEPTIONIST,Role.CLINIC_VETERINARIAN,Role.PLATFORM_ADMIN,Role.SUPPORT_L2])('HTTP role %s cannot inspect/correct/decide even with matching sub',async role=>{
    const f=await fixture(),auth=await token(ownerId,[role]);for(const [method,url] of [['get',path(f)],['post',path(f)+'/corrections'],['post',path(f)+'/confirm'],['post',path(f)+'/reject']] as const){const r=await request(app.getHttpServer())[method](url).set('Authorization',`Bearer ${auth}`).set('If-Match','"0"').set('Idempotency-Key',randomUUID()).send({});expect(r.status).toBe(403);expect(JSON.stringify(r.body)).not.toContain(original);}
  });
  it('foreign Owner/Pet/document/candidate references fail404 before read or replay',async()=>{
    const f=await fixture(),g=await fixture(foreignPet,foreign),sameOwnerOther=await fixture(),key=randomUUID();await mutate(f,'CONFIRM',0,{},key);
    for(const [actor,p,d,c] of [[foreign,pet,f.doc,f.candidate],[owner,foreignPet,f.doc,f.candidate],[owner,pet,g.doc,g.candidate],[owner,pet,sameOwnerOther.doc,f.candidate],[owner,pet,f.doc,g.candidate],[owner,pet,f.doc,randomUUID()]] as [JwtPayload,string,string,string][]){await expect(reviews.read(actor,p,d,c)).rejects.toMatchObject({status:404});await expect(reviews.mutate(actor,p,d,c,'CONFIRM',{},'"0"',key)).rejects.toMatchObject({status:404});}
  });
  it.each(['deleted','archived','ownerChanged'])('current source %s denies read, new decision and idempotency replay',async mode=>{
    const f=await fixture(),key=randomUUID();await mutate(f,'START',0,{},key);
    if(mode==='deleted')await db.query('UPDATE pet_schema.pet_documents SET deleted_at=clock_timestamp() WHERE id=$1',[f.doc]);
    if(mode==='archived')await db.query('UPDATE pet_schema.pets SET archived_at=clock_timestamp() WHERE id=$1',[pet]);
    if(mode==='ownerChanged')await db.query('UPDATE pet_schema.pets SET owner_id=$2 WHERE id=$1',[pet,foreignId]);
    try{await expect(read(f)).rejects.toMatchObject({status:404});await expect(mutate(f,'CONFIRM',1)).rejects.toMatchObject({status:404});await expect(mutate(f,'START',0,{},key)).rejects.toMatchObject({status:404});}
    finally{if(mode==='archived')await db.query('UPDATE pet_schema.pets SET archived_at=NULL WHERE id=$1',[pet]);if(mode==='ownerChanged')await db.query('UPDATE pet_schema.pets SET owner_id=$2 WHERE id=$1',[pet,ownerId]);}
  });
  it('missing/queued/failed OCR cannot create a review',async()=>{
    const doc=await document(),candidate=randomUUID();await expect(reviews.read(owner,pet,doc,candidate)).rejects.toMatchObject({status:404});await jobs.enqueue(owner,pet,doc);await expect(reviews.mutate(owner,pet,doc,candidate,'CONFIRM',{},'"0"',randomUUID())).rejects.toMatchObject({status:404});await jobs.finish((await jobs.claim())!,{text:''});await expect(reviews.read(owner,pet,doc,candidate)).rejects.toMatchObject({status:404});
  });
  it.each(['missing','weak','unquoted','leadingZero','negative','overflow'])('invalid If-Match %s fails400',async mode=>{const f=await fixture(),match={missing:undefined,weak:'W/"0"',unquoted:'0',leadingZero:'"00"',negative:'"-1"',overflow:'"2147483647"'}[mode];await expect(reviews.mutate(owner,pet,f.doc,f.candidate,'CONFIRM',{},match,randomUUID())).rejects.toMatchObject({status:400});});
  it.each(['missing','forged'])('invalid idempotency header %s fails400',async mode=>{const f=await fixture();await expect(reviews.mutate(owner,pet,f.doc,f.candidate,'CONFIRM',{},'"0"',mode==='missing'?undefined:'forged')).rejects.toMatchObject({status:400});});
  it.each(['missingText','empty','whitespace','oversizedUtf8','nul','invalidUtf8','unknownField','array','null'])('invalid correction %s fails400 without persistence',async name=>{
    const f=await fixture();const bad:Record<string,unknown>={missingText:{},empty:{text:''},whitespace:{text:'  '},oversizedUtf8:{text:'я'.repeat(16385)},nul:{text:String.fromCharCode(0)},invalidUtf8:{text:String.fromCharCode(0xd800)},unknownField:{text:'x',ownerId:foreignId},array:[],null:null};await expect(mutate(f,'CORRECT',0,bad[name])).rejects.toMatchObject({status:400});expect((await read(f)).revision).toBe(0);
  });
  it('real HTTP exposes strong ETags, strict bodies,400/401/404/409 and bounded history pagination',async()=>{
    const f=await fixture(),auth=`Bearer ${await token()}`;expect((await request(app.getHttpServer()).get(path(f))).status).toBe(401);
    expect((await request(app.getHttpServer()).post(path(f)+'/confirm').set('Authorization',auth).set('If-Match','"0"').set('Idempotency-Key',randomUUID()).send({text:'forged'})).status).toBe(400);
    expect((await request(app.getHttpServer()).get(path({...f,candidate:'forged'})).set('Authorization',auth)).status).toBe(400);
    const corrected=await request(app.getHttpServer()).post(path(f)+'/corrections').set('Authorization',auth).set('If-Match','"0"').set('Idempotency-Key',randomUUID()).send({text:'HTTP_PRIVATE_CORRECTION'});expect(corrected.status).toBe(200);expect(corrected.headers.etag).toBe('"1"');expect(corrected.headers['cache-control']).toBe('no-store');
    const confirmed=await request(app.getHttpServer()).post(path(f)+'/confirm').set('Authorization',auth).set('If-Match','"1"').set('Idempotency-Key',randomUUID()).send({});expect(confirmed.status).toBe(200);expect(confirmed.headers.etag).toBe('"2"');
    expect((await request(app.getHttpServer()).post(path(f)+'/reject').set('Authorization',auth).set('If-Match','"1"').set('Idempotency-Key',randomUUID()).send({})).status).toBe(409);
    const page=await request(app.getHttpServer()).get(path(f)+'?limit=1&offset=0').set('Authorization',auth);expect(page.status).toBe(200);expect(page.body.page).toEqual({limit:1,offset:0,total:2,nextOffset:1});expect(page.body.history).toHaveLength(1);expect(page.headers.etag).toBe('"2"');
    expect((await request(app.getHttpServer()).get(path(f)+'?limit=21').set('Authorization',auth)).status).toBe(400);
    expect((await request(app.getHttpServer()).get(path(f)+'?offset=1e2').set('Authorization',auth)).status).toBe(400);
    expect(JSON.stringify((await db.query(`SELECT payload_json FROM audit_schema.audit_log WHERE actor_id=$1`,[ownerId])).rows)).not.toContain('HTTP_PRIVATE_CORRECTION');
  });
  it('DB rejects rewriting/deleting/truncating decisions and raw data',async()=>{
    const f=await fixture();await mutate(f,'CORRECT',0,{text:'Private correction'});const before=await snapshot(f),history=(await db.query('SELECT * FROM pet_schema.ocr_review_revisions WHERE candidate_id=$1',[f.candidate])).rows;
    for(const table of ['ocr_review_revisions','ocr_candidates','ocr_results']){await expect(db.query(`UPDATE pet_schema.${table} SET ${table==='ocr_review_revisions'?'corrected_text':table==='ocr_candidates'?'extracted_text':'authority'}='changed'`)).rejects.toBeDefined();await expect(db.query(`DELETE FROM pet_schema.${table}`)).rejects.toBeDefined();await expect(db.query(`TRUNCATE pet_schema.${table} CASCADE`)).rejects.toBeDefined();}
    expect(await snapshot(f)).toEqual(before);expect((await db.query('SELECT * FROM pet_schema.ocr_review_revisions WHERE candidate_id=$1',[f.candidate])).rows).toEqual(history);
  });
  it('DB integrity rejects forged actor/context/identity/version/state and decision text substitution',async()=>{
    const f=await fixture();await mutate(f,'START');const previous=(await db.query('SELECT * FROM pet_schema.ocr_review_revisions WHERE candidate_id=$1',[f.candidate])).rows[0];
    const valid={...previous,revision:2,expected_revision:1,action:'CONFIRM',review_state:'CONFIRMED',idempotency_key:randomUUID()};
    for(const altered of [{actor_id:foreignId},{pet_id:foreignPet},{result_id:randomUUID()},{original_text_identity:'0'.repeat(64)},{text_identity:'1'.repeat(64)},{source_identity:'2'.repeat(64)},{revision:3,expected_revision:2},{review_state:'IN_REVIEW'},{corrected_text:'FORGED_NEW_TEXT',text_identity:digest('FORGED_NEW_TEXT')},{text_version:1}])await expect(db.query('INSERT INTO pet_schema.ocr_review_revisions SELECT * FROM json_populate_record(NULL::pet_schema.ocr_review_revisions,$1::json)',[JSON.stringify({...valid,...altered,idempotency_key:randomUUID()})])).rejects.toBeDefined();expect((await read(f)).revision).toBe(1);
  });
  it('ledger insert failure leaves no revision or decision; retry reuses same idempotency key',async()=>{
    const f=await fixture(),key=randomUUID();await db.query(`CREATE FUNCTION pet_schema.test_fail_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test ledger failure'; END $$;CREATE TRIGGER test_fail_review BEFORE INSERT ON pet_schema.ocr_review_revisions FOR EACH ROW EXECUTE FUNCTION pet_schema.test_fail_review();`);
    try{await expect(mutate(f,'CONFIRM',0,{},key)).rejects.toThrow('test ledger failure');expect((await read(f)).revision).toBe(0);}finally{await db.query('DROP TRIGGER test_fail_review ON pet_schema.ocr_review_revisions;DROP FUNCTION pet_schema.test_fail_review();');}
    expect(await mutate(f,'CONFIRM',0,{},key)).toMatchObject({reviewState:'CONFIRMED',revision:1});
  });
  it('confirmation preserves legacy LEGACY_UNVERIFIED and never writes Pet or validated imports',async()=>{
    const f=await fixture();await mutate(f,'CONFIRM');expect((await db.query(`SELECT authority,raw_result FROM pet_schema.ocr_legacy_unverified WHERE pet_id=$1 AND (document_id=$2 OR document_id IS NULL)`,[pet,f.doc])).rows).toEqual([{authority:'LEGACY_UNVERIFIED',raw_result:legacy},{authority:'LEGACY_UNVERIFIED',raw_result:legacy}]);
    expect(JSON.stringify(await app.get(OwnerPetService).readMvp(owner,pet))).not.toMatch(/LEGACY_UNVERIFIED_PRIVATE|ORIGINAL_PRIVATE_EXTRACTION/);
    const service=readFileSync('src/auth/owner-ocr-review.service.ts','utf8'),migration=readFileSync('migrations/node-pg/1719750000000_owner_ocr_review_authority.js','utf8');expect(service+migration).not.toMatch(/UPDATE\s+pet_schema\.pets|SET\s+medical_history_ocr|CREATE TABLE[^;]*validated_import/i);
  });
});
