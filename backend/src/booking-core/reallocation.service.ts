import { ConflictException, HttpStatus, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DomainException } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { BookingHoldCreationService } from './booking-hold-creation.service';
import type { ReallocationCaseDto, ReallocationOfferDto } from './dto/reallocation.dto';

type Candidate={clinic_id:string;location_id:string;doctor_id:string;service_id:string;doctor_service_id:string;slot_id:string;slot_version:number;starts_at:Date;ends_at:Date;distance_meters:string|null;price_amount:string|null;price_currency:string|null;temporal_delta_ms:string};
type CaseRow={id:string;booking_change_request_id:string;booking_hold_id:string;status:string;version:number;created_at:Date;server_now:Date;accepted_offer_id:string|null;replacement_booking_hold_id:string|null};

export function rankReallocationCandidates(candidates:Candidate[]):Candidate[]{
  const compareDistance=candidates.length>0&&candidates.every(candidate=>candidate.distance_meters!==null);
  const currencies=new Set(candidates.map(candidate=>candidate.price_currency).filter((value):value is string=>value!==null));
  const comparePrice=candidates.length>0&&candidates.every(candidate=>candidate.price_amount!==null&&candidate.price_currency!==null)&&currencies.size===1;
  return [...candidates].sort((a,b)=>Number(a.temporal_delta_ms)-Number(b.temporal_delta_ms)
    ||(compareDistance?Number(a.distance_meters)-Number(b.distance_meters):0)
    ||(comparePrice?Number(a.price_amount)-Number(b.price_amount):0)
    ||a.slot_id.localeCompare(b.slot_id));
}

@Injectable()
export class ReallocationService {
  constructor(private readonly database:DatabaseService,private readonly holdCreation:BookingHoldCreationService){}

  async open(input:{requestId:string;ownerId:string;idempotencyKey:string;correlationId:string}):Promise<ReallocationCaseDto>{
    return this.database.withTransaction(async client=>{
      await client.query("SET LOCAL lock_timeout='500ms'");
      const existing=(await client.query<CaseRow>(`SELECT c.*,clock_timestamp() server_now FROM booking_schema.reallocation_cases c WHERE c.booking_change_request_id=$1::uuid AND c.owner_id=$2::uuid`,[input.requestId,input.ownerId])).rows[0];
      if(existing)return this.readWithClient(client,existing.id,input.ownerId);
      const source=(await client.query<{
        request_id:string;hold_id:string;appointment_id:string;owner_id:string;clinic_id:string;location_id:string;slot_id:string;starts_at:Date;service_code:string;pet_species:string;latitude:string|null;longitude:string|null
      }>(`SELECT r.id request_id,r.booking_hold_id hold_id,r.appointment_id,r.owner_id,r.clinic_id,r.location_id,r.slot_id,
                 source.starts_at,service.code service_code,pet.species pet_species,location.latitude,location.longitude
          FROM booking_schema.booking_change_requests r
          JOIN booking_schema.booking_holds hold ON hold.id=r.booking_hold_id
          JOIN booking_schema.appointments appointment ON appointment.id=r.appointment_id
          JOIN clinic_schema.appointment_slots source ON source.id=r.slot_id
          JOIN clinic_schema.clinic_services service ON service.id=source.service_id
          JOIN pet_schema.pets pet ON pet.id=hold.pet_id AND pet.owner_id=r.owner_id
          JOIN clinic_schema.clinic_locations location ON location.id=r.location_id
          WHERE r.id=$1::uuid AND r.owner_id=$2::uuid AND r.request_type='RESCHEDULE'
            AND r.status IN ('OPEN','PROCESSING') AND hold.state='CONFIRMED' AND appointment.status='CONFIRMED'
          FOR UPDATE OF r`,[input.requestId,input.ownerId])).rows[0];
      if(!source)throw new UnprocessableEntityException({code:'REALLOCATION_NOT_ALLOWED'});

      let created:CaseRow;
      try { created=(await client.query<CaseRow>(`INSERT INTO booking_schema.reallocation_cases
        (booking_change_request_id,booking_hold_id,appointment_id,owner_id,source_clinic_id,source_location_id,source_slot_id,idempotency_key,correlation_id)
        VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::uuid)
        RETURNING *,clock_timestamp() server_now`,[source.request_id,source.hold_id,source.appointment_id,source.owner_id,source.clinic_id,source.location_id,source.slot_id,input.idempotencyKey,input.correlationId])).rows[0]; }
      catch(error){if((error as {code?:string}).code==='23505')throw new ConflictException({code:'REALLOCATION_ACTIVE_CONFLICT'});throw error;}

      await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json)
        VALUES('OWNER',$1::uuid,'reallocation.case.opened','reallocation_case',$2::uuid,$3::uuid,$4::jsonb)`,[input.ownerId,created.id,input.correlationId,JSON.stringify({bookingChangeRequestId:source.request_id,bookingHoldId:source.hold_id})]);
      await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key)
        VALUES('booking.reallocation-case.opened.v1','reallocation',$1::uuid,'reallocation_case',$2::uuid,1,$3::jsonb,$4)`,[input.correlationId,created.id,JSON.stringify({caseId:created.id,bookingChangeRequestId:source.request_id,bookingHoldId:source.hold_id}),`booking.reallocation-case.opened.v1:${created.id}`]);

      const candidates=(await client.query<Candidate>(`SELECT location.clinic_id,slot.clinic_location_id location_id,doctor_service.doctor_id,
          slot.service_id,slot.doctor_service_id,slot.id slot_id,slot.version slot_version,slot.starts_at,slot.ends_at,
          CASE WHEN $3::numeric IS NOT NULL AND $4::numeric IS NOT NULL AND location.latitude IS NOT NULL AND location.longitude IS NOT NULL
            THEN 6371000 * 2 * asin(sqrt(power(sin(radians((location.latitude-$3::numeric)/2)),2)+cos(radians($3::numeric))*cos(radians(location.latitude))*power(sin(radians((location.longitude-$4::numeric)/2)),2))) END distance_meters,
          service.price_amount,CASE WHEN service.price_amount IS NULL THEN NULL ELSE service.currency END price_currency,
          abs(extract(epoch from (slot.starts_at-$5::timestamptz))*1000)::bigint temporal_delta_ms
        FROM clinic_schema.appointment_slots slot
        JOIN clinic_schema.clinic_locations location ON location.id=slot.clinic_location_id AND location.status='ACTIVE'
        JOIN clinic_schema.clinics clinic ON clinic.id=location.clinic_id AND clinic.status='ACTIVE'
        JOIN clinic_schema.clinic_services service ON service.id=slot.service_id AND service.clinic_location_id=location.id AND service.active
        JOIN clinic_schema.doctor_services doctor_service ON doctor_service.id=slot.doctor_service_id AND doctor_service.service_id=slot.service_id AND doctor_service.clinic_location_id=location.id AND doctor_service.active
        JOIN clinic_schema.clinic_staff staff ON staff.id=doctor_service.staff_id AND staff.clinic_location_id=location.id AND staff.active
        LEFT JOIN clinic_schema.clinic_resources resource ON resource.id=doctor_service.resource_id AND resource.clinic_location_id=location.id
        JOIN clinic_schema.doctor_shifts shift ON shift.id=slot.doctor_shift_id AND shift.doctor_id=doctor_service.doctor_id AND shift.status='PUBLISHED'
        JOIN catalog_schema.doctors doctor ON doctor.id=doctor_service.doctor_id AND doctor.active AND doctor.public_booking_enabled
        WHERE service.code=$1 AND slot.id<>$2::uuid AND slot.source='DOCTOR_SHIFT' AND slot.state='OPEN'
          AND slot.publication_state='PUBLISHED' AND slot.source_stale_at IS NULL AND slot.starts_at>clock_timestamp()
          AND slot.capacity-slot.booked_count-slot.held_count>0
          AND (doctor_service.resource_id IS NULL OR resource.active)
          AND (service.supported_species IS NULL OR $6=ANY(service.supported_species))
        ORDER BY abs(extract(epoch from (slot.starts_at-$5::timestamptz))*1000)::bigint
        FETCH FIRST 250 ROWS WITH TIES`,[source.service_code,source.slot_id,source.latitude,source.longitude,source.starts_at,source.pet_species])).rows;
      for(const [index,c] of rankReallocationCandidates(candidates).slice(0,5).entries())await client.query(`INSERT INTO booking_schema.reallocation_offers
        (reallocation_case_id,clinic_id,location_id,doctor_id,service_id,doctor_service_id,slot_id,slot_version,rank,starts_at,ends_at,distance_meters,price_amount,price_currency)
        VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10,$11,$12,$13,$14)`,[created.id,c.clinic_id,c.location_id,c.doctor_id,c.service_id,c.doctor_service_id,c.slot_id,c.slot_version,index+1,c.starts_at,c.ends_at,c.distance_meters,c.price_amount,c.price_currency]);
      return this.readWithClient(client,created.id,input.ownerId);
    });
  }

  async owner(caseId:string,ownerId:string){return this.database.withTransaction(client=>this.readWithClient(client,caseId,ownerId));}
  async operations(caseId:string){return this.database.withTransaction(client=>this.readWithClient(client,caseId));}

  async accept(input:{caseId:string;offerId:string;caseVersion:number;offerVersion:number;slotVersion:number;ownerId:string;idempotencyKey:string;correlationId:string}):Promise<ReallocationCaseDto>{
    const source=await this.database.withTransaction(async client=>(await client.query<{
      case_status:string;case_version:number;accepted_offer_id:string|null;acceptance_idempotency_key:string|null;
      booking_hold_id:string;offer_version:number;slot_version:number;slot_id:string;clinic_id:string;location_id:string;service_id:string;doctor_id:string;pet_id:string;
    }>(`SELECT c.status case_status,c.version case_version,c.accepted_offer_id,c.acceptance_idempotency_key,
          c.booking_hold_id,offer.version offer_version,offer.slot_version,offer.slot_id,offer.clinic_id,offer.location_id,offer.service_id,offer.doctor_id,source_hold.pet_id
        FROM booking_schema.reallocation_cases c
        JOIN booking_schema.reallocation_offers offer ON offer.id=$2::uuid AND offer.reallocation_case_id=c.id
        JOIN booking_schema.booking_holds source_hold ON source_hold.id=c.booking_hold_id
        WHERE c.id=$1::uuid AND c.owner_id=$3::uuid`,[input.caseId,input.offerId,input.ownerId])).rows[0]);
    if(!source)throw new NotFoundException({code:'REALLOCATION_OFFER_NOT_FOUND'});
    if(source.case_status==='REPLACEMENT_PENDING_CONFIRMATION'&&(source.accepted_offer_id!==input.offerId||source.acceptance_idempotency_key!==input.idempotencyKey))throw new ConflictException({code:'REALLOCATION_ALREADY_ACCEPTED'});
    if(source.case_status==='OPEN'&&(source.case_version!==input.caseVersion||source.offer_version!==input.offerVersion||source.slot_version!==input.slotVersion))throw new ConflictException({code:'REALLOCATION_VERSION_CONFLICT'});

    await this.holdCreation.createLocalHold({slotId:source.slot_id,ownerId:input.ownerId,petId:source.pet_id,idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,expectedSlotVersion:source.slot_version,clinicId:source.clinic_id,locationId:source.location_id,serviceId:source.service_id,doctorId:null},{
      beforeCreate:async client=>{
        const locked=(await client.query<{case_status:string;case_version:number;offer_status:string;offer_version:number;slot_version:number;expires_at:Date;server_now:Date}>(`SELECT c.status case_status,c.version case_version,offer.status offer_status,offer.version offer_version,offer.slot_version,offer.expires_at,clock_timestamp() server_now
          FROM booking_schema.reallocation_cases c
          JOIN booking_schema.reallocation_offers offer ON offer.id=$2::uuid AND offer.reallocation_case_id=c.id
          JOIN booking_schema.booking_change_requests request ON request.id=c.booking_change_request_id
          JOIN booking_schema.booking_holds source_hold ON source_hold.id=c.booking_hold_id
          JOIN booking_schema.appointments appointment ON appointment.id=c.appointment_id
          JOIN clinic_schema.appointment_slots slot ON slot.id=offer.slot_id AND slot.version=offer.slot_version
            AND slot.clinic_location_id=offer.location_id AND slot.service_id=offer.service_id
            AND slot.doctor_id=offer.doctor_id AND slot.doctor_service_id=offer.doctor_service_id
          WHERE c.id=$1::uuid AND c.owner_id=$3::uuid
            AND request.request_type='RESCHEDULE' AND request.status IN ('OPEN','PROCESSING')
            AND source_hold.state='CONFIRMED' AND appointment.status='CONFIRMED'
          FOR UPDATE OF c,offer,request,source_hold,appointment`,[input.caseId,input.offerId,input.ownerId])).rows[0];
        if(!locked||locked.case_status!=='OPEN')throw new DomainException(HttpStatus.CONFLICT,'REALLOCATION_STATE_CONFLICT','Reallocation case is no longer active');
        if(locked.case_version!==input.caseVersion||locked.offer_version!==input.offerVersion||locked.slot_version!==input.slotVersion)throw new DomainException(HttpStatus.CONFLICT,'REALLOCATION_VERSION_CONFLICT','Reallocation offer version changed');
        if(locked.offer_status!=='OFFERED')throw new DomainException(HttpStatus.CONFLICT,'REALLOCATION_OFFER_UNAVAILABLE','Reallocation offer is unavailable');
        if(locked.expires_at<=locked.server_now)throw new DomainException(HttpStatus.CONFLICT,'REALLOCATION_OFFER_EXPIRED','Reallocation offer expired');
      },
      afterCreate:async(client,result)=>{
        const accepted=await client.query(`UPDATE booking_schema.reallocation_offers SET status='ACCEPTED',version=version+1 WHERE id=$1::uuid AND reallocation_case_id=$2::uuid AND status='OFFERED' AND version=$3`,[input.offerId,input.caseId,input.offerVersion]);
        if(accepted.rowCount!==1)throw new DomainException(HttpStatus.CONFLICT,'REALLOCATION_STATE_CONFLICT','Reallocation offer changed');
        await client.query(`UPDATE booking_schema.reallocation_offers SET status='INVALIDATED',version=version+1 WHERE reallocation_case_id=$1::uuid AND id<>$2::uuid AND status='OFFERED'`,[input.caseId,input.offerId]);
        const updated=await client.query<{version:number}>(`UPDATE booking_schema.reallocation_cases SET status='REPLACEMENT_PENDING_CONFIRMATION',accepted_offer_id=$2::uuid,replacement_booking_hold_id=$3::uuid,acceptance_idempotency_key=$4::uuid,accepted_at=clock_timestamp(),state_changed_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 WHERE id=$1::uuid AND status='OPEN' AND version=$5 RETURNING version`,[input.caseId,input.offerId,result.holdId,input.idempotencyKey,input.caseVersion]);
        if(updated.rowCount!==1)throw new DomainException(HttpStatus.CONFLICT,'REALLOCATION_STATE_CONFLICT','Reallocation case changed');
        const payload={caseId:input.caseId,acceptedOfferId:input.offerId,sourceBookingHoldId:source.booking_hold_id,replacementBookingHoldId:result.holdId,status:'REPLACEMENT_PENDING_CONFIRMATION'};
        await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('OWNER',$1::uuid,'reallocation.offer.accepted','reallocation_case',$2::uuid,$3::uuid,$4::jsonb)`,[input.ownerId,input.caseId,input.correlationId,JSON.stringify(payload)]);
        await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES('booking.reallocation-offer.accepted.v1','reallocation',$1::uuid,'reallocation_case',$2::uuid,$3,$4::jsonb,$5)`,[input.correlationId,input.caseId,updated.rows[0].version,JSON.stringify(payload),`booking.reallocation-offer.accepted.v1:${input.caseId}`]);
      },
    });
    return this.owner(input.caseId,input.ownerId);
  }

  private async readWithClient(client:any,caseId:string,ownerId?:string):Promise<ReallocationCaseDto>{
    const row=(await client.query(`SELECT c.*,clock_timestamp() server_now,
      CASE WHEN c.status='OPEN' AND request.request_type='RESCHEDULE' AND request.status IN ('OPEN','PROCESSING') AND hold.state='CONFIRMED' AND appointment.status='CONFIRMED'
        THEN 'ACTIVE' ELSE 'BOOKING_INELIGIBLE' END eligibility
      FROM booking_schema.reallocation_cases c
      JOIN booking_schema.booking_change_requests request ON request.id=c.booking_change_request_id
      JOIN booking_schema.booking_holds hold ON hold.id=c.booking_hold_id
      JOIN booking_schema.appointments appointment ON appointment.id=c.appointment_id
      WHERE c.id=$1::uuid AND ($2::uuid IS NULL OR c.owner_id=$2::uuid)`,[caseId,ownerId??null])).rows[0] as (CaseRow&{eligibility:string})|undefined;
    if(!row)throw new NotFoundException({code:'REALLOCATION_CASE_NOT_FOUND'});
    const offers=(await client.query(`SELECT offer.*,clock_timestamp() server_now,clinic.public_name clinic_name,location.address location_address,location.timezone,
        doctor.full_name doctor_name,service.display_name service_name,
        slot.version current_slot_version,slot.state slot_state,slot.publication_state,slot.source_stale_at,slot.capacity,slot.booked_count,slot.held_count,
        service.active service_active,doctor_service.active doctor_service_active,doctor_service.resource_id current_resource_id,
        staff.active staff_active,resource.active resource_active,shift.status shift_status,
        clinic.status clinic_status,location.status location_status,doctor.active doctor_active,doctor.public_booking_enabled
      FROM booking_schema.reallocation_offers offer
      JOIN clinic_schema.clinics clinic ON clinic.id=offer.clinic_id
      JOIN clinic_schema.clinic_locations location ON location.id=offer.location_id
      JOIN catalog_schema.doctors doctor ON doctor.id=offer.doctor_id
      JOIN clinic_schema.clinic_services service ON service.id=offer.service_id AND service.clinic_location_id=offer.location_id
      LEFT JOIN clinic_schema.appointment_slots slot ON slot.id=offer.slot_id AND slot.clinic_location_id=offer.location_id
      LEFT JOIN clinic_schema.doctor_services doctor_service ON doctor_service.id=offer.doctor_service_id AND doctor_service.clinic_location_id=offer.location_id AND doctor_service.service_id=offer.service_id AND doctor_service.doctor_id=offer.doctor_id
      LEFT JOIN clinic_schema.clinic_staff staff ON staff.id=doctor_service.staff_id AND staff.clinic_location_id=offer.location_id
      LEFT JOIN clinic_schema.clinic_resources resource ON resource.id=doctor_service.resource_id AND resource.clinic_location_id=offer.location_id
      LEFT JOIN clinic_schema.doctor_shifts shift ON shift.id=slot.doctor_shift_id AND shift.doctor_id=offer.doctor_id AND shift.clinic_location_id=offer.location_id
      WHERE offer.reallocation_case_id=$1::uuid ORDER BY offer.rank,offer.id`,[caseId])).rows.map((o:any):ReallocationOfferDto=>{
        const stillEligible=o.current_slot_version===o.slot_version&&o.slot_state==='OPEN'&&o.publication_state==='PUBLISHED'&&o.source_stale_at===null&&o.capacity-o.booked_count-o.held_count>0&&o.service_active===true&&o.doctor_service_active===true&&o.staff_active===true&&(o.current_resource_id===null||o.resource_active===true)&&o.shift_status==='PUBLISHED'&&o.clinic_status==='ACTIVE'&&o.location_status==='ACTIVE'&&o.doctor_active===true&&o.public_booking_enabled===true;
        const status=o.status==='ACCEPTED'?'ACCEPTED':o.status==='INVALIDATED'||!stillEligible?'INVALIDATED':o.expires_at<=o.server_now?'EXPIRED':'OFFERED';
        return{offerId:o.id,version:o.version,rank:o.rank,clinicId:o.clinic_id,clinicName:o.clinic_name,locationId:o.location_id,locationAddress:o.location_address,timezone:o.timezone,doctorId:o.doctor_id,doctorName:o.doctor_name,serviceId:o.service_id,serviceName:o.service_name,slotId:o.slot_id,slotVersion:o.slot_version,startsAt:o.starts_at.toISOString(),endsAt:o.ends_at.toISOString(),distanceMeters:o.distance_meters===null?null:Number(o.distance_meters),priceAmount:o.price_amount===null?null:Number(o.price_amount),priceCurrency:o.price_currency?.trim()??null,status,expiresAt:o.expires_at.toISOString()};
      });
    const replacement=row.replacement_booking_hold_id?(await client.query(`SELECT id,slot_id,state,confirmation_sla_expires_at,expires_at,version FROM booking_schema.booking_holds WHERE id=$1::uuid`,[row.replacement_booking_hold_id])).rows[0]:null;
    const replacementStatus: 'PENDING_CONFIRMATION'|'CONFIRMED'|'REJECTED'|'EXPIRED'|null = !replacement?null
      :replacement.state==='MANUAL_CONFIRM_PENDING'?'PENDING_CONFIRMATION'
      :replacement.state==='CONFIRMED'?'CONFIRMED'
      :replacement.state==='RELEASED'&&row.status==='CLOSED'?'REJECTED'
      :(replacement.state==='EXPIRED'||replacement.state==='SLA_BREACHED')&&row.status==='CLOSED'?'EXPIRED':null;
    if(replacement&&!replacementStatus)throw new ConflictException({code:'REALLOCATION_REPLACEMENT_STATE_CONFLICT'});
    return {caseId:row.id,bookingChangeRequestId:row.booking_change_request_id,bookingHoldId:row.booking_hold_id,status:row.status,eligibility:row.eligibility,version:row.version,serverNow:row.server_now.toISOString(),createdAt:row.created_at.toISOString(),acceptedOfferId:row.accepted_offer_id??null,replacementBooking:replacement?{holdId:replacement.id,status:replacementStatus!,confirmationMode:'MANUAL',slotId:replacement.slot_id,aggregateVersion:replacement.version,expiresAt:(replacement.confirmation_sla_expires_at??replacement.expires_at).toISOString()}:null,offers};
  }
}
