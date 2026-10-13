import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainException } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

type ResultRow = { id:string;visit_id:string;owner_id:string;pet_id:string;clinic_id:string;location_id:string;author_id:string;status:'DRAFT'|'PUBLISHED';clinical_summary:string;idempotency_key:string;publish_idempotency_key:string|null;version:number;created_at:Date;updated_at:Date;published_at:Date|null };
type AmendmentRow = { id:string;result_id:string;visit_id:string;owner_id:string;pet_id:string;clinic_id:string;location_id:string;author_id:string;amendment_content:string;version:number;created_at:Date;published_at:Date };

@Injectable()
export class ClinicalResultService {
  constructor(private readonly db:DatabaseService,private readonly access:ClinicEmployeeAccessService){}

  createDraft(visitId:string,summary:string,key:string,actor:JwtPayload,correlationId:string){
    const normalized=this.content(summary);
    return this.db.withTransaction(async client=>{
      const visit=await this.visit(client,visitId,actor);
      const inserted=await client.query<ResultRow>(`INSERT INTO clinical_schema.visit_results(visit_id,owner_id,pet_id,clinic_id,location_id,author_id,clinical_summary,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *`,[visit.id,visit.owner_id,visit.pet_id,visit.clinic_id,visit.location_id,actor.sub,normalized,key]);
      if(inserted.rows[0]){await this.evidence(client,'clinical.result.draft.created',inserted.rows[0].id,inserted.rows[0].version,actor.sub,correlationId);return this.view(inserted.rows[0]);}
      const existing=(await client.query<ResultRow>('SELECT * FROM clinical_schema.visit_results WHERE visit_id=$1',[visitId])).rows[0];
      if(!existing)throw new ConflictException({code:'CLINICAL_RESULT_CREATE_CONFLICT'});
      if(existing.idempotency_key===key){if(existing.clinical_summary!==normalized)throw new ConflictException({code:'IDEMPOTENCY_CONFLICT'});return this.view(existing);}
      throw new ConflictException({code:'CLINICAL_RESULT_ALREADY_EXISTS',currentResult:this.view(existing)});
    });
  }

  readCurrent(visitId:string,actor:JwtPayload){return this.db.withTransaction(async client=>{
    await this.visit(client,visitId,actor);
    const result=(await client.query<ResultRow>('SELECT * FROM clinical_schema.visit_results WHERE visit_id=$1',[visitId])).rows[0]??null;
    if(!result)return{visitId,result:null,amendments:[]};
    const amendments=result.status==='PUBLISHED'?(await client.query<AmendmentRow>(`SELECT id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,version,created_at,published_at FROM clinical_schema.visit_result_amendments WHERE result_id=$1 AND visit_id=$2 ORDER BY version ASC`,[result.id,visitId])).rows:[];
    return{visitId,result:this.view(result),amendments:amendments.map(row=>this.amendmentView(row))};
  });}

  read(visitId:string,resultId:string,actor:JwtPayload){return this.db.withTransaction(async client=>{await this.visit(client,visitId,actor);return this.view(await this.result(client,visitId,resultId,false));});}

  updateDraft(visitId:string,resultId:string,summary:string,expected:number,actor:JwtPayload,correlationId:string){
    const normalized=this.content(summary);
    return this.db.withTransaction(async client=>{await this.visit(client,visitId,actor);const updated=await client.query<ResultRow>(`UPDATE clinical_schema.visit_results SET clinical_summary=$3,version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND visit_id=$2 AND status='DRAFT' AND version=$4 RETURNING *`,[resultId,visitId,normalized,expected]);if(!updated.rows[0])throw new ConflictException({code:'CLINICAL_RESULT_VERSION_OR_STATE_CONFLICT'});await this.evidence(client,'clinical.result.draft.edited',resultId,updated.rows[0].version,actor.sub,correlationId);return this.view(updated.rows[0]);});
  }

  publish(visitId:string,resultId:string,expected:number,key:string,actor:JwtPayload,correlationId:string){return this.db.withTransaction(async client=>{
    await this.visit(client,visitId,actor);let result=await this.result(client,visitId,resultId,true);
    if(result.status==='PUBLISHED'){if(result.publish_idempotency_key===key)return this.view(result);throw new ConflictException({code:'CLINICAL_RESULT_VERSION_OR_STATE_CONFLICT'});}
    if(result.version!==expected)throw new ConflictException({code:'CLINICAL_RESULT_VERSION_OR_STATE_CONFLICT'});
    result=(await client.query<ResultRow>(`UPDATE clinical_schema.visit_results SET status='PUBLISHED',published_at=clock_timestamp(),updated_at=clock_timestamp(),publish_idempotency_key=$2,version=version+1 WHERE id=$1 AND status='DRAFT' AND version=$3 RETURNING *`,[resultId,key,expected])).rows[0];
    if(!result)throw new ConflictException({code:'CLINICAL_RESULT_VERSION_OR_STATE_CONFLICT'});
    await client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,occurred_at) VALUES($1,$2,$3,$4,$5)`,[result.owner_id,result.pet_id,result.visit_id,result.id,result.published_at]);
    await client.query(`INSERT INTO booking_schema.outbox_events(event_type,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES('notification.push.summary_ready.v1',$1,'clinical_result',$2,$3,$4,$5) ON CONFLICT(deduplication_key) DO NOTHING`,[correlationId,result.id,result.version,JSON.stringify({resultId:result.id,visitId:result.visit_id,ownerId:result.owner_id,petId:result.pet_id}),`notification.push.summary_ready.v1:${result.id}:${result.version}`]);
    await this.evidence(client,'clinical.result.published',result.id,result.version,actor.sub,correlationId);return this.view(result);
  });}

  amend(visitId:string,resultId:string,content:string,key:string,actor:JwtPayload,correlationId:string){const normalized=this.content(content);return this.db.withTransaction(async client=>{
    await this.visit(client,visitId,actor);const result=await this.result(client,visitId,resultId,true);if(result.status!=='PUBLISHED')throw new ConflictException({code:'CLINICAL_RESULT_NOT_PUBLISHED'});
    const inserted=await client.query<AmendmentRow>(`INSERT INTO clinical_schema.visit_result_amendments(result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(result_id,idempotency_key) DO NOTHING RETURNING id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,version,created_at,published_at`,[result.id,result.visit_id,result.owner_id,result.pet_id,result.clinic_id,result.location_id,actor.sub,normalized,key]);
    const created=Boolean(inserted.rows[0]);const amendment=inserted.rows[0]??(await client.query<AmendmentRow>(`SELECT id,result_id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,amendment_content,version,created_at,published_at FROM clinical_schema.visit_result_amendments WHERE result_id=$1 AND idempotency_key=$2`,[result.id,key])).rows[0];
    if(!amendment)throw new ConflictException({code:'AMENDMENT_IDEMPOTENCY_REPLAY_UNAVAILABLE'});if(amendment.amendment_content!==normalized)throw new ConflictException({code:'IDEMPOTENCY_CONFLICT'});
    if(amendment.visit_id!==result.visit_id||amendment.owner_id!==result.owner_id||amendment.pet_id!==result.pet_id||amendment.clinic_id!==result.clinic_id||amendment.location_id!==result.location_id)throw new ConflictException({code:'AMENDMENT_REPLAY_CONTEXT_MISMATCH'});
    if(created){await client.query(`INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_amendment_id,occurred_at) VALUES($1,$2,$3,$4,$5)`,[result.owner_id,result.pet_id,result.visit_id,amendment.id,amendment.published_at]);await this.evidence(client,'clinical.result.amendment.published',amendment.id,amendment.version,actor.sub,correlationId);}
    return this.amendmentView(amendment);
  });}

  private async visit(client:PoolClient,id:string,actor:JwtPayload){const invisible=()=>new NotFoundException({code:'CLINICAL_VISIT_NOT_FOUND'});const visit=(await client.query<{id:string;owner_id:string;pet_id:string;clinic_id:string;location_id:string}>('SELECT id,owner_id,pet_id,clinic_id,location_id FROM clinical_schema.visits WHERE id=$1 AND clinic_id=ANY($2::uuid[]) AND location_id=ANY($3::uuid[])',[id,actor.clinicIds??[],actor.locationIds??[]])).rows[0];if(!visit)throw invisible();try{await this.access.assertClinicalVisitCompletionAccess(client,actor,visit.clinic_id,visit.location_id);}catch(error){if(error instanceof DomainException)throw invisible();throw error;}return visit;}
  private async result(client:PoolClient,visitId:string,id:string,lock:boolean){const result=(await client.query<ResultRow>(`SELECT * FROM clinical_schema.visit_results WHERE id=$1 AND visit_id=$2 ${lock?'FOR UPDATE':''}`,[id,visitId])).rows[0];if(!result)throw new NotFoundException({code:'CLINICAL_RESULT_NOT_FOUND'});return result;}
  private content(value:string){const normalized=value.trim();if(normalized.length<3||normalized.length>8000)throw new BadRequestException({code:'INVALID_CLINICAL_CONTENT'});return normalized;}
  private view(row:ResultRow){return{id:row.id,visitId:row.visit_id,authorId:row.author_id,status:row.status,clinicalSummary:row.clinical_summary,version:row.version,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),publishedAt:row.published_at?.toISOString()??null};}
  private amendmentView(row:AmendmentRow){return{amendmentId:row.id,resultId:row.result_id,visitId:row.visit_id,authorId:row.author_id,version:row.version,content:row.amendment_content,createdAt:row.created_at.toISOString(),publishedAt:row.published_at.toISOString()};}
  private async evidence(client:PoolClient,event:string,id:string,version:number,actor:string,correlation:string){await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('CLINIC_EMPLOYEE',$1,$2,'clinical_result',$3,$4,'{}')`,[actor,event,id,correlation]);await client.query(`INSERT INTO booking_schema.outbox_events(event_type,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES($1,$2,'clinical_result',$3,$4,$5,$6) ON CONFLICT(deduplication_key) DO NOTHING`,[event,correlation,id,version,JSON.stringify({id}),`${event}:${id}:${version}`]);}
}
