import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { DomainErrors } from '../common/domain-error';
import { CapabilityEvaluatorService } from '../auth/capability-evaluator.service';
import { Capability } from '../auth/capability';
import type { JwtPayload } from '../auth/auth.types';
import { BookingChangeRequestStatus, BookingChangeRequestType, type BookingChangeRequestDto, type OperationsBookingChangeRequestDetailDto, type OperationsBookingChangeRequestPageDto } from './dto/booking-change-request.dto';

type Row={id:string;request_type:BookingChangeRequestType;status:BookingChangeRequestStatus;booking_hold_id:string;appointment_id:string|null;clinic_id:string;location_id:string;slot_id:string;version:number;created_at:Date;state_changed_at:Date;updated_at:Date;terminal_at:Date|null};
type Context={booking_hold_id:string;owner_id:string;slot_id:string;hold_state:string;clinic_id:string;location_id:string;appointment_id:string|null;appointment_status:string|null};
type IdempotencyRow={status:string;response_body:unknown;request_fingerprint:string|null};
type DetailRow=Row&{server_now:Date;current_booking_status:string;current_appointment_status:string|null};
type OperationsCommand='START'|'COMPLETE'|'REJECT'|'CANCEL';
type ProcessingContext={hold_id:string;hold_state:string;hold_version:number;owner_id:string;pet_id:string;appointment_id:string;appointment_status:string;appointment_version:number};
type SlotRow={id:string;clinic_location_id:string;service_id:string;staff_id:string|null;starts_at:Date;ends_at:Date;capacity:number;booked_count:number;held_count:number;state:string;status:string;publication_state:string;version:number};

@Injectable()
export class BookingChangeRequestService{
  constructor(private readonly database:DatabaseService,private readonly capabilities:CapabilityEvaluatorService){}

  async create(input:{holdId:string;ownerId:string;requestType:BookingChangeRequestType;idempotencyKey:string;correlationId:string}):Promise<BookingChangeRequestDto>{
    try{return await this.database.withTransaction(async client=>{
      await client.query("SET LOCAL lock_timeout='250ms'");
      const context=(await client.query<Context>(`
        SELECT hold.id booking_hold_id,hold.owner_id,hold.slot_id,hold.state hold_state,
               location.clinic_id,location.id location_id,appointment.id appointment_id,appointment.status appointment_status
        FROM booking_schema.booking_holds hold
        JOIN clinic_schema.appointment_slots slot ON slot.id=hold.slot_id
        JOIN clinic_schema.clinic_locations location ON location.id=slot.clinic_location_id
        LEFT JOIN booking_schema.appointments appointment ON appointment.hold_id=hold.id
        WHERE hold.id=$1::uuid AND hold.owner_id=$2::uuid
        FOR UPDATE OF hold
      `,[input.holdId,input.ownerId])).rows[0];
      if(!context)throw new NotFoundException({code:'BOOKING_NOT_FOUND'});

      const scope=`booking.change-request:${input.ownerId}:${input.requestType}`;
      const fingerprint=createHash('sha256').update(JSON.stringify({holdId:context.booking_hold_id,requestType:input.requestType})).digest('hex');
      const replay=await this.acquireIdempotency(client,scope,input.idempotencyKey,fingerprint);
      if(replay)return replay;
      if(context.hold_state!=='CONFIRMED'||!context.appointment_id||context.appointment_status!=='CONFIRMED')throw new UnprocessableEntityException({code:'BOOKING_CHANGE_REQUEST_NOT_ALLOWED'});

      let row:Row;
      try{row=(await client.query<Row>(`
        INSERT INTO booking_schema.booking_change_requests
          (request_type,status,booking_hold_id,appointment_id,owner_id,clinic_id,location_id,slot_id,idempotency_key,correlation_id)
        VALUES($1,'OPEN',$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::uuid)
        RETURNING *
      `,[input.requestType,context.booking_hold_id,context.appointment_id,input.ownerId,context.clinic_id,context.location_id,context.slot_id,input.idempotencyKey,input.correlationId])).rows[0];}
      catch(error){if((error as {code?:string;constraint?:string}).code==='23505'&&(error as {constraint?:string}).constraint==='booking_change_requests_one_active_per_booking_idx')throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_ACTIVE_CONFLICT'});throw error;}
      const result=this.map(row);
      await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('OWNER',$1,'booking_change_request.opened','booking_change_request',$2::uuid,$3::uuid,$4::jsonb)`,[input.ownerId,row.id,input.correlationId,JSON.stringify({requestType:row.request_type,bookingHoldId:row.booking_hold_id,clinicId:row.clinic_id,locationId:row.location_id})]);
      await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES('booking.change-request.opened.v1','booking-change-request',$1::uuid,'booking_change_request',$2::uuid,$3,$4::jsonb,$5)`,[input.correlationId,row.id,row.version,JSON.stringify({requestId:row.id,requestType:row.request_type,status:row.status,bookingHoldId:row.booking_hold_id,appointmentId:row.appointment_id,clinicId:row.clinic_id,locationId:row.location_id}),`booking.change-request.opened.v1:${row.id}`]);
      await client.query(`UPDATE booking_schema.idempotency_records SET status='COMPLETED',response_status=201,response_body=$3::jsonb,updated_at=clock_timestamp() WHERE scope=$1 AND idempotency_key=$2::uuid`,[scope,input.idempotencyKey,JSON.stringify(result)]);
      return result;
    });}catch(error){if((error as {code?:string}).code==='55P03')throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_RETRY'});throw error;}
  }

  async readCurrent(input:{holdId:string;ownerId:string}):Promise<BookingChangeRequestDto>{
    const owner=(await this.database.query(`SELECT 1 FROM booking_schema.booking_holds WHERE id=$1::uuid AND owner_id=$2::uuid`,[input.holdId,input.ownerId])).rows[0];
    if(!owner)throw new NotFoundException({code:'BOOKING_NOT_FOUND'});
    const row=(await this.database.query<Row>(`SELECT * FROM booking_schema.booking_change_requests WHERE booking_hold_id=$1::uuid AND owner_id=$2::uuid ORDER BY (status IN ('OPEN','PROCESSING')) DESC,created_at DESC,id DESC LIMIT 1`,[input.holdId,input.ownerId])).rows[0];
    if(!row)throw new NotFoundException({code:'BOOKING_CHANGE_REQUEST_NOT_FOUND'});
    return this.map(row);
  }

  async readOperations(input:{status?:BookingChangeRequestStatus;locationId?:string;limit:number;actor:JwtPayload}):Promise<OperationsBookingChangeRequestPageDto>{
    return this.database.withTransaction(async client=>{
    await this.capabilities.assertAllowed(client,{actor:input.actor,capability:Capability.BOOKING_CHANGE_REQUEST_READ,resource:{aggregateType:'booking.change-request',authorityModel:'platform'}});
    const result=await client.query<Row&{observed_at:Date}>(`
      WITH observation AS (SELECT clock_timestamp() observed_at)
      SELECT request.*,observation.observed_at
      FROM observation
      LEFT JOIN LATERAL (
        SELECT * FROM booking_schema.booking_change_requests request
        WHERE ($1::text IS NULL AND request.status IN ('OPEN','PROCESSING') OR request.status=$1::text)
          AND ($2::uuid IS NULL OR request.location_id=$2::uuid)
        ORDER BY request.created_at ASC,request.id ASC LIMIT $3
      ) request ON true
    `,[input.status??null,input.locationId??null,input.limit]);
    return{observedAt:result.rows[0].observed_at.toISOString(),items:result.rows[0].id?result.rows.map(row=>this.map(row)):[]};
    });
  }

  async readOperationsDetail(input:{requestId:string;actor:JwtPayload}):Promise<OperationsBookingChangeRequestDetailDto>{
    return this.database.withTransaction(async client=>{
      await this.capabilities.assertAllowed(client,{actor:input.actor,capability:Capability.BOOKING_CHANGE_REQUEST_READ,resource:{aggregateType:'booking.change-request',authorityModel:'platform'}});
      return this.readDetail(client,input.requestId);
    });
  }

  async transitionOperations(input:{requestId:string;actor:JwtPayload;command:OperationsCommand;expectedVersion:number;idempotencyKey:string;correlationId:string;replacementSlotId?:string;replacementSlotVersion?:number}):Promise<OperationsBookingChangeRequestDetailDto>{
    const rules:Record<OperationsCommand,{from:BookingChangeRequestStatus[];to:BookingChangeRequestStatus}>={
      START:{from:[BookingChangeRequestStatus.OPEN],to:BookingChangeRequestStatus.PROCESSING},
      COMPLETE:{from:[BookingChangeRequestStatus.PROCESSING],to:BookingChangeRequestStatus.COMPLETED},
      REJECT:{from:[BookingChangeRequestStatus.PROCESSING],to:BookingChangeRequestStatus.REJECTED},
      CANCEL:{from:[BookingChangeRequestStatus.OPEN,BookingChangeRequestStatus.PROCESSING],to:BookingChangeRequestStatus.CANCELLED},
    };
    try{return await this.database.withTransaction(async client=>{
      await client.query("SET LOCAL lock_timeout='250ms'");
      await this.capabilities.assertAllowed(client,{actor:input.actor,capability:Capability.BOOKING_CHANGE_REQUEST_PROCESS,resource:{aggregateType:'booking.change-request',authorityModel:'platform'}});
      const scope=`booking.change-request.operations:${input.actor.sub}:${input.command}`;
      const fingerprint=createHash('sha256').update(JSON.stringify({requestId:input.requestId,expectedVersion:input.expectedVersion,command:input.command,replacementSlotId:input.replacementSlotId??null,replacementSlotVersion:input.replacementSlotVersion??null})).digest('hex');
      const replay=await this.acquireOperationsIdempotency(client,scope,input.idempotencyKey,fingerprint);
      if(replay)return replay;
      const current=(await client.query<Row>('SELECT * FROM booking_schema.booking_change_requests WHERE id=$1::uuid FOR UPDATE',[input.requestId])).rows[0];
      if(!current)throw new NotFoundException({code:'BOOKING_CHANGE_REQUEST_NOT_FOUND'});
      if(current.version!==input.expectedVersion)throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_VERSION_STALE',currentVersion:current.version});
      const rule=rules[input.command];
      if(!rule.from.includes(current.status))throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_STATE_CONFLICT',currentStatus:current.status});
      if(input.command==='COMPLETE')await this.processBookingChange(client,current,input);
      else{const terminal=rule.to!==BookingChangeRequestStatus.PROCESSING;await client.query(`UPDATE booking_schema.booking_change_requests SET status=$2,version=version+1,state_changed_at=clock_timestamp(),updated_at=clock_timestamp(),terminal_at=CASE WHEN $3 THEN clock_timestamp() ELSE NULL END WHERE id=$1::uuid AND version=$4`,[input.requestId,rule.to,terminal,input.expectedVersion]);}
      const result=await this.readDetail(client,input.requestId);
      await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('PLATFORM_USER',$1,$2,'booking_change_request',$3::uuid,$4::uuid,$5::jsonb)`,[input.actor.sub,`booking_change_request.${input.command.toLowerCase()}`,input.requestId,input.correlationId,JSON.stringify({from:current.status,to:rule.to,version:result.version})]);
      await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES($1,'booking-change-request',$2::uuid,'booking_change_request',$3::uuid,$4,$5::jsonb,$6)`,[`booking.change-request.${rule.to.toLowerCase()}.v1`,input.correlationId,input.requestId,result.version,JSON.stringify({requestId:input.requestId,status:rule.to,bookingHoldId:result.bookingHoldId,appointmentId:result.appointmentId,clinicId:result.clinicId,locationId:result.locationId}),`booking.change-request.${rule.to.toLowerCase()}.v1:${input.requestId}:${result.version}`]);
      await client.query(`UPDATE booking_schema.idempotency_records SET status='COMPLETED',response_status=200,response_body=$3::jsonb,updated_at=clock_timestamp() WHERE scope=$1 AND idempotency_key=$2::uuid`,[scope,input.idempotencyKey,JSON.stringify(result)]);
      return result;
    });}catch(error){if((error as {code?:string}).code==='55P03')throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_RETRY'});throw error;}
  }

  private async processBookingChange(client:PoolClient,current:Row,input:{actor:JwtPayload;replacementSlotId?:string;replacementSlotVersion?:number;correlationId:string}):Promise<void>{
    const context=(await client.query<ProcessingContext>(`SELECT hold.id hold_id,hold.state hold_state,hold.version hold_version,hold.owner_id,hold.pet_id,appointment.id appointment_id,appointment.status appointment_status,appointment.version appointment_version FROM booking_schema.booking_holds hold JOIN booking_schema.appointments appointment ON appointment.id=$2::uuid AND appointment.hold_id=hold.id WHERE hold.id=$1::uuid FOR UPDATE OF hold,appointment`,[current.booking_hold_id,current.appointment_id])).rows[0];
    if(!context||context.hold_state!=='CONFIRMED'||context.appointment_status!=='CONFIRMED')throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_BOOKING_STALE'});
    if(current.request_type===BookingChangeRequestType.CANCEL){
      if(input.replacementSlotId||input.replacementSlotVersion)throw new UnprocessableEntityException({code:'BOOKING_CHANGE_REQUEST_REPLACEMENT_NOT_ALLOWED'});
      const slot=(await client.query<SlotRow>('SELECT * FROM clinic_schema.appointment_slots WHERE id=$1::uuid FOR UPDATE',[current.slot_id])).rows[0];if(!slot||slot.booked_count<1)throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_BOOKING_STALE'});
      await client.query(`UPDATE clinic_schema.appointment_slots SET booked_count=booked_count-1,status=CASE WHEN booked_count-1>=capacity THEN 'BOOKED' WHEN held_count>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid`,[slot.id]);
      await client.query(`UPDATE booking_schema.appointments SET status='CANCELLED',version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid`,[context.appointment_id]);
      await client.query(`UPDATE booking_schema.booking_holds SET state='RELEASED',confirmation_sla_expires_at=NULL,state_changed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid`,[context.hold_id]);
      await client.query(`INSERT INTO booking_schema.appointment_events(appointment_id,hold_id,event_type,actor_type,actor_id,correlation_id,payload_json) VALUES($1::uuid,$2::uuid,'CANCELLED','PLATFORM_USER',$3::uuid,$4::uuid,$5::jsonb)`,[context.appointment_id,context.hold_id,input.actor.sub,input.correlationId,JSON.stringify({requestId:current.id})]);
      await this.bookingEvidence(client,'booking.hold.released.v1','booking.change-request.processed.cancel',current,context.hold_version+1,input,{slotId:slot.id,appointmentId:context.appointment_id,reason:'OWNER_CANCELLED',actorId:input.actor.sub});
    }else{
      if(!input.replacementSlotId||!input.replacementSlotVersion)throw new UnprocessableEntityException({code:'BOOKING_CHANGE_REQUEST_REPLACEMENT_REQUIRED'});
      if(input.replacementSlotId===current.slot_id)throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_REPLACEMENT_INELIGIBLE'});
      await client.query('SET CONSTRAINTS booking_schema.booking_change_requests_hold_owner_slot_fkey, booking_schema.booking_change_requests_appointment_context_fkey DEFERRED');
      const ids=[current.slot_id,input.replacementSlotId].sort();const locked=(await client.query<SlotRow>('SELECT * FROM clinic_schema.appointment_slots WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids])).rows;const source=locked.find(row=>row.id===current.slot_id);const replacement=locked.find(row=>row.id===input.replacementSlotId);
      if(!source||!replacement||source.booked_count<1)throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_BOOKING_STALE'});
      if(replacement.version!==input.replacementSlotVersion)throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_REPLACEMENT_STALE',currentVersion:replacement.version});
      const serverNow=(await client.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
      const eligible=replacement.clinic_location_id===current.location_id&&replacement.service_id===source.service_id&&replacement.staff_id===source.staff_id&&replacement.state==='OPEN'&&replacement.publication_state==='PUBLISHED'&&replacement.status!=='BOOKED'&&replacement.starts_at>serverNow&&replacement.capacity-replacement.booked_count-replacement.held_count>0;
      if(!eligible)throw new ConflictException({code:'BOOKING_CHANGE_REQUEST_REPLACEMENT_INELIGIBLE'});
      await client.query(`UPDATE clinic_schema.appointment_slots SET booked_count=booked_count-1,status=CASE WHEN booked_count-1>=capacity THEN 'BOOKED' WHEN held_count>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid`,[source.id]);
      await client.query(`UPDATE clinic_schema.appointment_slots SET booked_count=booked_count+1,status=CASE WHEN booked_count+1>=capacity THEN 'BOOKED' WHEN held_count>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid`,[replacement.id]);
      await client.query(`UPDATE booking_schema.booking_holds SET slot_id=$2::uuid,state_changed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid`,[context.hold_id,replacement.id]);
      await client.query(`UPDATE booking_schema.appointments SET slot_id=$2::uuid,version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid`,[context.appointment_id,replacement.id]);
      await client.query(`UPDATE booking_schema.booking_change_requests SET slot_id=$2::uuid,status='COMPLETED',version=version+1,state_changed_at=clock_timestamp(),updated_at=clock_timestamp(),terminal_at=clock_timestamp() WHERE id=$1::uuid`,[current.id,replacement.id]);
      await client.query(`INSERT INTO booking_schema.appointment_events(appointment_id,hold_id,event_type,actor_type,actor_id,correlation_id,payload_json) VALUES($1::uuid,$2::uuid,'RESCHEDULED','PLATFORM_USER',$3::uuid,$4::uuid,$5::jsonb)`,[context.appointment_id,context.hold_id,input.actor.sub,input.correlationId,JSON.stringify({requestId:current.id,sourceSlotId:source.id,replacementSlotId:replacement.id})]);
      await this.bookingEvidence(client,'booking.rescheduled.v1','booking.change-request.processed.reschedule',current,context.hold_version+1,input,{sourceSlotId:source.id,replacementSlotId:replacement.id,appointmentId:context.appointment_id});return;
    }
    await client.query(`UPDATE booking_schema.booking_change_requests SET status='COMPLETED',version=version+1,state_changed_at=clock_timestamp(),updated_at=clock_timestamp(),terminal_at=clock_timestamp() WHERE id=$1::uuid`,[current.id]);
  }

  private async bookingEvidence(client:PoolClient,eventType:string,action:string,current:Row,version:number,input:{actor:JwtPayload;correlationId:string},payload:Record<string,unknown>){await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES($1,'booking-change-request',$2::uuid,'booking_hold',$3::uuid,$4,$5::jsonb,$6)`,[eventType,input.correlationId,current.booking_hold_id,version,JSON.stringify({requestId:current.id,...payload}),`${eventType}:${current.booking_hold_id}:${version}`]);await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('PLATFORM_USER',$1,$2,'booking_hold',$3::uuid,$4::uuid,$5::jsonb)`,[input.actor.sub,action,current.booking_hold_id,input.correlationId,JSON.stringify({requestId:current.id,...payload})]);}

  private async readDetail(client:PoolClient,requestId:string):Promise<OperationsBookingChangeRequestDetailDto>{
    const row=(await client.query<DetailRow>(`SELECT request.*,clock_timestamp() server_now,hold.state current_booking_status,appointment.status current_appointment_status FROM booking_schema.booking_change_requests request JOIN booking_schema.booking_holds hold ON hold.id=request.booking_hold_id LEFT JOIN booking_schema.appointments appointment ON appointment.id=request.appointment_id WHERE request.id=$1::uuid`,[requestId])).rows[0];
    if(!row)throw new NotFoundException({code:'BOOKING_CHANGE_REQUEST_NOT_FOUND'});
    const replacements=row.request_type===BookingChangeRequestType.RESCHEDULE&&row.status===BookingChangeRequestStatus.PROCESSING?(await client.query<{id:string;starts_at:Date;ends_at:Date;version:number}>(`SELECT candidate.id,candidate.starts_at,candidate.ends_at,candidate.version FROM clinic_schema.appointment_slots source JOIN clinic_schema.appointment_slots candidate ON candidate.clinic_location_id=source.clinic_location_id AND candidate.service_id=source.service_id AND candidate.staff_id IS NOT DISTINCT FROM source.staff_id WHERE source.id=$1::uuid AND candidate.id<>source.id AND candidate.state='OPEN' AND candidate.publication_state='PUBLISHED' AND candidate.status<>'BOOKED' AND candidate.starts_at>clock_timestamp() AND candidate.capacity-candidate.booked_count-candidate.held_count>0 ORDER BY candidate.starts_at,candidate.id LIMIT 25`,[row.slot_id])).rows.map(slot=>({slotId:slot.id,startsAt:slot.starts_at.toISOString(),endsAt:slot.ends_at.toISOString(),version:slot.version})):[];
    return{...this.map(row),serverNow:row.server_now.toISOString(),currentBookingStatus:row.current_booking_status,currentAppointmentStatus:row.current_appointment_status,replacementSlots:replacements};
  }

  private async acquireOperationsIdempotency(client:PoolClient,scope:string,key:string,fingerprint:string):Promise<OperationsBookingChangeRequestDetailDto|null>{
    const inserted=await client.query(`INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,request_fingerprint) VALUES($1,$2::uuid,'PROCESSING',$3) ON CONFLICT DO NOTHING RETURNING id`,[scope,key,fingerprint]);
    if(inserted.rows[0])return null;
    const row=(await client.query<IdempotencyRow>(`SELECT status,response_body,request_fingerprint FROM booking_schema.idempotency_records WHERE scope=$1 AND idempotency_key=$2::uuid FOR UPDATE`,[scope,key])).rows[0];
    if(!row||row.request_fingerprint!==fingerprint)throw new ConflictException({code:'IDEMPOTENCY_CONFLICT'});
    if(row.status!=='COMPLETED'||!row.response_body)throw DomainErrors.idempotencyInProgress();
    const response=row.response_body as OperationsBookingChangeRequestDetailDto;
    if(!(await client.query('SELECT 1 FROM booking_schema.booking_change_requests WHERE id=$1::uuid',[response.requestId])).rows[0])throw new ConflictException({code:'IDEMPOTENCY_REPLAY_ORPHANED'});
    return response;
  }

  private async acquireIdempotency(client:PoolClient,scope:string,key:string,fingerprint:string):Promise<BookingChangeRequestDto|null>{
    const inserted=await client.query(`INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,request_fingerprint) VALUES($1,$2::uuid,'PROCESSING',$3) ON CONFLICT DO NOTHING RETURNING id`,[scope,key,fingerprint]);
    if(inserted.rows[0])return null;
    const row=(await client.query<IdempotencyRow>(`SELECT status,response_body,request_fingerprint FROM booking_schema.idempotency_records WHERE scope=$1 AND idempotency_key=$2::uuid FOR UPDATE`,[scope,key])).rows[0];
    if(!row||row.request_fingerprint!==fingerprint)throw new ConflictException({code:'IDEMPOTENCY_CONFLICT'});
    if(row.status!=='COMPLETED'||!row.response_body)throw DomainErrors.idempotencyInProgress();
    const response=row.response_body as BookingChangeRequestDto;
    const aggregate=(await client.query(`SELECT 1 FROM booking_schema.booking_change_requests WHERE id=$1::uuid`,[response.requestId])).rows[0];
    if(!aggregate)throw new ConflictException({code:'IDEMPOTENCY_REPLAY_ORPHANED'});
    return response;
  }

  private map(row:Row):BookingChangeRequestDto{return{requestId:row.id,requestType:row.request_type,status:row.status,bookingHoldId:row.booking_hold_id,appointmentId:row.appointment_id,clinicId:row.clinic_id,locationId:row.location_id,slotId:row.slot_id,version:row.version,createdAt:row.created_at.toISOString(),stateChangedAt:row.state_changed_at.toISOString(),updatedAt:row.updated_at.toISOString(),terminalAt:row.terminal_at?.toISOString()??null};}
}
