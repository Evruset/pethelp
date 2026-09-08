import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainErrors } from '../common/domain-error';

export type ReallocationReplacementOutcome = 'CONFIRMED' | 'REJECTED' | 'EXPIRED';

interface TerminalCaseRow {
  id:string; status:string; correlation_id:string; booking_hold_id:string; appointment_id:string;
  source_hold_state:string; source_slot_id:string; appointment_status:string;
}

@Injectable()
export class ReallocationFinalizationService {
  async finalizeReplacement(client:PoolClient,replacementHoldId:string,outcome:ReallocationReplacementOutcome,correlationId:string|null):Promise<void>{
    const item=(await client.query<TerminalCaseRow>(`SELECT c.id,c.status,c.correlation_id,c.booking_hold_id,c.appointment_id,source_hold.state source_hold_state,source_hold.slot_id source_slot_id,appointment.status appointment_status FROM booking_schema.reallocation_cases c JOIN booking_schema.booking_holds source_hold ON source_hold.id=c.booking_hold_id JOIN booking_schema.appointments appointment ON appointment.id=c.appointment_id AND appointment.hold_id=source_hold.id WHERE c.replacement_booking_hold_id=$1::uuid FOR UPDATE OF c,source_hold,appointment`,[replacementHoldId])).rows[0];
    if(!item||item.status==='CLOSED')return;
    if(item.status!=='REPLACEMENT_PENDING_CONFIRMATION')throw DomainErrors.bookingStateConflict();
    const effectiveCorrelationId=correlationId??item.correlation_id;
    let sourceReleased=false;
    if(outcome==='CONFIRMED'){
      if(item.source_hold_state==='CONFIRMED'&&item.appointment_status==='CONFIRMED'){
        if(!(await client.query(`SELECT id FROM clinic_schema.appointment_slots WHERE id=$1::uuid FOR UPDATE`,[item.source_slot_id])).rows[0])throw DomainErrors.bookingUnavailable();
        const appointment=await client.query(`UPDATE booking_schema.appointments SET status='CANCELLED',version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid AND status='CONFIRMED' RETURNING version`,[item.appointment_id]);
        const capacity=await client.query(`UPDATE clinic_schema.appointment_slots SET booked_count=booked_count-1,status=CASE WHEN booked_count-1>=capacity THEN 'BOOKED' WHEN held_count>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid AND booked_count>0 RETURNING id`,[item.source_slot_id]);
        const hold=await client.query<{version:number}>(`UPDATE booking_schema.booking_holds SET state='RELEASED',confirmation_sla_expires_at=NULL,state_changed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid AND state='CONFIRMED' RETURNING version`,[item.booking_hold_id]);
        if(!appointment.rows[0]||!capacity.rows[0]||!hold.rows[0])throw DomainErrors.bookingUnavailable();
        sourceReleased=true;
        const releasePayload={holdId:item.booking_hold_id,slotId:item.source_slot_id,appointmentId:item.appointment_id,reason:'REALLOCATION_REPLACED',replacementBookingHoldId:replacementHoldId,reallocationCaseId:item.id};
        await client.query(`INSERT INTO booking_schema.appointment_events(appointment_id,hold_id,event_type,actor_type,actor_id,correlation_id,payload_json) VALUES($1::uuid,$2::uuid,'CANCELLED','SYSTEM',NULL,$3::uuid,$4::jsonb)`,[item.appointment_id,item.booking_hold_id,effectiveCorrelationId,JSON.stringify(releasePayload)]);
        await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES('booking.hold.released.v1','reallocation',$1::uuid,'booking_hold',$2::uuid,$3,$4::jsonb,$5)`,[effectiveCorrelationId,item.booking_hold_id,hold.rows[0].version,JSON.stringify(releasePayload),`booking.hold.released.v1:${item.booking_hold_id}:${hold.rows[0].version}`]);
      }else if(!(item.source_hold_state==='RELEASED'&&item.appointment_status==='CANCELLED'))throw DomainErrors.bookingStateConflict();
    }
    const closed=await client.query<{version:number}>(`UPDATE booking_schema.reallocation_cases SET status='CLOSED',terminal_at=clock_timestamp(),state_changed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() WHERE id=$1::uuid AND status='REPLACEMENT_PENDING_CONFIRMATION' RETURNING version`,[item.id]);
    if(!closed.rows[0])throw DomainErrors.bookingStateConflict();
    const payload={caseId:item.id,outcome,sourceBookingHoldId:item.booking_hold_id,replacementBookingHoldId:replacementHoldId,sourceReleased};
    await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('SYSTEM',NULL,'reallocation.case.closed','reallocation_case',$1::uuid,$2::uuid,$3::jsonb)`,[item.id,effectiveCorrelationId,JSON.stringify(payload)]);
    await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES('booking.reallocation-case.closed.v1','reallocation',$1::uuid,'reallocation_case',$2::uuid,$3,$4::jsonb,$5)`,[effectiveCorrelationId,item.id,closed.rows[0].version,JSON.stringify(payload),`booking.reallocation-case.closed.v1:${item.id}`]);
  }
}
