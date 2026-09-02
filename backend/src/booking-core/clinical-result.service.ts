import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

type ResultRow = { id:string;visit_id:string;owner_id:string;pet_id:string;clinic_id:string;location_id:string;status:'DRAFT'|'PUBLISHED';clinical_summary:string;version:number;created_at:Date;updated_at:Date;published_at:Date|null };
type AmendmentRow = { id:string;result_id:string;visit_id:string;owner_id:string;pet_id:string;clinic_id:string;location_id:string;amendment_content:string;created_at:Date;published_at:Date };

@Injectable()
export class ClinicalResultService {
  constructor(private readonly db:DatabaseService,private readonly access:ClinicEmployeeAccessService){}

  createDraft(visitId:string,summary:string,key:string,actor:JwtPayload,correlationId:string){this.content(summary);return this.db.withTransaction(async c=>{const v=await this.visit(c,visitId,actor);const inserted=await c.query<ResultRow>(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *`,[v.id,v.owner_id,v.pet_id,v.clinic_id,v.location_id,actor.sub,summary.trim(),key]);if(inserted.rows[0]){await this.evidence(c,'clinical.result.draft.created',inserted.rows[0].id,inserted.rows[0].version,actor.sub,correlationId);return this.view(inserted.rows[0]);}const existing=(await c.query<ResultRow&{idempotency_key:string}>('SELECT * FROM clinical_schema.visit_results WHERE visit_id=$1',[visitId])).rows[0];if(!existing)throw new ConflictException({code:'CLINICAL_RESULT_CREATE_CONFLICT'});if(existing.idempotency_key===key)return this.view(existing);throw new ConflictException({code:'CLINICAL_RESULT_ALREADY_EXISTS',currentResult:this.view(existing)});});}
  readCurrent(visitId:string,actor:JwtPayload){return this.db.withTransaction(async c=>{await this.visit(c,visitId,actor);const result=(await c.query<ResultRow>('SELECT * FROM clinical_schema.visit_results WHERE visit_id=$1',[visitId])).rows[0]??null;if(!result)return{visitId,result:null,amendments:[]};const amendments=result.status==='PUBLISHED'?(await c.query<AmendmentRow>(`SELECT id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,amendment_content,created_at,published_at FROM clinical_schema.visit_result_amendments WHERE result_id=$1 AND visit_id=$2 ORDER BY created_at ASC,id ASC`,[result.id,visitId])).rows:[];return{visitId,result:this.view(result),amendments:amendments.map(a=>({amendmentId:a.id,resultId:a.result_id,content:a.amendment_content,publishedAt:a.published_at.toISOString()}))};});}
  read(visitId:string,resultId:string,actor:JwtPayload){return this.db.withTransaction(async c=>{await this.visit(c,visitId,actor);return this.view(await this.result(c,visitId,resultId,false));});}
  updateDraft(visitId:string,resultId:string,summary:string,expected:number,actor:JwtPayload,correlationId:string){this.content(summary);return this.db.withTransaction(async c=>{await this.visit(c,visitId,actor);const q=await c.query<ResultRow>(`UPDATE clinical_schema.visit_results SET clinical_summary=$3,version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND visit_id=$2 AND status='DRAFT' AND version=$4 RETURNING *`,[resultId,visitId,summary.trim(),expected]);if(!q.rows[0])throw new ConflictException({code:'CLINICAL_RESULT_VERSION_OR_STATE_CONFLICT'});await this.evidence(c,'clinical.result.draft.edited',resultId,q.rows[0].version,actor.sub,correlationId);return this.view(q.rows[0]);});}
  publish(visitId:string,resultId:string,actor:JwtPayload,correlationId:string){return this.db.withTransaction(async c=>{await this.visit(c,visitId,actor);let r=await this.result(c,visitId,resultId,true);const created=r.status==='DRAFT';if(created)r=(await c.query<ResultRow>(`UPDATE clinical_schema.visit_results SET status='PUBLISHED',published_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 WHERE id=$1 RETURNING *`,[resultId])).rows[0];await c.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,occurred_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_result_id) WHERE source_result_id IS NOT NULL DO NOTHING`,[r.owner_id,r.pet_id,r.visit_id,r.id,r.published_at]);if(created)await this.evidence(c,'clinical.result.published',r.id,r.version,actor.sub,correlationId);return this.view(r);});}
  amend(visitId:string,resultId:string,content:string,key:string,actor:JwtPayload,correlationId:string){
    const normalizedContent=content.trim();
    this.content(normalizedContent);
    return this.db.withTransaction(async c=>{
      await this.visit(c,visitId,actor);
      const r=await this.result(c,visitId,resultId,true);
      if(r.status!=='PUBLISHED')throw new ConflictException({code:'CLINICAL_RESULT_NOT_PUBLISHED'});
      const inserted=await c.query<AmendmentRow>(`
        INSERT INTO clinical_schema.visit_result_amendments(
          result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,idempotency_key
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT(result_id,idempotency_key) DO NOTHING
        RETURNING id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,amendment_content,published_at
      `,[r.id,r.visit_id,r.owner_id,r.pet_id,r.clinic_id,r.location_id,actor.sub,normalizedContent,key]);
      const created=Boolean(inserted.rows[0]);
      const amendment=inserted.rows[0]??(await c.query<AmendmentRow>(`
        SELECT id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,amendment_content,published_at
        FROM clinical_schema.visit_result_amendments
        WHERE result_id=$1 AND idempotency_key=$2
      `,[r.id,key])).rows[0];
      if(!amendment)throw new ConflictException({code:'AMENDMENT_IDEMPOTENCY_REPLAY_UNAVAILABLE'});
      if(amendment.amendment_content!==normalizedContent)throw new ConflictException({code:'IDEMPOTENCY_KEY_REUSED'});
      if(amendment.visit_id!==r.visit_id||amendment.owner_id!==r.owner_id||amendment.pet_id!==r.pet_id||amendment.clinic_id!==r.clinic_id||amendment.location_id!==r.location_id){
        throw new ConflictException({code:'AMENDMENT_REPLAY_CONTEXT_MISMATCH'});
      }
      if(created){
        await c.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_amendment_id,occurred_at) VALUES($1,$2,$3,$4,$5)`,[r.owner_id,r.pet_id,r.visit_id,amendment.id,amendment.published_at]);
        await this.evidence(c,'clinical.result.amendment.published',amendment.id,1,actor.sub,correlationId);
      }
      return{id:amendment.id,resultId,visitId,content:amendment.amendment_content,publishedAt:amendment.published_at.toISOString()};
    });
  }

  private async visit(c:PoolClient,id:string,actor:JwtPayload){const q=await c.query<{id:string;owner_id:string;pet_id:string;clinic_id:string;location_id:string}>('SELECT id,owner_id,pet_id,clinic_id,location_id FROM clinical_schema.visits WHERE id=$1',[id]);if(!q.rows[0])throw new NotFoundException({code:'CLINICAL_VISIT_NOT_FOUND'});await this.access.assertClinicalVisitCompletionAccess(c,actor,q.rows[0].clinic_id,q.rows[0].location_id);return q.rows[0];}
  private async result(c:PoolClient,visitId:string,id:string,lock:boolean){const q=await c.query<ResultRow>(`SELECT * FROM clinical_schema.visit_results WHERE id=$1 AND visit_id=$2 ${lock?'FOR UPDATE':''}`,[id,visitId]);if(!q.rows[0])throw new NotFoundException({code:'CLINICAL_RESULT_NOT_FOUND'});return q.rows[0];}
  private content(v:string){if(v.trim().length<3||v.trim().length>8000)throw new BadRequestException({code:'INVALID_CLINICAL_CONTENT'});}
  private view(r:ResultRow){return{id:r.id,visitId:r.visit_id,status:r.status,clinicalSummary:r.clinical_summary,version:r.version,createdAt:r.created_at.toISOString(),updatedAt:r.updated_at.toISOString(),publishedAt:r.published_at?.toISOString()??null};}
  private async evidence(c:PoolClient,event:string,id:string,version:number,actor:string,correlation:string){await c.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('CLINIC_EMPLOYEE',$1,$2,'clinical_result',$3,$4,'{}')`,[actor,event,id,correlation]);await c.query(`INSERT INTO booking_schema.outbox_events(event_type,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES($1,$2,'clinical_result',$3,$4,$5,$6) ON CONFLICT(deduplication_key) DO NOTHING`,[event,correlation,id,version,JSON.stringify({id}),`${event}:${id}:${version}`]);}
}
