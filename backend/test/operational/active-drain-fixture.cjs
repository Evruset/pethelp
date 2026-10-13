/* Synthetic fixture through accepted application services; not a test rerun. */
require('reflect-metadata');
const {randomUUID}=require('node:crypto');
if(process.env.NODE_ENV!=='test'||process.env.W4B03A04_ACCEPTANCE!=='true'||!(()=>{try{const u=new URL(process.env.DATABASE_URL);return u.hostname==='postgres'&&/^\/vethelp_w4b03a04_[a-z]+$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}})())throw new Error('EXCLUSIVE_FIXTURE_REQUIRED');
const {NestFactory}=require('@nestjs/core');
const {NestRoot}=require('/workspace/backend/dist/src/nest-root-full.js');
const {DatabaseService}=require('/workspace/backend/dist/src/database/database.service.js');
const {OwnerPetService}=require('/workspace/backend/dist/src/auth/owner-pet.service.js');
const {OwnerOcrService}=require('/workspace/backend/dist/src/auth/owner-ocr.service.js');
const {OwnerOcrReviewService}=require('/workspace/backend/dist/src/auth/owner-ocr-review.service.js');
(async()=>{const app=await NestFactory.create(NestRoot,{logger:false});await app.init();try{
 const db=app.get(DatabaseService);
 if(process.env.DRAIN_FIXTURE_ACTION==='review'){
  const row=(await db.query('SELECT c.id candidate,j.document_id,j.owner_id,j.pet_id FROM pet_schema.ocr_candidates c JOIN pet_schema.ocr_jobs j ON j.id=c.job_id WHERE j.id=$1',[process.env.DRAIN_FIXTURE_JOB_ID])).rows[0];if(!row)throw Error('CANDIDATE_REQUIRED');
  const owner={sub:row.owner_id,roles:['OWNER']},reviews=app.get(OwnerOcrReviewService);
  await reviews.mutate(owner,row.pet_id,row.document_id,row.candidate,'CORRECT',{text:'SYNTHETIC_CONFIRMED_DRAIN_TEXT'},'"0"',randomUUID());await reviews.mutate(owner,row.pet_id,row.document_id,row.candidate,'CONFIRM',{},'"1"',randomUUID());console.log(JSON.stringify({reviewRevisions:2}));return;
 }
 const owner={sub:randomUUID(),roles:['OWNER']},pet=randomUUID();await db.query('INSERT INTO identity_schema.users(id) VALUES($1)',[owner.sub]);await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species,medical_history_ocr) VALUES($1,$2,'Drain synthetic fixture','DOG','{"legacy":"PRESERVE"}')`,[pet,owner.sub]);
 const buffer=Buffer.from('SYNTHETIC_ACTIVE_DRAIN_ORIGINAL_BYTES');const doc=await app.get(OwnerPetService).uploadDocumentFile(owner,pet,{buffer,size:buffer.length,mimetype:'application/pdf',originalname:'synthetic.pdf'},'HISTORY');await app.get(OwnerOcrService).enqueue(owner,pet,doc.documentId);console.log(JSON.stringify({sourceVersions:1,queuedBoundJobs:1}));
 }finally{await app.close();}})().catch(()=>{console.error('OWNED_FIXTURE_FAILED');process.exitCode=1;});
