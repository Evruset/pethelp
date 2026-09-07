import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {Role} from '../src/auth/auth.types';
import {BookingHoldCreationService} from '../src/booking-core/booking-hold-creation.service';
import {BookingRepository} from '../src/booking-core/booking.repository';
import {DoctorShiftInventoryService} from '../src/booking-core/doctor-shift-inventory.service';
import {ReallocationService} from '../src/booking-core/reallocation.service';
import {ReallocationFinalizationService} from '../src/booking-core/reallocation-finalization.service';
import {BookingSecurityService} from '../src/booking-core/booking-security.service';
import {BookingService} from '../src/booking-core/booking.service';
import {DatabaseService} from '../src/database/database.service';

jest.setTimeout(60_000);

describe('W6-C1 authoritative offer acceptance (real PostgreSQL)',()=>{
  const db=new DatabaseService();
  const holdCreation=new BookingHoldCreationService(db,new BookingRepository());
  const reallocation=new ReallocationService(db,holdCreation);
  const finalization=new ReallocationFinalizationService();
  const inventory=new DoctorShiftInventoryService(db,{assertScheduleManageAccess:jest.fn(),assertScheduleReadAccess:jest.fn()} as never);
  const id={owner:randomUUID(),foreign:randomUUID(),employee:randomUUID(),pet:randomUUID(),clinic:randomUUID(),location:randomUUID(),service:randomUUID(),specialty:randomUUID(),doctor:randomUUID(),staff:randomUUID(),sourceSlot:randomUUID(),sourceHold:randomUUID()};
  const actor={sub:id.employee,roles:[Role.CLINIC_ADMIN],clinicIds:[id.clinic],locationIds:[id.location]};
  let caseId:string,offerId:string,caseVersion:number,offerVersion:number,slotVersion:number,targetSlot:string,replacementHoldId:string,otherOffers:Array<{offerId:string;version:number;slotVersion:number;slotId:string}>;
  const createPending=async()=>{const sourceSlot=randomUUID(),sourceHold=randomUUID();await db.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,booked_count,held_count,state,publication_state,integration_mode) VALUES($1,$2,$3,clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 30 minutes',1,1,0,'OPEN','PUBLISHED','LEVEL_C')`,[sourceSlot,id.location,id.service]);await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '4 days')`,[sourceHold,sourceSlot,id.owner,id.pet]);const appointment=(await db.query(`INSERT INTO booking_schema.appointments(hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES($1,$2,$3,$4,$5,'CONFIRMED') RETURNING id::text`,[sourceHold,id.owner,id.pet,id.location,sourceSlot])).rows[0].id;const request=(await db.query(`INSERT INTO booking_schema.booking_change_requests(request_type,booking_hold_id,appointment_id,owner_id,clinic_id,location_id,slot_id,idempotency_key,correlation_id) VALUES('RESCHEDULE',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,[sourceHold,appointment,id.owner,id.clinic,id.location,sourceSlot,randomUUID(),randomUUID()])).rows[0].id;const opened=await reallocation.open({requestId:request,ownerId:id.owner,idempotencyKey:randomUUID(),correlationId:randomUUID()});const offer=opened.offers.find(item=>item.status==='OFFERED');if(!offer)throw new Error('missing offer');const accepted=await reallocation.accept({caseId:opened.caseId,offerId:offer.offerId,caseVersion:opened.version,offerVersion:offer.version,slotVersion:offer.slotVersion,ownerId:id.owner,idempotencyKey:randomUUID(),correlationId:randomUUID()});return{sourceSlot,sourceHold,caseId:opened.caseId,offerId:offer.offerId,replacementHold:accepted.replacementBooking!.holdId,targetSlot:offer.slotId};};

  beforeAll(async()=>{
    await db.query(`INSERT INTO identity_schema.users(id) VALUES($1),($2),($3)`,[id.owner,id.foreign,id.employee]);
    await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'W6C1 pet','DOG')`,[id.pet,id.owner]);
    await db.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone) VALUES($1,'W6C1','W6C1','ACTIVE','Europe/Moscow')`,[id.clinic]);
    await db.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'W6C1','ACTIVE','Europe/Moscow')`,[id.location,id.clinic]);
    await db.query(`INSERT INTO catalog_schema.specialties(id,name,code) VALUES($1,'W6C1',$2)`,[id.specialty,`W6C1_${id.specialty.replaceAll('-','')}`]);
    await db.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'W6C1 doctor',$3,true,true)`,[id.doctor,id.location,id.specialty]);
    await db.query(`INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active,catalog_doctor_id) VALUES($1,$2,$3,'W6C1 doctor','VETERINARIAN',true,$4)`,[id.staff,id.location,`w6c1_${id.staff.replaceAll('-','')}`,id.doctor]);
    await db.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active) VALUES($1,$2,$3,'W6C1 service',30,true)`,[id.service,id.location,`W6C1_${id.service.replaceAll('-','')}`]);
    await inventory.createDoctorService({clinicId:id.clinic,locationId:id.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:id.staff,doctorId:id.doctor,serviceId:id.service,resourceId:null});
    const start=new Date(Date.now()+3*86_400_000);start.setUTCMinutes(0,0,0);
    const shift=await inventory.createShift({clinicId:id.clinic,locationId:id.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:id.staff,doctorId:id.doctor,startsAt:start.toISOString(),endsAt:new Date(start.getTime()+2*3_600_000).toISOString()});
    const run=await inventory.generate({clinicId:id.clinic,locationId:id.location,shiftId:shift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:shift.version});
    await inventory.publish({clinicId:id.clinic,locationId:id.location,runId:run.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID()});
    await db.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,booked_count,held_count,state,publication_state,integration_mode) VALUES($1,$2,$3,clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 30 minutes',1,1,0,'OPEN','PUBLISHED','LEVEL_C')`,[id.sourceSlot,id.location,id.service]);
    await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '4 days')`,[id.sourceHold,id.sourceSlot,id.owner,id.pet]);
    const appointment=(await db.query(`INSERT INTO booking_schema.appointments(hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES($1,$2,$3,$4,$5,'CONFIRMED') RETURNING id::text`,[id.sourceHold,id.owner,id.pet,id.location,id.sourceSlot])).rows[0].id;
    const request=(await db.query(`INSERT INTO booking_schema.booking_change_requests(request_type,booking_hold_id,appointment_id,owner_id,clinic_id,location_id,slot_id,idempotency_key,correlation_id) VALUES('RESCHEDULE',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,[id.sourceHold,appointment,id.owner,id.clinic,id.location,id.sourceSlot,randomUUID(),randomUUID()])).rows[0].id;
    const opened=await reallocation.open({requestId:request,ownerId:id.owner,idempotencyKey:randomUUID(),correlationId:randomUUID()});
    const offered=opened.offers[0];expect(opened.offers.length).toBeGreaterThanOrEqual(4);caseId=opened.caseId;caseVersion=opened.version;offerId=offered.offerId;offerVersion=offered.version;slotVersion=offered.slotVersion;targetSlot=offered.slotId;otherOffers=opened.offers.slice(1).map(item=>({offerId:item.offerId,version:item.version,slotVersion:item.slotVersion,slotId:item.slotId}));
  });

  afterAll(async()=>{
    await db.query(`BEGIN`);
    try{
      await db.query(`SET LOCAL session_replication_role='replica'`);
      await db.query(`DELETE FROM booking_schema.reallocation_offers WHERE reallocation_case_id IN (SELECT id FROM booking_schema.reallocation_cases WHERE owner_id=$1)`,[id.owner]);
      await db.query(`DELETE FROM booking_schema.reallocation_cases WHERE owner_id=$1`,[id.owner]);
      await db.query(`COMMIT`);
    }catch(error){await db.query(`ROLLBACK`);throw error;}
    await db.query(`DELETE FROM booking_schema.owner_notification_email_deliveries WHERE notification_id IN (SELECT id FROM booking_schema.owner_notifications WHERE source_outbox_event_id IN (SELECT id FROM booking_schema.outbox_events WHERE aggregate_id IN (SELECT id FROM booking_schema.booking_holds WHERE owner_id=$1) OR payload_json->>'sourceBookingHoldId'=$2))`,[id.owner,id.sourceHold]);
    await db.query(`DELETE FROM booking_schema.owner_notifications WHERE source_outbox_event_id IN (SELECT id FROM booking_schema.outbox_events WHERE aggregate_id IN (SELECT id FROM booking_schema.booking_holds WHERE owner_id=$1) OR payload_json->>'sourceBookingHoldId'=$2)`,[id.owner,id.sourceHold]);
    await db.query(`DELETE FROM booking_schema.outbox_events WHERE aggregate_id IN (SELECT id FROM booking_schema.booking_holds WHERE owner_id=$1) OR payload_json->>'sourceBookingHoldId'=$2`,[id.owner,id.sourceHold]);
    await db.query(`DELETE FROM booking_schema.idempotency_records WHERE scope IN ($1,$2) OR scope LIKE $3`,[`booking.create-local-hold:${id.owner}`,`doctor-shift-inventory:${id.employee}`,`%:${id.employee}`]);
    await db.query(`DELETE FROM booking_schema.booking_change_requests WHERE owner_id=$1`,[id.owner]);
    await db.query(`DELETE FROM booking_schema.appointment_events WHERE hold_id IN (SELECT id FROM booking_schema.booking_holds WHERE owner_id=$1)`,[id.owner]);
    await db.query(`DELETE FROM booking_schema.appointments WHERE owner_id=$1`,[id.owner]);
    await db.query(`DELETE FROM booking_schema.booking_holds WHERE owner_id=$1`,[id.owner]);
    await db.query(`DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1`,[id.location]);
    await db.query(`DELETE FROM booking_schema.outbox_events WHERE aggregate_id IN (SELECT id FROM clinic_schema.inventory_generation_runs WHERE doctor_shift_id IN (SELECT id FROM clinic_schema.doctor_shifts WHERE clinic_id=$1))`,[id.clinic]);
    await db.query(`DELETE FROM clinic_schema.inventory_generation_runs WHERE doctor_shift_id IN (SELECT id FROM clinic_schema.doctor_shifts WHERE clinic_id=$1)`,[id.clinic]);
    await db.query(`DELETE FROM clinic_schema.doctor_shifts WHERE clinic_id=$1`,[id.clinic]);
    await db.query(`DELETE FROM clinic_schema.doctor_services WHERE clinic_location_id=$1`,[id.location]);
    await db.query(`DELETE FROM clinic_schema.clinic_services WHERE clinic_location_id=$1`,[id.location]);
    await db.query(`DELETE FROM clinic_schema.clinic_staff WHERE id=$1`,[id.staff]);
    await db.query(`DELETE FROM catalog_schema.doctors WHERE id=$1`,[id.doctor]);
    await db.query(`DELETE FROM catalog_schema.specialties WHERE id=$1`,[id.specialty]);
    await db.query(`DELETE FROM clinic_schema.clinic_locations WHERE id=$1`,[id.location]);
    await db.query(`DELETE FROM clinic_schema.clinics WHERE id=$1`,[id.clinic]);
    await db.query(`DELETE FROM pet_schema.pets WHERE id=$1`,[id.pet]);
    await db.query(`DELETE FROM identity_schema.users WHERE id=ANY($1::uuid[])`,[[id.owner,id.foreign,id.employee]]);
    await db.onModuleDestroy();
  });

  it('rejects partial lineage plus expired, stale and consumed offers without creating Booking B',async()=>{
    await expect(db.query(`UPDATE booking_schema.reallocation_cases SET accepted_offer_id=$2 WHERE id=$1`,[caseId,offerId])).rejects.toMatchObject({code:'23514'});
    const expired=otherOffers[0];await db.query(`UPDATE booking_schema.reallocation_offers SET created_at=statement_timestamp()-interval '20 minutes',expires_at=statement_timestamp()-interval '5 minutes' WHERE id=$1`,[expired.offerId]);
    const command=(item:typeof expired)=>reallocation.accept({caseId,offerId:item.offerId,caseVersion,offerVersion:item.version,slotVersion:item.slotVersion,ownerId:id.owner,idempotencyKey:randomUUID(),correlationId:randomUUID()});
    await expect(command(expired)).rejects.toMatchObject({status:409,response:{code:'REALLOCATION_OFFER_EXPIRED'}});
    const stale=otherOffers[1];await db.query(`UPDATE clinic_schema.appointment_slots SET version=version+1 WHERE id=$1`,[stale.slotId]);await expect(command(stale)).rejects.toMatchObject({status:409});
    const consumed=otherOffers[2];await db.query(`UPDATE clinic_schema.appointment_slots SET held_count=capacity,status='LOCKED_BY_HOLD' WHERE id=$1`,[consumed.slotId]);await expect(command(consumed)).rejects.toMatchObject({status:409});
    expect((await db.query(`SELECT status,accepted_offer_id,replacement_booking_hold_id FROM booking_schema.reallocation_cases WHERE id=$1`,[caseId])).rows[0]).toEqual({status:'OPEN',accepted_offer_id:null,replacement_booking_hold_id:null});expect((await db.query(`SELECT count(*)::int count FROM booking_schema.booking_holds WHERE owner_id=$1 AND id<>$2`,[id.owner,id.sourceHold])).rows[0].count).toBe(0);
  });

  it('creates exactly one manual-confirm Booking B under a race and preserves Booking A',async()=>{
    const sourceBefore=(await db.query(`SELECT hold.state,hold.version,appointment.status,slot.booked_count,slot.held_count,slot.version slot_version FROM booking_schema.booking_holds hold JOIN booking_schema.appointments appointment ON appointment.hold_id=hold.id JOIN clinic_schema.appointment_slots slot ON slot.id=hold.slot_id WHERE hold.id=$1`,[id.sourceHold])).rows[0];
    const targetBefore=(await db.query(`SELECT held_count,booked_count,version FROM clinic_schema.appointment_slots WHERE id=$1`,[targetSlot])).rows[0];
    const firstKey=randomUUID(),secondKey=randomUUID();const command=(key:string)=>reallocation.accept({caseId,offerId,caseVersion,offerVersion,slotVersion,ownerId:id.owner,idempotencyKey:key,correlationId:randomUUID()});
    const raced=await Promise.allSettled([command(firstKey),command(secondKey)]);const successes=raced.filter((item):item is PromiseFulfilledResult<Awaited<ReturnType<typeof command>>>=>item.status==='fulfilled');expect(successes).toHaveLength(1);
    const result=successes[0].value;expect(result).toMatchObject({status:'REPLACEMENT_PENDING_CONFIRMATION',acceptedOfferId:offerId,replacementBooking:{status:'PENDING_CONFIRMATION',confirmationMode:'MANUAL',slotId:targetSlot}});expect(result.offers.find(item=>item.offerId===offerId)?.status).toBe('ACCEPTED');expect(result.offers.filter(item=>item.offerId!==offerId).every(item=>item.status==='INVALIDATED')).toBe(true);
    expect((await db.query(`SELECT hold.state,hold.version,appointment.status,slot.booked_count,slot.held_count,slot.version slot_version FROM booking_schema.booking_holds hold JOIN booking_schema.appointments appointment ON appointment.hold_id=hold.id JOIN clinic_schema.appointment_slots slot ON slot.id=hold.slot_id WHERE hold.id=$1`,[id.sourceHold])).rows[0]).toEqual(sourceBefore);
    expect((await db.query(`SELECT held_count,booked_count,version FROM clinic_schema.appointment_slots WHERE id=$1`,[targetSlot])).rows[0]).toEqual({held_count:targetBefore.held_count+1,booked_count:targetBefore.booked_count,version:targetBefore.version+1});
    const lineage=(await db.query(`SELECT c.status,c.accepted_offer_id::text,c.replacement_booking_hold_id::text,h.state,h.owner_id::text,h.slot_id::text FROM booking_schema.reallocation_cases c JOIN booking_schema.booking_holds h ON h.id=c.replacement_booking_hold_id WHERE c.id=$1`,[caseId])).rows[0];expect(lineage).toMatchObject({status:'REPLACEMENT_PENDING_CONFIRMATION',accepted_offer_id:offerId,replacement_booking_hold_id:result.replacementBooking!.holdId,state:'MANUAL_CONFIRM_PENDING',owner_id:id.owner,slot_id:targetSlot});
    const winningKey=raced[0].status==='fulfilled'?firstKey:secondKey;const replay=await command(winningKey);expect(replay.replacementBooking?.holdId).toBe(result.replacementBooking!.holdId);expect((await db.query(`SELECT count(*)::int count FROM booking_schema.booking_holds WHERE owner_id=$1 AND id<>$2`,[id.owner,id.sourceHold])).rows[0].count).toBe(1);
    replacementHoldId=result.replacementBooking!.holdId;
    await expect(reallocation.accept({caseId,offerId,caseVersion,offerVersion,slotVersion,ownerId:id.foreign,idempotencyKey:randomUUID(),correlationId:randomUUID()})).rejects.toBeInstanceOf(Error);
  });

  it('confirms Booking B and atomically cuts over Booking A exactly once while preserving lineage',async()=>{
    const access={assertBookingDecisionCapability:jest.fn(),assertBookingDecisionAccess:jest.fn()} as never;
    const security=new BookingSecurityService(db,access,undefined,undefined,finalization);
    const employee={sub:id.employee,roles:[Role.CLINIC_ADMIN],clinicIds:[id.clinic],locationIds:[id.location]};
    const result=await security.confirmManualHold({holdId:replacementHoldId,employee,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:1});
    expect(result.state).toBe('CONFIRMED');
    expect((await db.query(`SELECT state FROM booking_schema.booking_holds WHERE id=$1`,[id.sourceHold])).rows[0].state).toBe('RELEASED');
    expect((await db.query(`SELECT status FROM booking_schema.appointments WHERE hold_id=$1`,[id.sourceHold])).rows[0].status).toBe('CANCELLED');
    expect((await db.query(`SELECT booked_count FROM clinic_schema.appointment_slots WHERE id=$1`,[id.sourceSlot])).rows[0].booked_count).toBe(0);
    expect((await db.query(`SELECT held_count,booked_count FROM clinic_schema.appointment_slots WHERE id=$1`,[targetSlot])).rows[0]).toEqual({held_count:0,booked_count:1});
    expect((await db.query(`SELECT status,accepted_offer_id::text,replacement_booking_hold_id::text FROM booking_schema.reallocation_cases WHERE id=$1`,[caseId])).rows[0]).toEqual({status:'CLOSED',accepted_offer_id:offerId,replacement_booking_hold_id:replacementHoldId});
    expect((await db.query(`SELECT status FROM booking_schema.reallocation_offers WHERE id=$1`,[offerId])).rows[0].status).toBe('ACCEPTED');
    const readback=await reallocation.owner(caseId,id.owner);expect(readback.replacementBooking?.status).toBe('CONFIRMED');
    await expect(db.query(`UPDATE booking_schema.reallocation_cases SET accepted_offer_id=NULL WHERE id=$1`,[caseId])).rejects.toMatchObject({code:'23514'});
    const down=spawnSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),['down','--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'],{cwd:process.cwd(),env:process.env,encoding:'utf8'});
    expect(down.status).not.toBe(0);expect(`${down.stdout}${down.stderr}`).toContain('W6C2_TERMINAL_ACCEPTANCE_DOWN_REMEDIATION_APPROVAL_REQUIRED');
  });

  it('recovers Booking A unchanged after real clinic rejection and canonical worker expiry',async()=>{
    const access={assertBookingDecisionCapability:jest.fn(),assertBookingDecisionAccess:jest.fn()} as never;const security=new BookingSecurityService(db,access,undefined,undefined,finalization);const employee={sub:id.employee,roles:[Role.CLINIC_ADMIN],clinicIds:[id.clinic],locationIds:[id.location]};
    const rejected=await createPending();const beforeReject=(await db.query(`SELECT h.state,h.version,a.status,s.booked_count FROM booking_schema.booking_holds h JOIN booking_schema.appointments a ON a.hold_id=h.id JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id WHERE h.id=$1`,[rejected.sourceHold])).rows[0];await security.declineManualHold({holdId:rejected.replacementHold,employee,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:1});expect((await db.query(`SELECT h.state,c.status,s.held_count,o.status offer_status FROM booking_schema.booking_holds h JOIN booking_schema.reallocation_cases c ON c.replacement_booking_hold_id=h.id JOIN booking_schema.reallocation_offers o ON o.id=c.accepted_offer_id JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id WHERE h.id=$1`,[rejected.replacementHold])).rows[0]).toEqual({state:'RELEASED',status:'CLOSED',held_count:0,offer_status:'ACCEPTED'});expect((await db.query(`SELECT h.state,h.version,a.status,s.booked_count FROM booking_schema.booking_holds h JOIN booking_schema.appointments a ON a.hold_id=h.id JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id WHERE h.id=$1`,[rejected.sourceHold])).rows[0]).toEqual(beforeReject);expect((await reallocation.owner(rejected.caseId,id.owner)).replacementBooking?.status).toBe('REJECTED');
    const expired=await createPending();const beforeExpiry=(await db.query(`SELECT h.state,h.version,a.status,s.booked_count FROM booking_schema.booking_holds h JOIN booking_schema.appointments a ON a.hold_id=h.id JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id WHERE h.id=$1`,[expired.sourceHold])).rows[0];await db.query(`UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1`,[expired.replacementHold]);const worker=new BookingService(db,new BookingRepository(),finalization);expect((await worker.expireHolds(1)).expired).toBe(1);expect((await db.query(`SELECT h.state,c.status,s.held_count,o.status offer_status FROM booking_schema.booking_holds h JOIN booking_schema.reallocation_cases c ON c.replacement_booking_hold_id=h.id JOIN booking_schema.reallocation_offers o ON o.id=c.accepted_offer_id JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id WHERE h.id=$1`,[expired.replacementHold])).rows[0]).toEqual({state:'EXPIRED',status:'CLOSED',held_count:0,offer_status:'ACCEPTED'});expect((await db.query(`SELECT h.state,h.version,a.status,s.booked_count FROM booking_schema.booking_holds h JOIN booking_schema.appointments a ON a.hold_id=h.id JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id WHERE h.id=$1`,[expired.sourceHold])).rows[0]).toEqual(beforeExpiry);expect((await reallocation.owner(expired.caseId,id.owner)).replacementBooking?.status).toBe('EXPIRED');
  });
});
