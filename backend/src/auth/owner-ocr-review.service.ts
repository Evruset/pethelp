import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { PoolClient } from 'pg';
import { config } from '../config';
import { DatabaseService } from '../database/database.service';
import { JwtPayload, Role } from './auth.types';

type Action = 'START' | 'CORRECT' | 'CONFIRM' | 'REJECT';
type Context = { candidate_id: string; job_id: string; result_id: string; document_id: string; owner_id: string; pet_id: string; original_text: string; original_text_identity: string; source_identity: string; result_identity: string };
type Revision = { candidate_id: string; revision: number; expected_revision: number; action: Action; review_state: string; text_version: number; corrected_text: string; text_identity: string; actor_id: string; created_at: Date; payload_identity: string };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OwnerOcrReviewService {
  constructor(private readonly database: DatabaseService) {}
  private owner(owner: JwtPayload): void {
    if (!owner.roles.includes(Role.OWNER)) throw new ForbiddenException({code:'ROLE_FORBIDDEN',message:'Owner role required.'});
  }
  private missing(): never { throw new NotFoundException({code:'OWNER_OCR_REVIEW_NOT_FOUND',message:'OCR review was not found.'}); }
  private conflict(): never { throw new ConflictException({code:'OCR_REVIEW_CONFLICT',message:'OCR review revision or command conflicts.'}); }

  private async context(client: PoolClient, owner: JwtPayload, petId: string, documentId: string, candidateId: string, mutate: boolean): Promise<Context> {
    const job=(await client.query(`SELECT id,state FROM pet_schema.ocr_jobs WHERE document_id=$1 AND owner_id=$2 AND pet_id=$3 FOR SHARE`,[documentId,owner.sub,petId])).rows[0];
    if (!job) this.missing();
    const pet=await client.query(`SELECT id FROM pet_schema.pets WHERE id=$1 AND owner_id=$2 AND archived_at IS NULL FOR SHARE`,[petId,owner.sub]);
    const doc=await client.query(`SELECT id FROM pet_schema.pet_documents WHERE id=$1 AND owner_id=$2 AND pet_id=$3 AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') FOR SHARE`,[documentId,owner.sub,petId]);
    if (!pet.rowCount || !doc.rowCount) this.missing();
    const candidate=(await client.query<Context>(`SELECT c.id candidate_id,c.job_id,c.result_id,r.document_id,r.owner_id,r.pet_id,
      c.extracted_text original_text,encode(digest(c.extracted_text,'sha256'),'hex') original_text_identity,r.source_identity,r.result_identity
      FROM pet_schema.ocr_candidates c JOIN pet_schema.ocr_results r ON r.id=c.result_id AND r.job_id=c.job_id
      WHERE c.id=$1 AND c.job_id=$2 AND r.document_id=$3 AND r.owner_id=$4 AND r.pet_id=$5
      FOR ${mutate?'UPDATE':'SHARE'} OF c`,[candidateId,job.id,documentId,owner.sub,petId])).rows[0];
    if (!candidate) this.missing();
    if (job.state!=='SUCCEEDED') this.conflict();
    return candidate;
  }
  private async head(client: PoolClient, candidateId: string): Promise<Revision | undefined> {
    return (await client.query<Revision>('SELECT * FROM pet_schema.ocr_review_revisions WHERE candidate_id=$1 ORDER BY revision DESC LIMIT 1',[candidateId])).rows[0];
  }
  private revision(row: Revision) {
    return {revision:row.revision,expectedRevision:row.expected_revision,action:row.action,reviewState:row.review_state,textVersion:row.text_version,text:row.corrected_text,textIdentity:row.text_identity,actorId:row.actor_id,createdAt:row.created_at};
  }
  private presentation(context: Context, head?: Revision) {
    return {candidateId:context.candidate_id,jobId:context.job_id,resultId:context.result_id,documentId:context.document_id,petId:context.pet_id,
      schemaVersion:1,kind:'EXTRACTED_TEXT',reviewState:head?.review_state??'PENDING_OWNER_REVIEW',revision:head?.revision??0,
      textVersion:head?.text_version??0,text:head?.corrected_text??context.original_text,textIdentity:head?.text_identity??context.original_text_identity,
      originalText:context.original_text,originalTextIdentity:context.original_text_identity,sourceIdentity:context.source_identity,resultIdentity:context.result_identity,
      authority:'OWNER_DECISION_ONLY',sourceByteIntegrity:'DEFERRED_BLOCKING_VALIDATED_IMPORT',decision:head?this.revision(head):null};
  }

  async read(owner: JwtPayload, petId: string, documentId: string, candidateId: string, limit=10, offset=0) {
    this.owner(owner);
    if (!Number.isInteger(limit)||limit<1||limit>20||!Number.isInteger(offset)||offset<0||offset>1000000) throw new BadRequestException({code:'INVALID_REQUEST',message:'Invalid review page.'});
    return this.database.withTransaction(async client=>{
      const context=await this.context(client,owner,petId,documentId,candidateId,false),head=await this.head(client,candidateId);
      const history=(await client.query<Revision>('SELECT * FROM pet_schema.ocr_review_revisions WHERE candidate_id=$1 ORDER BY revision LIMIT $2 OFFSET $3',[candidateId,limit,offset])).rows;
      const total=head?.revision??0;
      return {...this.presentation(context,head),history:history.map(row=>this.revision(row)),page:{limit,offset,total,nextOffset:offset+history.length<total?offset+history.length:null}};
    });
  }

  async mutate(owner: JwtPayload, petId: string, documentId: string, candidateId: string, action: Action, body: unknown, ifMatch?: string, key?: string) {
    this.owner(owner);
    if (!['START','CORRECT','CONFIRM','REJECT'].includes(action) || !ifMatch || !/^"(0|[1-9][0-9]{0,9})"$/.test(ifMatch) || !key || !uuid.test(key)) throw new BadRequestException({code:'INVALID_REQUEST',message:'Strong numeric If-Match and UUID Idempotency-Key required.'});
    const expected=Number(ifMatch.slice(1,-1));
    if (!Number.isSafeInteger(expected)||expected>2147483646) throw new BadRequestException({code:'INVALID_REQUEST',message:'Invalid revision.'});
    const value=body===undefined?{}:body;
    if (value===null||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>action==='CORRECT'?k!=='text':true)) throw new BadRequestException({code:'INVALID_REQUEST',message:'Unsupported review fields.'});
    const text=(value as Record<string,unknown>).text;
    if (action==='CORRECT' && (typeof text!=='string'||!text.trim()||text.includes(String.fromCharCode(0))||Buffer.byteLength(text)>32768||Buffer.from(text).toString('utf8')!==text)) throw new BadRequestException({code:'INVALID_REQUEST',message:'Corrected text must be nonempty valid UTF-8 within32768bytes.'});
    const signature=createHmac('sha256',config.ownerPetIdempotencyHmacKey).update(JSON.stringify(['ocr-review-v1',owner.sub,petId,documentId,candidateId,action,expected,action==='CORRECT'?text:null])).digest('hex');
    try {
      return await this.database.withTransaction(async client=>{
        const context=await this.context(client,owner,petId,documentId,candidateId,true);
        const replay=(await client.query<Revision>('SELECT * FROM pet_schema.ocr_review_revisions WHERE owner_id=$1 AND idempotency_key=$2',[owner.sub,key])).rows[0];
        if (replay) {
          if (replay.candidate_id!==candidateId||replay.payload_identity!==signature) this.conflict();
          return this.presentation(context,replay);
        }
        const head=await this.head(client,candidateId),version=head?.revision??0,state=head?.review_state??'PENDING_OWNER_REVIEW';
        if (version!==expected||['CONFIRMED','REJECTED'].includes(state)||(action==='START'&&state!=='PENDING_OWNER_REVIEW')) this.conflict();
        const next=version+1,currentText=action==='CORRECT'?text as string:head?.corrected_text??context.original_text;
        const inserted=(await client.query<Revision>(`INSERT INTO pet_schema.ocr_review_revisions(candidate_id,revision,expected_revision,job_id,result_id,document_id,owner_id,pet_id,actor_id,action,review_state,text_version,corrected_text,original_text_identity,text_identity,source_identity,result_identity,idempotency_key,payload_identity)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$7,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [candidateId,next,expected,context.job_id,context.result_id,documentId,owner.sub,petId,action,action==='CONFIRM'?'CONFIRMED':action==='REJECT'?'REJECTED':'IN_REVIEW',action==='CORRECT'?next:head?.text_version??0,currentText,context.original_text_identity,digest(currentText),context.source_identity,context.result_identity,key,signature])).rows[0];
        return this.presentation(context,inserted);
      });
    } catch(error) {
      if (['40001','23505'].includes((error as {code?:string})?.code??'')) this.conflict();
      throw error;
    }
  }
}
